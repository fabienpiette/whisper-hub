package handler

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"

	"whisper-hub/internal/config"
	"whisper-hub/internal/constants"
)

// HistoryAssetsHandler serves history-related static assets
type HistoryAssetsHandler struct {
	config *config.Config
}

// NewHistoryAssetsHandler creates a new history assets handler
func NewHistoryAssetsHandler(cfg *config.Config) *HistoryAssetsHandler {
	return &HistoryAssetsHandler{
		config: cfg,
	}
}

// HandleHistoryAssets serves history JavaScript modules and CSS
func (h *HistoryAssetsHandler) HandleHistoryAssets(w http.ResponseWriter, r *http.Request) {
	if !h.config.HistoryEnabled {
		http.Error(w, "History feature disabled", http.StatusNotFound)
		return
	}

	// Extract the requested file path
	requestPath := strings.TrimPrefix(r.URL.Path, h.config.HistoryJSPath)
	
	// Security check: prevent directory traversal
	if strings.Contains(requestPath, "..") || strings.Contains(requestPath, "/") {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	// Determine content type based on file extension
	ext := filepath.Ext(requestPath)
	var contentType string
	switch ext {
	case ".js":
		contentType = "application/javascript"
	case ".css":
		contentType = "text/css"
	case ".json":
		contentType = constants.ContentTypeJSON
	default:
		http.Error(w, "Unsupported file type", http.StatusBadRequest)
		return
	}

	// Serve the file
	w.Header().Set(constants.HeaderContentType, contentType)
	http.ServeFile(w, r, filepath.Join("web/static/js/history", requestPath))
}

// HandleHistoryConfig serves history configuration for client-side
func (h *HistoryAssetsHandler) HandleHistoryConfig(w http.ResponseWriter, r *http.Request) {
	if !h.config.HistoryEnabled {
		http.Error(w, "History feature disabled", http.StatusNotFound)
		return
	}

	w.Header().Set(constants.HeaderContentType, constants.ContentTypeJSON)
	
	// Return client-side configuration (no sensitive data)
	configJSON := fmt.Sprintf(`{
		"enabled": true,
		"maxClientMB": %d,
		"version": "%s"
	}`, h.config.HistoryMaxClientMB, constants.ServiceVersion)
	
	w.Write([]byte(configJSON))
}