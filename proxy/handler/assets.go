package handler

import "strings"

// Static assets (stickers, frames, filter thumbnails) are referenced by absolute URL
// inside the embedded camera-filter catalog. Those URLs originally pointed at a
// third-party deployment, which made the proxy depend on infrastructure we do not own.
//
// SetAssetBaseURL rewrites the catalog to any CDN base we control.
// The default points at the B1sTeam frame worker, which serves the same `/assets/...` tree.
//
// Set via the ASSET_CDN_BASE environment variable.
const (
	// defaultAssetBaseURL is the B1sTeam asset host.
	defaultAssetBaseURL = "https://frame.b1s.id.vn/assets"
)

// legacyAssetPrefixes are the hosts embedded in the shipped catalog. They are all
// replaced by the configured asset base at startup so the proxy never depends on
// infrastructure we do not own.
var legacyAssetPrefixes = []string{
	"https://locket-vip.mhiep20077.workers.dev/assets",
	"https://uplocket.io.vn/uploads",
}

// SetAssetBaseURL points every static asset URL in the embedded catalog at `base`.
// An empty string keeps the default. Returns the base actually applied.
func SetAssetBaseURL(base string) string {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	if base == "" {
		base = defaultAssetBaseURL
	}
	assetBaseURL = base
	if cameraFilterConfigJSON != "" {
		for _, legacy := range legacyAssetPrefixes {
			cameraFilterConfigJSON = strings.ReplaceAll(cameraFilterConfigJSON, legacy, assetBaseURL)
		}
	}
	rebuildFilterConfigs()
	return assetBaseURL
}

// assetBaseURL is the active CDN base for static assets.
var assetBaseURL = defaultAssetBaseURL

// AssetBaseURL returns the CDN base currently in use.
func AssetBaseURL() string { return assetBaseURL }

// rebuildFilterConfigs refreshes the derived RemoteConfig entries after the
// asset base changed.
func rebuildFilterConfigs() {
	celebrity := `{"celebrityUid":"locket_admin_custom","cameraFilterConfig":` + cameraFilterConfigJSON + `}`
	firebaseOverrides["camera_filter_config"] = cameraFilterConfigJSON
	firebaseOverrides["celebrity_filter_config"] = celebrity
}
