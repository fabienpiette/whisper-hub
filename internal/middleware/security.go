package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// SecurityMiddleware provides CSRF protection and security headers
type SecurityMiddleware struct {
	tokens map[string]time.Time
	mutex  sync.RWMutex
}

// NewSecurityMiddleware creates a new security middleware
func NewSecurityMiddleware() *SecurityMiddleware {
	sm := &SecurityMiddleware{
		tokens: make(map[string]time.Time),
	}
	
	// Start cleanup goroutine for expired tokens
	go sm.cleanupExpiredTokens()
	
	return sm
}

// CSRFProtection middleware for CSRF token validation
func (sm *SecurityMiddleware) CSRFProtection(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Only check CSRF for POST, PUT, DELETE requests
		if r.Method == "GET" || r.Method == "HEAD" || r.Method == "OPTIONS" {
			next.ServeHTTP(w, r)
			return
		}
		
		// Get token from form or header
		token := r.FormValue("csrf_token")
		if token == "" {
			token = r.Header.Get("X-CSRF-Token")
		}
		
		// Validate token
		if !sm.validateToken(token) {
			http.Error(w, "CSRF token validation failed", http.StatusForbidden)
			return
		}
		
		next.ServeHTTP(w, r)
	})
}

// SecurityHeaders middleware adds security headers
func (sm *SecurityMiddleware) SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Content Security Policy
		csp := "default-src 'self'; " +
			"script-src 'self' https://unpkg.com/htmx.org@1.9.10 'unsafe-inline'; " +
			"style-src 'self' 'unsafe-inline'; " +
			"connect-src 'self'; " +
			"img-src 'self' data:; " +
			"font-src 'self'; " +
			"object-src 'none'; " +
			"base-uri 'self'; " +
			"form-action 'self'"
		
		w.Header().Set("Content-Security-Policy", csp)
		
		// Other security headers
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		
		// HTTPS enforcement (only in production)
		if r.Header.Get("X-Forwarded-Proto") == "https" || r.TLS != nil {
			w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		
		next.ServeHTTP(w, r)
	})
}

// GenerateCSRFToken generates a new CSRF token
func (sm *SecurityMiddleware) GenerateCSRFToken() string {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		// Fallback to timestamp-based token if crypto/rand fails
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	
	token := hex.EncodeToString(bytes)
	
	sm.mutex.Lock()
	sm.tokens[token] = time.Now().Add(24 * time.Hour) // Token valid for 24 hours
	sm.mutex.Unlock()
	
	return token
}

// validateToken validates a CSRF token
func (sm *SecurityMiddleware) validateToken(token string) bool {
	if token == "" {
		return false
	}
	
	sm.mutex.RLock()
	expiry, exists := sm.tokens[token]
	sm.mutex.RUnlock()
	
	if !exists {
		return false
	}
	
	// Check if token is expired
	if time.Now().After(expiry) {
		sm.mutex.Lock()
		delete(sm.tokens, token)
		sm.mutex.Unlock()
		return false
	}
	
	return true
}

// GetCSRFToken returns a valid CSRF token for the session
func (sm *SecurityMiddleware) GetCSRFToken(r *http.Request) string {
	// In a real application, you might want to tie this to a session
	// For now, we'll generate a new token for each request
	return sm.GenerateCSRFToken()
}

// cleanupExpiredTokens removes expired tokens from memory
func (sm *SecurityMiddleware) cleanupExpiredTokens() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			now := time.Now()
			sm.mutex.Lock()
			for token, expiry := range sm.tokens {
				if now.After(expiry) {
					delete(sm.tokens, token)
				}
			}
			sm.mutex.Unlock()
		}
	}
}

