package service

import (
	"bytes"
	"fmt"
	"log/slog"
	"strings"
	"text/template"
	"time"
)

type PostActionService struct {
	templateEngine *TemplateEngine
	logger         *slog.Logger
}

type CustomAction struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Template    string     `json:"template"`
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
	Success    bool   `json:"success"`
	Output     string `json:"output"`
	Error      string `json:"error,omitempty"`
	ActionName string `json:"actionName"`
	ProcessedAt time.Time `json:"processedAt"`
}

type TemplateEngine struct {
	logger *slog.Logger
}

func NewPostActionService(logger *slog.Logger) *PostActionService {
	return &PostActionService{
		templateEngine: NewTemplateEngine(logger),
		logger:         logger,
	}
}

func NewTemplateEngine(logger *slog.Logger) *TemplateEngine {
	return &TemplateEngine{
		logger: logger,
	}
}

func (s *PostActionService) ProcessAction(action *CustomAction, context *ActionContext) *ActionResult {
	s.logger.Info("processing custom action",
		"action_id", action.ID,
		"action_name", action.Name,
		"filename", context.Filename,
	)

	result := &ActionResult{
		ActionName:  action.Name,
		ProcessedAt: time.Now(),
	}

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

	s.logger.Info("custom action processed successfully",
		"action_id", action.ID,
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
	
	if action.Template == "" {
		return fmt.Errorf("action template is required")
	}
	
	if len(action.Name) > 100 {
		return fmt.Errorf("action name too long (max 100 characters)")
	}
	
	if len(action.Template) > 10000 {
		return fmt.Errorf("action template too long (max 10000 characters)")
	}
	
	if len(action.Description) > 500 {
		return fmt.Errorf("action description too long (max 500 characters)")
	}
	
	if err := s.validateTemplate(action.Template); err != nil {
		return fmt.Errorf("invalid template: %w", err)
	}
	
	return nil
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