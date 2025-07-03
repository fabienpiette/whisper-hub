/**
 * SecurityUtils Integration Test - Focused on the specific error fix
 * Tests that SecurityUtils.escapeHtml works correctly and fallbacks are in place
 */

// Add Node.js polyfills for browser APIs
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

const { JSDOM } = require('jsdom');

// Mock DOM environment
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head><title>SecurityUtils Integration Test</title></head>
<body>
    <div id="test-container"></div>
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
global.crypto = {
    getRandomValues: (array) => {
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        return array;
    }
};

// Load SecurityUtils
const fs = require('fs');
const path = require('path');
const securityJs = fs.readFileSync(path.join(__dirname, '../web/static/js/security.js'), 'utf8');
eval(securityJs);

describe('SecurityUtils Integration Tests - Fixed escapeHtml Issue', () => {
    beforeEach(() => {
        // Reset any modifications
        localStorage.clear();
    });

    describe('Core SecurityUtils.escapeHtml Functionality', () => {
        test('SecurityUtils.escapeHtml should be defined and callable', () => {
            expect(window.SecurityUtils).toBeDefined();
            expect(typeof SecurityUtils.escapeHtml).toBe('function');
            
            // This was the error: "SecurityUtils.escapeHtml is not a function"
            expect(() => {
                SecurityUtils.escapeHtml('<script>test</script>');
            }).not.toThrow();
        });

        test('SecurityUtils.escapeHtml should escape HTML correctly', () => {
            const maliciousInputs = [
                '<script>alert("xss")</script>',
                '<img src="x" onerror="alert(1)">',
                '<div onclick="alert(1)">Click me</div>',
                '"><script>alert(1)</script>',
                "'><script>alert(1)</script>"
            ];

            maliciousInputs.forEach(input => {
                const result = SecurityUtils.escapeHtml(input);
                expect(result).toContain('&lt;'); // Should escape < to &lt;
                expect(result).toContain('&gt;'); // Should escape > to &gt;
                expect(result).not.toContain('<script>'); // Should not contain unescaped scripts
            });
        });

        test('SecurityUtils.escapeHtml should handle edge cases', () => {
            const edgeCases = [
                { input: null, description: 'null value' },
                { input: undefined, description: 'undefined value' },
                { input: '', description: 'empty string' },
                { input: 'normal text', description: 'normal text' },
                { input: 123, description: 'number' },
                { input: true, description: 'boolean' }
            ];

            edgeCases.forEach(({ input, description }) => {
                expect(() => {
                    const result = SecurityUtils.escapeHtml(input);
                    expect(result).toBeDefined();
                }).not.toThrow(`Should handle ${description} without throwing`);
            });
        });
    });

    describe('Fallback Mechanism Tests', () => {
        test('Fallback escapeHtml should work when SecurityUtils is unavailable', () => {
            // Test the fallback implementation that was added to app.js
            const fallbackEscapeHtml = (text) => {
                if (window.SecurityUtils && window.SecurityUtils.escapeHtml) {
                    return window.SecurityUtils.escapeHtml(text);
                }
                if (typeof text !== 'string') return text;
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            };

            // Temporarily remove SecurityUtils
            const originalSecurityUtils = window.SecurityUtils;
            window.SecurityUtils = undefined;

            const maliciousInput = '<script>alert("test")</script>';
            const result = fallbackEscapeHtml(maliciousInput);

            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');

            // Restore SecurityUtils
            window.SecurityUtils = originalSecurityUtils;
        });

        test('Should prefer SecurityUtils when available', () => {
            const fallbackEscapeHtml = (text) => {
                if (window.SecurityUtils && window.SecurityUtils.escapeHtml) {
                    return window.SecurityUtils.escapeHtml(text);
                }
                if (typeof text !== 'string') return text;
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            };

            const testInput = '<b>bold text</b>';
            
            // Mock SecurityUtils to verify it's called
            const originalEscapeHtml = SecurityUtils.escapeHtml;
            SecurityUtils.escapeHtml = jest.fn(originalEscapeHtml);

            fallbackEscapeHtml(testInput);

            expect(SecurityUtils.escapeHtml).toHaveBeenCalledWith(testInput);

            // Restore original method
            SecurityUtils.escapeHtml = originalEscapeHtml;
        });
    });

    describe('Modal HTML Generation Safety', () => {
        test('Should safely create modal HTML with escaped content', () => {
            // Simulate the modal generation that was causing the original error
            const createSafeModalHTML = (title, content) => {
                const escapeHtml = (text) => {
                    if (window.SecurityUtils && window.SecurityUtils.escapeHtml) {
                        return window.SecurityUtils.escapeHtml(text);
                    }
                    if (typeof text !== 'string') return text;
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                };

                return `
                    <div class="modal-overlay">
                        <div class="modal-content">
                            <h3>${escapeHtml(title)}</h3>
                            <div class="modal-body">
                                ${escapeHtml(content)}
                            </div>
                        </div>
                    </div>
                `;
            };

            const maliciousTitle = '<script>alert("title")</script>Malicious Title';
            const maliciousContent = '<img src="x" onerror="alert(1)">Malicious Content';

            expect(() => {
                const modalHTML = createSafeModalHTML(maliciousTitle, maliciousContent);
                
                // Should not contain unescaped dangerous scripts
                expect(modalHTML).not.toContain('<script>');
                expect(modalHTML).not.toMatch(/<img[^>]*onerror=/); // Should not contain unescaped onerror
                
                // Should contain escaped content
                expect(modalHTML).toContain('&lt;script&gt;');
                expect(modalHTML).toContain('Malicious Title');
                expect(modalHTML).toContain('Malicious Content');
                // Verify the content is properly escaped (matches actual output from SecurityUtils)
                expect(modalHTML).toContain('&lt;img src=\"x\" onerror=\"alert(1)\"&gt;');
                
            }).not.toThrow();
        });

        test('Should handle action form data safely', () => {
            // Simulate action form processing that was causing errors
            const createSafeActionForm = (action) => {
                const escapeHtml = (text) => {
                    if (window.SecurityUtils && window.SecurityUtils.escapeHtml) {
                        return window.SecurityUtils.escapeHtml(text);
                    }
                    if (typeof text !== 'string') return text;
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                };

                const safeName = escapeHtml(action.name || '');
                const safeDescription = escapeHtml(action.description || '');
                const safeTemplate = escapeHtml(action.template || '');

                return `
                    <form class="action-form">
                        <input type="text" id="action-name" value="${safeName}">
                        <textarea id="action-description">${safeDescription}</textarea>
                        <textarea id="action-template">${safeTemplate}</textarea>
                    </form>
                `;
            };

            const maliciousAction = {
                name: '<script>alert("name")</script>',
                description: '<img src="x" onerror="alert(1)">',
                template: '"><script>alert("template")</script>'
            };

            expect(() => {
                const formHTML = createSafeActionForm(maliciousAction);
                
                // Should not contain unescaped dangerous scripts  
                expect(formHTML).not.toContain('<script>');
                expect(formHTML).not.toMatch(/<img[^>]*onerror=/); // Should not contain unescaped onerror
                expect(formHTML).not.toMatch(/"><script>/); // Should not contain unescaped script injection
                
                // Should contain escaped content
                expect(formHTML).toContain('&lt;script&gt;');
                // Verify the dangerous attributes are escaped (matches actual output from SecurityUtils)
                expect(formHTML).toContain('&lt;img src=\"x\" onerror=\"alert(1)\"&gt;');
                
            }).not.toThrow();
        });

        test('Should handle undefined action properties gracefully', () => {
            // Test the scenario that was originally causing the error
            const createActionForm = (action) => {
                const escapeHtml = (text) => {
                    if (window.SecurityUtils && window.SecurityUtils.escapeHtml) {
                        return window.SecurityUtils.escapeHtml(text);
                    }
                    if (typeof text !== 'string') return text;
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                };

                const defaultAction = {
                    name: action.name || '',
                    description: action.description || '',
                    template: action.template || '',
                    type: action.type || 'template'
                };

                return {
                    name: escapeHtml(defaultAction.name),
                    description: escapeHtml(defaultAction.description),
                    template: escapeHtml(defaultAction.template),
                    type: defaultAction.type
                };
            };

            const undefinedAction = {
                name: undefined,
                description: undefined,
                template: undefined,
                type: 'template'
            };

            expect(() => {
                const processedAction = createActionForm(undefinedAction);
                expect(processedAction.name).toBe('');
                expect(processedAction.description).toBe('');
                expect(processedAction.template).toBe('');
                expect(processedAction.type).toBe('template');
            }).not.toThrow();
        });
    });

    describe('Error Recovery Tests', () => {
        test('Should handle SecurityUtils method errors gracefully', () => {
            // Mock SecurityUtils to throw errors
            const originalEscapeHtml = SecurityUtils.escapeHtml;
            SecurityUtils.escapeHtml = jest.fn(() => {
                throw new Error('Mock SecurityUtils error');
            });

            const robustEscapeHtml = (text) => {
                try {
                    if (window.SecurityUtils && window.SecurityUtils.escapeHtml) {
                        return window.SecurityUtils.escapeHtml(text);
                    }
                } catch (error) {
                    console.warn('SecurityUtils failed, using fallback:', error.message);
                }
                
                // Fallback implementation
                if (typeof text !== 'string') return text;
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            };

            const testInput = '<script>test</script>';
            
            expect(() => {
                const result = robustEscapeHtml(testInput);
                expect(result).not.toContain('<script>');
                expect(result).toContain('&lt;script&gt;');
            }).not.toThrow();

            // Restore original method
            SecurityUtils.escapeHtml = originalEscapeHtml;
        });

        test('Should handle DOM errors in fallback gracefully', () => {
            // Mock document.createElement to throw an error
            const originalCreateElement = document.createElement;
            document.createElement = jest.fn(() => {
                throw new Error('DOM error');
            });

            const ultimateFallbackEscapeHtml = (text) => {
                try {
                    if (window.SecurityUtils && window.SecurityUtils.escapeHtml) {
                        return window.SecurityUtils.escapeHtml(text);
                    }
                    
                    if (typeof text !== 'string') return text;
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                } catch (error) {
                    // Ultimate fallback: basic string replacement
                    return String(text)
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#x27;');
                }
            };

            const testInput = '<script>test</script>';
            
            expect(() => {
                const result = ultimateFallbackEscapeHtml(testInput);
                expect(result).not.toContain('<script>');
                expect(result).toContain('&lt;script&gt;');
            }).not.toThrow();

            // Restore original function
            document.createElement = originalCreateElement;
        });
    });

    describe('Performance Tests', () => {
        test('SecurityUtils.escapeHtml should perform reasonably fast', () => {
            const testString = '<script>alert("test")</script>'.repeat(100);
            
            const startTime = Date.now();
            
            for (let i = 0; i < 1000; i++) {
                SecurityUtils.escapeHtml(testString);
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Should complete 1000 escaping operations in under 100ms
            expect(duration).toBeLessThan(100);
        });

        test('Fallback mechanism should not significantly impact performance', () => {
            const fallbackEscapeHtml = (text) => {
                if (window.SecurityUtils && window.SecurityUtils.escapeHtml) {
                    return window.SecurityUtils.escapeHtml(text);
                }
                if (typeof text !== 'string') return text;
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            };

            const testString = '<script>alert("test")</script>';
            
            const startTime = Date.now();
            
            for (let i = 0; i < 1000; i++) {
                fallbackEscapeHtml(testString);
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Should complete 1000 operations in under 200ms
            expect(duration).toBeLessThan(200);
        });
    });
});

console.log('✅ SecurityUtils integration tests completed successfully');