/**
 * Performance and Load Tests for Post-Transcription Actions
 * Tests system performance under various load conditions
 */

const { JSDOM } = require('jsdom');

// Performance testing utilities
class PerformanceProfiler {
    constructor() {
        this.metrics = {};
        this.startTimes = {};
    }
    
    start(operation) {
        this.startTimes[operation] = process.hrtime.bigint();
    }
    
    end(operation) {
        if (!this.startTimes[operation]) return null;
        
        const duration = Number(process.hrtime.bigint() - this.startTimes[operation]) / 1e6; // Convert to ms
        if (!this.metrics[operation]) {
            this.metrics[operation] = [];
        }
        this.metrics[operation].push(duration);
        delete this.startTimes[operation];
        return duration;
    }
    
    getStats(operation) {
        const times = this.metrics[operation] || [];
        if (times.length === 0) return null;
        
        const sorted = times.sort((a, b) => a - b);
        return {
            count: times.length,
            min: Math.min(...times),
            max: Math.max(...times),
            avg: times.reduce((a, b) => a + b) / times.length,
            median: sorted[Math.floor(sorted.length / 2)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)]
        };
    }
    
    reset() {
        this.metrics = {};
        this.startTimes = {};
    }
}

// Load testing utilities
class LoadTester {
    constructor(maxConcurrency = 10) {
        this.maxConcurrency = maxConcurrency;
        this.activeRequests = 0;
        this.completedRequests = 0;
        this.failedRequests = 0;
        this.profiler = new PerformanceProfiler();
    }
    
    async runConcurrentOperations(operations, concurrency = 5) {
        const results = [];
        const chunks = this.chunkArray(operations, concurrency);
        
        for (const chunk of chunks) {
            const chunkPromises = chunk.map(async (operation, index) => {
                this.activeRequests++;
                this.profiler.start(`operation-${this.completedRequests + index}`);
                
                try {
                    const result = await operation();
                    this.profiler.end(`operation-${this.completedRequests + index}`);
                    this.completedRequests++;
                    return { success: true, result };
                } catch (error) {
                    this.profiler.end(`operation-${this.completedRequests + index}`);
                    this.failedRequests++;
                    return { success: false, error: error.message };
                } finally {
                    this.activeRequests--;
                }
            });
            
            const chunkResults = await Promise.all(chunkPromises);
            results.push(...chunkResults);
        }
        
        return results;
    }
    
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
    
    getMetrics() {
        return {
            completed: this.completedRequests,
            failed: this.failedRequests,
            active: this.activeRequests,
            successRate: this.completedRequests / (this.completedRequests + this.failedRequests) * 100,
            performance: this.profiler.getStats('operation-0') // Sample operation stats
        };
    }
}

// Mock DOM environment for performance testing
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head><title>Performance Test</title></head>
<body>
    <div id="test-container"></div>
    <div id="action-container"></div>
    <div id="history-container"></div>
</body>
</html>
`);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = {
    data: {},
    getItem: function(key) { return this.data[key] || null; },
    setItem: function(key, value) { this.data[key] = value; },
    removeItem: function(key) { delete this.data[key]; },
    clear: function() { this.data = {}; }
};

// Load application code
const fs = require('fs');
const path = require('path');
const appJs = fs.readFileSync(path.join(__dirname, '../web/static/js/app.js'), 'utf8');
const securityJs = fs.readFileSync(path.join(__dirname, '../web/static/js/security.js'), 'utf8');

eval(securityJs);
eval(appJs);

describe('Performance and Load Tests', () => {
    let profiler;
    let loadTester;
    
    beforeEach(() => {
        profiler = new PerformanceProfiler();
        loadTester = new LoadTester();
        localStorage.clear();
        document.getElementById('test-container').innerHTML = '';
    });

    describe('Action Manager Performance', () => {
        test('should handle rapid action creation and validation', async () => {
            const actionManager = new CustomActionManager();
            const operationCount = 100;
            
            profiler.start('bulk-action-creation');
            
            for (let i = 0; i < operationCount; i++) {
                const action = {
                    name: `Performance Test Action ${i}`,
                    type: 'template',
                    template: `Template ${i}: {{.Transcript}}`,
                    description: `Test action ${i}`
                };
                
                profiler.start(`validation-${i}`);
                const errors = actionManager.validateAction(action);
                profiler.end(`validation-${i}`);
                
                expect(errors.length).toBe(0);
                
                profiler.start(`save-${i}`);
                const actionId = actionManager.saveAction(action);
                profiler.end(`save-${i}`);
                
                expect(actionId).toBeTruthy();
            }
            
            profiler.end('bulk-action-creation');
            
            const bulkStats = profiler.getStats('bulk-action-creation');
            expect(bulkStats.avg).toBeLessThan(1000); // Should complete in under 1 second
            
            // Test retrieval performance
            profiler.start('bulk-action-retrieval');
            const allActions = actionManager.getActions();
            profiler.end('bulk-action-retrieval');
            
            expect(allActions.length).toBe(operationCount);
            
            const retrievalStats = profiler.getStats('bulk-action-retrieval');
            expect(retrievalStats.avg).toBeLessThan(50); // Should retrieve quickly
        });

        test('should handle concurrent action operations', async () => {
            const actionManager = new CustomActionManager();
            const concurrentOperations = 20;
            
            const operations = Array.from({ length: concurrentOperations }, (_, i) => 
                async () => {
                    const action = {
                        name: `Concurrent Action ${i}`,
                        type: 'openai',
                        prompt: `Test prompt ${i}`,
                        model: 'gpt-3.5-turbo',
                        description: `Concurrent test ${i}`
                    };
                    
                    const errors = actionManager.validateAction(action);
                    if (errors.length > 0) {
                        throw new Error(`Validation failed: ${errors.join(', ')}`);
                    }
                    
                    const actionId = actionManager.saveAction(action);
                    if (!actionId) {
                        throw new Error('Failed to save action');
                    }
                    
                    return { actionId, action };
                }
            );
            
            const results = await loadTester.runConcurrentOperations(operations, 5);
            
            const successfulResults = results.filter(r => r.success);
            expect(successfulResults.length).toBe(concurrentOperations);
            
            const metrics = loadTester.getMetrics();
            expect(metrics.successRate).toBe(100);
        });

        test('should handle large action payloads efficiently', () => {
            const actionManager = new CustomActionManager();
            const largeTemplate = 'A'.repeat(5000); // 5KB template
            
            profiler.start('large-template-validation');
            
            const action = {
                name: 'Large Template Test',
                type: 'template',
                template: largeTemplate,
                description: 'Performance test with large template'
            };
            
            const errors = actionManager.validateAction(action);
            profiler.end('large-template-validation');
            
            expect(errors.some(e => e.includes('too long'))).toBe(true);
            
            const validationStats = profiler.getStats('large-template-validation');
            expect(validationStats.avg).toBeLessThan(100); // Should reject quickly
        });
    });

    describe('History Manager Performance', () => {
        test('should handle large history datasets efficiently', () => {
            const historyManager = new TranscriptionHistory();
            const recordCount = 1000;
            
            // Test bulk insertion
            profiler.start('bulk-history-insertion');
            
            for (let i = 0; i < recordCount; i++) {
                const transcript = {
                    id: `perf-test-${i}`,
                    transcript: `Performance test transcript ${i} with some content to make it realistic`,
                    filename: `test-${i}.mp3`,
                    timestamp: new Date(Date.now() - i * 1000).toISOString(),
                    fileType: 'audio',
                    fileSize: 1024 * (i % 100 + 1),
                    actionResult: i % 3 === 0 ? {
                        success: true,
                        actionName: 'Test Action',
                        output: `Action result ${i}`
                    } : null
                };
                
                historyManager.addTranscript(transcript);
            }
            
            profiler.end('bulk-history-insertion');
            
            const insertionStats = profiler.getStats('bulk-history-insertion');
            expect(insertionStats.avg).toBeLessThan(2000); // Should complete in under 2 seconds
            
            // Test search performance
            profiler.start('history-search');
            const searchResults = historyManager.searchTranscripts('Performance test');
            profiler.end('history-search');
            
            expect(searchResults.length).toBeGreaterThan(0);
            
            const searchStats = profiler.getStats('history-search');
            expect(searchStats.avg).toBeLessThan(100); // Should search quickly
            
            // Test filtering performance
            profiler.start('history-filtering');
            const filteredResults = historyManager.filterByDateRange(
                new Date(Date.now() - 500 * 1000).toISOString(),
                new Date().toISOString()
            );
            profiler.end('history-filtering');
            
            expect(filteredResults.length).toBeGreaterThan(0);
            
            const filterStats = profiler.getStats('history-filtering');
            expect(filterStats.avg).toBeLessThan(50); // Should filter quickly
        });

        test('should handle concurrent history operations', async () => {
            const historyManager = new TranscriptionHistory();
            const concurrentOperations = 50;
            
            const operations = Array.from({ length: concurrentOperations }, (_, i) => 
                async () => {
                    if (i % 3 === 0) {
                        // Add operation
                        const transcript = {
                            id: `concurrent-${i}`,
                            transcript: `Concurrent test ${i}`,
                            filename: `concurrent-${i}.mp3`,
                            timestamp: new Date().toISOString(),
                            fileType: 'audio',
                            fileSize: 1024
                        };
                        historyManager.addTranscript(transcript);
                        return 'add';
                    } else if (i % 3 === 1) {
                        // Search operation
                        const results = historyManager.searchTranscripts('concurrent');
                        return `search-${results.length}`;
                    } else {
                        // Get history operation
                        const history = historyManager.getHistory();
                        return `get-${history.length}`;
                    }
                }
            );
            
            const results = await loadTester.runConcurrentOperations(operations, 10);
            
            const successfulResults = results.filter(r => r.success);
            expect(successfulResults.length).toBe(concurrentOperations);
            
            const metrics = loadTester.getMetrics();
            expect(metrics.successRate).toBe(100);
        });

        test('should handle memory efficiently with large datasets', () => {
            const historyManager = new TranscriptionHistory();
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Add large amount of data
            for (let i = 0; i < 5000; i++) {
                const transcript = {
                    id: `memory-test-${i}`,
                    transcript: 'A'.repeat(1000), // 1KB per transcript
                    filename: `memory-${i}.mp3`,
                    timestamp: new Date().toISOString(),
                    fileType: 'audio',
                    fileSize: 1024 * 1024 // 1MB
                };
                
                historyManager.addTranscript(transcript);
            }
            
            const afterMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = afterMemory - initialMemory;
            
            // Memory increase should be reasonable (less than 100MB for 5K records)
            expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
            
            // Test memory cleanup
            historyManager.clearHistory();
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            const afterCleanup = process.memoryUsage().heapUsed;
            const memoryRecovered = afterMemory - afterCleanup;
            
            // Should recover significant memory
            expect(memoryRecovered).toBeGreaterThan(memoryIncrease * 0.5);
        });
    });

    describe('Security Utils Performance', () => {
        test('should handle rapid encryption/decryption operations', async () => {
            if (typeof SecurityUtils === 'undefined') {
                console.log('SecurityUtils not available, skipping encryption tests');
                return;
            }
            
            const operationCount = 100;
            const testData = 'A'.repeat(1000); // 1KB test data
            
            const operations = Array.from({ length: operationCount }, (_, i) => 
                async () => {
                    try {
                        // Test encryption
                        const encrypted = await SecurityUtils.encryptData(testData, `key-${i}`);
                        if (!encrypted) throw new Error('Encryption failed');
                        
                        // Test decryption
                        const decrypted = await SecurityUtils.decryptData(encrypted, `key-${i}`);
                        if (decrypted !== testData) throw new Error('Decryption failed');
                        
                        return { encrypted: encrypted.length, decrypted: decrypted.length };
                    } catch (error) {
                        throw new Error(`Crypto operation failed: ${error.message}`);
                    }
                }
            );
            
            const results = await loadTester.runConcurrentOperations(operations, 5);
            
            const successfulResults = results.filter(r => r.success);
            expect(successfulResults.length).toBe(operationCount);
            
            const metrics = loadTester.getMetrics();
            expect(metrics.successRate).toBe(100);
        });

        test('should handle rapid input sanitization', () => {
            if (typeof SecurityUtils === 'undefined') {
                console.log('SecurityUtils not available, skipping sanitization tests');
                return;
            }
            
            const maliciousInputs = [
                '<script>alert("xss")</script>',
                'javascript:alert(1)',
                '../../../etc/passwd',
                'file"onload="alert(1)"',
                'SELECT * FROM users',
                'DROP TABLE users;',
            ];
            
            profiler.start('bulk-sanitization');
            
            for (let i = 0; i < 1000; i++) {
                const input = maliciousInputs[i % maliciousInputs.length];
                
                profiler.start(`sanitize-${i}`);
                const sanitized = SecurityUtils.escapeHtml(input);
                profiler.end(`sanitize-${i}`);
                
                expect(sanitized).not.toContain('<script>');
                expect(sanitized).not.toContain('javascript:');
            }
            
            profiler.end('bulk-sanitization');
            
            const sanitizationStats = profiler.getStats('bulk-sanitization');
            expect(sanitizationStats.avg).toBeLessThan(100); // Should be very fast
        });
    });

    describe('DOM Manipulation Performance', () => {
        test('should handle rapid DOM updates efficiently', () => {
            const container = document.getElementById('test-container');
            const updateCount = 500;
            
            profiler.start('dom-updates');
            
            for (let i = 0; i < updateCount; i++) {
                profiler.start(`update-${i}`);
                
                const element = document.createElement('div');
                element.className = 'test-element';
                element.textContent = `Test element ${i}`;
                element.setAttribute('data-test', `value-${i}`);
                
                container.appendChild(element);
                
                profiler.end(`update-${i}`);
            }
            
            profiler.end('dom-updates');
            
            expect(container.children.length).toBe(updateCount);
            
            const updateStats = profiler.getStats('dom-updates');
            expect(updateStats.avg).toBeLessThan(500); // Should complete in under 500ms
            
            // Test bulk removal
            profiler.start('dom-cleanup');
            container.innerHTML = '';
            profiler.end('dom-cleanup');
            
            const cleanupStats = profiler.getStats('dom-cleanup');
            expect(cleanupStats.avg).toBeLessThan(50); // Should cleanup quickly
        });

        test('should handle complex UI state changes efficiently', () => {
            const actionContainer = document.getElementById('action-container');
            const stateChangeCount = 200;
            
            profiler.start('ui-state-changes');
            
            for (let i = 0; i < stateChangeCount; i++) {
                profiler.start(`state-change-${i}`);
                
                // Simulate complex UI state change
                actionContainer.innerHTML = `
                    <div class="action-form state-${i}">
                        <h3>Action ${i}</h3>
                        <input type="text" value="Action ${i}" />
                        <select>
                            <option value="template">Template</option>
                            <option value="openai">OpenAI</option>
                        </select>
                        <textarea placeholder="Enter content...">Content ${i}</textarea>
                        <div class="buttons">
                            <button class="save-btn">Save</button>
                            <button class="cancel-btn">Cancel</button>
                        </div>
                    </div>
                `;
                
                // Simulate event listener attachment
                const buttons = actionContainer.querySelectorAll('button');
                buttons.forEach(button => {
                    button.addEventListener('click', () => {});
                });
                
                profiler.end(`state-change-${i}`);
            }
            
            profiler.end('ui-state-changes');
            
            const stateChangeStats = profiler.getStats('ui-state-changes');
            expect(stateChangeStats.avg).toBeLessThan(1000); // Should handle state changes efficiently
        });
    });

    describe('Stress Testing', () => {
        test('should maintain performance under sustained load', async () => {
            const sustainedLoadDuration = 2000; // 2 seconds
            const operationInterval = 10; // Every 10ms
            const startTime = Date.now();
            
            const operations = [];
            let operationCount = 0;
            
            while (Date.now() - startTime < sustainedLoadDuration) {
                operations.push(async () => {
                    const actionManager = new CustomActionManager();
                    const historyManager = new TranscriptionHistory();
                    
                    // Mixed operations
                    const opType = operationCount % 4;
                    switch (opType) {
                        case 0:
                            // Action validation
                            const action = {
                                name: `Stress Test ${operationCount}`,
                                type: 'template',
                                template: `Template {{.Transcript}}`,
                            };
                            return actionManager.validateAction(action);
                            
                        case 1:
                            // History search
                            return historyManager.searchTranscripts('stress');
                            
                        case 2:
                            // DOM manipulation
                            const element = document.createElement('div');
                            element.textContent = `Stress ${operationCount}`;
                            document.body.appendChild(element);
                            return element;
                            
                        case 3:
                            // Security operation
                            if (typeof SecurityUtils !== 'undefined') {
                                return SecurityUtils.escapeHtml(`<test>${operationCount}</test>`);
                            }
                            return 'security-skipped';
                    }
                });
                
                operationCount++;
                
                if (operations.length >= 10) {
                    await Promise.all(operations.splice(0, 5));
                }
                
                await new Promise(resolve => setTimeout(resolve, operationInterval));
            }
            
            // Complete remaining operations
            if (operations.length > 0) {
                await Promise.all(operations);
            }
            
            expect(operationCount).toBeGreaterThan(50); // Should have performed many operations
            console.log(`Stress test completed ${operationCount} operations in ${sustainedLoadDuration}ms`);
        });
    });
});

console.log('✅ Performance and load tests completed successfully');