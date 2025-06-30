package config

import (
	"os"
	"strconv"
	
	"whisper-hub/internal/constants"
)

type Config struct {
	OpenAIAPIKey      string
	Port              string
	UploadMaxSize     int64
	TempDir           string
	// History feature configuration
	HistoryEnabled    bool
	HistoryJSPath     string
	HistoryMaxClientMB int
}

func Load() *Config {
	maxSize, _ := strconv.ParseInt(getEnv("UPLOAD_MAX_SIZE", strconv.FormatInt(constants.DefaultUploadMaxSize, 10)), 10, 64)
	historyEnabled, _ := strconv.ParseBool(getEnv("HISTORY_ENABLED", "true"))
	historyMaxClientMB, _ := strconv.Atoi(getEnv("HISTORY_MAX_CLIENT_MB", "50"))
	
	return &Config{
		OpenAIAPIKey:       getEnv("OPENAI_API_KEY", ""),
		Port:               getEnv("PORT", "8080"),
		UploadMaxSize:      maxSize,
		TempDir:            getEnv("TEMP_DIR", os.TempDir()),
		HistoryEnabled:     historyEnabled,
		HistoryJSPath:      getEnv("HISTORY_JS_PATH", "/static/js/history/"),
		HistoryMaxClientMB: historyMaxClientMB,
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}