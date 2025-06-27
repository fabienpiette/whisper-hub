package response

import (
	"fmt"
	"html/template"
	"net/http"
	
	"whisper-hub/internal/constants"
	"whisper-hub/internal/errors"
)

// Writer handles HTTP response writing
type Writer struct{}

// NewWriter creates a new response writer
func NewWriter() *Writer {
	return &Writer{}
}

// WriteError writes an error response as HTML
func (w *Writer) WriteError(rw http.ResponseWriter, err error) {
	var message string
	var statusCode int = http.StatusInternalServerError
	
	if appErr, ok := err.(*errors.AppError); ok {
		message = appErr.Message
		statusCode = appErr.Code
	} else {
		message = err.Error()
	}
	
	rw.WriteHeader(statusCode)
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
	rw.Header().Set(constants.HeaderContentType, constants.ContentTypeHTML)
	fmt.Fprintf(rw, `
	<div class="success">
		<h3>✅ Transcription Complete!</h3>
		<p><strong>📄 File:</strong> %s</p>
		<p><strong>📝 Characters:</strong> %d</p>
		
		<div class="transcript" id="transcript">%s</div>
		
		<button class="copy-btn" onclick="copyTranscript()">
			📋 Copy Transcript
		</button>
	</div>`, 
		template.HTMLEscapeString(filename), 
		len(transcription), 
		template.HTMLEscapeString(transcription),
	)
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