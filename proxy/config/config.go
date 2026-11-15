// Package config gom toan bo cau hinh runtime cua proxy MITM B1sTeam LocketGold (Free).
//
// Moi tuy chon deu doc tu bien moi truong (Fly.io secrets / .env) de co the doi
// cau hinh ma khong can build lai binary.
//
// B1sTeam — b1s.id.vn · Nguyen Hoang Bach
package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// VERSION la phien ban hien tai cua proxy (dong bo voi fly.toml / README).
const VERSION = "4.0.0"

// ServiceName la ten service dung cho /health va log.
const ServiceName = "b1steam-locketgold"

// DefaultSANS la danh sach host mac dinh duoc phep MITM.
//
// Day cung la danh sach SAN se nhung vao leaf certificate. Day la "allow-list"
// (chong abuse): proxy CHI gia lap chung thich cho cac host nay, host khac bi
// tu choi ngay o tang TLS.
var DefaultSANS = []string{
	"api.revenuecat.com",
	"api.rc-backup.com",
	"rev.cat",
	"firebaseremoteconfig.googleapis.com",
	"firebaseremoteconfig.google.com",
	"www.remoteconfig.googleapis.com",
	"firebaseremoteconfigrealtime.googleapis.com",
	"api.locketcamera.com",
	"cdn.locketcamera.com",
	"public.locketcamera.com",
	"locket.camera",
	"us-central1-locket-4252a.cloudfunctions.net",
	"firebasestorage.googleapis.com",
	"storage.googleapis.com",
	"firebaselogging.googleapis.com",
}

// Config la snapshot cua cau hinh hien tai.
type Config struct {
	Version string
	Service string

	// Port la port TLS (MITM) — Fly.io map 443 -> 8443.
	Port string
	// StaticPort la port HTTP phuc vu landing page + .mobileconfig.
	StaticPort string
	// FlyIP la public IP cua may Fly (dung cho DNS/DoH va trang thai).
	FlyIP string
	// DoHURL la endpoint DoH gan vao payload DNS cua .mobileconfig.
	DoHURL string

	// AllowedHosts la allow-list MITM (dong thoi la danh sach SAN cua leaf cert).
	AllowedHosts []string
	// FrameWorkers la danh sach Cloudflare Worker phuc vu frame (round-robin).
	FrameWorkers []string
	// FrameDrawWorker la worker VE KHUNG (photon WASM) — locket-photon style.
	FrameDrawWorker string
	// FrameDrawKey la shared secret giua MITM proxy va worker ve khung.
	FrameDrawKey    string

	// Rate limit theo IP (token bucket).
	MITMBurst        int
	MITMRefillPerMin int
	StaticBurst      int
	StaticRefillPerMin int

	// UpstreamWorkers la so ket noi upstream toi da song song.
	UpstreamWorkers     int
	MaxIdleConnsPerHost int

	// Cert cache.
	CertCacheMax int
	CertCacheTTL time.Duration
	// FrameHealthTTL la thoi gian cache trang thai health cua worker (60s).
	FrameHealthTTL time.Duration

	LogLevel string

	// Duong dan fallback cho Root CA tren dia.
	CAFile    string
	CAKeyFile string
	// Duong dan .mobileconfig da sinh san (neu ton tai thi serve luon).
	MobileConfigPath string
	// Duong dan README.txt phuc vu o static server.
	ReadmePath string
}

// Load doc cau hinh tu moi truong. Khong bao gio return nil.
func Load() *Config {
	cfg := &Config{
		Version:     VERSION,
		Service:     ServiceName,
		Port:        envString("PORT", "8443"),
		StaticPort:  envString("STATIC_PORT", "8080"),
		FlyIP:       envString("FLY_IP", ""),
		DoHURL:      envString("DOH_URL", "https://doh.b1s.id.vn/fly/dns-query"),
		AllowedHosts: parseHostList(envString("MITM_SANS", ""), DefaultSANS),
		FrameWorkers: parseHostList(envString("FRAME_WORKERS", ""), DefaultFrameWorkers()),
		FrameDrawWorker: envString("FRAME_DRAW_WORKER", "https://b1steam-frame-raw.nhb-120111.workers.dev"),
		FrameDrawKey:    envString("FRAME_DRAW_KEY", ""),

		MITMBurst:         envInt("RATE_MITM_BURST", 100),
		MITMRefillPerMin:  envInt("RATE_MITM_REFILL_PER_MIN", 60),
		StaticBurst:       envInt("RATE_STATIC_BURST", 20),
		StaticRefillPerMin: envInt("RATE_STATIC_REFILL_PER_MIN", 15),

		UpstreamWorkers:     envInt("UPSTREAM_WORKERS", 32),
		MaxIdleConnsPerHost: envInt("MAX_IDLE_CONNS_PER_HOST", 16),

		CertCacheMax:   envInt("CERT_CACHE_MAX", 256),
		CertCacheTTL:   time.Duration(envInt("CERT_CACHE_TTL_HOURS", 24)) * time.Hour,
		FrameHealthTTL: time.Duration(envInt("FRAME_HEALTH_TTL_SEC", 60)) * time.Second,

		LogLevel: envString("LOG_LEVEL", "info"),

		CAFile:          envString("ROOT_CA_FILE", "ca/root-ca.crt"),
		CAKeyFile:       envString("ROOT_CA_KEY_FILE", "ca/root-ca.key"),
		MobileConfigPath: envString("MOBILECONFIG_PATH", "mobileconfig/B1sTeam-LocketGold.mobileconfig"),
		ReadmePath:      envString("README_PATH", "README.md"),
	}
	return cfg
}

// DefaultFrameWorkers tra ve danh sach worker Cloudflare mac dinh cua B1sTeam.
//
// Worker moi phai phuc vu:
//   GET /frames  -> catalog frame (JSON)
//   GET /f/:id   -> anh cua frame
//   GET /health  -> kiem tra suc khoe
func DefaultFrameWorkers() []string {
	out := make([]string, 0, 6)
	for i := 1; i <= 6; i++ {
		out = append(out, "https://b1steam-frames-"+strconv.Itoa(i)+".nhb-120111.workers.dev")
	}
	return out
}

// IsAllowedHost kiem tra host co nam trong allow-list MITM hay khong.
//
// So sanh khong phan biet hoa thuong, bo dau "." cuoi. KHONG dung wildcard:
// chi dung chinh xac cac host da khai bao (anti-abuse).
func (c *Config) IsAllowedHost(host string) bool {
	h := NormalizeHost(host)
	if h == "" {
		return false
	}
	for _, allowed := range c.AllowedHosts {
		if NormalizeHost(allowed) == h {
			return true
		}
	}
	return false
}

// NormalizeHost chuan hoa host: lowercase + bo dau "." cuoi.
func NormalizeHost(host string) string {
	h := strings.ToLower(strings.TrimSpace(host))
	h = strings.TrimSuffix(h, ".")
	return h
}

// envString tra gia tri bien moi truong, fallback ve def neu rong.
func envString(key, def string) string {
	if v, ok := os.LookupEnv(key); ok {
		if trimmed := strings.TrimSpace(v); trimmed != "" {
			return trimmed
		}
	}
	return def
}

// envInt tra gia tri bien moi truong dang int, fallback ve def neu khong hop le.
func envInt(key string, def int) int {
	raw, ok := os.LookupEnv(key)
	if !ok {
		return def
	}
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return def
	}
	return n
}

// parseHostList tach danh sach host tu chuoi tach dau phay, bo rong, bo trung.
func parseHostList(raw string, def []string) []string {
	if strings.TrimSpace(raw) == "" {
		return append([]string(nil), def...)
	}
	seen := make(map[string]bool)
	out := make([]string, 0, 16)
	for _, part := range strings.Split(raw, ",") {
		item := NormalizeHost(part)
		if item == "" || seen[item] {
			continue
		}
		seen[item] = true
		out = append(out, item)
	}
	if len(out) == 0 {
		return append([]string(nil), def...)
	}
	return out
}
