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
	"time"

	"whisper-hub/internal/config"
	"whisper-hub/internal/constants"
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
	metrics := &mockMetricsTracker{}
	
	handler := NewTranscribeHandler(cfg, logger, templateService, metrics)
	
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
	handler := NewTranscribeHandler(cfg, logger, templateService, &mockMetricsTracker{})
	
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
	handler := NewTranscribeHandler(cfg, logger, templateService, &mockMetricsTracker{})
	
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
	handler := NewTranscribeHandler(cfg, logger, templateService, &mockMetricsTracker{})
	
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
	handler := NewTranscribeHandler(cfg, logger, templateService, &mockMetricsTracker{})
	
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
	handler := NewTranscribeHandler(cfg, logger, templateService, &mockMetricsTracker{})
	
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
		{"test.mp3", constants.MaxAudioFileSize + 1, false},
		{"test.mp4", constants.MaxAudioFileSize + 1, true}, // Video files have higher limit
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
	handler := NewTranscribeHandler(cfg, logger, templateService, &mockMetricsTracker{})
	
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
	handler := NewTranscribeHandler(cfg, logger, templateService, &mockMetricsTracker{})
	
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
	handler := NewTranscribeHandler(cfg, logger, templateService, &mockMetricsTracker{})
	
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

func TestTranscribeHandler_HandleCSRFToken(t *testing.T) {
	cfg := &config.Config{OpenAIAPIKey: "test-key"}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	templateService := &mockTemplateService{}
	handler := NewTranscribeHandler(cfg, logger, templateService, &mockMetricsTracker{})
	
	req := httptest.NewRequest("GET", "/csrf-token", nil)
	rr := httptest.NewRecorder()
	
	handler.HandleCSRFToken(rr, req)
	
	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, rr.Code)
	}
	
	body := rr.Body.String()
	if !strings.Contains(body, "csrf_token") {
		t.Error("Expected response to contain csrf_token")
	}
}

func TestTranscribeHandler_getFileType(t *testing.T) {
	cfg := &config.Config{OpenAIAPIKey: "test-key"}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	templateService := &mockTemplateService{}
	handler := NewTranscribeHandler(cfg, logger, templateService, &mockMetricsTracker{})
	
	tests := []struct {
		filename string
		expected string
	}{
		{"test.mp3", "audio"},
		{"test.wav", "audio"},
		{"test.mp4", "video"},
		{"test.avi", "video"},
		{"test.mkv", "video"},
		{"unknown.txt", "audio"}, // defaults to audio
	}
	
	for _, tt := range tests {
		t.Run(tt.filename, func(t *testing.T) {
			result := handler.getFileType(tt.filename)
			if result != tt.expected {
				t.Errorf("getFileType(%q) = %q, want %q", tt.filename, result, tt.expected)
			}
		})
	}
}

func TestTranscribeHandler_calculateDuration(t *testing.T) {
	cfg := &config.Config{OpenAIAPIKey: "test-key"}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	templateService := &mockTemplateService{}
	handler := NewTranscribeHandler(cfg, logger, templateService, &mockMetricsTracker{})
	
	tests := []struct {
		name             string
		processingTime   time.Duration
		transcriptLength int
		expectNil        bool
	}{
		{
			name:             "empty transcript",
			processingTime:   time.Second,
			transcriptLength: 0,
			expectNil:        true,
		},
		{
			name:             "short transcript",
			processingTime:   time.Second,
			transcriptLength: 750, // ~150 words * 5 chars = 1 minute
			expectNil:        false,
		},
		{
			name:             "long transcript",
			processingTime:   time.Minute,
			transcriptLength: 4500, // ~900 words = 6 minutes
			expectNil:        false,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := handler.calculateDuration(tt.processingTime, tt.transcriptLength)
			
			if tt.expectNil {
				if result != nil {
					t.Errorf("Expected nil result, got %v", result)
				}
			} else {
				if result == nil {
					t.Error("Expected non-nil result")
				} else if *result <= 0 {
					t.Errorf("Expected positive duration, got %f", *result)
				}
			}
		})
	}
}

func TestTranscribeHandler_processTranscription_FileHandling(t *testing.T) {
	cfg := &config.Config{
		OpenAIAPIKey:  "test-key",
		UploadMaxSize: 50 * 1024 * 1024,
		TempDir:       os.TempDir(),
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	templateService := &mockTemplateService{}
	handler := NewTranscribeHandler(cfg, logger, templateService, &mockMetricsTracker{})
	
	// Test that processTranscription properly handles file saving
	// We expect this to fail at the transcription step since we don't have OpenAI API key
	// but we can test that the file handling logic executes
	
	// Create test audio file
	tempDir := t.TempDir()
	audioPath := tempDir + "/test.mp3"
	if err := os.WriteFile(audioPath, []byte("fake audio data"), 0644); err != nil {
		t.Fatalf("failed to create temp audio file: %v", err)
	}
	
	// Create mock file header
	header := &multipart.FileHeader{
		Filename: "test.mp3",
		Size:     100,
	}
	
	// Create mock file
	file, err := os.Open(audioPath)
	if err != nil {
		t.Fatalf("failed to open test file: %v", err)
	}
	defer file.Close()
	
	_, _, err = handler.processTranscription(file, header)
	
	// We expect this to fail at the transcription step
	if err == nil {
		t.Error("expected processTranscription to fail without valid API key")
	}
	
	// But the error should not be about file handling
	if strings.Contains(err.Error(), "failed to save") {
		t.Errorf("unexpected file save error: %v", err)
	}
}

func TestTranscribeHandler_processTranscription_VideoFileDetection(t *testing.T) {
	cfg := &config.Config{
		OpenAIAPIKey:  "test-key",
		UploadMaxSize: 50 * 1024 * 1024,
		TempDir:       os.TempDir(),
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	templateService := &mockTemplateService{}
	handler := NewTranscribeHandler(cfg, logger, templateService, &mockMetricsTracker{})
	
	// Test that processTranscription detects video files and tries to convert them
	// This will fail at the conversion step without FFmpeg, but tests the logic path
	
	// Create test video file
	tempDir := t.TempDir()
	videoPath := tempDir + "/test.mp4"
	if err := os.WriteFile(videoPath, []byte("fake video data"), 0644); err != nil {
		t.Fatalf("failed to create temp video file: %v", err)
	}
	
	// Create mock file header for video
	header := &multipart.FileHeader{
		Filename: "test.mp4",
		Size:     1000,
	}
	
	// Create mock file
	file, err := os.Open(videoPath)
	if err != nil {
		t.Fatalf("failed to open test file: %v", err)
	}
	defer file.Close()
	
	_, _, err = handler.processTranscription(file, header)
	
	// We expect this to fail, but test that it attempts video conversion
	if err == nil {
		t.Error("expected processTranscription to fail")
	}
	
	// Should fail at video conversion or transcription, not file saving
	if strings.Contains(err.Error(), "failed to save") {
		t.Errorf("unexpected file save error: %v", err)
	}
}