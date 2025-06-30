/**
 * Security Test Suite for Whisper Hub
 * Validates XSS prevention, CSRF protection, and data security
 */

describe('Security Tests', () => {
    let securityUtils;
    
    beforeEach(() => {
        // Load SecurityUtils in test environment
        securityUtils = window.SecurityUtils;
    });

    describe('XSS Prevention', () => {
        test('should sanitize malicious script tags', () => {
            const maliciousInput = '<script>alert("XSS")</script>Hello';
            const sanitized = securityUtils.sanitizeHTML(maliciousInput);
            expect(sanitized).not.toContain('<script>');
            expect(sanitized).toContain('Hello');
        });

        test('should prevent event handler injection', () => {
            const maliciousInput = '<img src="x" onerror="alert(1)">';
            const sanitized = securityUtils.sanitizeHTML(maliciousInput);
            expect(sanitized).not.toContain('onerror');
        });

        test('should sanitize filename for download', () => {
            const maliciousFilename = '../../../etc/passwd<script>.txt';
            const sanitized = securityUtils.sanitizeFilename(maliciousFilename);
            expect(sanitized).not.toContain('../');
            expect(sanitized).not.toContain('<script>');
            expect(sanitized).toMatch(/^[a-zA-Z0-9_.-]+$/);
        });

        test('should validate attributes against allowlist', () => {
            expect(securityUtils.isValidAttribute('onclick')).toBe(false);
            expect(securityUtils.isValidAttribute('onload')).toBe(false);
            expect(securityUtils.isValidAttribute('class')).toBe(true);
            expect(securityUtils.isValidAttribute('id')).toBe(true);
        });
    });

    describe('CSRF Protection', () => {
        test('should generate secure CSRF tokens', () => {
            const token1 = securityUtils.generateCSRFToken();
            const token2 = securityUtils.generateCSRFToken();
            
            expect(token1).toHaveLength(64); // 32 bytes * 2 hex chars
            expect(token2).toHaveLength(64);
            expect(token1).not.toEqual(token2); // Should be unique
        });

        test('should validate CSRF tokens correctly', () => {
            const validToken = securityUtils.generateCSRFToken();
            const invalidToken = 'invalid-token-12345';
            
            expect(securityUtils.validateCSRFToken(validToken, validToken)).toBe(true);
            expect(securityUtils.validateCSRFToken(invalidToken, validToken)).toBe(false);
            expect(securityUtils.validateCSRFToken('', validToken)).toBe(false);
        });

        test('should handle timing attack prevention', () => {
            const token = 'a'.repeat(64);
            const start1 = performance.now();
            securityUtils.validateCSRFToken('b'.repeat(64), token);
            const time1 = performance.now() - start1;
            
            const start2 = performance.now();
            securityUtils.validateCSRFToken('a'.repeat(63) + 'b', token);
            const time2 = performance.now() - start2;
            
            // Timing should be similar (within 5ms) for constant-time comparison
            expect(Math.abs(time1 - time2)).toBeLessThan(5);
        });
    });

    describe('Data Encryption', () => {
        test('should encrypt and decrypt data correctly', async () => {
            const originalData = 'sensitive transcription data';
            const encryptionKey = 'test-key-123';
            
            const encrypted = await securityUtils.encryptData(originalData, encryptionKey);
            const decrypted = await securityUtils.decryptData(encrypted, encryptionKey);
            
            expect(encrypted).not.toEqual(originalData);
            expect(decrypted).toEqual(originalData);
        });

        test('should fail gracefully with wrong decryption key', async () => {
            const originalData = 'sensitive data';
            const correctKey = 'correct-key';
            const wrongKey = 'wrong-key';
            
            const encrypted = await securityUtils.encryptData(originalData, correctKey);
            const decrypted = await securityUtils.decryptData(encrypted, wrongKey);
            
            // Should fallback to returning encrypted data if decryption fails
            expect(decrypted).toEqual(encrypted);
        });

        test('should handle encryption failure gracefully', async () => {
            const originalData = 'test data';
            const invalidKey = null;
            
            const result = await securityUtils.encryptData(originalData, invalidKey);
            // Should fallback to unencrypted data
            expect(result).toEqual(originalData);
        });
    });

    describe('Rate Limiting', () => {
        beforeEach(() => {
            // Clear localStorage before each test
            localStorage.clear();
        });

        test('should allow requests within rate limit', () => {
            const key = 'test-endpoint';
            const maxRequests = 5;
            const windowMs = 60000;
            
            for (let i = 0; i < maxRequests; i++) {
                expect(securityUtils.checkRateLimit(key, maxRequests, windowMs)).toBe(true);
            }
        });

        test('should block requests exceeding rate limit', () => {
            const key = 'test-endpoint';
            const maxRequests = 3;
            const windowMs = 60000;
            
            // Use up the allowed requests
            for (let i = 0; i < maxRequests; i++) {
                securityUtils.checkRateLimit(key, maxRequests, windowMs);
            }
            
            // Next request should be blocked
            expect(securityUtils.checkRateLimit(key, maxRequests, windowMs)).toBe(false);
        });

        test('should reset after time window expires', () => {
            const key = 'test-endpoint';
            const maxRequests = 2;
            const windowMs = 100; // Short window for testing
            
            // Use up requests
            securityUtils.checkRateLimit(key, maxRequests, windowMs);
            securityUtils.checkRateLimit(key, maxRequests, windowMs);
            expect(securityUtils.checkRateLimit(key, maxRequests, windowMs)).toBe(false);
            
            // Wait for window to expire
            return new Promise(resolve => {
                setTimeout(() => {
                    expect(securityUtils.checkRateLimit(key, maxRequests, windowMs)).toBe(true);
                    resolve();
                }, windowMs + 10);
            });
        });
    });

    describe('URL Validation', () => {
        test('should allow same-origin URLs', () => {
            const sameOriginUrl = window.location.origin + '/api/test';
            expect(securityUtils.isSafeURL(sameOriginUrl)).toBe(true);
        });

        test('should allow explicitly whitelisted domains', () => {
            const allowedUrl = 'https://unpkg.com/htmx.org@1.9.10';
            expect(securityUtils.isSafeURL(allowedUrl)).toBe(true);
        });

        test('should block malicious URLs', () => {
            const maliciousUrls = [
                'javascript:alert(1)',
                'data:text/html,<script>alert(1)</script>',
                'https://evil.com/malware.js',
                'http://localhost:8080/../../../etc/passwd'
            ];
            
            maliciousUrls.forEach(url => {
                expect(securityUtils.isSafeURL(url)).toBe(false);
            });
        });

        test('should handle malformed URLs gracefully', () => {
            const malformedUrls = ['not-a-url', ':', 'http://'];
            
            malformedUrls.forEach(url => {
                expect(securityUtils.isSafeURL(url)).toBe(false);
            });
        });
    });
});

/**
 * Integration Security Tests
 * Tests security features in real application context
 */
describe('Security Integration Tests', () => {
    let whisperApp;
    
    beforeEach(() => {
        // Setup DOM elements needed for testing
        document.body.innerHTML = `
            <div id="toast-container"></div>
            <form id="transcribe-form">
                <input type="hidden" name="csrf_token" id="csrf-token" value="test-token">
            </form>
            <div id="history-list"></div>
        `;
        
        // Initialize app
        whisperApp = new WhisperApp();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    describe('CSRF Token Integration', () => {
        test('should refresh CSRF token after successful request', async () => {
            // Mock fetch for CSRF token endpoint
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    json: () => Promise.resolve({ csrf_token: 'new-token-123' })
                })
            );
            
            await whisperApp.refreshCSRFToken();
            
            const csrfInput = document.getElementById('csrf-token');
            expect(csrfInput.value).toBe('new-token-123');
            expect(fetch).toHaveBeenCalledWith('/api/csrf-token');
        });

        test('should handle CSRF token refresh failure gracefully', async () => {
            global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));
            
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            await whisperApp.refreshCSRFToken();
            
            expect(consoleSpy).toHaveBeenCalledWith('Failed to refresh CSRF token:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('Rate Limiting Integration', () => {
        test('should show warning when rate limit exceeded', () => {
            // Mock rate limit exceeded
            jest.spyOn(SecurityUtils, 'checkRateLimit').mockReturnValue(false);
            
            const mockEvent = {
                preventDefault: jest.fn()
            };
            
            // Simulate HTMX beforeRequest event
            document.dispatchEvent(new CustomEvent('htmx:beforeRequest', { detail: mockEvent }));
            
            expect(mockEvent.preventDefault).toHaveBeenCalled();
            
            // Should show toast notification
            const toastContainer = document.getElementById('toast-container');
            expect(toastContainer.children.length).toBeGreaterThan(0);
        });
    });

    describe('History System Security', () => {
        test('should encrypt history data before storage', async () => {
            const testEntry = {
                id: 'test-123',
                filename: 'test.mp3',
                transcript: 'test transcript',
                timestamp: Date.now()
            };
            
            await whisperApp.storage.save(testEntry);
            
            const rawStoredData = localStorage.getItem('whisper-history');
            expect(rawStoredData).not.toContain('test transcript'); // Should be encrypted
            expect(rawStoredData).not.toContain('test.mp3'); // Should be encrypted
        });

        test('should decrypt history data on load', async () => {
            const testEntry = {
                id: 'test-123',
                filename: 'test.mp3',
                transcript: 'test transcript',
                timestamp: Date.now()
            };
            
            await whisperApp.storage.save(testEntry);
            const loadedEntries = await whisperApp.storage.load();
            
            expect(loadedEntries).toHaveLength(1);
            expect(loadedEntries[0].transcript).toBe('test transcript');
            expect(loadedEntries[0].filename).toBe('test.mp3');
        });

        test('should handle corrupted encrypted data gracefully', async () => {
            // Store corrupted encrypted data
            localStorage.setItem('whisper-history', 'corrupted-data-123');
            
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            const entries = await whisperApp.storage.load();
            
            expect(entries).toEqual([]); // Should return empty array
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('DOM Security', () => {
        test('should create history items safely without XSS', () => {
            const maliciousEntry = {
                id: 'test-123',
                filename: '<script>alert("XSS")</script>malicious.mp3',
                transcript: '<img src="x" onerror="alert(1)">transcript',
                timestamp: Date.now(),
                fileType: 'audio',
                fileSize: 1024
            };
            
            const historyItem = whisperApp.createHistoryItem(maliciousEntry);
            
            // Should not contain malicious scripts
            expect(historyItem.innerHTML).not.toContain('<script>');
            expect(historyItem.innerHTML).not.toContain('onerror');
            
            // Should contain safe content
            expect(historyItem.textContent).toContain('malicious.mp3');
            expect(historyItem.textContent).toContain('transcript');
        });

        test('should sanitize filenames in downloads', async () => {
            const maliciousEntry = {
                id: 'test-123',
                filename: '../../../malicious<script>.mp3',
                transcript: 'test transcript'
            };
            
            await whisperApp.storage.save(maliciousEntry);
            
            // Mock downloadFile to capture filename
            const downloadSpy = jest.spyOn(whisperApp, 'downloadFile').mockImplementation();
            
            await whisperApp.downloadTranscript('test-123');
            
            const [content, filename] = downloadSpy.mock.calls[0];
            expect(filename).not.toContain('../');
            expect(filename).not.toContain('<script>');
            expect(filename).toMatch(/^[a-zA-Z0-9_.-]+$/);
            
            downloadSpy.mockRestore();
        });
    });
});