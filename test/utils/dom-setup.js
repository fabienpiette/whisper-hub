/**
 * Standardized DOM Setup Utilities for Tests
 * Provides consistent JSDOM environment across all test files
 */

const { JSDOM } = require('jsdom');

class DOMTestSetup {
    static createBasicDOM() {
        const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <head><title>Test Environment</title></head>
        <body>
            <div id="test-container"></div>
        </body>
        </html>
        `);

        return this.configureDOMGlobals(dom);
    }

    static createAppDOM() {
        const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Whisper Hub Test</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
            <!-- Main Application Structure -->
            <main class="main-container">
                <div id="upload-container" class="upload-container">
                    <form id="transcribe-form" class="upload-form">
                        <div class="form-group">
                            <input type="file" id="file-input" accept="audio/*,video/*">
                            <select id="post_action" name="post_action" class="action-select">
                                <option value="">No post-action</option>
                            </select>
                            <button type="submit" id="transcribe-btn" disabled>Transcribe</button>
                        </div>
                    </form>
                    <div id="file-preview" class="file-preview hidden">
                        <div class="preview-content">
                            <div class="file-icon" id="file-icon">📄</div>
                            <div class="file-details">
                                <div class="file-name" id="file-name"></div>
                                <div class="file-size" id="file-size"></div>
                                <div class="file-duration" id="file-duration"></div>
                            </div>
                            <button id="remove-file" class="remove-btn">×</button>
                        </div>
                    </div>
                </div>
                
                <div id="result-container" class="result-container"></div>
                
                <!-- History Panel -->
                <aside id="history-panel" class="history-panel collapsed">
                    <div class="panel-header">
                        <h2 class="panel-title">History</h2>
                        <button id="close-history" class="close-btn">×</button>
                    </div>
                    <div class="panel-content">
                        <div class="history-controls">
                            <input type="text" id="history-search" placeholder="Search transcriptions...">
                            <select id="history-filter">
                                <option value="all">All Files</option>
                                <option value="audio">Audio Only</option>
                                <option value="video">Video Only</option>
                            </select>
                        </div>
                        <div id="history-list" class="history-list"></div>
                        <div class="panel-footer">
                            <button id="export-history" class="panel-btn">Export</button>
                            <button id="clear-history" class="panel-btn danger">Clear All</button>
                        </div>
                    </div>
                </aside>
                
                <!-- Settings Panel -->
                <aside id="settings-panel" class="settings-panel collapsed">
                    <div class="panel-header">
                        <h2 class="panel-title">Settings</h2>
                        <button id="close-settings" class="close-btn">×</button>
                    </div>
                    <div class="panel-content">
                        <div class="settings-group">
                            <div class="setting-item">
                                <label class="setting-label">
                                    <input type="checkbox" id="incognito-mode">
                                    Incognito Mode
                                </label>
                            </div>
                            <div class="setting-item">
                                <label class="setting-label">
                                    <input type="checkbox" id="enable-history" checked>
                                    Enable History
                                </label>
                            </div>
                        </div>
                        <div class="settings-group">
                            <h3>Custom Actions</h3>
                            <div class="setting-item">
                                <span class="setting-label">Create and manage custom post-transcription actions</span>
                            </div>
                            <button id="create-action" class="setting-btn">Create New Action</button>
                            <button id="manage-actions" class="setting-btn">Manage Actions</button>
                        </div>
                        <div class="settings-group">
                            <div class="setting-item">
                                <button id="export-all" class="setting-btn">Export All Data</button>
                                <button id="clear-all-data" class="setting-btn danger">Clear All Data</button>
                            </div>
                        </div>
                    </div>
                </aside>
            </main>

            <!-- Navigation -->
            <nav class="bottom-nav">
                <button id="history-toggle" class="nav-btn" title="History (Ctrl+H)">
                    <span class="nav-icon">📚</span>
                    <span class="nav-label">History</span>
                    <span id="history-count" class="badge">0</span>
                </button>
                <button id="settings-toggle" class="nav-btn" title="Settings">
                    <span class="nav-icon">⚙️</span>
                    <span class="nav-label">Settings</span>
                </button>
            </nav>

            <!-- Overlay -->
            <div id="panel-overlay" class="panel-overlay"></div>
            
            <!-- Toast Container -->
            <div id="toast-container" class="toast-container"></div>
        </body>
        </html>
        `);

        return this.configureDOMGlobals(dom);
    }

    static configureDOMGlobals(dom) {
        global.window = dom.window;
        global.document = dom.window.document;
        global.navigator = dom.window.navigator;
        global.HTMLElement = dom.window.HTMLElement;
        global.Event = dom.window.Event;
        global.CustomEvent = dom.window.CustomEvent;

        // Mock storage
        global.localStorage = this.createMockStorage();
        global.sessionStorage = this.createMockStorage();
        global.window.localStorage = global.localStorage;
        global.window.sessionStorage = global.sessionStorage;

        // Mock crypto
        global.crypto = this.createMockCrypto();
        global.window.crypto = global.crypto;

        // Mock console capture
        this.setupConsoleCapture();

        return dom;
    }

    static createMockStorage() {
        return {
            data: {},
            getItem: function(key) { return this.data[key] || null; },
            setItem: function(key, value) { this.data[key] = value; },
            removeItem: function(key) { delete this.data[key]; },
            clear: function() { this.data = {}; },
            get length() { return Object.keys(this.data).length; },
            key: function(index) { return Object.keys(this.data)[index] || null; }
        };
    }

    static createMockCrypto() {
        return {
            getRandomValues: (array) => {
                for (let i = 0; i < array.length; i++) {
                    array[i] = Math.floor(Math.random() * 256);
                }
                return array;
            },
            subtle: {
                importKey: jest.fn().mockResolvedValue({}),
                encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
                decrypt: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
                digest: jest.fn().mockResolvedValue(new ArrayBuffer(32))
            }
        };
    }

    static setupConsoleCapture() {
        // Capture console methods for testing
        const originalMethods = {
            log: console.log,
            warn: console.warn,
            error: console.error
        };

        global.capturedLogs = [];
        global.capturedWarnings = [];
        global.capturedErrors = [];

        console.log = jest.fn((...args) => {
            global.capturedLogs.push(args.join(' '));
            originalMethods.log(...args);
        });

        console.warn = jest.fn((...args) => {
            global.capturedWarnings.push(args.join(' '));
            originalMethods.warn(...args);
        });

        console.error = jest.fn((...args) => {
            global.capturedErrors.push(args.join(' '));
            originalMethods.error(...args);
        });

        return originalMethods;
    }

    static resetConsoleCapture() {
        global.capturedLogs = [];
        global.capturedWarnings = [];
        global.capturedErrors = [];
    }

    static addNodePolyfills() {
        // Add Node.js polyfills for browser APIs
        global.TextEncoder = require('util').TextEncoder;
        global.TextDecoder = require('util').TextDecoder;
    }

    static cleanup() {
        // Clean up global state
        delete global.window;
        delete global.document;
        delete global.navigator;
        delete global.HTMLElement;
        delete global.Event;
        delete global.CustomEvent;
        delete global.localStorage;
        delete global.sessionStorage;
        delete global.crypto;
        
        // Reset captured console logs
        this.resetConsoleCapture();
    }
}

module.exports = DOMTestSetup;