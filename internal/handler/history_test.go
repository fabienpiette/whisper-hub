package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"whisper-hub/internal/config"
)

func TestNewHistoryAssetsHandler(t *testing.T) {
	cfg := &config.Config{HistoryEnabled: true}
	handler := NewHistoryAssetsHandler(cfg)

	if handler == nil {
		t.Error("Expected non-nil handler")
	}
	if handler.config != cfg {
		t.Error("Expected config to be set")
	}
}

func TestHistoryAssetsHandler_HandleHistoryAssets(t *testing.T) {
	tests := []struct {
		name               string
		historyEnabled     bool
		path               string
		expectedStatusCode int
	}{
		{
			name:               "history disabled",
			historyEnabled:     false,
			path:               "/history/app.js",
			expectedStatusCode: http.StatusNotFound,
		},
		{
			name:               "history enabled - invalid path with slash",
			historyEnabled:     true,
			path:               "/history/app.js",
			expectedStatusCode: http.StatusBadRequest, // Path contains slash
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &config.Config{HistoryEnabled: tt.historyEnabled}
			handler := NewHistoryAssetsHandler(cfg)

			req := httptest.NewRequest("GET", tt.path, nil)
			rr := httptest.NewRecorder()

			handler.HandleHistoryAssets(rr, req)

			if rr.Code != tt.expectedStatusCode {
				t.Errorf("Expected status code %d, got %d", tt.expectedStatusCode, rr.Code)
			}
		})
	}
}

func TestHistoryAssetsHandler_HandleHistoryConfig(t *testing.T) {
	tests := []struct {
		name               string
		historyEnabled     bool
		expectedStatusCode int
	}{
		{
			name:               "history disabled",
			historyEnabled:     false,
			expectedStatusCode: http.StatusNotFound,
		},
		{
			name:               "history enabled",
			historyEnabled:     true,
			expectedStatusCode: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &config.Config{
				HistoryEnabled:     tt.historyEnabled,
				HistoryMaxClientMB: 50,
			}
			handler := NewHistoryAssetsHandler(cfg)

			req := httptest.NewRequest("GET", "/history/config", nil)
			rr := httptest.NewRecorder()

			handler.HandleHistoryConfig(rr, req)

			if rr.Code != tt.expectedStatusCode {
				t.Errorf("Expected status code %d, got %d", tt.expectedStatusCode, rr.Code)
			}

			if tt.historyEnabled && rr.Code == http.StatusOK {
				body := rr.Body.String()
				if !strings.Contains(body, "enabled") {
					t.Error("Expected response to contain 'enabled'")
				}
			}
		})
	}
}
