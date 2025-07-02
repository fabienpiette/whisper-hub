package config

import (
	"os"
	"testing"
)

func TestLoad(t *testing.T) {
	// Save original env vars
	originalAPIKey := os.Getenv("OPENAI_API_KEY")
	originalPort := os.Getenv("PORT")
	originalMaxSize := os.Getenv("UPLOAD_MAX_SIZE")
	originalTempDir := os.Getenv("TEMP_DIR")

	// Clean up after test
	defer func() {
		os.Setenv("OPENAI_API_KEY", originalAPIKey)
		os.Setenv("PORT", originalPort)
		os.Setenv("UPLOAD_MAX_SIZE", originalMaxSize)
		os.Setenv("TEMP_DIR", originalTempDir)
	}()

	tests := []struct {
		name        string
		envVars     map[string]string
		expected    *Config
		description string
	}{
		{
			name: "default values",
			envVars: map[string]string{
				"OPENAI_API_KEY":  "",
				"PORT":            "",
				"UPLOAD_MAX_SIZE": "",
				"TEMP_DIR":        "",
			},
			expected: &Config{
				OpenAIAPIKey:  "",
				Port:          "8080",
				UploadMaxSize: 2147483648, // 2GB
				TempDir:       os.TempDir(),
			},
			description: "should use default values when env vars are not set",
		},
		{
			name: "custom values",
			envVars: map[string]string{
				"OPENAI_API_KEY":  "sk-test-key-123",
				"PORT":            "9000",
				"UPLOAD_MAX_SIZE": "104857600", // 100MB
				"TEMP_DIR":        "/custom/temp",
			},
			expected: &Config{
				OpenAIAPIKey:  "sk-test-key-123",
				Port:          "9000",
				UploadMaxSize: 104857600,
				TempDir:       "/custom/temp",
			},
			description: "should use env vars when provided",
		},
		{
			name: "invalid upload size",
			envVars: map[string]string{
				"OPENAI_API_KEY":  "sk-test-key",
				"PORT":            "8080",
				"UPLOAD_MAX_SIZE": "invalid-size",
				"TEMP_DIR":        "",
			},
			expected: &Config{
				OpenAIAPIKey:  "sk-test-key",
				Port:          "8080",
				UploadMaxSize: 0, // Should default to 0 on parse error
				TempDir:       os.TempDir(),
			},
			description: "should handle invalid upload size gracefully",
		},
		{
			name: "mixed env vars",
			envVars: map[string]string{
				"OPENAI_API_KEY":  "sk-mixed-test",
				"PORT":            "",        // Will use default
				"UPLOAD_MAX_SIZE": "1048576", // 1MB
				"TEMP_DIR":        "/tmp/custom",
			},
			expected: &Config{
				OpenAIAPIKey:  "sk-mixed-test",
				Port:          "8080",
				UploadMaxSize: 1048576,
				TempDir:       "/tmp/custom",
			},
			description: "should mix env vars and defaults correctly",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Set env vars for test
			for key, value := range tt.envVars {
				if value == "" {
					os.Unsetenv(key)
				} else {
					os.Setenv(key, value)
				}
			}

			cfg := Load()

			if cfg.OpenAIAPIKey != tt.expected.OpenAIAPIKey {
				t.Errorf("OpenAIAPIKey = %q, want %q", cfg.OpenAIAPIKey, tt.expected.OpenAIAPIKey)
			}
			if cfg.Port != tt.expected.Port {
				t.Errorf("Port = %q, want %q", cfg.Port, tt.expected.Port)
			}
			if cfg.UploadMaxSize != tt.expected.UploadMaxSize {
				t.Errorf("UploadMaxSize = %d, want %d", cfg.UploadMaxSize, tt.expected.UploadMaxSize)
			}
			if cfg.TempDir != tt.expected.TempDir {
				t.Errorf("TempDir = %q, want %q", cfg.TempDir, tt.expected.TempDir)
			}
		})
	}
}

func TestGetEnv(t *testing.T) {
	tests := []struct {
		name         string
		key          string
		defaultValue string
		envValue     string
		expected     string
	}{
		{
			name:         "env var exists",
			key:          "TEST_KEY_EXISTS",
			defaultValue: "default",
			envValue:     "env-value",
			expected:     "env-value",
		},
		{
			name:         "env var does not exist",
			key:          "TEST_KEY_NOT_EXISTS",
			defaultValue: "default-value",
			envValue:     "",
			expected:     "default-value",
		},
		{
			name:         "env var is empty string",
			key:          "TEST_KEY_EMPTY",
			defaultValue: "default",
			envValue:     "",
			expected:     "default",
		},
		{
			name:         "empty default value",
			key:          "TEST_KEY_EMPTY_DEFAULT",
			defaultValue: "",
			envValue:     "",
			expected:     "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clean up env var after test
			originalValue := os.Getenv(tt.key)
			defer os.Setenv(tt.key, originalValue)

			if tt.envValue != "" {
				os.Setenv(tt.key, tt.envValue)
			} else {
				os.Unsetenv(tt.key)
			}

			result := getEnv(tt.key, tt.defaultValue)
			if result != tt.expected {
				t.Errorf("getEnv(%q, %q) = %q, want %q", tt.key, tt.defaultValue, result, tt.expected)
			}
		})
	}
}

func TestConfig_Validation(t *testing.T) {
	cfg := Load()

	// Test that config struct is properly initialized
	if cfg == nil {
		t.Fatal("Load() returned nil config")
	}

	// Port should be a valid string
	if cfg.Port == "" {
		t.Error("Port should not be empty")
	}

	// UploadMaxSize should be non-negative
	if cfg.UploadMaxSize < 0 {
		t.Errorf("UploadMaxSize should not be negative, got %d", cfg.UploadMaxSize)
	}

	// TempDir should not be empty
	if cfg.TempDir == "" {
		t.Error("TempDir should not be empty")
	}
}
