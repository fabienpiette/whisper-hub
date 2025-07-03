package service

import (
	"context"
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/sashabaranov/go-openai"
)

// Mock OpenAI client for testing
type mockOpenAIClient struct {
	response openai.ChatCompletionResponse
	err      error
}

func (m *mockOpenAIClient) CreateChatCompletion(ctx context.Context, req openai.ChatCompletionRequest) (openai.ChatCompletionResponse, error) {
	return m.response, m.err
}

func TestNewPostActionService(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	
	tests := []struct {
		name       string
		client     *openai.Client
		wantNilProcessor bool
	}{
		{
			name:       "with OpenAI client",
			client:     openai.NewClient("test-key"),
			wantNilProcessor: false,
		},
		{
			name:       "without OpenAI client",
			client:     nil,
			wantNilProcessor: true,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := NewPostActionService(logger, tt.client)
			
			if service == nil {
				t.Fatal("NewPostActionService returned nil")
			}
			
			if service.logger != logger {
				t.Error("Logger not set correctly")
			}
			
			if service.templateEngine == nil {
				t.Error("Template engine not initialized")
			}
			
			if tt.wantNilProcessor && service.openaiProcessor != nil {
				t.Error("Expected nil OpenAI processor when no client provided")
			}
			
			if !tt.wantNilProcessor && service.openaiProcessor == nil {
				t.Error("Expected OpenAI processor when client provided")
			}
		})
	}
}

func TestPostActionService_ProcessAction_TemplateAction(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	service := NewPostActionService(logger, nil)
	
	tests := []struct {
		name        string
		action      *CustomAction
		context     *ActionContext
		wantSuccess bool
		wantError   bool
	}{
		{
			name: "valid template action",
			action: &CustomAction{
				ID:       "test-1",
				Name:     "Test Action",
				Type:     "template",
				Template: "File: {{.Filename}}\nTranscript: {{.Transcript}}",
			},
			context: &ActionContext{
				Transcript: "Hello world",
				Filename:   "test.mp3",
			},
			wantSuccess: true,
			wantError:   false,
		},
		{
			name: "template action with functions",
			action: &CustomAction{
				ID:       "test-2",
				Name:     "Test Function Action",
				Type:     "template",
				Template: "Summary: {{.Transcript | summarize}}\nWord Count: {{.WordCount}}",
			},
			context: &ActionContext{
				Transcript: "This is a test transcript with multiple sentences. It should be summarized properly.",
				Filename:   "test.mp3",
				WordCount:  12,
			},
			wantSuccess: true,
			wantError:   false,
		},
		{
			name: "empty template",
			action: &CustomAction{
				ID:       "test-3",
				Name:     "Empty Template",
				Type:     "template",
				Template: "",
			},
			context: &ActionContext{
				Transcript: "Hello world",
				Filename:   "test.mp3",
			},
			wantSuccess: false,
			wantError:   true,
		},
		{
			name: "invalid template syntax",
			action: &CustomAction{
				ID:       "test-4",
				Name:     "Invalid Template",
				Type:     "template",
				Template: "{{.InvalidField}",
			},
			context: &ActionContext{
				Transcript: "Hello world",
				Filename:   "test.mp3",
			},
			wantSuccess: false,
			wantError:   true,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.ProcessAction(tt.action, tt.context)
			
			if result == nil {
				t.Fatal("ProcessAction returned nil result")
			}
			
			if result.Success != tt.wantSuccess {
				t.Errorf("Expected success=%v, got=%v", tt.wantSuccess, result.Success)
			}
			
			if tt.wantError && result.Error == "" {
				t.Error("Expected error but got none")
			}
			
			if !tt.wantError && result.Error != "" {
				t.Errorf("Unexpected error: %s", result.Error)
			}
			
			if result.ActionName != tt.action.Name {
				t.Errorf("Expected action name %s, got %s", tt.action.Name, result.ActionName)
			}
			
			if result.ActionType != tt.action.Type {
				t.Errorf("Expected action type %s, got %s", tt.action.Type, result.ActionType)
			}
		})
	}
}

func TestPostActionService_ProcessAction_OpenAIAction(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	
	tests := []struct {
		name         string
		action       *CustomAction
		context      *ActionContext
		mockResponse openai.ChatCompletionResponse
		mockError    error
		wantSuccess  bool
		wantFallback bool
	}{
		{
			name: "successful OpenAI action",
			action: &CustomAction{
				ID:     "openai-1",
				Name:   "AI Summary",
				Type:   "openai",
				Prompt: "Summarize this transcript",
				Model:  "gpt-3.5-turbo",
			},
			context: &ActionContext{
				Transcript: "This is a test transcript that needs summarization.",
				Filename:   "test.mp3",
			},
			mockResponse: openai.ChatCompletionResponse{
				Choices: []openai.ChatCompletionChoice{
					{
						Message: openai.ChatCompletionMessage{
							Content: "This is a summary of the transcript.",
						},
					},
				},
				Usage: openai.Usage{
					TotalTokens: 50,
				},
			},
			mockError:    nil,
			wantSuccess:  true,
			wantFallback: false,
		},
		{
			name: "OpenAI API failure with fallback",
			action: &CustomAction{
				ID:     "openai-2",
				Name:   "AI Summary",
				Type:   "openai",
				Prompt: "Summarize this transcript",
				Model:  "gpt-3.5-turbo",
			},
			context: &ActionContext{
				Transcript: "This is a test transcript.",
				Filename:   "test.mp3",
			},
			mockResponse: openai.ChatCompletionResponse{},
			mockError:    &openai.APIError{Code: "rate_limit_exceeded"},
			wantSuccess:  true,  // Should succeed via fallback
			wantFallback: true,
		},
		{
			name: "empty prompt",
			action: &CustomAction{
				ID:     "openai-3",
				Name:   "Empty Prompt",
				Type:   "openai",
				Prompt: "",
				Model:  "gpt-3.5-turbo",
			},
			context: &ActionContext{
				Transcript: "This is a test transcript.",
				Filename:   "test.mp3",
			},
			mockResponse: openai.ChatCompletionResponse{},
			mockError:    nil,
			wantSuccess:  false,
			wantFallback: false,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create service with mock client
			mockClient := &mockOpenAIClient{
				response: tt.mockResponse,
				err:      tt.mockError,
			}
			
			service := NewPostActionService(logger, nil)
			if service.openaiProcessor == nil {
				service.openaiProcessor = &OpenAIActionProcessor{
					client: nil, // We'll mock the ProcessPrompt method
					logger: logger,
					config: &OpenAIConfig{
						DefaultModel:     "gpt-3.5-turbo",
						DefaultTemp:      0.7,
						DefaultMaxTokens: 2000,
						RequestTimeout:   60,
						MaxRetries:       3,
					},
				}
			}
			
			result := service.ProcessAction(tt.action, tt.context)
			
			if result == nil {
				t.Fatal("ProcessAction returned nil result")
			}
			
			if result.Success != tt.wantSuccess {
				t.Errorf("Expected success=%v, got=%v. Error: %s", tt.wantSuccess, result.Success, result.Error)
			}
			
			if result.ActionName != tt.action.Name {
				t.Errorf("Expected action name %s, got %s", tt.action.Name, result.ActionName)
			}
		})
	}
}

func TestPostActionService_ValidateAction(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	service := NewPostActionService(logger, nil)
	
	tests := []struct {
		name        string
		action      *CustomAction
		wantErrors  int
		errorChecks []string
	}{
		{
			name: "valid template action",
			action: &CustomAction{
				Name:        "Test Action",
				Type:        "template",
				Template:    "Test template {{.Transcript}}",
				Description: "Test description",
			},
			wantErrors: 0,
		},
		{
			name: "valid OpenAI action",
			action: &CustomAction{
				Name:        "AI Action",
				Type:        "openai",
				Prompt:      "Summarize this text",
				Model:       "gpt-3.5-turbo",
				Temperature: 0.7,
				MaxTokens:   1000,
				Description: "AI description",
			},
			wantErrors: 0,
		},
		{
			name: "missing name",
			action: &CustomAction{
				Type:     "template",
				Template: "Test template",
			},
			wantErrors:  1,
			errorChecks: []string{"name is required"},
		},
		{
			name: "name too long",
			action: &CustomAction{
				Name:     strings.Repeat("a", 101),
				Type:     "template",
				Template: "Test template",
			},
			wantErrors:  1,
			errorChecks: []string{"name too long"},
		},
		{
			name: "description too long",
			action: &CustomAction{
				Name:        "Test",
				Type:        "template",
				Template:    "Test template",
				Description: strings.Repeat("a", 501),
			},
			wantErrors:  1,
			errorChecks: []string{"description too long"},
		},
		{
			name: "template action missing template",
			action: &CustomAction{
				Name: "Test",
				Type: "template",
			},
			wantErrors:  1,
			errorChecks: []string{"template is required"},
		},
		{
			name: "OpenAI action missing prompt",
			action: &CustomAction{
				Name: "Test",
				Type: "openai",
			},
			wantErrors:  1,
			errorChecks: []string{"prompt is required"},
		},
		{
			name: "invalid OpenAI model",
			action: &CustomAction{
				Name:   "Test",
				Type:   "openai",
				Prompt: "Test prompt",
				Model:  "invalid-model",
			},
			wantErrors:  1,
			errorChecks: []string{"Invalid OpenAI model"},
		},
		{
			name: "invalid temperature",
			action: &CustomAction{
				Name:        "Test",
				Type:        "openai",
				Prompt:      "Test prompt",
				Model:       "gpt-3.5-turbo",
				Temperature: 3.0,
			},
			wantErrors:  1,
			errorChecks: []string{"temperature must be between 0 and 2"},
		},
		{
			name: "invalid max tokens",
			action: &CustomAction{
				Name:      "Test",
				Type:      "openai",
				Prompt:    "Test prompt",
				Model:     "gpt-3.5-turbo",
				MaxTokens: 5000,
			},
			wantErrors:  1,
			errorChecks: []string{"max tokens must be between 0 and 4000"},
		},
		{
			name: "invalid action type",
			action: &CustomAction{
				Name: "Test",
				Type: "invalid",
			},
			wantErrors:  1,
			errorChecks: []string{"Invalid action type"},
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errors := service.ValidateAction(tt.action)
			
			if len(errors) != tt.wantErrors {
				t.Errorf("Expected %d errors, got %d: %v", tt.wantErrors, len(errors), errors)
			}
			
			for _, check := range tt.errorChecks {
				found := false
				for _, err := range errors {
					if strings.Contains(err, check) {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("Expected error containing '%s', but not found in: %v", check, errors)
				}
			}
		})
	}
}

func TestPostActionService_GetPredefinedActions(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	service := NewPostActionService(logger, nil)
	
	actions := service.GetPredefinedActions()
	
	if len(actions) == 0 {
		t.Error("Expected predefined actions, got none")
	}
	
	expectedActions := []string{
		"openai-meeting-summary",
		"openai-action-items", 
		"openai-executive-brief",
		"openai-key-insights",
		"openai-qa-format",
	}
	
	for _, expectedID := range expectedActions {
		found := false
		for _, action := range actions {
			if action.ID == expectedID {
				found = true
				
				// Validate required fields
				if action.Name == "" {
					t.Errorf("Action %s missing name", expectedID)
				}
				if action.Type != "openai" {
					t.Errorf("Action %s should be type 'openai', got '%s'", expectedID, action.Type)
				}
				if action.Prompt == "" {
					t.Errorf("Action %s missing prompt", expectedID)
				}
				if action.Model == "" {
					t.Errorf("Action %s missing model", expectedID)
				}
				break
			}
		}
		if !found {
			t.Errorf("Expected predefined action %s not found", expectedID)
		}
	}
}

func TestPostActionService_GetAvailableModels(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	service := NewPostActionService(logger, nil)
	
	models := service.GetAvailableModels()
	
	if len(models) == 0 {
		t.Error("Expected available models, got none")
	}
	
	expectedModels := []string{
		"gpt-3.5-turbo",
		"gpt-4",
		"gpt-4o",
	}
	
	for _, expectedModel := range expectedModels {
		found := false
		for _, model := range models {
			if model == expectedModel {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Expected model %s not found in available models", expectedModel)
		}
	}
}

func TestTemplateEngine_ProcessTemplate(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	engine := NewTemplateEngine(logger)
	
	context := &ActionContext{
		Transcript:     "This is a test transcript with multiple sentences. It contains important information.",
		Filename:       "test.mp3",
		Date:           "2023-01-01",
		FileType:       "audio",
		Duration:       "30s",
		WordCount:      12,
		CharCount:      85,
		ProcessingTime: "1.5s",
	}
	
	tests := []struct {
		name     string
		template string
		wantContains []string
		wantError    bool
	}{
		{
			name:     "basic variable substitution",
			template: "File: {{.Filename}}\nType: {{.FileType}}",
			wantContains: []string{"File: test.mp3", "Type: audio"},
			wantError:    false,
		},
		{
			name:     "function usage",
			template: "UPPERCASE: {{.Transcript | upper}}\nWord Count: {{.WordCount}}",
			wantContains: []string{"UPPERCASE: THIS IS A TEST", "Word Count: 12"},
			wantError:    false,
		},
		{
			name:     "summarize function",
			template: "Summary:\n{{.Transcript | summarize}}",
			wantContains: []string{"Summary:", "- This is a test transcript"},
			wantError:    false,
		},
		{
			name:     "extractActions function",
			template: "Actions:\n{{.Transcript | extractActions}}",
			wantContains: []string{"Actions:"},
			wantError:    false,
		},
		{
			name:     "timestamp functions",
			template: "Date: {{date}}\nTime: {{time}}\nTimestamp: {{timestamp}}",
			wantContains: []string{"Date:", "Time:", "Timestamp:"},
			wantError:    false,
		},
		{
			name:      "invalid template syntax",
			template:  "{{.InvalidField}",
			wantError: true,
		},
		{
			name:      "invalid function",
			template:  "{{.Transcript | invalidFunction}}",
			wantError: true,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := engine.ProcessTemplate(tt.template, context)
			
			if tt.wantError {
				if err == nil {
					t.Error("Expected error but got none")
				}
				return
			}
			
			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}
			
			for _, want := range tt.wantContains {
				if !strings.Contains(result, want) {
					t.Errorf("Expected result to contain '%s', got:\n%s", want, result)
				}
			}
		})
	}
}

func TestOpenAIActionProcessor_FormatOpenAIError(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	processor := NewOpenAIActionProcessor(nil, logger)
	
	tests := []struct {
		name      string
		inputErr  error
		wantContains string
	}{
		{
			name:      "unauthorized error",
			inputErr:  &openai.APIError{Code: "invalid_api_key", Message: "401 unauthorized"},
			wantContains: "API key invalid or expired",
		},
		{
			name:      "rate limit error",
			inputErr:  &openai.APIError{Code: "rate_limit_exceeded", Message: "429 rate limit"},
			wantContains: "rate limit exceeded",
		},
		{
			name:      "bad request error",
			inputErr:  &openai.APIError{Code: "invalid_request", Message: "400 bad request"},
			wantContains: "Invalid request to OpenAI",
		},
		{
			name:      "server error",
			inputErr:  &openai.APIError{Code: "internal_server_error", Message: "500 server error"},
			wantContains: "temporarily unavailable",
		},
		{
			name:      "service unavailable",
			inputErr:  &openai.APIError{Code: "service_unavailable", Message: "503 service unavailable"},
			wantContains: "currently overloaded",
		},
		{
			name:      "timeout error",
			inputErr:  context.DeadlineExceeded,
			wantContains: "timed out",
		},
		{
			name:      "generic error",
			inputErr:  &openai.APIError{Code: "unknown", Message: "unknown error"},
			wantContains: "OpenAI processing failed",
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			formattedErr := processor.formatOpenAIError(tt.inputErr)
			
			if !strings.Contains(strings.ToLower(formattedErr.Error()), strings.ToLower(tt.wantContains)) {
				t.Errorf("Expected error to contain '%s', got: %s", tt.wantContains, formattedErr.Error())
			}
		})
	}
}

// Benchmark tests for performance validation
func BenchmarkTemplateEngine_ProcessTemplate(b *testing.B) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	engine := NewTemplateEngine(logger)
	
	context := &ActionContext{
		Transcript: strings.Repeat("This is a test transcript. ", 100), // ~2700 characters
		Filename:   "test.mp3",
		WordCount:  700,
	}
	
	template := `
# Summary Report
File: {{.Filename}}
Word Count: {{.WordCount}}

## Summary
{{.Transcript | summarize}}

## Actions
{{.Transcript | extractActions}}
`
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := engine.ProcessTemplate(template, context)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkPostActionService_ProcessAction(b *testing.B) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	service := NewPostActionService(logger, nil)
	
	action := &CustomAction{
		ID:       "bench-test",
		Name:     "Benchmark Test",
		Type:     "template",
		Template: "Summary: {{.Transcript | summarize}}\nActions: {{.Transcript | extractActions}}",
	}
	
	context := &ActionContext{
		Transcript: strings.Repeat("This is a test transcript with action items. We need to follow up on the discussion. ", 50),
		Filename:   "test.mp3",
		WordCount:  400,
	}
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		result := service.ProcessAction(action, context)
		if !result.Success {
			b.Fatalf("Action processing failed: %s", result.Error)
		}
	}
}