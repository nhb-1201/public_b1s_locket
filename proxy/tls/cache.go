package tlspkg

import (
	"crypto/tls"
	"errors"
	"strings"
	"sync"
)

type CertCache struct {
	ca    *CA
	mu    sync.RWMutex
	certs map[string]*tls.Certificate
}

// ponytail: getorge leaves for arbitrary SNI hostnames would turn this into a broad
// Internet MITM tool — the DNS layer restricts which domains route here, the allowlist
// restricts which ones the CA will sign. Keep these two in sync with the NextDNS rewrites.
func isAllowedForgeHost(host string) bool {
	h := strings.ToLower(strings.TrimSpace(host))
	if h == "" {
		return false
	}
	if h == "locketcamera.com" || strings.HasSuffix(h, ".locketcamera.com") {
		return true
	}
	if h == "locket.camera" || strings.HasSuffix(h, ".locket.camera") {
		return true
	}
	switch h {
	case "us-central1-locket-4252a.cloudfunctions.net",
		"firebaseremoteconfig.googleapis.com",
		"api.revenuecat.com",
		"api.rc-backup.com",
		"rev.cat":
		return true
	default:
		return false
	}
}

func NewCertCache(ca *CA) *CertCache {
	return &CertCache{
		ca:    ca,
		certs: make(map[string]*tls.Certificate),
	}
}

// ponytail: reset map on reaching 500 entries; avoid linked-list LRU overhead. Upgrade to full LRU if host diversity spikes.
func (c *CertCache) GetOrForge(host string) (*tls.Certificate, error) {
	if !isAllowedForgeHost(host) {
		return nil, errors.New("refusing to forge certificate for non-Locket host: " + host)
	}
	c.mu.RLock()
	cert, ok := c.certs[host]
	c.mu.RUnlock()
	if ok {
		return cert, nil
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	if cert, ok := c.certs[host]; ok {
		return cert, nil
	}

	if len(c.certs) >= 500 {
		c.certs = make(map[string]*tls.Certificate)
	}

	forged, err := c.ca.ForgeLeaf(host)
	if err != nil {
		return nil, err
	}
	c.certs[host] = forged
	return forged, nil
}
