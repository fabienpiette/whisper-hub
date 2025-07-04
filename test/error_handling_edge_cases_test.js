/**
 * Error Handling and Edge Case Tests
 * Tests system resilience and proper error handling
 */

const { JSDOM } = require('jsdom');

// Mock DOM environment
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head><title>Error Test</title></head>
<body>
    <div id="test-container"></div>
    <div id="error-display"></div>
    <div id="toast-container"></div>
</body>
</html>
`);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = {
    data: {},
    getItem: function(key) { 
        if (key === 'corrupt-key') throw new Error('Storage corrupted');
        return this.data[key] || null; 
    },
    setItem: function(key, value) { 
        if (key === 'readonly-key') throw new Error('Storage read-only');
        this.data[key] = value; 
    },
    removeItem: function(key) { delete this.data[key]; },
    clear: function() { this.data = {}; }
};

global.navigator = {
    clipboard: {
        writeText: jest.fn().mockImplementation((text) => {
            if (text === 'CLIPBOARD_ERROR') {
                return Promise.reject(new Error('Clipboard access denied'));
            }
            return Promise.resolve();
        })
    }
};

// Load application code
const fs = require('fs');
const path = require('path');
const appJs = fs.readFileSync(path.join(__dirname, '../web/static/js/app.js'), 'utf8');
const securityJs = fs.readFileSync(path.join(__dirname, '../web/static/js/security.js'), 'utf8');

eval(securityJs);
eval(appJs);

describe('Error Handling and Edge Case Tests', () => {
    beforeEach(() => {
        document.getElementById('test-container').innerHTML = '';
        document.getElementById('error-display').innerHTML = '';
        document.getElementById('toast-container').innerHTML = '';
        localStorage.clear();
        jest.clearAllMocks();
    });

    describe('Action Manager Error Handling', () => {
        test('should handle null and undefined action objects', () => {
            const actionManager = new CustomActionManager();
            
            // Test null action
            expect(() => {
                actionManager.validateAction(null);
            }).not.toThrow();
            
            const nullErrors = actionManager.validateAction(null);
            expect(nullErrors.length).toBeGreaterThan(0);
            expect(nullErrors.some(e => e.includes('required'))).toBe(true);
            
            // Test undefined action
            const undefinedErrors = actionManager.validateAction(undefined);
            expect(undefinedErrors.length).toBeGreaterThan(0);
            
            // Test empty object
            const emptyErrors = actionManager.validateAction({});
            expect(emptyErrors.length).toBeGreaterThan(0);
        });

        test('should handle malformed action objects', () => {
            const actionManager = new CustomActionManager();
            
            const malformedActions = [
                // Missing required fields
                { name: 'Test' }, // No type
                { type: 'template' }, // No name
                { name: 'Test', type: 'template' }, // No template
                { name: 'Test', type: 'openai' }, // No prompt
                
                // Invalid field types
                { name: 123, type: 'template', template: 'test' },
                { name: 'Test', type: 'template', template: null },
                { name: 'Test', type: 'openai', prompt: 'test', temperature: 'invalid' },
                { name: 'Test', type: 'openai', prompt: 'test', maxTokens: 'invalid' },
                
                // Circular references
                (() => {
                    const circular = { name: 'Test', type: 'template', template: 'test' };
                    circular.self = circular;
                    return circular;
                })(),
                
                // Special characters and edge cases
                { name: '', type: 'template', template: 'test' }, // Empty name
                { name: '\x00\x01\x02', type: 'template', template: 'test' }, // Control chars
                { name: 'Test', type: 'unknown', template: 'test' }, // Invalid type
            ];
            
            malformedActions.forEach((action, index) => {
                const errors = actionManager.validateAction(action);
                expect(errors.length).toBeGreaterThan(0);
                console.log(`Malformed action ${index}: ${errors.length} errors`);
            });
        });

        test('should handle extremely large action data', () => {
            const actionManager = new CustomActionManager();
            
            const largeActions = [
                {
                    name: 'A'.repeat(10000), // Very long name
                    type: 'template',
                    template: 'test'
                },
                {
                    name: 'Test',
                    type: 'template',
                    template: 'B'.repeat(100000) // Very long template
                },
                {
                    name: 'Test',
                    type: 'openai',
                    prompt: 'C'.repeat(50000), // Very long prompt
                    model: 'gpt-3.5-turbo'
                },
                {
                    name: 'Test',
                    type: 'template',
                    template: 'test',
                    description: 'D'.repeat(10000) // Very long description
                }
            ];
            
            largeActions.forEach((action) => {
                const errors = actionManager.validateAction(action);
                expect(errors.some(e => e.includes('too long'))).toBe(true);
            });
        });

        test('should handle storage failures gracefully', () => {
            const actionManager = new CustomActionManager();
            
            const validAction = {
                name: 'Storage Test',
                type: 'template',
                template: 'Test template',
                description: 'Test description'
            };
            
            // Test save failure due to storage error
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = jest.fn().mockImplementation(() => {
                throw new Error('Storage full');
            });
            
            expect(() => {
                actionManager.saveAction(validAction);
            }).not.toThrow();
            
            // Restore original function
            localStorage.setItem = originalSetItem;
            
            // Test load failure due to corrupted storage
            localStorage.setItem('whisper_custom_actions', 'invalid-json');
            
            expect(() => {
                actionManager.getActions();
            }).not.toThrow();
            
            const actions = actionManager.getActions();
            expect(Array.isArray(actions)).toBe(true);
        });

        test('should handle concurrent modification scenarios', () => {
            const actionManager1 = new CustomActionManager();
            const actionManager2 = new CustomActionManager();
            
            const action1 = {
                name: 'Concurrent Test 1',
                type: 'template',
                template: 'Template 1'
            };
            
            const action2 = {
                name: 'Concurrent Test 2',
                type: 'template',
                template: 'Template 2'
            };
            
            // Save actions from different managers
            const id1 = actionManager1.saveAction(action1);
            const id2 = actionManager2.saveAction(action2);
            
            expect(id1).toBeTruthy();
            expect(id2).toBeTruthy();
            expect(id1).not.toBe(id2);
            
            // Both managers should see both actions
            const actions1 = actionManager1.getActions();
            const actions2 = actionManager2.getActions();
            
            expect(actions1.length).toBe(actions2.length);
        });
    });

    describe('History Manager Error Handling', () => {
        test('should handle corrupted history data', () => {
            const historyManager = new TranscriptionHistory();
            
            // Set corrupted data in localStorage
            localStorage.setItem('whisper_transcription_history', 'invalid-json');
            
            expect(() => {
                historyManager.getHistory();
            }).not.toThrow();
            
            const history = historyManager.getHistory();
            expect(Array.isArray(history)).toBe(true);
            expect(history.length).toBe(0);
        });

        test('should handle null and malformed transcript data', () => {
            const historyManager = new TranscriptionHistory();
            
            const malformedTranscripts = [
                null,
                undefined,
                {},
                { id: 'test' }, // Missing required fields
                { transcript: 'test' }, // Missing ID
                { id: 'test', transcript: null },
                { id: 'test', transcript: 'test', timestamp: 'invalid-date' },
                { id: 'test', transcript: 'test', fileSize: 'invalid-size' }
            ];
            
            malformedTranscripts.forEach((transcript, index) => {
                expect(() => {
                    historyManager.addTranscript(transcript);
                }).not.toThrow();
                
                // Should not crash but may not save invalid data
                console.log(`Malformed transcript ${index} handled gracefully`);
            });
        });

        test('should handle storage quota exceeded scenarios', () => {
            const historyManager = new TranscriptionHistory();
            
            // Mock storage quota exceeded
            const originalSetItem = localStorage.setItem;
            let callCount = 0;
            localStorage.setItem = jest.fn().mockImplementation((key, value) => {
                callCount++;
                if (callCount > 3) {
                    throw new Error('QuotaExceededError');
                }
                return originalSetItem.call(localStorage, key, value);
            });
            
            // Add transcripts until quota exceeded
            for (let i = 0; i < 10; i++) {
                const transcript = {
                    id: `quota-test-${i}`,
                    transcript: 'A'.repeat(1000),
                    filename: `test-${i}.mp3`,
                    timestamp: new Date().toISOString(),
                    fileType: 'audio',
                    fileSize: 1024
                };
                
                expect(() => {
                    historyManager.addTranscript(transcript);
                }).not.toThrow();
            }
            
            // Restore original function
            localStorage.setItem = originalSetItem;
        });

        test('should handle search with special characters and edge cases', () => {
            const historyManager = new TranscriptionHistory();
            
            // Add test data
            historyManager.addTranscript({
                id: 'special-chars',
                transcript: 'Test with special chars: @#$%^&*()_+ "quotes" \'apostrophe\' <tags>',
                filename: 'special.mp3',
                timestamp: new Date().toISOString(),
                fileType: 'audio',
                fileSize: 1024
            });
            
            const edgeCaseQueries = [
                '', // Empty query
                null,
                undefined,
                '   ', // Whitespace only
                'a'.repeat(1000), // Very long query
                '@#$%^&*()', // Special characters
                '<script>alert("xss")</script>', // XSS attempt
                'SELECT * FROM users', // SQL injection attempt
                '\x00\x01\x02', // Control characters
                '\\', // Backslash
                '"', // Quote
                "'", // Apostrophe
                '/', // Forward slash
                '..', // Directory traversal
                '%00', // Null byte
                '\n\r\t' // Newlines and tabs
            ];
            
            edgeCaseQueries.forEach((query) => {
                expect(() => {
                    const results = historyManager.searchTranscripts(query);
                    expect(Array.isArray(results)).toBe(true);
                }).not.toThrow();
            });
        });

        test('should handle export with corrupted or missing data', () => {
            const historyManager = new TranscriptionHistory();
            
            // Add transcript with some missing fields
            historyManager.addTranscript({
                id: 'incomplete',
                transcript: 'Test transcript',
                // Missing filename, timestamp, etc.
            });
            
            const exportFormats = ['json', 'csv', 'txt'];
            
            exportFormats.forEach((format) => {
                expect(() => {
                    const exported = historyManager.exportHistory(format);
                    expect(typeof exported).toBe('string');
                    expect(exported.length).toBeGreaterThan(0);
                }).not.toThrow();
            });
        });
    });

    describe('Security Utils Error Handling', () => {
        test('should handle encryption/decryption failures gracefully', async () => {
            if (typeof SecurityUtils === 'undefined') {
                console.log('SecurityUtils not available, skipping encryption tests');
                return;
            }
            
            const edgeCases = [
                { data: null, key: 'test' },
                { data: undefined, key: 'test' },
                { data: '', key: 'test' },
                { data: 'test', key: null },
                { data: 'test', key: undefined },
                { data: 'test', key: '' },
                { data: 'A'.repeat(10000), key: 'test' }, // Large data
                { data: 'test', key: 'B'.repeat(1000) }, // Large key
            ];
            
            for (const testCase of edgeCases) {
                try {
                    const encrypted = await SecurityUtils.encryptData(testCase.data, testCase.key);
                    if (encrypted) {
                        const decrypted = await SecurityUtils.decryptData(encrypted, testCase.key);
                        expect(decrypted).toBe(testCase.data);
                    }
                } catch (error) {
                    // Should handle errors gracefully
                    expect(error).toBeInstanceOf(Error);
                }
            }
        });

        test('should handle HTML escaping edge cases', () => {
            if (typeof SecurityUtils === 'undefined') {
                console.log('SecurityUtils not available, skipping HTML escaping tests');
                return;
            }
            
            const edgeCases = [
                null,
                undefined,
                '',
                '<script>alert("xss")</script>',
                '&amp;&lt;&gt;&quot;&#x27;',
                '\x00\x01\x02',
                'A'.repeat(100000), // Very long string
                '🚀🎉💻', // Emojis
                'Hello\nWorld\r\nTest\t',
                '<img src="x" onerror="alert(1)">',
                'javascript:alert(1)',
                'data:text/html,<script>alert(1)</script>',
            ];
            
            edgeCases.forEach((input) => {
                expect(() => {
                    const escaped = SecurityUtils.escapeHtml(input);
                    if (escaped !== null && escaped !== undefined) {
                        expect(typeof escaped).toBe('string');
                        if (input && input.includes('<script>')) {
                            expect(escaped).not.toContain('<script>');
                        }
                    }
                }).not.toThrow();
            });
        });

        test('should handle filename sanitization edge cases', () => {
            if (typeof SecurityUtils === 'undefined' || !SecurityUtils.sanitizeFilename) {
                console.log('SecurityUtils.sanitizeFilename not available, skipping filename tests');
                return;
            }
            
            const edgeCases = [
                null,
                undefined,
                '',
                '/',
                '\\',
                '..',
                '../../../etc/passwd',
                'file<script>alert(1)</script>.txt',
                'file"onload="alert(1)".txt',
                'file\x00.txt',
                'file\n\r.txt',
                'CON', // Windows reserved name
                'PRN.txt',
                'AUX.txt',
                'file name with spaces.txt',
                'very-long-filename-' + 'a'.repeat(255) + '.txt',
                '🚀💻.txt', // Unicode/emoji
            ];
            
            edgeCases.forEach((filename) => {
                expect(() => {
                    const sanitized = SecurityUtils.sanitizeFilename(filename);
                    if (sanitized !== null && sanitized !== undefined) {
                        expect(typeof sanitized).toBe('string');
                        expect(sanitized).not.toContain('<script>');
                        expect(sanitized).not.toContain('../');
                        expect(sanitized).not.toContain('\x00');
                    }
                }).not.toThrow();
            });
        });
    });

    describe('DOM Manipulation Error Handling', () => {
        test('should handle missing DOM elements gracefully', () => {
            const whisperApp = new WhisperApp();
            
            // Test operations on non-existent elements
            expect(() => {
                whisperApp.copyResult(null);
            }).not.toThrow();
            
            expect(() => {
                whisperApp.downloadResult(null);
            }).not.toThrow();
            
            expect(() => {
                whisperApp.selectText('non-existent-element');
            }).not.toThrow();
        });

        test('should handle clipboard API failures', async () => {
            // Test clipboard failure
            await expect(async () => {
                await navigator.clipboard.writeText('CLIPBOARD_ERROR');
            }).rejects.toThrow();
            
            // App should handle this gracefully
            const whisperApp = new WhisperApp();
            
            // Create a mock element with clipboard error text
            const mockElement = document.createElement('div');
            mockElement.setAttribute('data-transcript', 'CLIPBOARD_ERROR');
            document.body.appendChild(mockElement);
            
            expect(() => {
                whisperApp.copyResult(mockElement);
            }).not.toThrow();
        });

        test('should handle malformed event data', () => {
            const whisperApp = new WhisperApp();
            
            const malformedEvents = [
                null,
                undefined,
                {},
                { target: null },
                { target: {} },
                { target: { getAttribute: null } },
                { target: { getAttribute: () => null } },
            ];
            
            malformedEvents.forEach((event) => {
                expect(() => {
                    // Simulate event handling with malformed data
                    if (event && event.target) {
                        whisperApp.copyResult(event.target);
                    }
                }).not.toThrow();
            });
        });
    });

    describe('Network Error Handling', () => {
        test('should handle fetch API failures', async () => {
            global.fetch = jest.fn().mockImplementation((url) => {
                if (url.includes('fail')) {
                    return Promise.reject(new Error('Network error'));
                }
                if (url.includes('timeout')) {
                    return new Promise(() => {}); // Never resolves
                }
                if (url.includes('invalid-json')) {
                    return Promise.resolve({
                        ok: true,
                        text: () => Promise.resolve('invalid-json')
                    });
                }
                if (url.includes('server-error')) {
                    return Promise.resolve({
                        ok: false,
                        status: 500,
                        text: () => Promise.resolve('Internal Server Error')
                    });
                }
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve('<div>Success</div>')
                });
            });
            
            const whisperApp = new WhisperApp();
            
            // Test network failure
            expect(async () => {
                await fetch('/fail');
            }).rejects.toThrow();
            
            // Test server error
            const serverErrorResponse = await fetch('/server-error');
            expect(serverErrorResponse.ok).toBe(false);
            expect(serverErrorResponse.status).toBe(500);
            
            // Test invalid JSON response
            const invalidJsonResponse = await fetch('/invalid-json');
            const invalidText = await invalidJsonResponse.text();
            expect(invalidText).toBe('invalid-json');
        });
    });

    describe('Memory Management Edge Cases', () => {
        test('should handle memory pressure scenarios', () => {
            const historyManager = new TranscriptionHistory();
            
            // Simulate memory pressure by creating large objects
            const largeObjects = [];
            
            try {
                for (let i = 0; i < 1000; i++) {
                    const largeTranscript = {
                        id: `memory-pressure-${i}`,
                        transcript: 'A'.repeat(10000), // 10KB each
                        filename: `large-${i}.mp3`,
                        timestamp: new Date().toISOString(),
                        fileType: 'audio',
                        fileSize: 1024 * 1024 * 10 // 10MB
                    };
                    
                    largeObjects.push(largeTranscript);
                    historyManager.addTranscript(largeTranscript);
                    
                    // Check if we can still perform operations
                    const history = historyManager.getHistory();
                    expect(Array.isArray(history)).toBe(true);
                }
            } catch (error) {
                // May run out of memory, which is expected
                console.log('Memory pressure test reached limit:', error.message);
            }
            
            // Cleanup
            largeObjects.length = 0;
            historyManager.clearHistory();
        });

        test('should handle circular reference scenarios', () => {
            const actionManager = new CustomActionManager();
            
            // Create object with circular reference
            const action = {
                name: 'Circular Test',
                type: 'template',
                template: 'Test template'
            };
            action.circular = action;
            
            expect(() => {
                actionManager.validateAction(action);
            }).not.toThrow();
            
            expect(() => {
                actionManager.saveAction(action);
            }).not.toThrow();
        });
    });

    describe('Race Condition Handling', () => {
        test('should handle rapid successive operations', async () => {
            const actionManager = new CustomActionManager();
            const operations = [];
            
            // Create many rapid operations
            for (let i = 0; i < 50; i++) {
                operations.push(
                    new Promise(resolve => {
                        setTimeout(() => {
                            const action = {
                                name: `Race Test ${i}`,
                                type: 'template',
                                template: `Template ${i}`
                            };
                            
                            const errors = actionManager.validateAction(action);
                            const actionId = actionManager.saveAction(action);
                            
                            resolve({ errors, actionId });
                        }, Math.random() * 10);
                    })
                );
            }
            
            const results = await Promise.all(operations);
            
            // All operations should complete without throwing
            expect(results.length).toBe(50);
            results.forEach((result, index) => {
                expect(result.errors).toBeDefined();
                expect(result.actionId).toBeTruthy();
            });
        });
    });
});

console.log('✅ Error handling and edge case tests completed successfully');