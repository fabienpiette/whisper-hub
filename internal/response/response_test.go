package response

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	appErrors "whisper-hub/internal/errors"
)

func TestNewWriter(t *testing.T) {
	writer := NewWriter()
	if writer == nil {
		t.Error("NewWriter should return a non-nil Writer")
	}
}

func TestWriter_WriteError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected string
	}{
		{
			name:     "application error",
			err:      appErrors.NewBadRequestError("Invalid input", nil),
			expected: "Invalid input",
		},
		{
			name:     "standard error",
			err:      errors.New("standard error"),
			expected: "standard error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			writer := NewWriter()
			rw := httptest.NewRecorder()

			writer.WriteError(rw, tt.err)

			if rw.Code != http.StatusOK {
				t.Errorf("Expected status %d, got %d", http.StatusOK, rw.Code)
			}

			body := rw.Body.String()
			if !strings.Contains(body, tt.expected) {
				t.Errorf("Expected body to contain %q, got %q", tt.expected, body)
			}

			if !strings.Contains(body, "error") {
				t.Error("Expected body to contain 'error' class")
			}
		})
	}
}

func TestWriter_WriteLoading(t *testing.T) {
	writer := NewWriter()
	rw := httptest.NewRecorder()

	writer.WriteLoading(rw)

	body := rw.Body.String()

	if !strings.Contains(body, "loading") {
		t.Error("Expected body to contain 'loading' class")
	}
	if !strings.Contains(body, "Transcribing") {
		t.Error("Expected body to contain transcription message")
	}
	if !strings.Contains(body, "spinner") {
		t.Error("Expected body to contain spinner")
	}
}

func TestWriter_WriteTranscriptionResult(t *testing.T) {
	writer := NewWriter()
	rw := httptest.NewRecorder()

	transcription := "Hello world test transcription"
	filename := "test.mp3"

	writer.WriteTranscriptionResult(rw, transcription, filename)

	body := rw.Body.String()

	if !strings.Contains(body, transcription) {
		t.Errorf("Expected body to contain transcription %q", transcription)
	}
	if !strings.Contains(body, filename) {
		t.Errorf("Expected body to contain filename %q", filename)
	}
	if !strings.Contains(body, "result-card") {
		t.Error("Expected body to contain result-card class")
	}
}

func TestWriter_WriteTranscriptionResultWithMetadata(t *testing.T) {
	writer := NewWriter()
	rw := httptest.NewRecorder()

	transcription := "Test transcription with metadata"
	filename := "test-audio.wav"
	duration := 45.5
	metadata := &HistoryMetadata{
		ID:        "test-id-123",
		Timestamp: time.Now(),
		FileType:  "audio",
		FileSize:  1024000,
		Duration:  &duration,
	}

	writer.WriteTranscriptionResultWithMetadata(rw, transcription, filename, metadata)

	body := rw.Body.String()

	if !strings.Contains(body, transcription) {
		t.Errorf("Expected body to contain transcription %q", transcription)
	}
	if !strings.Contains(body, filename) {
		t.Errorf("Expected body to contain filename %q", filename)
	}
	if !strings.Contains(body, "test-id-123") {
		t.Error("Expected body to contain metadata ID")
	}
	if !strings.Contains(body, "audio") {
		t.Error("Expected body to contain file type")
	}
}

func TestWriter_countWords(t *testing.T) {
	writer := NewWriter()

	tests := []struct {
		text     string
		expected int
	}{
		{"", 0},
		{"hello", 1},
		{"hello world", 2},
		{"  hello   world  ", 2},
		{"one two three four five", 5},
	}

	for _, tt := range tests {
		result := writer.countWords(tt.text)
		if result != tt.expected {
			t.Errorf("countWords(%q) = %d, want %d", tt.text, result, tt.expected)
		}
	}
}

func TestWriter_formatFileSize(t *testing.T) {
	writer := NewWriter()

	tests := []struct {
		bytes    int64
		expected string
	}{
		{0, "0 B"},
		{100, "100.0 B"},
		{1024, "1.0 KB"},
		{1536, "1.5 KB"},
		{1048576, "1.0 MB"},
		{1073741824, "1.0 GB"},
	}

	for _, tt := range tests {
		result := writer.formatFileSize(tt.bytes)
		if result != tt.expected {
			t.Errorf("formatFileSize(%d) = %q, want %q", tt.bytes, result, tt.expected)
		}
	}
}

func TestWriter_formatDuration(t *testing.T) {
	writer := NewWriter()

	tests := []struct {
		seconds  float64
		expected string
	}{
		{30, "30s"},
		{90, "1.5m"},
		{3600, "1h 0m"},
		{3750, "1h 2m"},
	}

	for _, tt := range tests {
		result := writer.formatDuration(tt.seconds)
		if result != tt.expected {
			t.Errorf("formatDuration(%f) = %q, want %q", tt.seconds, result, tt.expected)
		}
	}
}

func TestWriter_estimateReadingTime(t *testing.T) {
	writer := NewWriter()

	tests := []struct {
		wordCount int
		expected  string
	}{
		{50, "< 1 min"},
		{225, "1 min"},
		{450, "2 min"},
		{13500, "1h 0m"}, // 60 minutes worth
	}

	for _, tt := range tests {
		result := writer.estimateReadingTime(tt.wordCount)
		if result != tt.expected {
			t.Errorf("estimateReadingTime(%d) = %q, want %q", tt.wordCount, result, tt.expected)
		}
	}
}

func TestWriter_getFileIcon(t *testing.T) {
	writer := NewWriter()

	tests := []struct {
		fileType string
		expected string
	}{
		{"audio", "🎵"},
		{"video", "🎬"},
		{"unknown", "🎵"},
	}

	for _, tt := range tests {
		result := writer.getFileIcon(tt.fileType)
		if result != tt.expected {
			t.Errorf("getFileIcon(%q) = %q, want %q", tt.fileType, result, tt.expected)
		}
	}
}

func TestWriter_WriteJSON(t *testing.T) {
	writer := NewWriter()

	tests := []struct {
		name       string
		statusCode int
		data       interface{}
		expected   string
	}{
		{
			name:       "simple map",
			statusCode: http.StatusOK,
			data:       map[string]interface{}{"status": "ok", "count": 5},
			expected:   `"status":"ok"`,
		},
		{
			name:       "unsupported type",
			statusCode: http.StatusBadRequest,
			data:       "unsupported",
			expected:   `{"error": "unsupported response type"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rw := httptest.NewRecorder()

			writer.WriteJSON(rw, tt.statusCode, tt.data)

			if rw.Code != tt.statusCode {
				t.Errorf("Expected status %d, got %d", tt.statusCode, rw.Code)
			}

			body := rw.Body.String()
			if !strings.Contains(body, tt.expected) {
				t.Errorf("Expected body to contain %q, got %q", tt.expected, body)
			}
		})
	}
}

func TestWriter_WriteTranscriptionResultWithAction(t *testing.T) {
	writer := NewWriter()
	rw := httptest.NewRecorder()

	transcript := "Test transcript"
	filename := "test.mp3"
	metadata := &HistoryMetadata{
		ID:        "test-id",
		Timestamp: time.Now(),
		FileType:  "audio",
		FileSize:  1024,
	}
	actionResult := "Action result"

	writer.WriteTranscriptionResultWithAction(rw, transcript, filename, metadata, actionResult)

	if rw.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, rw.Code)
	}

	body := rw.Body.String()
	if !strings.Contains(body, transcript) {
		t.Error("Response should contain transcript")
	}
	if !strings.Contains(body, filename) {
		t.Error("Response should contain filename")
	}
}

func TestWriter_renderActionResult(t *testing.T) {
	writer := NewWriter()
	
	actionResult := "Test action result"
	result := writer.renderActionResult(actionResult)

	if !strings.Contains(result, actionResult) {
		t.Error("Result should contain action result")
	}
	if !strings.Contains(result, "action-result") {
		t.Error("Result should contain action-result class")
	}
}
