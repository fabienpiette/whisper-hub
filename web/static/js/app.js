/**
 * Whisper Hub - Modern JavaScript Application
 * Clean, modular, accessible frontend with privacy-first design
 */

class WhisperApp {
    constructor() {
        this.state = {
            incognitoMode: false,
            historyEnabled: true,
            panels: {
                history: false,
                settings: false
            }
        };
        
        this.storage = new HistoryStorage();
        this.ui = new UIManager();
        this.uploader = new FileUploader();
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.loadSettings();
        await this.updateHistoryCount();
        
        // Initialize HTMX listeners
        this.setupHTMXListeners();
        
        console.log('Whisper Hub initialized');
    }
    
    setupEventListeners() {
        // Panel toggles
        document.getElementById('history-toggle').addEventListener('click', () => {
            this.togglePanel('history');
        });
        
        document.getElementById('settings-toggle').addEventListener('click', () => {
            this.togglePanel('settings');
        });
        
        // Panel close buttons
        document.getElementById('close-history').addEventListener('click', () => {
            this.closePanel('history');
        });
        
        document.getElementById('close-settings').addEventListener('click', () => {
            this.closePanel('settings');
        });
        
        // Overlay click to close panels
        document.getElementById('panel-overlay').addEventListener('click', () => {
            this.closeAllPanels();
        });
        
        // Incognito mode toggle
        document.getElementById('incognito-mode').addEventListener('change', (e) => {
            this.state.incognitoMode = e.target.checked;
            this.ui.updateIncognitoState(this.state.incognitoMode);
        });
        
        // History controls
        document.getElementById('history-search').addEventListener('input', 
            this.debounce((e) => this.searchHistory(e.target.value), 300)
        );
        
        document.getElementById('history-filter').addEventListener('change', (e) => {
            this.filterHistory(e.target.value);
        });
        
        document.getElementById('export-history').addEventListener('click', () => {
            this.showExportMenu();
        });
        
        document.getElementById('clear-history').addEventListener('click', () => {
            this.clearHistory();
        });
        
        // Settings controls
        document.getElementById('enable-history').addEventListener('change', (e) => {
            this.state.historyEnabled = e.target.checked;
            this.saveSettings();
        });
        
        document.getElementById('export-all').addEventListener('click', () => {
            this.exportAllData();
        });
        
        document.getElementById('clear-all-data').addEventListener('click', () => {
            this.clearAllData();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }
    
    setupHTMXListeners() {
        // Listen for HTMX events
        document.addEventListener('htmx:beforeRequest', (e) => {
            this.ui.showLoading();
            
            // Check rate limit before sending request
            if (!SecurityUtils.checkRateLimit('transcription', 5, 60000)) {
                e.preventDefault();
                this.ui.showToast('Rate limit exceeded. Please wait before trying again.', 'warning');
                this.ui.hideLoading();
                return;
            }
        });
        
        document.addEventListener('htmx:afterRequest', (e) => {
            this.ui.hideLoading();
            
            if (e.detail.successful) {
                this.handleTranscriptionSuccess(e);
                // Refresh CSRF token after successful request
                this.refreshCSRFToken();
            } else {
                this.handleTranscriptionError(e);
            }
        });
    }
    
    async refreshCSRFToken() {
        try {
            const response = await fetch('/api/csrf-token');
            const data = await response.json();
            const csrfInput = document.getElementById('csrf-token');
            if (csrfInput && data.csrf_token) {
                csrfInput.value = data.csrf_token;
            }
        } catch (error) {
            console.warn('Failed to refresh CSRF token:', error);
        }
    }
    
    async handleTranscriptionSuccess(event) {
        // Extract transcription data from response
        const response = event.detail.xhr.responseText;
        const parser = new DOMParser();
        const doc = parser.parseFromString(response, 'text/html');
        
        // Look for transcript data
        const transcriptElement = doc.querySelector('[data-transcript]');
        if (transcriptElement && this.state.historyEnabled && !this.state.incognitoMode) {
            const transcriptData = this.extractTranscriptData(transcriptElement);
            await this.saveToHistory(transcriptData);
            await this.updateHistoryCount();
        }
        
        this.ui.showToast('Transcription completed!', 'success');
    }
    
    handleTranscriptionError(event) {
        const errorMsg = event.detail.xhr.responseText || 'Transcription failed';
        this.ui.showToast(errorMsg, 'error');
    }
    
    extractTranscriptData(element) {
        return {
            id: this.generateId(),
            timestamp: Date.now(),
            filename: element.dataset.filename || 'Unknown',
            fileType: element.dataset.fileType || 'audio',
            fileSize: parseInt(element.dataset.fileSize) || 0,
            duration: parseFloat(element.dataset.duration) || 0,
            transcript: element.dataset.transcript || element.textContent.trim(),
            characterCount: element.textContent.trim().length,
            starred: false,
            tags: []
        };
    }
    
    async saveToHistory(data) {
        try {
            await this.storage.save(data);
            this.ui.showToast('Saved to history', 'success');
        } catch (error) {
            console.error('Failed to save to history:', error);
            this.ui.showToast('Failed to save to history', 'error');
        }
    }
    
    togglePanel(panelName) {
        if (this.state.panels[panelName]) {
            this.closePanel(panelName);
        } else {
            this.openPanel(panelName);
        }
    }
    
    openPanel(panelName) {
        // Close other panels first
        Object.keys(this.state.panels).forEach(name => {
            if (name !== panelName) {
                this.closePanel(name);
            }
        });
        
        this.state.panels[panelName] = true;
        document.getElementById(`${panelName}-panel`).classList.remove('collapsed');
        document.getElementById('panel-overlay').classList.add('active');
        
        // Load panel content
        if (panelName === 'history') {
            this.loadHistoryPanel();
        } else if (panelName === 'settings') {
            this.loadSettingsPanel();
        }
    }
    
    closePanel(panelName) {
        this.state.panels[panelName] = false;
        document.getElementById(`${panelName}-panel`).classList.add('collapsed');
        
        // Check if any panels are open
        const anyPanelOpen = Object.values(this.state.panels).some(open => open);
        if (!anyPanelOpen) {
            document.getElementById('panel-overlay').classList.remove('active');
        }
    }
    
    closeAllPanels() {
        Object.keys(this.state.panels).forEach(panelName => {
            this.closePanel(panelName);
        });
    }
    
    async loadHistoryPanel() {
        try {
            const entries = await this.storage.load();
            this.renderHistoryList(entries);
            await this.updateStorageUsage();
        } catch (error) {
            console.error('Failed to load history:', error);
            this.ui.showToast('Failed to load history', 'error');
        }
    }
    
    renderHistoryList(entries) {
        const container = document.getElementById('history-list');
        const emptyState = document.getElementById('history-empty');
        
        if (entries.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }
        
        container.style.display = 'block';
        emptyState.style.display = 'none';
        
        // Clear container safely
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        
        // Create and append history items securely
        entries.forEach(entry => {
            const itemElement = this.createHistoryItem(entry);
            container.appendChild(itemElement);
        });
        
        // Add event listeners to history items
        this.attachHistoryItemListeners();
    }
    
    createHistoryItem(entry) {
        const date = new Date(entry.timestamp);
        const relativeTime = this.getRelativeTime(date);
        const fileSize = this.formatFileSize(entry.fileSize);
        const duration = entry.duration ? this.formatDuration(entry.duration) : '';
        const preview = this.truncateText(entry.transcript, 100);
        const typeIcon = entry.fileType === 'video' ? '🎬' : '🎵';
        const starIcon = entry.starred ? '⭐' : '☆';
        
        // Create DOM elements safely instead of innerHTML
        const itemDiv = SecurityUtils.createElement('div', {
            'class': 'history-item',
            'data-id': SecurityUtils.sanitizeAttribute(entry.id)
        });
        
        const headerDiv = SecurityUtils.createElement('div', { 'class': 'item-header' });
        
        // Item info section
        const infoDiv = SecurityUtils.createElement('div', { 'class': 'item-info' });
        const titleH4 = SecurityUtils.createElement('h4', { 'class': 'item-title' });
        const typeIconSpan = SecurityUtils.createElement('span', { 'class': 'type-icon' }, typeIcon);
        const filenameText = document.createTextNode(entry.filename);
        
        titleH4.appendChild(typeIconSpan);
        titleH4.appendChild(filenameText);
        
        const metaDiv = SecurityUtils.createElement('div', { 'class': 'item-meta' });
        const timestampSpan = SecurityUtils.createElement('span', { 'class': 'timestamp' }, relativeTime);
        const sizeSpan = SecurityUtils.createElement('span', { 'class': 'file-size' }, fileSize);
        
        metaDiv.appendChild(timestampSpan);
        metaDiv.appendChild(sizeSpan);
        
        if (duration) {
            const durationSpan = SecurityUtils.createElement('span', { 'class': 'duration' }, duration);
            metaDiv.appendChild(durationSpan);
        }
        
        infoDiv.appendChild(titleH4);
        infoDiv.appendChild(metaDiv);
        
        // Action buttons section
        const actionsDiv = SecurityUtils.createElement('div', { 'class': 'item-actions' });
        
        const starBtn = SecurityUtils.createElement('button', {
            'class': 'action-btn star-btn',
            'data-action': 'star',
            'title': 'Star'
        }, starIcon);
        
        const copyBtn = SecurityUtils.createElement('button', {
            'class': 'action-btn copy-btn',
            'data-action': 'copy',
            'title': 'Copy'
        }, '📋');
        
        const downloadBtn = SecurityUtils.createElement('button', {
            'class': 'action-btn download-btn',
            'data-action': 'download',
            'title': 'Download'
        }, '💾');
        
        const deleteBtn = SecurityUtils.createElement('button', {
            'class': 'action-btn delete-btn',
            'data-action': 'delete',
            'title': 'Delete'
        }, '🗑️');
        
        actionsDiv.appendChild(starBtn);
        actionsDiv.appendChild(copyBtn);
        actionsDiv.appendChild(downloadBtn);
        actionsDiv.appendChild(deleteBtn);
        
        headerDiv.appendChild(infoDiv);
        headerDiv.appendChild(actionsDiv);
        
        // Preview section
        const previewDiv = SecurityUtils.createElement('div', { 'class': 'item-preview' });
        const previewP = SecurityUtils.createElement('p', { 'class': 'preview-text' }, preview);
        const expandBtn = SecurityUtils.createElement('button', {
            'class': 'expand-btn',
            'data-action': 'expand'
        }, 'Show full transcript');
        
        previewDiv.appendChild(previewP);
        previewDiv.appendChild(expandBtn);
        
        // Full transcript section
        const fullDiv = SecurityUtils.createElement('div', { 'class': 'item-full hidden' });
        const fullTextDiv = SecurityUtils.createElement('div', { 'class': 'full-text' }, entry.transcript);
        const collapseBtn = SecurityUtils.createElement('button', {
            'class': 'collapse-btn',
            'data-action': 'collapse'
        }, 'Show less');
        
        fullDiv.appendChild(fullTextDiv);
        fullDiv.appendChild(collapseBtn);
        
        // Assemble the complete item
        itemDiv.appendChild(headerDiv);
        itemDiv.appendChild(previewDiv);
        itemDiv.appendChild(fullDiv);
        
        return itemDiv;
    }
    
    attachHistoryItemListeners() {
        document.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.handleHistoryItemAction(e);
            });
        });
    }
    
    async handleHistoryItemAction(event) {
        const action = event.target.dataset.action;
        const historyItem = event.target.closest('.history-item');
        const entryId = historyItem.dataset.id;
        
        switch (action) {
            case 'star':
                await this.toggleStar(entryId, event.target);
                break;
            case 'copy':
                await this.copyTranscript(entryId);
                break;
            case 'download':
                await this.downloadTranscript(entryId);
                break;
            case 'delete':
                await this.deleteEntry(entryId);
                break;
            case 'expand':
                this.expandTranscript(historyItem);
                break;
            case 'collapse':
                this.collapseTranscript(historyItem);
                break;
        }
    }
    
    async toggleStar(entryId, button) {
        try {
            await this.storage.toggleStar(entryId);
            button.textContent = button.textContent === '⭐' ? '☆' : '⭐';
            this.ui.showToast('Updated', 'success');
        } catch (error) {
            console.error('Failed to toggle star:', error);
        }
    }
    
    async copyTranscript(entryId) {
        try {
            const entries = await this.storage.load();
            const entry = entries.find(e => e.id === entryId);
            if (entry) {
                await navigator.clipboard.writeText(entry.transcript);
                this.ui.showToast('Copied to clipboard', 'success');
            }
        } catch (error) {
            console.error('Failed to copy:', error);
            this.ui.showToast('Failed to copy', 'error');
        }
    }
    
    async downloadTranscript(entryId) {
        try {
            const entries = await this.storage.load();
            const entry = entries.find(e => e.id === entryId);
            if (entry) {
                const filename = `${entry.filename.replace(/\.[^/.]+$/, '')}_transcript.txt`;
                const content = `${entry.filename}\nDate: ${new Date(entry.timestamp).toLocaleString()}\n\n${entry.transcript}`;
                this.downloadFile(content, filename, 'text/plain');
                this.ui.showToast('Downloaded', 'success');
            }
        } catch (error) {
            console.error('Failed to download:', error);
            this.ui.showToast('Failed to download', 'error');
        }
    }
    
    async deleteEntry(entryId) {
        if (confirm('Delete this transcription?')) {
            try {
                await this.storage.delete(entryId);
                await this.loadHistoryPanel();
                await this.updateHistoryCount();
                this.ui.showToast('Deleted', 'success');
            } catch (error) {
                console.error('Failed to delete:', error);
                this.ui.showToast('Failed to delete', 'error');
            }
        }
    }
    
    expandTranscript(item) {
        item.querySelector('.item-preview').classList.add('hidden');
        item.querySelector('.item-full').classList.remove('hidden');
    }
    
    collapseTranscript(item) {
        item.querySelector('.item-preview').classList.remove('hidden');
        item.querySelector('.item-full').classList.add('hidden');
    }
    
    async searchHistory(query) {
        const entries = await this.storage.load({ search: query });
        this.renderHistoryList(entries);
    }
    
    async filterHistory(filter) {
        const filters = {};
        if (filter === 'audio' || filter === 'video') {
            filters.fileType = filter;
        } else if (filter === 'starred') {
            filters.starred = true;
        }
        
        const entries = await this.storage.load(filters);
        this.renderHistoryList(entries);
    }
    
    showExportMenu() {
        // Simple export menu for now
        const format = prompt('Export format (json, csv, txt, html):', 'json');
        if (format) {
            this.exportHistory(format);
        }
    }
    
    async exportHistory(format = 'json') {
        try {
            const entries = await this.storage.load();
            const exporter = new HistoryExporter();
            await exporter.export(entries, format);
            this.ui.showToast(`Exported as ${format.toUpperCase()}`, 'success');
        } catch (error) {
            console.error('Export failed:', error);
            this.ui.showToast('Export failed', 'error');
        }
    }
    
    async clearHistory() {
        if (confirm('Clear all transcription history? This cannot be undone.')) {
            try {
                await this.storage.clear();
                await this.loadHistoryPanel();
                await this.updateHistoryCount();
                this.ui.showToast('History cleared', 'success');
            } catch (error) {
                console.error('Failed to clear history:', error);
                this.ui.showToast('Failed to clear history', 'error');
            }
        }
    }
    
    loadSettingsPanel() {
        this.updateStorageUsage();
    }
    
    async updateStorageUsage() {
        try {
            const stats = await this.storage.getStats();
            document.getElementById('storage-usage').textContent = `${stats.totalMB} MB`;
        } catch (error) {
            console.error('Failed to get storage stats:', error);
        }
    }
    
    async updateHistoryCount() {
        try {
            const stats = await this.storage.getStats();
            const badge = document.getElementById('history-count');
            badge.textContent = stats.totalEntries;
            badge.classList.toggle('hidden', stats.totalEntries === 0);
        } catch (error) {
            console.error('Failed to update history count:', error);
        }
    }
    
    async exportAllData() {
        await this.exportHistory('json');
    }
    
    async clearAllData() {
        if (confirm('Clear all data including settings? This cannot be undone.')) {
            try {
                await this.storage.clear();
                localStorage.removeItem('whisper-settings');
                location.reload();
            } catch (error) {
                console.error('Failed to clear all data:', error);
                this.ui.showToast('Failed to clear data', 'error');
            }
        }
    }
    
    loadSettings() {
        const saved = localStorage.getItem('whisper-settings');
        if (saved) {
            const settings = JSON.parse(saved);
            this.state.historyEnabled = settings.historyEnabled ?? true;
            document.getElementById('enable-history').checked = this.state.historyEnabled;
        }
    }
    
    saveSettings() {
        const settings = {
            historyEnabled: this.state.historyEnabled
        };
        localStorage.setItem('whisper-settings', JSON.stringify(settings));
    }
    
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
            case 's':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.togglePanel('settings');
                }
                break;
            case 'Escape':
                this.closeAllPanels();
                break;
        }
    }
    
    // Utility methods
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    getRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    formatDuration(seconds) {
        if (seconds < 60) return Math.round(seconds) + 's';
        if (seconds < 3600) return Math.round(seconds / 60) + 'm';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.round((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
    
    truncateText(text, length) {
        return text.length > length ? text.substring(0, length) + '...' : text;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    downloadFile(content, filename, mimeType) {
        // Sanitize filename for security
        const safeFilename = SecurityUtils.sanitizeFilename(filename);
        
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeFilename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
}

// Supporting classes for modularity
class HistoryStorage {
    constructor() {
        this.storageKey = 'whisper-history';
        this.encryptionKey = this.getOrCreateEncryptionKey();
    }
    
    getOrCreateEncryptionKey() {
        const keyName = 'whisper-encryption-key';
        let key = localStorage.getItem(keyName);
        
        if (!key) {
            // Generate a new encryption key
            key = SecurityUtils.generateCSRFToken();
            localStorage.setItem(keyName, key);
        }
        
        return key;
    }
    
    async save(entry) {
        const entries = await this.load();
        entries.unshift(entry);
        const encryptedData = await SecurityUtils.encryptData(JSON.stringify(entries), this.encryptionKey);
        localStorage.setItem(this.storageKey, encryptedData);
    }
    
    async load(filters = {}) {
        const stored = localStorage.getItem(this.storageKey);
        let entries = [];
        
        if (stored) {
            try {
                const decryptedData = await SecurityUtils.decryptData(stored, this.encryptionKey);
                entries = JSON.parse(decryptedData);
            } catch (error) {
                console.warn('Failed to decrypt history data, using unencrypted fallback');
                entries = JSON.parse(stored);
            }
        }
        
        // Apply filters
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
        const entries = await this.load();
        const filtered = entries.filter(entry => entry.id !== id);
        const encryptedData = await SecurityUtils.encryptData(JSON.stringify(filtered), this.encryptionKey);
        localStorage.setItem(this.storageKey, encryptedData);
    }
    
    async clear() {
        localStorage.removeItem(this.storageKey);
    }
    
    async toggleStar(id) {
        const entries = await this.load();
        const entry = entries.find(e => e.id === id);
        if (entry) {
            entry.starred = !entry.starred;
            const encryptedData = await SecurityUtils.encryptData(JSON.stringify(entries), this.encryptionKey);
            localStorage.setItem(this.storageKey, encryptedData);
        }
    }
    
    async getStats() {
        const entries = await this.load();
        const totalSize = entries.reduce((sum, entry) => sum + (entry.fileSize || 0), 0);
        
        return {
            totalEntries: entries.length,
            audioCount: entries.filter(e => e.fileType === 'audio').length,
            videoCount: entries.filter(e => e.fileType === 'video').length,
            totalMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
        };
    }
}

class UIManager {
    showLoading() {
        const btn = document.getElementById('transcribe-btn');
        btn.classList.add('loading');
        btn.disabled = true;
    }
    
    hideLoading() {
        const btn = document.getElementById('transcribe-btn');
        btn.classList.remove('loading');
        btn.disabled = false;
    }
    
    updateIncognitoState(enabled) {
        document.body.classList.toggle('incognito-mode', enabled);
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-message">${message}</span>
            <button class="toast-close">&times;</button>
        `;
        
        container.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
        
        // Manual close
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.parentNode.removeChild(toast);
        });
    }
}

class FileUploader {
    constructor() {
        this.setupDragAndDrop();
        this.setupFileInput();
    }
    
    setupDragAndDrop() {
        const zone = document.getElementById('upload-zone');
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            zone.addEventListener(eventName, this.preventDefaults, false);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            zone.addEventListener(eventName, () => zone.classList.add('drag-over'), false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            zone.addEventListener(eventName, () => zone.classList.remove('drag-over'), false);
        });
        
        zone.addEventListener('drop', this.handleDrop.bind(this), false);
    }
    
    setupFileInput() {
        const input = document.getElementById('file-input');
        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0]);
            }
        });
    }
    
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    handleDrop(e) {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.handleFile(files[0]);
        }
    }
    
    handleFile(file) {
        this.showFilePreview(file);
        document.getElementById('file-input').files = this.createFileList(file);
        document.getElementById('transcribe-btn').disabled = false;
    }
    
    showFilePreview(file) {
        const preview = document.getElementById('file-preview');
        const icon = document.getElementById('file-type-icon');
        const name = document.getElementById('file-name');
        const size = document.getElementById('file-size');
        const duration = document.getElementById('file-duration');
        
        // Set icon based on file type
        if (file.type.startsWith('video/')) {
            icon.textContent = '🎬';
        } else if (file.type.startsWith('audio/')) {
            icon.textContent = '🎵';
        } else {
            icon.textContent = '📄';
        }
        
        name.textContent = file.name;
        size.textContent = this.formatFileSize(file.size);
        duration.textContent = ''; // Duration will be determined server-side
        
        preview.classList.remove('hidden');
        
        // Remove file button
        document.getElementById('remove-file').addEventListener('click', () => {
            this.clearFile();
        });
    }
    
    clearFile() {
        document.getElementById('file-preview').classList.add('hidden');
        document.getElementById('file-input').value = '';
        document.getElementById('transcribe-btn').disabled = true;
    }
    
    createFileList(file) {
        const dt = new DataTransfer();
        dt.items.add(file);
        return dt.files;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
}

class HistoryExporter {
    async export(entries, format) {
        const data = this.formatData(entries, format);
        const filename = this.generateFilename(format);
        this.downloadFile(data.content, filename, data.mimeType);
    }
    
    formatData(entries, format) {
        switch (format.toLowerCase()) {
            case 'json':
                return {
                    content: JSON.stringify({
                        exported: new Date().toISOString(),
                        entries: entries
                    }, null, 2),
                    mimeType: 'application/json'
                };
            case 'csv':
                return {
                    content: this.formatCSV(entries),
                    mimeType: 'text/csv'
                };
            case 'txt':
                return {
                    content: this.formatTXT(entries),
                    mimeType: 'text/plain'
                };
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
    }
    
    formatCSV(entries) {
        const headers = 'Date,Filename,Type,Size,Transcript\n';
        const rows = entries.map(entry => {
            const date = new Date(entry.timestamp).toISOString();
            const transcript = entry.transcript.replace(/"/g, '""');
            return `"${date}","${entry.filename}","${entry.fileType}","${entry.fileSize}","${transcript}"`;
        }).join('\n');
        return headers + rows;
    }
    
    formatTXT(entries) {
        return entries.map(entry => {
            const date = new Date(entry.timestamp).toLocaleString();
            return `File: ${entry.filename}\nDate: ${date}\nType: ${entry.fileType}\n\n${entry.transcript}\n\n${'='.repeat(50)}\n\n`;
        }).join('');
    }
    
    generateFilename(format) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        const filename = `whisper-hub-history-${timestamp}.${format}`;
        return SecurityUtils.sanitizeFilename(filename);
    }
    
    downloadFile(content, filename, mimeType) {
        // Sanitize filename for security
        const safeFilename = SecurityUtils.sanitizeFilename(filename);
        
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeFilename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.whisperApp = new WhisperApp();
});