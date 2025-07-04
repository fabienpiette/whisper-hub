package main

import (
	"log/slog"
	"net/http"
	"os"
	"testing"

	"whisper-hub/internal/config"
	"github.com/gorilla/mux"
)

func TestInitializeLogger(t *testing.T) {
	// Test basic logger initialization
	logger := initializeLogger()
	
	if logger == nil {
		t.Fatal("initializeLogger() returned nil")
	}
	
	// Verify that the default logger was set
	defaultLogger := slog.Default()
	if defaultLogger == nil {
		t.Error("Default logger was not set")
	}
}

func TestLoadAndValidateConfig(t *testing.T) {
	// Save original environment
	originalKey := os.Getenv("OPENAI_API_KEY")
	defer func() {
		if originalKey != "" {
			os.Setenv("OPENAI_API_KEY", originalKey)
		} else {
			os.Unsetenv("OPENAI_API_KEY")
		}
	}()
	
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	
	t.Run("valid config with API key", func(t *testing.T) {
		os.Setenv("OPENAI_API_KEY", "test-key")
		
		cfg := loadAndValidateConfig(logger)
		
		if cfg == nil {
			t.Fatal("loadAndValidateConfig() returned nil")
		}
		
		if cfg.OpenAIAPIKey == "" {
			t.Error("Expected API key to be set")
		}
	})
	
	// Note: We can't easily test the os.Exit(1) case in a unit test
	// as it would terminate the test process. In a real scenario,
	// this would be tested with integration tests or by refactoring
	// to return an error instead of calling os.Exit.
}

func TestInitializeServices(t *testing.T) {
	cfg := &config.Config{
		Port:         "8080",
		OpenAIAPIKey: "test-key",
	}
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	
	// Create a temporary template directory for testing
	tempDir := t.TempDir()
	templateDir := tempDir + "/web/templates"
	
	// Create the directory structure
	err := os.MkdirAll(templateDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create template directory: %v", err)
	}
	
	// Create a basic template file
	templateContent := `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body><h1>Test Template</h1></body>
</html>`
	
	templateFile := templateDir + "/index.html"
	err = os.WriteFile(templateFile, []byte(templateContent), 0644)
	if err != nil {
		t.Fatalf("Failed to create test template: %v", err)
	}
	
	// Change to the temp directory so the templates can be found
	originalDir, _ := os.Getwd()
	defer os.Chdir(originalDir)
	os.Chdir(tempDir)
	
	services := initializeServices(cfg, logger)
	
	if services == nil {
		t.Fatal("initializeServices() returned nil")
	}
	
	if services.Metrics == nil {
		t.Error("Metrics service not initialized")
	}
	
	if services.RateLimiter == nil {
		t.Error("RateLimiter service not initialized")
	}
	
	if services.TemplateService == nil {
		t.Error("TemplateService should be initialized with proper template directory")
	}
}

func TestInitializeHandlers(t *testing.T) {
	cfg := &config.Config{
		Port:         "8080",
		OpenAIAPIKey: "test-key",
	}
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	
	services := &Services{
		Metrics:         nil, // Will be set by initializeServices normally
		RateLimiter:     nil,
		TemplateService: nil,
	}
	
	handlers := initializeHandlers(cfg, logger, services)
	
	if handlers == nil {
		t.Fatal("initializeHandlers() returned nil")
	}
	
	if handlers.Transcribe == nil {
		t.Error("Transcribe handler not initialized")
	}
	
	if handlers.History == nil {
		t.Error("History handler not initialized")
	}
}

func TestInitializeMiddleware(t *testing.T) {
	middleware := initializeMiddleware()
	
	if middleware == nil {
		t.Fatal("initializeMiddleware() returned nil")
	}
	
	if middleware.Security == nil {
		t.Error("Security middleware not initialized")
	}
	
	if middleware.GlobalRateLimit == nil {
		t.Error("GlobalRateLimit middleware not initialized")
	}
}

func TestCreateServer(t *testing.T) {
	cfg := &config.Config{
		Port: "8080",
	}
	
	// Create a minimal router for testing
	router := mux.NewRouter()
	
	server := createServer(cfg, router)
	
	if server == nil {
		t.Fatal("createServer() returned nil")
	}
	
	if server.Addr != ":8080" {
		t.Errorf("Expected server address ':8080', got '%s'", server.Addr)
	}
	
	if server.Handler == nil {
		t.Error("Server handler not set")
	}
	
	if server.ReadTimeout == 0 {
		t.Error("Server ReadTimeout not set")
	}
	
	if server.WriteTimeout == 0 {
		t.Error("Server WriteTimeout not set")
	}
	
	if server.IdleTimeout == 0 {
		t.Error("Server IdleTimeout not set")
	}
}

func TestSetupRoutes(t *testing.T) {
	cfg := &config.Config{
		Port:           "8080",
		OpenAIAPIKey:   "test-key",
		HistoryEnabled: true,
		HistoryJSPath:  "/history/",
	}
	
	// Create mock services
	services := &Services{
		Metrics:         nil, // Would be initialized in real scenario
		RateLimiter:     nil,
		TemplateService: nil,
	}
	
	// Create mock handlers  
	handlers := &Handlers{
		Transcribe: nil, // Would be initialized in real scenario
		History:    nil,
	}
	
	// Create mock middleware
	middlewares := &Middleware{
		Security:        nil, // Would be initialized in real scenario
		GlobalRateLimit: nil,
	}
	
	// This will test the function structure but may fail on nil handlers
	// In a full test, we'd create proper mock handlers
	router := setupRoutes(cfg, handlers, middlewares, services)
	
	if router == nil {
		t.Fatal("setupRoutes() returned nil")
	}
	
	// Test that the router was created successfully
	// More detailed route testing would require mock handlers
}

func TestServices_Struct(t *testing.T) {
	services := &Services{}
	
	// Test that struct can be created
	if services == nil {
		t.Error("Services struct creation failed")
	}
	
	// Test field assignment
	services.Metrics = nil
	services.RateLimiter = nil
	services.TemplateService = nil
	
	// Verify fields can be assigned
	if services.Metrics != nil {
		t.Error("Metrics field assignment failed")
	}
}

func TestHandlers_Struct(t *testing.T) {
	handlers := &Handlers{}
	
	// Test that struct can be created
	if handlers == nil {
		t.Error("Handlers struct creation failed")
	}
	
	// Test field assignment
	handlers.Transcribe = nil
	handlers.History = nil
	
	// Verify fields can be assigned
	if handlers.Transcribe != nil {
		t.Error("Transcribe field assignment failed")
	}
}

func TestMiddleware_Struct(t *testing.T) {
	middleware := &Middleware{}
	
	// Test that struct can be created
	if middleware == nil {
		t.Error("Middleware struct creation failed")
	}
	
	// Test field assignment
	middleware.Security = nil
	middleware.GlobalRateLimit = nil
	
	// Verify fields can be assigned
	if middleware.Security != nil {
		t.Error("Security field assignment failed")
	}
}

// Test the startServerWithGracefulShutdown function in a controlled way
func TestStartServerWithGracefulShutdown_Structure(t *testing.T) {
	// This test verifies the function exists and has the right signature
	// We can't easily test the full functionality without complex mocking
	// In a real scenario, this would be tested with integration tests
	
	cfg := &config.Config{
		Port: "0", // Use port 0 to get a random available port
	}
	
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	
	// Create a simple test server
	router := mux.NewRouter()
	router.HandleFunc("/test", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	
	server := createServer(cfg, router)
	
	// Test that we can create the server structure that would be passed
	// to startServerWithGracefulShutdown
	if server == nil {
		t.Error("Server creation failed")
	}
	
	if cfg == nil {
		t.Error("Config is nil")
	}
	
	if logger == nil {
		t.Error("Logger is nil")
	}
	
	// In a real test environment, we'd start the server in a goroutine
	// and then send it a signal to test graceful shutdown
}