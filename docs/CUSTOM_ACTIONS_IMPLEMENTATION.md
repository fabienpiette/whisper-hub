# Custom Post-Transcription Actions Implementation Plan

## Overview
Enable users to create, save, and execute custom post-transcription actions that can transform or process the transcribed text according to their specific needs (meeting summaries, knowledge base entries, action items, etc.).

## Architecture Design

### 1. Custom Action System Components

**Frontend Components:**
- **Action Creator Modal**: UI for defining custom actions with templates and variables
- **Action Selector**: Dropdown in upload form to choose from saved actions
- **Action Manager**: Settings panel to manage saved custom actions
- **Action Results**: Display processed output alongside original transcript

**Backend Components:**
- **PostActionService**: Core service for executing custom actions
- **ActionTemplateEngine**: Process templates with transcript data
- **ActionStorage**: Persist user-defined actions (localStorage encrypted)

### 2. Custom Action Structure
```typescript
interface CustomAction {
  id: string;
  name: string;
  description: string;
  template: string;      // Template with variables like {{transcript}}, {{filename}}
  variables: string[];   // List of available variables
  created: Date;
  lastUsed?: Date;
}
```

### 3. Template Variables System
Available variables for custom actions:
- `{{transcript}}` - Full transcribed text
- `{{filename}}` - Original file name
- `{{date}}` - Current date/time
- `{{fileType}}` - audio/video
- `{{duration}}` - File duration
- `{{wordCount}}` - Number of words
- `{{customField}}` - User-defined fields

### 4. Implementation Steps

**Phase 1: UI Components**
- Add "Create Custom Action" button in settings
- Modal for action creation with template editor
- Action selector dropdown in upload form
- Preview functionality for templates

**Phase 2: Storage & Management**
- Extend HistoryStorage class for action persistence
- Encrypted localStorage for custom actions
- Import/export custom actions
- Action validation and error handling

**Phase 3: Template Engine**
- Variable substitution system
- Support for conditional logic
- Formatting helpers (date, number, text)
- Real-time template preview

**Phase 4: Integration**
- Extend transcription workflow to process actions
- Action results display in results template
- History tracking for action usage
- Performance optimization

### 5. Example Custom Actions
- **Meeting Summary**: "## Meeting Summary\nDate: {{date}}\nFile: {{filename}}\n\nKey Points:\n{{transcript | summarize}}"
- **Action Items**: "# Action Items from {{filename}}\n{{transcript | extractActions}}"
- **Knowledge Base**: "---\ntitle: {{filename}}\ndate: {{date}}\n---\n\n{{transcript | format}}"

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
    templateEngine *TemplateEngine
    logger         *slog.Logger
}

type CustomAction struct {
    ID          string    `json:"id"`
    Name        string    `json:"name"`
    Description string    `json:"description"`
    Template    string    `json:"template"`
    Variables   []string  `json:"variables"`
    Created     time.Time `json:"created"`
    LastUsed    *time.Time `json:"lastUsed,omitempty"`
}
```

#### Template Processing
- Variable substitution with Go text/template
- Safe template execution with timeouts
- Input validation and sanitization
- Error handling for malformed templates

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
1. User creates custom action in settings with template
2. During upload, user selects action from dropdown
3. After transcription, template is processed with transcript data
4. Results show both original transcript and processed output
5. User can copy, download, or save processed output

This approach provides a flexible, user-controlled system for post-processing transcriptions while maintaining the existing clean architecture and security standards.