/**
 * Simplified Test Verification for Whisper Hub
 * Focus on core security and functionality tests
 */

describe('Critical Security Tests', () => {
    beforeEach(() => {
        // Reset document
        document.body.innerHTML = '<div id="toast-container"></div>';
        localStorage.clear();
    });

    test('XSS sanitization works', () => {
        const maliciousInput = '<script>alert("XSS")</script>Hello';
        const sanitized = SecurityUtils.sanitizeHTML(maliciousInput);
        
        // Should convert script tag to safe text
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).toContain('Hello');
        expect(sanitized).toBe('&lt;script&gt;alert("XSS")&lt;/script&gt;Hello');
    });

    test('Filename sanitization works', () => {
        const maliciousFilename = '../../../etc/passwd<script>.txt';
        const sanitized = SecurityUtils.sanitizeFilename(maliciousFilename);
        
        expect(sanitized).not.toContain('../');
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).toBe('_._._etc_passwd_script_.txt');
    });

    test('CSRF token generation works', () => {
        const token1 = SecurityUtils.generateCSRFToken();
        const token2 = SecurityUtils.generateCSRFToken();
        
        expect(token1).toHaveLength(64);
        expect(token2).toHaveLength(64);
        expect(token1).not.toEqual(token2);
    });

    test('CSRF token validation works', () => {
        const token = 'a'.repeat(64);
        
        expect(SecurityUtils.validateCSRFToken(token, token)).toBe(true);
        expect(SecurityUtils.validateCSRFToken('invalid', token)).toBe(false);
        expect(SecurityUtils.validateCSRFToken('', token)).toBe(false);
    });

    test('URL validation works', () => {
        expect(SecurityUtils.isSafeURL('http://localhost:8080/test')).toBe(true);
        expect(SecurityUtils.isSafeURL('https://unpkg.com/htmx')).toBe(true);
        expect(SecurityUtils.isSafeURL('javascript:alert(1)')).toBe(false);
        expect(SecurityUtils.isSafeURL('https://evil.com/malware')).toBe(false);
    });
});

describe('Critical Application Tests', () => {
    let app;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="toast-container"></div>
            <div id="history-panel" class="collapsed"></div>
            <div id="settings-panel" class="collapsed"></div>
            <div id="panel-overlay"></div>
            <input type="hidden" id="csrf-token" value="test-token">
        `;
        app = new WhisperApp();
    });

    afterEach(() => {
        localStorage.clear();
    });

    test('App initialization works', () => {
        expect(app.state.incognitoMode).toBe(false);
        expect(app.state.historyEnabled).toBe(true);
        expect(app.state.panels.history).toBe(false);
    });

    test('Panel management works', () => {
        app.openPanel('history');
        expect(app.state.panels.history).toBe(true);
        
        app.closePanel('history');
        expect(app.state.panels.history).toBe(false);
    });

    test('History storage works', async () => {
        const testEntry = {
            id: 'test-123',
            filename: 'test.mp3',
            transcript: 'test transcript',
            timestamp: Date.now()
        };

        await app.storage.save(testEntry);
        const entries = await app.storage.load();
        
        expect(entries).toHaveLength(1);
        expect(entries[0].transcript).toBe('test transcript');
    });

    test('History filtering works', async () => {
        await app.storage.save({
            id: '1', filename: 'audio.mp3', fileType: 'audio', 
            transcript: 'audio transcript', timestamp: Date.now()
        });
        await app.storage.save({
            id: '2', filename: 'video.mp4', fileType: 'video', 
            transcript: 'video transcript', timestamp: Date.now()
        });

        const audioEntries = await app.storage.load({ fileType: 'audio' });
        expect(audioEntries).toHaveLength(1);
        expect(audioEntries[0].fileType).toBe('audio');
    });

    test('Incognito mode prevents history storage', async () => {
        app.state.incognitoMode = true;
        app.state.historyEnabled = true;

        await app.handleTranscriptionSuccess({
            detail: {
                xhr: {
                    responseText: '<div data-transcript="Test">Test</div>'
                }
            }
        });

        const entries = await app.storage.load();
        expect(entries).toHaveLength(0);
    });

    test('Toast notifications work', () => {
        app.ui.showToast('Test message', 'success');
        
        const container = document.getElementById('toast-container');
        expect(container.children.length).toBe(1);
        
        const toast = container.firstChild;
        expect(toast.classList.contains('toast-success')).toBe(true);
        expect(toast.textContent).toContain('Test message');
    });
});

describe('Performance Tests', () => {
    test('App initialization is fast', () => {
        const start = performance.now();
        new WhisperApp();
        const end = performance.now();
        
        expect(end - start).toBeLessThan(100);
    });

    test('SecurityUtils operations are fast', () => {
        const start = performance.now();
        
        for (let i = 0; i < 100; i++) {
            SecurityUtils.sanitizeHTML('<script>test</script>');
            SecurityUtils.sanitizeFilename('test../file.txt');
            SecurityUtils.generateCSRFToken();
        }
        
        const end = performance.now();
        expect(end - start).toBeLessThan(1000);
    });
});

console.log('Running simplified tests for Whisper Hub...');