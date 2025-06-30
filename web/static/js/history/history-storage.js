/**
 * HistoryStorage - localStorage abstraction for transcription history
 * Privacy-first design with zero server-side persistence
 */

// Storage keys as defined in architecture
const STORAGE_KEYS = {
    HISTORY_ENTRIES: 'whisper_hub_history',
    HISTORY_METADATA: 'whisper_hub_history_meta', 
    HISTORY_SETTINGS: 'whisper_hub_history_settings',
    STORAGE_VERSION: 'whisper_hub_storage_version'
};

// Current storage schema version for migrations
const STORAGE_VERSION = '1.0.0';

// Default settings
const DEFAULT_SETTINGS = {
    maxEntries: 100,
    retentionDays: 30,
    autoCleanup: true,
    exportFormat: 'json'
};

class HistoryStorage {
    constructor() {
        this.initialized = false;
        this.compressionEnabled = true;
        this.init();
    }

    /**
     * Initialize storage with version checking and migrations
     */
    async init() {
        try {
            await this.checkStorageSupport();
            await this.performMigrations();
            await this.initializeMetadata();
            this.initialized = true;
        } catch (error) {
            console.error('HistoryStorage initialization failed:', error);
            throw new Error('History feature unavailable: ' + error.message);
        }
    }

    /**
     * Check if localStorage is available and working
     */
    async checkStorageSupport() {
        if (!window.localStorage) {
            throw new Error('localStorage not supported');
        }

        // Test storage access
        try {
            const testKey = 'whisper_hub_storage_test';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
        } catch (error) {
            throw new Error('localStorage access denied (private browsing?)');
        }
    }

    /**
     * Handle storage schema migrations
     */
    async performMigrations() {
        const currentVersion = localStorage.getItem(STORAGE_KEYS.STORAGE_VERSION);
        
        if (!currentVersion) {
            // First time setup
            localStorage.setItem(STORAGE_KEYS.STORAGE_VERSION, STORAGE_VERSION);
            return;
        }

        if (currentVersion !== STORAGE_VERSION) {
            console.log(`Migrating storage from ${currentVersion} to ${STORAGE_VERSION}`);
            await this.migrate(currentVersion);
            localStorage.setItem(STORAGE_KEYS.STORAGE_VERSION, STORAGE_VERSION);
        }
    }

    /**
     * Perform storage migrations (placeholder for future versions)
     */
    async migrate(fromVersion) {
        // Future migration logic will go here
        console.log(`Migration from ${fromVersion} completed`);
    }

    /**
     * Initialize metadata if not exists
     */
    async initializeMetadata() {
        if (!localStorage.getItem(STORAGE_KEYS.HISTORY_METADATA)) {
            const metadata = {
                version: STORAGE_VERSION,
                totalEntries: 0,
                storageSize: 0,
                lastCleanup: Date.now(),
                settings: { ...DEFAULT_SETTINGS }
            };
            localStorage.setItem(STORAGE_KEYS.HISTORY_METADATA, JSON.stringify(metadata));
        }

        if (!localStorage.getItem(STORAGE_KEYS.HISTORY_SETTINGS)) {
            localStorage.setItem(STORAGE_KEYS.HISTORY_SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
        }
    }

    /**
     * Save a transcription entry to history
     */
    async save(entry) {
        if (!this.initialized) {
            throw new Error('Storage not initialized');
        }

        try {
            // Validate entry structure
            this.validateEntry(entry);

            // Get current entries
            const entries = await this.loadEntries();
            
            // Add new entry at the beginning (most recent first)
            entries.unshift(entry);

            // Apply retention limits
            await this.applyRetentionLimits(entries);

            // Save back to storage
            await this.saveEntries(entries);

            // Update metadata
            await this.updateMetadata(entries);

            return entry;
        } catch (error) {
            console.error('Failed to save history entry:', error);
            throw error;
        }
    }

    /**
     * Load history entries with optional filtering
     */
    async load(filters = {}) {
        if (!this.initialized) {
            await this.init();
        }

        try {
            let entries = await this.loadEntries();

            // Apply filters
            if (filters.fileType && filters.fileType !== 'all') {
                entries = entries.filter(entry => entry.fileType === filters.fileType);
            }

            if (filters.starred) {
                entries = entries.filter(entry => entry.starred);
            }

            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                entries = entries.filter(entry => 
                    entry.filename.toLowerCase().includes(searchTerm) ||
                    entry.transcript.toLowerCase().includes(searchTerm) ||
                    (entry.tags && entry.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
                );
            }

            if (filters.limit) {
                entries = entries.slice(0, filters.limit);
            }

            return entries;
        } catch (error) {
            console.error('Failed to load history entries:', error);
            return [];
        }
    }

    /**
     * Delete a specific entry by ID
     */
    async delete(id) {
        try {
            const entries = await this.loadEntries();
            const filteredEntries = entries.filter(entry => entry.id !== id);
            
            if (filteredEntries.length === entries.length) {
                throw new Error('Entry not found');
            }

            await this.saveEntries(filteredEntries);
            await this.updateMetadata(filteredEntries);

            return true;
        } catch (error) {
            console.error('Failed to delete history entry:', error);
            throw error;
        }
    }

    /**
     * Clear all history entries
     */
    async clearAll() {
        try {
            localStorage.removeItem(STORAGE_KEYS.HISTORY_ENTRIES);
            await this.updateMetadata([]);
            return true;
        } catch (error) {
            console.error('Failed to clear history:', error);
            throw error;
        }
    }

    /**
     * Auto-cleanup expired entries based on settings
     */
    async cleanup() {
        try {
            const settings = await this.getSettings();
            if (!settings.autoCleanup) {
                return { cleaned: 0, reason: 'Auto-cleanup disabled' };
            }

            const entries = await this.loadEntries();
            const now = Date.now();
            const retentionMs = settings.retentionDays * 24 * 60 * 60 * 1000;
            
            const validEntries = entries.filter(entry => {
                const age = now - entry.timestamp;
                return age < retentionMs;
            });

            const cleanedCount = entries.length - validEntries.length;

            if (cleanedCount > 0) {
                await this.saveEntries(validEntries);
                await this.updateMetadata(validEntries);
            }

            // Update last cleanup time
            const metadata = await this.getMetadata();
            metadata.lastCleanup = now;
            localStorage.setItem(STORAGE_KEYS.HISTORY_METADATA, JSON.stringify(metadata));

            return { cleaned: cleanedCount, total: validEntries.length };
        } catch (error) {
            console.error('Cleanup failed:', error);
            return { cleaned: 0, error: error.message };
        }
    }

    /**
     * Get storage usage statistics
     */
    async getStorageInfo() {
        try {
            const entries = await this.loadEntries();
            const entriesData = localStorage.getItem(STORAGE_KEYS.HISTORY_ENTRIES) || '[]';
            const metadataData = localStorage.getItem(STORAGE_KEYS.HISTORY_METADATA) || '{}';
            const settingsData = localStorage.getItem(STORAGE_KEYS.HISTORY_SETTINGS) || '{}';
            
            const totalBytes = entriesData.length + metadataData.length + settingsData.length;
            const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

            // Estimate localStorage limit (typically 5-10MB)
            const estimatedLimit = 5 * 1024 * 1024; // 5MB conservative estimate
            const usagePercent = ((totalBytes / estimatedLimit) * 100).toFixed(1);

            return {
                totalEntries: entries.length,
                totalBytes: totalBytes,
                totalMB: parseFloat(totalMB),
                usagePercent: parseFloat(usagePercent),
                estimatedLimit: estimatedLimit,
                averageEntrySize: entries.length > 0 ? Math.round(totalBytes / entries.length) : 0
            };
        } catch (error) {
            console.error('Failed to get storage info:', error);
            return { totalEntries: 0, totalBytes: 0, totalMB: 0, usagePercent: 0 };
        }
    }

    /**
     * Get current settings
     */
    async getSettings() {
        try {
            const settingsData = localStorage.getItem(STORAGE_KEYS.HISTORY_SETTINGS);
            return settingsData ? JSON.parse(settingsData) : { ...DEFAULT_SETTINGS };
        } catch (error) {
            console.error('Failed to get settings:', error);
            return { ...DEFAULT_SETTINGS };
        }
    }

    /**
     * Update settings
     */
    async updateSettings(newSettings) {
        try {
            const currentSettings = await this.getSettings();
            const mergedSettings = { ...currentSettings, ...newSettings };
            localStorage.setItem(STORAGE_KEYS.HISTORY_SETTINGS, JSON.stringify(mergedSettings));
            return mergedSettings;
        } catch (error) {
            console.error('Failed to update settings:', error);
            throw error;
        }
    }

    /**
     * Private: Load entries from localStorage
     */
    async loadEntries() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.HISTORY_ENTRIES);
            if (!data) return [];

            const entries = JSON.parse(data);
            return Array.isArray(entries) ? entries : [];
        } catch (error) {
            console.error('Failed to parse history entries:', error);
            return [];
        }
    }

    /**
     * Private: Save entries to localStorage
     */
    async saveEntries(entries) {
        try {
            const data = JSON.stringify(entries);
            localStorage.setItem(STORAGE_KEYS.HISTORY_ENTRIES, data);
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                throw new Error('Storage quota exceeded. Please clear some history entries.');
            }
            throw error;
        }
    }

    /**
     * Private: Get metadata
     */
    async getMetadata() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.HISTORY_METADATA);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Failed to get metadata:', error);
            return null;
        }
    }

    /**
     * Private: Update metadata after changes
     */
    async updateMetadata(entries) {
        try {
            const storageInfo = await this.getStorageInfo();
            const metadata = {
                version: STORAGE_VERSION,
                totalEntries: entries.length,
                storageSize: storageInfo.totalBytes,
                lastCleanup: (await this.getMetadata())?.lastCleanup || Date.now(),
                settings: await this.getSettings()
            };
            localStorage.setItem(STORAGE_KEYS.HISTORY_METADATA, JSON.stringify(metadata));
        } catch (error) {
            console.error('Failed to update metadata:', error);
        }
    }

    /**
     * Private: Apply retention limits (max entries and auto-cleanup)
     */
    async applyRetentionLimits(entries) {
        const settings = await this.getSettings();
        
        // Apply max entries limit
        if (entries.length > settings.maxEntries) {
            entries.splice(settings.maxEntries);
        }

        // Apply time-based retention
        if (settings.autoCleanup && settings.retentionDays > 0) {
            const now = Date.now();
            const retentionMs = settings.retentionDays * 24 * 60 * 60 * 1000;
            
            const validEntries = entries.filter(entry => {
                const age = now - entry.timestamp;
                return age < retentionMs;
            });

            if (validEntries.length < entries.length) {
                entries.splice(0, entries.length, ...validEntries);
            }
        }
    }

    /**
     * Private: Validate entry structure
     */
    validateEntry(entry) {
        const required = ['id', 'timestamp', 'filename', 'fileType', 'fileSize', 'transcript', 'characterCount'];
        const missing = required.filter(field => !(field in entry));
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }

        if (!['audio', 'video'].includes(entry.fileType)) {
            throw new Error('Invalid fileType. Must be "audio" or "video"');
        }

        if (typeof entry.timestamp !== 'number' || entry.timestamp <= 0) {
            throw new Error('Invalid timestamp');
        }

        if (typeof entry.fileSize !== 'number' || entry.fileSize <= 0) {
            throw new Error('Invalid fileSize');
        }
    }
}

// Make class globally available
window.HistoryStorage = HistoryStorage;