// B1sTeam LocketGold (Free) — unit test cho proxy MITM.
//
// Chi dung stdlib (testing) — khong co dependency ngoai.
// Chay: go test ./... (trong thu muc proxy/)
//
// B1sTeam — b1s.id.vn · Nguyen Hoang Bach
package main

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/nhb-1201/public_b1s_locket/config"
	"github.com/nhb-1201/public_b1s_locket/handler"
	tlspkg "github.com/nhb-1201/public_b1s_locket/tls"
)

// ---------------------------------------------------------------------------
// RevenueCat
// ---------------------------------------------------------------------------

// TestRevenueCatInjectionIdempotent kiem tra inject entitlement Gold 2 lan
// cho cung 1 input se cho ra cung 1 ket qua (bat buoc de proxy chay nhiều lớp).
func TestRevenueCatInjectionIdempotent(t *testing.T) {
	raw := []byte(`{"request":{"product_id":"locket_1600_1y"},"subscriber":{"subscriptions":{},"entitlements":{}},"keep_me":"yes"}`)

	first, err := handler.InjectRevenueCat(raw)
	if err != nil {
		t.Fatalf("InjectRevenueCat lan 1 loi: %v", err)
	}
	second, err := handler.InjectRevenueCat(first)
	if err != nil {
		t.Fatalf("InjectRevenueCat lan 2 loi: %v", err)
	}
	if !bytes.Equal(first, second) {
		t.Fatalf("inject 2 lan khong idempotent:\n1) %s\n2) %s", first, second)
	}

	var obj map[string]any
	if err := json.Unmarshal(first, &obj); err != nil {
		t.Fatalf("parse JSON loi: %v", err)
	}

	if obj["Attention"] != "B1sTeam Activated (Gold Lifetime)!" {
		t.Errorf("thieu Attention, got %v", obj["Attention"])
	}
	if obj["keep_me"] != "yes" {
		t.Errorf("mang field goc bi mat: %v", obj["keep_me"])
	}

	subscriber, ok := obj["subscriber"].(map[string]any)
	if !ok {
		t.Fatalf("thieu subscriber: %v", obj["subscriber"])
	}

	subscriptions, ok := subscriber["subscriptions"].(map[string]any)
	if !ok {
		t.Fatalf("thieu subscriber.subscriptions")
	}
	for _, productID := range handler.GoldProductIDs {
		sub, ok := subscriptions[productID].(map[string]any)
		if !ok {
			t.Fatalf("thieu subscription %q", productID)
		}
		if sub["ownership_type"] != "PURCHASED" {
			t.Errorf("%s: ownership_type = %v, want PURCHASED", productID, sub["ownership_type"])
		}
		if sub["expires_date"] != handler.GoldExpiresDate {
			t.Errorf("%s: expires_date = %v, want %s", productID, sub["expires_date"], handler.GoldExpiresDate)
		}
		if sub["purchase_date"] != handler.GoldPurchaseDate {
			t.Errorf("%s: purchase_date = %v, want %s", productID, sub["purchase_date"], handler.GoldPurchaseDate)
		}
		if sub["is_sandbox"] != false {
			t.Errorf("%s: is_sandbox = %v, want false", productID, sub["is_sandbox"])
		}
		if sub["period_type"] != "normal" {
			t.Errorf("%s: period_type = %v, want normal", productID, sub["period_type"])
		}
		if sub["store"] != "app_store" {
			t.Errorf("%s: store = %v, want app_store", productID, sub["store"])
		}
	}

	entitlements, ok := subscriber["entitlements"].(map[string]any)
	if !ok {
		t.Fatalf("thieu subscriber.entitlements")
	}
	for _, key := range handler.GoldEntitlementKeys {
		ent, ok := entitlements[key].(map[string]any)
		if !ok {
			t.Fatalf("thieu entitlement %q", key)
		}
		if ent["expires_date"] != handler.GoldExpiresDate {
			t.Errorf("entitlement %s: expires_date = %v", key, ent["expires_date"])
		}
		if ent["ownership_type"] != "PURCHASED" {
			t.Errorf("entitlement %s: ownership_type = %v", key, ent["ownership_type"])
		}
	}
}

// ---------------------------------------------------------------------------
// Locket API
// ---------------------------------------------------------------------------

// TestLocketAPIUnblurAndBadge kiem tra mo paywall + gỡ blur + gắn badge Gold.
func TestLocketAPIUnblurAndBadge(t *testing.T) {
	raw := []byte(`{"data":{"uid":"user-1","is_locked":true,"locked":true,"requires_gold":true,` +
		`"paywall":true,"blurred":true,"can_view":false,"unlocked":false,"is_free":false,` +
		`"blurred_url":"https://cdn.locketcamera.com/blur.jpg",` +
		`"preview_url":"https://cdn.locketcamera.com/prev.jpg",` +
		`"unblurred_url":"https://cdn.locketcamera.com/clear.jpg"},` +
		`"items":[{"uid":"user-2","locked":true,"is_locked":true}]}`)

	out := handler.RewriteLocketAPI(raw)

	var obj map[string]any
	if err := json.Unmarshal(out, &obj); err != nil {
		t.Fatalf("parse JSON loi: %v", err)
	}

	data, ok := obj["data"].(map[string]any)
	if !ok {
		t.Fatalf("thieu data: %v", obj["data"])
	}

	for _, flag := range []string{"is_locked", "locked", "requires_gold", "paywall", "blurred"} {
		if data[flag] != false {
			t.Errorf("data.%s = %v, want false", flag, data[flag])
		}
	}
	for _, flag := range []string{"can_view", "unlocked", "is_free"} {
		if data[flag] != true {
			t.Errorf("data.%s = %v, want true", flag, data[flag])
		}
	}

	const clearURL = "https://cdn.locketcamera.com/clear.jpg"
	if data["blurred_url"] != clearURL {
		t.Errorf("blurred_url = %v, want %s", data["blurred_url"], clearURL)
	}
	if data["preview_url"] != clearURL {
		t.Errorf("preview_url = %v, want %s", data["preview_url"], clearURL)
	}

	if data["is_gold"] != true {
		t.Errorf("data.is_gold = %v, want true", data["is_gold"])
	}
	if data["badge"] != "locket_gold" {
		t.Errorf("data.badge = %v, want locket_gold", data["badge"])
	}
	if data["badge_tier"] != "gold" {
		t.Errorf("data.badge_tier = %v, want gold", data["badge_tier"])
	}

	items, ok := obj["items"].([]any)
	if !ok || len(items) == 0 {
		t.Fatalf("thieu items: %v", obj["items"])
	}
	item, ok := items[0].(map[string]any)
	if !ok {
		t.Fatalf("item khong phai object: %v", items[0])
	}
	if item["is_gold"] != true {
		t.Errorf("items[0].is_gold = %v, want true", item["is_gold"])
	}
	if item["locked"] != false {
		t.Errorf("items[0].locked = %v, want false", item["locked"])
	}
}

// TestLocketAPIRewriteIdempotent kiem tra chay lai 2 lan cho cung ket qua.
func TestLocketAPIRewriteIdempotent(t *testing.T) {
	raw := []byte(`{"data":{"uid":"u","is_locked":true,"blurred_url":"https://x/b.jpg","unblurred_url":"https://x/c.jpg"}}`)
	first := handler.RewriteLocketAPI(raw)
	second := handler.RewriteLocketAPI(first)
	if !bytes.Equal(first, second) {
		t.Fatalf("RewriteLocketAPI khong idempotent:\n1) %s\n2) %s", first, second)
	}
}

// TestFeedEndpointDetection kiem tra danh sach endpoint feed/bạn bè.
func TestFeedEndpointDetection(t *testing.T) {
	feeds := []string{
		"/v1/getFriends",
		"/v1/getUsers",
		"/v1/fetchFriends",
		"/v1/getRecipients",
		"/v1/moments",
		"/v1/contacts",
	}
	for _, p := range feeds {
		if !handler.IsFeedOrFriendsEndpoint(p) {
			t.Errorf("%s phai duoc coi la feed endpoint", p)
		}
	}
	if handler.IsFeedOrFriendsEndpoint("/v1/changeProfileInfo") {
		t.Error("changeProfileInfo khong phai feed endpoint")
	}
	if !handler.IsChangeProfileInfo("/v1/changeProfileInfo") {
		t.Error("changeProfileInfo phai duoc nhan biet")
	}
}

// ---------------------------------------------------------------------------
// Frame manifest + worker pool
// ---------------------------------------------------------------------------

// TestFramesManifestValid kiem tra frames_manifest.json dung schema.
func TestFramesManifestValid(t *testing.T) {
	catalog, err := handler.Manifest()
	if err != nil {
		t.Fatalf("doc manifest loi: %v", err)
	}
	if catalog.Version == "" {
		t.Error("manifest thieu version")
	}
	if len(catalog.Frames) == 0 {
		t.Fatal("manifest rong")
	}

	seen := map[string]bool{}
	for _, f := range catalog.Frames {
		if f.ID == "" {
			t.Error("frame thieu id")
			continue
		}
		if seen[f.ID] {
			t.Errorf("frame id trung: %s", f.ID)
		}
		seen[f.ID] = true

		if f.Name == "" {
			t.Errorf("%s: thieu name", f.ID)
		}
		if f.Group == "" {
			t.Errorf("%s: thieu group", f.ID)
		}
		if f.File == "" {
			t.Errorf("%s: thieu file", f.ID)
		}
		if !strings.HasPrefix(f.WorkerPath, "/f/") {
			t.Errorf("%s: worker_path = %q, phai bat dau bang /f/", f.ID, f.WorkerPath)
		}
		if f.Width <= 0 || f.Height <= 0 {
			t.Errorf("%s: kich thuoc khong hop le (%dx%d)", f.ID, f.Width, f.Height)
		}
	}

	// JSON raw phai parse duoc va giu nguyen so luong frame.
	var raw map[string]any
	if err := json.Unmarshal(handler.ManifestJSON(), &raw); err != nil {
		t.Fatalf("manifest raw khong parse duoc: %v", err)
	}
	frames, ok := raw["frames"].([]any)
	if !ok {
		t.Fatalf("manifest thieu truong frames")
	}
	if len(frames) != len(catalog.Frames) {
		t.Errorf("so frame raw (%d) khac so frame parse (%d)", len(frames), len(catalog.Frames))
	}
}

// TestFramePoolRoundRobin kiem tra pool worker xoay vong.
func TestFramePoolRoundRobin(t *testing.T) {
	pool := handler.NewFramePool([]string{
		"https://b1steam-frames-1.nhb-120111.workers.dev",
		"https://b1steam-frames-2.nhb-120111.workers.dev",
	}, 60*time.Second)

	if pool.Len() != 2 {
		t.Fatalf("pool len = %d, want 2", pool.Len())
	}

	first := pool.Next()
	second := pool.Next()
	if first == nil || second == nil {
		t.Fatal("pool tra nil")
	}
	if first.BaseURL == second.BaseURL {
		t.Errorf("round-robin khong xoay vong (cung %s)", first.BaseURL)
	}

	third := pool.Next()
	if third.BaseURL != first.BaseURL {
		t.Errorf("vong 3 phai quay lai worker dau, got %s", third.BaseURL)
	}
}

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

// TestRateLimiterBurst kiem tra burst + chan khi het token.
func TestRateLimiterBurst(t *testing.T) {
	limiter := handler.NewLimiter(3, 1) // refill 1 token/phut -> het han ngay

	for i := 0; i < 3; i++ {
		if !limiter.Allow("1.2.3.4") {
			t.Fatalf("request %d bi chan ngoai y muon", i+1)
		}
	}
	if limiter.Allow("1.2.3.4") {
		t.Error("phai chan request khi het token")
	}

	// IP khac van duoc phep (giới hạn theo IP).
	if !limiter.Allow("5.6.7.8") {
		t.Error("IP khac phai duoc phep")
	}
}

// TestRateLimiterMiddleware429 kiem tra middleware tra 429 + JSON body.
func TestRateLimiterMiddleware429(t *testing.T) {
	limiter := handler.NewLimiter(1, 1)
	called := 0
	wrapped := limiter.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called++
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "9.9.9.9:5555"

	rec := httptest.NewRecorder()
	wrapped.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("request 1 status = %d, want 200", rec.Code)
	}

	rec2 := httptest.NewRecorder()
	wrapped.ServeHTTP(rec2, req)
	if rec2.Code != http.StatusTooManyRequests {
		t.Fatalf("request 2 status = %d, want 429", rec2.Code)
	}
	if !strings.Contains(rec2.Body.String(), "rate_limited") {
		t.Errorf("body 429 khong phai JSON hop le: %s", rec2.Body.String())
	}
	if called != 1 {
		t.Errorf("handler bi goi %d lan, want 1", called)
	}
}

// ---------------------------------------------------------------------------
// CA / leaf certificate
// ---------------------------------------------------------------------------

// newTestCA tao Root CA ECDSA P-256 self-signed phuc vu test.
func newTestCA(t *testing.T) *tlspkg.CA {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("sinh key loi: %v", err)
	}

	template := &x509.Certificate{
		SerialNumber:          big.NewInt(20261115),
		Subject:               pkix.Name{CommonName: "B1sTeam Root CA", Organization: []string{"B1sTeam"}},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(10 * 365 * 24 * time.Hour),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign | x509.KeyUsageDigitalSignature,
		BasicConstraintsValid: true,
		IsCA:                  true,
	}

	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("ky root CA loi: %v", err)
	}

	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyDER, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		t.Fatalf("marshal key loi: %v", err)
	}
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})

	ca, err := tlspkg.LoadCA(certPEM, keyPEM)
	if err != nil {
		t.Fatalf("LoadCA loi: %v", err)
	}
	return ca
}

// TestCALeafForgingSAN kiem tra leaf certificate co dung SAN + hieu luc 397 ngay.
func TestCALeafForgingSAN(t *testing.T) {
	ca := newTestCA(t)

	sans := []string{"api.revenuecat.com", "api.locketcamera.com"}
	ca.SetSANs(sans)

	leaf, err := ca.ForgeLeaf("cdn.locketcamera.com")
	if err != nil {
		t.Fatalf("ForgeLeaf loi: %v", err)
	}
	if len(leaf.Certificate) < 2 {
		t.Fatalf("chu thieu leaf + root CA, nhan %d chung thu", len(leaf.Certificate))
	}

	parsed, err := x509.ParseCertificate(leaf.Certificate[0])
	if err != nil {
		t.Fatalf("parse leaf loi: %v", err)
	}

	got := map[string]bool{}
	for _, n := range parsed.DNSNames {
		got[n] = true
	}
	want := []string{"cdn.locketcamera.com", "api.revenuecat.com", "api.locketcamera.com"}
	for _, w := range want {
		if !got[w] {
			t.Errorf("thieu SAN %q (co %v)", w, parsed.DNSNames)
		}
	}

	// Hieu luc ~397 ngay.
	days := parsed.NotAfter.Sub(parsed.NotBefore).Hours() / 24
	if days < 396 || days > 398 {
		t.Errorf("hieu luc leaf = %.2f ngay, want ~397", days)
	}

	// Chu ky bang Root CA.
	if err := parsed.CheckSignatureFrom(ca.Cert); err != nil {
		t.Errorf("chu ky leaf khong dung Root CA: %v", err)
	}

	// Host rong phai fail.
	if _, err := ca.ForgeLeaf(""); err == nil {
		t.Error("ForgeLeaf voi host rong phai tra loi")
	}
}

// TestCertCache kiem tra cache leaf + khong cache loi.
func TestCertCache(t *testing.T) {
	ca := newTestCA(t)
	cache := tlspkg.NewCertCache(ca, 4, time.Hour)

	first, err := cache.GetOrForge("api.revenuecat.com")
	if err != nil {
		t.Fatalf("GetOrForge loi: %v", err)
	}
	second, err := cache.GetOrForge("api.revenuecat.com")
	if err != nil {
		t.Fatalf("GetOrForge lan 2 loi: %v", err)
	}
	if first != second {
		t.Error("phai dung lai cert da cache")
	}
	if cache.Len() != 1 {
		t.Errorf("cache len = %d, want 1", cache.Len())
	}

	// Loi khong duoc cache.
	if _, err := cache.GetOrForge(""); err == nil {
		t.Error("GetOrForge voi host rong phai tra loi")
	}
	if cache.Len() != 1 {
		t.Errorf("loi bi cache: len = %d, want 1", cache.Len())
	}

	// Day cache -> phai eviction.
	for i := 0; i < 8; i++ {
		if _, err := cache.GetOrForge("host-" + string(rune('a'+i)) + ".example.test"); err != nil {
			t.Fatalf("GetOrForge host moi loi: %v", err)
		}
	}
	if cache.Len() > 4 {
		t.Errorf("cache len = %d, vu qua gioi han 4", cache.Len())
	}
}

// ---------------------------------------------------------------------------
// Config + health endpoint
// ---------------------------------------------------------------------------

// TestAllowList kiem tra allow-list MITM.
func TestAllowList(t *testing.T) {
	cfg := &config.Config{AllowedHosts: config.DefaultSANS}

	if !cfg.IsAllowedHost("api.revenuecat.com") {
		t.Error("api.revenuecat.com phai duoc phep")
	}
	if !cfg.IsAllowedHost("API.REVENUECAT.COM") {
		t.Error("so sanh host phai khong phan biet hoa thuong")
	}
	if cfg.IsAllowedHost("evil.example.com") {
		t.Error("host ngoai danh sach phai bi chan")
	}
	if cfg.IsAllowedHost("") {
		t.Error("host rong phai bi chan")
	}
}

// TestHealthPayload kiem tra JSON health dung format yeu cau.
func TestHealthPayload(t *testing.T) {
	srv := &proxyServer{
		cfg: &config.Config{Version: config.VERSION, Service: config.ServiceName},
		log: newLogger("error"),
	}

	rec := httptest.NewRecorder()
	srv.writeHealth(rec)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	body := strings.TrimSpace(rec.Body.String())
	want := `{"ok":true,"service":"b1steam-locketgold","version":"` + config.VERSION + `"}`
	if body != want {
		t.Errorf("health body =\n%s\nwant\n%s", body, want)
	}
}

// TestBuildMobileConfig kiem tra plist sinh ra co 2 payload dung chuan.
func TestBuildMobileConfig(t *testing.T) {
	ca := newTestCA(t)
	body := buildMobileConfig(ca.RootDER(), "https://doh.b1s.id.vn/fly/dns-query", config.DefaultSANS)

	xml := string(body)
	for _, needle := range []string{
		"com.apple.security.root",
		"com.apple.dnsSettings.managed",
		"https://doh.b1s.id.vn/fly/dns-query",
		"<key>PayloadEnabled</key>",
		"<data>",
	} {
		if !strings.Contains(xml, needle) {
			t.Errorf("mobileconfig thieu %q", needle)
		}
	}

	// Base64 trong <data> phai xong 76 ky tu/dong.
	for _, line := range strings.Split(xml, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "<") {
			continue
		}
		if len(trimmed) > 76 {
			t.Errorf("dong base64 dai %d ky tu (>76)", len(trimmed))
		}
	}
}
