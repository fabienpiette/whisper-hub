package middleware

import (
	"net/http"
	"strconv"
	"sync"
	"time"
)

type Metrics struct {
	mu               sync.RWMutex
	RequestsTotal    map[string]int64
	RequestsActive   int64
	ResponseTimes    map[string][]time.Duration
	Errors           map[string]int64
	// Privacy-safe history metrics (no content)
	HistoryFeature   map[string]int64 // enabled, disabled, cleared, exported
}

func NewMetrics() *Metrics {
	return &Metrics{
		RequestsTotal:  make(map[string]int64),
		ResponseTimes:  make(map[string][]time.Duration),
		Errors:         make(map[string]int64),
		HistoryFeature: make(map[string]int64),
	}
}

func (m *Metrics) GetStats() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	stats := map[string]interface{}{
		"requests_total":    m.RequestsTotal,
		"requests_active":   m.RequestsActive,
		"errors_total":      m.Errors,
		"history_feature":   m.HistoryFeature,
	}

	// Calculate average response times
	avgTimes := make(map[string]float64)
	for path, times := range m.ResponseTimes {
		if len(times) > 0 {
			var total time.Duration
			for _, t := range times {
				total += t
			}
			avgTimes[path] = float64(total.Milliseconds()) / float64(len(times))
		}
	}
	stats["avg_response_time_ms"] = avgTimes

	return stats
}

// TrackHistoryFeatureUsage tracks privacy-safe history feature usage
func (m *Metrics) TrackHistoryFeatureUsage(action string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.HistoryFeature[action]++
}

func (m *Metrics) RequestMetrics() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			path := r.URL.Path

			m.mu.Lock()
			m.RequestsTotal[path]++
			m.RequestsActive++
			m.mu.Unlock()

			rw := &responseWriter{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
			}

			next.ServeHTTP(rw, r)

			duration := time.Since(start)

			m.mu.Lock()
			m.RequestsActive--
			
			// Store response times (keep last 100 for averages)
			if len(m.ResponseTimes[path]) >= 100 {
				m.ResponseTimes[path] = m.ResponseTimes[path][1:]
			}
			m.ResponseTimes[path] = append(m.ResponseTimes[path], duration)

			// Track errors (4xx, 5xx)
			if rw.statusCode >= 400 {
				key := path + "_" + strconv.Itoa(rw.statusCode)
				m.Errors[key]++
			}
			m.mu.Unlock()
		})
	}
}