package handler

import (
	"bytes"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"whisper-hub/internal/config"
)

// mockTemplateService implements a mock template service for testing
type mockTemplateService struct{}

func (m *mockTemplateService) RenderIndex(w http.ResponseWriter, data interface{}) error {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(`<html><body><h1>Whisper Hub</h1><script src="https://unpkg.com/htmx.org@1.9.10"></script></body></html>`))
	return nil
}

func TestNewTranscribeHandler(t *testing.T) {
	cfg := &config.Config{
		OpenAIAPIKey:  "test-key",
		Port:          "8080",
		UploadMaxSize: 50 * 1024 * 1024,
		TempDir:       os.TempDir(),
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	
	// Create a mock template service for testing
	templateService := &mockTemplateService{}
	
	handler := NewTranscribeHandler(cfg, logger, templateService)
	
	if handler == nil {
		t.Error("NewTranscribeHandler returned nil")
	}
	if handler.transcriber == nil {
		t.Error("transcriber not initialized")
	}
	if handler.tempManager == nil {
		t.Error("tempManager not initialized")
	}
	if handler.config != cfg {
		t.Error("config not set correctly")
	}
	if handler.logger != logger {
		t.Error("logger not set correctly")
	}
}

func TestTranscribeHandler_HandleIndex(t *testing.T) {
	cfg := &config.Config{OpenAIAPIKey: "test-key"}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	templateService := &mockTemplateService{}
	handler := NewTranscribeHandler(cfg, logger, templateService)
	
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	
	handler.HandleIndex(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
	
	body := w.Body.String()
	if !strings.Contains(body, "Whisper Hub") {
		t.Error("response should contain 'Whisper Hub'")
	}
	if !strings.Contains(body, "htmx") {
		t.Error("response should include HTMX")
	}
}

func TestTranscribeHandler_HandleTranscribe_MethodNotAllowed(t *testing.T) {
	cfg := &config.Config{OpenAIAPIKey: "test-key"}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	templateService := &mockTemplateService{}
	handler := NewTranscribeHandler(cfg, logger, templateService)
	
	req := httptest.NewRequest(http.MethodGet, "/transcribe", nil)
	w := httptest.NewRecorder()
	
	handler.HandleTranscribe(w, req)
	
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected status 405, got %d", w.Code)
	}
}

func TestTranscribeHandler_HandleTranscribe_NoFile(t *testing.T) {
	cfg := &config.Config{
		OpenAIAPIKey:  "test-key",
		UploadMaxSize: 50 * 1024 * 1024,
		TempDir:       os.TempDir(),
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	templateService := &mockTemplateService{}
	handler := NewTranscribeHandler(cfg, logger, templateService)
	
	// Create empty multipart form
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	writer.Close()
	
	req := httptest.NewRequest(http.MethodPost, "/transcribe", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	w := httptest.NewRecorder()
	
	handler.HandleTranscribe(w, req)
	
	responseBody := w.Body.String()
	if !strings.Contains(responseBody, "No audio file provided") {
		t.Errorf("should return error about missing file, got: %s", responseBody)
	}
}

func TestTranscribeHandler_HandleTranscribe_InvalidFileType(t *testing.T) {
	cfg := &config.Config{
		OpenAIAPIKey:  "test-key",
		UploadMaxSize: 50 * 1024 * 1024,
		TempDir:       os.TempDir(),
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	templateService := &mockTemplateService{}
	handler := NewTranscribeHandler(cfg, logger, templateService)
	
	// Create multipart form with invalid file
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, _ := writer.CreateFormFile("audio", "test.txt")
	part.Write([]byte("not audio content"))
	writer.Close()
	
	req := httptest.NewRequest(http.MethodPost, "/transcribe", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	w := httptest.NewRecorder()
	
	handler.HandleTranscribe(w, req)
	
	response := w.Body.String()
	if !strings.Contains(response, "Invalid file type") {
		t.Error("should return error about invalid file type")
	}
}

func TestTranscribeHandler_ValidateFile(t *testing.T) {
	cfg := &config.Config{
		OpenAIAPIKey:  "test-key",
		UploadMaxSize: 50 * 1024 * 1024,
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	templateService := &mockTemplateService{}
	handler := NewTranscribeHandler(cfg, logger, templateService)
	
	tests := []struct {
		filename string
		size     int64
		valid    bool
	}{
		// Audio files
		{"test.mp3", 1000, true},
		{"test.MP3", 1000, true},
		{"test.wav", 1000, true},
		{"test.WAV", 1000, true},
		{"test.m4a", 1000, true},
		{"test.ogg", 1000, true},
		{"test.flac", 1000, true},
		{"test.aac", 1000, true},
		// Video files
		{"test.mp4", 1000, true},
		{"test.avi", 1000, true},
		{"test.mov", 1000, true},
		{"test.mkv", 1000, true},
		{"test.webm", 1000, true},
		// Invalid files
		{"test.txt", 1000, false},
		{"test.jpg", 1000, false},
		{"test.pdf", 1000, false},
		{"test", 1000, false},
		{"", 1000, false},
		{"audio.mp3.txt", 1000, false},
		// Size validation
		{"test.mp3", 0, false},
		{"test.mp3", cfg.UploadMaxSize + 1, false},
	}
	
	for _, tt := range tests {
		t.Run(tt.filename, func(t *testing.T) {
			header := &multipart.FileHeader{
				Filename: tt.filename,
				Size:     tt.size,
			}
			err := handler.validator.ValidateFile(header)
			isValid := err == nil
			if isValid != tt.valid {
				t.Errorf("ValidateFile(%q, %d) valid = %v, want %v", tt.filename, tt.size, isValid, tt.valid)
			}
		})
	}
}

func TestTranscribeHandler_HandleHealth(t *testing.T) {
	cfg := &config.Config{OpenAIAPIKey: "test-key"}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	templateService := &mockTemplateService{}
	handler := NewTranscribeHandler(cfg, logger, templateService)
	
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	
	handler.HandleHealth(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
	
	contentType := w.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("expected Content-Type application/json, got %s", contentType)
	}
	
	body := w.Body.String()
	if !strings.Contains(body, "healthy") {
		t.Error("health response should contain 'healthy'")
	}
	if !strings.Contains(body, "whisper-hub") {
		t.Error("health response should contain service name")
	}
}

func TestTranscribeHandler_HandleMetrics(t *testing.T) {
	cfg := &config.Config{OpenAIAPIKey: "test-key"}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	templateService := &mockTemplateService{}
	handler := NewTranscribeHandler(cfg, logger, templateService)
	
	// Test with nil metrics (no stats interface)
	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	w := httptest.NewRecorder()
	
	metricsHandler := handler.HandleMetrics(nil)
	metricsHandler(w, req)
	
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected status 500 for nil metrics, got %d", w.Code)
	}
	
	body := w.Body.String()
	if !strings.Contains(body, "metrics unavailable") {
		t.Error("should return metrics unavailable error")
	}
}

type mockMetrics struct {
	stats map[string]interface{}
}

func (m *mockMetrics) GetStats() map[string]interface{} {
	return m.stats
}

func TestTranscribeHandler_HandleMetrics_WithStats(t *testing.T) {
	cfg := &config.Config{OpenAIAPIKey: "test-key"}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	templateService := &mockTemplateService{}
	handler := NewTranscribeHandler(cfg, logger, templateService)
	
	mockStats := &mockMetrics{
		stats: map[string]interface{}{
			"requests": 42,
			"errors":   1,
		},
	}
	
	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	w := httptest.NewRecorder()
	
	metricsHandler := handler.HandleMetrics(mockStats)
	metricsHandler(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
	
	contentType := w.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("expected Content-Type application/json, got %s", contentType)
	}
	
	body := w.Body.String()
	if !strings.Contains(body, "requests") {
		t.Error("metrics response should contain request stats")
	}
	if !strings.Contains(body, "timestamp") {
		t.Error("metrics response should contain timestamp")
	}
}