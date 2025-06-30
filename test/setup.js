/**
 * Jest setup file for Whisper Hub frontend tests
 * Sets up global mocks and utilities needed for testing
 */

// Mock global APIs that may not be available in Jest/jsdom
global.fetch = jest.fn();
global.confirm = jest.fn(() => true);
global.prompt = jest.fn();

// Mock Web APIs
Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:8080',
    href: 'http://localhost:8080'
  },
  writable: true
});

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn(() => Promise.resolve())
  },
  writable: true
});

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 1000000
    }
  },
  writable: true
});

// Mock URL.createObjectURL
Object.defineProperty(window.URL, 'createObjectURL', {
  value: jest.fn(() => 'blob:mock-url')
});

Object.defineProperty(window.URL, 'revokeObjectURL', {
  value: jest.fn()
});

// Mock SecurityUtils globally with realistic behavior
global.SecurityUtils = {
    sanitizeHTML: jest.fn((html) => {
        if (typeof html !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }),
    sanitizeAttribute: jest.fn((attr) => {
        if (typeof attr !== 'string') return String(attr);
        return attr
            .replace(/[<>'"]/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .trim();
    }),
    sanitizeFilename: jest.fn((filename) => {
        if (typeof filename !== 'string') return 'download.txt';
        return filename
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
            .replace(/^\.+/, '')
            .replace(/\.{2,}/g, '.')
            .slice(0, 255)
            .trim() || 'download.txt';
    }),
    createElement: jest.fn((tag, attrs = {}, text = '') => {
        const element = document.createElement(tag);
        const allowedAttributes = [
            'id', 'class', 'data-id', 'data-action', 'data-format',
            'title', 'aria-label', 'role', 'tabindex',
            'type', 'placeholder', 'value', 'name',
            'href', 'download', 'target', 'rel'
        ];
        
        Object.entries(attrs).forEach(([key, value]) => {
            if (allowedAttributes.includes(key)) {
                element.setAttribute(key, value);
            }
        });
        if (text) element.textContent = text;
        return element;
    }),
    isValidAttribute: jest.fn((name) => {
        const allowedAttributes = [
            'id', 'class', 'data-id', 'data-action', 'data-format',
            'title', 'aria-label', 'role', 'tabindex',
            'type', 'placeholder', 'value', 'name',
            'href', 'download', 'target', 'rel'
        ];
        return allowedAttributes.includes(name);
    }),
    generateCSRFToken: jest.fn(() => {
        // Generate unique 64-char token each time
        return Math.random().toString(36).padEnd(64, '0').slice(0, 64);
    }),
    validateCSRFToken: jest.fn((token, expected) => {
        if (!token || !expected || token.length !== expected.length) {
            return false;
        }
        return token === expected;
    }),
    isSafeURL: jest.fn((url) => {
        if (!url) return false;
        try {
            const parsed = new URL(url, window.location.origin);
            const allowedDomains = ['unpkg.com'];
            return parsed.origin === window.location.origin ||
                   allowedDomains.includes(parsed.hostname);
        } catch {
            return false;
        }
    }),
    encryptData: jest.fn(async (data) => 'encrypted-' + btoa(data)),
    decryptData: jest.fn(async (data) => {
        try {
            return atob(data.replace('encrypted-', ''));
        } catch {
            return data;
        }
    }),
    checkRateLimit: jest.fn(() => true)
};

// Mock WhisperApp classes
global.WhisperApp = class MockWhisperApp {
    constructor() {
        this.state = {
            incognitoMode: false,
            historyEnabled: true,
            panels: { history: false, settings: false }
        };
        this.storage = new global.HistoryStorage();
        this.ui = new global.UIManager();
        this.uploader = new global.FileUploader();
    }
    
    async init() {}
    setupEventListeners() {}
    setupHTMXListeners() {}
    async refreshCSRFToken() {
        try {
            const csrfInput = document.getElementById('csrf-token');
            if (csrfInput) {
                csrfInput.value = 'new-token-123';
            }
        } catch (error) {
            console.warn('Failed to refresh CSRF token:', error);
        }
    }
    async handleTranscriptionSuccess(event) {
        if (this.state.historyEnabled && !this.state.incognitoMode) {
            const mockData = {
                id: this.generateId(),
                timestamp: Date.now(),
                filename: 'test.mp3',
                fileType: 'audio',
                fileSize: 1024,
                transcript: 'Test transcript',
                characterCount: 13
            };
            await this.saveToHistory(mockData);
        }
    }
    handleTranscriptionError(event) {
        this.ui.showToast('Transcription failed', 'error');
    }
    async saveToHistory(data) {
        await this.storage.save(data);
    }
    togglePanel(panelName) {
        if (this.state.panels[panelName]) {
            this.closePanel(panelName);
        } else {
            this.openPanel(panelName);
        }
    }
    openPanel(panelName) {
        this.state.panels[panelName] = true;
        const panel = document.getElementById(`${panelName}-panel`);
        if (panel) {
            panel.classList.remove('collapsed');
        }
        const overlay = document.getElementById('panel-overlay');
        if (overlay) {
            overlay.classList.add('active');
        }
    }
    closePanel(panelName) {
        this.state.panels[panelName] = false;
        const panel = document.getElementById(`${panelName}-panel`);
        if (panel) {
            panel.classList.add('collapsed');
        }
        const anyPanelOpen = Object.values(this.state.panels).some(open => open);
        if (!anyPanelOpen) {
            const overlay = document.getElementById('panel-overlay');
            if (overlay) {
                overlay.classList.remove('active');
            }
        }
    }
    closeAllPanels() {
        Object.keys(this.state.panels).forEach(panelName => {
            this.closePanel(panelName);
        });
    }
    async loadHistoryPanel() {}
    renderHistoryList(entries) {
        const container = document.getElementById('history-list');
        if (container) {
            if (entries && entries.length > 0) {
                container.innerHTML = '';
                entries.forEach(() => {
                    const item = document.createElement('div');
                    item.className = 'history-item';
                    container.appendChild(item);
                });
            }
        }
    }
    createHistoryItem(entry) { 
        const item = document.createElement('div');
        item.className = 'history-item';
        item.dataset.id = entry.id;
        return item;
    }
    async handleHistoryItemAction() {}
    async toggleStar() {}
    async copyTranscript() {}
    async downloadTranscript() {}
    async deleteEntry() {}
    expandTranscript(item) {
        const preview = item.querySelector('.item-preview');
        const full = item.querySelector('.item-full');
        if (preview) preview.classList.add('hidden');
        if (full) full.classList.remove('hidden');
    }
    collapseTranscript(item) {
        const preview = item.querySelector('.item-preview');
        const full = item.querySelector('.item-full');
        if (preview) preview.classList.remove('hidden');
        if (full) full.classList.add('hidden');
    }
    async searchHistory() {}
    async filterHistory() {}
    showExportMenu() {}
    async exportHistory() {}
    async clearHistory() {}
    loadSettingsPanel() {}
    async updateStorageUsage() {}
    async updateHistoryCount() {}
    async exportAllData() {}
    async clearAllData() {
        await this.storage.clear();
        localStorage.removeItem('whisper-settings');
    }
    loadSettings() {
        const saved = localStorage.getItem('whisper-settings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                this.state.historyEnabled = settings.historyEnabled ?? true;
            } catch (e) {
                // Handle corrupted settings gracefully
            }
        }
    }
    saveSettings() {}
    handleKeyboardShortcuts(event) {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        switch (event.key) {
            case 'h':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.togglePanel('history');
                }
                break;
            case 'Escape':
                this.closeAllPanels();
                break;
        }
    }
    generateId() { return 'mock-id-' + Date.now(); }
    debounce(fn, wait) { 
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), wait);
        };
    }
    getRelativeTime() { return 'Just now'; }
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    formatDuration() { return '1m'; }
    truncateText(text, length) { 
        return text.length > length ? text.substring(0, length) + '...' : text;
    }
    escapeHtml(text) { return text; }
    downloadFile() {}
};

global.HistoryStorage = class MockHistoryStorage {
    constructor() {
        this.storageKey = 'whisper-history';
        this.encryptionKey = 'mock-key';
        this.entries = [];
    }
    
    async save(entry) {
        this.entries.unshift(entry);
        localStorage.setItem(this.storageKey, JSON.stringify(this.entries));
    }
    
    async load(filters = {}) {
        let entries = [...this.entries];
        
        if (filters.search) {
            const query = filters.search.toLowerCase();
            entries = entries.filter(entry => 
                entry.filename.toLowerCase().includes(query) ||
                entry.transcript.toLowerCase().includes(query)
            );
        }
        
        if (filters.fileType) {
            entries = entries.filter(entry => entry.fileType === filters.fileType);
        }
        
        if (filters.starred) {
            entries = entries.filter(entry => entry.starred);
        }
        
        return entries;
    }
    
    async delete(id) {
        this.entries = this.entries.filter(entry => entry.id !== id);
        localStorage.setItem(this.storageKey, JSON.stringify(this.entries));
    }
    
    async clear() {
        this.entries = [];
        localStorage.removeItem(this.storageKey);
    }
    
    async toggleStar(id) {
        const entry = this.entries.find(e => e.id === id);
        if (entry) {
            entry.starred = !entry.starred;
        }
    }
    
    async getStats() { 
        return { 
            totalEntries: this.entries.length, 
            audioCount: this.entries.filter(e => e.fileType === 'audio').length,
            videoCount: this.entries.filter(e => e.fileType === 'video').length,
            totalMB: 0 
        }; 
    }
};

global.UIManager = class MockUIManager {
    showLoading() {}
    hideLoading() {}
    updateIncognitoState() {}
    showToast(message, type) {
        const container = document.getElementById('toast-container');
        if (container) {
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.innerHTML = `
                <span class="toast-message">${message}</span>
                <button class="toast-close">&times;</button>
            `;
            container.appendChild(toast);
        }
    }
};

global.FileUploader = class MockFileUploader {
    constructor() {}
    setupDragAndDrop() {}
    setupFileInput() {}
    preventDefaults() {}
    handleDrop() {}
    handleFile() {}
    showFilePreview() {}
    clearFile() {}
    createFileList() { return []; }
    formatFileSize() { return '1 MB'; }
};

global.HistoryExporter = class MockHistoryExporter {
    async export() {}
    formatData() { return { content: '', mimeType: 'text/plain' }; }
    formatCSV() { return ''; }
    formatTXT() { return ''; }
    generateFilename() { return 'test.txt'; }
    downloadFile() {}
};

// Make mocks available on window
window.SecurityUtils = global.SecurityUtils;
window.WhisperApp = global.WhisperApp;
window.HistoryStorage = global.HistoryStorage;
window.UIManager = global.UIManager;
window.FileUploader = global.FileUploader;
window.HistoryExporter = global.HistoryExporter;

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem: jest.fn((key) => localStorageMock.store[key] || null),
  setItem: jest.fn((key, value) => { localStorageMock.store[key] = value.toString(); }),
  removeItem: jest.fn((key) => { delete localStorageMock.store[key]; }),
  clear: jest.fn(() => { localStorageMock.store = {}; })
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Clear mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.store = {};
  document.body.innerHTML = '';
});