/**
 * Virtual Scroller Performance Test Suite
 * Validates performance improvements for large datasets
 */

describe('Virtual Scroller Performance Tests', () => {
    let container;
    let virtualScroller;
    let mockItems;
    
    beforeEach(() => {
        // Setup container
        container = document.createElement('div');
        container.style.height = '400px';
        container.style.width = '600px';
        document.body.appendChild(container);
        
        // Generate mock data
        mockItems = Array.from({ length: 10000 }, (_, i) => ({
            id: `item-${i}`,
            filename: `file-${i}.mp3`,
            transcript: `This is transcript ${i} with some content that might be longer to test performance with realistic data sizes. `.repeat(3),
            timestamp: Date.now() - (i * 1000),
            fileType: i % 2 === 0 ? 'audio' : 'video',
            fileSize: Math.random() * 100000000,
            characterCount: 150 + i,
            starred: i % 10 === 0
        }));
    });
    
    afterEach(() => {
        if (virtualScroller) {
            virtualScroller.destroy();
        }
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });
    
    describe('Initialization Performance', () => {
        test('should initialize virtual scroller quickly', () => {
            const startTime = performance.now();
            
            virtualScroller = new VirtualScroller(container, {
                itemHeight: 120,
                bufferSize: 5
            });
            
            const endTime = performance.now();
            const initTime = endTime - startTime;
            
            expect(initTime).toBeLessThan(50); // Should initialize in <50ms
            expect(container.children.length).toBe(3); // spacerTop, viewport, spacerBottom
        });
        
        test('should handle large dataset initialization efficiently', () => {
            virtualScroller = new VirtualScroller(container);
            
            const startTime = performance.now();
            
            virtualScroller.setItems(mockItems, (item) => {
                const element = document.createElement('div');
                element.textContent = item.filename;
                element.style.height = '120px';
                return element;
            });
            
            const endTime = performance.now();
            const setItemsTime = endTime - startTime;
            
            expect(setItemsTime).toBeLessThan(100); // Should handle 10k items in <100ms
        });
    });
    
    describe('Rendering Performance', () => {
        beforeEach(() => {
            virtualScroller = new VirtualScroller(container, {
                itemHeight: 120,
                bufferSize: 3
            });
        });
        
        test('should render initial view quickly', () => {
            const startTime = performance.now();
            
            virtualScroller.setItems(mockItems.slice(0, 1000), (item) => {
                const element = document.createElement('div');
                element.innerHTML = `
                    <div>${item.filename}</div>
                    <div>${item.transcript.substring(0, 100)}</div>
                `;
                element.style.height = '120px';
                return element;
            });
            
            const endTime = performance.now();
            const renderTime = endTime - startTime;
            
            expect(renderTime).toBeLessThan(50); // Initial render <50ms
            
            // Should only render visible items + buffer
            const viewport = container.querySelector('div:nth-child(2)');
            const renderedItems = viewport.children.length;
            
            expect(renderedItems).toBeLessThan(20); // Should render much less than 1000 items
            expect(renderedItems).toBeGreaterThan(0);
        });
        
        test('should handle scrolling efficiently', () => {
            virtualScroller.setItems(mockItems, (item) => {
                const element = document.createElement('div');
                element.textContent = item.filename;
                element.style.height = '120px';
                return element;
            });
            
            const scrollTimes = [];
            
            // Test multiple scroll operations
            for (let i = 0; i < 10; i++) {
                const startTime = performance.now();
                
                container.scrollTop = i * 500;
                virtualScroller.handleScroll();
                
                const endTime = performance.now();
                scrollTimes.push(endTime - startTime);
            }
            
            const avgScrollTime = scrollTimes.reduce((a, b) => a + b, 0) / scrollTimes.length;
            expect(avgScrollTime).toBeLessThan(16); // Should be faster than 60fps (16.67ms)
        });
        
        test('should maintain constant memory usage regardless of dataset size', () => {
            if (!window.performance.memory) {
                console.log('Memory API not available, skipping memory test');
                return;
            }
            
            const initialMemory = window.performance.memory.usedJSHeapSize;
            
            // Test with small dataset
            virtualScroller.setItems(mockItems.slice(0, 100), (item) => {
                const element = document.createElement('div');
                element.textContent = item.filename;
                return element;
            });
            
            const smallDatasetMemory = window.performance.memory.usedJSHeapSize;
            
            // Test with large dataset
            virtualScroller.setItems(mockItems, (item) => {
                const element = document.createElement('div');
                element.textContent = item.filename;
                return element;
            });
            
            const largeDatasetMemory = window.performance.memory.usedJSHeapSize;
            
            // Memory usage should be similar regardless of dataset size
            const memoryDifference = largeDatasetMemory - smallDatasetMemory;
            expect(memoryDifference).toBeLessThan(5 * 1024 * 1024); // Less than 5MB difference
        });
    });
    
    describe('Scrolling Performance', () => {
        beforeEach(() => {
            virtualScroller = new VirtualScroller(container, {
                itemHeight: 120,
                bufferSize: 3
            });
            
            virtualScroller.setItems(mockItems, (item) => {
                const element = document.createElement('div');
                element.innerHTML = `
                    <div class="item-title">${item.filename}</div>
                    <div class="item-content">${item.transcript.substring(0, 200)}</div>
                `;
                element.style.height = '120px';
                return element;
            });
        });
        
        test('should handle rapid scrolling without performance degradation', () => {
            const scrollTimes = [];
            const scrollPositions = Array.from({ length: 50 }, (_, i) => i * 200);
            
            scrollPositions.forEach(position => {
                const startTime = performance.now();
                
                container.scrollTop = position;
                virtualScroller.handleScroll();
                
                const endTime = performance.now();
                scrollTimes.push(endTime - startTime);
            });
            
            const maxScrollTime = Math.max(...scrollTimes);
            const avgScrollTime = scrollTimes.reduce((a, b) => a + b, 0) / scrollTimes.length;
            
            expect(maxScrollTime).toBeLessThan(30); // No single scroll should take >30ms
            expect(avgScrollTime).toBeLessThan(10); // Average should be <10ms
        });
        
        test('should scroll to specific item efficiently', () => {
            const testIndices = [0, 1000, 5000, 9999];
            
            testIndices.forEach(index => {
                const startTime = performance.now();
                
                virtualScroller.scrollToItem(index);
                
                const endTime = performance.now();
                const scrollTime = endTime - startTime;
                
                expect(scrollTime).toBeLessThan(20); // Should scroll to any item in <20ms
                
                // Verify the item is in the visible range
                const visibleRange = virtualScroller.getVisibleRange();
                expect(index).toBeGreaterThanOrEqual(visibleRange.start - 3); // Account for buffer
                expect(index).toBeLessThanOrEqual(visibleRange.end + 3);
            });
        });
    });
    
    describe('Memory Management', () => {
        beforeEach(() => {
            virtualScroller = new VirtualScroller(container);
        });
        
        test('should not create memory leaks during extensive scrolling', () => {
            if (!window.performance.memory) {
                console.log('Memory API not available, skipping memory leak test');
                return;
            }
            
            virtualScroller.setItems(mockItems, (item) => {
                const element = document.createElement('div');
                element.innerHTML = `<div>${item.filename}</div><div>${item.transcript}</div>`;
                return element;
            });
            
            const initialMemory = window.performance.memory.usedJSHeapSize;
            
            // Simulate extensive scrolling
            for (let i = 0; i < 100; i++) {
                container.scrollTop = Math.random() * (mockItems.length * 120);
                virtualScroller.handleScroll();
            }
            
            // Force garbage collection if available
            if (window.gc) {
                window.gc();
            }
            
            const finalMemory = window.performance.memory.usedJSHeapSize;
            const memoryIncrease = finalMemory - initialMemory;
            
            // Memory increase should be minimal (less than 10MB)
            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
        });
        
        test('should properly cleanup when destroyed', () => {
            virtualScroller.setItems(mockItems.slice(0, 100), (item) => {
                const element = document.createElement('div');
                element.textContent = item.filename;
                return element;
            });
            
            // Verify content exists
            expect(container.children.length).toBeGreaterThan(0);
            
            // Destroy and verify cleanup
            virtualScroller.destroy();
            expect(container.innerHTML).toBe('');
        });
    });
    
    describe('Performance Comparison', () => {
        test('should significantly outperform traditional rendering for large datasets', () => {
            const items = mockItems.slice(0, 1000);
            
            // Test traditional rendering
            const traditionalStart = performance.now();
            const traditionalContainer = document.createElement('div');
            items.forEach(item => {
                const element = document.createElement('div');
                element.innerHTML = `
                    <div>${item.filename}</div>
                    <div>${item.transcript.substring(0, 200)}</div>
                `;
                element.style.height = '120px';
                traditionalContainer.appendChild(element);
            });
            const traditionalEnd = performance.now();
            const traditionalTime = traditionalEnd - traditionalStart;
            
            // Test virtual scrolling
            const virtualStart = performance.now();
            virtualScroller = new VirtualScroller(container);
            virtualScroller.setItems(items, (item) => {
                const element = document.createElement('div');
                element.innerHTML = `
                    <div>${item.filename}</div>
                    <div>${item.transcript.substring(0, 200)}</div>
                `;
                element.style.height = '120px';
                return element;
            });
            const virtualEnd = performance.now();
            const virtualTime = virtualEnd - virtualStart;
            
            console.log(`Traditional rendering: ${traditionalTime.toFixed(2)}ms`);
            console.log(`Virtual scrolling: ${virtualTime.toFixed(2)}ms`);
            console.log(`Performance improvement: ${((traditionalTime - virtualTime) / traditionalTime * 100).toFixed(1)}%`);
            
            // Virtual scrolling should be significantly faster
            expect(virtualTime).toBeLessThan(traditionalTime * 0.1); // At least 90% faster
            
            // Virtual scrolling should render fewer DOM nodes
            const traditionalNodes = traditionalContainer.children.length;
            const virtualNodes = container.querySelectorAll('[style*="height"]').length;
            
            expect(virtualNodes).toBeLessThan(traditionalNodes * 0.1); // At least 90% fewer nodes
        });
    });
});

/**
 * Performance Benchmark Tests
 */
describe('Virtual Scroller Benchmarks', () => {
    const runBenchmark = (name, operation, iterations = 100) => {
        const times = [];
        
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            operation();
            const end = performance.now();
            times.push(end - start);
        }
        
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        
        console.log(`Benchmark ${name}:`);
        console.log(`  Average: ${avg.toFixed(2)}ms`);
        console.log(`  Min: ${min.toFixed(2)}ms`);
        console.log(`  Max: ${max.toFixed(2)}ms`);
        
        return { avg, min, max, times };
    };
    
    test('benchmark scroll performance', () => {
        const container = document.createElement('div');
        container.style.height = '400px';
        document.body.appendChild(container);
        
        const virtualScroller = new VirtualScroller(container);
        const items = Array.from({ length: 5000 }, (_, i) => ({ id: i, text: `Item ${i}` }));
        
        virtualScroller.setItems(items, (item) => {
            const element = document.createElement('div');
            element.textContent = item.text;
            element.style.height = '120px';
            return element;
        });
        
        const results = runBenchmark('scroll-operations', () => {
            container.scrollTop = Math.random() * (items.length * 120);
            virtualScroller.handleScroll();
        }, 50);
        
        expect(results.avg).toBeLessThan(15); // Average scroll should be <15ms
        expect(results.max).toBeLessThan(50); // No scroll should take >50ms
        
        virtualScroller.destroy();
        document.body.removeChild(container);
    });
});