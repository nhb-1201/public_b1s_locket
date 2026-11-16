package handler

import (
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

//go:embed frames_manifest.json
var manifestJSON []byte

// DefaultHealthTTL la thoi gian cache trang thai health cua worker (60 giay).
const DefaultHealthTTL = 60 * time.Second

// Frame la mo khung trong catalog B1sTeam.
type Frame struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Group      string   `json:"group"`
	File       string   `json:"file"`
	URL        string   `json:"url"`
	WorkerPath string   `json:"worker_path"`
	Width      int      `json:"width"`
	Height     int      `json:"height"`
	Premium    bool     `json:"premium"`
	Tags       []string `json:"tags"`
}

// FrameCatalog la noi dung cua frames_manifest.json.
type FrameCatalog struct {
	Version string  `json:"version"`
	Updated string  `json:"updated"`
	Brand   string  `json:"brand"`
	Frames  []Frame `json:"frames"`
}

var (
	manifestOnce   sync.Once
	manifestCache  *FrameCatalog
	manifestErr    error
)

// ManifestJSON tra ve noi dung file frames_manifest.json (embed trong binary).
func ManifestJSON() []byte {
	return manifestJSON
}

// Manifest tra ve catalog frame da parse (cache trong RAM).
func Manifest() (*FrameCatalog, error) {
	manifestOnce.Do(loadManifest)
	return manifestCache, manifestErr
}

// loadManifest parse frames_manifest.json mot lan duy nhat.
func loadManifest() {
	catalog := &FrameCatalog{}
	if err := json.Unmarshal(manifestJSON, catalog); err != nil {
		manifestCache = &FrameCatalog{}
		manifestErr = err
		return
	}
	manifestCache = catalog
	manifestErr = nil
}

// FrameWorker la mot Cloudflare Worker phuc vu frame.
type FrameWorker struct {
	// BaseURL la goc URL cua worker (vd https://b1steam-frames-1.nhb-120111.workers.dev).
	BaseURL string
	// Host la host dung cho request upstream.
	Host string

	healthy   bool
	checkedAt time.Time
	failures  int
}

// FramePool la pool worker frame xoay vong (round-robin) + cache health.
type FramePool struct {
	mu        sync.Mutex
	workers   []*FrameWorker
	idx       int
	healthTTL time.Duration
	client    *http.Client
}

// NewFramePool tao pool worker moi.
//
// bases: danh sach base URL (co the rong -> pool rong).
// healthTTL: thoi gian cache trang thai health (mac dinh 60s).
func NewFramePool(bases []string, healthTTL time.Duration) *FramePool {
	if healthTTL <= 0 {
		healthTTL = DefaultHealthTTL
	}
	pool := &FramePool{
		healthTTL: healthTTL,
		client: &http.Client{
			Timeout: 8 * time.Second,
		},
	}
	for _, base := range bases {
		clean := strings.TrimSpace(base)
		if clean == "" {
			continue
		}
		if !strings.HasPrefix(clean, "http://") && !strings.HasPrefix(clean, "https://") {
			clean = "https://" + clean
		}
		clean = strings.TrimRight(clean, "/")
		host := ""
		if parsed, err := url.Parse(clean); err == nil {
			host = parsed.Host
		}
		if host == "" {
			continue
		}
		pool.workers = append(pool.workers, &FrameWorker{BaseURL: clean, Host: host})
	}
	return pool
}

// Len tra ve so worker trong pool.
func (p *FramePool) Len() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return len(p.workers)
}

// Workers tra ve danh sach base URL cua pool (de log/debug).
func (p *FramePool) Workers() []string {
	p.mu.Lock()
	defer p.mu.Unlock()
	out := make([]string, 0, len(p.workers))
	for _, w := range p.workers {
		out = append(out, w.BaseURL)
	}
	return out
}

// Next tra ve worker tiep theo theo round-robin, uu tien worker healthy.
//
// Worker co health cache cu (healthTTL) — het han thi thu lai.
func (p *FramePool) Next() *FrameWorker {
	p.mu.Lock()
	defer p.mu.Unlock()

	n := len(p.workers)
	if n == 0 {
		return nil
	}

	for i := 0; i < n; i++ {
		p.idx = (p.idx + 1) % n
		w := p.workers[p.idx]
		if p.healthyLocked(w) {
			return w
		}
	}

	// Khong worker nao healthy -> tra worker ke tiep (optimistic, se fallback
	// ve worker khac neu request fail).
	p.idx = (p.idx + 1) % n
	return p.workers[p.idx]
}

// healthyLocked kiem tra worker co healthy khong (dung cache 60s).
func (p *FramePool) healthyLocked(w *FrameWorker) bool {
	if w.checkedAt.IsZero() {
		return true
	}
	if time.Since(w.checkedAt) > p.healthTTL {
		// het han cache -> gia lai co the thu lai worker nay
		return true
	}
	return w.healthy
}

// MarkHealthy danh dau worker hoat dong (reset so lan loi).
func (p *FramePool) MarkHealthy(w *FrameWorker) {
	if w == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	w.healthy = true
	w.checkedAt = time.Now()
	w.failures = 0
}

// MarkFailure danh dau worker loi (tam loai ra trong khoang healthTTL).
func (p *FramePool) MarkFailure(w *FrameWorker) {
	if w == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	w.healthy = false
	w.checkedAt = time.Now()
	w.failures++
}

// CheckHealth kiem tra worker co phan hoi /health hay khong (co cache 60s).
func (p *FramePool) CheckHealth(ctx context.Context, w *FrameWorker) bool {
	if w == nil {
		return false
	}

	p.mu.Lock()
	fresh := !w.checkedAt.IsZero() && time.Since(w.checkedAt) <= p.healthTTL
	healthy := w.healthy
	p.mu.Unlock()

	if fresh {
		return healthy
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, w.BaseURL+"/health", nil)
	if err != nil {
		p.MarkFailure(w)
		return false
	}
	resp, err := p.client.Do(req)
	if err != nil {
		p.MarkFailure(w)
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 400 {
		p.MarkHealthy(w)
		return true
	}
	p.MarkFailure(w)
	return false
}

// FetchCatalog tai catalog frame tu worker (fallback qua tung worker).
func (p *FramePool) FetchCatalog(ctx context.Context) (*FrameCatalog, error) {
	if p.Len() == 0 {
		return nil, errors.New("B1sTeam: khong co worker frame nao")
	}

	var lastErr error
	for i := 0; i < p.Len(); i++ {
		w := p.Next()
		if w == nil {
			continue
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, w.BaseURL+"/frames", nil)
		if err != nil {
			lastErr = err
			p.MarkFailure(w)
			continue
		}
		resp, err := p.client.Do(req)
		if err != nil {
			lastErr = err
			p.MarkFailure(w)
			continue
		}
		body, readErr := readAllLimited(resp)
		resp.Body.Close()
		if readErr != nil || resp.StatusCode != http.StatusOK {
			p.MarkFailure(w)
			if readErr != nil {
				lastErr = readErr
			}
			continue
		}
		catalog := &FrameCatalog{}
		if err := json.Unmarshal(body, catalog); err != nil {
			p.MarkFailure(w)
			lastErr = err
			continue
		}
		p.MarkHealthy(w)
		return catalog, nil
	}

	if lastErr == nil {
		lastErr = errors.New("B1sTeam: khong tai duoc catalog frame")
	}
	return nil, lastErr
}

// FrameURL tra ve URL anh cua frame tren worker.
func (p *FramePool) FrameURL(w *FrameWorker, id string) string {
	if w == nil {
		return ""
	}
	return w.BaseURL + "/f/" + url.PathEscape(id)
}

// readAllLimited doc toi da 4MB tu response.
func readAllLimited(resp *http.Response) ([]byte, error) {
	const maxBytes = 4 << 20
	return io.ReadAll(io.LimitReader(resp.Body, maxBytes))
}
