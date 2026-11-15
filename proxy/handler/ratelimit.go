// Package handler chua cac logic sua noi dung response (RevenueCat, Firebase,
// Locket API, photobooth) + frame worker pool + rate limiter cho proxy B1sTeam.
//
// B1sTeam — b1s.id.vn · Nguyen Hoang Bach
package handler

import (
	"encoding/json"
	"net"
	"net/http"
	"sync"
	"time"
)

// Token bucket mac dinh (co the ghi de qua bien moi truong).
const (
	DefaultMITMBurst          = 100
	DefaultMITMRefillPerMin   = 60
	DefaultStaticBurst        = 20
	DefaultStaticRefillPerMin = 15

	// maxBuckets la tran so bucket duoc giu trong RAM.
	maxBuckets = 20000
	// bucketTTL la thoi gian khong dung thi bucket bi don.
	bucketTTL = 10 * time.Minute
)

// bucket la trang thai token bucket cua 1 IP.
type bucket struct {
	tokens float64
	last   time.Time
}

// Limiter la rate limiter token bucket theo IP, an toan trong RAM.
type Limiter struct {
	mu           sync.Mutex
	buckets      map[string]*bucket
	burst        float64
	refillPerSec float64
}

// NewLimiter tao limiter moi.
//
// burst        = so request "nong" cho phep ngay.
// refillPerMin = so token bo sung moi phut.
func NewLimiter(burst, refillPerMin int) *Limiter {
	if burst <= 0 {
		burst = 1
	}
	if refillPerMin <= 0 {
		refillPerMin = 1
	}
	return &Limiter{
		buckets:      make(map[string]*bucket),
		burst:        float64(burst),
		refillPerSec: float64(refillPerMin) / 60.0,
	}
}

// Allow tieu 1 token cho key.
//
// true  -> duoc phep di tiep.
// false -> het han (nen tra 429).
func (l *Limiter) Allow(key string) bool {
	now := time.Now()

	l.mu.Lock()
	defer l.mu.Unlock()

	l.sweepLocked(now)

	b, ok := l.buckets[key]
	if !ok {
		b = &bucket{tokens: l.burst, last: now}
		l.buckets[key] = b
	}

	if elapsed := now.Sub(b.last).Seconds(); elapsed > 0 {
		b.tokens += elapsed * l.refillPerSec
	}
	if b.tokens > l.burst {
		b.tokens = l.burst
	}
	b.last = now

	if b.tokens >= 1 {
		b.tokens--
		return true
	}
	return false
}

// Tokens tra ve so token con lai cua key (de debug/log).
func (l *Limiter) Tokens(key string) float64 {
	l.mu.Lock()
	defer l.mu.Unlock()
	b, ok := l.buckets[key]
	if !ok {
		return l.burst
	}
	return b.tokens
}

// sweepLocked don cac bucket khong con dung va gioi han so luong.
func (l *Limiter) sweepLocked(now time.Time) {
	for k, v := range l.buckets {
		if now.Sub(v.last) > bucketTTL {
			delete(l.buckets, k)
		}
	}
	if len(l.buckets) < maxBuckets {
		return
	}
	// Qua nhieu bucket -> xoa nhat mot nua.
	cutoff := now.Add(-2 * time.Minute)
	for k, v := range l.buckets {
		if v.last.Before(cutoff) {
			delete(l.buckets, k)
		}
	}
}

// ClientIP lay IP thật của client từ remote address.
//
// KHONG tin X-Forwarded-For (spoof duoc) — dung remote address cua connection.
func ClientIP(remoteAddr string) string {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err == nil {
		return host
	}
	return remoteAddr
}

// WriteRateLimited tra 429 + JSON body.
func WriteRateLimited(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Retry-After", "60")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusTooManyRequests)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":      false,
		"error":   "rate_limited",
		"message": "B1sTeam: qua gioi han truy cap, thu lai sau 60 giay.",
		"service": "b1steam-locketgold",
	})
}

// Middleware bao phu handler bang rate limit theo IP.
func (l *Limiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !l.Allow(ClientIP(r.RemoteAddr)) {
			WriteRateLimited(w)
			return
		}
		next.ServeHTTP(w, r)
	})
}
