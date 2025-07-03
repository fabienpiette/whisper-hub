/**
 * Custom Assertion Helpers
 * Provides domain-specific assertions for Whisper Hub tests
 */

class AssertionHelpers {
    static expectSecureHTML(output, originalInput) {
        // Verify XSS prevention
        const dangerousPatterns = [
            /<script(?:\s[^>]*)?>/i,
            /javascript:/i,
            /onerror\s*=/i,
            /onload\s*=/i,
            /onclick\s*=/i,
            /<iframe/i,
            /eval\s*\(/i,
            /expression\s*\(/i
        ];

        dangerousPatterns.forEach(pattern => {
            expect(output).not.toMatch(pattern);
        });

        // Verify proper escaping
        if (originalInput && originalInput.includes('<')) {
            expect(output).toMatch(/&lt;/);
        }
        if (originalInput && originalInput.includes('>')) {
            expect(output).toMatch(/&gt;/);
        }
        if (originalInput && originalInput.includes('"')) {
            expect(output).toMatch(/&quot;/);
        }

        // Ensure content isn't completely removed (unless empty input)
        if (originalInput && originalInput.trim().length > 0) {
            expect(output.length).toBeGreaterThan(0);
        }
    }

    static expectValidModal(modalElement) {
        expect(modalElement).toBeTruthy();
        expect(modalElement.classList.contains('modal-overlay')).toBe(true);
        
        const content = modalElement.querySelector('.modal-content');
        expect(content).toBeTruthy();
        
        const closeButton = modalElement.querySelector('.modal-close');
        expect(closeButton).toBeTruthy();
    }

    static expectSecureModalContent(modalHTML, testData) {
        // Check modal structure
        expect(modalHTML).toContain('modal-overlay');
        expect(modalHTML).toContain('modal-content');
        
        // Verify no dangerous scripts
        this.expectSecureHTML(modalHTML, testData.name);
        this.expectSecureHTML(modalHTML, testData.description);
        
        // Check that safe content is present
        if (testData.name && !testData.name.includes('<script>')) {
            expect(modalHTML).toContain(testData.name.replace(/<[^>]*>/g, ''));
        }
    }

    static expectValidAction(action) {
        expect(action).toHaveProperty('id');
        expect(action).toHaveProperty('name');
        expect(action).toHaveProperty('type');
        expect(action.id).toBeTruthy();
        expect(action.name).toBeTruthy();
        expect(['template', 'openai']).toContain(action.type);
        
        if (action.type === 'template') {
            expect(action).toHaveProperty('template');
        } else if (action.type === 'openai') {
            expect(action).toHaveProperty('prompt');
            expect(action).toHaveProperty('model');
        }
    }

    static expectValidActionResult(result) {
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('actionName');
        expect(result).toHaveProperty('processedAt');
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.actionName).toBe('string');
        expect(result.actionName.length).toBeGreaterThan(0);
        
        if (result.success) {
            expect(result).toHaveProperty('output');
            expect(typeof result.output).toBe('string');
        } else {
            expect(result).toHaveProperty('error');
            expect(typeof result.error).toBe('string');
        }
    }

    static expectValidHistoryEntry(entry) {
        expect(entry).toHaveProperty('id');
        expect(entry).toHaveProperty('timestamp');
        expect(entry).toHaveProperty('filename');
        expect(entry).toHaveProperty('transcript');
        expect(entry.id).toBeTruthy();
        expect(entry.filename).toBeTruthy();
        expect(entry.transcript).toBeTruthy();
        expect(() => new Date(entry.timestamp)).not.toThrow();
    }

    static expectPerformantOperation(operation, maxDurationMs = 100) {
        const startTime = Date.now();
        operation();
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(maxDurationMs);
    }

    static expectAsyncPerformantOperation(asyncOperation, maxDurationMs = 1000) {
        return async () => {
            const startTime = Date.now();
            await asyncOperation();
            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(maxDurationMs);
        };
    }

    static expectNoMemoryLeaks(beforeCount, afterCount, tolerance = 5) {
        const difference = afterCount - beforeCount;
        expect(difference).toBeLessThanOrEqual(tolerance);
    }

    static expectSecureFilename(filename, originalFilename) {
        // Should not contain path traversal
        expect(filename).not.toContain('../');
        expect(filename).not.toContain('..\\');
        
        // Should not contain dangerous characters
        const dangerousChars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*', '\0', '\n', '\r'];
        dangerousChars.forEach(char => {
            expect(filename).not.toContain(char);
        });
        
        // Should not be empty
        expect(filename.length).toBeGreaterThan(0);
        
        // Should retain some recognizable content from original
        if (originalFilename && originalFilename.length > 0) {
            const cleanOriginal = originalFilename.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const cleanResult = filename.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            if (cleanOriginal.length > 0) {
                expect(cleanResult).toContain(cleanOriginal.substring(0, Math.min(5, cleanOriginal.length)));
            }
        }
    }

    static expectValidCSRFToken(token) {
        expect(token).toBeTruthy();
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(10);
        expect(/^[a-f0-9]+$/i.test(token)).toBe(true);
    }

    static expectValidEncryption(encrypted, original) {
        expect(encrypted).toBeTruthy();
        expect(typeof encrypted).toBe('string');
        expect(encrypted).not.toBe(original);
        expect(encrypted.length).toBeGreaterThan(original.length);
    }

    static expectSecureURL(url) {
        expect(url).not.toMatch(/^javascript:/i);
        expect(url).not.toMatch(/^data:/i);
        expect(url).not.toContain('eval(');
        expect(url).not.toContain('<script');
    }

    static expectValidDOM(element) {
        expect(element).toBeTruthy();
        expect(element.nodeType).toBe(1); // Element node
        expect(typeof element.tagName).toBe('string');
    }

    static expectCleanupComplete() {
        // Check for leftover modals
        const modals = document.querySelectorAll('.modal-overlay');
        expect(modals.length).toBeLessThanOrEqual(1);
        
        // Check for leftover event listeners (approximate)
        const elements = document.querySelectorAll('*');
        elements.forEach(el => {
            expect(el.onclick).toBeFalsy();
            expect(el.onerror).toBeFalsy();
            expect(el.onload).toBeFalsy();
        });
    }

    static expectErrorHandling(operation, expectedErrorType = Error) {
        expect(() => operation()).toThrow(expectedErrorType);
    }

    static expectGracefulFailure(operation) {
        expect(() => operation()).not.toThrow();
    }

    static expectRateLimitRespected(rateLimitFn, maxRequests = 5, windowMs = 1000) {
        // Allow requests within limit
        for (let i = 0; i < maxRequests; i++) {
            expect(rateLimitFn()).toBe(true);
        }
        
        // Block requests over limit
        expect(rateLimitFn()).toBe(false);
    }

    static expectAccessibilityCompliant(element) {
        // Basic accessibility checks
        if (element.tagName === 'BUTTON') {
            expect(element.textContent.length > 0 || element.getAttribute('aria-label')).toBeTruthy();
        }
        
        if (element.tagName === 'INPUT') {
            const hasLabel = element.getAttribute('aria-label') || 
                            document.querySelector(`label[for="${element.id}"]`) ||
                            element.closest('label');
            expect(hasLabel).toBeTruthy();
        }
        
        // Color contrast would require more complex checking
        // Focus management would require interaction testing
    }
}

module.exports = AssertionHelpers;