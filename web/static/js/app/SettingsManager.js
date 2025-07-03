/**
 * Settings Management
 * Handles application settings persistence and UI
 */

class SettingsManager {
    constructor() {
        this.storageKey = 'whisper_settings';
        this.defaultSettings = {
            incognitoMode: false,
            historyEnabled: true,
            autoSave: true,
            maxHistoryItems: 100,
            defaultAction: '',
            theme: 'light',
            autoDownload: false,
            showFilePreview: true,
            compressionLevel: 'medium',
            language: 'auto'
        };
        
        this.settings = { ...this.defaultSettings };
        this.loadSettings();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Incognito mode toggle
        const incognitoToggle = document.getElementById('incognito-mode');
        if (incognitoToggle) {
            incognitoToggle.addEventListener('change', (e) => {
                this.updateSetting('incognitoMode', e.target.checked);
            });
        }

        // History enabled toggle
        const historyToggle = document.getElementById('enable-history');
        if (historyToggle) {
            historyToggle.addEventListener('change', (e) => {
                this.updateSetting('historyEnabled', e.target.checked);
            });
        }

        // Export all data button
        const exportAllBtn = document.getElementById('export-all');
        if (exportAllBtn) {
            exportAllBtn.addEventListener('click', () => {
                this.exportAllData();
            });
        }

        // Clear all data button
        const clearAllBtn = document.getElementById('clear-all-data');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.showClearDataConfirmation();
            });
        }

        // Theme selector (if exists)
        const themeSelector = document.getElementById('theme-selector');
        if (themeSelector) {
            themeSelector.addEventListener('change', (e) => {
                this.updateSetting('theme', e.target.value);
                this.applyTheme(e.target.value);
            });
        }

        // Language selector (if exists)
        const languageSelector = document.getElementById('language-selector');
        if (languageSelector) {
            languageSelector.addEventListener('change', (e) => {
                this.updateSetting('language', e.target.value);
            });
        }
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.settings = { ...this.defaultSettings, ...parsed };
            }
            this.applySettings();
        } catch (error) {
            console.warn('Failed to load settings:', error.message);
            this.settings = { ...this.defaultSettings };
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
            this.dispatchSettingsEvent('saved');
        } catch (error) {
            console.error('Failed to save settings:', error.message);
            this.dispatchSettingsEvent('save-failed', { error: error.message });
        }
    }

    updateSetting(key, value) {
        const oldValue = this.settings[key];
        this.settings[key] = value;
        
        this.saveSettings();
        this.applySettingChange(key, value, oldValue);
        
        this.dispatchSettingsEvent('changed', { 
            key, 
            value, 
            oldValue,
            allSettings: { ...this.settings }
        });
    }

    getSetting(key) {
        return this.settings[key];
    }

    getAllSettings() {
        return { ...this.settings };
    }

    resetSettings() {
        this.settings = { ...this.defaultSettings };
        this.saveSettings();
        this.applySettings();
        this.dispatchSettingsEvent('reset');
    }

    applySettings() {
        // Apply incognito mode
        const incognitoToggle = document.getElementById('incognito-mode');
        if (incognitoToggle) {
            incognitoToggle.checked = this.settings.incognitoMode;
        }

        // Apply history enabled
        const historyToggle = document.getElementById('enable-history');
        if (historyToggle) {
            historyToggle.checked = this.settings.historyEnabled;
        }

        // Apply theme
        this.applyTheme(this.settings.theme);

        // Apply other UI settings
        this.applyUISettings();
    }

    applySettingChange(key, value, oldValue) {
        switch (key) {
            case 'incognitoMode':
                this.handleIncognitoModeChange(value);
                break;
            case 'historyEnabled':
                this.handleHistoryEnabledChange(value);
                break;
            case 'theme':
                this.applyTheme(value);
                break;
            case 'language':
                this.handleLanguageChange(value);
                break;
            default:
                // Generic setting change handling
                break;
        }
    }

    handleIncognitoModeChange(enabled) {
        document.body.classList.toggle('incognito-mode', enabled);
        
        // Update UI state
        const indicator = document.querySelector('.incognito-indicator');
        if (indicator) {
            indicator.style.display = enabled ? 'block' : 'none';
        }

        // Show toast notification
        this.showToast(
            enabled ? 'Incognito mode enabled' : 'Incognito mode disabled',
            'info'
        );
    }

    handleHistoryEnabledChange(enabled) {
        // Update history-related UI
        const historyControls = document.querySelectorAll('.history-control');
        historyControls.forEach(control => {
            control.style.display = enabled ? 'block' : 'none';
        });

        // Show toast notification
        this.showToast(
            enabled ? 'History tracking enabled' : 'History tracking disabled',
            'info'
        );
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update theme selector
        const themeSelector = document.getElementById('theme-selector');
        if (themeSelector) {
            themeSelector.value = theme;
        }

        // Apply theme-specific styles
        this.applyThemeStyles(theme);
    }

    applyThemeStyles(theme) {
        const root = document.documentElement;
        
        switch (theme) {
            case 'dark':
                root.style.setProperty('--bg-color', '#1a1a1a');
                root.style.setProperty('--text-color', '#ffffff');
                root.style.setProperty('--accent-color', '#4a9eff');
                break;
            case 'light':
                root.style.setProperty('--bg-color', '#ffffff');
                root.style.setProperty('--text-color', '#333333');
                root.style.setProperty('--accent-color', '#007bff');
                break;
            case 'auto':
                // Use system preference
                const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                this.applyThemeStyles(systemDark ? 'dark' : 'light');
                break;
        }
    }

    handleLanguageChange(language) {
        // Update language-related settings
        this.showToast(`Language changed to ${language}`, 'info');
    }

    applyUISettings() {
        // Apply file preview setting
        const filePreview = document.getElementById('file-preview');
        if (filePreview && !this.settings.showFilePreview) {
            filePreview.style.display = 'none';
        }

        // Apply other UI-related settings
        document.body.classList.toggle('auto-download', this.settings.autoDownload);
        document.body.classList.toggle('auto-save', this.settings.autoSave);
    }

    exportAllData() {
        try {
            const exportData = {
                settings: this.settings,
                history: this.getHistoryData(),
                actions: this.getActionsData(),
                exportedAt: new Date().toISOString(),
                version: '1.0'
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const filename = `whisper-hub-data-${new Date().toISOString().slice(0, 10)}.json`;
            
            this.downloadFile(dataStr, filename, 'application/json');
            this.showToast('Data exported successfully', 'success');
        } catch (error) {
            console.error('Export failed:', error);
            this.showToast('Export failed', 'error');
        }
    }

    getHistoryData() {
        try {
            const historyKey = 'whisper_history';
            const historyData = localStorage.getItem(historyKey);
            return historyData ? JSON.parse(historyData) : [];
        } catch (error) {
            return [];
        }
    }

    getActionsData() {
        try {
            const actionsKey = 'whisper-custom-actions';
            const actionsData = localStorage.getItem(actionsKey);
            return actionsData ? JSON.parse(actionsData) : [];
        } catch (error) {
            return [];
        }
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }

    showClearDataConfirmation() {
        const confirmed = confirm(
            'Are you sure you want to clear all data? This will remove:\n\n' +
            '• All transcription history\n' +
            '• Custom actions\n' +
            '• Settings\n\n' +
            'This action cannot be undone.'
        );

        if (confirmed) {
            this.clearAllData();
        }
    }

    clearAllData() {
        try {
            // Clear all Whisper Hub related data
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (
                    key.startsWith('whisper') ||
                    key.startsWith('rate_limit') ||
                    key.startsWith('panel_state')
                )) {
                    keysToRemove.push(key);
                }
            }

            keysToRemove.forEach(key => localStorage.removeItem(key));
            
            // Reset settings to defaults
            this.resetSettings();
            
            // Reload page to ensure clean state
            this.showToast('All data cleared. Reloading...', 'info');
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        } catch (error) {
            console.error('Clear data failed:', error);
            this.showToast('Failed to clear all data', 'error');
        }
    }

    importData(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const importData = JSON.parse(e.target.result);
                
                if (importData.settings) {
                    this.settings = { ...this.defaultSettings, ...importData.settings };
                    this.saveSettings();
                    this.applySettings();
                }

                if (importData.history) {
                    localStorage.setItem('whisper_history', JSON.stringify(importData.history));
                }

                if (importData.actions) {
                    localStorage.setItem('whisper-custom-actions', JSON.stringify(importData.actions));
                }

                this.showToast('Data imported successfully', 'success');
                
                // Reload to apply all changes
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
                
            } catch (error) {
                console.error('Import failed:', error);
                this.showToast('Import failed: Invalid file format', 'error');
            }
        };
        
        reader.readAsText(file);
    }

    showToast(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        const container = document.getElementById('toast-container');
        if (container) {
            container.appendChild(toast);
            
            // Animate in
            setTimeout(() => toast.classList.add('show'), 10);
            
            // Remove after delay
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (container.contains(toast)) {
                        container.removeChild(toast);
                    }
                }, 300);
            }, 3000);
        }
    }

    dispatchSettingsEvent(eventType, detail = {}) {
        const event = new CustomEvent(`settings-${eventType}`, {
            detail: { ...detail, settings: this.settings }
        });
        document.dispatchEvent(event);
    }

    // Advanced settings methods
    validateSetting(key, value) {
        switch (key) {
            case 'maxHistoryItems':
                return typeof value === 'number' && value > 0 && value <= 1000;
            case 'compressionLevel':
                return ['low', 'medium', 'high'].includes(value);
            case 'theme':
                return ['light', 'dark', 'auto'].includes(value);
            case 'language':
                return typeof value === 'string' && value.length <= 10;
            default:
                return true;
        }
    }

    getSettingSchema() {
        return {
            incognitoMode: { type: 'boolean', default: false },
            historyEnabled: { type: 'boolean', default: true },
            autoSave: { type: 'boolean', default: true },
            maxHistoryItems: { type: 'number', min: 1, max: 1000, default: 100 },
            defaultAction: { type: 'string', default: '' },
            theme: { type: 'enum', values: ['light', 'dark', 'auto'], default: 'light' },
            autoDownload: { type: 'boolean', default: false },
            showFilePreview: { type: 'boolean', default: true },
            compressionLevel: { type: 'enum', values: ['low', 'medium', 'high'], default: 'medium' },
            language: { type: 'string', default: 'auto' }
        };
    }
}

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsManager;
} else if (typeof window !== 'undefined') {
    window.SettingsManager = SettingsManager;
}