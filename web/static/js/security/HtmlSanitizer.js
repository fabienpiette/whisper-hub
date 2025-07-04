/**
 * HTML Sanitization and Escaping Utilities
 * Focused on preventing XSS attacks through proper HTML escaping
 */

class HtmlSanitizer {
    /**
     * Escape HTML characters to prevent XSS attacks
     * @param {string} text - Text to escape
     * @returns {string} - HTML escaped text
     */
    static escapeHtml(text) {
        if (typeof text !== 'string') return text;
        
        try {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        } catch (error) {
            // Fallback to manual escaping if DOM methods fail
            return this.fallbackEscape(text);
        }
    }

    /**
     * Legacy alias for escapeHtml to maintain backward compatibility
     * @param {string} text - Text to sanitize
     * @returns {string} - HTML escaped text
     */
    static sanitizeHTML(text) {
        return this.escapeHtml(text);
    }

    /**
     * Safely set HTML content of an element with script removal
     * @param {HTMLElement} element - Target element
     * @param {string} html - HTML content to set
     */
    static safeSetHTML(element, html) {
        if (!element || typeof html !== 'string') return;
        
        // Remove script tags and event handlers
        const sanitized = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
            .replace(/javascript:/gi, '');
        
        element.innerHTML = sanitized;
    }

    /**
     * Create a safe DOM element with filtered attributes
     * @param {string} tagName - HTML tag name
     * @param {Object} attributes - Element attributes
     * @param {string} textContent - Text content
     * @returns {HTMLElement} - Created element
     */
    static createElement(tagName, attributes = {}, textContent = '') {
        const element = document.createElement(tagName);
        
        // Filter dangerous attributes
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

    /**
     * Check if an attribute is safe to use
     * @param {string} attributeName - Attribute name to validate
     * @returns {boolean} - True if attribute is safe
     */
    static isValidAttribute(attributeName) {
        const dangerous = [
            'onclick', 'onerror', 'onload', 'onmouseover', 'onfocus', 'onblur',
            'onchange', 'onsubmit', 'onreset', 'onselect', 'onunload',
            'javascript', 'vbscript', 'expression'
        ];
        
        const attrLower = attributeName.toLowerCase();
        return !dangerous.some(danger => attrLower.includes(danger));
    }

    /**
     * Sanitize attribute values
     * @param {string} value - Attribute value to sanitize
     * @returns {string} - Sanitized value
     */
    static sanitizeAttribute(value) {
        if (typeof value !== 'string') return value;
        
        return value
            .replace(/javascript:/gi, '')
            .replace(/vbscript:/gi, '')
            .replace(/expression\s*\(/gi, '')
            .replace(/on\w+\s*=/gi, '');
    }

    /**
     * Fallback HTML escaping when DOM methods aren't available
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
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    /**
     * Strip all HTML tags from text
     * @param {string} html - HTML to strip
     * @returns {string} - Plain text
     */
    static stripTags(html) {
        if (typeof html !== 'string') return html;
        
        try {
            const div = document.createElement('div');
            div.innerHTML = html;
            return div.textContent || div.innerText || '';
        } catch (error) {
            // Fallback regex-based stripping
            return html.replace(/<[^>]*>/g, '');
        }
    }

    /**
     * Validate that content doesn't contain dangerous scripts
     * @param {string} content - Content to validate
     * @returns {boolean} - True if content is safe
     */
    static isContentSafe(content) {
        if (typeof content !== 'string') return true;
        
        const dangerousPatterns = [
            /<script\b/i,
            /javascript:/i,
            /vbscript:/i,
            /on\w+\s*=/i,
            /<iframe\b/i,
            /expression\s*\(/i,
            /eval\s*\(/i
        ];
        
        return !dangerousPatterns.some(pattern => pattern.test(content));
    }

    /**
     * Clean HTML by removing dangerous elements and attributes
     * @param {string} html - HTML to clean
     * @returns {string} - Cleaned HTML
     */
    static cleanHTML(html) {
        if (typeof html !== 'string') return html;
        
        // Remove dangerous tags
        let cleaned = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
            .replace(/<embed\b[^>]*>/gi, '')
            .replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, '');
        
        // Remove dangerous attributes
        cleaned = cleaned.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
        cleaned = cleaned.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, '');
        cleaned = cleaned.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, '');
        
        return cleaned;
    }
}

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HtmlSanitizer;
} else if (typeof window !== 'undefined') {
    window.HtmlSanitizer = HtmlSanitizer;
}