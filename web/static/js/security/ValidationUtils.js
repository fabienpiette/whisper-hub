/**
 * Input Validation and Safety Utilities
 * Focused on validating user input and preventing injection attacks
 */

class ValidationUtils {
    /**
     * Sanitize filename to prevent path traversal and injection attacks
     * @param {string} filename - Original filename
     * @returns {string} - Sanitized filename
     */
    static sanitizeFilename(filename) {
        if (!filename || typeof filename !== 'string') {
            return 'untitled';
        }
        
        // Remove path traversal attempts
        let sanitized = filename.replace(/\.\./g, '');
        
        // Remove or replace dangerous characters
        sanitized = sanitized
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
            .replace(/\s+/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_+|_+$/g, '');
        
        // Handle Windows reserved names
        const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
        const nameWithoutExt = sanitized.split('.')[0].toUpperCase();
        if (reserved.includes(nameWithoutExt)) {
            sanitized = `file_${sanitized}`;
        }
        
        // Ensure minimum length
        if (sanitized.length === 0) {
            sanitized = 'untitled';
        }
        
        // Limit length
        if (sanitized.length > 255) {
            const ext = sanitized.split('.').pop();
            const name = sanitized.substring(0, 255 - ext.length - 1);
            sanitized = `${name}.${ext}`;
        }
        
        return sanitized;
    }

    /**
     * Check if a URL is safe to use
     * @param {string} url - URL to validate
     * @returns {boolean} - True if URL is safe
     */
    static isSafeURL(url) {
        if (!url || typeof url !== 'string') return false;
        
        const urlLower = url.toLowerCase().trim();
        
        // Block dangerous protocols
        const dangerousProtocols = [
            'javascript:',
            'vbscript:',
            'data:',
            'file:',
            'ftp:'
        ];
        
        if (dangerousProtocols.some(protocol => urlLower.startsWith(protocol))) {
            return false;
        }
        
        // Block common XSS patterns
        if (urlLower.includes('eval(') || 
            urlLower.includes('<script') || 
            urlLower.includes('expression(')) {
            return false;
        }
        
        // Allow relative URLs, HTTPS, HTTP, and anchors
        return urlLower.startsWith('/') || 
               urlLower.startsWith('./') || 
               urlLower.startsWith('../') ||
               urlLower.startsWith('#') ||
               urlLower.startsWith('http://') ||
               urlLower.startsWith('https://') ||
               this.isTrustedDomain(url);
    }

    /**
     * Check if a domain is in the trusted list
     * @param {string} url - URL to check
     * @returns {boolean} - True if domain is trusted
     */
    static isTrustedDomain(url) {
        try {
            const urlObj = new URL(url);
            const trustedDomains = [
                'unpkg.com',
                'cdn.jsdelivr.net',
                'cdnjs.cloudflare.com'
            ];
            
            return trustedDomains.some(domain => 
                urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
            );
        } catch (error) {
            return false;
        }
    }

    /**
     * Validate email address format
     * @param {string} email - Email to validate
     * @returns {boolean} - True if email format is valid
     */
    static isValidEmail(email) {
        if (!email || typeof email !== 'string') return false;
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email) && email.length <= 254;
    }

    /**
     * Validate that text doesn't contain SQL injection patterns
     * @param {string} input - Input to validate
     * @returns {boolean} - True if input appears safe
     */
    static isSQLSafe(input) {
        if (!input || typeof input !== 'string') return true;
        
        const sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
            /(--|\/\*|\*\/)/,
            /(\b(OR|AND)\s+\w+\s*=\s*\w+)/i,
            /(\bOR\s+1\s*=\s*1)/i,
            /(\bAND\s+1\s*=\s*1)/i,
            /(;|\|\||&&)/
        ];
        
        return !sqlPatterns.some(pattern => pattern.test(input));
    }

    /**
     * Validate input length within acceptable bounds
     * @param {string} input - Input to validate
     * @param {number} minLength - Minimum length
     * @param {number} maxLength - Maximum length
     * @returns {boolean} - True if length is valid
     */
    static isValidLength(input, minLength = 0, maxLength = 10000) {
        if (typeof input !== 'string') return false;
        return input.length >= minLength && input.length <= maxLength;
    }

    /**
     * Sanitize input by removing potentially dangerous characters
     * @param {string} input - Input to sanitize
     * @returns {string} - Sanitized input
     */
    static sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Control characters
            .replace(/[\uFEFF\uFFFE\uFFFF]/g, '') // Unicode BOM and non-characters
            .trim();
    }

    /**
     * Validate that content doesn't exceed safe complexity
     * @param {string} content - Content to validate
     * @returns {boolean} - True if complexity is acceptable
     */
    static isComplexitySafe(content) {
        if (!content || typeof content !== 'string') return true;
        
        // Check for excessive nesting
        const openTags = (content.match(/</g) || []).length;
        const closeTags = (content.match(/>/g) || []).length;
        if (Math.abs(openTags - closeTags) > 10) return false;
        
        // Check for excessive repetition
        const repeatedPatterns = content.match(/(.{3,})\1{5,}/g);
        if (repeatedPatterns && repeatedPatterns.length > 0) return false;
        
        // Check overall length
        if (content.length > 1000000) return false; // 1MB limit
        
        return true;
    }

    /**
     * Validate file extension against allowed list
     * @param {string} filename - Filename to check
     * @param {Array<string>} allowedExtensions - Allowed extensions
     * @returns {boolean} - True if extension is allowed
     */
    static isAllowedFileExtension(filename, allowedExtensions = []) {
        if (!filename || typeof filename !== 'string') return false;
        if (!Array.isArray(allowedExtensions) || allowedExtensions.length === 0) return true;
        
        const extension = filename.split('.').pop()?.toLowerCase();
        return allowedExtensions.includes(extension);
    }

    /**
     * Validate that input doesn't contain template injection patterns
     * @param {string} input - Input to validate
     * @returns {boolean} - True if input appears safe
     */
    static isTemplateInjectionSafe(input) {
        if (!input || typeof input !== 'string') return true;
        
        const injectionPatterns = [
            /\{\{.*?\}\}/,  // Handlebars/Mustache
            /\$\{.*?\}/,    // Template literals
            /<\%.*?\%>/,    // ERB/ASP
            /\{\%.*?\%\}/,  // Jinja2/Django
            /\{\#.*?\#\}/   // Handlebars comments
        ];
        
        return !injectionPatterns.some(pattern => pattern.test(input));
    }

    /**
     * Normalize whitespace in input
     * @param {string} input - Input to normalize
     * @returns {string} - Normalized input
     */
    static normalizeWhitespace(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .replace(/\s+/g, ' ')  // Multiple whitespace to single space
            .replace(/\n\s*\n/g, '\n') // Multiple newlines to single
            .trim();
    }

    /**
     * Validate JSON string safety
     * @param {string} jsonString - JSON string to validate
     * @returns {boolean} - True if JSON is safe to parse
     */
    static isJSONSafe(jsonString) {
        if (!jsonString || typeof jsonString !== 'string') return false;
        
        try {
            // Check for potential prototype pollution
            if (jsonString.includes('__proto__') || 
                jsonString.includes('constructor') ||
                jsonString.includes('prototype')) {
                return false;
            }
            
            const parsed = JSON.parse(jsonString);
            
            // Validate parsed object
            if (parsed && typeof parsed === 'object') {
                return this.isObjectSafe(parsed);
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Validate that an object doesn't contain dangerous properties
     * @param {Object} obj - Object to validate
     * @returns {boolean} - True if object is safe
     */
    static isObjectSafe(obj) {
        if (!obj || typeof obj !== 'object') return true;
        
        const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
        
        for (const key in obj) {
            if (dangerousKeys.includes(key)) return false;
            
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                if (!this.isObjectSafe(obj[key])) return false;
            }
        }
        
        return true;
    }
}

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValidationUtils;
} else if (typeof window !== 'undefined') {
    window.ValidationUtils = ValidationUtils;
}