/**
 * SecurityUtils Mocking Utilities
 * Provides consistent SecurityUtils mocking patterns across tests
 */

const fs = require('fs');
const path = require('path');

class SecurityMocks {
    static loadSecurityUtils() {
        const securityJs = fs.readFileSync(
            path.join(__dirname, '../../web/static/js/security.js'), 
            'utf8'
        );
        eval(securityJs);
        return window.SecurityUtils;
    }

    static createMockSecurityUtils() {
        return {
            escapeHtml: jest.fn((text) => {
                if (typeof text !== 'string') return text;
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }),
            sanitizeHTML: jest.fn((text) => {
                if (typeof text !== 'string') return text;
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }),
            generateCSRFToken: jest.fn(() => 'mock-csrf-token-' + Date.now()),
            validateCSRFToken: jest.fn((token1, token2) => token1 === token2),
            sanitizeFilename: jest.fn((filename) => {
                if (!filename) return 'untitled';
                return String(filename)
                    .replace(/[<>:"/\\|?*]/g, '_')
                    .replace(/\s+/g, '_')
                    .toLowerCase();
            }),
            isSafeURL: jest.fn((url) => {
                return !url.startsWith('javascript:') && 
                       !url.startsWith('data:') && 
                       !url.includes('eval(');
            }),
            isValidAttribute: jest.fn((attr) => {
                const dangerous = ['onclick', 'onerror', 'onload', 'javascript', 'vbscript'];
                return !dangerous.some(d => attr.toLowerCase().includes(d));
            }),
            sanitizeAttribute: jest.fn((value) => {
                return String(value)
                    .replace(/javascript:/gi, '')
                    .replace(/onclick/gi, '')
                    .replace(/<script/gi, '&lt;script');
            }),
            checkRateLimit: jest.fn(() => true),
            encryptData: jest.fn(async (data) => `encrypted_${data}`),
            decryptData: jest.fn(async (data) => data.replace('encrypted_', '')),
            safeSetHTML: jest.fn((element, html) => {
                if (element) {
                    element.innerHTML = html.replace(/<script.*?<\/script>/gi, '');
                }
            }),
            createElement: jest.fn((tag, attrs = {}, content = '') => {
                const element = document.createElement(tag);
                Object.entries(attrs).forEach(([key, value]) => {
                    if (SecurityMocks.isValidAttribute(key)) {
                        element.setAttribute(key, value);
                    }
                });
                if (content) element.textContent = content;
                return element;
            })
        };
    }

    static createFailingSecurityUtils() {
        return {
            escapeHtml: jest.fn(() => {
                throw new Error('Mock SecurityUtils failure');
            }),
            sanitizeHTML: jest.fn(() => {
                throw new Error('Mock SecurityUtils failure');
            }),
            generateCSRFToken: jest.fn(() => {
                throw new Error('Mock SecurityUtils failure');
            })
        };
    }

    static setupSecurityUtilsGlobal(mockUtils = null) {
        if (mockUtils) {
            global.window.SecurityUtils = mockUtils;
        } else {
            global.window.SecurityUtils = this.loadSecurityUtils();
        }
        return global.window.SecurityUtils;
    }

    static removeSecurityUtils() {
        delete global.window.SecurityUtils;
    }

    static createFallbackEscapeHtml() {
        return (text) => {
            if (window.SecurityUtils && window.SecurityUtils.escapeHtml) {
                return window.SecurityUtils.escapeHtml(text);
            }
            if (typeof text !== 'string') return text;
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
    }

    static createRobustEscapeHtml() {
        return (text) => {
            try {
                if (window.SecurityUtils && window.SecurityUtils.escapeHtml) {
                    return window.SecurityUtils.escapeHtml(text);
                }
            } catch (error) {
                console.warn('SecurityUtils failed, using fallback:', error.message);
            }
            
            // Fallback implementation
            try {
                if (typeof text !== 'string') return text;
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            } catch (domError) {
                // Ultimate fallback: basic string replacement
                return String(text)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;');
            }
        };
    }

    static validateXSSPrevention(output, originalInput) {
        const dangerousPatterns = [
            /<script/i,
            /javascript:/i,
            /onerror=/i,
            /onload=/i,
            /onclick=/i,
            /<iframe/i
        ];

        // Check that dangerous patterns are not present in unescaped form
        const hasUnescapedDangerous = dangerousPatterns.some(pattern => 
            pattern.test(output) && !output.includes('&lt;')
        );

        expect(hasUnescapedDangerous).toBe(false);

        // Verify that content is still readable (not completely removed)
        if (originalInput.length > 0) {
            expect(output.length).toBeGreaterThan(0);
        }

        // Check for proper escaping of angle brackets
        if (originalInput.includes('<') || originalInput.includes('>')) {
            expect(output).toMatch(/(&lt;|&gt;)/);
        }
    }

    static createMaliciousTestCases() {
        return [
            {
                name: 'Basic XSS Script',
                input: '<script>alert("xss")</script>',
                shouldNotContain: ['<script>', 'alert('],
                shouldContain: ['&lt;script&gt;']
            },
            {
                name: 'Image with onerror',
                input: '<img src="x" onerror="alert(1)">',
                shouldNotContain: ['<img', 'onerror='],
                shouldContain: ['&lt;img']
            },
            {
                name: 'JavaScript URL',
                input: '<a href="javascript:alert(1)">Click</a>',
                shouldNotContain: ['javascript:'],
                shouldContain: ['&lt;a']
            },
            {
                name: 'Event handler injection',
                input: '"><script>alert(1)</script>',
                shouldNotContain: ['"><script>'],
                shouldContain: ['&quot;&gt;&lt;script&gt;']
            },
            {
                name: 'SVG with onload',
                input: '<svg onload="alert(1)">',
                shouldNotContain: ['<svg', 'onload='],
                shouldContain: ['&lt;svg']
            }
        ];
    }

    static createEdgeTestCases() {
        return [
            { input: null, description: 'null value' },
            { input: undefined, description: 'undefined value' },
            { input: '', description: 'empty string' },
            { input: 0, description: 'number zero' },
            { input: false, description: 'boolean false' },
            { input: [], description: 'empty array' },
            { input: {}, description: 'empty object' },
            { input: 'normal text', description: 'plain text' },
            { input: '   whitespace   ', description: 'text with whitespace' },
            { input: 'unicode: 🚀 emoji', description: 'unicode content' },
            { input: 'x'.repeat(10000), description: 'very long string' }
        ];
    }
}

module.exports = SecurityMocks;