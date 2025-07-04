/**
 * CSRF Protection Utilities
 * Focused on generating and validating CSRF tokens
 */

class CsrfProtection {
    /**
     * Generate a cryptographically secure CSRF token
     * @returns {string} - Generated CSRF token
     */
    static generateCSRFToken() {
        try {
            // Use crypto.getRandomValues if available
            if (window.crypto && window.crypto.getRandomValues) {
                const array = new Uint8Array(32);
                window.crypto.getRandomValues(array);
                return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
            }
            
            // Fallback to Math.random (less secure)
            return this.fallbackTokenGeneration();
        } catch (error) {
            console.warn('CSRF token generation failed, using fallback:', error.message);
            return this.fallbackTokenGeneration();
        }
    }

    /**
     * Validate CSRF token against expected value
     * @param {string} token - Token to validate
     * @param {string} expectedToken - Expected token value
     * @returns {boolean} - True if tokens match
     */
    static validateCSRFToken(token, expectedToken) {
        // Basic validation
        if (!token || !expectedToken || 
            typeof token !== 'string' || 
            typeof expectedToken !== 'string') {
            return false;
        }
        
        // Prevent timing attacks by checking length first
        if (token.length !== expectedToken.length) {
            return false;
        }
        
        // Constant-time comparison to prevent timing attacks
        return this.constantTimeCompare(token, expectedToken);
    }

    /**
     * Get or create CSRF token for current session
     * @returns {string} - Session CSRF token
     */
    static getSessionToken() {
        const tokenKey = 'whisper_csrf_token';
        let token = localStorage.getItem(tokenKey);
        
        if (!token || !this.isValidTokenFormat(token)) {
            token = this.generateCSRFToken();
            localStorage.setItem(tokenKey, token);
        }
        
        return token;
    }

    /**
     * Clear current session CSRF token
     */
    static clearSessionToken() {
        localStorage.removeItem('whisper_csrf_token');
    }

    /**
     * Add CSRF token to form data
     * @param {FormData|Object} formData - Form data to enhance
     * @returns {FormData|Object} - Enhanced form data
     */
    static addTokenToFormData(formData) {
        const token = this.getSessionToken();
        
        if (formData instanceof FormData) {
            formData.append('csrf_token', token);
        } else if (typeof formData === 'object') {
            formData.csrf_token = token;
        }
        
        return formData;
    }

    /**
     * Add CSRF token to request headers
     * @param {Object} headers - Request headers
     * @returns {Object} - Enhanced headers
     */
    static addTokenToHeaders(headers = {}) {
        headers['X-CSRF-Token'] = this.getSessionToken();
        return headers;
    }

    /**
     * Create CSRF-protected fetch wrapper
     * @param {string} url - Request URL
     * @param {Object} options - Fetch options
     * @returns {Promise} - Fetch promise
     */
    static protectedFetch(url, options = {}) {
        // Add CSRF token to headers
        options.headers = this.addTokenToHeaders(options.headers);
        
        // If body is FormData, add token
        if (options.body instanceof FormData) {
            this.addTokenToFormData(options.body);
        }
        
        return fetch(url, options);
    }

    /**
     * Validate token format
     * @param {string} token - Token to validate
     * @returns {boolean} - True if format is valid
     */
    static isValidTokenFormat(token) {
        if (!token || typeof token !== 'string') return false;
        
        // Check length (should be 64 hex characters for 32 bytes)
        if (token.length !== 64) return false;
        
        // Check format (hex only)
        return /^[a-f0-9]+$/i.test(token);
    }

    /**
     * Fallback token generation using Math.random
     * @returns {string} - Generated token
     */
    static fallbackTokenGeneration() {
        let token = '';
        const chars = '0123456789abcdef';
        
        for (let i = 0; i < 64; i++) {
            token += chars[Math.floor(Math.random() * 16)];
        }
        
        return token;
    }

    /**
     * Constant-time string comparison to prevent timing attacks
     * @param {string} a - First string
     * @param {string} b - Second string
     * @returns {boolean} - True if strings match
     */
    static constantTimeCompare(a, b) {
        if (a.length !== b.length) return false;
        
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        
        return result === 0;
    }

    /**
     * Generate token with expiration
     * @param {number} expirationMs - Expiration time in milliseconds
     * @returns {Object} - Token object with expiration
     */
    static generateExpiringToken(expirationMs = 3600000) { // 1 hour default
        const token = this.generateCSRFToken();
        const expires = Date.now() + expirationMs;
        
        return {
            token,
            expires,
            isValid: () => Date.now() < expires
        };
    }

    /**
     * Validate token with expiration check
     * @param {Object} tokenObj - Token object with expiration
     * @param {string} expectedToken - Expected token value
     * @returns {boolean} - True if token is valid and not expired
     */
    static validateExpiringToken(tokenObj, expectedToken) {
        if (!tokenObj || !tokenObj.isValid()) return false;
        return this.validateCSRFToken(tokenObj.token, expectedToken);
    }

    /**
     * Rotate session token (generate new one)
     * @returns {string} - New session token
     */
    static rotateSessionToken() {
        this.clearSessionToken();
        return this.getSessionToken();
    }

    /**
     * Check if CSRF protection is needed for HTTP method
     * @param {string} method - HTTP method
     * @returns {boolean} - True if CSRF protection is needed
     */
    static requiresCSRFProtection(method) {
        const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
        return !safeMethods.includes(method.toUpperCase());
    }

    /**
     * Create CSRF meta tag for page head
     * @returns {HTMLMetaElement} - Meta tag element
     */
    static createMetaTag() {
        const meta = document.createElement('meta');
        meta.name = 'csrf-token';
        meta.content = this.getSessionToken();
        return meta;
    }

    /**
     * Get CSRF token from meta tag
     * @returns {string|null} - Token from meta tag or null
     */
    static getTokenFromMeta() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : null;
    }
}

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CsrfProtection;
} else if (typeof window !== 'undefined') {
    window.CsrfProtection = CsrfProtection;
}