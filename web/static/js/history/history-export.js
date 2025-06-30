/**
 * HistoryExport - Data export functionality with multiple formats
 * GDPR/CCPA compliant data portability
 */

class HistoryExport {
    constructor(historyManager) {
        this.historyManager = historyManager;
        this.supportedFormats = ['json', 'csv', 'txt', 'html'];
    }

    /**
     * Export history data in specified format
     */
    async exportData(format = 'json', options = {}) {
        try {
            // Validate format
            if (!this.supportedFormats.includes(format.toLowerCase())) {
                throw new Error(`Unsupported export format: ${format}`);
            }

            // Get all history entries
            const entries = await this.historyManager.getHistory();
            if (entries.length === 0) {
                throw new Error('No history entries to export');
            }

            // Get statistics
            const stats = await this.historyManager.getStats();

            // Format data
            const exportData = await this.formatData(entries, stats, format, options);

            // Generate filename
            const filename = this.generateFilename(format, options);

            // Download file
            this.downloadFile(exportData.content, filename, exportData.mimeType);

            // Track export
            this.trackExport(format, entries.length);

            return {
                success: true,
                filename,
                format,
                entryCount: entries.length
            };

        } catch (error) {
            console.error('Export failed:', error);
            this.showExportError(error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Format data for export based on format type
     */
    async formatData(entries, stats, format, options) {
        const metadata = {
            exportDate: new Date().toISOString(),
            version: '1.0.0',
            totalEntries: entries.length,
            ...stats
        };

        switch (format.toLowerCase()) {
            case 'json':
                return this.formatJSON(entries, metadata, options);
            case 'csv':
                return this.formatCSV(entries, metadata, options);
            case 'txt':
                return this.formatTXT(entries, metadata, options);
            case 'html':
                return this.formatHTML(entries, metadata, options);
            default:
                throw new Error(`Format not implemented: ${format}`);
        }
    }

    /**
     * Format as JSON with complete metadata
     */
    formatJSON(entries, metadata, options) {
        const exportObject = {
            metadata: {
                ...metadata,
                exportedBy: 'Whisper Hub',
                source: 'client-side-storage',
                privacy: 'data-never-left-device'
            },
            settings: options.includeSettings ? this.historyManager.storage.getSettings() : undefined,
            entries: options.minimalData ? this.minimizeEntries(entries) : entries
        };

        return {
            content: JSON.stringify(exportObject, null, 2),
            mimeType: 'application/json'
        };
    }

    /**
     * Format as CSV for spreadsheet compatibility
     */
    formatCSV(entries, metadata, options) {
        const headers = [
            'Date',
            'Filename', 
            'File Type',
            'File Size (bytes)',
            'Duration (seconds)',
            'Characters',
            'Processing Time (ms)',
            'Starred',
            'Tags',
            'Transcript'
        ];

        const rows = entries.map(entry => {
            const date = new Date(entry.timestamp).toISOString();
            const tags = (entry.tags || []).join(';');
            const transcript = options.truncateTranscripts ? 
                this.truncateText(entry.transcript, 500) : 
                entry.transcript;
            
            return [
                date,
                entry.filename,
                entry.fileType,
                entry.fileSize,
                entry.duration || '',
                entry.characterCount,
                entry.processingTime || '',
                entry.starred ? 'Yes' : 'No',
                tags,
                transcript
            ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
        });

        const csvContent = [
            `# Whisper Hub History Export`,
            `# Exported: ${metadata.exportDate}`,
            `# Total Entries: ${metadata.totalEntries}`,
            `# Privacy: Data never left your device`,
            '',
            headers.join(','),
            ...rows
        ].join('\n');

        return {
            content: csvContent,
            mimeType: 'text/csv'
        };
    }

    /**
     * Format as human-readable text
     */
    formatTXT(entries, metadata, options) {
        const header = [
            '='.repeat(60),
            'WHISPER HUB TRANSCRIPTION HISTORY',
            '='.repeat(60),
            '',
            `Exported: ${new Date(metadata.exportDate).toLocaleString()}`,
            `Total Entries: ${metadata.totalEntries}`,
            `Audio Files: ${metadata.audioCount || 0}`,
            `Video Files: ${metadata.videoCount || 0}`,
            `Storage Used: ${metadata.totalMB} MB`,
            '',
            'Privacy Notice: This data never left your device.',
            'All transcriptions were processed locally in your browser.',
            '',
            '='.repeat(60),
            ''
        ].join('\n');

        const entryContent = entries.map((entry, index) => {
            const date = new Date(entry.timestamp).toLocaleString();
            const duration = entry.duration ? ` (${this.formatDuration(entry.duration)})` : '';
            const tags = entry.tags && entry.tags.length > 0 ? `\nTags: ${entry.tags.join(', ')}` : '';
            const starred = entry.starred ? ' ⭐' : '';
            const fileSize = this.formatFileSize(entry.fileSize);
            
            const transcript = options.includeFullTranscripts ? 
                entry.transcript : 
                this.truncateText(entry.transcript, 500) + '...';

            return [
                `${index + 1}. ${entry.filename}${starred}`,
                `Date: ${date}`,
                `Type: ${entry.fileType}${duration}`,
                `Size: ${fileSize}`,
                `Characters: ${entry.characterCount}${tags}`,
                '',
                transcript,
                '',
                '-'.repeat(40),
                ''
            ].join('\n');
        }).join('\n');

        return {
            content: header + entryContent,
            mimeType: 'text/plain'
        };
    }

    /**
     * Format as HTML for web viewing
     */
    formatHTML(entries, metadata, options) {
        const styles = `
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 1200px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
                .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
                .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
                .entry { background: white; border: 1px solid #e9ecef; border-radius: 8px; margin: 20px 0; padding: 20px; }
                .entry-header { display: flex; justify-content: between; align-items: center; margin-bottom: 15px; }
                .filename { font-weight: bold; color: #495057; margin: 0; }
                .metadata { color: #6c757d; font-size: 0.9em; margin: 5px 0; }
                .transcript { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 15px; white-space: pre-wrap; }
                .tags { margin-top: 10px; }
                .tag { background: #e9ecef; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; margin-right: 5px; }
                .starred { color: #ffc107; }
            </style>
        `;

        const headerHTML = `
            <div class="header">
                <h1>📚 Whisper Hub Transcription History</h1>
                <p>Exported on ${new Date(metadata.exportDate).toLocaleString()}</p>
                <p><strong>Privacy:</strong> This data never left your device</p>
            </div>
            
            <div class="stats">
                <div class="stat-card">
                    <h3>${metadata.totalEntries}</h3>
                    <p>Total Transcriptions</p>
                </div>
                <div class="stat-card">
                    <h3>${metadata.audioCount || 0}</h3>
                    <p>Audio Files</p>
                </div>
                <div class="stat-card">
                    <h3>${metadata.videoCount || 0}</h3>
                    <p>Video Files</p>
                </div>
                <div class="stat-card">
                    <h3>${metadata.totalMB} MB</h3>
                    <p>Storage Used</p>
                </div>
            </div>
        `;

        const entriesHTML = entries.map(entry => {
            const date = new Date(entry.timestamp).toLocaleString();
            const duration = entry.duration ? ` (${this.formatDuration(entry.duration)})` : '';
            const starred = entry.starred ? '<span class="starred">⭐</span>' : '';
            const tags = (entry.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('');
            const fileSize = this.formatFileSize(entry.fileSize);
            
            return `
                <div class="entry">
                    <div class="entry-header">
                        <h3 class="filename">${entry.fileType === 'video' ? '🎬' : '🎵'} ${this.escapeHtml(entry.filename)} ${starred}</h3>
                    </div>
                    <div class="metadata">
                        <div><strong>Date:</strong> ${date}</div>
                        <div><strong>Type:</strong> ${entry.fileType}${duration}</div>
                        <div><strong>Size:</strong> ${fileSize}</div>
                        <div><strong>Characters:</strong> ${entry.characterCount}</div>
                    </div>
                    ${tags ? `<div class="tags">${tags}</div>` : ''}
                    <div class="transcript">${this.escapeHtml(entry.transcript)}</div>
                </div>
            `;
        }).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Whisper Hub History Export</title>
                ${styles}
            </head>
            <body>
                ${headerHTML}
                ${entriesHTML}
            </body>
            </html>
        `;

        return {
            content: htmlContent,
            mimeType: 'text/html'
        };
    }

    /**
     * Minimize entries for smaller file size
     */
    minimizeEntries(entries) {
        return entries.map(entry => ({
            id: entry.id,
            timestamp: entry.timestamp,
            filename: entry.filename,
            fileType: entry.fileType,
            characterCount: entry.characterCount,
            transcript: entry.transcript,
            starred: entry.starred,
            tags: entry.tags
        }));
    }

    /**
     * Generate filename with timestamp
     */
    generateFilename(format, options) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        const suffix = options.minimalData ? '-minimal' : '';
        return `whisper-hub-history${suffix}-${timestamp}.${format}`;
    }

    /**
     * Download file to user's device
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
     * Track export for analytics (privacy-safe)
     */
    trackExport(format, entryCount) {
        // Emit event for the history manager
        this.historyManager.eventBus.emit('history:export-completed', {
            format,
            entryCount,
            timestamp: Date.now()
        });

        // Track with metrics if available
        if (window.historyMetrics) {
            window.historyMetrics.track('export', { format });
        }
    }

    /**
     * Show export error to user
     */
    showExportError(message) {
        const notification = document.createElement('div');
        notification.className = 'export-error-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">❌</span>
                <span class="notification-text">Export failed: ${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);

        // Manual close
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.parentNode.removeChild(notification);
        });
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
     * Utility: Truncate text
     */
    truncateText(text, length) {
        return text.length > length ? text.substring(0, length) : text;
    }

    /**
     * Utility: Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Make class globally available
window.HistoryExport = HistoryExport;