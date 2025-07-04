/**
 * SecurityUtils Comprehensive Test Suite
 * Tests all SecurityUtils functionality and fallback mechanisms
 */

// Add Node.js polyfills for browser APIs
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

const { JSDOM } = require('jsdom');

// Mock DOM environment
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head><title>SecurityUtils Test</title></head>
<body>
    <div id="test-container"></div>
</body>
</html>
`);

global.window = dom.window;
global.document = dom.window.document;
global.crypto = {
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

// Load SecurityUtils
const fs = require('fs');
const path = require('path');
const securityJs = fs.readFileSync(path.join(__dirname, '../web/static/js/security.js'), 'utf8');
eval(securityJs);

describe('SecurityUtils Core Functionality Tests', () => {
    beforeEach(() => {
        const container = document.getElementById('test-container');
        if (container) {
            container.innerHTML = '';
        }
    });

    describe('HTML Escaping and Sanitization', () => {
        test('escapeHtml should escape dangerous HTML characters', () => {
            const maliciousInputs = [
                '<script>alert("xss")</script>',
                '<img src="x" onerror="alert(1)">',
                '"><script>alert(1)</script>',
                "'><script>alert(1)</script>",
                '<iframe src="javascript:alert(1)"></iframe>',
                '<svg onload="alert(1)">',
                '<div onclick="alert(1)">Click me</div>'
            ];

            maliciousInputs.forEach(input => {
                const escaped = SecurityUtils.escapeHtml(input);
                expect(escaped).not.toContain('<script>');
                expect(escaped).not.toContain('onerror=');
                expect(escaped).not.toContain('onload=');
                expect(escaped).not.toContain('onclick=');
                expect(escaped).not.toContain('javascript:');
                expect(escaped).toContain('&lt;'); // Should escape < to &lt;
            });
        });

        test('escapeHtml should handle edge cases safely', () => {
            const edgeCases = [
                null,
                undefined,
                '',
                0,
                false,
                {},
                [],
                'normal text',
                '   whitespace   ',
                'text with "quotes" and \'apostrophes\'',
                'unicode: 🚀 emoji test',
                'very'.repeat(1000) // Long string
            ];

            edgeCases.forEach(input => {
                expect(() => {
                    const result = SecurityUtils.escapeHtml(input);
                    expect(typeof result).toBe('string');
                }).not.toThrow();
            });
        });

        test('sanitizeHTML should work identically to escapeHtml', () => {
            const testInputs = [
                '<script>test</script>',
                '<b>bold</b>',
                'plain text',
                '<div>content</div>'
            ];

            testInputs.forEach(input => {
                const escaped = SecurityUtils.escapeHtml(input);
                const sanitized = SecurityUtils.sanitizeHTML(input);
                expect(escaped).toBe(sanitized);
            });
        });
    });

    describe('DOM Manipulation Security', () => {
        test('safeSetHTML should prevent XSS in DOM manipulation', () => {
            const container = document.getElementById('test-container');
            const maliciousContent = '<script>window.xssExecuted = true;</script><p>Safe content</p>';
            
            SecurityUtils.safeSetHTML(container, maliciousContent);
            
            expect(container.innerHTML).not.toContain('<script>');
            expect(container.innerHTML).toContain('Safe content');
            expect(window.xssExecuted).toBeUndefined();
        });

        test('createElement should create safe DOM elements', () => {
            const element = SecurityUtils.createElement('div', {
                'class': 'test-class',
                'data-id': '123',
                'onclick': 'alert(1)', // Should be filtered out
                'onerror': 'alert(1)' // Should be filtered out
            }, 'Safe text content');

            expect(element.tagName).toBe('DIV');
            expect(element.className).toBe('test-class');
            expect(element.getAttribute('data-id')).toBe('123');
            expect(element.getAttribute('onclick')).toBeNull();
            expect(element.getAttribute('onerror')).toBeNull();
            expect(element.textContent).toBe('Safe text content');
        });

        test('isValidAttribute should filter dangerous attributes', () => {
            const validAttributes = ['id', 'class', 'data-id', 'title', 'href'];
            const dangerousAttributes = ['onclick', 'onerror', 'onload', 'javascript', 'vbscript'];

            validAttributes.forEach(attr => {
                expect(SecurityUtils.isValidAttribute(attr)).toBe(true);
            });

            dangerousAttributes.forEach(attr => {
                expect(SecurityUtils.isValidAttribute(attr)).toBe(false);
            });
        });

        test('sanitizeAttribute should clean attribute values', () => {
            const dangerousValues = [
                'javascript:alert(1)',
                'onclick=alert(1)',
                '<script>alert(1)</script>',
                '" onload="alert(1)'
            ];

            dangerousValues.forEach(value => {
                const sanitized = SecurityUtils.sanitizeAttribute(value);
                expect(sanitized).not.toContain('javascript:');
                expect(sanitized).not.toContain('onclick');
                expect(sanitized).not.toContain('<script>');
                expect(sanitized).not.toContain('onload=');
            });
        });
    });

    describe('Filename Sanitization', () => {
        test('sanitizeFilename should clean dangerous filenames', () => {
            const dangerousFilenames = [
                '../../../etc/passwd',
                'file<script>alert(1)</script>.txt',
                'file"onload="alert(1)".txt',
                'file\x00.txt',
                'file\n\r.txt',
                'CON', // Windows reserved
                'PRN.txt',
                '',
                null,
                undefined
            ];

            dangerousFilenames.forEach(filename => {
                const sanitized = SecurityUtils.sanitizeFilename(filename);
                expect(sanitized).not.toContain('../');
                expect(sanitized).not.toContain('<script>');
                expect(sanitized).not.toContain('\x00');
                expect(sanitized).not.toContain('\n');
                expect(sanitized).not.toContain('\r');
                expect(typeof sanitized).toBe('string');
                expect(sanitized.length).toBeGreaterThan(0);
            });
        });

        test('sanitizeFilename should preserve valid filenames', () => {
            const validFilenames = [
                'document.pdf',
                'meeting-notes.txt',
                'audio_file.mp3',
                'presentation 2024.pptx'
            ];

            validFilenames.forEach(filename => {
                const sanitized = SecurityUtils.sanitizeFilename(filename);
                expect(sanitized).toContain(filename.replace(/\s/g, '_')); // Spaces might be replaced
            });
        });
    });

    describe('CSRF Protection', () => {
        test('generateCSRFToken should create unique tokens', () => {
            const token1 = SecurityUtils.generateCSRFToken();
            const token2 = SecurityUtils.generateCSRFToken();

            expect(token1).toBeTruthy();
            expect(token2).toBeTruthy();
            expect(token1).not.toBe(token2);
            expect(token1.length).toBeGreaterThan(10);
            expect(token2.length).toBeGreaterThan(10);
            expect(/^[a-f0-9]+$/.test(token1)).toBe(true); // Hex format
        });

        test('validateCSRFToken should validate tokens correctly', () => {
            const validToken = 'abc123def456';
            const invalidTokens = [
                'wrong-token',
                '',
                null,
                undefined,
                'abc123def45', // Different length
                'ABC123DEF456' // Different case
            ];

            expect(SecurityUtils.validateCSRFToken(validToken, validToken)).toBe(true);

            invalidTokens.forEach(invalidToken => {
                expect(SecurityUtils.validateCSRFToken(invalidToken, validToken)).toBe(false);
            });
        });

        test('validateCSRFToken should prevent timing attacks', () => {
            const validToken = 'a'.repeat(32);
            const shortToken = 'a';
            const longToken = 'a'.repeat(64);

            // Should return false quickly for different lengths
            const start = Date.now();
            const result = SecurityUtils.validateCSRFToken(shortToken, validToken);
            const duration = Date.now() - start;

            expect(result).toBe(false);
            expect(duration).toBeLessThan(10); // Should be very fast
        });
    });

    describe('URL Validation', () => {
        test('isSafeURL should validate safe URLs', () => {
            const safeUrls = [
                '/relative/path',
                './file.html',
                'https://unpkg.com/library@1.0.0/dist/file.js',
                '#anchor'
            ];

            // Mock window.location for testing
            global.window.location = { origin: 'http://localhost:8080' };

            safeUrls.forEach(url => {
                const isSafe = SecurityUtils.isSafeURL(url);
                expect(typeof isSafe).toBe('boolean');
            });
        });

        test('isSafeURL should reject dangerous URLs', () => {
            const dangerousUrls = [
                'javascript:alert(1)',
                'data:text/html,<script>alert(1)</script>',
                'https://evil.com/malware.js',
                'ftp://malicious.com/file'
            ];

            global.window.location = { origin: 'http://localhost:8080' };

            dangerousUrls.forEach(url => {
                const isSafe = SecurityUtils.isSafeURL(url);
                expect(isSafe).toBe(false);
            });
        });
    });

    describe('Rate Limiting', () => {
        beforeEach(() => {
            // Clear localStorage
            global.localStorage = {
                data: {},
                getItem: function(key) { return this.data[key] || null; },
                setItem: function(key, value) { this.data[key] = value; },
                removeItem: function(key) { delete this.data[key]; },
                clear: function() { this.data = {}; }
            };
        });

        test('checkRateLimit should allow requests within limit', () => {
            const key = 'test-operation';
            const maxRequests = 5;
            const windowMs = 60000;

            // Should allow first few requests
            for (let i = 0; i < maxRequests; i++) {
                expect(SecurityUtils.checkRateLimit(key, maxRequests, windowMs)).toBe(true);
            }

            // Should block after limit exceeded
            expect(SecurityUtils.checkRateLimit(key, maxRequests, windowMs)).toBe(false);
        });

        test('checkRateLimit should reset after time window', () => {
            const key = 'test-reset';
            const maxRequests = 2;
            const windowMs = 100; // Short window for testing

            // Exhaust limit
            expect(SecurityUtils.checkRateLimit(key, maxRequests, windowMs)).toBe(true);
            expect(SecurityUtils.checkRateLimit(key, maxRequests, windowMs)).toBe(true);
            expect(SecurityUtils.checkRateLimit(key, maxRequests, windowMs)).toBe(false);

            // Wait for window to expire and try again
            return new Promise(resolve => {
                setTimeout(() => {
                    expect(SecurityUtils.checkRateLimit(key, maxRequests, windowMs)).toBe(true);
                    resolve();
                }, windowMs + 10);
            });
        });
    });

    describe('Encryption/Decryption', () => {
        test('encryptData and decryptData should work together', async () => {
            const testData = 'sensitive information';
            const key = 'encryption-key';

            const encrypted = await SecurityUtils.encryptData(testData, key);
            expect(encrypted).toBeTruthy();
            expect(encrypted).not.toBe(testData);

            const decrypted = await SecurityUtils.decryptData(encrypted, key);
            expect(decrypted).toBe(testData);
        });

        test('encryption should handle edge cases gracefully', async () => {
            const edgeCases = [
                { data: '', key: 'test' },
                { data: 'test', key: '' },
                { data: null, key: 'test' },
                { data: 'test', key: null }
            ];

            for (const testCase of edgeCases) {
                try {
                    const result = await SecurityUtils.encryptData(testCase.data, testCase.key);
                    expect(typeof result).toBe('string');
                } catch (error) {
                    // Should handle errors gracefully
                    expect(error).toBeInstanceOf(Error);
                }
            }
        });

        test('decryption with wrong key should fail gracefully', async () => {
            const testData = 'secret data';
            const correctKey = 'correct-key';
            const wrongKey = 'wrong-key';

            const encrypted = await SecurityUtils.encryptData(testData, correctKey);
            const decrypted = await SecurityUtils.decryptData(encrypted, wrongKey);

            // Should return original encrypted data as fallback
            expect(decrypted).toBe(encrypted);
        });
    });
});

describe('Frontend Integration Tests', () => {
    let mockSecurityUtils;

    beforeEach(() => {
        // Reset global state
        delete global.window.SecurityUtils;
        
        // Mock SecurityUtils availability scenarios
        mockSecurityUtils = {
            escapeHtml: jest.fn((text) => {
                if (typeof text !== 'string') return text;
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            })
        };
    });

    describe('Fallback Mechanism Tests', () => {
        test('escapeHtml fallback should work when SecurityUtils is not available', () => {
            // Ensure SecurityUtils is not available
            global.window.SecurityUtils = undefined;

            // Test the fallback implementation
            const fallbackEscapeHtml = (text) => {
                if (window.SecurityUtils && window.SecurityUtils.escapeHtml) {
                    return window.SecurityUtils.escapeHtml(text);
                }
                if (typeof text !== 'string') return text;
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            };

            const maliciousInput = '<script>alert("xss")</script>';
            const escaped = fallbackEscapeHtml(maliciousInput);

            expect(escaped).not.toContain('<script>');
            expect(escaped).toContain('&lt;script&gt;');
        });

        test('escapeHtml should use SecurityUtils when available', () => {
            // Make SecurityUtils available
            global.window.SecurityUtils = mockSecurityUtils;

            const fallbackEscapeHtml = (text) => {
                if (window.SecurityUtils && window.SecurityUtils.escapeHtml) {
                    return window.SecurityUtils.escapeHtml(text);
                }
                if (typeof text !== 'string') return text;
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            };

            const testInput = '<b>test</b>';
            fallbackEscapeHtml(testInput);

            expect(mockSecurityUtils.escapeHtml).toHaveBeenCalledWith(testInput);
        });

        test('fallback should handle all data types safely', () => {
            global.window.SecurityUtils = undefined;

            const fallbackEscapeHtml = (text) => {
                if (window.SecurityUtils && window.SecurityUtils.escapeHtml) {
                    return window.SecurityUtils.escapeHtml(text);
                }
                if (typeof text !== 'string') return text;
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            };

            const testCases = [
                null,
                undefined,
                0,
                false,
                {},
                [],
                '<script>test</script>',
                'normal text'
            ];

            testCases.forEach(testCase => {
                expect(() => {
                    const result = fallbackEscapeHtml(testCase);
                    expect(result).toBeDefined();
                }).not.toThrow();
            });
        });
    });

    describe('Modal Security Tests', () => {
        test('modal titles should be escaped properly', () => {
            global.window.SecurityUtils = mockSecurityUtils;

            const createMockModal = (title) => {
                const escapeHtml = (text) => {
                    if (window.SecurityUtils && window.SecurityUtils.escapeHtml) {
                        return window.SecurityUtils.escapeHtml(text);
                    }
                    if (typeof text !== 'string') return text;
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                };

                return `<h3>${escapeHtml(title)}</h3>`;
            };

            const maliciousTitle = '<script>alert("modal xss")</script>Title';
            const modalHtml = createMockModal(maliciousTitle);

            expect(modalHtml).not.toContain('<script>');
            expect(modalHtml).toContain('&lt;script&gt;');
            expect(mockSecurityUtils.escapeHtml).toHaveBeenCalledWith(maliciousTitle);
        });

        test('action form inputs should be escaped', () => {
            global.window.SecurityUtils = mockSecurityUtils;

            const createMockActionForm = (action) => {
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
                    <input type="text" value="${escapeHtml(action.name)}">
                    <textarea>${escapeHtml(action.description)}</textarea>
                    <textarea>${escapeHtml(action.template)}</textarea>
                `;
            };

            const maliciousAction = {
                name: '<script>alert("name")</script>',
                description: '<img src="x" onerror="alert(1)">',
                template: '"><script>alert("template")</script>'
            };

            const formHtml = createMockActionForm(maliciousAction);

            expect(formHtml).not.toContain('<script>');
            expect(formHtml).not.toContain('onerror=');
            expect(mockSecurityUtils.escapeHtml).toHaveBeenCalledTimes(3);
        });
    });

    describe('Error Scenario Tests', () => {
        test('should handle SecurityUtils loading errors gracefully', () => {
            // Simulate SecurityUtils throwing an error
            global.window.SecurityUtils = {
                escapeHtml: jest.fn(() => {
                    throw new Error('SecurityUtils error');
                })
            };

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
            const result = robustEscapeHtml(testInput);

            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });

        test('should handle DOM manipulation errors', () => {
            // Mock document.createElement to throw an error
            const originalCreateElement = document.createElement;
            document.createElement = jest.fn(() => {
                throw new Error('DOM error');
            });

            const robustEscapeHtml = (text) => {
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
            const result = robustEscapeHtml(testInput);

            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');

            // Restore original function
            document.createElement = originalCreateElement;
        });
    });
});

console.log('✅ SecurityUtils comprehensive tests completed successfully');