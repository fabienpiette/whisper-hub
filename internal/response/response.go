package response

import (
	"fmt"
	"html/template"
	"net/http"
	"strings"
	"time"

	"whisper-hub/internal/constants"
	"whisper-hub/internal/errors"
)

// HistoryMetadata contains metadata for client-side history storage
type HistoryMetadata struct {
	ID        string    `json:"id"`        // Client-generated UUID
	Timestamp time.Time `json:"timestamp"` // Server timestamp
	FileType  string    `json:"file_type"` // audio/video
	FileSize  int64     `json:"file_size"` // bytes
	Duration  *float64  `json:"duration"`  // seconds (if available)
}

// TranscriptData represents data for the result template
type TranscriptData struct {
	Transcript              string
	Filename                string
	FileType                string
	FileSize                int64
	Duration                *float64
	ProcessingTime          *time.Duration
	CharacterCount          int
	WordCount               int
	EstimatedReadingTime    string
	FileSizeFormatted       string
	DurationFormatted       string
	ProcessingTimeFormatted string
	IncognitoMode           bool
}

// Writer handles HTTP response writing
type Writer struct{}

// NewWriter creates a new response writer
func NewWriter() *Writer {
	return &Writer{}
}

// WriteError writes an error response as HTML
func (w *Writer) WriteError(rw http.ResponseWriter, err error) {
	var message string

	if appErr, ok := err.(*errors.AppError); ok {
		message = appErr.Message
	} else {
		message = err.Error()
	}

	// Return 200 OK so HTMX processes the response and shows the error to the user
	rw.WriteHeader(http.StatusOK)
	fmt.Fprintf(rw, `<div class="error">❌ Error: %s</div>`, template.HTMLEscapeString(message))
}

// WriteLoading writes a loading response
func (w *Writer) WriteLoading(rw http.ResponseWriter) {
	rw.Header().Set(constants.HeaderContentType, constants.ContentTypeHTML)
	fmt.Fprint(rw, `
	<div class="loading">
		<div class="spinner"></div>
		<h3>🎵 Transcribing your audio...</h3>
		<p>This may take a moment depending on file size</p>
	</div>`)

	if f, ok := rw.(http.Flusher); ok {
		f.Flush()
	}
}

// WriteTranscriptionResult writes a successful transcription result
func (w *Writer) WriteTranscriptionResult(rw http.ResponseWriter, transcription, filename string) {
	w.WriteTranscriptionResultWithMetadata(rw, transcription, filename, nil)
}

// WriteTranscriptionResultWithMetadata writes a successful transcription result with history metadata
func (w *Writer) WriteTranscriptionResultWithMetadata(rw http.ResponseWriter, transcription, filename string, metadata *HistoryMetadata) {
	rw.Header().Set(constants.HeaderContentType, constants.ContentTypeHTML)

	// Create transcript data with all necessary information
	data := &TranscriptData{
		Transcript:     transcription,
		Filename:       filename,
		CharacterCount: len(transcription),
		WordCount:      w.countWords(transcription),
		IncognitoMode:  false, // TODO: Get from request context
	}

	if metadata != nil {
		data.FileType = metadata.FileType
		data.FileSize = metadata.FileSize
		data.Duration = metadata.Duration
	}

	// Format helper data
	data.FileSizeFormatted = w.formatFileSize(data.FileSize)
	if data.Duration != nil {
		data.DurationFormatted = w.formatDuration(*data.Duration)
	}
	data.EstimatedReadingTime = w.estimateReadingTime(data.WordCount)

	// Simple template rendering (we could enhance this with proper template engine)
	w.renderResultTemplate(rw, data, metadata)
}

// renderResultTemplate renders the result template with data
func (w *Writer) renderResultTemplate(rw http.ResponseWriter, data *TranscriptData, metadata *HistoryMetadata) {
	// Include history metadata as JSON in data attribute for client-side processing
	metadataJSON := ""
	if metadata != nil {
		metadataJSON = fmt.Sprintf(`{"id":"%s","timestamp":"%s","file_type":"%s","file_size":%d}`,
			template.JSEscapeString(metadata.ID),
			metadata.Timestamp.Format(time.RFC3339),
			template.JSEscapeString(metadata.FileType),
			metadata.FileSize,
		)
	}

	// Enhanced result template
	fmt.Fprintf(rw, `
	<div class="result-card" 
		 data-transcript="%s"
		 data-filename="%s"
		 data-file-type="%s"
		 data-file-size="%d"
		 data-character-count="%d"
		 data-history-metadata="%s">
		
		<!-- Result Header -->
		<div class="result-header">
			<div class="result-status">
				<div class="status-icon">✅</div>
				<h3 class="result-title">Transcription Complete</h3>
			</div>
			<div class="result-actions">
				<button class="action-btn copy-btn" onclick="whisperApp.copyResult(this)" title="Copy Transcript">
					<span class="btn-icon">📋</span>
					<span class="btn-text">Copy</span>
				</button>
				<button class="action-btn download-btn" onclick="whisperApp.downloadResult(this)" title="Download Transcript">
					<span class="btn-icon">💾</span>
					<span class="btn-text">Download</span>
				</button>
			</div>
		</div>

		<!-- File Information -->
		<div class="file-info-card">
			<div class="file-details">
				<div class="file-primary">
					<div class="file-icon">%s</div>
					<div class="file-name">%s</div>
				</div>
				<div class="file-metadata">
					<div class="meta-item">
						<span class="meta-label">Type:</span>
						<span class="meta-value">%s</span>
					</div>
					<div class="meta-item">
						<span class="meta-label">Size:</span>
						<span class="meta-value">%s</span>
					</div>
					<div class="meta-item">
						<span class="meta-label">Characters:</span>
						<span class="meta-value">%d</span>
					</div>
					<div class="meta-item">
						<span class="meta-label">Words:</span>
						<span class="meta-value">%d</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Transcript Content -->
		<div class="transcript-container">
			<div class="transcript-header">
				<h4 class="transcript-title">Transcript</h4>
				<div class="transcript-tools">
					<button class="tool-btn" onclick="whisperApp.selectAllText()" title="Select All">📝</button>
				</div>
			</div>
			
			<div class="transcript-content" id="transcript-text">%s</div>
			
			<div class="transcript-footer">
				<div class="word-stats">
					<span class="stat">%d words</span>
					<span class="stat">%d characters</span>
					<span class="stat">~%s reading</span>
				</div>
			</div>
		</div>

		<!-- Quick Actions -->
		<div class="quick-actions">
			<button class="action-btn secondary" onclick="whisperApp.startNewTranscription()">
				<span class="btn-icon">🎵</span>
				<span class="btn-text">Transcribe Another File</span>
			</button>
			<button class="action-btn secondary" onclick="whisperApp.viewHistory()">
				<span class="btn-icon">📚</span>
				<span class="btn-text">View History</span>
			</button>
		</div>
	</div>`,
		template.HTMLEscapeString(data.Transcript),
		template.HTMLEscapeString(data.Filename),
		template.HTMLEscapeString(data.FileType),
		data.FileSize,
		data.CharacterCount,
		template.HTMLEscapeString(metadataJSON),
		w.getFileIcon(data.FileType),
		template.HTMLEscapeString(data.Filename),
		strings.Title(data.FileType),
		data.FileSizeFormatted,
		data.CharacterCount,
		data.WordCount,
		template.HTMLEscapeString(data.Transcript),
		data.WordCount,
		data.CharacterCount,
		data.EstimatedReadingTime,
	)
}

// Helper functions
func (w *Writer) countWords(text string) int {
	words := strings.Fields(text)
	return len(words)
}

func (w *Writer) formatFileSize(bytes int64) string {
	if bytes == 0 {
		return "0 B"
	}

	units := []string{"B", "KB", "MB", "GB"}
	size := float64(bytes)
	unitIndex := 0

	for size >= 1024 && unitIndex < len(units)-1 {
		size /= 1024
		unitIndex++
	}

	return fmt.Sprintf("%.1f %s", size, units[unitIndex])
}

func (w *Writer) formatDuration(seconds float64) string {
	if seconds < 60 {
		return fmt.Sprintf("%.0fs", seconds)
	} else if seconds < 3600 {
		return fmt.Sprintf("%.1fm", seconds/60)
	} else {
		hours := int(seconds / 3600)
		minutes := int((seconds - float64(hours*3600)) / 60)
		return fmt.Sprintf("%dh %dm", hours, minutes)
	}
}

func (w *Writer) estimateReadingTime(wordCount int) string {
	// Average reading speed is about 200-250 words per minute
	// We'll use 225 as a middle ground
	minutes := float64(wordCount) / 225.0
	if minutes < 1 {
		return "< 1 min"
	} else if minutes < 60 {
		return fmt.Sprintf("%.0f min", minutes)
	} else {
		hours := int(minutes / 60)
		mins := int(minutes) % 60
		return fmt.Sprintf("%dh %dm", hours, mins)
	}
}

func (w *Writer) getFileIcon(fileType string) string {
	if fileType == "video" {
		return "🎬"
	}
	return "🎵"
}

// WriteJSON writes a JSON response
func (w *Writer) WriteJSON(rw http.ResponseWriter, statusCode int, data interface{}) {
	rw.Header().Set(constants.HeaderContentType, constants.ContentTypeJSON)
	rw.WriteHeader(statusCode)

	// For simple cases, we'll handle basic types directly
	switch v := data.(type) {
	case map[string]interface{}:
		// Write JSON manually for health/metrics responses
		fmt.Fprint(rw, "{")
		first := true
		for key, value := range v {
			if !first {
				fmt.Fprint(rw, ",")
			}
			fmt.Fprintf(rw, `"%s":`, key)
			switch val := value.(type) {
			case string:
				fmt.Fprintf(rw, `"%s"`, val)
			case int, int64, float64:
				fmt.Fprintf(rw, `%v`, val)
			default:
				fmt.Fprintf(rw, `"%v"`, val)
			}
			first = false
		}
		fmt.Fprint(rw, "}")
	default:
		fmt.Fprintf(rw, `{"error": "unsupported response type"}`)
	}
}
