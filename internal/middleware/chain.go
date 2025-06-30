package middleware

import (
	"log/slog"
	"net/http"
	"time"
)

// Chain represents a middleware chain builder
type Chain struct {
	middlewares []func(http.Handler) http.Handler
}

// NewChain creates a new middleware chain builder
func NewChain() *Chain {
	return &Chain{
		middlewares: make([]func(http.Handler) http.Handler, 0),
	}
}

// Use adds a middleware to the chain
func (c *Chain) Use(middleware func(http.Handler) http.Handler) *Chain {
	c.middlewares = append(c.middlewares, middleware)
	return c
}

// Security adds security headers middleware
func (c *Chain) Security(sm *SecurityMiddleware) *Chain {
	return c.Use(sm.SecurityHeaders)
}

// RateLimit adds rate limiting middleware
func (c *Chain) RateLimit(rl *RateLimiter) *Chain {
	return c.Use(rl.RateLimit())
}

// CORS adds CORS middleware
func (c *Chain) CORS() *Chain {
	return c.Use(CORS())
}

// Recovery adds panic recovery middleware
func (c *Chain) Recovery(logger *slog.Logger) *Chain {
	return c.Use(Recovery(logger))
}

// Logging adds request logging middleware
func (c *Chain) Logging(logger *slog.Logger) *Chain {
	return c.Use(RequestLogger(logger))
}

// Metrics adds metrics collection middleware
func (c *Chain) Metrics(m *Metrics) *Chain {
	return c.Use(m.RequestMetrics())
}

// CSRF adds CSRF protection middleware
func (c *Chain) CSRF(sm *SecurityMiddleware) *Chain {
	return c.Use(sm.CSRFProtection)
}

// Build applies all middlewares to the given handler
func (c *Chain) Build(handler http.Handler) http.Handler {
	// Apply middlewares in reverse order (last added, first executed)
	for i := len(c.middlewares) - 1; i >= 0; i-- {
		handler = c.middlewares[i](handler)
	}
	return handler
}

// ApplyToRouter applies all middlewares to a router
func (c *Chain) ApplyToRouter(router interface{}) {
	type middlewareUser interface {
		Use(func(http.Handler) http.Handler)
	}
	
	if r, ok := router.(middlewareUser); ok {
		for _, mw := range c.middlewares {
			r.Use(mw)
		}
	}
}

// ChainPresets provides common middleware chain configurations

// GlobalChain creates a standard global middleware chain
func GlobalChain(security *SecurityMiddleware, rateLimiter *RateLimiter, logger *slog.Logger, metrics *Metrics) *Chain {
	return NewChain().
		Security(security).
		RateLimit(rateLimiter).
		CORS().
		Recovery(logger).
		Logging(logger).
		Metrics(metrics)
}

// SecureChain creates a secure API middleware chain
func SecureChain(security *SecurityMiddleware, rateLimiter *RateLimiter, logger *slog.Logger) *Chain {
	return NewChain().
		Security(security).
		CSRF(security).
		RateLimit(rateLimiter).
		Recovery(logger).
		Logging(logger)
}

// PublicChain creates a basic middleware chain for public endpoints
func PublicChain(logger *slog.Logger, metrics *Metrics) *Chain {
	return NewChain().
		CORS().
		Recovery(logger).
		Logging(logger).
		Metrics(metrics)
}

// ConfigurableChainBuilder provides more complex configuration options
type ConfigurableChainBuilder struct {
	chain *Chain
}

// NewConfigurableChain creates a new configurable chain builder
func NewConfigurableChain() *ConfigurableChainBuilder {
	return &ConfigurableChainBuilder{
		chain: NewChain(),
	}
}

// WithSecurity adds security middleware with custom configuration
func (c *ConfigurableChainBuilder) WithSecurity(sm *SecurityMiddleware, enableCSRF bool) *ConfigurableChainBuilder {
	c.chain.Security(sm)
	if enableCSRF {
		c.chain.CSRF(sm)
	}
	return c
}

// WithRateLimit adds rate limiting with custom limits
func (c *ConfigurableChainBuilder) WithRateLimit(maxRequests int, window time.Duration) *ConfigurableChainBuilder {
	rl := NewRateLimiter(maxRequests, window)
	c.chain.RateLimit(rl)
	return c
}

// WithMonitoring adds logging and metrics
func (c *ConfigurableChainBuilder) WithMonitoring(logger *slog.Logger, metrics *Metrics) *ConfigurableChainBuilder {
	c.chain.Logging(logger).Metrics(metrics)
	return c
}

// WithCORS adds CORS support
func (c *ConfigurableChainBuilder) WithCORS() *ConfigurableChainBuilder {
	c.chain.CORS()
	return c
}

// WithRecovery adds panic recovery
func (c *ConfigurableChainBuilder) WithRecovery(logger *slog.Logger) *ConfigurableChainBuilder {
	c.chain.Recovery(logger)
	return c
}

// Build returns the configured chain
func (c *ConfigurableChainBuilder) Build() *Chain {
	return c.chain
}