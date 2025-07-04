package middleware

import (
	"log/slog"
	"net/http"
	"time"
)

func RequestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			rw := NewResponseWriter(w)

			// Add request ID for tracing
			requestID := r.Header.Get("X-Request-ID")
			if requestID == "" {
				requestID = generateRequestID()
			}

			// Add request ID to response headers
			rw.Header().Set("X-Request-ID", requestID)

			// Create logger with request context
			reqLogger := logger.With(
				"request_id", requestID,
				"method", r.Method,
				"path", r.URL.Path,
				"remote_addr", r.RemoteAddr,
				"user_agent", r.UserAgent(),
			)

			// Log request start
			reqLogger.Info("request started")

			next.ServeHTTP(rw, r.WithContext(r.Context()))

			// Log request completion
			duration := time.Since(start)
			reqLogger.Info("request completed",
				"status_code", rw.StatusCode(),
				"duration_ms", duration.Milliseconds(),
				"response_size", rw.Size(),
			)
		})
	}
}

func generateRequestID() string {
	return time.Now().Format("20060102150405") + "-" + randomString(8)
}

func randomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(b)
}
