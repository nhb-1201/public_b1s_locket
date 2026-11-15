package main

// B1sTeam LocketGold (Free) — static HTTP server (:8080). MITM-only.
//
//   /health, /healthz                  -> JSON health
//   /version                           -> JSON version (toi thieu)
//   /B1sTeam-LocketGold.mobileconfig   -> ho so cai dat iOS (.mobileconfig)
//   /robots.txt                        -> robots (disallow all)
//   /                                  -> 302 -> https://b1s.id.vn/locketvip
//
// KHONG landing page, KHONG README, KHONG show IP.
// Moi huong dan cai dat nam o https://b1s.id.vn/locketvip.
// B1sTeam — b1s.id.vn · Nguyen Hoang Bach

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

	"github.com/nhb-1201/public_b1s_locket/handler"
)

// newStaticServer tao HTTP server TOI THIEU: chi .mobileconfig + health/version.
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

	mux.HandleFunc("/robots.txt", robotsHandler)

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
		setSecurityHeaders(w)
		w.Header().Set("Location", "https://b1s.id.vn/locketvip")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusFound)
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

// robotsHandler tra 404 im lang (khong index).
func robotsHandler(w http.ResponseWriter, r *http.Request) {
	setSecurityHeaders(w)
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("User-agent: *\nDisallow: /\n"))
}

// setSecurityHeaders gan header bao mat chuan cho static server.
func setSecurityHeaders(w http.ResponseWriter) {
	h := w.Header()
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("X-Frame-Options", "DENY")
	h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
	h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
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
// Payload 1: com.apple.security.root (Root CA, DER base64 wrap 76 ky tu/dong).
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
	b.WriteString("\t\t\t<key>PayloadDescription</key>\n\t\t\t<string>B1sTeam Root CA — proxy MITM Locket / RevenueCat / Firebase (Gold vinh vien).</string>\n")
	b.WriteString("\t\t\t<key>PayloadDisplayName</key>\n\t\t\t<string>B1sTeam Root CA</string>\n")
	b.WriteString("\t\t\t<key>PayloadEnabled</key>\n\t\t\t<true/>\n")
	b.WriteString("\t\t\t<key>PayloadIdentifier</key>\n\t\t\t<string>vn.b1steam.locketgold.rootca</string>\n")
	b.WriteString("\t\t\t<key>PayloadOrganization</key>\n\t\t\t<string>B1sTeam — b1s.id.vn</string>\n")
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
	b.WriteString("\t\t\t<key>PayloadDisplayName</key>\n\t\t\t<string>B1sTeam LocketGold — DoH</string>\n")
	b.WriteString("\t\t\t<key>PayloadIdentifier</key>\n\t\t\t<string>vn.b1steam.locketgold.dns</string>\n")
	b.WriteString("\t\t\t<key>PayloadOrganization</key>\n\t\t\t<string>B1sTeam — b1s.id.vn</string>\n")
	b.WriteString("\t\t\t<key>PayloadType</key>\n\t\t\t<string>com.apple.dnsSettings.managed</string>\n")
	b.WriteString("\t\t\t<key>PayloadUUID</key>\n\t\t\t<string>" + newUUID() + "</string>\n")
	b.WriteString("\t\t\t<key>PayloadVersion</key>\n\t\t\t<integer>1</integer>\n")
	b.WriteString("\t\t\t<key>ProhibitDisablement</key>\n\t\t\t<false/>\n")
	b.WriteString("\t\t</dict>\n")

	b.WriteString("\t</array>\n")
	b.WriteString("\t<key>PayloadDescription</key>\n\t<string>B1sTeam LocketGold (Free) — Gold vinh vien, cai 1 cham khong can Shadowrocket.</string>\n")
	b.WriteString("\t<key>PayloadDisplayName</key>\n\t<string>B1sTeam LocketGold (Free) — MITM + DoH</string>\n")
	b.WriteString("\t<key>PayloadIdentifier</key>\n\t<string>vn.b1steam.locketgold.profile</string>\n")
	b.WriteString("\t<key>PayloadOrganization</key>\n\t<string>B1sTeam — b1s.id.vn</string>\n")
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
