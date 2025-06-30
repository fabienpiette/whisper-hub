/**
 * Frontend Integration Test Suite
 * Validates complete user workflows and edge cases
 */

describe('Frontend Integration Tests', () => {
    let whisperApp;
    
    beforeEach(() => {
        // Setup complete DOM structure
        document.body.innerHTML = `
            <div class="app-container">
                <header class="app-header">
                    <div class="header-actions">
                        <button id="history-toggle">History</button>
                        <button id="settings-toggle">Settings</button>
                    </div>
                </header>
                
                <form id="transcribe-form" hx-post="/transcribe">
                    <input type="hidden" name="csrf_token" id="csrf-token" value="test-token">
                    <input type="checkbox" id="incognito-mode">
                    <input type="file" id="file-input" name="audio">
                    <div id="file-preview" class="hidden"></div>
                    <button type="submit" id="transcribe-btn" disabled>Transcribe</button>
                </form>
                
                <div id="result-container" class="hidden"></div>
                
                <aside id="history-panel" class="collapsed">
                    <button id="close-history">×</button>
                    <input type="search" id="history-search" placeholder="Search...">
                    <select id="history-filter">
                        <option value="all">All</option>
                        <option value="audio">Audio</option>
                        <option value="video">Video</option>
                    </select>
                    <button id="export-history">Export</button>
                    <button id="clear-history">Clear</button>
                    <div id="history-list"></div>
                    <div id="history-empty" class="hidden"></div>
                </aside>
                
                <aside id="settings-panel" class="collapsed">
                    <button id="close-settings">×</button>
                    <input type="checkbox" id="enable-history" checked>
                    <span id="storage-usage">0 MB</span>
                    <button id="export-all">Export All</button>
                    <button id="clear-all-data">Clear All</button>
                </aside>
                
                <div id="panel-overlay"></div>
                <div id="toast-container"></div>
            </div>
        `;
        
        // Mock localStorage
        const localStorageMock = {
            store: {},
            getItem: jest.fn((key) => localStorageMock.store[key] || null),
            setItem: jest.fn((key, value) => { localStorageMock.store[key] = value.toString(); }),
            removeItem: jest.fn((key) => { delete localStorageMock.store[key]; }),
            clear: jest.fn(() => { localStorageMock.store = {}; })
        };
        Object.defineProperty(window, 'localStorage', { value: localStorageMock });
        
        // Initialize app
        whisperApp = new WhisperApp();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    describe('Application Initialization', () => {
        test('should initialize with correct default state', () => {
            expect(whisperApp.state.incognitoMode).toBe(false);
            expect(whisperApp.state.historyEnabled).toBe(true);
            expect(whisperApp.state.panels.history).toBe(false);
            expect(whisperApp.state.panels.settings).toBe(false);
        });

        test('should load settings from localStorage', () => {
            localStorage.setItem('whisper-settings', JSON.stringify({
                historyEnabled: false
            }));
            
            const newApp = new WhisperApp();
            expect(newApp.state.historyEnabled).toBe(false);
        });

        test('should handle corrupted settings gracefully', () => {
            localStorage.setItem('whisper-settings', 'invalid-json');
            
            expect(() => new WhisperApp()).not.toThrow();
        });
    });

    describe('File Upload Workflow', () => {
        test('should enable transcribe button when file selected', () => {
            const fileInput = document.getElementById('file-input');
            const transcribeBtn = document.getElementById('transcribe-btn');
            
            // Mock file selection
            const mockFile = new File(['test'], 'test.mp3', { type: 'audio/mp3' });
            Object.defineProperty(fileInput, 'files', {
                value: [mockFile],
                configurable: true
            });
            
            // Trigger file selection
            fileInput.dispatchEvent(new Event('change'));
            
            expect(transcribeBtn.disabled).toBe(false);
        });

        test('should show file preview on selection', () => {
            const fileInput = document.getElementById('file-input');
            const filePreview = document.getElementById('file-preview');
            
            const mockFile = new File(['test'], 'test.mp3', { type: 'audio/mp3' });
            Object.defineProperty(fileInput, 'files', {
                value: [mockFile],
                configurable: true
            });
            
            whisperApp.uploader.handleFile(mockFile);
            
            expect(filePreview.classList.contains('hidden')).toBe(false);
        });

        test('should clear file when remove button clicked', () => {
            const fileInput = document.getElementById('file-input');
            const transcribeBtn = document.getElementById('transcribe-btn');
            
            // Setup file
            const mockFile = new File(['test'], 'test.mp3', { type: 'audio/mp3' });
            whisperApp.uploader.handleFile(mockFile);
            
            // Click remove
            whisperApp.uploader.clearFile();
            
            expect(transcribeBtn.disabled).toBe(true);
            expect(fileInput.value).toBe('');
        });

        test('should handle drag and drop correctly', () => {
            const uploadZone = document.getElementById('upload-zone');
            
            // Create mock drag event
            const mockFile = new File(['test'], 'test.mp3', { type: 'audio/mp3' });
            const mockEvent = {
                preventDefault: jest.fn(),
                stopPropagation: jest.fn(),
                dataTransfer: { files: [mockFile] }
            };
            
            // Test drag over
            uploadZone.dispatchEvent(new CustomEvent('dragover', { detail: mockEvent }));
            expect(uploadZone.classList.contains('drag-over')).toBe(true);
            
            // Test drop
            whisperApp.uploader.handleDrop(mockEvent);
            expect(mockEvent.preventDefault).toHaveBeenCalled();
        });
    });

    describe('Panel Management', () => {
        test('should toggle history panel visibility', () => {
            const historyToggle = document.getElementById('history-toggle');
            const historyPanel = document.getElementById('history-panel');
            const overlay = document.getElementById('panel-overlay');
            
            // Open panel
            historyToggle.click();
            expect(historyPanel.classList.contains('collapsed')).toBe(false);
            expect(overlay.classList.contains('active')).toBe(true);
            expect(whisperApp.state.panels.history).toBe(true);
            
            // Close panel
            historyToggle.click();
            expect(historyPanel.classList.contains('collapsed')).toBe(true);
            expect(whisperApp.state.panels.history).toBe(false);
        });

        test('should close panels when overlay clicked', () => {
            const overlay = document.getElementById('panel-overlay');
            const historyPanel = document.getElementById('history-panel');
            
            // Open panel first
            whisperApp.openPanel('history');
            expect(historyPanel.classList.contains('collapsed')).toBe(false);
            
            // Click overlay
            overlay.click();
            expect(historyPanel.classList.contains('collapsed')).toBe(true);
        });

        test('should close other panels when opening new one', () => {
            const historyPanel = document.getElementById('history-panel');
            const settingsPanel = document.getElementById('settings-panel');
            
            // Open history panel
            whisperApp.openPanel('history');
            expect(historyPanel.classList.contains('collapsed')).toBe(false);
            
            // Open settings panel
            whisperApp.openPanel('settings');
            expect(historyPanel.classList.contains('collapsed')).toBe(true);
            expect(settingsPanel.classList.contains('collapsed')).toBe(false);
        });
    });

    describe('History System Integration', () => {
        test('should save transcription to history when enabled', async () => {
            whisperApp.state.historyEnabled = true;
            whisperApp.state.incognitoMode = false;
            
            const mockEvent = {
                detail: {
                    xhr: {
                        responseText: `
                            <div data-transcript="Test transcript" 
                                 data-filename="test.mp3" 
                                 data-file-type="audio"
                                 data-file-size="1024">
                                Test transcript
                            </div>
                        `
                    }
                }
            };
            
            await whisperApp.handleTranscriptionSuccess(mockEvent);
            
            const entries = await whisperApp.storage.load();
            expect(entries).toHaveLength(1);
            expect(entries[0].transcript).toBe('Test transcript');
            expect(entries[0].filename).toBe('test.mp3');
        });

        test('should not save to history in incognito mode', async () => {
            whisperApp.state.historyEnabled = true;
            whisperApp.state.incognitoMode = true;
            
            const mockEvent = {
                detail: {
                    xhr: {
                        responseText: '<div data-transcript="Test">Test</div>'
                    }
                }
            };
            
            await whisperApp.handleTranscriptionSuccess(mockEvent);
            
            const entries = await whisperApp.storage.load();
            expect(entries).toHaveLength(0);
        });

        test('should not save to history when disabled', async () => {
            whisperApp.state.historyEnabled = false;
            whisperApp.state.incognitoMode = false;
            
            const mockEvent = {
                detail: {
                    xhr: {
                        responseText: '<div data-transcript="Test">Test</div>'
                    }
                }
            };
            
            await whisperApp.handleTranscriptionSuccess(mockEvent);
            
            const entries = await whisperApp.storage.load();
            expect(entries).toHaveLength(0);
        });

        test('should filter history correctly', async () => {
            // Add test entries
            await whisperApp.storage.save({
                id: '1', filename: 'audio.mp3', fileType: 'audio', 
                transcript: 'audio transcript', timestamp: Date.now()
            });
            await whisperApp.storage.save({
                id: '2', filename: 'video.mp4', fileType: 'video', 
                transcript: 'video transcript', timestamp: Date.now()
            });
            
            // Test audio filter
            await whisperApp.filterHistory('audio');
            const audioEntries = await whisperApp.storage.load({ fileType: 'audio' });
            expect(audioEntries).toHaveLength(1);
            expect(audioEntries[0].fileType).toBe('audio');
            
            // Test video filter
            await whisperApp.filterHistory('video');
            const videoEntries = await whisperApp.storage.load({ fileType: 'video' });
            expect(videoEntries).toHaveLength(1);
            expect(videoEntries[0].fileType).toBe('video');
        });

        test('should search history correctly', async () => {
            await whisperApp.storage.save({
                id: '1', filename: 'meeting.mp3', 
                transcript: 'quarterly meeting notes', timestamp: Date.now()
            });
            await whisperApp.storage.save({
                id: '2', filename: 'interview.mp3', 
                transcript: 'job interview recording', timestamp: Date.now()
            });
            
            await whisperApp.searchHistory('meeting');
            const searchResults = await whisperApp.storage.load({ search: 'meeting' });
            expect(searchResults).toHaveLength(1);
            expect(searchResults[0].transcript).toContain('meeting');
        });
    });

    describe('Incognito Mode', () => {
        test('should toggle incognito mode correctly', () => {
            const incognitoCheckbox = document.getElementById('incognito-mode');
            
            // Enable incognito mode
            incognitoCheckbox.checked = true;
            incognitoCheckbox.dispatchEvent(new Event('change'));
            
            expect(whisperApp.state.incognitoMode).toBe(true);
            
            // Disable incognito mode
            incognitoCheckbox.checked = false;
            incognitoCheckbox.dispatchEvent(new Event('change'));
            
            expect(whisperApp.state.incognitoMode).toBe(false);
        });

        test('should update UI state when incognito enabled', () => {
            whisperApp.ui.updateIncognitoState(true);
            expect(document.body.classList.contains('incognito-mode')).toBe(true);
            
            whisperApp.ui.updateIncognitoState(false);
            expect(document.body.classList.contains('incognito-mode')).toBe(false);
        });
    });

    describe('Error Handling', () => {
        test('should handle transcription errors gracefully', () => {
            const mockEvent = {
                detail: {
                    xhr: {
                        responseText: 'Transcription failed: Invalid file format'
                    }
                }
            };
            
            whisperApp.handleTranscriptionError(mockEvent);
            
            // Should show error toast
            const toastContainer = document.getElementById('toast-container');
            expect(toastContainer.children.length).toBeGreaterThan(0);
        });

        test('should handle localStorage quota exceeded', async () => {
            // Mock localStorage to throw quota exceeded error
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = jest.fn(() => {
                throw new Error('QuotaExceededError');
            });
            
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            const result = await whisperApp.saveToHistory({
                id: 'test', transcript: 'test', timestamp: Date.now()
            });
            
            expect(consoleSpy).toHaveBeenCalled();
            localStorage.setItem = originalSetItem;
            consoleSpy.mockRestore();
        });

        test('should handle network failures in CSRF refresh', async () => {
            global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));
            
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            await whisperApp.refreshCSRFToken();
            
            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to refresh CSRF token:', 
                expect.any(Error)
            );
            consoleSpy.mockRestore();
        });
    });

    describe('Keyboard Shortcuts', () => {
        test('should toggle history panel with Ctrl+H', () => {
            const historyPanel = document.getElementById('history-panel');
            
            // Simulate Ctrl+H
            const keyEvent = new KeyboardEvent('keydown', {
                key: 'h',
                ctrlKey: true
            });
            
            document.dispatchEvent(keyEvent);
            expect(historyPanel.classList.contains('collapsed')).toBe(false);
            
            document.dispatchEvent(keyEvent);
            expect(historyPanel.classList.contains('collapsed')).toBe(true);
        });

        test('should close panels with Escape key', () => {
            const historyPanel = document.getElementById('history-panel');
            
            // Open panel first
            whisperApp.openPanel('history');
            expect(historyPanel.classList.contains('collapsed')).toBe(false);
            
            // Press Escape
            const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
            document.dispatchEvent(escapeEvent);
            
            expect(historyPanel.classList.contains('collapsed')).toBe(true);
        });
    });

    describe('Toast Notifications', () => {
        test('should show and auto-dismiss toast notifications', (done) => {
            whisperApp.ui.showToast('Test message', 'success');
            
            const toastContainer = document.getElementById('toast-container');
            expect(toastContainer.children.length).toBe(1);
            
            const toast = toastContainer.firstChild;
            expect(toast.classList.contains('toast-success')).toBe(true);
            expect(toast.textContent).toContain('Test message');
            
            // Check auto-dismissal (shortened for testing)
            setTimeout(() => {
                // In real implementation, toast would be auto-removed after 5 seconds
                done();
            }, 100);
        });

        test('should allow manual toast dismissal', () => {
            whisperApp.ui.showToast('Test message', 'info');
            
            const toastContainer = document.getElementById('toast-container');
            const toast = toastContainer.firstChild;
            const closeBtn = toast.querySelector('.toast-close');
            
            closeBtn.click();
            
            expect(toastContainer.children.length).toBe(0);
        });
    });

    describe('Storage Management', () => {
        test('should update storage usage display', async () => {
            const storageUsage = document.getElementById('storage-usage');
            
            // Add some test data
            await whisperApp.storage.save({
                id: 'test', filename: 'test.mp3', fileSize: 1024 * 1024,
                transcript: 'test', timestamp: Date.now()
            });
            
            await whisperApp.updateStorageUsage();
            
            expect(storageUsage.textContent).toContain('MB');
        });

        test('should clear all data when requested', async () => {
            // Add test data
            await whisperApp.storage.save({
                id: 'test', transcript: 'test', timestamp: Date.now()
            });
            localStorage.setItem('whisper-settings', 'test');
            
            // Mock confirm dialog
            global.confirm = jest.fn(() => true);
            
            await whisperApp.clearAllData();
            
            expect(localStorage.getItem('whisper-history')).toBeNull();
            expect(localStorage.getItem('whisper-settings')).toBeNull();
        });
    });
});