package middleware

import (
	"net/http"
	"sync"
	"time"
)

type RateLimiter struct {
	mu       sync.RWMutex
	clients  map[string]*client
	requests int
	window   time.Duration
}

type client struct {
	requests  int
	resetTime time.Time
}

func NewRateLimiter(requests int, window time.Duration) *RateLimiter {
	limiter := &RateLimiter{
		clients:  make(map[string]*client),
		requests: requests,
		window:   window,
	}
	
	// Cleanup goroutine
	go limiter.cleanup()
	
	return limiter
}

func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, clientData := range rl.clients {
			if now.After(clientData.resetTime) {
				delete(rl.clients, ip)
			}
		}
		rl.mu.Unlock()
	}
}

func (rl *RateLimiter) RateLimit() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := getClientIP(r)
			
			rl.mu.Lock()
			clientData, exists := rl.clients[ip]
			now := time.Now()
			
			if !exists || now.After(clientData.resetTime) {
				rl.clients[ip] = &client{
					requests:  1,
					resetTime: now.Add(rl.window),
				}
			} else {
				clientData.requests++
				if clientData.requests > rl.requests {
					rl.mu.Unlock()
					http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
					return
				}
			}
			rl.mu.Unlock()
			
			next.ServeHTTP(w, r)
		})
	}
}

func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header (for reverse proxies)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return xff
	}
	
	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	
	// Fall back to RemoteAddr
	return r.RemoteAddr
}