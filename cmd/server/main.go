package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"whisper-hub/internal/config"
	"whisper-hub/internal/constants"
	"whisper-hub/internal/handler"
	"whisper-hub/internal/middleware"
	"whisper-hub/internal/template"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()

	// Setup structured logging
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	cfg := config.Load()
	
	if cfg.OpenAIAPIKey == "" {
		logger.Error("OPENAI_API_KEY environment variable is required")
		os.Exit(1)
	}

	// Initialize metrics
	metrics := middleware.NewMetrics()
	
	// Initialize rate limiter
	rateLimiter := middleware.NewRateLimiter(constants.DefaultRateLimit, constants.DefaultRateWindow)

	// Initialize template service
	templateService, err := template.NewService("web/templates")
	if err != nil {
		logger.Error("failed to initialize template service", "error", err)
		os.Exit(1)
	}

	transcribeHandler := handler.NewTranscribeHandler(cfg, logger, templateService, metrics)
	historyHandler := handler.NewHistoryAssetsHandler(cfg)

	// Initialize security middleware
	security := middleware.NewSecurityMiddleware()
	globalRateLimit := middleware.NewRateLimiter(100, 1*time.Minute) // 100 requests per minute

	r := mux.NewRouter()
	
	// Add security middleware
	r.Use(security.SecurityHeaders)
	r.Use(globalRateLimit.RateLimit())
	r.Use(middleware.CORS())
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestLogger(logger))
	r.Use(metrics.RequestMetrics())
	
	// Apply CSRF protection and rate limiting to transcribe endpoint
	transcribeRouter := r.PathPrefix("/transcribe").Subrouter()
	transcribeRouter.Use(security.CSRFProtection)
	transcribeRouter.Use(rateLimiter.RateLimit())
	transcribeRouter.HandleFunc("", transcribeHandler.HandleTranscribe).Methods("POST")
	
	// Static file serving
	r.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir("web/static/"))))
	
	// History assets (if enabled)
	if cfg.HistoryEnabled {
		r.PathPrefix(cfg.HistoryJSPath).HandlerFunc(historyHandler.HandleHistoryAssets)
		r.HandleFunc("/api/history/config", historyHandler.HandleHistoryConfig).Methods("GET")
	}

	// Public routes
	r.HandleFunc("/", transcribeHandler.HandleIndex).Methods("GET")
	r.HandleFunc("/api/csrf-token", transcribeHandler.HandleCSRFToken).Methods("GET")
	r.HandleFunc("/health", transcribeHandler.HandleHealth).Methods("GET")
	r.HandleFunc("/metrics", transcribeHandler.HandleMetrics(metrics)).Methods("GET")

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  constants.ServerReadTimeout,
		WriteTimeout: constants.ServerWriteTimeout,
		IdleTimeout:  constants.ServerIdleTimeout,
	}

	// Graceful shutdown
	go func() {
		logger.Info("server starting", "port", cfg.Port)
		logger.Info("visit service", "url", "http://localhost:"+cfg.Port)
		
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server failed to start", "error", err)
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("server shutting down")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), constants.ServerShutdownTimeout)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Error("server forced to shutdown", "error", err)
	}

	logger.Info("server exited")
}