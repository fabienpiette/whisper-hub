/**
 * Security Utilities for Whisper Hub
 * XSS Prevention and Input Sanitization
 */

class SecurityUtils {
    /**
     * Sanitize HTML content to prevent XSS attacks
     * @param {string} html - Raw HTML string
     * @returns {string} - Sanitized HTML
     */
    static sanitizeHTML(html) {
        if (typeof html !== 'string') return '';
        
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }
    
    /**
     * Safely set innerHTML with XSS protection
     * @param {Element} element - Target element
     * @param {string} content - Content to set
     */
    static safeSetHTML(element, content) {
        if (!element) return;
        element.innerHTML = this.sanitizeHTML(content);
    }
    
    /**
     * Create safe DOM elements from template
     * @param {string} tag - HTML tag name
     * @param {Object} attributes - Element attributes
     * @param {string} textContent - Safe text content
     * @returns {Element} - Safe DOM element
     */
    static createElement(tag, attributes = {}, textContent = '') {
        const element = document.createElement(tag);
        
        // Set attributes safely
        for (const [key, value] of Object.entries(attributes)) {
            if (this.isValidAttribute(key)) {
                element.setAttribute(key, this.sanitizeAttribute(value));
            }
        }
        
        // Set text content safely
        if (textContent) {
            element.textContent = textContent;
        }
        
        return element;
    }
    
    /**
     * Validate attribute names against allowlist
     * @param {string} name - Attribute name
     * @returns {boolean} - Is valid attribute
     */
    static isValidAttribute(name) {
        const allowedAttributes = [
            'id', 'class', 'data-id', 'data-action', 'data-format',
            'title', 'aria-label', 'role', 'tabindex',
            'type', 'placeholder', 'value', 'name',
            'href', 'download', 'target', 'rel'
        ];
        return allowedAttributes.includes(name);
    }
    
    /**
     * Sanitize attribute values
     * @param {string} value - Attribute value
     * @returns {string} - Sanitized value
     */
    static sanitizeAttribute(value) {
        if (typeof value !== 'string') return String(value);
        
        // Remove potential XSS vectors
        return value
            .replace(/[<>'"]/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .trim();
    }
    
    /**
     * Sanitize filename for safe download
     * @param {string} filename - Original filename
     * @returns {string} - Safe filename
     */
    static sanitizeFilename(filename) {
        if (typeof filename !== 'string') return 'download.txt';
        
        return filename
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Remove dangerous chars
            .replace(/^\.+/, '') // Remove leading dots
            .replace(/\.{2,}/g, '.') // Replace multiple dots
            .slice(0, 255) // Limit length
            .trim() || 'download.txt'; // Fallback name
    }
    
    /**
     * Generate secure random token for CSRF protection
     * @returns {string} - Random token
     */
    static generateCSRFToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    
    /**
     * Validate CSRF token
     * @param {string} token - Token to validate
     * @param {string} expected - Expected token
     * @returns {boolean} - Is valid token
     */
    static validateCSRFToken(token, expected) {
        if (!token || !expected || token.length !== expected.length) {
            return false;
        }
        
        // Constant-time comparison to prevent timing attacks
        let result = 0;
        for (let i = 0; i < token.length; i++) {
            result |= token.charCodeAt(i) ^ expected.charCodeAt(i);
        }
        return result === 0;
    }
    
    /**
     * Validate URL to prevent open redirects
     * @param {string} url - URL to validate
     * @returns {boolean} - Is safe URL
     */
    static isSafeURL(url) {
        if (!url) return false;
        
        try {
            const parsed = new URL(url, window.location.origin);
            
            // Only allow same-origin or explicitly allowed domains
            const allowedDomains = ['unpkg.com'];
            
            return parsed.origin === window.location.origin ||
                   allowedDomains.includes(parsed.hostname);
        } catch {
            return false;
        }
    }
    
    /**
     * Encrypt data for localStorage storage
     * @param {string} data - Data to encrypt
     * @param {string} key - Encryption key
     * @returns {string} - Encrypted data
     */
    static async encryptData(data, key) {
        try {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);
            const keyBuffer = encoder.encode(key);
            
            // Import key for AES-GCM
            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                await crypto.subtle.digest('SHA-256', keyBuffer),
                { name: 'AES-GCM' },
                false,
                ['encrypt']
            );
            
            // Generate random IV
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            // Encrypt data
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                cryptoKey,
                dataBuffer
            );
            
            // Combine IV and encrypted data
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);
            
            // Return base64 encoded result
            return btoa(String.fromCharCode(...combined));
        } catch (error) {
            console.error('Encryption failed:', error);
            return data; // Fallback to unencrypted
        }
    }
    
    /**
     * Decrypt data from localStorage
     * @param {string} encryptedData - Encrypted data
     * @param {string} key - Decryption key
     * @returns {string} - Decrypted data
     */
    static async decryptData(encryptedData, key) {
        try {
            const encoder = new TextEncoder();
            const keyBuffer = encoder.encode(key);
            
            // Decode base64
            const combined = new Uint8Array(
                atob(encryptedData)
                    .split('')
                    .map(char => char.charCodeAt(0))
            );
            
            // Extract IV and encrypted data
            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);
            
            // Import key for AES-GCM
            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                await crypto.subtle.digest('SHA-256', keyBuffer),
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );
            
            // Decrypt data
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                cryptoKey,
                encrypted
            );
            
            // Return decoded string
            return new TextDecoder().decode(decrypted);
        } catch (error) {
            console.error('Decryption failed:', error);
            return encryptedData; // Fallback to assuming unencrypted
        }
    }
    
    /**
     * Rate limiting utility
     * @param {string} key - Rate limit key
     * @param {number} maxRequests - Max requests per window
     * @param {number} windowMs - Time window in milliseconds
     * @returns {boolean} - Is request allowed
     */
    static checkRateLimit(key, maxRequests = 10, windowMs = 60000) {
        const now = Date.now();
        const rateLimitKey = `rate_limit_${key}`;
        
        let requests = JSON.parse(localStorage.getItem(rateLimitKey) || '[]');
        
        // Remove old requests outside window
        requests = requests.filter(timestamp => now - timestamp < windowMs);
        
        // Check if limit exceeded
        if (requests.length >= maxRequests) {
            return false;
        }
        
        // Add current request
        requests.push(now);
        localStorage.setItem(rateLimitKey, JSON.stringify(requests));
        
        return true;
    }
}

// Make SecurityUtils globally available
window.SecurityUtils = SecurityUtils;