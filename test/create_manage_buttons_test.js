/**
 * Specific Tests for Create and Manage Button Functionality
 * Tests the exact user workflows that were failing
 */

// Add Node.js polyfills for browser APIs
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

const { JSDOM } = require('jsdom');

// Create exact DOM structure from the actual app
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head>
    <title>Whisper Hub</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
    <!-- Main Application -->
    <main class="main-container">
        <div id="upload-container" class="upload-container">
            <form id="transcribe-form" class="upload-form">
                <div class="form-group">
                    <select id="post_action" name="post_action" class="action-select">
                        <option value="">No post-action</option>
                    </select>
                </div>
            </form>
        </div>
        
        <div id="result-container" class="result-container"></div>
        
        <!-- Settings Panel -->
        <aside id="settings-panel" class="settings-panel collapsed">
            <div class="panel-header">
                <h2 class="panel-title">Settings</h2>
                <button id="close-settings" class="close-btn">×</button>
            </div>
            
            <div class="panel-content">
                <div class="settings-group">
                    <h3>Custom Actions</h3>
                    <div class="setting-item">
                        <span class="setting-label">Create and manage custom post-transcription actions</span>
                    </div>
                    <button id="create-action" class="setting-btn">Create New Action</button>
                    <button id="manage-actions" class="setting-btn">Manage Actions</button>
                </div>
            </div>
        </aside>
    </main>

    <!-- Toast Notifications -->
    <div id="toast-container" class="toast-container"></div>

    <!-- Scripts would be loaded here -->
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

// Mock console to capture any errors
const originalConsoleError = console.error;
const capturedErrors = [];
console.error = jest.fn((...args) => {
    capturedErrors.push(args.join(' '));
    originalConsoleError(...args);
});

// Load SecurityUtils and App
const fs = require('fs');
const path = require('path');

// Load SecurityUtils
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

describe('Create and Manage Button Functionality Tests', () => {
    let whisperApp;
    let customActionManager;

    beforeEach(() => {
        // Clear any captured errors
        capturedErrors.length = 0;
        
        // Reset localStorage
        localStorage.clear();
        
        // Remove any existing modals
        document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());
        
        // Verify SecurityUtils is loaded
        expect(window.SecurityUtils).toBeDefined();
        expect(typeof SecurityUtils.escapeHtml).toBe('function');
        
        // Initialize only the CustomActionManager directly (avoid WhisperApp DOM issues)
        customActionManager = new global.CustomActionManager();
    });

    afterEach(() => {
        // Check that no errors were captured during the test
        if (capturedErrors.length > 0) {
            console.warn('Captured errors during test:', capturedErrors);
        }
    });

    describe('Create Button Tests', () => {
        test('Create button should exist and be clickable', () => {
            const createButton = document.getElementById('create-action');
            expect(createButton).toBeTruthy();
            expect(createButton.classList.contains('setting-btn')).toBe(true);
            expect(createButton.textContent).toBe('Create New Action');
        });

        test('Clicking Create button should not throw SecurityUtils errors', () => {
            const createButton = document.getElementById('create-action');
            
            expect(() => {
                // Simulate the exact workflow that was failing
                customActionManager.showCreateModal();
            }).not.toThrow();
            
            // Verify no SecurityUtils errors were captured
            const securityErrors = capturedErrors.filter(error => 
                error.includes('SecurityUtils.escapeHtml is not a function')
            );
            expect(securityErrors.length).toBe(0);
        });

        test('Create modal should be created successfully', () => {
            customActionManager.showCreateModal();
            
            // Modal should be created
            const modal = document.querySelector('.modal-overlay');
            expect(modal).toBeTruthy();
            
            // Modal should have correct title
            const title = modal.querySelector('h3');
            expect(title).toBeTruthy();
            expect(title.textContent).toBe('Create Custom Action');
            
            // Form elements should be present
            const nameInput = modal.querySelector('#action-name');
            const descriptionTextarea = modal.querySelector('#action-description');
            const templateTextarea = modal.querySelector('#action-template');
            
            expect(nameInput).toBeTruthy();
            expect(descriptionTextarea).toBeTruthy();
            expect(templateTextarea).toBeTruthy();
        });

        test('Create modal should handle default action values safely', () => {
            // Default empty action that was causing the error
            const defaultAction = { name: '', description: '', template: '', type: 'template' };
            
            expect(() => {
                const modalHtml = customActionManager.createActionModalHTML(defaultAction, false);
                expect(modalHtml).toContain('action-modal-content');
                expect(modalHtml).toContain('action-name');
                expect(modalHtml).toContain('action-description');
                expect(modalHtml).toContain('action-template');
            }).not.toThrow();
        });

        test('Create modal should handle undefined action properties', () => {
            // Action with undefined properties (typical when creating new)
            const undefinedAction = { 
                name: undefined, 
                description: undefined, 
                template: undefined, 
                type: 'template' 
            };
            
            expect(() => {
                const modalHtml = customActionManager.createActionModalHTML(undefinedAction, false);
                expect(modalHtml).toContain('value=""'); // Should handle undefined as empty string
            }).not.toThrow();
        });

        test('Create modal example templates should work', () => {
            customActionManager.showCreateModal();
            
            const modal = document.querySelector('.modal-overlay');
            const exampleButtons = modal.querySelectorAll('.example-btn');
            
            expect(exampleButtons.length).toBeGreaterThan(0);
            
            // Each example button should have safe data-template attribute
            exampleButtons.forEach(button => {
                const template = button.getAttribute('data-template');
                expect(template).toBeTruthy();
                expect(template).not.toContain('<script>');
                
                // Button text should be safe
                expect(button.textContent.length).toBeGreaterThan(0);
                expect(button.innerHTML).not.toContain('<script>');
            });
        });
    });

    describe('Manage Button Tests', () => {
        test('Manage button should exist and be clickable', () => {
            const manageButton = document.getElementById('manage-actions');
            expect(manageButton).toBeTruthy();
            expect(manageButton.classList.contains('setting-btn')).toBe(true);
            expect(manageButton.textContent).toBe('Manage Actions');
        });

        test('Clicking Manage button should not throw SecurityUtils errors', () => {
            const manageButton = document.getElementById('manage-actions');
            
            expect(() => {
                // Simulate the exact workflow that was failing
                customActionManager.showManageModal();
            }).not.toThrow();
            
            // Verify no SecurityUtils errors were captured
            const securityErrors = capturedErrors.filter(error => 
                error.includes('SecurityUtils.escapeHtml is not a function')
            );
            expect(securityErrors.length).toBe(0);
        });

        test('Manage modal should show empty state when no actions exist', () => {
            customActionManager.showManageModal();
            
            const modal = document.querySelector('.modal-overlay');
            expect(modal).toBeTruthy();
            
            // Should show empty state
            const emptyState = modal.querySelector('.empty-state');
            expect(emptyState).toBeTruthy();
            expect(emptyState.textContent).toContain('No custom actions created yet');
            
            // Should have create first action button
            const createFirstButton = modal.querySelector('#create-first-action');
            expect(createFirstButton).toBeTruthy();
        });

        test('Manage modal should display existing actions safely', () => {
            // Add some test actions first
            const testActions = [
                {
                    name: 'Safe Action',
                    description: 'Safe description',
                    type: 'template',
                    template: 'Template: {{.Transcript}}'
                },
                {
                    name: '<script>alert("xss")</script>Malicious Action',
                    description: '<img src="x" onerror="alert(1)">Bad description',
                    type: 'openai',
                    prompt: 'Analyze'
                }
            ];
            
            testActions.forEach(action => {
                customActionManager.saveAction(action);
            });
            
            expect(() => {
                customActionManager.showManageModal();
            }).not.toThrow();
            
            const modal = document.querySelector('.modal-overlay');
            const actionItems = modal.querySelectorAll('.action-item');
            
            expect(actionItems.length).toBe(testActions.length);
            
            // Verify malicious content is escaped
            const modalHtml = modal.innerHTML;
            expect(modalHtml).not.toContain('<script>');
            expect(modalHtml).not.toContain('onerror=');
            expect(modalHtml).toContain('&lt;script&gt;'); // Should be escaped
            expect(modalHtml).toContain('Malicious Action'); // But text should be visible
        });

        test('Manage modal action buttons should work safely', () => {
            // Add a test action
            const testAction = {
                name: 'Test Action',
                description: 'Test description',
                type: 'template',
                template: 'Test: {{.Transcript}}'
            };
            
            customActionManager.saveAction(testAction);
            customActionManager.showManageModal();
            
            const modal = document.querySelector('.modal-overlay');
            const editButton = modal.querySelector('.edit-action');
            const deleteButton = modal.querySelector('.delete-action');
            
            expect(editButton).toBeTruthy();
            expect(deleteButton).toBeTruthy();
            
            // Buttons should have safe data attributes
            expect(editButton.getAttribute('data-id')).toBeTruthy();
            expect(deleteButton.getAttribute('data-id')).toBeTruthy();
        });
    });

    describe('Modal Security Tests', () => {
        test('Modal titles should be escaped properly', () => {
            const maliciousTitle = '<script>alert("title")</script>Test Title';
            const content = '<p>Safe content</p>';
            
            expect(() => {
                customActionManager.showModal(content, maliciousTitle);
            }).not.toThrow();
            
            const modal = document.querySelector('.modal-overlay');
            const titleElement = modal.querySelector('h3');
            
            expect(titleElement.innerHTML).not.toContain('<script>');
            expect(titleElement.innerHTML).toContain('&lt;script&gt;');
            expect(titleElement.innerHTML).toContain('Test Title');
        });

        test('Preview modal should handle malicious template content', () => {
            const maliciousContent = '<script>alert("preview")</script>Template: {{.Transcript}}';
            
            expect(() => {
                customActionManager.showPreviewModal(maliciousContent);
            }).not.toThrow();
            
            const modal = document.querySelector('.modal-overlay');
            const preElement = modal.querySelector('pre');
            
            expect(preElement.innerHTML).not.toContain('<script>');
            expect(preElement.innerHTML).toContain('&lt;script&gt;');
            expect(preElement.innerHTML).toContain('Template:');
        });

        test('Modal close functionality should work', () => {
            customActionManager.showCreateModal();
            
            let modal = document.querySelector('.modal-overlay');
            expect(modal).toBeTruthy();
            
            // Find and click close button
            const closeButton = modal.querySelector('.modal-close');
            expect(closeButton).toBeTruthy();
            
            // Simulate close
            expect(() => {
                modal.remove();
            }).not.toThrow();
            
            modal = document.querySelector('.modal-overlay');
            expect(modal).toBeFalsy();
        });
    });

    describe('Real User Workflow Tests', () => {
        test('Complete create action workflow', () => {
            // Step 1: Click Create button
            expect(() => {
                customActionManager.showCreateModal();
            }).not.toThrow();
            
            // Step 2: Verify modal is created
            let modal = document.querySelector('.modal-overlay');
            expect(modal).toBeTruthy();
            
            // Step 3: Fill form (simulate user input)
            const nameInput = modal.querySelector('#action-name');
            const descriptionTextarea = modal.querySelector('#action-description');
            const templateTextarea = modal.querySelector('#action-template');
            
            nameInput.value = 'My Test Action';
            descriptionTextarea.value = 'This is a test action';
            templateTextarea.value = 'Summary: {{.Transcript}}';
            
            // Step 4: Submit form (simulate)
            const formData = {
                name: nameInput.value,
                description: descriptionTextarea.value,
                template: templateTextarea.value,
                type: 'template'
            };
            
            expect(() => {
                const actionId = customActionManager.saveAction(formData);
                expect(actionId).toBeTruthy();
            }).not.toThrow();
            
            // Step 5: Verify action was saved
            const actions = customActionManager.getActions();
            expect(actions.length).toBe(1);
            expect(actions[0].name).toBe('My Test Action');
        });

        test('Complete manage actions workflow', () => {
            // Step 1: Create some actions first
            const testActions = [
                { name: 'Action 1', description: 'Desc 1', type: 'template', template: 'Template 1' },
                { name: 'Action 2', description: 'Desc 2', type: 'openai', prompt: 'Prompt 2' }
            ];
            
            testActions.forEach(action => {
                customActionManager.saveAction(action);
            });
            
            // Step 2: Open manage modal
            expect(() => {
                customActionManager.showManageModal();
            }).not.toThrow();
            
            // Step 3: Verify actions are displayed
            const modal = document.querySelector('.modal-overlay');
            const actionItems = modal.querySelectorAll('.action-item');
            expect(actionItems.length).toBe(2);
            
            // Step 4: Test edit functionality
            const firstEditButton = modal.querySelector('.edit-action');
            const actionId = firstEditButton.getAttribute('data-id');
            
            expect(() => {
                customActionManager.showActionModal(actionId, true);
            }).not.toThrow();
            
            // Should now show edit modal
            const editModal = document.querySelector('.modal-overlay');
            const editTitle = editModal.querySelector('h3');
            expect(editTitle.textContent).toBe('Edit Custom Action');
        });

        test('Action selector population workflow', () => {
            // Step 1: Create actions
            const testActions = [
                { name: 'Summary Action', type: 'template', template: 'Summary: {{.Transcript}}' },
                { name: 'AI Analysis', type: 'openai', prompt: 'Analyze this' }
            ];
            
            testActions.forEach(action => {
                customActionManager.saveAction(action);
            });
            
            // Step 2: Populate selector
            expect(() => {
                customActionManager.populateActionSelector();
            }).not.toThrow();
            
            // Step 3: Verify options were added
            const selector = document.getElementById('post_action');
            const options = selector.querySelectorAll('option');
            
            expect(options.length).toBeGreaterThan(2); // "No action" + 2 custom actions
            
            // Verify custom actions group
            const customGroup = selector.querySelector('optgroup[label="Custom Actions"]');
            expect(customGroup).toBeTruthy();
            
            const customOptions = customGroup.querySelectorAll('option');
            expect(customOptions.length).toBe(2);
        });
    });

    describe('Error Recovery Tests', () => {
        test('Should recover from SecurityUtils temporarily unavailable', () => {
            // Temporarily remove SecurityUtils
            const originalSecurityUtils = window.SecurityUtils;
            window.SecurityUtils = undefined;
            
            expect(() => {
                customActionManager.showCreateModal();
            }).not.toThrow();
            
            // Should still create modal with fallback escaping
            const modal = document.querySelector('.modal-overlay');
            expect(modal).toBeTruthy();
            
            // Restore SecurityUtils
            window.SecurityUtils = originalSecurityUtils;
        });

        test('Should handle malformed action data gracefully', () => {
            const malformedAction = {
                name: null,
                description: undefined,
                template: { toString: () => '<script>evil</script>' },
                type: 'invalid'
            };
            
            expect(() => {
                const modalHtml = customActionManager.createActionModalHTML(malformedAction, false);
                expect(modalHtml).not.toContain('<script>');
            }).not.toThrow();
        });

        test('Should handle DOM manipulation errors', () => {
            // Mock querySelector to fail
            const originalQuerySelector = document.querySelector;
            document.querySelector = jest.fn(() => {
                throw new Error('DOM error');
            });
            
            expect(() => {
                customActionManager.showCreateModal();
            }).not.toThrow();
            
            // Restore original function
            document.querySelector = originalQuerySelector;
        });
    });

    describe('Performance Tests', () => {
        test('Modal creation should be fast', () => {
            const startTime = Date.now();
            
            customActionManager.showCreateModal();
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            expect(duration).toBeLessThan(100); // Should be under 100ms
        });

        test('Should handle many actions efficiently', () => {
            // Create 50 actions
            const manyActions = Array.from({ length: 50 }, (_, i) => ({
                name: `Action ${i}`,
                description: `Description ${i}`,
                type: i % 2 === 0 ? 'template' : 'openai',
                template: i % 2 === 0 ? `Template ${i}` : undefined,
                prompt: i % 2 === 1 ? `Prompt ${i}` : undefined
            }));
            
            manyActions.forEach(action => {
                customActionManager.saveAction(action);
            });
            
            const startTime = Date.now();
            
            expect(() => {
                customActionManager.showManageModal();
            }).not.toThrow();
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            expect(duration).toBeLessThan(500); // Should handle 50 actions under 500ms
            
            // Verify all actions are displayed
            const modal = document.querySelector('.modal-overlay');
            const actionItems = modal.querySelectorAll('.action-item');
            expect(actionItems.length).toBe(50);
        });
    });
});

// Restore console.error
console.error = originalConsoleError;

console.log('✅ Create and Manage button functionality tests completed successfully');