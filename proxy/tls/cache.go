package tls

import (
	"crypto/tls"
	"errors"
	"sync"
	"time"
)

// DefaultCacheMax la so leaf certificate toi da giu trong RAM.
const DefaultCacheMax = 256

// DefaultCacheTTL la tuoi song toi da cua mot leaf certificate trong cache.
const DefaultCacheTTL = 24 * time.Hour

// cacheEntry la mot ban ghi trong cache.
type cacheEntry struct {
	cert     *tls.Certificate
	created  time.Time
	lastUsed time.Time
}

// CertCache la cache thread-safe cho leaf certificate (RWMutex + TTL + LRU-ish).
type CertCache struct {
	ca *CA

	mu    sync.RWMutex
	certs map[string]*cacheEntry

	max int
	ttl time.Duration

	// forgeLock tranh forge trung nhieu lan cho cung mot host.
	forgeLock sync.Mutex
}

// NewCertCache tao cache moi cho mot Root CA.
//
// max <= 0 -> DefaultCacheMax, ttl <= 0 -> DefaultCacheTTL.
func NewCertCache(ca *CA, max int, ttl time.Duration) *CertCache {
	if max <= 0 {
		max = DefaultCacheMax
	}
	if ttl <= 0 {
		ttl = DefaultCacheTTL
	}
	return &CertCache{
		ca:    ca,
		certs: make(map[string]*cacheEntry),
		max:   max,
		ttl:   ttl,
	}
}

// Get tra ve certificate da cache neu con hieu luc (TTL).
//
// Tra ve (nil, false) neu khong co hoac da het han.
func (c *CertCache) Get(host string) (*tls.Certificate, bool) {
	key := normalizeHost(host)
	if key == "" {
		return nil, false
	}
	now := time.Now()

	c.mu.Lock()
	entry, ok := c.certs[key]
	if !ok {
		c.mu.Unlock()
		return nil, false
	}
	if now.Sub(entry.created) > c.ttl {
		// het han -> xoa de giu cache sach
		delete(c.certs, key)
		c.mu.Unlock()
		return nil, false
	}
	entry.lastUsed = now
	cert := entry.cert
	c.mu.Unlock()
	return cert, true
}

// GetOrForge tra ve certificate cho host.
//
// Neu chua cache (hoac het han) se forge leaf moi bang Root CA.
// Loi forge KHONG duoc ghi vao cache.
func (c *CertCache) GetOrForge(host string) (*tls.Certificate, error) {
	key := normalizeHost(host)
	if key == "" {
		return nil, errors.New("B1sTeam: host rong, khong the cap leaf certificate")
	}
	if cert, ok := c.Get(key); ok {
		return cert, nil
	}

	c.forgeLock.Lock()
	defer c.forgeLock.Unlock()

	// double-check sau khi cho khoa (co the da co nguoi tao xong)
	if cert, ok := c.Get(key); ok {
		return cert, nil
	}

	if c.ca == nil {
		return nil, errors.New("B1sTeam: chua khoi tao Root CA")
	}

	forged, err := c.ca.ForgeLeaf(key)
	if err != nil {
		// KHONG cache loi.
		return nil, err
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now()
	c.evictLocked()
	c.certs[key] = &cacheEntry{cert: forged, created: now, lastUsed: now}
	return forged, nil
}

// evictLocked lo cac ban ghi cu nhat khi cache day.
func (c *CertCache) evictLocked() {
	if len(c.certs) < c.max {
		return
	}
	// Xoa ban ghi nhat (LRU-ish) cho den khi du cho mot entry moi.
	for len(c.certs) >= c.max {
		oldestKey := ""
		var oldest time.Time
		for k, v := range c.certs {
			if oldestKey == "" || v.lastUsed.Before(oldest) {
				oldestKey = k
				oldest = v.lastUsed
			}
		}
		if oldestKey == "" {
			return
		}
		delete(c.certs, oldestKey)
	}
}

// Len tra ve so leaf certificate dang cache.
func (c *CertCache) Len() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.certs)
}

// Purge xoa toan bo cache (dung khi can rotate Root CA).
func (c *CertCache) Purge() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.certs = make(map[string]*cacheEntry)
}
