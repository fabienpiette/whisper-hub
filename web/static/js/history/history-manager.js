/**
 * HistoryManager - Core history management with event-driven architecture
 * Coordinates storage, privacy, UI, and export functionality
 */

// Event bus for history-related events
class HistoryEventBus {
    constructor() {
        this.events = {
            'history:added': [],
            'history:deleted': [],
            'history:cleared': [],
            'history:settings-changed': [],
            'history:storage-warning': [],
            'history:export-completed': [],
            'history:search-changed': []
        };
    }

    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    on(event, callback) {
        if (this.events[event]) {
            this.events[event].push(callback);
        }
    }

    off(event, callback) {
        if (this.events[event]) {
            const index = this.events[event].indexOf(callback);
            if (index > -1) {
                this.events[event].splice(index, 1);
            }
        }
    }
}

class HistoryManager {
    constructor(config = {}) {
        this.config = {
            maxClientMB: 50,
            enabled: true,
            version: '1.0.0',
            ...config
        };

        this.storage = null;
        this.privacy = null;
        this.ui = null;
        this.eventBus = new HistoryEventBus();
        this.initialized = false;
        this.currentFilters = {};
        
        this.init();
    }

    /**
     * Initialize the history manager
     */
    async init() {
        try {
            // Load configuration from server
            await this.loadServerConfig();

            // Initialize components
            this.storage = new HistoryStorage();
            this.privacy = new HistoryPrivacy();
            
            // Wait for storage to initialize
            await this.storage.init();

            // Setup event listeners
            this.setupEventListeners();

            // Auto-cleanup on initialization
            await this.performAutoCleanup();

            this.initialized = true;
            console.log('HistoryManager initialized successfully');

        } catch (error) {
            console.error('HistoryManager initialization failed:', error);
            this.config.enabled = false;
        }
    }

    /**
     * Add a new transcription to history
     */
    async addTranscription(transcriptionData) {
        if (!this.initialized || !this.config.enabled) {
            return false;
        }

        try {
            // Check privacy consent
            if (!this.privacy.hasConsent()) {
                // First time user - show consent modal
                if (this.privacy.getConsentState().state === 'unknown') {
                    const granted = await this.privacy.showConsentModal(transcriptionData);
                    if (!granted) {
                        return false;
                    }
                } else {
                    // User previously denied or in incognito mode
                    return false;
                }
            }

            // Create history entry from transcription data
            const entry = this.createHistoryEntry(transcriptionData);

            // Validate entry
            this.validateHistoryEntry(entry);

            // Check storage limits
            await this.checkStorageLimits();

            // Save to storage
            const savedEntry = await this.storage.save(entry);

            // Emit event
            this.eventBus.emit('history:added', savedEntry);

            return savedEntry;

        } catch (error) {
            console.error('Failed to add transcription to history:', error);
            
            if (error.message.includes('quota')) {
                this.eventBus.emit('history:storage-warning', {
                    type: 'quota-exceeded',
                    message: 'Storage limit reached. Please clear some history entries.'
                });
            }
            
            return false;
        }
    }

    /**
     * Get history entries with filtering and pagination
     */
    async getHistory(filters = {}) {
        if (!this.initialized || !this.config.enabled) {
            return [];
        }

        try {
            // Merge with current filters
            const mergedFilters = { ...this.currentFilters, ...filters };
            
            // Load from storage
            const entries = await this.storage.load(mergedFilters);

            return entries;

        } catch (error) {
            console.error('Failed to get history:', error);
            return [];
        }
    }

    /**
     * Delete a specific entry
     */
    async deleteEntry(id) {
        if (!this.initialized || !this.config.enabled) {
            return false;
        }

        try {
            await this.storage.delete(id);
            this.eventBus.emit('history:deleted', { id });
            return true;

        } catch (error) {
            console.error('Failed to delete history entry:', error);
            return false;
        }
    }

    /**
     * Clear all history with confirmation
     */
    async clearAll() {
        if (!this.initialized || !this.config.enabled) {
            return false;
        }

        try {
            // Show confirmation dialog with export option
            const confirmed = await this.privacy.showClearWarning();
            if (!confirmed) {
                return false;
            }

            await this.storage.clearAll();
            this.eventBus.emit('history:cleared');
            return true;

        } catch (error) {
            console.error('Failed to clear history:', error);
            return false;
        }
    }

    /**
     * Export history data in specified format
     */
    async exportData(format = 'json') {
        if (!this.initialized || !this.config.enabled) {
            return false;
        }

        try {
            const entries = await this.getHistory();
            const exportData = await this.formatExportData(entries, format);
            const filename = this.generateExportFilename(format);

            // Download file
            this.downloadFile(exportData.content, filename, exportData.mimeType);

            this.eventBus.emit('history:export-completed', { format, filename, count: entries.length });
            return true;

        } catch (error) {
            console.error('Failed to export history:', error);
            return false;
        }
    }

    /**
     * Get usage statistics
     */
    async getStats() {
        if (!this.initialized || !this.config.enabled) {
            return {
                totalEntries: 0,
                totalMB: 0,
                usagePercent: 0,
                oldestEntry: null,
                newestEntry: null
            };
        }

        try {
            const storageInfo = await this.storage.getStorageInfo();
            const entries = await this.getHistory();

            let oldestEntry = null;
            let newestEntry = null;

            if (entries.length > 0) {
                // Entries are sorted by timestamp (newest first)
                newestEntry = new Date(entries[0].timestamp);
                oldestEntry = new Date(entries[entries.length - 1].timestamp);
            }

            return {
                ...storageInfo,
                oldestEntry,
                newestEntry,
                audioCount: entries.filter(e => e.fileType === 'audio').length,
                videoCount: entries.filter(e => e.fileType === 'video').length,
                starredCount: entries.filter(e => e.starred).length,
                taggedCount: entries.filter(e => e.tags && e.tags.length > 0).length
            };

        } catch (error) {
            console.error('Failed to get stats:', error);
            return { totalEntries: 0, totalMB: 0, usagePercent: 0 };
        }
    }

    /**
     * Update search/filter criteria
     */
    updateFilters(filters) {
        this.currentFilters = { ...this.currentFilters, ...filters };
        this.eventBus.emit('history:search-changed', this.currentFilters);
    }

    /**
     * Update settings
     */
    async updateSettings(newSettings) {
        if (!this.initialized || !this.config.enabled) {
            return false;
        }

        try {
            await this.storage.updateSettings(newSettings);
            this.eventBus.emit('history:settings-changed', newSettings);
            return true;

        } catch (error) {
            console.error('Failed to update settings:', error);
            return false;
        }
    }

    /**
     * Set UI component reference
     */
    setUI(ui) {
        this.ui = ui;
    }

    /**
     * Get event bus for external listeners
     */
    getEventBus() {
        return this.eventBus;
    }

    /**
     * Private: Load configuration from server
     */
    async loadServerConfig() {
        try {
            const response = await fetch('/api/history/config');
            if (response.ok) {
                const serverConfig = await response.json();
                this.config = { ...this.config, ...serverConfig };
            }
        } catch (error) {
            console.warn('Could not load server config, using defaults:', error);
        }
    }

    /**
     * Private: Create history entry from transcription data
     */
    createHistoryEntry(transcriptionData) {
        return {
            id: this.generateUUID(),
            timestamp: Date.now(),
            filename: transcriptionData.filename,
            fileType: transcriptionData.fileType || 'audio',
            fileSize: transcriptionData.fileSize || 0,
            duration: transcriptionData.duration || null,
            transcript: transcriptionData.transcript,
            characterCount: transcriptionData.transcript.length,
            processingTime: transcriptionData.processingTime || 0,
            tags: [],
            starred: false,
            version: 1
        };
    }

    /**
     * Private: Validate history entry structure
     */
    validateHistoryEntry(entry) {
        const required = ['id', 'timestamp', 'filename', 'fileType', 'fileSize', 'transcript'];
        const missing = required.filter(field => !(field in entry) || entry[field] === null || entry[field] === undefined);
        
        if (missing.length > 0) {
            throw new Error(`Invalid history entry: missing ${missing.join(', ')}`);
        }

        if (!['audio', 'video'].includes(entry.fileType)) {
            throw new Error('Invalid fileType. Must be "audio" or "video"');
        }

        if (typeof entry.timestamp !== 'number' || entry.timestamp <= 0) {
            throw new Error('Invalid timestamp');
        }
    }

    /**
     * Private: Check storage limits and warn if necessary
     */
    async checkStorageLimits() {
        const info = await this.storage.getStorageInfo();
        const limitMB = this.config.maxClientMB;

        if (info.totalMB > limitMB * 0.9) { // Warn at 90% capacity
            this.eventBus.emit('history:storage-warning', {
                type: 'approaching-limit',
                message: `Storage usage: ${info.totalMB.toFixed(1)}MB of ${limitMB}MB limit`,
                usagePercent: (info.totalMB / limitMB) * 100
            });
        }

        if (info.totalMB > limitMB) {
            throw new Error(`Storage limit exceeded: ${info.totalMB.toFixed(1)}MB > ${limitMB}MB`);
        }
    }

    /**
     * Private: Perform automatic cleanup
     */
    async performAutoCleanup() {
        try {
            const result = await this.storage.cleanup();
            if (result.cleaned > 0) {
                console.log(`Auto-cleanup: removed ${result.cleaned} expired entries`);
                this.eventBus.emit('history:settings-changed', { autoCleanupExecuted: result });
            }
        } catch (error) {
            console.warn('Auto-cleanup failed:', error);
        }
    }

    /**
     * Private: Format data for export
     */
    async formatExportData(entries, format) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const stats = await this.getStats();

        switch (format.toLowerCase()) {
            case 'json':
                return {
                    content: JSON.stringify({
                        metadata: {
                            exportDate: new Date().toISOString(),
                            version: this.config.version,
                            totalEntries: entries.length,
                            ...stats
                        },
                        entries
                    }, null, 2),
                    mimeType: 'application/json'
                };

            case 'csv':
                const csvHeader = 'Date,Filename,Type,Size (bytes),Duration (sec),Characters,Starred,Tags,Transcript\n';
                const csvRows = entries.map(entry => {
                    const date = new Date(entry.timestamp).toISOString();
                    const tags = (entry.tags || []).join(';');
                    const transcript = (entry.transcript || '').replace(/"/g, '""'); // Escape quotes
                    return `"${date}","${entry.filename}","${entry.fileType}",${entry.fileSize},${entry.duration || ''},${entry.characterCount},${entry.starred ? 'Yes' : 'No'},"${tags}","${transcript}"`;
                }).join('\n');
                
                return {
                    content: csvHeader + csvRows,
                    mimeType: 'text/csv'
                };

            case 'txt':
                const txtContent = entries.map(entry => {
                    const date = new Date(entry.timestamp).toLocaleString();
                    const duration = entry.duration ? ` (${Math.round(entry.duration)}s)` : '';
                    const tags = entry.tags && entry.tags.length > 0 ? `\nTags: ${entry.tags.join(', ')}` : '';
                    const starred = entry.starred ? ' ⭐' : '';
                    
                    return `=== ${entry.filename}${starred} ===\nDate: ${date}\nType: ${entry.fileType}${duration}\nCharacters: ${entry.characterCount}${tags}\n\n${entry.transcript}\n\n`;
                }).join('---\n\n');

                return {
                    content: `Whisper Hub Transcription History\nExported: ${new Date().toLocaleString()}\nTotal Entries: ${entries.length}\n\n${'='.repeat(50)}\n\n${txtContent}`,
                    mimeType: 'text/plain'
                };

            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    /**
     * Private: Generate export filename
     */
    generateExportFilename(format) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        return `whisper-hub-history-${timestamp}.${format}`;
    }

    /**
     * Private: Download file
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = filename;
        downloadLink.style.display = 'none';
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        window.URL.revokeObjectURL(url);
    }

    /**
     * Private: Generate UUID v4
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Private: Setup event listeners
     */
    setupEventListeners() {
        // Listen for privacy consent changes
        document.addEventListener('privacy:consent-changed', (event) => {
            const consentData = event.detail;
            console.log('Privacy consent changed:', consentData);
            
            // Emit settings change event
            this.eventBus.emit('history:settings-changed', { privacy: consentData });
        });

        // Listen for storage warnings
        this.eventBus.on('history:storage-warning', (warning) => {
            console.warn('Storage warning:', warning);
            
            // Show user notification
            this.showStorageWarning(warning);
        });
    }

    /**
     * Private: Show storage warning to user
     */
    showStorageWarning(warning) {
        // Create a non-intrusive notification
        const notification = document.createElement('div');
        notification.className = 'storage-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">⚠️</span>
                <span class="notification-text">${warning.message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 10000);

        // Manual close
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.parentNode.removeChild(notification);
        });
    }
}

// Make classes globally available
window.HistoryEventBus = HistoryEventBus;
window.HistoryManager = HistoryManager;