/**
 * SecurityUtils - Unified Security Facade
 * Provides backward compatibility while delegating to specialized modules
 */

// Import specialized modules (if available)
let HtmlSanitizer, ValidationUtils, CsrfProtection, RateLimiter, CryptoUtils;

// Try to load modules (graceful fallback if not available)
try {
    if (typeof window !== 'undefined' && window.HtmlSanitizer) {
        HtmlSanitizer = window.HtmlSanitizer;
        ValidationUtils = window.ValidationUtils;
        CsrfProtection = window.CsrfProtection;
        RateLimiter = window.RateLimiter;
        CryptoUtils = window.CryptoUtils;
    }
} catch (error) {
    console.warn('Some security modules not available, using fallbacks');
}

class SecurityUtils {
    // ===== HTML Sanitization Methods =====
    
    /**
     * Escape HTML characters to prevent XSS attacks
     * @param {string} text - Text to escape
     * @returns {string} - HTML escaped text
     */
    static escapeHtml(text) {
        if (HtmlSanitizer) {
            return HtmlSanitizer.escapeHtml(text);
        }
        
        // Fallback implementation
        if (typeof text !== 'string') return text;
        
        try {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        } catch (error) {
            return this.fallbackEscape(text);
        }
    }

    /**
     * Legacy alias for escapeHtml
     * @param {string} text - Text to sanitize
     * @returns {string} - HTML escaped text
     */
    static sanitizeHTML(text) {
        return this.escapeHtml(text);
    }

    /**
     * Safely set HTML content of an element
     * @param {HTMLElement} element - Target element
     * @param {string} html - HTML content to set
     */
    static safeSetHTML(element, html) {
        if (HtmlSanitizer) {
            return HtmlSanitizer.safeSetHTML(element, html);
        }
        
        // Fallback implementation
        if (!element || typeof html !== 'string') return;
        
        const sanitized = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
        
        element.innerHTML = sanitized;
    }

    /**
     * Create a safe DOM element
     * @param {string} tagName - HTML tag name
     * @param {Object} attributes - Element attributes
     * @param {string} textContent - Text content
     * @returns {HTMLElement} - Created element
     */
    static createElement(tagName, attributes = {}, textContent = '') {
        if (HtmlSanitizer) {
            return HtmlSanitizer.createElement(tagName, attributes, textContent);
        }
        
        // Fallback implementation
        const element = document.createElement(tagName);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (this.isValidAttribute(key)) {
                element.setAttribute(key, this.sanitizeAttribute(value));
            }
        });
        
        if (textContent) {
            element.textContent = textContent;
        }
        
        return element;
    }

    // ===== Validation Methods =====

    /**
     * Check if an attribute is safe to use
     * @param {string} attributeName - Attribute name to validate
     * @returns {boolean} - True if attribute is safe
     */
    static isValidAttribute(attributeName) {
        if (ValidationUtils) {
            return ValidationUtils.isValidAttribute ? ValidationUtils.isValidAttribute(attributeName) : true;
        }
        
        // Fallback implementation
        const dangerous = ['onclick', 'onerror', 'onload', 'javascript', 'vbscript'];
        const attrLower = attributeName.toLowerCase();
        return !dangerous.some(danger => attrLower.includes(danger));
    }

    /**
     * Sanitize attribute values
     * @param {string} value - Attribute value to sanitize
     * @returns {string} - Sanitized value
     */
    static sanitizeAttribute(value) {
        if (ValidationUtils) {
            return ValidationUtils.sanitizeAttribute ? ValidationUtils.sanitizeAttribute(value) : value;
        }
        
        // Fallback implementation
        if (typeof value !== 'string') return value;
        
        return value
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
    }

    /**
     * Sanitize filename to prevent path traversal
     * @param {string} filename - Original filename
     * @returns {string} - Sanitized filename
     */
    static sanitizeFilename(filename) {
        if (ValidationUtils) {
            return ValidationUtils.sanitizeFilename(filename);
        }
        
        // Fallback implementation
        if (!filename || typeof filename !== 'string') {
            return 'untitled';
        }
        
        return filename
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\.\./g, '')
            .replace(/\s+/g, '_')
            .toLowerCase();
    }

    /**
     * Check if a URL is safe to use
     * @param {string} url - URL to validate
     * @returns {boolean} - True if URL is safe
     */
    static isSafeURL(url) {
        if (ValidationUtils) {
            return ValidationUtils.isSafeURL(url);
        }
        
        // Fallback implementation
        if (!url || typeof url !== 'string') return false;
        
        const urlLower = url.toLowerCase();
        const dangerousProtocols = ['javascript:', 'data:', 'vbscript:'];
        
        return !dangerousProtocols.some(protocol => urlLower.startsWith(protocol));
    }

    // ===== CSRF Protection Methods =====

    /**
     * Generate a CSRF token
     * @returns {string} - Generated CSRF token
     */
    static generateCSRFToken() {
        if (CsrfProtection) {
            return CsrfProtection.generateCSRFToken();
        }
        
        // Fallback implementation
        try {
            const array = new Uint8Array(32);
            window.crypto.getRandomValues(array);
            return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            // Ultimate fallback
            return Math.random().toString(36).substring(2) + Date.now().toString(36);
        }
    }

    /**
     * Validate CSRF token
     * @param {string} token - Token to validate
     * @param {string} expectedToken - Expected token value
     * @returns {boolean} - True if tokens match
     */
    static validateCSRFToken(token, expectedToken) {
        if (CsrfProtection) {
            return CsrfProtection.validateCSRFToken(token, expectedToken);
        }
        
        // Fallback implementation
        if (!token || !expectedToken || 
            typeof token !== 'string' || 
            typeof expectedToken !== 'string') {
            return false;
        }
        
        return token === expectedToken;
    }

    // ===== Rate Limiting Methods =====

    /**
     * Check if operation is within rate limit
     * @param {string} key - Unique key for the operation
     * @param {number} maxRequests - Maximum requests allowed
     * @param {number} windowMs - Time window in milliseconds
     * @returns {boolean} - True if within rate limit
     */
    static checkRateLimit(key, maxRequests = 100, windowMs = 60000) {
        if (RateLimiter) {
            return RateLimiter.checkRateLimit(key, maxRequests, windowMs);
        }
        
        // Fallback implementation (simplified)
        try {
            const storageKey = `rate_limit_${key}`;
            const now = Date.now();
            const existingData = localStorage.getItem(storageKey);
            
            if (!existingData) {
                localStorage.setItem(storageKey, JSON.stringify({ count: 1, window: now }));
                return true;
            }
            
            const data = JSON.parse(existingData);
            
            if (now - data.window > windowMs) {
                localStorage.setItem(storageKey, JSON.stringify({ count: 1, window: now }));
                return true;
            }
            
            if (data.count >= maxRequests) {
                return false;
            }
            
            data.count++;
            localStorage.setItem(storageKey, JSON.stringify(data));
            return true;
        } catch (error) {
            return true; // Fail open
        }
    }

    // ===== Encryption Methods =====

    /**
     * Encrypt data
     * @param {string} data - Data to encrypt
     * @param {string} key - Encryption key
     * @returns {Promise<string>} - Encrypted data
     */
    static async encryptData(data, key) {
        if (CryptoUtils) {
            return CryptoUtils.encryptData(data, key);
        }
        
        // Fallback implementation (not secure, for functionality only)
        try {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);
            const keyBuffer = await this.deriveSimpleKey(key);
            
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            
            const encrypted = await window.crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                keyBuffer,
                dataBuffer
            );
            
            const result = new Uint8Array(iv.length + encrypted.byteLength);
            result.set(iv);
            result.set(new Uint8Array(encrypted), iv.length);
            
            return btoa(String.fromCharCode.apply(null, result));
        } catch (error) {
            console.error('Encryption failed:', error);
            return data; // Return original data as fallback
        }
    }

    /**
     * Decrypt data
     * @param {string} encryptedData - Encrypted data to decrypt
     * @param {string} key - Decryption key
     * @returns {Promise<string>} - Decrypted data
     */
    static async decryptData(encryptedData, key) {
        if (CryptoUtils) {
            return CryptoUtils.decryptData(encryptedData, key);
        }
        
        // Fallback implementation
        try {
            const combinedData = new Uint8Array(
                atob(encryptedData).split('').map(char => char.charCodeAt(0))
            );
            
            const iv = combinedData.slice(0, 12);
            const encrypted = combinedData.slice(12);
            const keyBuffer = await this.deriveSimpleKey(key);
            
            const decrypted = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                keyBuffer,
                encrypted
            );
            
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            console.error('Decryption failed:', error);
            return encryptedData; // Return original data as fallback
        }
    }

    // ===== Helper Methods =====

    /**
     * Fallback HTML escaping
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    static fallbackEscape(text) {
        if (typeof text !== 'string') return text;
        
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    /**
     * Derive simple encryption key
     * @param {string} keyString - Key string
     * @returns {Promise<CryptoKey>} - Derived key
     */
    static async deriveSimpleKey(keyString) {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(keyString);
        const salt = encoder.encode('whisper-hub-salt');
        
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        
        return await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 10000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Check if all security modules are loaded
     * @returns {Object} - Module availability status
     */
    static getModuleStatus() {
        return {
            HtmlSanitizer: !!HtmlSanitizer,
            ValidationUtils: !!ValidationUtils,
            CsrfProtection: !!CsrfProtection,
            RateLimiter: !!RateLimiter,
            CryptoUtils: !!CryptoUtils,
            allLoaded: !!(HtmlSanitizer && ValidationUtils && CsrfProtection && RateLimiter && CryptoUtils)
        };
    }
}

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityUtils;
} else if (typeof window !== 'undefined') {
    window.SecurityUtils = SecurityUtils;
}