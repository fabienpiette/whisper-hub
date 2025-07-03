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
        this.actionManager = new CustomActionManager();
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.loadSettings();
        await this.updateHistoryCount();
        
        // Initialize HTMX listeners
        this.setupHTMXListeners();
        
        // Populate action selector
        await this.actionManager.populateActionSelector();
        
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
        
        // Custom action controls
        document.getElementById('create-action')?.addEventListener('click', () => {
            this.actionManager.showCreateModal();
        });
        
        document.getElementById('manage-actions')?.addEventListener('click', () => {
            this.actionManager.showManageModal();
        });
        
        // Upload form action buttons
        document.getElementById('create-action-btn')?.addEventListener('click', () => {
            this.actionManager.showCreateModal();
        });
        
        document.getElementById('manage-actions-btn')?.addEventListener('click', () => {
            this.actionManager.showManageModal();
        });
        
        // Post-action selector change
        document.getElementById('post-action-selector')?.addEventListener('change', (e) => {
            const hiddenInput = document.getElementById('post-action-input');
            if (hiddenInput) {
                hiddenInput.value = e.target.value;
            }
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
        
        // Process custom action if one was selected
        setTimeout(() => {
            if (window.whisperApp.processPostAction) {
                window.whisperApp.processPostAction();
            }
        }, 500); // Small delay to ensure DOM is updated
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
    
    // Global methods for copy functionality from templates
    copyResult(button) {
        try {
            const resultCard = button.closest('.result-card');
            if (resultCard) {
                const transcript = resultCard.dataset.transcript;
                if (transcript) {
                    navigator.clipboard.writeText(transcript);
                    this.ui.showToast('Original transcript copied!', 'success');
                }
            }
        } catch (error) {
            console.error('Failed to copy result:', error);
            this.ui.showToast('Failed to copy', 'error');
        }
    }
    
    copyActionResult(button) {
        try {
            const actionContent = document.getElementById('action-result-text');
            if (actionContent) {
                navigator.clipboard.writeText(actionContent.textContent);
                this.ui.showToast('AI result copied!', 'success');
            }
        } catch (error) {
            console.error('Failed to copy action result:', error);
            this.ui.showToast('Failed to copy', 'error');
        }
    }
    
    downloadResult(button) {
        try {
            const resultCard = button.closest('.result-card');
            if (resultCard) {
                const transcript = resultCard.dataset.transcript;
                const filename = resultCard.dataset.filename;
                const actionContent = document.getElementById('action-result-text');
                
                let content = `Transcript from: ${filename}\nDate: ${new Date().toLocaleString()}\n\n`;
                content += `ORIGINAL TRANSCRIPT:\n${transcript}\n\n`;
                
                if (actionContent) {
                    content += `AI PROCESSING RESULT:\n${actionContent.textContent}\n`;
                }
                
                const downloadFilename = `${filename.replace(/\.[^/.]+$/, '')}_processed.txt`;
                this.downloadFile(content, downloadFilename, 'text/plain');
                this.ui.showToast('Download started!', 'success');
            }
        } catch (error) {
            console.error('Failed to download result:', error);
            this.ui.showToast('Failed to download', 'error');
        }
    }
    
    selectText(elementId) {
        try {
            const element = document.getElementById(elementId);
            if (element) {
                const range = document.createRange();
                range.selectNodeContents(element);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
        } catch (error) {
            console.error('Failed to select text:', error);
        }
    }
    
    startNewTranscription() {
        // Reset the form and scroll to top
        document.getElementById('transcribe-form').reset();
        document.getElementById('file-preview').classList.add('hidden');
        document.getElementById('transcribe-btn').disabled = true;
        document.getElementById('result-container').classList.add('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    viewHistory() {
        this.togglePanel('history');
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

class CustomActionManager {
    constructor() {
        this.storageKey = 'whisper-custom-actions';
        this.encryptionKey = this.getOrCreateEncryptionKey();
        this.availableVariables = [
            'Transcript', 'Filename', 'Date', 'FileType', 
            'Duration', 'WordCount', 'CharCount', 'ProcessingTime'
        ];
        this.availableFunctions = {
            'upper': 'Convert text to uppercase',
            'lower': 'Convert text to lowercase',
            'title': 'Convert text to title case',
            'trim': 'Remove leading and trailing whitespace',
            'wordCount': 'Count words in text',
            'charCount': 'Count characters in text',
            'truncate': 'Truncate text to specified length',
            'summarize': 'Create bullet-point summary',
            'extractActions': 'Extract action items and tasks',
            'format': 'Format text with proper line wrapping',
            'timestamp': 'Current timestamp',
            'date': 'Current date',
            'time': 'Current time'
        };
        this.availableModels = [
            'gpt-3.5-turbo',
            'gpt-3.5-turbo-16k',
            'gpt-4',
            'gpt-4-turbo-preview',
            'gpt-4-turbo',
            'gpt-4o',
            'gpt-4o-mini'
        ];
        this.predefinedActions = [
            {
                id: 'openai-meeting-summary',
                name: 'Smart Meeting Summary',
                description: 'AI-powered comprehensive meeting summary with key decisions and action items',
                type: 'openai',
                prompt: 'Analyze this meeting transcript and create a comprehensive summary with the following sections:\n\n1. **Key Decisions Made**\n2. **Action Items** (with responsible parties if mentioned)\n3. **Important Discussion Points**\n4. **Next Steps**\n\nFormat the output with clear headings and bullet points for easy reading.',
                model: 'gpt-3.5-turbo',
                temperature: 0.3,
                maxTokens: 1500
            },
            {
                id: 'openai-action-items',
                name: 'Action Items Extractor',
                description: 'Extract and organize all action items, tasks, and assignments',
                type: 'openai',
                prompt: 'Extract all action items, tasks, deadlines, and assignments from this transcript. For each item, identify:\n\n- The specific task or action required\n- Who is responsible (if mentioned)\n- Any deadlines or timeframes mentioned\n- Priority level (if indicated)\n\nFormat as a prioritized task list with checkboxes.',
                model: 'gpt-3.5-turbo',
                temperature: 0.2,
                maxTokens: 1000
            },
            {
                id: 'openai-executive-brief',
                name: 'Executive Brief',
                description: 'Concise executive summary for leadership review',
                type: 'openai',
                prompt: 'Create a concise executive summary of this transcript suitable for leadership review. Focus on:\n\n- Strategic decisions and their business impact\n- Financial implications or budget discussions\n- Risk factors or opportunities identified\n- Key performance metrics or outcomes\n- Critical next steps requiring leadership attention\n\nKeep it under 300 words and use business-appropriate language.',
                model: 'gpt-4',
                temperature: 0.2,
                maxTokens: 800
            },
            {
                id: 'openai-key-insights',
                name: 'Key Insights',
                description: 'Identify important insights, conclusions, and strategic points',
                type: 'openai',
                prompt: 'Identify and extract the most important insights, conclusions, and strategic points from this transcript. Focus on:\n\n- Novel ideas or innovative solutions discussed\n- Important data points or metrics mentioned\n- Strategic implications for the business\n- Risk factors or challenges identified\n- Opportunities for improvement or growth\n\nPresent as numbered insights with brief explanations.',
                model: 'gpt-3.5-turbo',
                temperature: 0.4,
                maxTokens: 1200
            },
            {
                id: 'openai-qa-format',
                name: 'Q&A Generator',
                description: 'Convert transcript into structured question and answer format',
                type: 'openai',
                prompt: 'Convert this transcript into a comprehensive Q&A format that captures all important questions asked and answers provided. Include:\n\n- All direct questions and their answers\n- Implied questions from the discussion\n- Key topics addressed even if not explicitly asked\n\nFormat with clear Q: and A: markers for easy reading.',
                model: 'gpt-3.5-turbo',
                temperature: 0.3,
                maxTokens: 2000
            }
        ];
    }
    
    getOrCreateEncryptionKey() {
        const keyName = 'whisper-actions-encryption-key';
        let key = localStorage.getItem(keyName);
        
        if (!key) {
            key = SecurityUtils.generateCSRFToken();
            localStorage.setItem(keyName, key);
        }
        
        return key;
    }
    
    async save(action) {
        const actions = await this.load();
        const existingIndex = actions.findIndex(a => a.id === action.id);
        
        if (existingIndex >= 0) {
            actions[existingIndex] = action;
        } else {
            action.id = this.generateId();
            action.created = new Date().toISOString();
            actions.push(action);
        }
        
        const encryptedData = await SecurityUtils.encryptData(JSON.stringify(actions), this.encryptionKey);
        localStorage.setItem(this.storageKey, encryptedData);
    }
    
    async load() {
        const stored = localStorage.getItem(this.storageKey);
        if (!stored) return [];
        
        try {
            const decryptedData = await SecurityUtils.decryptData(stored, this.encryptionKey);
            return JSON.parse(decryptedData);
        } catch (error) {
            console.warn('Failed to decrypt actions data:', error);
            return [];
        }
    }
    
    async delete(actionId) {
        const actions = await this.load();
        const filtered = actions.filter(action => action.id !== actionId);
        const encryptedData = await SecurityUtils.encryptData(JSON.stringify(filtered), this.encryptionKey);
        localStorage.setItem(this.storageKey, encryptedData);
    }
    
    async clear() {
        localStorage.removeItem(this.storageKey);
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    validateAction(action) {
        const errors = [];
        
        if (!action.name || action.name.trim() === '') {
            errors.push('Action name is required');
        }
        
        if (action.name && action.name.length > 100) {
            errors.push('Action name too long (max 100 characters)');
        }
        
        if (action.description && action.description.length > 500) {
            errors.push('Action description too long (max 500 characters)');
        }
        
        // Validate based on action type
        const actionType = action.type || 'template';
        
        if (actionType === 'template') {
            if (!action.template || action.template.trim() === '') {
                errors.push('Action template is required');
            }
            
            if (action.template && action.template.length > 10000) {
                errors.push('Action template too long (max 10000 characters)');
            }
        } else if (actionType === 'openai') {
            if (!action.prompt || action.prompt.trim() === '') {
                errors.push('Action prompt is required');
            }
            
            if (action.prompt && action.prompt.length > 5000) {
                errors.push('Action prompt too long (max 5000 characters)');
            }
            
            if (action.model && !this.availableModels.includes(action.model)) {
                errors.push(`Invalid OpenAI model: ${action.model}`);
            }
            
            if (action.temperature !== undefined && (action.temperature < 0 || action.temperature > 2)) {
                errors.push('Temperature must be between 0 and 2');
            }
            
            if (action.maxTokens !== undefined && (action.maxTokens < 0 || action.maxTokens > 4000)) {
                errors.push('Max tokens must be between 0 and 4000');
            }
        } else {
            errors.push(`Invalid action type: ${actionType}`);
        }
        
        return errors;
    }
    
    showCreateModal() {
        this.showActionModal();
    }
    
    showEditModal(actionId) {
        this.showActionModal(actionId);
    }
    
    async showActionModal(actionId = null) {
        const isEdit = !!actionId;
        let action = {
            name: '',
            description: '',
            template: ''
        };
        
        if (isEdit) {
            const actions = await this.load();
            action = actions.find(a => a.id === actionId) || action;
        }
        
        const modalHtml = this.createActionModalHTML(action, isEdit);
        this.showModal(modalHtml, isEdit ? 'Edit Custom Action' : 'Create Custom Action');
        
        this.setupActionModalListeners(action, isEdit);
    }
    
    createActionModalHTML(action, isEdit) {
        // Fallback escapeHtml function if SecurityUtils is not available
        const escapeHtml = (text) => {
            if (window.SecurityUtils && window.SecurityUtils.escapeHtml) {
                return window.SecurityUtils.escapeHtml(text);
            }
            // Simple fallback
            if (typeof text !== 'string') return text;
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
        
        const exampleTemplates = [
            {
                name: 'Meeting Summary',
                template: `## Meeting Summary
Date: {{.Date}}
File: {{.Filename}}

### Key Points:
{{.Transcript | summarize}}

### Word Count: {{.WordCount}} words`
            },
            {
                name: 'Action Items',
                template: `# Action Items from {{.Filename}}

{{.Transcript | extractActions}}

---
Generated on {{.Date}}`
            },
            {
                name: 'Knowledge Base Entry',
                template: `---
title: {{.Filename}}
date: {{.Date}}
type: {{.FileType}}
---

{{.Transcript | format}}

**Metadata:**
- Duration: {{.Duration}}
- Word Count: {{.WordCount}}
- Character Count: {{.CharCount}}`
            }
        ];
        
        return `
            <div class="action-modal-content">
                <div class="form-group">
                    <label for="action-name">Action Name *</label>
                    <input type="text" id="action-name" value="${escapeHtml(action.name)}" 
                           placeholder="e.g., Meeting Summary" maxlength="100">
                </div>
                
                <div class="form-group">
                    <label for="action-description">Description</label>
                    <textarea id="action-description" placeholder="Brief description of what this action does" 
                              maxlength="500">${escapeHtml(action.description)}</textarea>
                </div>
                
                <div class="form-group">
                    <label for="action-template">Template *</label>
                    <div class="template-help">
                        <details>
                            <summary>Available Variables & Functions</summary>
                            <div class="help-content">
                                <div class="help-section">
                                    <strong>Variables:</strong>
                                    <div class="variable-list">
                                        ${this.availableVariables.map(v => `<code>{{.${v}}}</code>`).join(' ')}
                                    </div>
                                </div>
                                <div class="help-section">
                                    <strong>Functions:</strong>
                                    <div class="function-list">
                                        ${Object.entries(this.availableFunctions).map(([name, desc]) => 
                                            `<div><code>{{.Transcript | ${name}}}</code> - ${desc}</div>`
                                        ).join('')}
                                    </div>
                                </div>
                            </div>
                        </details>
                    </div>
                    <textarea id="action-template" placeholder="Enter your template using {{.Variable}} syntax" 
                              rows="8" maxlength="10000">${escapeHtml(action.template)}</textarea>
                </div>
                
                <div class="form-group">
                    <label>Example Templates:</label>
                    <div class="example-templates">
                        ${exampleTemplates.map((example, index) => `
                            <button type="button" class="example-btn" data-template="${escapeHtml(example.template)}">
                                ${escapeHtml(example.name)}
                            </button>
                        `).join('')}
                    </div>
                </div>
                
                <div class="modal-actions">
                    <button type="button" class="btn secondary" id="preview-action">Preview</button>
                    <button type="button" class="btn secondary" id="cancel-action">Cancel</button>
                    <button type="button" class="btn primary" id="save-action">${isEdit ? 'Update' : 'Create'} Action</button>
                </div>
            </div>
        `;
    }
    
    setupActionModalListeners(action, isEdit) {
        // Example template buttons
        document.querySelectorAll('.example-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('action-template').value = btn.dataset.template;
            });
        });
        
        // Preview button
        document.getElementById('preview-action').addEventListener('click', () => {
            this.previewTemplate();
        });
        
        // Cancel button
        document.getElementById('cancel-action').addEventListener('click', () => {
            this.closeModal();
        });
        
        // Save button
        document.getElementById('save-action').addEventListener('click', () => {
            this.saveAction(action, isEdit);
        });
    }
    
    previewTemplate() {
        const template = document.getElementById('action-template').value;
        if (!template.trim()) {
            window.whisperApp.ui.showToast('Please enter a template first', 'warning');
            return;
        }
        
        const mockContext = {
            Transcript: 'This is a sample transcript for preview purposes. It contains some action items: we need to follow up on the project status and schedule the next meeting.',
            Filename: 'sample-meeting.mp3',
            Date: new Date().toISOString().split('T')[0],
            FileType: 'audio',
            Duration: '15m 30s',
            WordCount: 150,
            CharCount: 750,
            ProcessingTime: '2.3s'
        };
        
        try {
            const preview = this.processTemplateClient(template, mockContext);
            this.showPreviewModal(preview);
        } catch (error) {
            window.whisperApp.ui.showToast('Template preview failed: ' + error.message, 'error');
        }
    }
    
    processTemplateClient(template, context) {
        let processed = template;
        
        Object.entries(context).forEach(([key, value]) => {
            const regex = new RegExp(`{{\\s*\\.${key}\\s*}}`, 'g');
            processed = processed.replace(regex, value);
        });
        
        processed = processed.replace(/{{\.Transcript\s*\|\s*summarize}}/g, 
            '- Sample transcript for preview\n- Contains action items\n- Preview of summarize function');
        processed = processed.replace(/{{\.Transcript\s*\|\s*extractActions}}/g, 
            '- [ ] Follow up on project status\n- [ ] Schedule next meeting');
        processed = processed.replace(/{{\.Transcript\s*\|\s*format}}/g, context.Transcript);
        
        return processed;
    }
    
    showPreviewModal(content) {
        // Fallback escapeHtml function
        const escapeHtml = (text) => {
            if (window.SecurityUtils && window.SecurityUtils.escapeHtml) {
                return window.SecurityUtils.escapeHtml(text);
            }
            if (typeof text !== 'string') return text;
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
        
        const previewHtml = `
            <div class="preview-content">
                <h4>Template Preview</h4>
                <div class="preview-output">
                    <pre>${escapeHtml(content)}</pre>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn primary" onclick="this.closest('.modal-overlay').remove()">Close Preview</button>
                </div>
            </div>
        `;
        
        this.showModal(previewHtml, 'Template Preview');
    }
    
    async saveAction(originalAction, isEdit) {
        const actionData = {
            name: document.getElementById('action-name').value.trim(),
            description: document.getElementById('action-description').value.trim(),
            template: document.getElementById('action-template').value.trim()
        };
        
        if (isEdit) {
            actionData.id = originalAction.id;
            actionData.created = originalAction.created;
            actionData.lastUsed = originalAction.lastUsed;
        }
        
        const errors = this.validateAction(actionData);
        if (errors.length > 0) {
            window.whisperApp.ui.showToast(errors[0], 'error');
            return;
        }
        
        try {
            await this.save(actionData);
            window.whisperApp.ui.showToast(`Action ${isEdit ? 'updated' : 'created'} successfully!`, 'success');
            this.closeModal();
            
            // Update selector if it exists
            this.populateActionSelector();
        } catch (error) {
            console.error('Failed to save action:', error);
            window.whisperApp.ui.showToast('Failed to save action', 'error');
        }
    }
    
    async showManageModal() {
        const actions = await this.load();
        const manageHtml = this.createManageModalHTML(actions);
        this.showModal(manageHtml, 'Manage Custom Actions');
        this.setupManageModalListeners();
    }
    
    createManageModalHTML(actions) {
        // Fallback escapeHtml function
        const escapeHtml = (text) => {
            if (window.SecurityUtils && window.SecurityUtils.escapeHtml) {
                return window.SecurityUtils.escapeHtml(text);
            }
            if (typeof text !== 'string') return text;
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
        
        if (actions.length === 0) {
            return `
                <div class="manage-content">
                    <div class="empty-state">
                        <p>No custom actions created yet.</p>
                        <button type="button" class="btn primary" id="create-first-action">Create Your First Action</button>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="manage-content">
                <div class="actions-list">
                    ${actions.map(action => `
                        <div class="action-item" data-id="${action.id}">
                            <div class="action-info">
                                <h4>${escapeHtml(action.name)}</h4>
                                <p>${escapeHtml(action.description || 'No description')}</p>
                                <div class="action-meta">
                                    <span>Created: ${new Date(action.created).toLocaleDateString()}</span>
                                    ${action.lastUsed ? `<span>Last used: ${new Date(action.lastUsed).toLocaleDateString()}</span>` : ''}
                                </div>
                            </div>
                            <div class="action-controls">
                                <button type="button" class="btn secondary edit-action" data-id="${action.id}">Edit</button>
                                <button type="button" class="btn danger delete-action" data-id="${action.id}">Delete</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn secondary" id="export-actions">Export Actions</button>
                    <button type="button" class="btn secondary" id="import-actions">Import Actions</button>
                    <button type="button" class="btn primary" id="create-new-action">Create New Action</button>
                </div>
            </div>
        `;
    }
    
    setupManageModalListeners() {
        document.getElementById('create-first-action')?.addEventListener('click', () => {
            this.closeModal();
            this.showCreateModal();
        });
        
        document.getElementById('create-new-action')?.addEventListener('click', () => {
            this.closeModal();
            this.showCreateModal();
        });
        
        document.querySelectorAll('.edit-action').forEach(btn => {
            btn.addEventListener('click', () => {
                const actionId = btn.dataset.id;
                this.closeModal();
                this.showEditModal(actionId);
            });
        });
        
        document.querySelectorAll('.delete-action').forEach(btn => {
            btn.addEventListener('click', async () => {
                const actionId = btn.dataset.id;
                if (confirm('Delete this custom action? This cannot be undone.')) {
                    await this.delete(actionId);
                    window.whisperApp.ui.showToast('Action deleted', 'success');
                    this.showManageModal(); // Refresh the modal
                }
            });
        });
        
        document.getElementById('export-actions')?.addEventListener('click', () => {
            this.exportActions();
        });
        
        document.getElementById('import-actions')?.addEventListener('click', () => {
            this.importActions();
        });
    }
    
    async exportActions() {
        const actions = await this.load();
        const exportData = {
            exported: new Date().toISOString(),
            version: '1.0',
            actions: actions
        };
        
        const content = JSON.stringify(exportData, null, 2);
        const filename = `whisper-hub-actions-${new Date().toISOString().slice(0, 10)}.json`;
        
        const blob = new Blob([content], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = SecurityUtils.sanitizeFilename(filename);
        a.click();
        window.URL.revokeObjectURL(url);
        
        window.whisperApp.ui.showToast('Actions exported!', 'success');
    }
    
    importActions() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                
                if (!data.actions || !Array.isArray(data.actions)) {
                    throw new Error('Invalid actions file format');
                }
                
                const existingActions = await this.load();
                const newActions = [...existingActions];
                
                for (const action of data.actions) {
                    action.id = this.generateId(); // Generate new IDs to avoid conflicts
                    action.created = new Date().toISOString();
                    delete action.lastUsed;
                    
                    const errors = this.validateAction(action);
                    if (errors.length === 0) {
                        newActions.push(action);
                    }
                }
                
                const encryptedData = await SecurityUtils.encryptData(JSON.stringify(newActions), this.encryptionKey);
                localStorage.setItem(this.storageKey, encryptedData);
                
                window.whisperApp.ui.showToast(`Imported ${data.actions.length} actions!`, 'success');
                this.showManageModal(); // Refresh the modal
            } catch (error) {
                console.error('Import failed:', error);
                window.whisperApp.ui.showToast('Failed to import actions', 'error');
            }
        });
        
        input.click();
    }
    
    async populateActionSelector() {
        const selector = document.getElementById('post-action-selector');
        if (!selector) return;
        
        const customActions = await this.load();
        
        // Clear existing options except the first one
        while (selector.children.length > 1) {
            selector.removeChild(selector.lastChild);
        }
        
        // Add predefined OpenAI actions
        if (this.predefinedActions && this.predefinedActions.length > 0) {
            const predefinedGroup = document.createElement('optgroup');
            predefinedGroup.label = '🤖 AI-Powered Actions';
            
            this.predefinedActions.forEach(action => {
                const option = document.createElement('option');
                option.value = action.id;
                option.textContent = action.name;
                option.title = action.description;
                predefinedGroup.appendChild(option);
            });
            
            selector.appendChild(predefinedGroup);
        }
        
        // Add custom actions if any exist
        if (customActions.length > 0) {
            const customGroup = document.createElement('optgroup');
            customGroup.label = '✨ Custom Actions';
            
            customActions.forEach(action => {
                const option = document.createElement('option');
                option.value = action.id;
                option.textContent = `${action.name} (${action.type || 'template'})`;
                option.title = action.description || '';
                customGroup.appendChild(option);
            });
            
            selector.appendChild(customGroup);
        }
    }
    
    showModal(content, title) {
        const existing = document.querySelector('.modal-overlay');
        if (existing) {
            existing.remove();
        }
        
        // Fallback escapeHtml function
        const escapeHtml = (text) => {
            if (window.SecurityUtils && window.SecurityUtils.escapeHtml) {
                return window.SecurityUtils.escapeHtml(text);
            }
            if (typeof text !== 'string') return text;
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
        
        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3>${escapeHtml(title)}</h3>
                        <button type="button" class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Close on backdrop click
        document.querySelector('.modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeModal();
            }
        });
        
        // Close button
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.closeModal();
        });
        
        // Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }
    
    closeModal() {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.remove();
        }
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.whisperApp = new WhisperApp();
});