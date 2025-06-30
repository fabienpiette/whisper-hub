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
	logger := initializeLogger()
	cfg := loadAndValidateConfig(logger)

	services := initializeServices(cfg, logger)
	handlers := initializeHandlers(cfg, logger, services)
	middlewares := initializeMiddleware()

	router := setupRoutes(cfg, handlers, middlewares, services)

	server := createServer(cfg, router)
	startServerWithGracefulShutdown(server, cfg, logger)
}

// Services holds all application services
type Services struct {
	Metrics         *middleware.Metrics
	RateLimiter     *middleware.RateLimiter
	TemplateService *template.Service
}

// Handlers holds all HTTP handlers
type Handlers struct {
	Transcribe *handler.TranscribeHandler
	History    *handler.HistoryAssetsHandler
}

// Middleware holds all middleware instances
type Middleware struct {
	Security        *middleware.SecurityMiddleware
	GlobalRateLimit *middleware.RateLimiter
}

func initializeLogger() *slog.Logger {
	godotenv.Load()
	
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)
	
	return logger
}

func loadAndValidateConfig(logger *slog.Logger) *config.Config {
	cfg := config.Load()
	
	if cfg.OpenAIAPIKey == "" {
		logger.Error("OPENAI_API_KEY environment variable is required")
		os.Exit(1)
	}
	
	return cfg
}

func initializeServices(cfg *config.Config, logger *slog.Logger) *Services {
	metrics := middleware.NewMetrics()
	rateLimiter := middleware.NewRateLimiter(constants.DefaultRateLimit, constants.DefaultRateWindow)
	
	templateService, err := template.NewService("web/templates")
	if err != nil {
		logger.Error("failed to initialize template service", "error", err)
		os.Exit(1)
	}
	
	return &Services{
		Metrics:         metrics,
		RateLimiter:     rateLimiter,
		TemplateService: templateService,
	}
}

func initializeHandlers(cfg *config.Config, logger *slog.Logger, services *Services) *Handlers {
	transcribeHandler := handler.NewTranscribeHandler(cfg, logger, services.TemplateService, services.Metrics)
	historyHandler := handler.NewHistoryAssetsHandler(cfg)
	
	return &Handlers{
		Transcribe: transcribeHandler,
		History:    historyHandler,
	}
}

func initializeMiddleware() *Middleware {
	security := middleware.NewSecurityMiddleware()
	globalRateLimit := middleware.NewRateLimiter(100, 1*time.Minute)
	
	return &Middleware{
		Security:        security,
		GlobalRateLimit: globalRateLimit,
	}
}

func setupRoutes(cfg *config.Config, handlers *Handlers, middlewares *Middleware, services *Services) *mux.Router {
	r := mux.NewRouter()
	
	// Apply global middleware chain
	globalChain := middleware.GlobalChain(
		middlewares.Security,
		middlewares.GlobalRateLimit, 
		slog.Default(),
		services.Metrics,
	)
	globalChain.ApplyToRouter(r)
	
	// Apply secure middleware to transcribe endpoint
	transcribeRouter := r.PathPrefix("/transcribe").Subrouter()
	secureChain := middleware.SecureChain(
		middlewares.Security,
		services.RateLimiter,
		slog.Default(),
	)
	secureChain.ApplyToRouter(transcribeRouter)
	transcribeRouter.HandleFunc("", handlers.Transcribe.HandleTranscribe).Methods("POST")
	
	// Static file serving
	r.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir("web/static/"))))
	
	// History assets (if enabled)
	if cfg.HistoryEnabled {
		r.PathPrefix(cfg.HistoryJSPath).HandlerFunc(handlers.History.HandleHistoryAssets)
		r.HandleFunc("/api/history/config", handlers.History.HandleHistoryConfig).Methods("GET")
	}
	
	// Public routes
	r.HandleFunc("/", handlers.Transcribe.HandleIndex).Methods("GET")
	r.HandleFunc("/api/csrf-token", handlers.Transcribe.HandleCSRFToken).Methods("GET")
	r.HandleFunc("/health", handlers.Transcribe.HandleHealth).Methods("GET")
	r.HandleFunc("/metrics", handlers.Transcribe.HandleMetrics(services.Metrics)).Methods("GET")
	
	return r
}

func createServer(cfg *config.Config, router *mux.Router) *http.Server {
	return &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  constants.ServerReadTimeout,
		WriteTimeout: constants.ServerWriteTimeout,
		IdleTimeout:  constants.ServerIdleTimeout,
	}
}

func startServerWithGracefulShutdown(server *http.Server, cfg *config.Config, logger *slog.Logger) {
	// Start server in background
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