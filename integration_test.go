package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"whisper-hub/internal/config"
	"whisper-hub/internal/handler"
	"whisper-hub/internal/middleware"
	"whisper-hub/internal/service"
)

// mockTemplateService implements a mock template service for testing
type mockTemplateService struct{}

func (m *mockTemplateService) RenderIndex(w http.ResponseWriter, data interface{}) error {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(`<html><body><h1>Whisper Hub</h1><script src="https://unpkg.com/htmx.org@1.9.10"></script></body></html>`))
	return nil
}

// mockMetricsTracker implements a mock metrics tracker for testing
type mockMetricsTracker struct{}

func (m *mockMetricsTracker) TrackHistoryFeatureUsage(action string) {
	// Mock implementation - do nothing
}

func TestIntegration_FullWorkflow(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	// Setup
	cfg := &config.Config{
		OpenAIAPIKey:  "test-key", // This will fail but we can test the flow
		Port:          "8080",
		UploadMaxSize: 50 * 1024 * 1024,
		TempDir:       os.TempDir(),
	}

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	// Create a mock template service for testing
	templateService := &mockTemplateService{}
	transcribeHandler := handler.NewTranscribeHandler(cfg, logger, templateService, &mockMetricsTracker{})

	// Setup router like main.go
	r := mux.NewRouter()
	r.Use(middleware.RequestLogger(logger))
	r.Use(middleware.Recovery(logger))

	r.HandleFunc("/", transcribeHandler.HandleIndex).Methods("GET")
	r.HandleFunc("/transcribe", transcribeHandler.HandleTranscribe).Methods("POST")
	r.HandleFunc("/health", transcribeHandler.HandleHealth).Methods("GET")

	server := httptest.NewServer(r)
	defer server.Close()

	t.Run("GET /", func(t *testing.T) {
		resp, err := http.Get(server.URL + "/")
		if err != nil {
			t.Fatalf("failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected status 200, got %d", resp.StatusCode)
		}

		body, _ := io.ReadAll(resp.Body)
		if !strings.Contains(string(body), "Whisper Hub") {
			t.Error("response should contain main page content")
		}
	})

	t.Run("GET /health", func(t *testing.T) {
		resp, err := http.Get(server.URL + "/health")
		if err != nil {
			t.Fatalf("failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected status 200, got %d", resp.StatusCode)
		}

		var health map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&health)
		if err != nil {
			t.Fatalf("failed to decode JSON: %v", err)
		}

		if health["status"] != "healthy" {
			t.Error("health check should return healthy status")
		}
	})

	t.Run("POST /transcribe - no file", func(t *testing.T) {
		// Create empty multipart form
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		writer.Close()

		resp, err := http.Post(server.URL+"/transcribe", writer.FormDataContentType(), body)
		if err != nil {
			t.Fatalf("failed to make request: %v", err)
		}
		defer resp.Body.Close()

		responseBody, _ := io.ReadAll(resp.Body)
		if !strings.Contains(string(responseBody), "No audio file provided") {
			t.Errorf("should return error about missing file, got: %s", string(responseBody))
		}
	})

	t.Run("POST /transcribe - invalid file type", func(t *testing.T) {
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, _ := writer.CreateFormFile("audio", "test.txt")
		part.Write([]byte("not audio content"))
		writer.Close()

		resp, err := http.Post(server.URL+"/transcribe", writer.FormDataContentType(), body)
		if err != nil {
			t.Fatalf("failed to make request: %v", err)
		}
		defer resp.Body.Close()

		responseBody, _ := io.ReadAll(resp.Body)
		if !strings.Contains(string(responseBody), "Invalid file type") {
			t.Error("should return error about invalid file type")
		}
	})

	t.Run("POST /transcribe - valid audio file (will fail API call)", func(t *testing.T) {
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, _ := writer.CreateFormFile("audio", "test.mp3")
		part.Write([]byte("fake audio content"))
		writer.Close()

		resp, err := http.Post(server.URL+"/transcribe", writer.FormDataContentType(), body)
		if err != nil {
			t.Fatalf("failed to make request: %v", err)
		}
		defer resp.Body.Close()

		responseBody, _ := io.ReadAll(resp.Body)
		// This will fail due to invalid API key, but that's expected in test
		if !strings.Contains(string(responseBody), "Transcription failed") {
			t.Error("should return transcription failed error due to invalid API key")
		}
	})
}

func TestIntegration_Middleware(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	cfg := &config.Config{
		OpenAIAPIKey:  "test-key",
		Port:          "8080",
		UploadMaxSize: 50 * 1024 * 1024,
		TempDir:       os.TempDir(),
	}

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	// Create a mock template service for testing
	templateService := &mockTemplateService{}
	transcribeHandler := handler.NewTranscribeHandler(cfg, logger, templateService, &mockMetricsTracker{})

	// Setup router with middleware
	r := mux.NewRouter()

	// Test request logging middleware
	r.Use(middleware.RequestLogger(logger))
	r.Use(middleware.Recovery(logger))

	r.HandleFunc("/", transcribeHandler.HandleIndex).Methods("GET")
	r.HandleFunc("/panic", func(w http.ResponseWriter, r *http.Request) {
		panic("test panic")
	}).Methods("GET")

	server := httptest.NewServer(r)
	defer server.Close()

	t.Run("middleware - normal request", func(t *testing.T) {
		resp, err := http.Get(server.URL + "/")
		if err != nil {
			t.Fatalf("failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected status 200, got %d", resp.StatusCode)
		}
	})

	t.Run("middleware - panic recovery", func(t *testing.T) {
		resp, err := http.Get(server.URL + "/panic")
		if err != nil {
			t.Fatalf("failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusInternalServerError {
			t.Errorf("expected status 500 for panic, got %d", resp.StatusCode)
		}
	})
}

func TestIntegration_RateLimit(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	cfg := &config.Config{
		OpenAIAPIKey:  "test-key",
		Port:          "8080",
		UploadMaxSize: 50 * 1024 * 1024,
		TempDir:       os.TempDir(),
	}

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	// Create a mock template service for testing
	templateService := &mockTemplateService{}
	transcribeHandler := handler.NewTranscribeHandler(cfg, logger, templateService, &mockMetricsTracker{})

	// Setup router with rate limiting
	r := mux.NewRouter()
	limiter := middleware.NewRateLimiter(2, time.Minute)
	r.Use(limiter.RateLimit())
	r.HandleFunc("/", transcribeHandler.HandleIndex).Methods("GET")

	server := httptest.NewServer(r)
	defer server.Close()

	t.Run("rate limiting", func(t *testing.T) {
		// Create HTTP client to maintain session
		client := &http.Client{}

		// First request should succeed
		req1, _ := http.NewRequest("GET", server.URL+"/", nil)
		req1.Header.Set("X-Forwarded-For", "192.168.1.1") // Simulate same IP
		resp1, err := client.Do(req1)
		if err != nil {
			t.Fatalf("failed to make first request: %v", err)
		}
		resp1.Body.Close()

		if resp1.StatusCode != http.StatusOK {
			t.Errorf("first request should succeed, got %d", resp1.StatusCode)
		}

		// Second request should succeed
		req2, _ := http.NewRequest("GET", server.URL+"/", nil)
		req2.Header.Set("X-Forwarded-For", "192.168.1.1") // Same IP
		resp2, err := client.Do(req2)
		if err != nil {
			t.Fatalf("failed to make second request: %v", err)
		}
		resp2.Body.Close()

		if resp2.StatusCode != http.StatusOK {
			t.Errorf("second request should succeed, got %d", resp2.StatusCode)
		}

		// Third request should be rate limited
		req3, _ := http.NewRequest("GET", server.URL+"/", nil)
		req3.Header.Set("X-Forwarded-For", "192.168.1.1") // Same IP
		resp3, err := client.Do(req3)
		if err != nil {
			t.Fatalf("failed to make third request: %v", err)
		}
		resp3.Body.Close()

		if resp3.StatusCode != http.StatusTooManyRequests {
			t.Errorf("third request should be rate limited, got %d", resp3.StatusCode)
		}
	})
}

func TestIntegration_ContextTimeout(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	// Test that context timeout works properly
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()

	// This should timeout quickly
	// Note: We need to test with a service directly since handler fields are unexported
	transcribeService := service.NewTranscriber("test-key")
	_, err := transcribeService.TranscribeReader(ctx, strings.NewReader("test"), "test.mp3")
	if err == nil {
		t.Error("expected timeout error")
	}

	// Check if it's a context timeout (accepts both old and new error messages)
	errMsg := err.Error()
	if !strings.Contains(errMsg, "context") && !strings.Contains(errMsg, "timeout") && !strings.Contains(errMsg, "timed out") {
		t.Errorf("expected context/timeout error, got: %v", err)
	}
}
