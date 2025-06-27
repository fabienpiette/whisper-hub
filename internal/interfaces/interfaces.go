package interfaces

import (
	"context"
	"io"
	"mime/multipart"
	"net/http"
)

// Transcriber defines the interface for audio transcription services
type Transcriber interface {
	TranscribeFile(ctx context.Context, filePath string) (string, error)
	TranscribeReader(ctx context.Context, reader io.Reader, filename string) (string, error)
}

// FileManager defines the interface for temporary file management
type FileManager interface {
	SaveUploadedFile(file multipart.File, header *multipart.FileHeader) (string, error)
	Cleanup(filePath string) error
}

// Validator defines the interface for file validation
type Validator interface {
	ValidateFile(header *multipart.FileHeader) error
	ValidateExtension(filename string) error
	GetSupportedExtensions() []string
}

// ResponseWriter defines the interface for HTTP response writing
type ResponseWriter interface {
	WriteError(w http.ResponseWriter, err error)
	WriteLoading(w http.ResponseWriter)
	WriteTranscriptionResult(w http.ResponseWriter, transcription, filename string)
	WriteJSON(w http.ResponseWriter, statusCode int, data interface{})
}

// TemplateService defines the interface for template rendering
type TemplateService interface {
	RenderIndex(w http.ResponseWriter, data interface{}) error
}

// Logger defines the interface for structured logging
type Logger interface {
	Info(msg string, args ...interface{})
	Error(msg string, args ...interface{})
	Warn(msg string, args ...interface{})
}

// MetricsProvider defines the interface for metrics collection
type MetricsProvider interface {
	GetStats() map[string]interface{}
}

// ConfigProvider defines the interface for configuration access
type ConfigProvider interface {
	GetOpenAIAPIKey() string
	GetPort() string
	GetUploadMaxSize() int64
	GetTempDir() string
}