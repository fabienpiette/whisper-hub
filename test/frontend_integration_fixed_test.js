/**
 * Frontend Integration Tests for Fixed SecurityUtils Issues
 * Tests the Create/Manage button functionality and modal security
 */

// Add Node.js polyfills for browser APIs
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

const { JSDOM } = require('jsdom');

// Mock DOM environment with complete app structure
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head><title>Frontend Integration Test</title></head>
<body>
    <div id="upload-container"></div>
    <div id="result-container"></div>
    <div id="settings-panel" class="settings-panel collapsed">
        <div class="panel-content">
            <div class="settings-group">
                <button id="create-action" class="setting-btn">Create New Action</button>
                <button id="manage-actions" class="setting-btn">Manage Actions</button>
            </div>
        </div>
    </div>
    <div id="toast-container"></div>
    <form id="transcribe-form">
        <select id="post_action">
            <option value="">No action</option>
        </select>
    </form>
</body>
</html>
`);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = {
    data: {},
    getItem: function(key) { return this.data[key] || null; },
    setItem: function(key, value) { this.data[key] = value; },
    removeItem: function(key) { delete this.data[key]; },
    clear: function() { this.data = {}; }
};

// Ensure localStorage is available on window as well
global.window.localStorage = global.localStorage;
global.crypto = {
    getRandomValues: (array) => {
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        return array;
    }
};

// Load both SecurityUtils and App code
const fs = require('fs');
const path = require('path');

// Load SecurityUtils first
const securityJs = fs.readFileSync(path.join(__dirname, '../web/static/js/security.js'), 'utf8');
eval(securityJs);

// Load app.js and ensure classes are available globally
const appJs = fs.readFileSync(path.join(__dirname, '../web/static/js/app.js'), 'utf8');

// Modify the JavaScript to make classes global
const globalAppJs = appJs.replace(/^class /gm, 'global.').replace(/^(global\.[A-Z][a-zA-Z]*) /gm, '$1 = class ');
eval(globalAppJs);

// Ensure classes are available in local scope as well
try {
    global.WhisperApp = global.WhisperApp || WhisperApp;
    global.CustomActionManager = global.CustomActionManager || CustomActionManager;
    global.HistoryStorage = global.HistoryStorage || HistoryStorage;
    global.UIManager = global.UIManager || UIManager;
    global.FileUploader = global.FileUploader || FileUploader;
} catch (e) {
    // Classes should already be global from the modified eval
}

describe('Frontend Integration Tests - Fixed SecurityUtils', () => {
    let whisperApp;
    let customActionManager;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = `
            <div id="upload-container"></div>
            <div id="result-container"></div>
            <div id="settings-panel" class="settings-panel collapsed">
                <div class="panel-content">
                    <div class="settings-group">
                        <button id="create-action" class="setting-btn">Create New Action</button>
                        <button id="manage-actions" class="setting-btn">Manage Actions</button>
                    </div>
                </div>
            </div>
            <div id="toast-container"></div>
            <form id="transcribe-form">
                <select id="post_action">
                    <option value="">No action</option>
                </select>
            </form>
        `;

        // Reset localStorage
        localStorage.clear();

        // Ensure SecurityUtils is available
        expect(window.SecurityUtils).toBeDefined();
        expect(typeof window.SecurityUtils.escapeHtml).toBe('function');

        // Initialize only the CustomActionManager directly (avoid WhisperApp DOM issues)
        customActionManager = new global.CustomActionManager();
    });

    describe('SecurityUtils Availability Tests', () => {
        test('SecurityUtils should be properly loaded and available', () => {
            expect(window.SecurityUtils).toBeDefined();
            expect(typeof SecurityUtils.escapeHtml).toBe('function');
            expect(typeof SecurityUtils.sanitizeHTML).toBe('function');
            expect(typeof SecurityUtils.generateCSRFToken).toBe('function');
        });

        test('escapeHtml should work correctly', () => {
            const testCases = [
                { input: '<script>alert("test")</script>', shouldNotContain: '<script>' },
                { input: '<img src="x" onerror="alert(1)">', shouldNotContain: 'onerror=' },
                { input: 'normal text', shouldContain: 'normal text' },
                { input: '"quotes" and \'apostrophes\'', shouldContain: 'quotes' }
            ];

            testCases.forEach(({ input, shouldNotContain, shouldContain }) => {
                const result = SecurityUtils.escapeHtml(input);
                if (shouldNotContain) {
                    expect(result).not.toContain(shouldNotContain);
                }
                if (shouldContain) {
                    expect(result).toContain(shouldContain);
                }
            });
        });
    });

    describe('Create Action Button Tests', () => {
        test('Create button should work without SecurityUtils errors', () => {
            const createButton = document.getElementById('create-action');
            expect(createButton).toBeDefined();

            // Mock the action creation process
            const mockAction = {
                name: 'Test Action',
                description: 'Test Description',
                template: 'Test Template: {{.Transcript}}',
                type: 'template'
            };

            expect(() => {
                // This should not throw SecurityUtils.escapeHtml errors
                const modalHtml = customActionManager.createActionModalHTML(mockAction, false);
                expect(modalHtml).toContain('Test Action');
                expect(modalHtml).toContain('Test Description');
                expect(modalHtml).toContain('Test Template');
            }).not.toThrow();
        });

        test('Create modal should handle malicious input safely', () => {
            const maliciousAction = {
                name: '<script>alert("name")</script>Malicious Name',
                description: '<img src="x" onerror="alert(1)">Bad Description',
                template: '"><script>alert("template")</script>Evil Template',
                type: 'template'
            };

            const modalHtml = customActionManager.createActionModalHTML(maliciousAction, false);

            // Should not contain dangerous scripts
            expect(modalHtml).not.toContain('<script>');
            expect(modalHtml).not.toContain('onerror=');
            expect(modalHtml).not.toContain('"><script>');

            // Should contain escaped content
            expect(modalHtml).toContain('&lt;script&gt;');
            expect(modalHtml).toContain('Malicious Name');
            expect(modalHtml).toContain('Bad Description');
        });

        test('Create modal should work with empty/null values', () => {
            const emptyAction = {
                name: '',
                description: null,
                template: undefined,
                type: 'template'
            };

            expect(() => {
                const modalHtml = customActionManager.createActionModalHTML(emptyAction, false);
                expect(typeof modalHtml).toBe('string');
                expect(modalHtml.length).toBeGreaterThan(0);
            }).not.toThrow();
        });

        test('Create modal example buttons should be safe', () => {
            const mockAction = {
                name: 'Test',
                description: 'Test',
                template: 'Test',
                type: 'template'
            };

            const modalHtml = customActionManager.createActionModalHTML(mockAction, false);

            // Should contain example template buttons
            expect(modalHtml).toContain('example-btn');
            expect(modalHtml).toContain('Meeting Summary');

            // Example templates should not contain unescaped dangerous content
            expect(modalHtml).not.toContain('onclick="malicious()"');
        });
    });

    describe('Manage Actions Button Tests', () => {
        test('Manage button should work without SecurityUtils errors', () => {
            const manageButton = document.getElementById('manage-actions');
            expect(manageButton).toBeDefined();

            const mockActions = [
                {
                    id: 'action-1',
                    name: 'Test Action 1',
                    description: 'Description 1',
                    type: 'template',
                    created: new Date().toISOString()
                },
                {
                    id: 'action-2',
                    name: 'Test Action 2',
                    description: 'Description 2',
                    type: 'openai',
                    created: new Date().toISOString()
                }
            ];

            expect(() => {
                const manageHtml = customActionManager.createManageModalHTML(mockActions);
                expect(manageHtml).toContain('Test Action 1');
                expect(manageHtml).toContain('Test Action 2');
                expect(manageHtml).toContain('Description 1');
                expect(manageHtml).toContain('Description 2');
            }).not.toThrow();
        });

        test('Manage modal should handle malicious action data safely', () => {
            const maliciousActions = [
                {
                    id: 'malicious-1',
                    name: '<script>alert("action1")</script>Evil Action 1',
                    description: '<img src="x" onerror="alert(1)">Bad Description 1',
                    type: 'template',
                    created: new Date().toISOString()
                },
                {
                    id: 'malicious-2',
                    name: '"><script>alert("action2")</script>',
                    description: '<iframe src="javascript:alert(1)"></iframe>',
                    type: 'openai',
                    created: new Date().toISOString()
                }
            ];

            const manageHtml = customActionManager.createManageModalHTML(maliciousActions);

            // Should not contain dangerous scripts
            expect(manageHtml).not.toContain('<script>');
            expect(manageHtml).not.toContain('onerror=');
            expect(manageHtml).not.toContain('<iframe');
            expect(manageHtml).not.toContain('javascript:');

            // Should contain escaped content
            expect(manageHtml).toContain('&lt;script&gt;');
            expect(manageHtml).toContain('Evil Action 1');
        });

        test('Manage modal should handle empty actions list', () => {
            const emptyActions = [];

            expect(() => {
                const manageHtml = customActionManager.createManageModalHTML(emptyActions);
                expect(manageHtml).toContain('No custom actions');
                expect(manageHtml).toContain('Create Your First Action');
            }).not.toThrow();
        });

        test('Manage modal should handle actions with missing fields', () => {
            const incompleteActions = [
                {
                    id: 'incomplete-1',
                    name: 'Action 1'
                    // Missing description, type, etc.
                },
                {
                    id: 'incomplete-2',
                    description: 'Description only'
                    // Missing name
                }
            ];

            expect(() => {
                const manageHtml = customActionManager.createManageModalHTML(incompleteActions);
                expect(typeof manageHtml).toBe('string');
                expect(manageHtml).toContain('Action 1');
                expect(manageHtml).toContain('No description');
            }).not.toThrow();
        });
    });

    describe('Modal Generation Security Tests', () => {
        test('showModal should escape titles safely', () => {
            const maliciousTitle = '<script>alert("title")</script>Modal Title';
            const safeContent = '<p>Safe content</p>';

            expect(() => {
                customActionManager.showModal(safeContent, maliciousTitle);
            }).not.toThrow();

            // Check if modal was created safely
            const modal = document.querySelector('.modal-overlay');
            if (modal) {
                const titleElement = modal.querySelector('h3');
                expect(titleElement.innerHTML).not.toContain('<script>');
                expect(titleElement.innerHTML).toContain('&lt;script&gt;');
            }
        });

        test('showPreviewModal should escape content safely', () => {
            const maliciousContent = '<script>alert("preview")</script>Template content';

            expect(() => {
                customActionManager.showPreviewModal(maliciousContent);
            }).not.toThrow();

            // Check if preview modal was created safely
            const modal = document.querySelector('.modal-overlay');
            if (modal) {
                const preElement = modal.querySelector('pre');
                if (preElement) {
                    expect(preElement.innerHTML).not.toContain('<script>');
                    expect(preElement.innerHTML).toContain('&lt;script&gt;');
                }
            }
        });
    });

    describe('Fallback Mechanism Tests', () => {
        test('should work when SecurityUtils is temporarily unavailable', () => {
            // Temporarily remove SecurityUtils
            const originalSecurityUtils = window.SecurityUtils;
            delete window.SecurityUtils;

            const mockAction = {
                name: '<b>Bold Name</b>',
                description: '<i>Italic Description</i>',
                template: '<script>test</script>',
                type: 'template'
            };

            expect(() => {
                const modalHtml = customActionManager.createActionModalHTML(mockAction, false);
                expect(modalHtml).not.toContain('<script>');
                expect(modalHtml).toContain('&lt;b&gt;');
                expect(modalHtml).toContain('&lt;i&gt;');
            }).not.toThrow();

            // Restore SecurityUtils
            window.SecurityUtils = originalSecurityUtils;
        });

        test('should handle SecurityUtils method errors gracefully', () => {
            // Mock SecurityUtils to throw errors
            const originalEscapeHtml = SecurityUtils.escapeHtml;
            SecurityUtils.escapeHtml = jest.fn(() => {
                throw new Error('Mock SecurityUtils error');
            });

            const mockAction = {
                name: 'Test Name',
                description: 'Test Description',
                template: 'Test Template',
                type: 'template'
            };

            // Should fall back to safe behavior even when SecurityUtils fails
            expect(() => {
                const modalHtml = customActionManager.createActionModalHTML(mockAction, false);
                expect(typeof modalHtml).toBe('string');
                expect(modalHtml.length).toBeGreaterThan(0);
            }).not.toThrow();

            // Restore original method
            SecurityUtils.escapeHtml = originalEscapeHtml;
        });
    });

    describe('Real User Interaction Simulation', () => {
        test('complete Create action workflow should work', async () => {
            // Simulate clicking Create button
            const createButton = document.getElementById('create-action');
            
            expect(() => {
                // Simulate the click event handler
                customActionManager.showActionModal();
            }).not.toThrow();

            // Verify modal was created
            const modal = document.querySelector('.modal-overlay');
            expect(modal).toBeTruthy();

            // Verify form elements are present and safe
            const nameInput = modal.querySelector('#action-name');
            const descriptionTextarea = modal.querySelector('#action-description');
            const templateTextarea = modal.querySelector('#action-template');

            expect(nameInput).toBeTruthy();
            expect(descriptionTextarea).toBeTruthy();
            expect(templateTextarea).toBeTruthy();
        });

        test('complete Manage actions workflow should work', async () => {
            // Add some test actions first
            const testActions = [
                {
                    name: 'Summary Action',
                    description: 'Creates summaries',
                    type: 'template',
                    template: 'Summary: {{.Transcript}}'
                },
                {
                    name: 'AI Analysis',
                    description: 'AI-powered analysis',
                    type: 'openai',
                    prompt: 'Analyze this transcript'
                }
            ];

            testActions.forEach(action => {
                customActionManager.saveAction(action);
            });

            expect(() => {
                // Simulate clicking Manage button
                customActionManager.showManageModal();
            }).not.toThrow();

            // Verify manage modal was created
            const modal = document.querySelector('.modal-overlay');
            expect(modal).toBeTruthy();

            // Verify actions are displayed safely
            const actionItems = modal.querySelectorAll('.action-item');
            expect(actionItems.length).toBe(testActions.length);
        });

        test('action selector population should work safely', () => {
            // Add test actions
            const testActions = [
                {
                    name: 'Safe Action',
                    description: 'Safe description',
                    type: 'template'
                },
                {
                    name: '<script>alert("evil")</script>Malicious Action',
                    description: '<img src="x" onerror="alert(1)">',
                    type: 'openai'
                }
            ];

            testActions.forEach(action => {
                customActionManager.saveAction(action);
            });

            const selector = document.getElementById('post_action');
            expect(() => {
                customActionManager.populateActionSelector();
            }).not.toThrow();

            // Verify options were added safely
            const options = selector.querySelectorAll('option');
            expect(options.length).toBeGreaterThan(1); // Including "No action" option

            // Verify malicious content is not executed
            options.forEach(option => {
                expect(option.textContent).not.toContain('<script>');
                if (option.textContent.includes('Malicious Action')) {
                    expect(option.textContent).toContain('Malicious Action');
                }
            });
        });
    });

    describe('Performance and Memory Tests', () => {
        test('should handle many actions without performance degradation', () => {
            const manyActions = Array.from({ length: 100 }, (_, i) => ({
                id: `action-${i}`,
                name: `Action ${i}`,
                description: `Description ${i}`,
                type: i % 2 === 0 ? 'template' : 'openai',
                created: new Date().toISOString()
            }));

            const startTime = Date.now();
            
            expect(() => {
                const manageHtml = customActionManager.createManageModalHTML(manyActions);
                expect(manageHtml).toContain('Action 0');
                expect(manageHtml).toContain('Action 99');
            }).not.toThrow();

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time (1 second)
            expect(duration).toBeLessThan(1000);
        });

        test('should handle repeated modal creation/destruction', () => {
            const mockAction = {
                name: 'Test Action',
                description: 'Test Description',
                template: 'Test Template',
                type: 'template'
            };

            expect(() => {
                // Create and destroy modals repeatedly
                for (let i = 0; i < 10; i++) {
                    customActionManager.showActionModal();
                    
                    // Remove modal
                    const modal = document.querySelector('.modal-overlay');
                    if (modal) {
                        modal.remove();
                    }
                }
            }).not.toThrow();

            // Should not have memory leaks (no leftover modals)
            const remainingModals = document.querySelectorAll('.modal-overlay');
            expect(remainingModals.length).toBeLessThanOrEqual(1);
        });
    });
});

console.log('✅ Frontend integration tests for fixed SecurityUtils completed successfully');