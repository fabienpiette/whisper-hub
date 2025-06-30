/**
 * Performance Test Suite for Whisper Hub
 * Validates application performance under various conditions
 */

describe('Performance Tests', () => {
    let whisperApp;
    let performanceObserver;
    
    beforeEach(() => {
        // Setup performance monitoring
        if (window.PerformanceObserver) {
            performanceObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry) => {
                    console.log(`Performance: ${entry.name} took ${entry.duration}ms`);
                });
            });
            performanceObserver.observe({ entryTypes: ['measure', 'navigation'] });
        }
        
        // Setup DOM
        document.body.innerHTML = `
            <div id="app">
                <div id="history-list"></div>
                <div id="toast-container"></div>
            </div>
        `;
        
        whisperApp = new WhisperApp();
    });

    afterEach(() => {
        if (performanceObserver) {
            performanceObserver.disconnect();
        }
        document.body.innerHTML = '';
        localStorage.clear();
    });

    describe('Application Initialization Performance', () => {
        test('should initialize within performance budget', () => {
            const startTime = performance.now();
            
            const newApp = new WhisperApp();
            
            const endTime = performance.now();
            const initTime = endTime - startTime;
            
            // Should initialize in less than 100ms
            expect(initTime).toBeLessThan(100);
        });

        test('should load settings quickly even with large data', () => {
            // Create large settings object
            const largeSettings = {
                historyEnabled: true,
                userData: new Array(1000).fill().map((_, i) => ({
                    id: i,
                    data: `test-data-${i}`.repeat(100)
                }))
            };
            
            localStorage.setItem('whisper-settings', JSON.stringify(largeSettings));
            
            const startTime = performance.now();
            const newApp = new WhisperApp();
            const endTime = performance.now();
            
            // Should still load quickly even with large settings
            expect(endTime - startTime).toBeLessThan(200);
        });
    });

    describe('History System Performance', () => {
        test('should handle large history datasets efficiently', async () => {
            // Create large history dataset
            const largeHistory = new Array(1000).fill().map((_, i) => ({
                id: `entry-${i}`,
                filename: `test-file-${i}.mp3`,
                transcript: `This is transcript number ${i}. `.repeat(50),
                timestamp: Date.now() - (i * 1000),
                fileType: i % 2 === 0 ? 'audio' : 'video',
                fileSize: Math.random() * 10000000,
                starred: i % 10 === 0
            }));
            
            // Measure save performance
            const saveStart = performance.now();
            for (const entry of largeHistory.slice(0, 100)) {
                await whisperApp.storage.save(entry);
            }
            const saveEnd = performance.now();
            
            // Should save 100 entries in reasonable time
            expect(saveEnd - saveStart).toBeLessThan(2000);
            
            // Measure load performance
            const loadStart = performance.now();
            const entries = await whisperApp.storage.load();
            const loadEnd = performance.now();
            
            // Should load quickly even with many entries
            expect(loadEnd - loadStart).toBeLessThan(500);
            expect(entries.length).toBe(100);
        });

        test('should filter large datasets efficiently', async () => {
            // Add varied test data
            const testEntries = new Array(500).fill().map((_, i) => ({
                id: `entry-${i}`,
                filename: `${i % 2 === 0 ? 'audio' : 'video'}-file-${i}.mp3`,
                transcript: `Transcript ${i} contains ${i % 3 === 0 ? 'meeting' : 'interview'} content`,
                timestamp: Date.now() - (i * 1000),
                fileType: i % 2 === 0 ? 'audio' : 'video',
                starred: i % 5 === 0
            }));
            
            // Save test data
            for (const entry of testEntries) {
                await whisperApp.storage.save(entry);
            }
            
            // Test search performance
            const searchStart = performance.now();
            const searchResults = await whisperApp.storage.load({ search: 'meeting' });
            const searchEnd = performance.now();
            
            expect(searchEnd - searchStart).toBeLessThan(100);
            expect(searchResults.length).toBeGreaterThan(0);
            
            // Test filter performance
            const filterStart = performance.now();
            const filterResults = await whisperApp.storage.load({ fileType: 'audio' });
            const filterEnd = performance.now();
            
            expect(filterEnd - filterStart).toBeLessThan(100);
            expect(filterResults.every(entry => entry.fileType === 'audio')).toBe(true);
        });

        test('should render large history lists efficiently', async () => {
            const entries = new Array(100).fill().map((_, i) => ({
                id: `entry-${i}`,
                filename: `test-${i}.mp3`,
                transcript: `Transcript ${i}`,
                timestamp: Date.now(),
                fileType: 'audio',
                fileSize: 1024
            }));
            
            const renderStart = performance.now();
            await whisperApp.renderHistoryList(entries);
            const renderEnd = performance.now();
            
            // Should render 100 items in reasonable time
            expect(renderEnd - renderStart).toBeLessThan(1000);
            
            const historyList = document.getElementById('history-list');
            expect(historyList.children.length).toBe(100);
        });
    });

    describe('Encryption Performance', () => {
        test('should encrypt/decrypt data within reasonable time', async () => {
            const testData = JSON.stringify({
                large_transcript: 'A'.repeat(10000), // 10KB of text
                metadata: { type: 'test', size: 10000 }
            });
            
            const key = 'test-encryption-key';
            
            // Test encryption performance
            const encryptStart = performance.now();
            const encrypted = await SecurityUtils.encryptData(testData, key);
            const encryptEnd = performance.now();
            
            expect(encryptEnd - encryptStart).toBeLessThan(100);
            expect(encrypted).not.toEqual(testData);
            
            // Test decryption performance
            const decryptStart = performance.now();
            const decrypted = await SecurityUtils.decryptData(encrypted, key);
            const decryptEnd = performance.now();
            
            expect(decryptEnd - decryptStart).toBeLessThan(100);
            expect(decrypted).toEqual(testData);
        });

        test('should handle concurrent encryption operations', async () => {
            const testDataSets = new Array(10).fill().map((_, i) => 
                JSON.stringify({ id: i, data: 'test'.repeat(1000) })
            );
            
            const concurrentStart = performance.now();
            
            const encryptionPromises = testDataSets.map(data => 
                SecurityUtils.encryptData(data, 'test-key')
            );
            
            const encryptedResults = await Promise.all(encryptionPromises);
            const concurrentEnd = performance.now();
            
            // Should handle 10 concurrent encryptions efficiently
            expect(concurrentEnd - concurrentStart).toBeLessThan(500);
            expect(encryptedResults.length).toBe(10);
            expect(encryptedResults.every(result => typeof result === 'string')).toBe(true);
        });
    });

    describe('DOM Manipulation Performance', () => {
        test('should create DOM elements efficiently', () => {
            const createStart = performance.now();
            
            // Create 100 DOM elements using SecurityUtils
            const elements = new Array(100).fill().map((_, i) => 
                SecurityUtils.createElement('div', {
                    'class': 'test-element',
                    'data-id': i.toString()
                }, `Test content ${i}`)
            );
            
            const createEnd = performance.now();
            
            expect(createEnd - createStart).toBeLessThan(50);
            expect(elements.length).toBe(100);
            expect(elements[0].tagName).toBe('DIV');
        });

        test('should update large DOM structures efficiently', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            
            // Add initial elements
            for (let i = 0; i < 200; i++) {
                const element = document.createElement('div');
                element.textContent = `Item ${i}`;
                container.appendChild(element);
            }
            
            const updateStart = performance.now();
            
            // Update all elements
            Array.from(container.children).forEach((child, i) => {
                child.textContent = `Updated Item ${i}`;
                child.className = 'updated';
            });
            
            const updateEnd = performance.now();
            
            expect(updateEnd - updateStart).toBeLessThan(50);
            expect(container.children.length).toBe(200);
            
            document.body.removeChild(container);
        });
    });

    describe('Search Performance', () => {
        test('should search through large text efficiently', async () => {
            // Create entries with large transcripts
            const entries = new Array(100).fill().map((_, i) => ({
                id: `entry-${i}`,
                filename: `file-${i}.mp3`,
                transcript: `
                    This is a very long transcript for entry ${i}. 
                    It contains multiple sentences and paragraphs.
                    ${i % 10 === 0 ? 'special keyword meeting' : 'regular content'}
                    ${'Lorem ipsum dolor sit amet. '.repeat(100)}
                `.repeat(5), // Very large transcript
                timestamp: Date.now()
            }));
            
            const searchStart = performance.now();
            
            const results = entries.filter(entry => 
                entry.filename.toLowerCase().includes('file-5') ||
                entry.transcript.toLowerCase().includes('meeting')
            );
            
            const searchEnd = performance.now();
            
            expect(searchEnd - searchStart).toBeLessThan(50);
            expect(results.length).toBeGreaterThan(0);
        });
    });

    describe('Toast Notification Performance', () => {
        test('should display multiple toasts without performance degradation', () => {
            const toastStart = performance.now();
            
            // Show 20 toasts rapidly
            for (let i = 0; i < 20; i++) {
                whisperApp.ui.showToast(`Message ${i}`, 'info');
            }
            
            const toastEnd = performance.now();
            
            expect(toastEnd - toastStart).toBeLessThan(100);
            
            const toastContainer = document.getElementById('toast-container');
            expect(toastContainer.children.length).toBe(20);
        });
    });

    describe('Memory Usage Performance', () => {
        test('should not leak memory during normal operations', () => {
            if (!window.performance.memory) {
                console.log('Memory API not available, skipping memory test');
                return;
            }
            
            const initialMemory = window.performance.memory.usedJSHeapSize;
            
            // Perform memory-intensive operations
            for (let i = 0; i < 100; i++) {
                const entry = {
                    id: `mem-test-${i}`,
                    transcript: 'test'.repeat(1000),
                    timestamp: Date.now()
                };
                
                // Create and destroy DOM elements
                const element = whisperApp.createHistoryItem(entry);
                document.body.appendChild(element);
                document.body.removeChild(element);
            }
            
            // Force garbage collection if available
            if (window.gc) {
                window.gc();
            }
            
            const finalMemory = window.performance.memory.usedJSHeapSize;
            const memoryIncrease = finalMemory - initialMemory;
            
            // Memory increase should be reasonable (less than 10MB)
            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
        });
    });

    describe('Rate Limiting Performance', () => {
        test('should check rate limits efficiently', () => {
            const rateLimitStart = performance.now();
            
            // Check rate limits 1000 times
            for (let i = 0; i < 1000; i++) {
                SecurityUtils.checkRateLimit(`test-key-${i % 10}`, 100, 60000);
            }
            
            const rateLimitEnd = performance.now();
            
            // Should handle 1000 rate limit checks quickly
            expect(rateLimitEnd - rateLimitStart).toBeLessThan(100);
        });
    });

    describe('File Processing Performance', () => {
        test('should handle file metadata extraction efficiently', () => {
            // Create mock large file
            const mockFile = {
                name: 'large-audio-file.mp3',
                size: 100 * 1024 * 1024, // 100MB
                type: 'audio/mp3'
            };
            
            const processStart = performance.now();
            
            const fileSize = whisperApp.formatFileSize(mockFile.size);
            const safeFilename = SecurityUtils.sanitizeFilename(mockFile.name);
            
            const processEnd = performance.now();
            
            expect(processEnd - processStart).toBeLessThan(10);
            expect(fileSize).toContain('100.0 MB');
            expect(safeFilename).toBe('large-audio-file.mp3');
        });
    });
});

/**
 * Performance Benchmarking Utilities
 */
class PerformanceBenchmark {
    static async measureAsync(name, asyncFunction) {
        const start = performance.now();
        const result = await asyncFunction();
        const end = performance.now();
        
        console.log(`Benchmark ${name}: ${end - start}ms`);
        return { result, duration: end - start };
    }
    
    static measure(name, syncFunction) {
        const start = performance.now();
        const result = syncFunction();
        const end = performance.now();
        
        console.log(`Benchmark ${name}: ${end - start}ms`);
        return { result, duration: end - start };
    }
    
    static async loadTest(name, asyncFunction, iterations = 100) {
        const durations = [];
        
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            await asyncFunction();
            const end = performance.now();
            durations.push(end - start);
        }
        
        const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
        const min = Math.min(...durations);
        const max = Math.max(...durations);
        
        console.log(`Load test ${name} (${iterations} iterations):`);
        console.log(`  Average: ${avg.toFixed(2)}ms`);
        console.log(`  Min: ${min.toFixed(2)}ms`);
        console.log(`  Max: ${max.toFixed(2)}ms`);
        
        return { avg, min, max, durations };
    }
}

// Export for use in other test files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PerformanceBenchmark };
}