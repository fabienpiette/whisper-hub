# 🏗️ Whisper Hub History Architecture Specification

## Executive Summary

**Objective**: Add transcription history functionality with privacy-first, client-side storage design.

**Core Principle**: Zero server-side data persistence - all history stored in browser localStorage with advanced privacy controls and user data sovereignty.

**Architecture Pattern**: Hybrid client-server with smart caching, maintaining Clean Architecture principles.

---

## 1. Data Model & Storage Schema

### Client-Side Storage Schema

```typescript
interface TranscriptionHistory {
  id: string;                    // UUID v4
  timestamp: number;             // Unix timestamp
  filename: string;              // Original filename
  fileType: 'audio' | 'video';  // File category
  fileSize: number;              // Bytes
  duration?: number;             // Audio duration (seconds)
  transcript: string;            // Full transcript text
  characterCount: number;        // Transcript length
  processingTime: number;        // Milliseconds
  tags?: string[];              // User-defined tags
  starred: boolean;             // User favorite flag
  version: number;              // Schema version for migrations
}

interface HistoryMetadata {
  version: string;              // App version when created
  totalEntries: number;         // Entry count
  storageSize: number;          // Approximate bytes used
  lastCleanup: number;          // Last auto-cleanup timestamp
  settings: HistorySettings;    // User preferences
}

interface HistorySettings {
  maxEntries: number;           // Auto-cleanup threshold (default: 100)
  retentionDays: number;        // Auto-delete after days (default: 30)
  autoCleanup: boolean;         // Enable auto-cleanup (default: true)
  exportFormat: 'json' | 'csv' | 'txt';  // Default export format
}
```

### Storage Keys Structure

```typescript
const STORAGE_KEYS = {
  HISTORY_ENTRIES: 'whisper_hub_history',           // TranscriptionHistory[]
  HISTORY_METADATA: 'whisper_hub_history_meta',     // HistoryMetadata
  HISTORY_SETTINGS: 'whisper_hub_history_settings', // HistorySettings
  STORAGE_VERSION: 'whisper_hub_storage_version'    // string
};
```

---

## 2. Privacy Framework & Compliance

### Privacy Constraints

**Principle**: "Data never leaves the user's device"

#### Server-Side Constraints
- ❌ **NO database storage** of transcripts or history
- ❌ **NO logging** of transcript content
- ❌ **NO analytics** on transcript data
- ❌ **NO backup/sync** services
- ✅ **Metadata-only** for operational metrics (file count, processing time)

#### Client-Side Controls
- ✅ **User-controlled retention** (default 30 days, configurable)
- ✅ **Explicit consent** for history storage on first use
- ✅ **One-click data deletion** for all history
- ✅ **Export capabilities** for data portability
- ✅ **Incognito mode** option (no history saving)

#### Compliance Features
- ✅ **GDPR Article 20**: Data portability (export functionality)
- ✅ **GDPR Article 17**: Right to deletion (clear history)
- ✅ **CCPA Section 1798.105**: Right to delete personal information
- ✅ **Transparent data usage** in UI and documentation

### Security Measures

```typescript
interface SecurityConfig {
  storageEncryption: boolean;     // Encrypt localStorage data
  sessionTimeout: number;        // Auto-clear sensitive data (minutes)
  maxStorageSize: number;        // Prevent localStorage exhaustion (MB)
  integrityChecking: boolean;    // Verify data integrity on load
}
```

---

## 3. Client-Side Architecture

### Frontend Component Architecture

**File Structure:**
```
web/static/js/
├── history/
│   ├── history-manager.js     # Core history management
│   ├── history-ui.js          # UI components and interactions
│   ├── history-storage.js     # localStorage abstraction
│   ├── history-privacy.js     # Privacy controls and consent
│   └── history-export.js      # Data export functionality
└── main.js                    # Integration with existing code
```

### Core Classes

#### HistoryManager
```javascript
class HistoryManager {
  constructor(config) {
    this.storage = new HistoryStorage();
    this.ui = new HistoryUI();
    this.privacy = new HistoryPrivacy();
    this.config = config;
  }

  async addTranscription(data) { }      // Store new transcription
  async getHistory(filters) { }        // Retrieve with filtering/pagination
  async deleteEntry(id) { }            // Remove single entry
  async clearAll() { }                 // Nuclear option
  async exportData(format) { }         // Data portability
  async getStats() { }                 // Usage statistics
}
```

#### HistoryStorage
```javascript
class HistoryStorage {
  async save(entry) { }                // Save with integrity checking
  async load(filters) { }              // Load with error handling
  async delete(id) { }                 // Safe deletion
  async cleanup() { }                  // Auto-cleanup expired entries
  async getStorageInfo() { }           // Storage usage statistics
  async migrate(fromVersion) { }       // Schema migrations
}
```

#### HistoryUI
```javascript
class HistoryUI {
  renderHistorySection() { }           // Main history UI
  renderHistoryItem(entry) { }         // Individual history entries
  renderSettings() { }                 // Privacy and retention settings
  showPrivacyNotice() { }             // First-time consent UI
  updateStats() { }                    // Usage statistics display
}
```

### State Management Pattern

```javascript
// Event-driven architecture matching existing HTMX patterns
class HistoryEventBus {
  events = {
    'history:added': [],
    'history:deleted': [],  
    'history:cleared': [],
    'history:settings-changed': [],
    'history:storage-warning': []
  };

  emit(event, data) { }
  on(event, callback) { }
  off(event, callback) { }
}
```

---

## 4. Backend Modifications

### Minimal Server Changes

**Philosophy**: History is client-side only; server provides metadata enhancement without data persistence.

#### Response Enhancement

**Location**: `/internal/response/response.go`

```go
// Enhanced transcription response with history metadata
type TranscriptionResponse struct {
    Success     bool              `json:"success"`
    Transcript  string            `json:"transcript"`
    Filename    string            `json:"filename"`
    CharCount   int               `json:"char_count"`
    ProcessTime time.Duration     `json:"process_time"`
    // History metadata (no content stored server-side)
    HistoryMeta HistoryMetadata   `json:"history_meta"`
}

type HistoryMetadata struct {
    ID          string    `json:"id"`           // Client-generated UUID
    Timestamp   time.Time `json:"timestamp"`    // Server timestamp
    FileType    string    `json:"file_type"`    // audio/video
    FileSize    int64     `json:"file_size"`    // bytes
    Duration    *float64  `json:"duration"`     // seconds (if available)
}
```

#### New Endpoint: History Assets

**Location**: `/internal/handler/history.go` (new)

```go
// Serves history-related static assets and templates
func (h *TranscribeHandler) HandleHistoryAssets(w http.ResponseWriter, r *http.Request) {
    // Serve history JavaScript modules
    // Serve history CSS
    // Serve history HTML templates (for HTMX fragments)
}
```

#### Configuration Updates

**Location**: `/internal/config/config.go`

```go
type Config struct {
    // Existing fields...
    
    // History feature flags
    HistoryEnabled      bool `env:"HISTORY_ENABLED" default:"true"`
    HistoryJSPath       string `env:"HISTORY_JS_PATH" default:"/static/js/history/"`
    HistoryMaxClientMB  int    `env:"HISTORY_MAX_CLIENT_MB" default:"50"`
}
```

#### Metrics Enhancement

**Location**: `/internal/middleware/metrics.go`

```go
// Add history-related metrics (privacy-safe)
var (
    historyFeatureUsage = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "whisper_hub_history_feature_usage",
            Help: "History feature usage (no content)",
        },
        []string{"action"}, // "enabled", "disabled", "cleared", "exported"
    )
)
```

### API Endpoints

```go
// No new API endpoints needed - pure client-side storage
// Only enhancement to existing /transcribe response format
```

---

## 5. User Interface & Experience Design

### Primary UI Components

#### 1. History Toggle & Access
```html
<!-- Added to main transcription interface -->
<div class="history-controls">
    <button id="toggle-history" class="btn btn-secondary">
        📚 Show History (<span id="history-count">0</span>)
    </button>
    <button id="history-settings" class="btn btn-tertiary">⚙️</button>
</div>
```

#### 2. History Panel (Collapsible)
```html
<div id="history-panel" class="history-section collapsed">
    <div class="history-header">
        <h3>📚 Transcription History</h3>
        <div class="history-actions">
            <input type="search" id="history-search" placeholder="Search transcripts...">
            <select id="history-filter">
                <option value="all">All Files</option>
                <option value="audio">Audio Only</option>
                <option value="video">Video Only</option>
                <option value="starred">Starred</option>
            </select>
            <button id="export-history" class="btn btn-small">📤 Export</button>
        </div>
    </div>
    
    <div id="history-list" class="history-items">
        <!-- Dynamically populated -->
    </div>
    
    <div class="history-pagination">
        <button id="load-more" class="btn btn-secondary">Load More</button>
        <span class="history-stats">Showing 10 of 45 transcriptions</span>
    </div>
</div>
```

#### 3. History Item Template
```html
<div class="history-item" data-id="{id}">
    <div class="history-item-header">
        <div class="history-item-info">
            <h4 class="filename">{filename}</h4>
            <div class="metadata">
                <span class="timestamp">{relative_time}</span>
                <span class="file-type badge">{type}</span>
                <span class="size">{human_size}</span>
            </div>
        </div>
        <div class="history-item-actions">
            <button class="star-btn {starred_class}" title="Star">⭐</button>
            <button class="copy-btn" title="Copy Transcript">📋</button>
            <button class="download-btn" title="Download">💾</button>
            <button class="delete-btn" title="Delete">🗑️</button>
        </div>
    </div>
    
    <div class="transcript-preview">
        <p class="transcript-text">{truncated_transcript}</p>
        <button class="expand-btn">Show Full Transcript</button>
    </div>
    
    <div class="tags-section">
        <div class="tags">{user_tags}</div>
        <button class="add-tag-btn">+ Tag</button>
    </div>
</div>
```

### User Experience Flows

#### First-Time User (Privacy Consent)
```
1. User completes first transcription
2. Show privacy notice modal:
   "💾 Save this transcription to your history?"
   [Privacy details] [Yes, Enable History] [No, Don't Save]
3. If enabled: Save transcription + show history panel
4. If disabled: Continue without history (can enable later)
```

#### Regular Usage Flow
```
1. Complete transcription → Auto-save to history (if enabled)
2. Show "✅ Saved to history" notification
3. History panel updates with new entry
4. User can immediately interact (star, tag, copy, download)
```

#### History Management Flow
```
1. Click "📚 Show History" → Expand history panel
2. Search/filter transcriptions
3. Click history item → Expand full transcript
4. Right-click item → Context menu (copy, download, delete, star)
5. Bulk actions: Select multiple → Bulk delete/export
```

### Privacy-First UX Patterns

#### Clear Data Ownership
- 🏠 **"Your data stays on your device"** prominent messaging
- 🔒 **Visual indicators** for local-only storage
- 📊 **Storage usage indicator**: "Using 2.3MB of browser storage"

#### Transparent Controls
- 🗑️ **One-click clear all**: "Delete All History" with confirmation
- 📤 **Export before delete**: "Export your data first?"
- ⚙️ **Granular settings**: Retention period, auto-cleanup, storage limits

#### Incognito Mode
```html
<label class="privacy-toggle">
    <input type="checkbox" id="incognito-mode">
    🕶️ Incognito Mode (Don't save transcriptions)
</label>
```

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Sprint 1-2)
**Goal**: Core storage and privacy framework

#### Backend Developer Tasks
- [ ] Enhance `/internal/response/response.go` with history metadata
- [ ] Add history configuration to `/internal/config/config.go`
- [ ] Update metrics collection for privacy-safe history usage
- [ ] Add feature flag support for gradual rollout

#### Frontend Developer Tasks  
- [ ] Implement `HistoryStorage` class with localStorage abstraction
- [ ] Create privacy consent system and first-time user flow
- [ ] Build basic history data model and validation
- [ ] Add storage quotas and cleanup mechanisms

**Success Criteria**: 
- ✅ Transcriptions can be saved to localStorage
- ✅ Privacy consent workflow functional
- ✅ Basic storage management works

### Phase 2: Core History UI (Sprint 3-4)
**Goal**: Basic history viewing and management

#### Frontend Developer Tasks
- [ ] Implement `HistoryUI` class with history panel
- [ ] Create history item rendering and basic interactions
- [ ] Add search and filter functionality
- [ ] Implement history item actions (copy, download, delete)

#### Designer Tasks
- [ ] Finalize history panel UI/UX design
- [ ] Create responsive layout for history section
- [ ] Design loading states and empty states

**Success Criteria**:
- ✅ History panel shows previous transcriptions
- ✅ Users can search, filter, and manage history items
- ✅ Individual history actions work (copy, download, delete)

### Phase 3: Advanced Features (Sprint 5-6)
**Goal**: Power user features and data management

#### Frontend Developer Tasks
- [ ] Implement advanced search with text indexing
- [ ] Add tagging system and tag management
- [ ] Create bulk operations (select multiple, bulk delete)
- [ ] Implement data export in multiple formats (JSON, CSV, TXT)

#### Backend Developer Tasks
- [ ] Add advanced metrics for history usage patterns
- [ ] Implement feature flag controls for advanced features
- [ ] Add performance monitoring for large history datasets

**Success Criteria**:
- ✅ Advanced search works across transcript content
- ✅ Users can organize transcripts with tags
- ✅ Bulk operations and export functionality work

### Phase 4: Polish & Performance (Sprint 7)
**Goal**: Production-ready optimization

#### Frontend Developer Tasks
- [ ] Implement virtual scrolling for large history lists
- [ ] Add keyboard shortcuts and accessibility features
- [ ] Optimize localStorage usage and implement compression
- [ ] Add comprehensive error handling and recovery

#### Testing Tasks
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Performance testing with large datasets (1000+ entries)
- [ ] Privacy audit and security review
- [ ] Mobile responsiveness testing

**Success Criteria**:
- ✅ Handles 1000+ history entries smoothly
- ✅ Works across all major browsers
- ✅ Meets accessibility standards
- ✅ Privacy audit passed

---

## Technical Risk Assessment

### High Risk 🔴
- **localStorage Limits**: 5-10MB varies by browser
  - *Mitigation*: Compression, pagination, auto-cleanup
- **Data Loss**: Browser clearing localStorage
  - *Mitigation*: Export warnings, backup reminders

### Medium Risk 🟡  
- **Performance**: Large datasets (1000+ entries)
  - *Mitigation*: Virtual scrolling, lazy loading
- **Browser Compatibility**: localStorage API differences
  - *Mitigation*: Feature detection, graceful degradation

### Low Risk 🟢
- **User Adoption**: Feature might be underused
  - *Mitigation*: Clear value proposition, optional feature
- **Privacy Misunderstanding**: Users might think data is synced
  - *Mitigation*: Clear "local only" messaging

---

## Success Metrics

### Usage Metrics (Privacy-Safe)
- History feature adoption rate
- Average entries per active user
- Export usage frequency
- Privacy settings preferences

### Performance Metrics
- History panel load time (<200ms)
- Search response time (<100ms)
- Storage efficiency (MB per transcript)
- Error rates across browsers

### User Experience Metrics
- Privacy consent acceptance rate
- History retention settings distribution
- Feature usage patterns (search vs browse)
- Mobile vs desktop usage patterns

---

**Architecture Complete**: This specification provides comprehensive guidance for implementing privacy-first transcription history with zero server-side persistence while maintaining the clean architecture principles of Whisper Hub. The design prioritizes user data sovereignty, performance, and seamless integration with existing HTMX patterns.