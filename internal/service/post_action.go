package service

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"strings"
	"text/template"
	"time"

	"github.com/sashabaranov/go-openai"
)

type PostActionService struct {
	templateEngine  *TemplateEngine
	openaiProcessor *OpenAIActionProcessor
	logger          *slog.Logger
}

type CustomAction struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Type        string     `json:"type"`        // "template" or "openai"
	Template    string     `json:"template"`    // For template actions
	Prompt      string     `json:"prompt"`      // For OpenAI actions
	Model       string     `json:"model"`       // OpenAI model (gpt-3.5-turbo, gpt-4, etc.)
	Temperature float32    `json:"temperature"` // OpenAI temperature setting
	MaxTokens   int        `json:"maxTokens"`   // OpenAI max tokens
	Variables   []string   `json:"variables"`
	Created     time.Time  `json:"created"`
	LastUsed    *time.Time `json:"lastUsed,omitempty"`
}

type ActionContext struct {
	Transcript    string
	Filename      string
	Date          string
	FileType      string
	Duration      string
	WordCount     int
	CharCount     int
	ProcessingTime string
}

type ActionResult struct {
	Success     bool      `json:"success"`
	Output      string    `json:"output"`
	Error       string    `json:"error,omitempty"`
	ActionName  string    `json:"actionName"`
	ActionType  string    `json:"actionType"`  // "template" or "openai"
	Model       string    `json:"model,omitempty"` // OpenAI model used
	TokensUsed  int       `json:"tokensUsed,omitempty"` // OpenAI tokens consumed
	ProcessedAt time.Time `json:"processedAt"`
}

type TemplateEngine struct {
	logger *slog.Logger
}

type OpenAIActionProcessor struct {
	client *openai.Client
	logger *slog.Logger
	config *OpenAIConfig
}

type OpenAIConfig struct {
	DefaultModel     string  `json:"defaultModel"`
	DefaultTemp      float32 `json:"defaultTemperature"`
	DefaultMaxTokens int     `json:"defaultMaxTokens"`
	RequestTimeout   int     `json:"requestTimeout"`
	MaxRetries       int     `json:"maxRetries"`
}

func NewPostActionService(logger *slog.Logger, openaiClient *openai.Client) *PostActionService {
	return &PostActionService{
		templateEngine:  NewTemplateEngine(logger),
		openaiProcessor: NewOpenAIActionProcessor(openaiClient, logger),
		logger:          logger,
	}
}

func NewTemplateEngine(logger *slog.Logger) *TemplateEngine {
	return &TemplateEngine{
		logger: logger,
	}
}

func NewOpenAIActionProcessor(client *openai.Client, logger *slog.Logger) *OpenAIActionProcessor {
	config := &OpenAIConfig{
		DefaultModel:     openai.GPT3Dot5Turbo,
		DefaultTemp:      0.7,
		DefaultMaxTokens: 2000,
		RequestTimeout:   60, // seconds
		MaxRetries:       3,
	}
	
	return &OpenAIActionProcessor{
		client: client,
		logger: logger,
		config: config,
	}
}

func (s *PostActionService) ProcessAction(action *CustomAction, context *ActionContext) *ActionResult {
	s.logger.Info("processing custom action",
		"action_id", action.ID,
		"action_name", action.Name,
		"action_type", action.Type,
		"filename", context.Filename,
	)

	result := &ActionResult{
		ActionName:  action.Name,
		ActionType:  action.Type,
		ProcessedAt: time.Now(),
	}

	// Determine action type and process accordingly
	switch action.Type {
	case "openai":
		return s.processOpenAIAction(action, context, result)
	case "template", "":
		return s.processTemplateAction(action, context, result)
	default:
		result.Error = fmt.Sprintf("unknown action type: %s", action.Type)
		s.logger.Error("unknown action type", "action_id", action.ID, "type", action.Type)
		return result
	}
}

func (s *PostActionService) processTemplateAction(action *CustomAction, context *ActionContext, result *ActionResult) *ActionResult {
	if action.Template == "" {
		result.Error = "action template is empty"
		s.logger.Warn("empty action template", "action_id", action.ID)
		return result
	}

	output, err := s.templateEngine.ProcessTemplate(action.Template, context)
	if err != nil {
		result.Error = fmt.Sprintf("template processing failed: %v", err)
		s.logger.Error("template processing failed",
			"action_id", action.ID,
			"error", err,
		)
		return result
	}

	result.Success = true
	result.Output = output

	s.logger.Info("template action processed successfully",
		"action_id", action.ID,
		"output_length", len(output),
	)

	return result
}

func (s *PostActionService) processOpenAIAction(action *CustomAction, actionCtx *ActionContext, result *ActionResult) *ActionResult {
	if action.Prompt == "" {
		result.Error = "action prompt is empty"
		s.logger.Warn("empty action prompt", "action_id", action.ID)
		return result
	}

	if s.openaiProcessor == nil {
		s.logger.Warn("OpenAI processor not available, falling back to template processing")
		// Fallback to template processing if OpenAI is not available
		action.Type = "template"
		action.Template = action.Prompt // Use prompt as template
		return s.processTemplateAction(action, actionCtx, result)
	}

	output, tokensUsed, err := s.openaiProcessor.ProcessPrompt(context.Background(), action, actionCtx)
	if err != nil {
		s.logger.Error("OpenAI processing failed",
			"action_id", action.ID,
			"error", err,
		)
		
		// Fallback to template processing on OpenAI failure
		s.logger.Info("falling back to template processing", "action_id", action.ID)
		action.Type = "template"
		action.Template = action.Prompt
		return s.processTemplateAction(action, actionCtx, result)
	}

	result.Success = true
	result.Output = output
	result.Model = action.Model
	result.TokensUsed = tokensUsed

	s.logger.Info("OpenAI action processed successfully",
		"action_id", action.ID,
		"model", action.Model,
		"tokens_used", tokensUsed,
		"output_length", len(output),
	)

	return result
}

func (te *TemplateEngine) ProcessTemplate(templateStr string, context *ActionContext) (string, error) {
	funcMap := template.FuncMap{
		"upper":       strings.ToUpper,
		"lower":       strings.ToLower,
		"title":       strings.Title,
		"trim":        strings.TrimSpace,
		"wordCount":   func(s string) int { return len(strings.Fields(s)) },
		"charCount":   func(s string) int { return len(s) },
		"truncate":    func(s string, length int) string { 
			if len(s) <= length { return s }
			return s[:length] + "..."
		},
		"summarize":   func(s string) string { return te.summarizeText(s) },
		"extractActions": func(s string) string { return te.extractActionItems(s) },
		"format":      func(s string) string { return te.formatText(s) },
		"timestamp":   func() string { return time.Now().Format("2006-01-02 15:04:05") },
		"date":        func() string { return time.Now().Format("2006-01-02") },
		"time":        func() string { return time.Now().Format("15:04:05") },
	}

	tmpl, err := template.New("action").Funcs(funcMap).Parse(templateStr)
	if err != nil {
		return "", fmt.Errorf("template parsing failed: %w", err)
	}

	var buf bytes.Buffer
	err = tmpl.Execute(&buf, context)
	if err != nil {
		return "", fmt.Errorf("template execution failed: %w", err)
	}

	return buf.String(), nil
}

// ProcessPrompt handles OpenAI API calls for custom prompts
func (p *OpenAIActionProcessor) ProcessPrompt(ctx context.Context, action *CustomAction, actionContext *ActionContext) (string, int, error) {
	// Use action-specific settings or fall back to defaults
	model := action.Model
	if model == "" {
		model = p.config.DefaultModel
	}
	
	temperature := action.Temperature
	if temperature == 0 {
		temperature = p.config.DefaultTemp
	}
	
	maxTokens := action.MaxTokens
	if maxTokens == 0 {
		maxTokens = p.config.DefaultMaxTokens
	}

	// Create the prompt with transcript context
	systemMessage := "You are a helpful assistant that processes transcribed text according to user instructions."
	userMessage := fmt.Sprintf("%s\n\nTranscript:\n%s\n\nPlease process this transcript according to the instructions above.", 
		action.Prompt, actionContext.Transcript)

	// Set timeout for the request
	requestCtx, cancel := context.WithTimeout(ctx, time.Duration(p.config.RequestTimeout)*time.Second)
	defer cancel()

	req := openai.ChatCompletionRequest{
		Model:       model,
		Temperature: temperature,
		MaxTokens:   maxTokens,
		Messages: []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: systemMessage,
			},
			{
				Role:    openai.ChatMessageRoleUser,
				Content: userMessage,
			},
		},
	}

	p.logger.Info("sending OpenAI request",
		"model", model,
		"temperature", temperature,
		"max_tokens", maxTokens,
		"prompt_length", len(action.Prompt),
		"transcript_length", len(actionContext.Transcript),
	)

	// Attempt request with retries
	var resp openai.ChatCompletionResponse
	var err error
	
	for attempt := 1; attempt <= p.config.MaxRetries; attempt++ {
		resp, err = p.client.CreateChatCompletion(requestCtx, req)
		
		if err == nil {
			break
		}
		
		p.logger.Warn("OpenAI request failed",
			"attempt", attempt,
			"max_retries", p.config.MaxRetries,
			"error", err,
		)
		
		if attempt < p.config.MaxRetries {
			// Exponential backoff
			backoffDuration := time.Duration(attempt*attempt) * time.Second
			p.logger.Info("retrying OpenAI request", "backoff_seconds", backoffDuration.Seconds())
			
			select {
			case <-time.After(backoffDuration):
				continue
			case <-requestCtx.Done():
				return "", 0, requestCtx.Err()
			}
		}
	}
	
	if err != nil {
		return "", 0, p.formatOpenAIError(err)
	}

	if len(resp.Choices) == 0 {
		return "", resp.Usage.TotalTokens, fmt.Errorf("no response choices received from OpenAI")
	}

	output := strings.TrimSpace(resp.Choices[0].Message.Content)
	
	p.logger.Info("OpenAI request completed successfully",
		"model", model,
		"tokens_used", resp.Usage.TotalTokens,
		"prompt_tokens", resp.Usage.PromptTokens,
		"completion_tokens", resp.Usage.CompletionTokens,
		"output_length", len(output),
	)

	return output, resp.Usage.TotalTokens, nil
}

// formatOpenAIError provides user-friendly error messages for OpenAI failures
func (p *OpenAIActionProcessor) formatOpenAIError(err error) error {
	errStr := err.Error()
	
	if strings.Contains(errStr, "401") || strings.Contains(errStr, "unauthorized") || strings.Contains(errStr, "invalid_api_key") {
		return fmt.Errorf("API key invalid or expired. Please check your OpenAI API configuration")
	}
	
	if strings.Contains(errStr, "429") || strings.Contains(errStr, "rate_limit") || strings.Contains(errStr, "quota") {
		return fmt.Errorf("OpenAI API rate limit exceeded or quota reached. Please try again later")
	}
	
	if strings.Contains(errStr, "400") || strings.Contains(errStr, "invalid_request") {
		return fmt.Errorf("Invalid request to OpenAI API. The prompt may be too long or contain unsupported content")
	}
	
	if strings.Contains(errStr, "500") || strings.Contains(errStr, "internal_server_error") {
		return fmt.Errorf("OpenAI service temporarily unavailable. Please try again in a few minutes")
	}
	
	if strings.Contains(errStr, "503") || strings.Contains(errStr, "service_unavailable") {
		return fmt.Errorf("OpenAI service is currently overloaded. Please try again later")
	}
	
	if strings.Contains(errStr, "timeout") || strings.Contains(errStr, "context deadline exceeded") {
		return fmt.Errorf("OpenAI request timed out. Please try again with a shorter prompt or transcript")
	}
	
	return fmt.Errorf("OpenAI processing failed: %s", errStr)
}

func (te *TemplateEngine) summarizeText(text string) string {
	lines := strings.Split(text, "\n")
	var summary []string
	
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		
		if len(line) > 100 {
			summary = append(summary, "- "+line[:97]+"...")
		} else {
			summary = append(summary, "- "+line)
		}
		
		if len(summary) >= 5 {
			break
		}
	}
	
	if len(summary) == 0 {
		words := strings.Fields(text)
		if len(words) > 20 {
			summary = append(summary, "- "+strings.Join(words[:20], " ")+"...")
		} else {
			summary = append(summary, "- "+text)
		}
	}
	
	return strings.Join(summary, "\n")
}

func (te *TemplateEngine) extractActionItems(text string) string {
	lines := strings.Split(text, "\n")
	var actions []string
	
	actionKeywords := []string{"todo", "action", "task", "follow up", "next step", "need to", "should", "must", "will"}
	
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		
		lowerLine := strings.ToLower(line)
		for _, keyword := range actionKeywords {
			if strings.Contains(lowerLine, keyword) {
				actions = append(actions, "- [ ] "+line)
				break
			}
		}
	}
	
	if len(actions) == 0 {
		return "No specific action items identified in the transcript."
	}
	
	return strings.Join(actions, "\n")
}

func (te *TemplateEngine) formatText(text string) string {
	lines := strings.Split(text, "\n")
	var formatted []string
	
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			formatted = append(formatted, "")
			continue
		}
		
		if len(line) > 80 {
			words := strings.Fields(line)
			var currentLine strings.Builder
			
			for _, word := range words {
				if currentLine.Len()+len(word)+1 > 80 {
					formatted = append(formatted, currentLine.String())
					currentLine.Reset()
				}
				
				if currentLine.Len() > 0 {
					currentLine.WriteString(" ")
				}
				currentLine.WriteString(word)
			}
			
			if currentLine.Len() > 0 {
				formatted = append(formatted, currentLine.String())
			}
		} else {
			formatted = append(formatted, line)
		}
	}
	
	return strings.Join(formatted, "\n")
}

func (s *PostActionService) ValidateAction(action *CustomAction) error {
	if action.Name == "" {
		return fmt.Errorf("action name is required")
	}
	
	if len(action.Name) > 100 {
		return fmt.Errorf("action name too long (max 100 characters)")
	}
	
	if len(action.Description) > 500 {
		return fmt.Errorf("action description too long (max 500 characters)")
	}
	
	// Validate based on action type
	switch action.Type {
	case "template", "":
		if action.Template == "" {
			return fmt.Errorf("action template is required")
		}
		
		if len(action.Template) > 10000 {
			return fmt.Errorf("action template too long (max 10000 characters)")
		}
		
		if err := s.validateTemplate(action.Template); err != nil {
			return fmt.Errorf("invalid template: %w", err)
		}
		
	case "openai":
		if action.Prompt == "" {
			return fmt.Errorf("action prompt is required")
		}
		
		if len(action.Prompt) > 5000 {
			return fmt.Errorf("action prompt too long (max 5000 characters)")
		}
		
		if action.Model != "" && !s.isValidOpenAIModel(action.Model) {
			return fmt.Errorf("invalid OpenAI model: %s", action.Model)
		}
		
		if action.Temperature < 0 || action.Temperature > 2 {
			return fmt.Errorf("temperature must be between 0 and 2")
		}
		
		if action.MaxTokens < 0 || action.MaxTokens > 4000 {
			return fmt.Errorf("max tokens must be between 0 and 4000")
		}
		
	default:
		return fmt.Errorf("invalid action type: %s", action.Type)
	}
	
	return nil
}

func (s *PostActionService) isValidOpenAIModel(model string) bool {
	validModels := []string{
		openai.GPT3Dot5Turbo,
		openai.GPT3Dot5Turbo16K,
		openai.GPT4,
		openai.GPT4TurboPreview,
		"gpt-4-turbo",
		"gpt-4o",
		"gpt-4o-mini",
	}
	
	for _, validModel := range validModels {
		if model == validModel {
			return true
		}
	}
	
	return false
}

func (s *PostActionService) validateTemplate(templateStr string) error {
	funcMap := template.FuncMap{
		"upper": strings.ToUpper,
		"lower": strings.ToLower,
		"title": strings.Title,
		"trim":  strings.TrimSpace,
		"wordCount": func(s string) int { return len(strings.Fields(s)) },
		"charCount": func(s string) int { return len(s) },
		"truncate": func(s string, length int) string { 
			if len(s) <= length { return s }
			return s[:length] + "..."
		},
		"summarize": func(s string) string { return s },
		"extractActions": func(s string) string { return s },
		"format": func(s string) string { return s },
		"timestamp": func() string { return time.Now().Format("2006-01-02 15:04:05") },
		"date": func() string { return time.Now().Format("2006-01-02") },
		"time": func() string { return time.Now().Format("15:04:05") },
	}
	
	_, err := template.New("validation").Funcs(funcMap).Parse(templateStr)
	return err
}

func (s *PostActionService) GetAvailableVariables() []string {
	return []string{
		"Transcript",
		"Filename", 
		"Date",
		"FileType",
		"Duration", 
		"WordCount",
		"CharCount",
		"ProcessingTime",
	}
}

func (s *PostActionService) GetAvailableFunctions() map[string]string {
	return map[string]string{
		"upper":          "Convert text to uppercase",
		"lower":          "Convert text to lowercase", 
		"title":          "Convert text to title case",
		"trim":           "Remove leading and trailing whitespace",
		"wordCount":      "Count words in text",
		"charCount":      "Count characters in text",
		"truncate":       "Truncate text to specified length",
		"summarize":      "Create bullet-point summary",
		"extractActions": "Extract action items and tasks",
		"format":         "Format text with proper line wrapping",
		"timestamp":      "Current timestamp",
		"date":           "Current date",
		"time":           "Current time",
	}
}

func (s *PostActionService) GetPredefinedActions() []CustomAction {
	return []CustomAction{
		{
			ID:          "openai-meeting-summary",
			Name:        "Smart Meeting Summary",
			Description: "AI-powered comprehensive meeting summary with key decisions and action items",
			Type:        "openai",
			Prompt:      "Analyze this meeting transcript and create a comprehensive summary with the following sections:\n\n1. **Key Decisions Made**\n2. **Action Items** (with responsible parties if mentioned)\n3. **Important Discussion Points**\n4. **Next Steps**\n\nFormat the output with clear headings and bullet points for easy reading.",
			Model:       openai.GPT3Dot5Turbo,
			Temperature: 0.3,
			MaxTokens:   1500,
		},
		{
			ID:          "openai-action-items",
			Name:        "Action Items Extractor",
			Description: "Extract and organize all action items, tasks, and assignments",
			Type:        "openai",
			Prompt:      "Extract all action items, tasks, deadlines, and assignments from this transcript. For each item, identify:\n\n- The specific task or action required\n- Who is responsible (if mentioned)\n- Any deadlines or timeframes mentioned\n- Priority level (if indicated)\n\nFormat as a prioritized task list with checkboxes.",
			Model:       openai.GPT3Dot5Turbo,
			Temperature: 0.2,
			MaxTokens:   1000,
		},
		{
			ID:          "openai-executive-brief",
			Name:        "Executive Brief",
			Description: "Concise executive summary for leadership review",
			Type:        "openai",
			Prompt:      "Create a concise executive summary of this transcript suitable for leadership review. Focus on:\n\n- Strategic decisions and their business impact\n- Financial implications or budget discussions\n- Risk factors or opportunities identified\n- Key performance metrics or outcomes\n- Critical next steps requiring leadership attention\n\nKeep it under 300 words and use business-appropriate language.",
			Model:       openai.GPT4,
			Temperature: 0.2,
			MaxTokens:   800,
		},
		{
			ID:          "openai-key-insights",
			Name:        "Key Insights",
			Description: "Identify important insights, conclusions, and strategic points",
			Type:        "openai",
			Prompt:      "Identify and extract the most important insights, conclusions, and strategic points from this transcript. Focus on:\n\n- Novel ideas or innovative solutions discussed\n- Important data points or metrics mentioned\n- Strategic implications for the business\n- Risk factors or challenges identified\n- Opportunities for improvement or growth\n\nPresent as numbered insights with brief explanations.",
			Model:       openai.GPT3Dot5Turbo,
			Temperature: 0.4,
			MaxTokens:   1200,
		},
		{
			ID:          "openai-qa-format",
			Name:        "Q&A Generator",
			Description: "Convert transcript into structured question and answer format",
			Type:        "openai",
			Prompt:      "Convert this transcript into a comprehensive Q&A format that captures all important questions asked and answers provided. Include:\n\n- All direct questions and their answers\n- Implied questions from the discussion\n- Key topics addressed even if not explicitly asked\n\nFormat with clear Q: and A: markers for easy reading.",
			Model:       openai.GPT3Dot5Turbo,
			Temperature: 0.3,
			MaxTokens:   2000,
		},
	}
}

func (s *PostActionService) GetAvailableModels() []string {
	return []string{
		openai.GPT3Dot5Turbo,
		openai.GPT3Dot5Turbo16K,
		openai.GPT4,
		openai.GPT4TurboPreview,
		"gpt-4-turbo",
		"gpt-4o",
		"gpt-4o-mini",
	}
}