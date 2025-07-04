package config

import (
	"os"
	"strconv"

	"whisper-hub/internal/constants"
)

type Config struct {
	OpenAIAPIKey  string
	Port          string
	UploadMaxSize int64
	TempDir       string
	// History feature configuration
	HistoryEnabled     bool
	HistoryJSPath      string
	HistoryMaxClientMB int
	// Post-action configuration
	PostActionsEnabled    bool
	PostActionTimeout     int
	PostActionMaxRetries  int
	PostActionDefaultModel string
}

func Load() *Config {
	maxSize, _ := strconv.ParseInt(getEnv("UPLOAD_MAX_SIZE", strconv.FormatInt(constants.DefaultUploadMaxSize, 10)), 10, 64)
	historyEnabled, _ := strconv.ParseBool(getEnv("HISTORY_ENABLED", "true"))
	historyMaxClientMB, _ := strconv.Atoi(getEnv("HISTORY_MAX_CLIENT_MB", "50"))
	
	// Post-action configuration
	postActionsEnabled, _ := strconv.ParseBool(getEnv("POST_ACTIONS_ENABLED", "true"))
	postActionTimeout, _ := strconv.Atoi(getEnv("POST_ACTION_TIMEOUT", "60"))
	postActionMaxRetries, _ := strconv.Atoi(getEnv("POST_ACTION_MAX_RETRIES", "3"))

	return &Config{
		OpenAIAPIKey:          getEnv("OPENAI_API_KEY", ""),
		Port:                  getEnv("PORT", "8080"),
		UploadMaxSize:         maxSize,
		TempDir:               getEnv("TEMP_DIR", os.TempDir()),
		HistoryEnabled:        historyEnabled,
		HistoryJSPath:         getEnv("HISTORY_JS_PATH", "/static/js/history/"),
		HistoryMaxClientMB:    historyMaxClientMB,
		PostActionsEnabled:    postActionsEnabled,
		PostActionTimeout:     postActionTimeout,
		PostActionMaxRetries:  postActionMaxRetries,
		PostActionDefaultModel: getEnv("POST_ACTION_DEFAULT_MODEL", "gpt-3.5-turbo"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
