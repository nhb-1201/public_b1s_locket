package main

// B1sTeam LocketGold (Free) â€” static HTTP server (:8080).
//
//   /                                  -> trang huong dan cai dat
//   /health, /healthz                  -> JSON health
//   /version                           -> JSON version
//   /B1sTeam-LocketGold.mobileconfig   -> há»“ sÆ¡ cÃ i Ä‘áº·t iOS (.mobileconfig)
//   /README.txt                        -> hÆ°á»›ng dáº«n dáº¡ng text
//   /robots.txt                        -> robots
//
// B1sTeam â€” b1s.id.vn Â· Nguyen Hoang Bach

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/nhb-1201/public_b1s_locket/config"
	"github.com/nhb-1201/public_b1s_locket/handler"
)

// newStaticServer tao HTTP server phuc vu landing page + .mobileconfig.
func (s *proxyServer) newStaticServer() *http.Server {
	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		s.writeHealth(w)
	})
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		s.writeHealth(w)
	})
	mux.HandleFunc("/version", func(w http.ResponseWriter, r *http.Request) {
		s.writeVersion(w)
	})

	mux.HandleFunc("/robots.txt", func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w)
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("User-agent: *\nDisallow: /\n"))
	})

	mux.HandleFunc("/README.txt", func(w http.ResponseWriter, r *http.Request) {
		if !s.staticLimiter.Allow(handler.ClientIP(r.RemoteAddr)) {
			writeStaticRateLimited(w)
			return
		}
		body, err := os.ReadFile(s.cfg.ReadmePath)
		if err != nil {
			body = []byte(fallbackReadme)
		}
		setSecurityHeaders(w)
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Cache-Control", "public, max-age=300")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(body)
	})

	mux.HandleFunc("/B1sTeam-LocketGold.mobileconfig", func(w http.ResponseWriter, r *http.Request) {
		if !s.staticLimiter.Allow(handler.ClientIP(r.RemoteAddr)) {
			writeStaticRateLimited(w)
			return
		}
		body, err := os.ReadFile(s.cfg.MobileConfigPath)
		if err != nil {
			// Chua co file san -> sinh luc runtime tu Root CA trong RAM.
			body = buildMobileConfig(s.ca.RootDER(), s.cfg.DoHURL, s.cfg.AllowedHosts)
		}
		setSecurityHeaders(w)
		w.Header().Set("Content-Type", "application/x-apple-aspen-config")
		w.Header().Set("Content-Disposition", `attachment; filename="B1sTeam-LocketGold.mobileconfig"`)
		w.Header().Set("Cache-Control", "public, max-age=3600")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(body)
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if !s.staticLimiter.Allow(handler.ClientIP(r.RemoteAddr)) {
			writeStaticRateLimited(w)
			return
		}
		setSecurityHeaders(w)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "public, max-age=60")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(landingPage(s.cfg)))
	})

	return &http.Server{
		Addr:              ":" + s.cfg.StaticPort,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		ErrorLog:          slog.NewLogLogger(s.log.Handler(), slog.LevelWarn),
	}
}

// setSecurityHeaders gan header bao mat chuan cho static server.
func setSecurityHeaders(w http.ResponseWriter) {
	h := w.Header()
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("X-Frame-Options", "DENY")
	h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
	h.Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
	h.Set("X-Permitted-Cross-Domain-Policies", "none")
	h.Set("X-Robots-Tag", "noindex, nofollow")
}

// writeJSON ghi JSON ra response.
func writeJSON(w http.ResponseWriter, payload map[string]any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(payload)
}

// writeStaticRateLimited tra 429 cho static server.
func writeStaticRateLimited(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Retry-After", "60")
	w.WriteHeader(http.StatusTooManyRequests)
	_, _ = w.Write([]byte(`{"ok":false,"error":"rate_limited","service":"b1steam-locketgold"}`))
}

// buildMobileConfig sinh ho so iOS .mobileconfig (plist XML).
//
// Payload 1: com.apple.security.root (Root CA, DER base64 xong 76 ky tu/dong).
// Payload 2: com.apple.dnsSettings.managed (DoH + SupplementalMatchDomains).
func buildMobileConfig(caDER []byte, dohURL string, domains []string) []byte {
	var b strings.Builder

	b.WriteString("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
	b.WriteString("<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n")
	b.WriteString("<plist version=\"1.0\">\n<dict>\n")
	b.WriteString("\t<key>PayloadContent</key>\n\t<array>\n")

	// --- Payload 1: Root CA ---
	b.WriteString("\t\t<dict>\n")
	b.WriteString("\t\t\t<key>PayloadCertificateFileName</key>\n\t\t\t<string>B1sTeam-Root-CA.cer</string>\n")
	b.WriteString("\t\t\t<key>PayloadContent</key>\n\t\t\t<data>\n")
	b.WriteString(wrapBase64(base64.StdEncoding.EncodeToString(caDER), 76))
	b.WriteString("\n\t\t\t</data>\n")
	b.WriteString("\t\t\t<key>PayloadDescription</key>\n\t\t\t<string>B1sTeam Root CA - proxy MITM Locket / RevenueCat / Firebase (Gold vinh vien).</string>\n")
	b.WriteString("\t\t\t<key>PayloadDisplayName</key>\n\t\t\t<string>B1sTeam Root CA</string>\n")
	b.WriteString("\t\t\t<key>PayloadEnabled</key>\n\t\t\t<true/>\n")
	b.WriteString("\t\t\t<key>PayloadIdentifier</key>\n\t\t\t<string>vn.b1steam.locketgold.rootca</string>\n")
	b.WriteString("\t\t\t<key>PayloadOrganization</key>\n\t\t\t<string>B1sTeam - b1s.id.vn</string>\n")
	b.WriteString("\t\t\t<key>PayloadType</key>\n\t\t\t<string>com.apple.security.root</string>\n")
	b.WriteString("\t\t\t<key>PayloadUUID</key>\n\t\t\t<string>" + newUUID() + "</string>\n")
	b.WriteString("\t\t\t<key>PayloadVersion</key>\n\t\t\t<integer>1</integer>\n")
	b.WriteString("\t\t</dict>\n")

	// --- Payload 2: DoH ---
	b.WriteString("\t\t<dict>\n")
	b.WriteString("\t\t\t<key>DNSSettings</key>\n\t\t\t<dict>\n")
	b.WriteString("\t\t\t\t<key>DNSProtocol</key>\n\t\t\t\t<string>HTTPS</string>\n")
	b.WriteString("\t\t\t\t<key>ServerURL</key>\n\t\t\t\t<string>" + xmlEscape(dohURL) + "</string>\n")
	b.WriteString("\t\t\t\t<key>SupplementalMatchDomains</key>\n\t\t\t\t<array>\n")
	for _, d := range domains {
		b.WriteString("\t\t\t\t\t<string>" + xmlEscape(d) + "</string>\n")
	}
	b.WriteString("\t\t\t\t</array>\n")
	b.WriteString("\t\t\t</dict>\n")
	b.WriteString("\t\t\t<key>PayloadDescription</key>\n\t\t\t<string>DoH cua B1sTeam cho Locket / Firebase / RevenueCat.</string>\n")
	b.WriteString("\t\t\t<key>PayloadDisplayName</key>\n\t\t\t<string>B1sTeam LocketGold - DoH</string>\n")
	b.WriteString("\t\t\t<key>PayloadIdentifier</key>\n\t\t\t<string>vn.b1steam.locketgold.dns</string>\n")
	b.WriteString("\t\t\t<key>PayloadOrganization</key>\n\t\t\t<string>B1sTeam - b1s.id.vn</string>\n")
	b.WriteString("\t\t\t<key>PayloadType</key>\n\t\t\t<string>com.apple.dnsSettings.managed</string>\n")
	b.WriteString("\t\t\t<key>PayloadUUID</key>\n\t\t\t<string>" + newUUID() + "</string>\n")
	b.WriteString("\t\t\t<key>PayloadVersion</key>\n\t\t\t<integer>1</integer>\n")
	b.WriteString("\t\t\t<key>ProhibitDisablement</key>\n\t\t\t<false/>\n")
	b.WriteString("\t\t</dict>\n")

	b.WriteString("\t</array>\n")
	b.WriteString("\t<key>PayloadDescription</key>\n\t<string>B1sTeam LocketGold (Free) - Gold vinh vien, cai 1 cham khong can Shadowrocket.</string>\n")
	b.WriteString("\t<key>PayloadDisplayName</key>\n\t<string>B1sTeam LocketGold (Free) - MITM + DoH</string>\n")
	b.WriteString("\t<key>PayloadIdentifier</key>\n\t<string>vn.b1steam.locketgold.profile</string>\n")
	b.WriteString("\t<key>PayloadOrganization</key>\n\t<string>B1sTeam - b1s.id.vn</string>\n")
	b.WriteString("\t<key>PayloadRemovalDisallowed</key>\n\t<false/>\n")
	b.WriteString("\t<key>PayloadScope</key>\n\t<string>System</string>\n")
	b.WriteString("\t<key>PayloadType</key>\n\t<string>Configuration</string>\n")
	b.WriteString("\t<key>PayloadUUID</key>\n\t<string>" + newUUID() + "</string>\n")
	b.WriteString("\t<key>PayloadVersion</key>\n\t<integer>1</integer>\n")
	b.WriteString("</dict>\n</plist>\n")

	return []byte(b.String())
}

// wrapBase64 ngat chuoi base64 thanh nhieu dong (mac dinh 76 ky tu/dong).
func wrapBase64(s string, width int) string {
	if width <= 0 {
		width = 76
	}
	var lines []string
	for len(s) > width {
		lines = append(lines, s[:width])
		s = s[width:]
	}
	if len(s) > 0 {
		lines = append(lines, s)
	}
	return strings.Join(lines, "\n")
}

// newUUID sinh UUID v4 (uppercase) cho PayloadUUID.
func newUUID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		// Fallback: UUID deterministic theo thoi gian (hiem xay ra).
		now := uint64(time.Now().UnixNano())
		for i := 0; i < 8; i++ {
			b[i] = byte(now >> (8 * i))
		}
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%X-%X-%X-%X-%X", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// xmlEscape escape ky tu dac biet cho XML.
func xmlEscape(s string) string {
	var buf strings.Builder
	_ = xml.EscapeText(&buf, []byte(s))
	return buf.String()
}

// landingPage tra ve trang huong dan nho gon.
func landingPage(cfg *config.Config) string {
	return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">` +
		`<meta name="viewport" content="width=device-width, initial-scale=1.0">` +
		`<title>B1sTeam LocketGold (Free)</title><meta name="color-scheme" content="light">` +
		`<meta name="referrer" content="no-referrer">` +
		`<style>body{margin:0;font:14px/1.6 system-ui;-webkit-text-size-adjust:100%;background:#0f1115;color:#f5f5f5}` +
		`main{max-width:680px;margin:0 auto;padding:24px 16px}` +
		`.btn{display:inline-flex;padding:12px 18px;border-radius:14px;background:#ffd166;color:#12321f;font-weight:800;text-decoration:none}` +
		`h1{font-size:1.5rem;margin:0 0 8px}.card{background:#181b22;border:1px solid #2a2f3a;border-radius:14px;padding:14px;margin:14px 0}` +
		`ol{padding-left:20px}.small{font-size:.85em;opacity:.75}code{background:#22262f;padding:2px 6px;border-radius:6px}</style></head>` +
		`<body><main><h1>B1sTeam LocketGold (Free)</h1>` +
		`<p class="small">Proxy MITM + DoH cho Locket &mdash; Gold vinh vien, khong can Shadowrocket, khong can jailbreak.</p>` +
		`<div class="card"><p><a class="btn" href="/B1sTeam-LocketGold.mobileconfig">&#11015;&#65039; Tai .mobileconfig</a></p>` +
		`<ol><li><strong>Tai</strong>: bam nut vang, Safari tu mo há»“ sÆ¡.</li>` +
		`<li><strong>Cai</strong>: Cai dat &rarr; Chung &rarr; Cai dat goc chung chi &rarr; bat <b>B1sTeam Root CA</b>.</li>` +
		`<li><strong>Cai lai Locket</strong>: xoa app, App Store tai lai.</li>` +
		`<li><strong>Mo Locket</strong>: thay badge Gold <span style="color:#ffd166">&#10022;</span>.</li></ol></div>` +
		`<div class="card"><p class="small">Server: <code>` + xmlEscape(cfg.FlyIP) + `</code> &middot; version <code>` + xmlEscape(cfg.Version) + `</code></p>` +
		`<p class="small">Huong dan day du: <a href="/README.txt">/README.txt</a> &middot; <a href="/healthz">/healthz</a> &middot; <a href="/version">/version</a></p></div>` +
		`<p class="small">Ho tro: Zalo 083.3399.553 &mdash; b1s.id.vn</p></main></body></html>`
}

// fallbackReadme la noi dung README.txt khi khong doc duoc file tren dia.
const fallbackReadme = `B1sTeam LocketGold (Free) - proxy MITM + DoH

1. Cai .mobileconfig: mo Safari vao /B1sTeam-LocketGold.mobileconfig
2. Cai dat > Chung > Cai dat goc chung chi > bat "B1sTeam Root CA"
3. Xoa app Locket, tai lai tu App Store
4. Mo Locket -> badge Gold xuat hien

Ho tro: Zalo 083.3399.553 - b1s.id.vn
`
