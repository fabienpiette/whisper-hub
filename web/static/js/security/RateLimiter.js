/**
 * Rate Limiting Utilities
 * Focused on preventing abuse through request rate limiting
 */

class RateLimiter {
    /**
     * Check if operation is within rate limit
     * @param {string} key - Unique key for the operation
     * @param {number} maxRequests - Maximum requests allowed
     * @param {number} windowMs - Time window in milliseconds
     * @returns {boolean} - True if within rate limit
     */
    static checkRateLimit(key, maxRequests = 100, windowMs = 60000) {
        try {
            const now = Date.now();
            const storageKey = `rate_limit_${key}`;
            
            // Get existing data
            const existingData = localStorage.getItem(storageKey);
            let requestData = existingData ? JSON.parse(existingData) : { requests: [], window: now };
            
            // Clean old requests outside the window
            requestData.requests = requestData.requests.filter(timestamp => 
                (now - timestamp) < windowMs
            );
            
            // Check if limit exceeded
            if (requestData.requests.length >= maxRequests) {
                return false;
            }
            
            // Add current request
            requestData.requests.push(now);
            
            // Update storage
            localStorage.setItem(storageKey, JSON.stringify(requestData));
            
            return true;
        } catch (error) {
            console.warn('Rate limit check failed:', error.message);
            // Fail open - allow the request if checking fails
            return true;
        }
    }

    /**
     * Get remaining requests for a key
     * @param {string} key - Unique key for the operation
     * @param {number} maxRequests - Maximum requests allowed
     * @param {number} windowMs - Time window in milliseconds
     * @returns {number} - Remaining requests
     */
    static getRemainingRequests(key, maxRequests = 100, windowMs = 60000) {
        try {
            const now = Date.now();
            const storageKey = `rate_limit_${key}`;
            
            const existingData = localStorage.getItem(storageKey);
            if (!existingData) return maxRequests;
            
            const requestData = JSON.parse(existingData);
            
            // Clean old requests
            const validRequests = requestData.requests.filter(timestamp => 
                (now - timestamp) < windowMs
            );
            
            return Math.max(0, maxRequests - validRequests.length);
        } catch (error) {
            console.warn('Failed to get remaining requests:', error.message);
            return maxRequests;
        }
    }

    /**
     * Get time until rate limit resets
     * @param {string} key - Unique key for the operation
     * @param {number} windowMs - Time window in milliseconds
     * @returns {number} - Milliseconds until reset
     */
    static getResetTime(key, windowMs = 60000) {
        try {
            const now = Date.now();
            const storageKey = `rate_limit_${key}`;
            
            const existingData = localStorage.getItem(storageKey);
            if (!existingData) return 0;
            
            const requestData = JSON.parse(existingData);
            if (!requestData.requests.length) return 0;
            
            const oldestRequest = Math.min(...requestData.requests);
            const resetTime = oldestRequest + windowMs;
            
            return Math.max(0, resetTime - now);
        } catch (error) {
            console.warn('Failed to get reset time:', error.message);
            return 0;
        }
    }

    /**
     * Clear rate limit data for a key
     * @param {string} key - Unique key for the operation
     */
    static clearRateLimit(key) {
        try {
            const storageKey = `rate_limit_${key}`;
            localStorage.removeItem(storageKey);
        } catch (error) {
            console.warn('Failed to clear rate limit:', error.message);
        }
    }

    /**
     * Create a rate-limited version of a function
     * @param {Function} fn - Function to rate limit
     * @param {string} key - Unique key for rate limiting
     * @param {number} maxRequests - Maximum requests allowed
     * @param {number} windowMs - Time window in milliseconds
     * @returns {Function} - Rate-limited function
     */
    static createRateLimitedFunction(fn, key, maxRequests = 100, windowMs = 60000) {
        return (...args) => {
            if (this.checkRateLimit(key, maxRequests, windowMs)) {
                return fn.apply(this, args);
            } else {
                const resetTime = this.getResetTime(key, windowMs);
                const error = new Error(`Rate limit exceeded. Try again in ${Math.ceil(resetTime / 1000)} seconds.`);
                error.rateLimited = true;
                error.resetTime = resetTime;
                throw error;
            }
        };
    }

    /**
     * Create a rate-limited async function
     * @param {Function} asyncFn - Async function to rate limit
     * @param {string} key - Unique key for rate limiting
     * @param {number} maxRequests - Maximum requests allowed
     * @param {number} windowMs - Time window in milliseconds
     * @returns {Function} - Rate-limited async function
     */
    static createRateLimitedAsyncFunction(asyncFn, key, maxRequests = 100, windowMs = 60000) {
        return async (...args) => {
            if (this.checkRateLimit(key, maxRequests, windowMs)) {
                return await asyncFn.apply(this, args);
            } else {
                const resetTime = this.getResetTime(key, windowMs);
                const error = new Error(`Rate limit exceeded. Try again in ${Math.ceil(resetTime / 1000)} seconds.`);
                error.rateLimited = true;
                error.resetTime = resetTime;
                throw error;
            }
        };
    }

    /**
     * Implement exponential backoff rate limiting
     * @param {string} key - Unique key for the operation
     * @param {number} attempt - Current attempt number
     * @param {number} baseDelayMs - Base delay in milliseconds
     * @param {number} maxDelayMs - Maximum delay in milliseconds
     * @returns {Promise} - Promise that resolves after backoff delay
     */
    static async exponentialBackoff(key, attempt, baseDelayMs = 1000, maxDelayMs = 30000) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
        const actualDelay = delay + jitter;
        
        return new Promise(resolve => setTimeout(resolve, actualDelay));
    }

    /**
     * Check if IP address (or identifier) is rate limited
     * @param {string} identifier - IP address or unique identifier
     * @param {number} maxRequests - Maximum requests allowed
     * @param {number} windowMs - Time window in milliseconds
     * @returns {boolean} - True if within rate limit
     */
    static checkIPRateLimit(identifier, maxRequests = 100, windowMs = 60000) {
        const key = `ip_${identifier}`;
        return this.checkRateLimit(key, maxRequests, windowMs);
    }

    /**
     * Implement sliding window rate limiting
     * @param {string} key - Unique key for the operation
     * @param {number} maxRequests - Maximum requests allowed
     * @param {number} windowMs - Time window in milliseconds
     * @returns {boolean} - True if within rate limit
     */
    static checkSlidingWindowRateLimit(key, maxRequests = 100, windowMs = 60000) {
        try {
            const now = Date.now();
            const storageKey = `sliding_${key}`;
            
            // Get or create bucket data
            const existingData = localStorage.getItem(storageKey);
            let bucketData = existingData ? JSON.parse(existingData) : {
                requests: 0,
                windowStart: now,
                previousRequests: 0,
                previousWindowStart: now - windowMs
            };
            
            // Check if we need to slide the window
            if (now - bucketData.windowStart >= windowMs) {
                bucketData.previousRequests = bucketData.requests;
                bucketData.previousWindowStart = bucketData.windowStart;
                bucketData.requests = 0;
                bucketData.windowStart = now;
            }
            
            // Calculate weighted request count
            const timeIntoCurrentWindow = now - bucketData.windowStart;
            const percentageOfCurrentWindow = timeIntoCurrentWindow / windowMs;
            const percentageOfPreviousWindow = 1 - percentageOfCurrentWindow;
            
            const weightedCount = 
                (bucketData.previousRequests * percentageOfPreviousWindow) +
                bucketData.requests;
            
            // Check limit
            if (weightedCount >= maxRequests) {
                return false;
            }
            
            // Increment current window
            bucketData.requests++;
            
            // Update storage
            localStorage.setItem(storageKey, JSON.stringify(bucketData));
            
            return true;
        } catch (error) {
            console.warn('Sliding window rate limit check failed:', error.message);
            return true;
        }
    }

    /**
     * Clean up old rate limit data
     * @param {number} olderThanMs - Remove data older than this many milliseconds
     */
    static cleanupOldData(olderThanMs = 3600000) { // 1 hour default
        try {
            const now = Date.now();
            const keysToRemove = [];
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('rate_limit_')) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        if (data && data.requests) {
                            const latestRequest = Math.max(...data.requests);
                            if (now - latestRequest > olderThanMs) {
                                keysToRemove.push(key);
                            }
                        }
                    } catch (error) {
                        // If we can't parse the data, mark it for removal
                        keysToRemove.push(key);
                    }
                }
            }
            
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (error) {
            console.warn('Failed to cleanup old rate limit data:', error.message);
        }
    }

    /**
     * Get rate limit status for a key
     * @param {string} key - Unique key for the operation
     * @param {number} maxRequests - Maximum requests allowed
     * @param {number} windowMs - Time window in milliseconds
     * @returns {Object} - Rate limit status
     */
    static getRateLimitStatus(key, maxRequests = 100, windowMs = 60000) {
        const remaining = this.getRemainingRequests(key, maxRequests, windowMs);
        const resetTime = this.getResetTime(key, windowMs);
        
        return {
            limit: maxRequests,
            remaining,
            used: maxRequests - remaining,
            resetTime,
            resetDate: new Date(Date.now() + resetTime),
            limited: remaining === 0
        };
    }
}

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RateLimiter;
} else if (typeof window !== 'undefined') {
    window.RateLimiter = RateLimiter;
}