/**
 * History Management
 * Handles transcription history operations, search, and filtering
 */

class HistoryManager {
    constructor(storage) {
        this.storage = storage || new HistoryStorage();
        this.currentFilter = 'all';
        this.currentSearchTerm = '';
        this.sortOrder = 'desc'; // desc = newest first, asc = oldest first
        this.sortBy = 'timestamp';
        
        this.setupEventListeners();
        this.setupSearch();
    }

    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('history-search');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce((e) => {
                this.searchHistory(e.target.value);
            }, 300));
        }

        // Filter dropdown
        const filterSelect = document.getElementById('history-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.filterHistory(e.target.value);
            });
        }

        // Clear history button
        const clearButton = document.getElementById('clear-history');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                this.showClearConfirmation();
            });
        }

        // Export history button
        const exportButton = document.getElementById('export-history');
        if (exportButton) {
            exportButton.addEventListener('click', () => {
                this.showExportMenu();
            });
        }

        // Sort controls (if they exist)
        const sortControls = document.querySelectorAll('.history-sort');
        sortControls.forEach(control => {
            control.addEventListener('click', (e) => {
                const sortBy = e.target.dataset.sortBy;
                if (sortBy) {
                    this.toggleSort(sortBy);
                }
            });
        });
    }

    setupSearch() {
        // Advanced search setup
        this.searchWorker = null;
        
        // Try to create a web worker for search if possible
        try {
            const searchWorkerCode = `
                self.addEventListener('message', function(e) {
                    const { entries, searchTerm, options } = e.data;
                    const results = searchEntries(entries, searchTerm, options);
                    self.postMessage(results);
                });
                
                function searchEntries(entries, searchTerm, options = {}) {
                    if (!searchTerm) return entries;
                    
                    const term = searchTerm.toLowerCase();
                    const fields = options.fields || ['transcript', 'filename'];
                    
                    return entries.filter(entry => {
                        return fields.some(field => {
                            const value = entry[field];
                            return value && value.toLowerCase().includes(term);
                        });
                    });
                }
            `;
            
            const blob = new Blob([searchWorkerCode], { type: 'application/javascript' });
            this.searchWorker = new Worker(URL.createObjectURL(blob));
        } catch (error) {
            // Web worker not supported, use main thread
            this.searchWorker = null;
        }
    }

    async searchHistory(searchTerm) {
        this.currentSearchTerm = searchTerm;
        await this.refreshHistoryDisplay();
    }

    filterHistory(filterType) {
        this.currentFilter = filterType;
        this.refreshHistoryDisplay();
    }

    toggleSort(sortBy) {
        if (this.sortBy === sortBy) {
            this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
        } else {
            this.sortBy = sortBy;
            this.sortOrder = 'desc';
        }
        
        this.updateSortUI();
        this.refreshHistoryDisplay();
    }

    updateSortUI() {
        const sortControls = document.querySelectorAll('.history-sort');
        sortControls.forEach(control => {
            const sortBy = control.dataset.sortBy;
            control.classList.toggle('active', sortBy === this.sortBy);
            control.classList.toggle('desc', sortBy === this.sortBy && this.sortOrder === 'desc');
            control.classList.toggle('asc', sortBy === this.sortBy && this.sortOrder === 'asc');
        });
    }

    async refreshHistoryDisplay() {
        try {
            let entries = await this.storage.getAllEntries();
            
            // Apply filters
            entries = this.applyFilters(entries);
            
            // Apply search
            entries = await this.applySearch(entries);
            
            // Apply sorting
            entries = this.applySorting(entries);
            
            // Update display
            this.displayHistoryEntries(entries);
            this.updateHistoryCount(entries.length);
            
        } catch (error) {
            console.error('Failed to refresh history display:', error);
            this.showError('Failed to load history');
        }
    }

    applyFilters(entries) {
        switch (this.currentFilter) {
            case 'audio':
                return entries.filter(entry => 
                    entry.fileType && entry.fileType.startsWith('audio/')
                );
            case 'video':
                return entries.filter(entry => 
                    entry.fileType && entry.fileType.startsWith('video/')
                );
            case 'recent':
                const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                return entries.filter(entry => 
                    new Date(entry.timestamp).getTime() > weekAgo
                );
            case 'large':
                return entries.filter(entry => 
                    entry.transcript && entry.transcript.length > 1000
                );
            case 'all':
            default:
                return entries;
        }
    }

    async applySearch(entries) {
        if (!this.currentSearchTerm) return entries;
        
        if (this.searchWorker) {
            // Use web worker for search
            return new Promise((resolve) => {
                this.searchWorker.onmessage = (e) => resolve(e.data);
                this.searchWorker.postMessage({
                    entries,
                    searchTerm: this.currentSearchTerm,
                    options: { fields: ['transcript', 'filename'] }
                });
            });
        } else {
            // Search on main thread
            return this.searchEntriesSync(entries, this.currentSearchTerm);
        }
    }

    searchEntriesSync(entries, searchTerm) {
        if (!searchTerm) return entries;
        
        const term = searchTerm.toLowerCase();
        return entries.filter(entry => {
            return (entry.transcript && entry.transcript.toLowerCase().includes(term)) ||
                   (entry.filename && entry.filename.toLowerCase().includes(term));
        });
    }

    applySorting(entries) {
        const sortMultiplier = this.sortOrder === 'desc' ? -1 : 1;
        
        return entries.sort((a, b) => {
            let comparison = 0;
            
            switch (this.sortBy) {
                case 'timestamp':
                    comparison = new Date(a.timestamp) - new Date(b.timestamp);
                    break;
                case 'filename':
                    comparison = (a.filename || '').localeCompare(b.filename || '');
                    break;
                case 'fileSize':
                    comparison = (a.fileSize || 0) - (b.fileSize || 0);
                    break;
                case 'duration':
                    comparison = (a.duration || 0) - (b.duration || 0);
                    break;
                case 'transcriptLength':
                    const aLength = a.transcript ? a.transcript.length : 0;
                    const bLength = b.transcript ? b.transcript.length : 0;
                    comparison = aLength - bLength;
                    break;
                default:
                    comparison = new Date(a.timestamp) - new Date(b.timestamp);
            }
            
            return comparison * sortMultiplier;
        });
    }

    displayHistoryEntries(entries) {
        const container = document.getElementById('history-list');
        if (!container) return;

        if (entries.length === 0) {
            this.displayEmptyState(container);
            return;
        }

        // Clear existing content
        container.innerHTML = '';

        // Create entries
        entries.forEach(entry => {
            const entryElement = this.createHistoryEntryElement(entry);
            container.appendChild(entryElement);
        });
    }

    displayEmptyState(container) {
        const emptyMessage = this.currentSearchTerm 
            ? `No results found for "${this.currentSearchTerm}"`
            : this.currentFilter !== 'all'
            ? `No ${this.currentFilter} files found`
            : 'No transcription history yet';

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📂</div>
                <div class="empty-message">${emptyMessage}</div>
                ${this.currentSearchTerm || this.currentFilter !== 'all' ? 
                    '<button class="clear-filters-btn" onclick="historyManager.clearFilters()">Clear Filters</button>' : 
                    '<div class="empty-hint">Start transcribing files to see them here</div>'
                }
            </div>
        `;
    }

    createHistoryEntryElement(entry) {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'history-entry';
        entryDiv.dataset.entryId = entry.id;

        const date = new Date(entry.timestamp);
        const formattedDate = this.formatDate(date);
        const fileIcon = this.getFileIcon(entry.fileType);
        const previewText = this.getPreviewText(entry.transcript);

        entryDiv.innerHTML = `
            <div class="entry-header">
                <div class="entry-info">
                    <div class="entry-title">
                        <span class="file-icon">${fileIcon}</span>
                        <span class="filename" title="${entry.filename || 'Untitled'}">${entry.filename || 'Untitled'}</span>
                    </div>
                    <div class="entry-meta">
                        <span class="timestamp">${formattedDate}</span>
                        ${entry.fileSize ? `<span class="file-size">${this.formatFileSize(entry.fileSize)}</span>` : ''}
                        ${entry.duration ? `<span class="duration">${this.formatDuration(entry.duration)}</span>` : ''}
                    </div>
                </div>
                <div class="entry-actions">
                    <button class="action-btn view-btn" onclick="historyManager.viewEntry('${entry.id}')" title="View Full Transcript">
                        👁️
                    </button>
                    <button class="action-btn copy-btn" onclick="historyManager.copyEntry('${entry.id}')" title="Copy Transcript">
                        📋
                    </button>
                    <button class="action-btn download-btn" onclick="historyManager.downloadEntry('${entry.id}')" title="Download">
                        💾
                    </button>
                    <button class="action-btn delete-btn" onclick="historyManager.deleteEntry('${entry.id}')" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
            <div class="entry-preview">
                <div class="transcript-preview">${previewText}</div>
                ${entry.wordCount ? `<div class="word-count">${entry.wordCount} words</div>` : ''}
            </div>
        `;

        return entryDiv;
    }

    async viewEntry(entryId) {
        try {
            const entry = await this.storage.getEntry(entryId);
            if (!entry) {
                this.showError('Entry not found');
                return;
            }

            this.showEntryModal(entry);
        } catch (error) {
            console.error('Failed to view entry:', error);
            this.showError('Failed to view entry');
        }
    }

    async copyEntry(entryId) {
        try {
            const entry = await this.storage.getEntry(entryId);
            if (!entry) {
                this.showError('Entry not found');
                return;
            }

            await navigator.clipboard.writeText(entry.transcript);
            this.showToast('Transcript copied to clipboard', 'success');
        } catch (error) {
            console.error('Failed to copy entry:', error);
            this.showError('Failed to copy transcript');
        }
    }

    async downloadEntry(entryId) {
        try {
            const entry = await this.storage.getEntry(entryId);
            if (!entry) {
                this.showError('Entry not found');
                return;
            }

            const filename = `${entry.filename || 'transcript'}-${Date.now()}.txt`;
            const content = this.formatEntryForDownload(entry);
            
            this.downloadFile(content, filename, 'text/plain');
            this.showToast('Transcript downloaded', 'success');
        } catch (error) {
            console.error('Failed to download entry:', error);
            this.showError('Failed to download transcript');
        }
    }

    async deleteEntry(entryId) {
        const confirmed = confirm('Are you sure you want to delete this transcript?');
        if (!confirmed) return;

        try {
            await this.storage.deleteEntry(entryId);
            this.refreshHistoryDisplay();
            this.showToast('Transcript deleted', 'info');
        } catch (error) {
            console.error('Failed to delete entry:', error);
            this.showError('Failed to delete transcript');
        }
    }

    clearFilters() {
        this.currentFilter = 'all';
        this.currentSearchTerm = '';
        
        // Reset UI
        const searchInput = document.getElementById('history-search');
        const filterSelect = document.getElementById('history-filter');
        
        if (searchInput) searchInput.value = '';
        if (filterSelect) filterSelect.value = 'all';
        
        this.refreshHistoryDisplay();
    }

    showClearConfirmation() {
        const confirmed = confirm(
            'Are you sure you want to clear all transcription history?\n\n' +
            'This will permanently delete all saved transcripts.\n' +
            'This action cannot be undone.'
        );

        if (confirmed) {
            this.clearAllHistory();
        }
    }

    async clearAllHistory() {
        try {
            await this.storage.clearAll();
            this.refreshHistoryDisplay();
            this.showToast('All history cleared', 'info');
        } catch (error) {
            console.error('Failed to clear history:', error);
            this.showError('Failed to clear history');
        }
    }

    showExportMenu() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content export-modal">
                <div class="modal-header">
                    <h3>Export History</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="export-options">
                        <button class="export-btn" onclick="historyManager.exportHistory('json')">
                            <span class="export-icon">📋</span>
                            <span class="export-label">JSON Format</span>
                            <span class="export-desc">Complete data with metadata</span>
                        </button>
                        <button class="export-btn" onclick="historyManager.exportHistory('csv')">
                            <span class="export-icon">📊</span>
                            <span class="export-label">CSV Format</span>
                            <span class="export-desc">Spreadsheet compatible</span>
                        </button>
                        <button class="export-btn" onclick="historyManager.exportHistory('txt')">
                            <span class="export-icon">📄</span>
                            <span class="export-label">Text Format</span>
                            <span class="export-desc">Plain text transcripts</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async exportHistory(format) {
        try {
            const entries = await this.storage.getAllEntries();
            const exporter = new HistoryExporter();
            await exporter.export(entries, format);
            
            // Close export modal
            const modal = document.querySelector('.export-modal');
            if (modal) {
                modal.closest('.modal-overlay').remove();
            }
            
            this.showToast(`History exported as ${format.toUpperCase()}`, 'success');
        } catch (error) {
            console.error('Export failed:', error);
            this.showError('Export failed');
        }
    }

    // Utility methods
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

    formatDate(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    getFileIcon(fileType) {
        if (!fileType) return '📄';
        if (fileType.startsWith('audio/')) return '🎵';
        if (fileType.startsWith('video/')) return '🎬';
        return '📄';
    }

    getPreviewText(transcript, maxLength = 120) {
        if (!transcript) return 'No transcript available';
        if (transcript.length <= maxLength) return transcript;
        return transcript.substring(0, maxLength) + '...';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    formatEntryForDownload(entry) {
        return `Title: ${entry.filename || 'Untitled'}
Date: ${new Date(entry.timestamp).toLocaleString()}
File Type: ${entry.fileType || 'Unknown'}
Duration: ${entry.duration ? this.formatDuration(entry.duration) : 'Unknown'}

Transcript:
${entry.transcript || 'No transcript available'}`;
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

    updateHistoryCount(count) {
        const countElement = document.getElementById('history-count');
        if (countElement) {
            countElement.textContent = count;
            countElement.style.display = count > 0 ? 'inline' : 'none';
        }
    }

    showToast(message, type = 'info') {
        // Implementation depends on toast system
        console.log(`${type.toUpperCase()}: ${message}`);
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showEntryModal(entry) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content entry-modal">
                <div class="modal-header">
                    <h3>${entry.filename || 'Transcript'}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="entry-details">
                        <div class="detail-row">
                            <span class="label">Date:</span>
                            <span class="value">${new Date(entry.timestamp).toLocaleString()}</span>
                        </div>
                        ${entry.fileType ? `
                        <div class="detail-row">
                            <span class="label">Type:</span>
                            <span class="value">${entry.fileType}</span>
                        </div>` : ''}
                        ${entry.fileSize ? `
                        <div class="detail-row">
                            <span class="label">Size:</span>
                            <span class="value">${this.formatFileSize(entry.fileSize)}</span>
                        </div>` : ''}
                        ${entry.duration ? `
                        <div class="detail-row">
                            <span class="label">Duration:</span>
                            <span class="value">${this.formatDuration(entry.duration)}</span>
                        </div>` : ''}
                    </div>
                    <div class="transcript-content">
                        <h4>Transcript:</h4>
                        <div class="transcript-text">${entry.transcript || 'No transcript available'}</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" onclick="historyManager.copyEntry('${entry.id}')">Copy Text</button>
                    <button class="btn" onclick="historyManager.downloadEntry('${entry.id}')">Download</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
}

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HistoryManager;
} else if (typeof window !== 'undefined') {
    window.HistoryManager = HistoryManager;
}