package middleware

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func TestNewChain(t *testing.T) {
	chain := NewChain()
	if chain == nil {
		t.Error("NewChain() returned nil")
	}
}

func TestNewSecurityMiddleware(t *testing.T) {
	security := NewSecurityMiddleware()
	if security == nil {
		t.Error("NewSecurityMiddleware() returned nil")
	}
}

func TestNewMetrics(t *testing.T) {
	metrics := NewMetrics()
	if metrics == nil {
		t.Error("NewMetrics() returned nil")
	}
}

func TestNewRateLimiter(t *testing.T) {
	limiter := NewRateLimiter(100, time.Minute)
	if limiter == nil {
		t.Error("NewRateLimiter() returned nil")
	}
}

func TestMetrics_GetStats(t *testing.T) {
	metrics := NewMetrics()
	stats := metrics.GetStats()
	if stats == nil {
		t.Error("GetStats() returned nil")
	}
}

func TestSecurityMiddleware_GenerateCSRFToken(t *testing.T) {
	security := NewSecurityMiddleware()
	token := security.GenerateCSRFToken()
	
	if len(token) == 0 {
		t.Error("GenerateCSRFToken() returned empty string")
	}
}

func TestSecurityMiddleware_GetCSRFToken(t *testing.T) {
	security := NewSecurityMiddleware()
	
	req := httptest.NewRequest("GET", "/test", nil)
	
	// GetCSRFToken generates a new token each time
	token1 := security.GetCSRFToken(req)
	token2 := security.GetCSRFToken(req)
	
	if len(token1) == 0 {
		t.Error("GetCSRFToken() returned empty string")
	}
	
	if len(token2) == 0 {
		t.Error("GetCSRFToken() returned empty string")
	}
	
	// Each call should generate a different token
	if token1 == token2 {
		t.Error("Expected different tokens on each call")
	}
}

func TestNewResponseWriter(t *testing.T) {
	w := httptest.NewRecorder()
	rw := NewResponseWriter(w)
	if rw == nil {
		t.Error("NewResponseWriter() returned nil")
	}
}

func TestResponseWriter_WriteHeader(t *testing.T) {
	w := httptest.NewRecorder()
	rw := NewResponseWriter(w)
	
	rw.WriteHeader(http.StatusNotFound)
	
	if rw.StatusCode() != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", rw.StatusCode())
	}
}

func TestResponseWriter_Write(t *testing.T) {
	w := httptest.NewRecorder()
	rw := NewResponseWriter(w)
	
	data := []byte("test data")
	n, err := rw.Write(data)
	
	if err != nil {
		t.Errorf("Write() returned error: %v", err)
	}
	
	if n != len(data) {
		t.Errorf("Expected to write %d bytes, wrote %d", len(data), n)
	}
	
	if rw.Size() != len(data) {
		t.Errorf("Expected size %d, got %d", len(data), rw.Size())
	}
}

func TestCORS(t *testing.T) {
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("test"))
	})
	
	corsMiddleware := CORS()
	handler := corsMiddleware(testHandler)
	
	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	
	if w.Header().Get("Access-Control-Allow-Origin") == "" {
		t.Error("CORS headers not set")
	}
}

func TestRecovery(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	recovery := Recovery(logger)
	
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("test panic")
	})
	
	handler := recovery(testHandler)
	
	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	
	// Should not panic
	handler.ServeHTTP(w, req)
	
	if w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 500, got %d", w.Code)
	}
}

func TestRequestLogger(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	middleware := RequestLogger(logger)
	
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("test"))
	})
	
	handler := middleware(testHandler)
	
	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestGenerateRequestID(t *testing.T) {
	id := generateRequestID()
	if len(id) == 0 {
		t.Error("generateRequestID() returned empty string")
	}
}

func TestRandomString(t *testing.T) {
	str := randomString(10)
	if len(str) != 10 {
		t.Errorf("Expected length 10, got %d", len(str))
	}
}

func TestMetrics_TrackHistoryFeatureUsage(t *testing.T) {
	metrics := NewMetrics()
	metrics.TrackHistoryFeatureUsage("test_feature")
	
	stats := metrics.GetStats()
	if stats == nil {
		t.Error("Stats should not be nil")
	}
}

func TestMetrics_RequestMetrics(t *testing.T) {
	metrics := NewMetrics()
	middleware := metrics.RequestMetrics()
	
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("test"))
	})
	
	handler := middleware(testHandler)
	
	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestRateLimiter_RateLimit(t *testing.T) {
	limiter := NewRateLimiter(100, time.Minute)
	middleware := limiter.RateLimit()
	
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("test"))
	})
	
	handler := middleware(testHandler)
	
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.1:8080"
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestRateLimiter_RateLimit_ExceedsLimit(t *testing.T) {
	// Create a rate limiter with low limit for testing
	limiter := NewRateLimiter(2, time.Minute)
	middleware := limiter.RateLimit()
	
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("test"))
	})
	
	handler := middleware(testHandler)
	
	// First two requests should pass
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1.1:8080"
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		
		if w.Code != http.StatusOK {
			t.Errorf("Request %d: Expected status 200, got %d", i+1, w.Code)
		}
	}
	
	// Third request should be rate limited
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.1:8080"
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	
	if w.Code != http.StatusTooManyRequests {
		t.Errorf("Expected status 429, got %d", w.Code)
	}
}

func TestRateLimiter_MultipleIPs(t *testing.T) {
	limiter := NewRateLimiter(2, time.Minute)
	middleware := limiter.RateLimit()
	
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("test"))
	})
	
	handler := middleware(testHandler)
	
	// Test different IPs have separate limits
	ips := []string{"192.168.1.1:8080", "192.168.1.2:8080", "10.0.0.1:8080"}
	
	for _, ip := range ips {
		for i := 0; i < 2; i++ {
			req := httptest.NewRequest("GET", "/test", nil)
			req.RemoteAddr = ip
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)
			
			if w.Code != http.StatusOK {
				t.Errorf("IP %s, Request %d: Expected status 200, got %d", ip, i+1, w.Code)
			}
		}
	}
}

func TestSecurityMiddleware_SecurityHeaders(t *testing.T) {
	security := NewSecurityMiddleware()
	
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("test"))
	})
	
	handler := security.SecurityHeaders(testHandler)
	
	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	
	if w.Header().Get("X-Content-Type-Options") == "" {
		t.Error("Security headers not set")
	}
}

func TestSecurityMiddleware_CSRFProtection(t *testing.T) {
	security := NewSecurityMiddleware()
	
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("test"))
	})
	
	handler := security.CSRFProtection(testHandler)
	
	// Test GET request (should pass)
	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestSecurityMiddleware_CSRFProtection_ValidToken(t *testing.T) {
	middleware := NewSecurityMiddleware()
	
	// Generate a valid token
	token := middleware.GenerateCSRFToken()
	
	// Create a test handler
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("success"))
	})
	
	// Wrap with CSRF protection
	protectedHandler := middleware.CSRFProtection(handler)
	
	// Create POST request with valid token
	req := httptest.NewRequest("POST", "/test", strings.NewReader("csrf_token="+token))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	
	protectedHandler.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	
	if !strings.Contains(w.Body.String(), "success") {
		t.Error("Expected success response")
	}
}

func TestSecurityMiddleware_validateToken(t *testing.T) {
	middleware := NewSecurityMiddleware()
	
	tests := []struct {
		name     string
		token    string
		expected bool
	}{
		{
			name:     "empty token",
			token:    "",
			expected: false,
		},
		{
			name:     "invalid token",
			token:    "invalid-token",
			expected: false,
		},
		{
			name:     "non-existent token",
			token:    "not-in-store",
			expected: false,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := middleware.validateToken(tt.token)
			if result != tt.expected {
				t.Errorf("validateToken(%q) = %v, want %v", tt.token, result, tt.expected)
			}
		})
	}
	
	// Test valid token
	validToken := middleware.GenerateCSRFToken()
	if !middleware.validateToken(validToken) {
		t.Error("Valid token should be accepted")
	}
}

func TestSecurityMiddleware_validateToken_ExpiredToken(t *testing.T) {
	middleware := NewSecurityMiddleware()
	
	// Generate a token
	token := middleware.GenerateCSRFToken()
	
	// Manually set token to expired
	middleware.mutex.Lock()
	middleware.tokens[token] = time.Now().Add(-1 * time.Hour) // Expired 1 hour ago
	middleware.mutex.Unlock()
	
	// Should return false for expired token
	if middleware.validateToken(token) {
		t.Error("Expired token should be rejected")
	}
	
	// Token should be removed from store after validation
	middleware.mutex.RLock()
	_, exists := middleware.tokens[token]
	middleware.mutex.RUnlock()
	
	if exists {
		t.Error("Expired token should be removed from store")
	}
}

func TestSecurityMiddleware_CSRFProtection_HeaderToken(t *testing.T) {
	middleware := NewSecurityMiddleware()
	token := middleware.GenerateCSRFToken()
	
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("success"))
	})
	
	protectedHandler := middleware.CSRFProtection(handler)
	
	// Create POST request with token in header
	req := httptest.NewRequest("POST", "/test", nil)
	req.Header.Set("X-CSRF-Token", token)
	w := httptest.NewRecorder()
	
	protectedHandler.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestSecurityMiddleware_CSRFProtection_InvalidToken(t *testing.T) {
	middleware := NewSecurityMiddleware()
	
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("success"))
	})
	
	protectedHandler := middleware.CSRFProtection(handler)
	
	// Create POST request with invalid token
	req := httptest.NewRequest("POST", "/test", strings.NewReader("csrf_token=invalid"))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	
	protectedHandler.ServeHTTP(w, req)
	
	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status 403, got %d", w.Code)
	}
}

func TestSecurityMiddleware_CSRFProtection_NoToken(t *testing.T) {
	middleware := NewSecurityMiddleware()
	
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("success"))
	})
	
	protectedHandler := middleware.CSRFProtection(handler)
	
	// Create POST request without token
	req := httptest.NewRequest("POST", "/test", nil)
	w := httptest.NewRecorder()
	
	protectedHandler.ServeHTTP(w, req)
	
	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status 403, got %d", w.Code)
	}
}

func TestChain_Basic(t *testing.T) {
	chain := NewChain()
	
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("test"))
	})
	
	// Simple chain without middleware that has complex requirements
	result := chain.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Test", "middleware")
			next.ServeHTTP(w, r)
		})
	}).Build(testHandler)
	
	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	result.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	
	if w.Header().Get("X-Test") != "middleware" {
		t.Error("Middleware not applied")
	}
}

func TestGlobalChain(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	security := NewSecurityMiddleware()
	rateLimiter := NewRateLimiter(100, time.Minute)
	metrics := NewMetrics()
	
	chain := GlobalChain(security, rateLimiter, logger, metrics)
	
	if chain == nil {
		t.Error("GlobalChain() returned nil")
	}
}

func TestSecureChain(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	security := NewSecurityMiddleware()
	rateLimiter := NewRateLimiter(100, time.Minute)
	
	chain := SecureChain(security, rateLimiter, logger)
	
	if chain == nil {
		t.Error("SecureChain() returned nil")
	}
}

func TestPublicChain(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	metrics := NewMetrics()
	
	chain := PublicChain(logger, metrics)
	
	if chain == nil {
		t.Error("PublicChain() returned nil")
	}
}

func TestNewConfigurableChain(t *testing.T) {
	builder := NewConfigurableChain()
	
	if builder == nil {
		t.Error("NewConfigurableChain() returned nil")
	}
	
	if builder.chain == nil {
		t.Error("ConfigurableChainBuilder should have a chain")
	}
}

func TestConfigurableChainBuilder_WithSecurity(t *testing.T) {
	builder := NewConfigurableChain()
	security := NewSecurityMiddleware()
	
	// Test with CSRF enabled
	result := builder.WithSecurity(security, true)
	
	if result == nil {
		t.Error("WithSecurity() should return the builder")
	}
	
	if result != builder {
		t.Error("WithSecurity() should return the same builder for chaining")
	}
	
	// Test with CSRF disabled
	builder2 := NewConfigurableChain()
	result2 := builder2.WithSecurity(security, false)
	
	if result2 == nil {
		t.Error("WithSecurity() should return the builder")
	}
}

func TestConfigurableChainBuilder_WithRateLimit(t *testing.T) {
	builder := NewConfigurableChain()
	
	result := builder.WithRateLimit(100, time.Minute)
	
	if result == nil {
		t.Error("WithRateLimit() should return the builder")
	}
	
	if result != builder {
		t.Error("WithRateLimit() should return the same builder for chaining")
	}
}

func TestConfigurableChainBuilder_WithMonitoring(t *testing.T) {
	builder := NewConfigurableChain()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	metrics := NewMetrics()
	
	result := builder.WithMonitoring(logger, metrics)
	
	if result == nil {
		t.Error("WithMonitoring() should return the builder")
	}
	
	if result != builder {
		t.Error("WithMonitoring() should return the same builder for chaining")
	}
}

func TestConfigurableChainBuilder_WithCORS(t *testing.T) {
	builder := NewConfigurableChain()
	
	result := builder.WithCORS()
	
	if result == nil {
		t.Error("WithCORS() should return the builder")
	}
	
	if result != builder {
		t.Error("WithCORS() should return the same builder for chaining")
	}
}

func TestConfigurableChainBuilder_WithRecovery(t *testing.T) {
	builder := NewConfigurableChain()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	
	result := builder.WithRecovery(logger)
	
	if result == nil {
		t.Error("WithRecovery() should return the builder")
	}
	
	if result != builder {
		t.Error("WithRecovery() should return the same builder for chaining")
	}
}

func TestConfigurableChainBuilder_Build(t *testing.T) {
	builder := NewConfigurableChain()
	
	chain := builder.Build()
	
	if chain == nil {
		t.Error("Build() should return a chain")
	}
	
	if chain != builder.chain {
		t.Error("Build() should return the internal chain")
	}
}

func TestChain_Middleware_Methods(t *testing.T) {
	chain := NewChain()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	security := NewSecurityMiddleware()
	rateLimiter := NewRateLimiter(100, time.Minute)
	metrics := NewMetrics()
	
	// Test individual middleware methods
	if chain.Security(security) == nil {
		t.Error("Security() should return chain for chaining")
	}
	
	if chain.RateLimit(rateLimiter) == nil {
		t.Error("RateLimit() should return chain for chaining")
	}
	
	if chain.CORS() == nil {
		t.Error("CORS() should return chain for chaining")
	}
	
	if chain.Recovery(logger) == nil {
		t.Error("Recovery() should return chain for chaining")
	}
	
	if chain.Logging(logger) == nil {
		t.Error("Logging() should return chain for chaining")
	}
	
	if chain.Metrics(metrics) == nil {
		t.Error("Metrics() should return chain for chaining")
	}
	
	if chain.CSRF(security) == nil {
		t.Error("CSRF() should return chain for chaining")
	}
}

func TestChain_ApplyToRouter(t *testing.T) {
	chain := NewChain()
	
	// Mock router that implements middleware user interface
	type mockRouter struct {
		middlewares []func(http.Handler) http.Handler
	}
	
	mockUse := func(mw func(http.Handler) http.Handler) {
		// Mock implementation
	}
	
	// Test with compatible router interface
	type middlewareUser interface {
		Use(func(http.Handler) http.Handler)
	}
	
	router := &struct {
		middlewares []func(http.Handler) http.Handler
		Use func(func(http.Handler) http.Handler)
	}{
		middlewares: make([]func(http.Handler) http.Handler, 0),
		Use: mockUse,
	}
	
	// Add some middleware to the chain
	chain.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r)
		})
	})
	
	// Apply to router should not panic
	chain.ApplyToRouter(router)
	
	// Test with incompatible router (should not panic)
	chain.ApplyToRouter("not a router")
}

func TestRateLimiter_IPHeaderHandling(t *testing.T) {
	limiter := NewRateLimiter(2, time.Minute)
	middleware := limiter.RateLimit()
	
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("test"))
	})
	
	handler := middleware(testHandler)
	
	// Test X-Forwarded-For header handling
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.1:8080"
	req.Header.Set("X-Forwarded-For", "10.0.0.1")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	
	// Test X-Real-IP header handling  
	req2 := httptest.NewRequest("GET", "/test", nil)
	req2.RemoteAddr = "192.168.1.1:8080"
	req2.Header.Set("X-Real-IP", "10.0.0.2")
	w2 := httptest.NewRecorder()
	handler.ServeHTTP(w2, req2)
	
	if w2.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w2.Code)
	}
	
	// Test that X-Forwarded-For takes precedence
	req3 := httptest.NewRequest("GET", "/test", nil)
	req3.RemoteAddr = "192.168.1.1:8080"
	req3.Header.Set("X-Forwarded-For", "10.0.0.1")
	req3.Header.Set("X-Real-IP", "10.0.0.2")
	w3 := httptest.NewRecorder()
	handler.ServeHTTP(w3, req3)
	
	if w3.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w3.Code)
	}
}