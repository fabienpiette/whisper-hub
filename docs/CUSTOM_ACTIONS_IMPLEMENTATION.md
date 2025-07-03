# Custom Post-Transcription Actions Implementation Plan

## Overview
Enable users to create, save, and execute custom post-transcription actions powered by OpenAI that can intelligently process and transform the transcribed text. After transcription, the system makes additional OpenAI API calls using custom prompts with the transcript as input to generate summaries, action items, insights, and other processed outputs.

## Architecture Design

### 1. Custom Action System Components

**Frontend Components:**
- **Action Creator Modal**: UI for defining custom actions with templates and variables
- **Action Selector**: Dropdown in upload form to choose from saved actions
- **Action Manager**: Settings panel to manage saved custom actions
- **Action Results**: Display processed output alongside original transcript

**Backend Components:**
- **PostActionService**: Core service for executing custom actions with OpenAI integration
- **OpenAIActionProcessor**: Handles OpenAI API calls for intelligent post-processing
- **ActionTemplateEngine**: Process templates with transcript data (fallback option)
- **ActionStorage**: Persist user-defined actions (localStorage encrypted)

### 2. Custom Action Structure
```typescript
interface CustomAction {
  id: string;
  name: string;
  description: string;
  type: string;          // "template" or "openai"
  template?: string;     // Template with variables (for template actions)
  prompt?: string;       // OpenAI prompt (for OpenAI actions)
  model?: string;        // OpenAI model (gpt-3.5-turbo, gpt-4, etc.)
  temperature?: number;  // OpenAI temperature setting
  maxTokens?: number;    // OpenAI max tokens
  variables: string[];   // List of available variables
  created: Date;
  lastUsed?: Date;
}
```

### 3. Action Types and Processing

**Template Actions** (Client-side processing):
- Simple variable substitution using templates
- Available variables: `{{transcript}}`, `{{filename}}`, `{{date}}`, `{{fileType}}`, `{{duration}}`, `{{wordCount}}`
- Built-in functions: `summarize`, `extractActions`, `format`, `upper`, `lower`, etc.

**OpenAI Actions** (Server-side AI processing):
- Custom prompts sent to OpenAI ChatCompletion API
- Transcript injected into prompt as context
- Configurable models (GPT-3.5-turbo, GPT-4, etc.)
- Advanced AI capabilities: summarization, analysis, extraction, transformation

### 4. Implementation Steps

**Phase 1: Backend OpenAI Integration**
- Enhance PostActionService with OpenAI client integration
- Add OpenAI action processing alongside template processing
- Implement predefined OpenAI actions (meeting summary, action items, etc.)
- Add error handling and fallback mechanisms

**Phase 2: Configuration & Settings**
- Add OpenAI post-action configuration options
- Support for different models and parameters
- Rate limiting and cost controls
- API usage monitoring

**Phase 3: Frontend Integration**
- Update action creation UI for OpenAI actions
- Add action type selector (Template vs OpenAI)
- Model selection and parameter configuration
- Enhanced result display for AI-processed content

**Phase 4: Advanced Features**
- Processing status indicators
- Batch processing capabilities
- Action result comparison
- Export functionality for AI-processed content

### 5. Example Custom Actions

**Template Actions** (Simple processing):
- **Meeting Summary**: "## Meeting Summary\nDate: {{date}}\nFile: {{filename}}\n\nKey Points:\n{{transcript | summarize}}"
- **Action Items**: "# Action Items from {{filename}}\n{{transcript | extractActions}}"
- **Knowledge Base**: "---\ntitle: {{filename}}\ndate: {{date}}\n---\n\n{{transcript | format}}"

**OpenAI Actions** (AI-powered processing):
- **Smart Meeting Summary**: "Analyze this meeting transcript and create a comprehensive summary with key decisions, action items, and next steps. Include participant insights and meeting outcomes."
- **Executive Brief**: "Create a concise executive summary of this transcript suitable for leadership review. Focus on strategic decisions, financial impacts, and business implications."
- **Action Items Extractor**: "Extract all action items, tasks, deadlines, and assignments from this transcript. Format as a prioritized task list with responsible parties and due dates."
- **Key Insights**: "Identify the most important insights, conclusions, and strategic points from this transcript. Highlight any risks, opportunities, or critical information."
- **Q&A Generator**: "Convert this transcript into a comprehensive Q&A format that captures all important questions asked and answers provided during the discussion."

### 6. File Modifications
- `web/templates/index.html`: Add action selector UI
- `web/templates/result.html`: Add action results display
- `web/static/js/app.js`: Extend with action management
- `internal/handler/transcribe.go`: Process action parameter
- `internal/service/post_action.go`: New action processing service
- `internal/constants/constants.go`: Add action-related constants

### 7. Technical Implementation Details

#### Backend Service Structure
```go
type PostActionService struct {
    templateEngine     *TemplateEngine
    openaiProcessor    *OpenAIActionProcessor
    logger             *slog.Logger
}

type OpenAIActionProcessor struct {
    client *openai.Client
    logger *slog.Logger
    config *OpenAIConfig
}

type CustomAction struct {
    ID          string     `json:"id"`
    Name        string     `json:"name"`
    Description string     `json:"description"`
    Type        string     `json:"type"`        // "template" or "openai"
    Template    string     `json:"template"`    // For template actions
    Prompt      string     `json:"prompt"`      // For OpenAI actions
    Model       string     `json:"model"`       // OpenAI model
    Temperature float32    `json:"temperature"` // OpenAI temperature
    MaxTokens   int        `json:"maxTokens"`   // OpenAI max tokens
    Variables   []string   `json:"variables"`
    Created     time.Time  `json:"created"`
    LastUsed    *time.Time `json:"lastUsed,omitempty"`
}

type OpenAIConfig struct {
    DefaultModel     string  `json:"defaultModel"`
    DefaultTemp      float32 `json:"defaultTemperature"`
    DefaultMaxTokens int     `json:"defaultMaxTokens"`
    RequestTimeout   int     `json:"requestTimeout"`
    MaxRetries       int     `json:"maxRetries"`
}
```

#### Processing Methods

**Template Processing** (Existing):
- Variable substitution with Go text/template
- Safe template execution with timeouts
- Input validation and sanitization
- Built-in functions for text manipulation

**OpenAI Processing** (New):
- ChatCompletion API integration with custom prompts
- Transcript injection into prompt context
- Configurable model parameters (temperature, max tokens)
- Retry logic with exponential backoff
- Fallback to template processing on API failures

#### Frontend Storage
- Encrypted localStorage using existing security utilities
- CRUD operations for custom actions
- Import/export functionality for sharing actions
- Validation before saving

### 8. Security Considerations
- Template validation to prevent code injection
- Input sanitization for all user-provided content
- Rate limiting for action processing
- Encrypted storage of custom actions
- Safe variable substitution without code execution

### 9. User Experience Flow

#### Enhanced Workflow
1. **Action Creation**: User creates custom action choosing between Template or OpenAI type
2. **Configuration**: For OpenAI actions, user configures model, prompt, and parameters
3. **Upload & Selection**: During file upload, user selects desired action from dropdown
4. **Transcription**: Standard Whisper API transcription process
5. **Post-Processing**: 
   - Template actions: Client-side template processing
   - OpenAI actions: Server-side API call with custom prompt + transcript
6. **Results Display**: Show original transcript alongside AI-processed output
7. **Export & Save**: User can save, export, or reprocess with different actions

#### OpenAI Processing Flow
```
Transcript Text → Custom Prompt Template → OpenAI API Call → AI-Processed Output
```

**Example Prompt Structure:**
```
System: You are a helpful assistant that processes meeting transcripts.
User: [Custom user prompt]

Transcript:
[Full transcribed text]

Please process this transcript according to the instructions above.
```

This approach provides an intelligent, AI-powered system for post-processing transcriptions while maintaining backward compatibility and robust error handling.