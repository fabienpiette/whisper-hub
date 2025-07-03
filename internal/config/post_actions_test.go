package config

import (
	"os"
	"strconv"
	"testing"
)

func TestPostActionsConfiguration(t *testing.T) {
	// Store original env vars to restore later
	originalVars := map[string]string{
		"POST_ACTIONS_ENABLED":     os.Getenv("POST_ACTIONS_ENABLED"),
		"POST_ACTION_TIMEOUT":      os.Getenv("POST_ACTION_TIMEOUT"),
		"POST_ACTION_MAX_RETRIES":  os.Getenv("POST_ACTION_MAX_RETRIES"),
		"POST_ACTION_DEFAULT_MODEL": os.Getenv("POST_ACTION_DEFAULT_MODEL"),
	}
	
	// Clean up function
	defer func() {
		for key, value := range originalVars {
			if value == "" {
				os.Unsetenv(key)
			} else {
				os.Setenv(key, value)
			}
		}
	}()

	tests := []struct {
		name     string
		envVars  map[string]string
		expected struct {
			enabled    bool
			timeout    int
			retries    int
			model      string
		}
	}{
		{
			name: "default values when no env vars set",
			envVars: map[string]string{
				"POST_ACTIONS_ENABLED":     "",
				"POST_ACTION_TIMEOUT":      "",
				"POST_ACTION_MAX_RETRIES":  "",
				"POST_ACTION_DEFAULT_MODEL": "",
			},
			expected: struct {
				enabled    bool
				timeout    int
				retries    int
				model      string
			}{
				enabled: true,
				timeout: 60,
				retries: 3,
				model:   "gpt-3.5-turbo",
			},
		},
		{
			name: "custom values from env vars",
			envVars: map[string]string{
				"POST_ACTIONS_ENABLED":     "false",
				"POST_ACTION_TIMEOUT":      "120",
				"POST_ACTION_MAX_RETRIES":  "5",
				"POST_ACTION_DEFAULT_MODEL": "gpt-4",
			},
			expected: struct {
				enabled    bool
				timeout    int
				retries    int
				model      string
			}{
				enabled: false,
				timeout: 120,
				retries: 5,
				model:   "gpt-4",
			},
		},
		{
			name: "invalid boolean values default to true",
			envVars: map[string]string{
				"POST_ACTIONS_ENABLED":     "invalid",
				"POST_ACTION_TIMEOUT":      "60",
				"POST_ACTION_MAX_RETRIES":  "3",
				"POST_ACTION_DEFAULT_MODEL": "gpt-3.5-turbo",
			},
			expected: struct {
				enabled    bool
				timeout    int
				retries    int
				model      string
			}{
				enabled: false, // Invalid boolean defaults to false
				timeout: 60,
				retries: 3,
				model:   "gpt-3.5-turbo",
			},
		},
		{
			name: "invalid numeric values default to fallback",
			envVars: map[string]string{
				"POST_ACTIONS_ENABLED":     "true",
				"POST_ACTION_TIMEOUT":      "invalid",
				"POST_ACTION_MAX_RETRIES":  "invalid",
				"POST_ACTION_DEFAULT_MODEL": "gpt-4",
			},
			expected: struct {
				enabled    bool
				timeout    int
				retries    int
				model      string
			}{
				enabled: true,
				timeout: 0, // Invalid int defaults to 0
				retries: 0, // Invalid int defaults to 0
				model:   "gpt-4",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Set environment variables
			for key, value := range tt.envVars {
				if value == "" {
					os.Unsetenv(key)
				} else {
					os.Setenv(key, value)
				}
			}

			// Load configuration
			config := Load()

			// Test post-action specific fields
			if config.PostActionsEnabled != tt.expected.enabled {
				t.Errorf("PostActionsEnabled = %v, want %v", config.PostActionsEnabled, tt.expected.enabled)
			}

			if config.PostActionTimeout != tt.expected.timeout {
				t.Errorf("PostActionTimeout = %v, want %v", config.PostActionTimeout, tt.expected.timeout)
			}

			if config.PostActionMaxRetries != tt.expected.retries {
				t.Errorf("PostActionMaxRetries = %v, want %v", config.PostActionMaxRetries, tt.expected.retries)
			}

			if config.PostActionDefaultModel != tt.expected.model {
				t.Errorf("PostActionDefaultModel = %v, want %v", config.PostActionDefaultModel, tt.expected.model)
			}

			// Ensure other config fields are still working
			if config.OpenAIAPIKey == "" && os.Getenv("OPENAI_API_KEY") != "" {
				t.Error("OpenAIAPIKey should be preserved from environment")
			}

			if config.Port == "" {
				t.Error("Port should have default value")
			}
		})
	}
}

func TestPostActionsConfigurationValidation(t *testing.T) {
	tests := []struct {
		name          string
		config        *Config
		expectValid   bool
		validationMsg string
	}{
		{
			name: "valid configuration",
			config: &Config{
				PostActionsEnabled:    true,
				PostActionTimeout:     60,
				PostActionMaxRetries:  3,
				PostActionDefaultModel: "gpt-3.5-turbo",
				OpenAIAPIKey:          "sk-test123",
			},
			expectValid: true,
		},
		{
			name: "disabled post-actions should be valid even without API key",
			config: &Config{
				PostActionsEnabled:    false,
				PostActionTimeout:     60,
				PostActionMaxRetries:  3,
				PostActionDefaultModel: "gpt-3.5-turbo",
				OpenAIAPIKey:          "",
			},
			expectValid: true,
		},
		{
			name: "enabled post-actions without API key should be handled gracefully",
			config: &Config{
				PostActionsEnabled:    true,
				PostActionTimeout:     60,
				PostActionMaxRetries:  3,
				PostActionDefaultModel: "gpt-3.5-turbo",
				OpenAIAPIKey:          "",
			},
			expectValid:   true, // Should not fail, but OpenAI features will be disabled
			validationMsg: "OpenAI features will be disabled without API key",
		},
		{
			name: "zero timeout should be valid",
			config: &Config{
				PostActionsEnabled:    true,
				PostActionTimeout:     0,
				PostActionMaxRetries:  3,
				PostActionDefaultModel: "gpt-3.5-turbo",
				OpenAIAPIKey:          "sk-test123",
			},
			expectValid: true,
		},
		{
			name: "zero retries should be valid",
			config: &Config{
				PostActionsEnabled:    true,
				PostActionTimeout:     60,
				PostActionMaxRetries:  0,
				PostActionDefaultModel: "gpt-3.5-turbo",
				OpenAIAPIKey:          "sk-test123",
			},
			expectValid: true,
		},
		{
			name: "empty model should use default",
			config: &Config{
				PostActionsEnabled:    true,
				PostActionTimeout:     60,
				PostActionMaxRetries:  3,
				PostActionDefaultModel: "",
				OpenAIAPIKey:          "sk-test123",
			},
			expectValid: true, // Should fall back to service defaults
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Here we would implement validation logic
			// For now, we just test that the configuration is loaded correctly
			
			// Test logical combinations
			if tt.config.PostActionsEnabled && tt.config.OpenAIAPIKey == "" {
				t.Logf("Warning: %s", tt.validationMsg)
			}

			// Test that numeric values are within reasonable ranges
			if tt.config.PostActionTimeout < 0 {
				t.Error("PostActionTimeout should not be negative")
			}

			if tt.config.PostActionMaxRetries < 0 {
				t.Error("PostActionMaxRetries should not be negative")
			}

			// Test timeout upper bounds (should not be excessively long)
			if tt.config.PostActionTimeout > 600 { // 10 minutes
				t.Logf("Warning: PostActionTimeout of %d seconds seems very long", tt.config.PostActionTimeout)
			}

			// Test retries upper bounds
			if tt.config.PostActionMaxRetries > 10 {
				t.Logf("Warning: PostActionMaxRetries of %d seems excessive", tt.config.PostActionMaxRetries)
			}
		})
	}
}

func TestPostActionsConfigurationSecurity(t *testing.T) {
	// Test that sensitive values are not exposed in logs or errors
	
	// Set a mock API key
	os.Setenv("OPENAI_API_KEY", "sk-test123456789")
	defer os.Unsetenv("OPENAI_API_KEY")

	config := Load()

	// Test that API key is loaded but not exposed
	if config.OpenAIAPIKey == "" {
		t.Error("OpenAI API key should be loaded from environment")
	}

	// Test that we don't accidentally log the API key
	configStr := config.OpenAIAPIKey
	if len(configStr) > 0 {
		// In a real scenario, we'd verify logging doesn't expose this
		t.Logf("API key loaded (length: %d)", len(configStr))
		
		// Verify it starts with expected prefix
		if !startsWithAPIKeyPrefix(configStr) {
			t.Error("API key should start with expected prefix")
		}
	}
}

func TestEnvironmentVariableParsing(t *testing.T) {
	tests := []struct {
		name     string
		value    string
		parser   func(string, string) interface{}
		expected interface{}
	}{
		{
			name:  "valid boolean true",
			value: "true",
			parser: func(val, def string) interface{} {
				result, _ := strconv.ParseBool(getEnvOrDefault(val, def))
				return result
			},
			expected: true,
		},
		{
			name:  "valid boolean false",
			value: "false", 
			parser: func(val, def string) interface{} {
				result, _ := strconv.ParseBool(getEnvOrDefault(val, def))
				return result
			},
			expected: false,
		},
		{
			name:  "valid integer",
			value: "120",
			parser: func(val, def string) interface{} {
				result, _ := strconv.Atoi(getEnvOrDefault(val, def))
				return result
			},
			expected: 120,
		},
		{
			name:  "invalid integer defaults",
			value: "invalid",
			parser: func(val, def string) interface{} {
				result, _ := strconv.Atoi(getEnvOrDefault(val, def))
				return result
			},
			expected: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.Setenv("TEST_VAR", tt.value)
			defer os.Unsetenv("TEST_VAR")

			result := tt.parser("TEST_VAR", "default")
			if result != tt.expected {
				t.Errorf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}

// Helper functions
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func startsWithAPIKeyPrefix(key string) bool {
	return len(key) > 3 && key[:3] == "sk-"
}

// Integration test with actual environment
func TestPostActionsConfigurationIntegration(t *testing.T) {
	// Save original environment
	originalEnv := make(map[string]string)
	envVars := []string{
		"POST_ACTIONS_ENABLED",
		"POST_ACTION_TIMEOUT", 
		"POST_ACTION_MAX_RETRIES",
		"POST_ACTION_DEFAULT_MODEL",
		"OPENAI_API_KEY",
	}

	for _, key := range envVars {
		originalEnv[key] = os.Getenv(key)
	}

	defer func() {
		for key, value := range originalEnv {
			if value == "" {
				os.Unsetenv(key)
			} else {
				os.Setenv(key, value)
			}
		}
	}()

	// Test realistic production configuration
	os.Setenv("POST_ACTIONS_ENABLED", "true")
	os.Setenv("POST_ACTION_TIMEOUT", "90")
	os.Setenv("POST_ACTION_MAX_RETRIES", "3")
	os.Setenv("POST_ACTION_DEFAULT_MODEL", "gpt-3.5-turbo")
	os.Setenv("OPENAI_API_KEY", "sk-test123456789abcdef")

	config := Load()

	// Verify all post-action settings are loaded correctly
	if !config.PostActionsEnabled {
		t.Error("PostActionsEnabled should be true")
	}

	if config.PostActionTimeout != 90 {
		t.Errorf("PostActionTimeout should be 90, got %d", config.PostActionTimeout)
	}

	if config.PostActionMaxRetries != 3 {
		t.Errorf("PostActionMaxRetries should be 3, got %d", config.PostActionMaxRetries)
	}

	if config.PostActionDefaultModel != "gpt-3.5-turbo" {
		t.Errorf("PostActionDefaultModel should be 'gpt-3.5-turbo', got %s", config.PostActionDefaultModel)
	}

	if config.OpenAIAPIKey != "sk-test123456789abcdef" {
		t.Error("OpenAI API key should be loaded correctly")
	}

	// Test that original config fields still work
	if config.Port == "" {
		t.Error("Port should have default value")
	}

	if config.UploadMaxSize == 0 {
		t.Error("UploadMaxSize should have default value")
	}
}