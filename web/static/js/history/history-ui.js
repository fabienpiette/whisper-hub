/**
 * HistoryUI - User interface components for history management
 * Integrates with HTMX patterns and responsive design
 */

class HistoryUI {
    constructor(historyManager) {
        this.historyManager = historyManager;
        this.eventBus = historyManager.getEventBus();
        this.currentView = 'list'; // list, search, settings
        this.selectedEntries = new Set();
        this.loadMoreOffset = 0;
        this.loadMoreLimit = 10;
        
        this.init();
    }

    /**
     * Initialize the UI components
     */
    init() {
        this.createHistorySection();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
    }

    /**
     * Create the main history section HTML
     */
    createHistorySection() {
        const existingSection = document.querySelector('#history-panel');
        if (existingSection) {
            existingSection.remove();
        }

        const historyHTML = `
            <div id="history-panel" class="history-section collapsed">
                <div class="history-header">
                    <div class="history-title">
                        <h3>📚 Transcription History</h3>
                        <div class="history-controls">
                            <button id="toggle-history" class="btn btn-secondary">
                                <span class="toggle-text">Show History</span> 
                                <span id="history-count" class="count-badge">0</span>
                            </button>
                            <button id="history-settings" class="btn btn-tertiary" title="Privacy Settings">⚙️</button>
                        </div>
                    </div>
                    
                    <div class="history-actions">
                        <div class="search-container">
                            <input type="search" 
                                   id="history-search" 
                                   placeholder="Search transcripts..." 
                                   class="search-input">
                            <span class="search-icon">🔍</span>
                        </div>
                        
                        <select id="history-filter" class="filter-select">
                            <option value="all">All Files</option>
                            <option value="audio">Audio Only</option>
                            <option value="video">Video Only</option>
                            <option value="starred">Starred</option>
                        </select>
                        
                        <div class="action-buttons">
                            <button id="export-history" class="btn btn-small" title="Export History">📤</button>
                            <button id="clear-history" class="btn btn-small btn-danger" title="Clear All">🗑️</button>
                        </div>
                    </div>
                </div>
                
                <div id="history-content" class="history-content">
                    <div id="history-list" class="history-items">
                        <!-- History items will be populated here -->
                    </div>
                    
                    <div class="history-footer">
                        <button id="load-more" class="btn btn-secondary" style="display: none;">Load More</button>
                        <div class="history-stats">
                            <span id="stats-text">No transcriptions yet</span>
                        </div>
                    </div>
                </div>
                
                <div class="history-empty" id="history-empty" style="display: none;">
                    <div class="empty-icon">📝</div>
                    <h4>No Transcriptions Yet</h4>
                    <p>Your transcription history will appear here after you process audio or video files.</p>
                    <div class="privacy-note">
                        <span class="privacy-icon">🔒</span>
                        <span>Your data stays on your device</span>
                    </div>
                </div>
            </div>
        `;

        // Insert after the main form
        const form = document.querySelector('form');
        if (form) {
            form.insertAdjacentHTML('afterend', historyHTML);
        } else {
            document.body.insertAdjacentHTML('beforeend', historyHTML);
        }
    }

    /**
     * Render history items in the list
     */
    async renderHistoryItems(entries = null) {
        const listContainer = document.getElementById('history-list');
        const emptyContainer = document.getElementById('history-empty');
        
        if (!entries) {
            entries = await this.historyManager.getHistory({ limit: this.loadMoreLimit });
        }

        if (entries.length === 0) {
            listContainer.style.display = 'none';
            emptyContainer.style.display = 'block';
            this.updateStats();
            return;
        }

        listContainer.style.display = 'block';
        emptyContainer.style.display = 'none';
        
        // Clear existing items if this is a fresh load
        if (this.loadMoreOffset === 0) {
            listContainer.innerHTML = '';
        }

        // Render each entry
        entries.forEach(entry => {
            const itemElement = this.createHistoryItem(entry);
            listContainer.appendChild(itemElement);
        });

        // Update load more button
        this.updateLoadMoreButton(entries.length);
        
        // Update statistics
        this.updateStats();
        
        // Update counter
        this.updateHistoryCount();
    }

    /**
     * Create individual history item HTML
     */
    createHistoryItem(entry) {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.dataset.id = entry.id;
        item.dataset.fileType = entry.fileType;
        
        const date = new Date(entry.timestamp);
        const relativeTime = this.getRelativeTime(date);
        const fileSize = this.formatFileSize(entry.fileSize);
        const duration = entry.duration ? this.formatDuration(entry.duration) : '';
        const truncatedTranscript = this.truncateText(entry.transcript, 150);
        const typeIcon = entry.fileType === 'video' ? '🎬' : '🎵';
        const starClass = entry.starred ? 'starred' : '';
        const tags = (entry.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('');

        item.innerHTML = `
            <div class="history-item-header">
                <div class="history-item-info">
                    <h4 class="filename">
                        <span class="type-icon">${typeIcon}</span>
                        ${this.escapeHtml(entry.filename)}
                    </h4>
                    <div class="metadata">
                        <span class="timestamp" title="${date.toLocaleString()}">${relativeTime}</span>
                        <span class="file-type badge">${entry.fileType}</span>
                        <span class="size">${fileSize}</span>
                        ${duration ? `<span class="duration">${duration}</span>` : ''}
                        <span class="char-count">${entry.characterCount} chars</span>
                    </div>
                </div>
                <div class="history-item-actions">
                    <button class="star-btn ${starClass}" data-action="star" title="Star">⭐</button>
                    <button class="copy-btn" data-action="copy" title="Copy Transcript">📋</button>
                    <button class="download-btn" data-action="download" title="Download">💾</button>
                    <button class="delete-btn" data-action="delete" title="Delete">🗑️</button>
                </div>
            </div>
            
            <div class="transcript-preview">
                <p class="transcript-text">${this.escapeHtml(truncatedTranscript)}</p>
                <button class="expand-btn" data-action="expand">Show Full Transcript</button>
            </div>
            
            <div class="tags-section">
                <div class="tags">${tags}</div>
                <button class="add-tag-btn" data-action="add-tag">+ Tag</button>
            </div>
            
            <div class="full-transcript" style="display: none;">
                <div class="transcript-full">${this.escapeHtml(entry.transcript)}</div>
                <button class="collapse-btn" data-action="collapse">Show Less</button>
            </div>
        `;

        return item;
    }

    /**
     * Setup event listeners for UI interactions
     */
    setupEventListeners() {
        // Toggle history panel
        document.getElementById('toggle-history').addEventListener('click', () => {
            this.toggleHistoryPanel();
        });

        // Privacy settings
        document.getElementById('history-settings').addEventListener('click', () => {
            this.historyManager.privacy.showPrivacySettings();
        });

        // Search functionality
        const searchInput = document.getElementById('history-search');
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.handleSearch(e.target.value);
            }, 300);
        });

        // Filter functionality
        document.getElementById('history-filter').addEventListener('change', (e) => {
            this.handleFilter(e.target.value);
        });

        // Export functionality
        document.getElementById('export-history').addEventListener('click', () => {
            this.showExportMenu();
        });

        // Clear all functionality
        document.getElementById('clear-history').addEventListener('click', () => {
            this.historyManager.clearAll();
        });

        // Load more functionality
        document.getElementById('load-more').addEventListener('click', () => {
            this.loadMore();
        });

        // History item actions (using event delegation)
        document.addEventListener('click', (e) => {
            if (e.target.closest('.history-item')) {
                this.handleHistoryItemAction(e);
            }
        });

        // History manager events
        this.eventBus.on('history:added', () => {
            this.renderHistoryItems();
        });

        this.eventBus.on('history:deleted', () => {
            this.renderHistoryItems();
        });

        this.eventBus.on('history:cleared', () => {
            this.renderHistoryItems();
        });

        this.eventBus.on('history:search-changed', () => {
            this.renderHistoryItems();
        });
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only if not typing in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.key) {
                case 'h':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.toggleHistoryPanel();
                    }
                    break;
                case '/':
                    e.preventDefault();
                    document.getElementById('history-search').focus();
                    break;
                case 'Escape':
                    document.getElementById('history-search').blur();
                    break;
            }
        });
    }

    /**
     * Toggle history panel visibility
     */
    toggleHistoryPanel() {
        const panel = document.getElementById('history-panel');
        const toggleBtn = document.getElementById('toggle-history');
        const toggleText = toggleBtn.querySelector('.toggle-text');
        
        if (panel.classList.contains('collapsed')) {
            panel.classList.remove('collapsed');
            toggleText.textContent = 'Hide History';
            this.renderHistoryItems(); // Load data when showing
        } else {
            panel.classList.add('collapsed');
            toggleText.textContent = 'Show History';
        }
    }

    /**
     * Handle search input
     */
    handleSearch(searchTerm) {
        this.loadMoreOffset = 0; // Reset pagination
        this.historyManager.updateFilters({ search: searchTerm });
    }

    /**
     * Handle filter selection
     */
    handleFilter(filterValue) {
        this.loadMoreOffset = 0; // Reset pagination
        const fileType = filterValue === 'all' ? null : filterValue;
        const starred = filterValue === 'starred' ? true : null;
        
        this.historyManager.updateFilters({ 
            fileType: fileType,
            starred: starred 
        });
    }

    /**
     * Handle history item actions
     */
    async handleHistoryItemAction(e) {
        const action = e.target.dataset.action;
        const historyItem = e.target.closest('.history-item');
        const entryId = historyItem.dataset.id;

        switch (action) {
            case 'star':
                await this.toggleStar(entryId, e.target);
                break;
            case 'copy':
                await this.copyTranscript(entryId, e.target);
                break;
            case 'download':
                await this.downloadTranscript(entryId, e.target);
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
            case 'add-tag':
                await this.addTag(entryId, historyItem);
                break;
        }
    }

    /**
     * Toggle star status for an entry
     */
    async toggleStar(entryId, button) {
        // This would need to be implemented in the storage layer
        // For now, just toggle the visual state
        button.classList.toggle('starred');
        
        // Show feedback
        const originalText = button.textContent;
        button.textContent = button.classList.contains('starred') ? '⭐' : '☆';
        
        setTimeout(() => {
            button.textContent = originalText;
        }, 1000);
    }

    /**
     * Copy transcript to clipboard
     */
    async copyTranscript(entryId, button) {
        try {
            const entries = await this.historyManager.getHistory();
            const entry = entries.find(e => e.id === entryId);
            
            if (entry) {
                await navigator.clipboard.writeText(entry.transcript);
                this.showButtonFeedback(button, '✅ Copied!');
            }
        } catch (error) {
            console.error('Failed to copy transcript:', error);
            this.showButtonFeedback(button, '❌ Failed');
        }
    }

    /**
     * Download transcript as file
     */
    async downloadTranscript(entryId, button) {
        try {
            const entries = await this.historyManager.getHistory();
            const entry = entries.find(e => e.id === entryId);
            
            if (entry) {
                const filename = this.generateTranscriptFilename(entry.filename);
                const content = this.formatTranscriptForDownload(entry);
                
                this.downloadFile(content, filename, 'text/plain');
                this.showButtonFeedback(button, '✅ Downloaded!');
            }
        } catch (error) {
            console.error('Failed to download transcript:', error);
            this.showButtonFeedback(button, '❌ Failed');
        }
    }

    /**
     * Delete history entry
     */
    async deleteEntry(entryId) {
        if (confirm('Delete this transcription from history?')) {
            await this.historyManager.deleteEntry(entryId);
        }
    }

    /**
     * Expand transcript view
     */
    expandTranscript(historyItem) {
        const preview = historyItem.querySelector('.transcript-preview');
        const full = historyItem.querySelector('.full-transcript');
        
        preview.style.display = 'none';
        full.style.display = 'block';
    }

    /**
     * Collapse transcript view
     */
    collapseTranscript(historyItem) {
        const preview = historyItem.querySelector('.transcript-preview');
        const full = historyItem.querySelector('.full-transcript');
        
        preview.style.display = 'block';
        full.style.display = 'none';
    }

    /**
     * Add tag to entry
     */
    async addTag(entryId, historyItem) {
        const tag = prompt('Enter a tag:');
        if (tag && tag.trim()) {
            // This would need to be implemented in the storage layer
            const tagsContainer = historyItem.querySelector('.tags');
            const tagElement = document.createElement('span');
            tagElement.className = 'tag';
            tagElement.textContent = tag.trim();
            tagsContainer.appendChild(tagElement);
        }
    }

    /**
     * Show export format menu
     */
    showExportMenu() {
        const menu = document.createElement('div');
        menu.className = 'export-menu';
        menu.innerHTML = `
            <div class="export-options">
                <button data-format="json" class="export-option">
                    <span class="option-icon">📄</span>
                    <div>
                        <strong>JSON</strong>
                        <p>Complete data with metadata</p>
                    </div>
                </button>
                <button data-format="csv" class="export-option">
                    <span class="option-icon">📊</span>
                    <div>
                        <strong>CSV</strong>
                        <p>Spreadsheet-compatible format</p>
                    </div>
                </button>
                <button data-format="txt" class="export-option">
                    <span class="option-icon">📝</span>
                    <div>
                        <strong>Text</strong>
                        <p>Human-readable transcripts</p>
                    </div>
                </button>
            </div>
        `;

        // Position near export button
        const exportBtn = document.getElementById('export-history');
        const rect = exportBtn.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = (rect.bottom + 5) + 'px';
        menu.style.right = (window.innerWidth - rect.right) + 'px';

        document.body.appendChild(menu);

        // Handle selection
        menu.addEventListener('click', (e) => {
            const format = e.target.closest('[data-format]')?.dataset.format;
            if (format) {
                this.historyManager.exportData(format);
                document.body.removeChild(menu);
            }
        });

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    document.removeEventListener('click', closeMenu);
                    if (menu.parentNode) {
                        document.body.removeChild(menu);
                    }
                }
            });
        }, 10);
    }

    /**
     * Load more history entries
     */
    async loadMore() {
        this.loadMoreOffset += this.loadMoreLimit;
        const entries = await this.historyManager.getHistory({ 
            offset: this.loadMoreOffset,
            limit: this.loadMoreLimit 
        });
        
        if (entries.length > 0) {
            // Append to existing list
            const listContainer = document.getElementById('history-list');
            entries.forEach(entry => {
                const itemElement = this.createHistoryItem(entry);
                listContainer.appendChild(itemElement);
            });
            
            this.updateLoadMoreButton(entries.length);
        }
    }

    /**
     * Update load more button visibility
     */
    updateLoadMoreButton(loadedCount) {
        const loadMoreBtn = document.getElementById('load-more');
        loadMoreBtn.style.display = loadedCount === this.loadMoreLimit ? 'block' : 'none';
    }

    /**
     * Update history statistics display
     */
    async updateStats() {
        try {
            const stats = await this.historyManager.getStats();
            const statsElement = document.getElementById('stats-text');
            
            if (stats.totalEntries === 0) {
                statsElement.textContent = 'No transcriptions yet';
            } else {
                const audioText = stats.audioCount > 0 ? `${stats.audioCount} audio` : '';
                const videoText = stats.videoCount > 0 ? `${stats.videoCount} video` : '';
                const typeText = [audioText, videoText].filter(Boolean).join(', ');
                
                statsElement.textContent = `${stats.totalEntries} transcriptions (${typeText}) • ${stats.totalMB} MB used`;
            }
        } catch (error) {
            console.error('Failed to update stats:', error);
        }
    }

    /**
     * Update history count badge
     */
    async updateHistoryCount() {
        try {
            const stats = await this.historyManager.getStats();
            const countElement = document.getElementById('history-count');
            countElement.textContent = stats.totalEntries;
            countElement.style.display = stats.totalEntries > 0 ? 'inline' : 'none';
        } catch (error) {
            console.error('Failed to update history count:', error);
        }
    }

    /**
     * Show button feedback animation
     */
    showButtonFeedback(button, text) {
        const originalText = button.textContent;
        button.textContent = text;
        button.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.transform = '';
        }, 2000);
    }

    /**
     * Utility: Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * Utility: Format duration
     */
    formatDuration(seconds) {
        if (seconds < 60) {
            return Math.round(seconds) + 's';
        } else if (seconds < 3600) {
            return Math.round(seconds / 60) + 'm';
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.round((seconds % 3600) / 60);
            return `${hours}h ${minutes}m`;
        }
    }

    /**
     * Utility: Get relative time string
     */
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

    /**
     * Utility: Truncate text
     */
    truncateText(text, length) {
        return text.length > length ? text.substring(0, length) + '...' : text;
    }

    /**
     * Utility: Escape HTML
     */
    escapeHtml(text) {
        if (window.SecurityUtils) {
            return SecurityUtils.sanitizeHTML(text);
        }
        // Fallback implementation
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Utility: Generate transcript filename
     */
    generateTranscriptFilename(originalFilename) {
        const baseName = originalFilename.replace(/\.[^/.]+$/, "");
        const filename = `${baseName}_transcript.txt`;
        
        // Use SecurityUtils if available, otherwise fallback
        return window.SecurityUtils ? 
            SecurityUtils.sanitizeFilename(filename) : 
            filename.replace(/[^a-zA-Z0-9\-_.]/g, '_');
    }

    /**
     * Utility: Format transcript for download
     */
    formatTranscriptForDownload(entry) {
        const date = new Date(entry.timestamp).toLocaleString();
        const header = `Transcript: ${entry.filename}\nDate: ${date}\nType: ${entry.fileType}\nCharacters: ${entry.characterCount}\n\n`;
        return header + '='.repeat(50) + '\n\n' + entry.transcript;
    }

    /**
     * Utility: Download file
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
}

// Make class globally available
window.HistoryUI = HistoryUI;