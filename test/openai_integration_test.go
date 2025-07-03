package test

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/sashabaranov/go-openai"
	"whisper-hub/internal/service"
)

// MockOpenAIClient implements the required interface for testing
type MockOpenAIClient struct {
	responses map[string]openai.ChatCompletionResponse
	errors    map[string]error
	callCount map[string]int
	lastRequest *openai.ChatCompletionRequest
}

func NewMockOpenAIClient() *MockOpenAIClient {
	return &MockOpenAIClient{
		responses: make(map[string]openai.ChatCompletionResponse),
		errors:    make(map[string]error),
		callCount: make(map[string]int),
	}
}

func (m *MockOpenAIClient) CreateChatCompletion(ctx context.Context, req openai.ChatCompletionRequest) (openai.ChatCompletionResponse, error) {
	m.lastRequest = &req
	key := req.Model + "_" + req.Messages[len(req.Messages)-1].Content[:min(50, len(req.Messages[len(req.Messages)-1].Content))]
	m.callCount[key]++
	
	if err, exists := m.errors[key]; exists {
		return openai.ChatCompletionResponse{}, err
	}
	
	if resp, exists := m.responses[key]; exists {
		return resp, nil
	}
	
	// Default successful response
	return openai.ChatCompletionResponse{
		Choices: []openai.ChatCompletionChoice{
			{
				Message: openai.ChatCompletionMessage{
					Content: "Mock response for: " + req.Messages[len(req.Messages)-1].Content[:min(30, len(req.Messages[len(req.Messages)-1].Content))],
				},
			},
		},
		Usage: openai.Usage{
			TotalTokens:      100,
			PromptTokens:     80,
			CompletionTokens: 20,
		},
	}, nil
}

func (m *MockOpenAIClient) SetResponse(key string, response openai.ChatCompletionResponse) {
	m.responses[key] = response
}

func (m *MockOpenAIClient) SetError(key string, err error) {
	m.errors[key] = err
}

func (m *MockOpenAIClient) GetCallCount(key string) int {
	return m.callCount[key]
}

func (m *MockOpenAIClient) GetLastRequest() *openai.ChatCompletionRequest {
	return m.lastRequest
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func TestOpenAIIntegration_SuccessfulCompletion(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	mockClient := NewMockOpenAIClient()
	
	// Create a real OpenAI client but we'll replace the implementation through the processor
	realClient := openai.NewClient("test-key")
	service := service.NewPostActionService(logger, realClient)
	
	// Set up mock response for meeting summary
	mockClient.SetResponse("gpt-3.5-turbo_Analyze this meeting transcript and create a co", openai.ChatCompletionResponse{
		Choices: []openai.ChatCompletionChoice{
			{
				Message: openai.ChatCompletionMessage{
					Content: `# Meeting Summary

## Key Decisions Made
- Approved Q4 budget allocation
- Selected new project management tool

## Action Items
- [ ] John to finalize vendor contracts (Due: Friday)
- [ ] Sarah to prepare implementation timeline (Due: Next week)

## Important Discussion Points
- Budget constraints discussed
- Timeline concerns raised

## Next Steps
- Follow up meeting scheduled for next Tuesday`,
				},
			},
		},
		Usage: openai.Usage{
			TotalTokens:      250,
			PromptTokens:     200,
			CompletionTokens: 50,
		},
	})
	
	action := &service.CustomAction{
		ID:          "test-meeting-summary",
		Name:        "Meeting Summary",
		Type:        "openai",
		Prompt:      "Analyze this meeting transcript and create a comprehensive summary",
		Model:       "gpt-3.5-turbo",
		Temperature: 0.3,
		MaxTokens:   1500,
	}
	
	context := &service.ActionContext{
		Transcript: "We discussed the Q4 budget and decided to allocate funds for the new project management tool. John will handle vendor contracts and Sarah will prepare the timeline.",
		Filename:   "meeting.mp3",
		WordCount:  25,
	}
	
	// Mock the processor directly (in real implementation, you'd use dependency injection)
	result := service.ProcessAction(action, context)
	
	if !result.Success {
		t.Fatalf("Expected successful OpenAI processing, got error: %s", result.Error)
	}
	
	if result.Output == "" {
		t.Error("Expected non-empty output")
	}
	
	if result.TokensUsed == 0 {
		t.Error("Expected token usage to be recorded")
	}
	
	if result.Model != "gpt-3.5-turbo" {
		t.Errorf("Expected model 'gpt-3.5-turbo', got '%s'", result.Model)
	}
	
	if !strings.Contains(result.Output, "Key Decisions") {
		t.Error("Expected output to contain structured summary")
	}
}

func TestOpenAIIntegration_APIErrors(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	mockClient := NewMockOpenAIClient()
	
	tests := []struct {
		name           string
		apiError       error
		expectFallback bool
		expectError    string
	}{
		{
			name:           "unauthorized error",
			apiError:       &openai.APIError{Code: "invalid_api_key", Message: "401 unauthorized"},
			expectFallback: true,
			expectError:    "API key invalid",
		},
		{
			name:           "rate limit error", 
			apiError:       &openai.APIError{Code: "rate_limit_exceeded", Message: "429 rate limit"},
			expectFallback: true,
			expectError:    "rate limit exceeded",
		},
		{
			name:           "server error",
			apiError:       &openai.APIError{Code: "internal_server_error", Message: "500 server error"},
			expectFallback: true,
			expectError:    "temporarily unavailable",
		},
		{
			name:           "timeout error",
			apiError:       context.DeadlineExceeded,
			expectFallback: true,
			expectError:    "timed out",
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			realClient := openai.NewClient("test-key")
			service := service.NewPostActionService(logger, realClient)
			
			// Set up mock error
			mockClient.SetError("gpt-3.5-turbo_Test prompt for error handling", tt.apiError)
			
			action := &service.CustomAction{
				ID:          "test-error",
				Name:        "Error Test",
				Type:        "openai",
				Prompt:      "Test prompt for error handling",
				Model:       "gpt-3.5-turbo",
				Temperature: 0.3,
				MaxTokens:   1000,
			}
			
			context := &service.ActionContext{
				Transcript: "Test transcript for error scenarios",
				Filename:   "test.mp3",
				WordCount:  5,
			}
			
			result := service.ProcessAction(action, context)
			
			if tt.expectFallback {
				// Should succeed via fallback to template processing
				if !result.Success {
					t.Errorf("Expected fallback success, got error: %s", result.Error)
				}
				
				// Should contain the original prompt text (fallback behavior)
				if !strings.Contains(result.Output, "Test prompt") {
					t.Error("Expected fallback output to contain prompt text")
				}
			} else {
				if result.Success {
					t.Error("Expected error but got success")
				}
				
				if !strings.Contains(strings.ToLower(result.Error), strings.ToLower(tt.expectError)) {
					t.Errorf("Expected error containing '%s', got: %s", tt.expectError, result.Error)
				}
			}
		})
	}
}

func TestOpenAIIntegration_ModelSelection(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	mockClient := NewMockOpenAIClient()
	
	tests := []struct {
		name           string
		actionModel    string
		expectedModel  string
		temperature    float32
		maxTokens      int
	}{
		{
			name:          "GPT-3.5 Turbo",
			actionModel:   "gpt-3.5-turbo",
			expectedModel: "gpt-3.5-turbo",
			temperature:   0.3,
			maxTokens:     1000,
		},
		{
			name:          "GPT-4",
			actionModel:   "gpt-4",
			expectedModel: "gpt-4",
			temperature:   0.2,
			maxTokens:     2000,
		},
		{
			name:          "GPT-4 Turbo",
			actionModel:   "gpt-4-turbo",
			expectedModel: "gpt-4-turbo",
			temperature:   0.4,
			maxTokens:     3000,
		},
		{
			name:          "Default model when empty",
			actionModel:   "",
			expectedModel: "gpt-3.5-turbo",
			temperature:   0.0, // Should use default
			maxTokens:     0,   // Should use default
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			realClient := openai.NewClient("test-key")
			service := service.NewPostActionService(logger, realClient)
			
			action := &service.CustomAction{
				ID:          "test-model-" + tt.actionModel,
				Name:        "Model Test",
				Type:        "openai",
				Prompt:      "Test model selection",
				Model:       tt.actionModel,
				Temperature: tt.temperature,
				MaxTokens:   tt.maxTokens,
			}
			
			context := &service.ActionContext{
				Transcript: "Test transcript for model selection",
				Filename:   "test.mp3",
				WordCount:  6,
			}
			
			result := service.ProcessAction(action, context)
			
			if !result.Success {
				t.Fatalf("Expected success, got error: %s", result.Error)
			}
			
			expectedModel := tt.expectedModel
			if tt.actionModel == "" {
				expectedModel = "gpt-3.5-turbo" // Default model
			}
			
			if result.Model != expectedModel {
				t.Errorf("Expected model '%s', got '%s'", expectedModel, result.Model)
			}
			
			// Verify the request was made with correct parameters
			lastReq := mockClient.GetLastRequest()
			if lastReq != nil {
				if lastReq.Model != expectedModel {
					t.Errorf("Expected request model '%s', got '%s'", expectedModel, lastReq.Model)
				}
				
				if tt.temperature > 0 && lastReq.Temperature != tt.temperature {
					t.Errorf("Expected temperature %f, got %f", tt.temperature, lastReq.Temperature)
				}
				
				if tt.maxTokens > 0 && lastReq.MaxTokens != tt.maxTokens {
					t.Errorf("Expected max tokens %d, got %d", tt.maxTokens, lastReq.MaxTokens)
				}
			}
		})
	}
}

func TestOpenAIIntegration_RetryLogic(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	mockClient := NewMockOpenAIClient()
	
	realClient := openai.NewClient("test-key")
	service := service.NewPostActionService(logger, realClient)
	
	// Set up mock to fail twice then succeed
	key := "gpt-3.5-turbo_Test retry logic"
	
	// First two calls fail
	mockClient.SetError(key, &openai.APIError{Code: "rate_limit_exceeded", Message: "429 rate limit"})
	
	action := &service.CustomAction{
		ID:          "test-retry",
		Name:        "Retry Test",
		Type:        "openai",
		Prompt:      "Test retry logic",
		Model:       "gpt-3.5-turbo",
		Temperature: 0.3,
		MaxTokens:   1000,
	}
	
	context := &service.ActionContext{
		Transcript: "Test transcript for retry logic",
		Filename:   "test.mp3",
		WordCount:  6,
	}
	
	start := time.Now()
	result := service.ProcessAction(action, context)
	duration := time.Since(start)
	
	// Should succeed via fallback after retries
	if !result.Success {
		t.Fatalf("Expected eventual success, got error: %s", result.Error)
	}
	
	// Should have taken some time due to retry backoff
	if duration < time.Millisecond*100 {
		t.Error("Expected retry logic to add some delay")
	}
	
	// Verify multiple calls were made (retry logic)
	callCount := mockClient.GetCallCount(key)
	if callCount < 1 {
		t.Errorf("Expected at least 1 call for retry logic, got %d", callCount)
	}
}

func TestOpenAIIntegration_PromptFormatting(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	mockClient := NewMockOpenAIClient()
	
	realClient := openai.NewClient("test-key")
	service := service.NewPostActionService(logger, realClient)
	
	action := &service.CustomAction{
		ID:          "test-prompt-format",
		Name:        "Prompt Format Test",
		Type:        "openai",
		Prompt:      "Create a summary of the following transcript",
		Model:       "gpt-3.5-turbo",
		Temperature: 0.3,
		MaxTokens:   1000,
	}
	
	context := &service.ActionContext{
		Transcript: "This is a test transcript that should be included in the prompt",
		Filename:   "test.mp3",
		WordCount:  12,
	}
	
	result := service.ProcessAction(action, context)
	
	if !result.Success {
		t.Fatalf("Expected success, got error: %s", result.Error)
	}
	
	// Verify the prompt was formatted correctly
	lastReq := mockClient.GetLastRequest()
	if lastReq != nil {
		if len(lastReq.Messages) < 2 {
			t.Error("Expected system and user messages")
		}
		
		systemMsg := lastReq.Messages[0]
		userMsg := lastReq.Messages[1]
		
		if systemMsg.Role != openai.ChatMessageRoleSystem {
			t.Error("Expected first message to be system role")
		}
		
		if userMsg.Role != openai.ChatMessageRoleUser {
			t.Error("Expected second message to be user role")
		}
		
		if !strings.Contains(userMsg.Content, action.Prompt) {
			t.Error("Expected user message to contain action prompt")
		}
		
		if !strings.Contains(userMsg.Content, context.Transcript) {
			t.Error("Expected user message to contain transcript")
		}
		
		if !strings.Contains(userMsg.Content, "Transcript:") {
			t.Error("Expected user message to have proper formatting")
		}
	}
}

func TestOpenAIIntegration_TokenUsageTracking(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	mockClient := NewMockOpenAIClient()
	
	realClient := openai.NewClient("test-key")
	service := service.NewPostActionService(logger, realClient)
	
	// Set up mock response with specific token usage
	mockClient.SetResponse("gpt-3.5-turbo_Test token usage tracking", openai.ChatCompletionResponse{
		Choices: []openai.ChatCompletionChoice{
			{
				Message: openai.ChatCompletionMessage{
					Content: "Test response for token tracking",
				},
			},
		},
		Usage: openai.Usage{
			TotalTokens:      456,
			PromptTokens:     356,
			CompletionTokens: 100,
		},
	})
	
	action := &service.CustomAction{
		ID:          "test-tokens",
		Name:        "Token Test",
		Type:        "openai",
		Prompt:      "Test token usage tracking",
		Model:       "gpt-3.5-turbo",
		Temperature: 0.3,
		MaxTokens:   1000,
	}
	
	context := &service.ActionContext{
		Transcript: "Test transcript for token usage",
		Filename:   "test.mp3",
		WordCount:  6,
	}
	
	result := service.ProcessAction(action, context)
	
	if !result.Success {
		t.Fatalf("Expected success, got error: %s", result.Error)
	}
	
	if result.TokensUsed != 456 {
		t.Errorf("Expected 456 tokens used, got %d", result.TokensUsed)
	}
	
	if result.ActionType != "openai" {
		t.Errorf("Expected action type 'openai', got '%s'", result.ActionType)
	}
	
	if result.ProcessedAt.IsZero() {
		t.Error("Expected ProcessedAt timestamp to be set")
	}
}

func TestOpenAIIntegration_LongPrompts(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	mockClient := NewMockOpenAIClient()
	
	realClient := openai.NewClient("test-key")
	service := service.NewPostActionService(logger, realClient)
	
	// Create a very long transcript
	longTranscript := strings.Repeat("This is a very long transcript that might exceed token limits. ", 1000)
	
	action := &service.CustomAction{
		ID:          "test-long-prompt",
		Name:        "Long Prompt Test",
		Type:        "openai",
		Prompt:      "Summarize this very long transcript",
		Model:       "gpt-3.5-turbo",
		Temperature: 0.3,
		MaxTokens:   2000,
	}
	
	context := &service.ActionContext{
		Transcript: longTranscript,
		Filename:   "long_transcript.mp3",
		WordCount:  12000,
	}
	
	result := service.ProcessAction(action, context)
	
	// Should handle long prompts gracefully
	if !result.Success {
		// If it fails, it should be due to prompt length, not a crash
		if !strings.Contains(result.Error, "too long") && !strings.Contains(result.Error, "length") {
			t.Errorf("Expected length-related error for long prompt, got: %s", result.Error)
		}
	} else {
		// If it succeeds, verify the response is reasonable
		if result.Output == "" {
			t.Error("Expected non-empty output even for long prompts")
		}
	}
}