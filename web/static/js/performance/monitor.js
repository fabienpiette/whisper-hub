/**
 * Performance Monitor for Whisper Hub
 * Real-time performance tracking and optimization insights
 */

class PerformanceMonitor {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.showUI = options.showUI || false;
        this.thresholds = {
            slow: 100,
            critical: 500,
            ...options.thresholds
        };
        
        this.metrics = {
            operations: new Map(),
            memory: [],
            fps: [],
            userTiming: []
        };
        
        this.observers = new Map();
        this.ui = null;
        
        if (this.enabled) {
            this.init();
        }
    }
    
    init() {
        this.setupPerformanceObserver();
        this.setupMemoryMonitoring();
        this.setupFPSMonitoring();
        
        if (this.showUI) {
            this.createUI();
        }
        
        console.log('🚀 Performance Monitor initialized');
    }
    
    setupPerformanceObserver() {
        if (!window.PerformanceObserver) return;
        
        // Monitor user timing marks and measures
        const userTimingObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                this.recordUserTiming(entry);
            }
        });
        
        try {
            userTimingObserver.observe({ entryTypes: ['mark', 'measure'] });
            this.observers.set('userTiming', userTimingObserver);
        } catch (e) {
            console.warn('Performance Observer not supported for user timing');
        }
        
        // Monitor long tasks
        if ('longTask' in window.PerformanceObserver.supportedEntryTypes) {
            const longTaskObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.recordLongTask(entry);
                }
            });
            
            longTaskObserver.observe({ entryTypes: ['longtask'] });
            this.observers.set('longTask', longTaskObserver);
        }
    }
    
    setupMemoryMonitoring() {
        if (!window.performance.memory) return;
        
        setInterval(() => {
            const memory = window.performance.memory;
            this.metrics.memory.push({
                timestamp: Date.now(),
                used: memory.usedJSHeapSize,
                total: memory.totalJSHeapSize,
                limit: memory.jsHeapSizeLimit
            });
            
            // Keep only last 100 samples
            if (this.metrics.memory.length > 100) {
                this.metrics.memory.shift();
            }
            
            this.updateUI();
        }, 1000);
    }
    
    setupFPSMonitoring() {
        let frames = 0;
        let lastTime = performance.now();
        
        const measureFPS = (currentTime) => {
            frames++;
            
            if (currentTime >= lastTime + 1000) {
                const fps = Math.round((frames * 1000) / (currentTime - lastTime));
                
                this.metrics.fps.push({
                    timestamp: Date.now(),
                    fps: fps
                });
                
                // Keep only last 60 samples (1 minute)
                if (this.metrics.fps.length > 60) {
                    this.metrics.fps.shift();
                }
                
                frames = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(measureFPS);
        };
        
        requestAnimationFrame(measureFPS);
    }
    
    recordUserTiming(entry) {
        this.metrics.userTiming.push({
            name: entry.name,
            type: entry.entryType,
            startTime: entry.startTime,
            duration: entry.duration,
            timestamp: Date.now()
        });
        
        // Log slow operations
        if (entry.entryType === 'measure' && entry.duration > this.thresholds.slow) {
            const level = entry.duration > this.thresholds.critical ? 'error' : 'warn';
            console[level](`🐌 Slow operation: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
        }
    }
    
    recordLongTask(entry) {
        console.warn(`🔥 Long task detected: ${entry.duration.toFixed(2)}ms`);
        
        // Record long task
        this.metrics.operations.set(`longtask-${Date.now()}`, {
            name: 'Long Task',
            duration: entry.duration,
            startTime: entry.startTime,
            timestamp: Date.now()
        });
    }
    
    // Public API for measuring operations
    static mark(name) {
        if (performance.mark) {
            performance.mark(name);
        }
    }
    
    static measure(name, startMark, endMark) {
        if (performance.measure) {
            try {
                performance.measure(name, startMark, endMark);
            } catch (e) {
                console.warn(`Could not measure ${name}:`, e);
            }
        }
    }
    
    static async measureAsync(name, asyncOperation) {
        const startTime = performance.now();
        PerformanceMonitor.mark(`${name}-start`);
        
        try {
            const result = await asyncOperation();
            const endTime = performance.now();
            
            PerformanceMonitor.mark(`${name}-end`);
            PerformanceMonitor.measure(name, `${name}-start`, `${name}-end`);
            
            return result;
        } catch (error) {
            const endTime = performance.now();
            console.error(`Operation ${name} failed after ${endTime - startTime}ms:`, error);
            throw error;
        }
    }
    
    static measureSync(name, operation) {
        const startTime = performance.now();
        PerformanceMonitor.mark(`${name}-start`);
        
        try {
            const result = operation();
            
            PerformanceMonitor.mark(`${name}-end`);
            PerformanceMonitor.measure(name, `${name}-start`, `${name}-end`);
            
            return result;
        } catch (error) {
            const endTime = performance.now();
            console.error(`Operation ${name} failed after ${endTime - startTime}ms:`, error);
            throw error;
        }
    }
    
    createUI() {
        this.ui = document.createElement('div');
        this.ui.className = 'perf-monitor';
        this.ui.innerHTML = `
            <div class="perf-monitor-content">
                <div>FPS: <span id="fps-display">--</span></div>
                <div>Memory: <span id="memory-display">--</span></div>
                <div>Operations: <span id="ops-display">--</span></div>
            </div>
        `;
        
        // Add toggle functionality
        this.ui.addEventListener('dblclick', () => {
            this.ui.classList.toggle('hidden');
        });
        
        document.body.appendChild(this.ui);
    }
    
    updateUI() {
        if (!this.ui) return;
        
        // Update FPS
        const fpsDisplay = this.ui.querySelector('#fps-display');
        if (this.metrics.fps.length > 0) {
            const latestFPS = this.metrics.fps[this.metrics.fps.length - 1].fps;
            fpsDisplay.textContent = latestFPS;
            fpsDisplay.style.color = latestFPS < 30 ? '#ff4444' : latestFPS < 50 ? '#ffaa44' : '#44ff44';
        }
        
        // Update Memory
        const memoryDisplay = this.ui.querySelector('#memory-display');
        if (this.metrics.memory.length > 0) {
            const latest = this.metrics.memory[this.metrics.memory.length - 1];
            const usedMB = Math.round(latest.used / 1024 / 1024);
            memoryDisplay.textContent = `${usedMB}MB`;
            memoryDisplay.style.color = usedMB > 100 ? '#ff4444' : usedMB > 50 ? '#ffaa44' : '#44ff44';
        }
        
        // Update Operations Count
        const opsDisplay = this.ui.querySelector('#ops-display');
        opsDisplay.textContent = this.metrics.operations.size;
    }
    
    getReport() {
        const report = {
            timestamp: Date.now(),
            metrics: {
                operations: Array.from(this.metrics.operations.entries()),
                memory: this.metrics.memory.slice(-10), // Last 10 samples
                fps: this.metrics.fps.slice(-10), // Last 10 samples
                userTiming: this.metrics.userTiming.slice(-20) // Last 20 operations
            },
            performance: {
                navigation: performance.getEntriesByType('navigation')[0] || {},
                resources: performance.getEntriesByType('resource').length,
                marks: performance.getEntriesByType('mark').length,
                measures: performance.getEntriesByType('measure').length
            }
        };
        
        return report;
    }
    
    exportReport() {
        const report = this.getReport();
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `performance-report-${new Date().toISOString()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }
    
    clearMetrics() {
        this.metrics.operations.clear();
        this.metrics.memory.length = 0;
        this.metrics.fps.length = 0;
        this.metrics.userTiming.length = 0;
        
        // Clear performance entries
        if (performance.clearMarks) {
            performance.clearMarks();
        }
        if (performance.clearMeasures) {
            performance.clearMeasures();
        }
        
        console.log('🧹 Performance metrics cleared');
    }
    
    destroy() {
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
        
        if (this.ui) {
            this.ui.remove();
        }
        
        console.log('💀 Performance Monitor destroyed');
    }
}

/**
 * Performance Utilities for Common Operations
 */
class PerformanceUtils {
    static debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }
    
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    static batchDOMUpdates(updates) {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                const startTime = performance.now();
                
                updates.forEach(update => update());
                
                const endTime = performance.now();
                console.log(`Batched DOM updates took ${endTime - startTime}ms`);
                
                resolve();
            });
        });
    }
    
    static preloadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }
    
    static lazyLoad(elements, options = {}) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const element = entry.target;
                    const src = element.dataset.src;
                    
                    if (src) {
                        element.src = src;
                        element.classList.add('loaded');
                        observer.unobserve(element);
                    }
                }
            });
        }, {
            rootMargin: options.rootMargin || '50px',
            threshold: options.threshold || 0.1
        });
        
        elements.forEach(element => observer.observe(element));
        return observer;
    }
}

// Initialize global performance monitor
let globalPerfMonitor = null;

// Auto-initialize if in development mode
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    globalPerfMonitor = new PerformanceMonitor({
        enabled: true,
        showUI: true
    });
}

// Export for global use
window.PerformanceMonitor = PerformanceMonitor;
window.PerformanceUtils = PerformanceUtils;
window.perfMonitor = globalPerfMonitor;