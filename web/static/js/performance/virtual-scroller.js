/**
 * Virtual Scroller for High-Performance List Rendering
 * Renders only visible items to handle large datasets efficiently
 */

class VirtualScroller {
    constructor(container, options = {}) {
        this.container = container;
        this.itemHeight = options.itemHeight || 120;
        this.bufferSize = options.bufferSize || 5;
        this.items = [];
        this.visibleItems = [];
        this.scrollTop = 0;
        this.containerHeight = 0;
        this.totalHeight = 0;
        
        this.viewport = null;
        this.spacerTop = null;
        this.spacerBottom = null;
        
        this.init();
        this.bindEvents();
    }
    
    init() {
        // Create virtual scrolling structure
        this.container.innerHTML = '';
        this.container.style.position = 'relative';
        this.container.style.overflow = 'auto';
        
        // Top spacer
        this.spacerTop = document.createElement('div');
        this.spacerTop.style.height = '0px';
        this.container.appendChild(this.spacerTop);
        
        // Viewport for visible items
        this.viewport = document.createElement('div');
        this.viewport.style.position = 'relative';
        this.container.appendChild(this.viewport);
        
        // Bottom spacer
        this.spacerBottom = document.createElement('div');
        this.spacerBottom.style.height = '0px';
        this.container.appendChild(this.spacerBottom);
        
        this.containerHeight = this.container.clientHeight;
    }
    
    bindEvents() {
        this.container.addEventListener('scroll', this.handleScroll.bind(this));
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    handleScroll() {
        const newScrollTop = this.container.scrollTop;
        if (Math.abs(newScrollTop - this.scrollTop) > this.itemHeight / 2) {
            this.scrollTop = newScrollTop;
            this.render();
        }
    }
    
    handleResize() {
        this.containerHeight = this.container.clientHeight;
        this.render();
    }
    
    setItems(items, renderFunction) {
        this.items = items;
        this.renderFunction = renderFunction;
        this.totalHeight = items.length * this.itemHeight;
        this.render();
    }
    
    render() {
        if (!this.renderFunction || this.items.length === 0) {
            return;
        }
        
        const visibleCount = Math.ceil(this.containerHeight / this.itemHeight) + this.bufferSize * 2;
        const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize);
        const endIndex = Math.min(this.items.length, startIndex + visibleCount);
        
        // Update spacers
        const topSpacerHeight = startIndex * this.itemHeight;
        const bottomSpacerHeight = (this.items.length - endIndex) * this.itemHeight;
        
        this.spacerTop.style.height = `${topSpacerHeight}px`;
        this.spacerBottom.style.height = `${bottomSpacerHeight}px`;
        
        // Render visible items
        const fragment = document.createDocumentFragment();
        for (let i = startIndex; i < endIndex; i++) {
            const item = this.items[i];
            const element = this.renderFunction(item, i);
            
            // Ensure proper positioning
            element.style.position = 'relative';
            element.style.height = `${this.itemHeight}px`;
            element.style.boxSizing = 'border-box';
            
            fragment.appendChild(element);
        }
        
        // Update viewport with new items
        this.viewport.innerHTML = '';
        this.viewport.appendChild(fragment);
        
        // Store visible range for external access
        this.visibleRange = { start: startIndex, end: endIndex };
    }
    
    scrollToItem(index) {
        const targetScrollTop = index * this.itemHeight;
        this.container.scrollTop = targetScrollTop;
        this.scrollTop = targetScrollTop;
        this.render();
    }
    
    getVisibleRange() {
        return this.visibleRange || { start: 0, end: 0 };
    }
    
    updateItem(index) {
        const { start, end } = this.getVisibleRange();
        if (index >= start && index < end) {
            // Item is currently visible, re-render
            this.render();
        }
    }
    
    destroy() {
        this.container.removeEventListener('scroll', this.handleScroll);
        window.removeEventListener('resize', this.handleResize);
        this.container.innerHTML = '';
    }
}

/**
 * Performance-optimized History List using Virtual Scrolling
 */
class PerformantHistoryList {
    constructor(container, historyManager) {
        this.container = container;
        this.historyManager = historyManager;
        this.virtualScroller = null;
        this.searchQuery = '';
        this.filterType = 'all';
        
        this.init();
    }
    
    init() {
        this.virtualScroller = new VirtualScroller(this.container, {
            itemHeight: 120,
            bufferSize: 3
        });
    }
    
    async render(options = {}) {
        const { search = this.searchQuery, filter = this.filterType } = options;
        
        // Get filtered items
        const items = await this.historyManager.getHistory({
            search,
            fileType: filter === 'all' ? null : filter
        });
        
        // Update virtual scroller
        this.virtualScroller.setItems(items, this.createHistoryItem.bind(this));
        
        // Update search and filter state
        this.searchQuery = search;
        this.filterType = filter;
    }
    
    createHistoryItem(entry, index) {
        const item = document.createElement('div');
        item.className = 'history-item performant-item';
        item.dataset.id = entry.id;
        item.dataset.index = index;
        
        const date = new Date(entry.timestamp);
        const relativeTime = this.getRelativeTime(date);
        const fileSize = this.formatFileSize(entry.fileSize);
        const preview = this.truncateText(entry.transcript, 100);
        const typeIcon = entry.fileType === 'video' ? '🎬' : '🎵';
        const starIcon = entry.starred ? '⭐' : '☆';
        
        // Use efficient DOM creation
        item.innerHTML = `
            <div class="item-header">
                <div class="item-info">
                    <h4 class="item-title">
                        <span class="type-icon">${typeIcon}</span>
                        ${this.escapeHtml(entry.filename)}
                    </h4>
                    <div class="item-meta">
                        <span class="timestamp">${relativeTime}</span>
                        <span class="file-size">${fileSize}</span>
                        <span class="char-count">${entry.characterCount || entry.transcript.length} chars</span>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="action-btn star-btn" data-action="star" data-id="${entry.id}">${starIcon}</button>
                    <button class="action-btn copy-btn" data-action="copy" data-id="${entry.id}">📋</button>
                    <button class="action-btn download-btn" data-action="download" data-id="${entry.id}">💾</button>
                    <button class="action-btn delete-btn" data-action="delete" data-id="${entry.id}">🗑️</button>
                </div>
            </div>
            <div class="item-preview">
                <p class="preview-text">${this.escapeHtml(preview)}</p>
                <button class="expand-btn" data-action="expand" data-id="${entry.id}">Show full transcript</button>
            </div>
            <div class="item-full" style="display: none;">
                <div class="full-text">${this.escapeHtml(entry.transcript)}</div>
                <button class="collapse-btn" data-action="collapse" data-id="${entry.id}">Show less</button>
            </div>
        `;
        
        return item;
    }
    
    async updateSearch(query) {
        await this.render({ search: query });
    }
    
    async updateFilter(filter) {
        await this.render({ filter });
    }
    
    scrollToItem(index) {
        this.virtualScroller.scrollToItem(index);
    }
    
    // Utility methods
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
    
    truncateText(text, length) {
        return text.length > length ? text.substring(0, length) + '...' : text;
    }
    
    escapeHtml(text) {
        if (window.SecurityUtils) {
            return SecurityUtils.sanitizeHTML(text);
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    destroy() {
        if (this.virtualScroller) {
            this.virtualScroller.destroy();
        }
    }
}

// Export for global use
window.VirtualScroller = VirtualScroller;
window.PerformantHistoryList = PerformantHistoryList;