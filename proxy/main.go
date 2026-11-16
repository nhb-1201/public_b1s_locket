// B1sTeam — LocketGold (Free) MITM proxy.
//
// Chay mot TLS listener (443 -> 8443) + mot HTTP static server (8080) de:
//   1. Intercept HTTPS cua Locket / RevenueCat / Firebase (chi host trong allow-list)
//   2. Inject entitlement Gold vĩnh viễn, mo khoa paywall, gỡ blur anh
//   3. Tra frame qua pool Cloudflare Worker (round-robin)
//   4. Phuc vu landing page + .mobileconfig de nguoi dung cai dat 1 cham
//
// B1sTeam — b1s.id.vn · Nguyen Hoang Bach
package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httputil"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/nhb-1201/public_b1s_locket/config"
	"github.com/nhb-1201/public_b1s_locket/handler"
	tlspkg "github.com/nhb-1201/public_b1s_locket/tls"
)

const (
	// maxRequestBytes la gioi han body request doc vao RAM (8MB).
	maxRequestBytes = 8 << 20
	// maxResponseBytes la gioi han body response doc vao RAM (16MB).
	maxResponseBytes = 16 << 20
)

// ctxKey la khoa context rieng (tranh trung voi key cua thu vien chuan).
type ctxKey string

// ctxKeyFilter luu thong tin filter cua request generateFilteredImage.
const ctxKeyFilter ctxKey = "b1s.filter.info"

// filterInfo la thong tin filter duoc rut tu body request.
type filterInfo struct {
	ID       string
	PhotoURL string
}

// proxyServer gom toan bo trang thai cua proxy.
type proxyServer struct {
	cfg    *config.Config
	log    *slog.Logger
	ca     *tlspkg.CA
	cache  *tlspkg.CertCache
	frames *handler.FramePool
	catalog *handler.FrameCatalog
	proxy  *httputil.ReverseProxy

	mitmLimiter   *handler.Limiter
	staticLimiter *handler.Limiter
	upstream      *upstreamLimiter

	startedAt time.Time
}

// upstreamLimiter gioi han so request upstream chay song song.
type upstreamLimiter struct {
	sem chan struct{}
}

// newUpstreamLimiter tao limiter voi dung luong cho truoc.
func newUpstreamLimiter(workers int) *upstreamLimiter {
	if workers <= 0 {
		workers = 1
	}
	return &upstreamLimiter{sem: make(chan struct{}, workers)}
}

// acquire cho qua khi co slot trong, tra false neu context bi huy.
func (u *upstreamLimiter) acquire(ctx context.Context) bool {
	select {
	case u.sem <- struct{}{}:
		return true
	case <-ctx.Done():
		return false
	}
}

// release tra slot ve pool.
func (u *upstreamLimiter) release() {
	select {
	case <-u.sem:
	default:
	}
}

func main() {
	cfg := config.Load()
	logger := newLogger(cfg.LogLevel)
	slog.SetDefault(logger)

	logger.Info("B1sTeam LocketGold proxy khoi dong",
		"version", cfg.Version,
		"port", cfg.Port,
		"static_port", cfg.StaticPort,
		"allowed_hosts", len(cfg.AllowedHosts),
		"frame_workers", len(cfg.FrameWorkers),
	)

	ca, err := loadRootCA(cfg)
	if err != nil {
		logger.Error("khong load duoc Root CA — dung chay khong the", "error", err)
		os.Exit(1)
	}
	ca.SetSANs(cfg.AllowedHosts)
	logger.Info("Root CA san sang", "subject", ca.Cert.Subject.String(), "sha256", ca.FingerprintSHA256())

	catalog, err := handler.Manifest()
	if err != nil {
		logger.Warn("khong doc duoc frames_manifest.json", "error", err)
		catalog = nil
	}

	srv := &proxyServer{
		cfg:           cfg,
		log:           logger,
		ca:            ca,
		cache:         tlspkg.NewCertCache(ca, cfg.CertCacheMax, cfg.CertCacheTTL),
		frames:        handler.NewFramePool(cfg.FrameWorkers, cfg.FrameHealthTTL),
		catalog:       catalog,
		mitmLimiter:   handler.NewLimiter(cfg.MITMBurst, cfg.MITMRefillPerMin),
		staticLimiter: handler.NewLimiter(cfg.StaticBurst, cfg.StaticRefillPerMin),
		upstream:      newUpstreamLimiter(cfg.UpstreamWorkers),
		startedAt:     time.Now(),
	}
	srv.proxy = srv.newReverseProxy()

	// --- MITM server (TLS) ---
	mitmSrv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           http.HandlerFunc(srv.handleMITM),
		TLSConfig:         srv.tlsConfig(),
		ReadHeaderTimeout: 15 * time.Second,
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      120 * time.Second,
		IdleTimeout:       120 * time.Second,
		ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelWarn),
	}

	mitmLn, err := net.Listen("tcp", mitmSrv.Addr)
	if err != nil {
		logger.Error("khong listen duoc MITM port", "addr", mitmSrv.Addr, "error", err)
		os.Exit(1)
	}
	tlsLn := tls.NewListener(mitmLn, mitmSrv.TLSConfig)

	go func() {
		if err := mitmSrv.Serve(tlsLn); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("MITM server dung", "error", err)
		}
	}()
	logger.Info("MITM TLS listener san sang", "addr", mitmSrv.Addr)

	// --- Static server (HTTP) ---
	staticSrv := srv.newStaticServer()
	staticLn, err := net.Listen("tcp", staticSrv.Addr)
	if err != nil {
		logger.Error("khong listen duoc static port", "addr", staticSrv.Addr, "error", err)
		os.Exit(1)
	}
	go func() {
		if err := staticSrv.Serve(staticLn); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("static server dung", "error", err)
		}
	}()
	logger.Info("static HTTP listener san sang", "addr", staticSrv.Addr)

	// --- Graceful shutdown ---
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	<-ctx.Done()
	logger.Info("nhan tin hieu dung — dang shutdown")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	if err := mitmSrv.Shutdown(shutdownCtx); err != nil {
		logger.Error("MITM shutdown loi", "error", err)
	}
	if err := staticSrv.Shutdown(shutdownCtx); err != nil {
		logger.Error("static shutdown loi", "error", err)
	}
	logger.Info("da dong ket, bye")
}

// newLogger tao structured logger (JSON) theo LOG_LEVEL.
func newLogger(level string) *slog.Logger {
	lvl := slog.LevelInfo
	raw := strings.ToLower(strings.TrimSpace(level))
	if raw != "" {
		if err := lvl.UnmarshalText([]byte(raw)); err != nil {
			lvl = slog.LevelInfo
		}
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: lvl}))
}

// loadRootCA load Root CA tu env (base64/PEM) roi fallback ve file tren dia.
//
// Khong tim thay Root CA -> fail loudly (khong chay khong co CA).
func loadRootCA(cfg *config.Config) (*tlspkg.CA, error) {
	crtEnv := strings.TrimSpace(os.Getenv("ROOT_CA_CRT"))
	keyEnv := strings.TrimSpace(os.Getenv("ROOT_CA_KEY"))

	if crtEnv != "" && keyEnv != "" {
		ca, err := tlspkg.LoadCA([]byte(crtEnv), []byte(keyEnv))
		if err != nil {
			return nil, fmt.Errorf("ROOT_CA_CRT/ROOT_CA_KEY khong hop le: %w", err)
		}
		return ca, nil
	}

	if crtEnv != "" || keyEnv != "" {
		return nil, errors.New("can ca ROOT_CA_CRT va ROOT_CA_KEY cung luc (hoac ca hai deu rong)")
	}

	crt, err := os.ReadFile(cfg.CAFile)
	if err != nil {
		return nil, fmt.Errorf("khong doc duoc %s (hay dat ROOT_CA_CRT/ROOT_CA_KEY): %w", cfg.CAFile, err)
	}
	key, err := os.ReadFile(cfg.CAKeyFile)
	if err != nil {
		return nil, fmt.Errorf("khong doc duoc %s (hay dat ROOT_CA_CRT/ROOT_CA_KEY): %w", cfg.CAKeyFile, err)
	}

	ca, err := tlspkg.LoadCA(crt, key)
	if err != nil {
		return nil, err
	}
	return ca, nil
}

// newReverseProxy tao reverse proxy voi Director + ModifyResponse.
func (s *proxyServer) newReverseProxy() *httputil.ReverseProxy {
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   20 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          200,
		MaxIdleConnsPerHost:   s.cfg.MaxIdleConnsPerHost,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 30 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	return &httputil.ReverseProxy{
		Director:       s.direct,
		ModifyResponse: s.modify,
		Transport:      transport,
		ErrorHandler:   s.proxyError,
		ErrorLog:       slog.NewLogLogger(s.log.Handler(), slog.LevelWarn),
	}
}

// direct chuan hoa request truoc khi gui len upstream.
func (s *proxyServer) direct(req *http.Request) {
	stripCacheHeaders(req.Header)

	// Ep vung US + thoi gian LA vao header va query — Locket chi mo filter/mic/
	// caption/video/frame o khu vuc US. (MITM Fly cua B1sTeam khop nhu the.)
	//
	// QUAN TRONG: không đụng media (signed URL → 403 nếu bị sửa query).
	if !isMediaPath(req.URL.Path) {
		req.Header.Set("X-App-Region", "US")
		req.Header.Set("X-Country-Code", "US")
		req.Header.Set("X-Device-Country", "US")
		req.Header.Set("X-Timezone", "America/Los_Angeles")
		req.Header.Set("Accept-Language", "en-US,en;q=0.9")

		// Ep query country_code/time_zone/language_code — Locket doc tu query.
		// Chi ep tren host RC/FC/Locket API (khong ep media CDN).
		hostLC := strings.ToLower(req.URL.Hostname())
		allow := strings.Contains(hostLC, "remoteconfig") || strings.Contains(hostLC, "locketcamera") || strings.Contains(hostLC, "cloudfunctions") || strings.Contains(hostLC, "revenuecat")
		if allow {
			q := req.URL.Query()
			q.Set("country_code", "US")
			q.Set("time_zone", "America/Los_Angeles")
			q.Set("language_code", "en")
			req.URL.RawQuery = q.Encode()
		}
	}

	// generateFilteredImage (non-overlay) — KHÔNG chuyển sang frame worker:
	// pass-through tới upstream thật (Google/Locket AI) rồi
	// modify() sẽ CleanFilterResponse (xoá lỗi, ép unlocked/200).

	if req.URL.Scheme == "" {
		req.URL.Scheme = "https"
	}
	if req.URL.Host == "" {
		req.URL.Host = req.Host
	}
}

// modify sua response theo tung host.
func (s *proxyServer) modify(resp *http.Response) error {
	req := resp.Request
	if req == nil {
		return nil
	}
	host := config.NormalizeHost(req.URL.Hostname())
	path := req.URL.Path

	// Response cua endpoint filter -> lam sach loi + ep 200.
	if _, ok := filterInfoFrom(req.Context()); ok {
		body, err := readAndClose(resp)
		if err != nil {
			return err
		}
		cleaned := handler.CleanFilterResponse(body)
		resp.StatusCode = http.StatusOK
		replaceBody(resp, cleaned)
		resp.Header.Set("Content-Type", "application/json; charset=utf-8")
		return nil
	}

	switch {
	case isFirebaseHost(host):
		body, err := readAndClose(resp)
		if err != nil {
			return err
		}
		out, err := handler.InjectFirebase(body, s.catalog, s.cfg.FrameWorkers)
		if err != nil {
			replaceBody(resp, body)
			return nil
		}
		replaceBody(resp, out)
		resp.Header.Set("Content-Type", "application/json; charset=utf-8")

	case isRevenueCatHost(host):
		body, err := readAndClose(resp)
		if err != nil {
			return err
		}
		out, err := handler.InjectRevenueCat(body)
		if err != nil {
			replaceBody(resp, body)
			return nil
		}
		replaceBody(resp, out)
		resp.Header.Set("Content-Type", "application/json; charset=utf-8")

	case isLocketHost(host):
		body, err := readAndClose(resp)
		if err != nil {
			return err
		}
		if handler.IsFeedOrFriendsEndpoint(path) {
			// Feed/bạn bè/moments: KHÔNG đụng vào — truyền nguyên văn
			// để app không bị vỡ decode (mất danh sách bạn bè).
			replaceBody(resp, body)
			return nil
		}
		// Ngoài feed/bạn bè: gỡ lỗi 400/402/403 → 200 + mở khóa Gold.
		switch resp.StatusCode {
		case http.StatusBadRequest, http.StatusPaymentRequired, http.StatusForbidden:
			resp.StatusCode = http.StatusOK
		}
		out := handler.RewriteLocketAPI(body)
		replaceBody(resp, out)
		resp.Header.Set("Content-Type", "application/json; charset=utf-8")
	}

	return nil
}

// proxyError tra 502 khi upstream loi.
func (s *proxyServer) proxyError(w http.ResponseWriter, r *http.Request, err error) {
	s.log.Warn("upstream loi", "host", r.Host, "path", r.URL.Path, "error", err)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusBadGateway)
	_, _ = w.Write([]byte(`{"ok":false,"error":"upstream_error","service":"b1steam-locketgold"}`))
}

// handleMITM xu ly request MITM (da qua TLS + rate limit).
func (s *proxyServer) handleMITM(w http.ResponseWriter, r *http.Request) {
	if !s.mitmLimiter.Allow(handler.ClientIP(r.RemoteAddr)) {
		handler.WriteRateLimited(w)
		return
	}

	switch r.URL.Path {
	case "/health", "/healthz":
		s.writeHealth(w)
		return
	case "/version":
		s.writeVersion(w)
		return
	}

	// changeProfileInfo -> luon 200 + badge Gold.
	if handler.IsChangeProfileInfo(r.URL.Path) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(handler.ChangeProfileInfoMockResponse())
		return
	}

	// generateFilteredImage -> mock khi la khung overlay / photobooth.
	if isGenerateFilteredImage(r.URL.Path) && r.Body != nil {
		body, err := io.ReadAll(io.LimitReader(r.Body, maxRequestBytes))
		if err != nil {
			s.log.Warn("doc body loi", "path", r.URL.Path, "error", err)
			r.Body = io.NopCloser(bytes.NewReader(nil))
		} else {
			r.Body = io.NopCloser(bytes.NewReader(body))
			photoURL, filterID := handler.ExtractPhotoURLAndFilterID(body)
			if photoURL != "" && handler.IsOverlayOrPhotoboothFilter(filterID) {
				// App store flow: resolve filter_id → frame URL từ RC → MITM Go composites
				// server-side (x/image + draw) → trả ảnh ĐÃ CÓ khung. Fallback: mock nếu lỗi.
				frameURL := handler.ResolveOverlayFrameURL(filterID)
				if frameURL != "" {
					if out, err := handler.BurnFrame(r.Context(), photoURL, frameURL); err == nil {
						w.Header().Set("Content-Type", "application/json; charset=utf-8")
						w.Header().Set("Content-Length", strconv.Itoa(len(out)))
						w.Header().Set("X-B1s-Frame-Source", "go-burn")
						w.WriteHeader(http.StatusOK)
						_, _ = w.Write(out)
						return
					} else {
						s.log.Warn("frame burn lỗi — fallback mock", "filter", filterID, "error", err)
					}
				}
				mock := handler.BuildMockFilterResponse(photoURL)
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				w.Header().Set("Content-Length", strconv.Itoa(len(mock)))
				w.Header().Set("X-B1s-Frame-Source", "client-composite")
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write(mock)
				return
			}
			r = r.WithContext(context.WithValue(r.Context(), ctxKeyFilter, &filterInfo{
				ID:       filterID,
				PhotoURL: photoURL,
			}))
		}
	}

	if !s.upstream.acquire(r.Context()) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte(`{"ok":false,"error":"upstream_busy","service":"b1steam-locketgold"}`))
		return
	}
	defer s.upstream.release()

	s.proxy.ServeHTTP(w, r)
}

// tlsConfig tao cau hinh TLS cho MITM (SNI -> leaf certificate).
func (s *proxyServer) tlsConfig() *tls.Config {
	cipherSuites := []uint16{
		tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
		tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
		tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
	}

	return &tls.Config{
		MinVersion:   tls.VersionTLS12,
		MaxVersion:   tls.VersionTLS13,
		CipherSuites: cipherSuites,
		NextProtos:   []string{"http/1.1"},
		GetConfigForClient: func(hello *tls.ClientHelloInfo) (*tls.Config, error) {
			host := config.NormalizeHost(hello.ServerName)
			if host == "" {
				// KHONG fallback sang host mac dinh — reject SNI rong.
				return nil, errors.New("B1sTeam MITM: thieu SNI, tu choi ket noi")
			}
			if !s.cfg.IsAllowedHost(host) {
				s.log.Warn("tu choi host ngoai allow-list", "sni", hello.ServerName)
				return nil, fmt.Errorf("B1sTeam MITM: host %q khong nam trong allow-list", host)
			}
			cert, err := s.cache.GetOrForge(host)
			if err != nil {
				s.log.Error("forge leaf that bai", "host", host, "error", err)
				return nil, err
			}
			return &tls.Config{
				Certificates: []tls.Certificate{*cert},
				MinVersion:   tls.VersionTLS12,
				MaxVersion:   tls.VersionTLS13,
				CipherSuites: cipherSuites,
				NextProtos:   []string{"http/1.1"},
			}, nil
		},
	}
}

// writeHealth tra JSON health.
func (s *proxyServer) writeHealth(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"ok":true,"service":"b1steam-locketgold","version":"` + s.cfg.Version + `"}`))
}

// writeVersion tra JSON thong tin version.
func (s *proxyServer) writeVersion(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)

	frames := 0
	if s.catalog != nil {
		frames = len(s.catalog.Frames)
	}
	payload := map[string]any{
		"ok":   true,
		"service":       s.cfg.Service,
		"version":       s.cfg.Version,
		"started_at":    s.startedAt.UTC().Format(time.RFC3339),
		"uptime_s":      int64(time.Since(s.startedAt).Seconds()),
		"allowed_hosts": s.cfg.AllowedHosts,
		"frame_workers": s.cfg.FrameWorkers,
		"frames":        frames,
		"cert_cache":    s.cache.Len(),
	}
	writeJSON(w, payload)
}

// filterInfoFrom lay thong tin filter tu context.
func filterInfoFrom(ctx context.Context) (*filterInfo, bool) {
	if ctx == nil {
		return nil, false
	}
	info, ok := ctx.Value(ctxKeyFilter).(*filterInfo)
	if !ok || info == nil {
		return nil, false
	}
	return info, true
}

// isFirebaseHost kiem tra host Remote Config cua Firebase.
func isFirebaseHost(host string) bool {
	return strings.HasPrefix(host, "firebaseremoteconfig.") ||
		strings.HasPrefix(host, "www.remoteconfig.") ||
		host == "remoteconfig.googleapis.com"
}

// isRevenueCatHost kiem tra host RevenueCat.
func isRevenueCatHost(host string) bool {
	return host == "api.revenuecat.com" ||
		host == "api.rc-backup.com" ||
		host == "rev.cat" ||
		strings.HasSuffix(host, ".revenuecat.com")
}

// isLocketHost kiem tra host API Locket.
func isLocketHost(host string) bool {
	return host == "locketcamera.com" || strings.HasSuffix(host, ".locketcamera.com") ||
		host == "locket.camera" || strings.HasSuffix(host, ".locket.camera")
}

// isGenerateFilteredImage kiem tra path generateFilteredImage.
func isGenerateFilteredImage(path string) bool {
	return strings.Contains(strings.ToLower(path), "generatefilteredimage")
}

// stripCacheHeaders bo cac header cache/etag (dam bao luon lay ban moi).
func stripCacheHeaders(h http.Header) {
	for _, key := range []string{
		"Accept-Encoding",
		"If-None-Match",
		"If-Modified-Since",
		"X-RevenueCat-ETag",
		"X-Goog-If-None-Match",
	} {
		h.Del(key)
	}
	for key := range h {
		switch strings.ToLower(key) {
		case "accept-encoding", "if-none-match", "if-modified-since", "x-revenuecat-etag", "x-goog-if-none-match":
			h.Del(key)
		}
	}
}

// isMediaPath kiem tra path co ket thuc bang duoi media (thinchoy/Image/Video/Audio).
// Media signed URL → khong duoc cham vao (giu nguyen query).
func isMediaPath(path string) bool {
	p := strings.ToLower(path)
	mediaExts := []string{
		".jpg", ".jpeg", ".jfif", ".png", ".webp", ".heic", ".heif", ".gif", ".bmp", ".tif", ".tiff",
		".mp4", ".mov", ".m4v", ".m3u8", ".ts", ".webm",
		".mp3", ".m4a", ".aac", ".wav", ".opus", ".flac",
	}
	for _, ext := range mediaExts {
		if strings.HasSuffix(p, ext) {
			return true
		}
	}
	return false
}

// readAndClose doc body response va dong no lai.
func readAndClose(resp *http.Response) ([]byte, error) {
	if resp.Body == nil {
		return nil, nil
	}
	defer resp.Body.Close()
	return io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
}

// replaceBody thay the body cua response + chinh lai length.
func replaceBody(resp *http.Response, body []byte) {
	resp.Body = io.NopCloser(bytes.NewReader(body))
	resp.ContentLength = int64(len(body))
	resp.Header.Set("Content-Length", strconv.Itoa(len(body)))
	resp.Header.Del("Content-Encoding")
	resp.Header.Del("Transfer-Encoding")
}
