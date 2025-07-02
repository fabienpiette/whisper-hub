package constants

import "time"

// File size limits
const (
	DefaultUploadMaxSize = 2 * 1024 * 1024 * 1024 // 2GB in bytes (supports video files)
	MaxAudioFileSize     = 100 * 1024 * 1024      // 100MB
	MaxVideoFileSize     = 2 * 1024 * 1024 * 1024 // 2GB
	MegabytesToBytes     = 1024 * 1024
)

// Server timeouts
const (
	ServerReadTimeout     = 15 * time.Second
	ServerWriteTimeout    = 600 * time.Second // Long timeout for transcription
	ServerIdleTimeout     = 60 * time.Second
	ServerShutdownTimeout = 30 * time.Second
	TranscriptionTimeout  = 5 * time.Minute
)

// Rate limiting
const (
	DefaultRateLimit       = 100
	DefaultRateWindow      = time.Minute
	RateLimitCleanupPeriod = time.Minute
)

// Supported audio file extensions
var SupportedAudioExtensions = []string{
	".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac",
}

// Supported video file extensions
var SupportedVideoExtensions = []string{
	".mp4", ".avi", ".mov", ".mkv", ".webm", ".flv", ".wmv", ".m4v",
}

// HTTP headers
const (
	HeaderRequestID      = "X-Request-ID"
	HeaderForwardedFor   = "X-Forwarded-For"
	HeaderRealIP         = "X-Real-IP"
	HeaderContentType    = "Content-Type"
	ContentTypeJSON      = "application/json"
	ContentTypeHTML      = "text/html"
	ContentTypeMultipart = "multipart/form-data"
)

// Error messages
const (
	ErrNoAudioFile           = "No audio file provided"
	ErrInvalidFileType       = "Invalid file type. Please upload an audio or video file."
	ErrFileTooLarge          = "File too large or invalid form data"
	ErrTranscribeFailed      = "Transcription failed. Please try again."
	ErrSaveFileFailed        = "Failed to save uploaded file"
	ErrInternalServer        = "Internal Server Error"
	ErrRateLimitExceeded     = "Rate limit exceeded"
	ErrMethodNotAllowed      = "Method not allowed"
	ErrMetricsUnavailable    = "metrics unavailable"
	ErrVideoConversionFailed = "Video conversion failed. Please try again."
)

// Service info
const (
	ServiceName    = "whisper-hub"
	ServiceVersion = "1.0.0"
	HealthyStatus  = "healthy"
)

// Form field names
const (
	FormFieldAudio = "audio"
	FormFieldFile  = "file" // Generic field for audio/video files
)
