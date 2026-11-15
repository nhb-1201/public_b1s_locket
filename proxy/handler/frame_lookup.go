package handler

import (
	"encoding/json"
	"strings"
	"sync"
)

var overlayURLOnce sync.Once
var overlayURLByID map[string]string

func loadOverlayIndex() {
	overlayURLOnce.Do(func() {
		overlayURLByID = map[string]string{}
		var d struct {
			RemoteFilters []map[string]any `json:"remoteFilters"`
		}
		if err := json.Unmarshal([]byte(cameraFilterConfigJSON), &d); err != nil {
			return
		}
		for _, arr := range [][]map[string]any{d.RemoteFilters} {
			for _, f := range arr {
				id, _ := f["id"].(string)
				if id == "" {
					if u, ok := f["uid"].(string); ok {
						id = u
					}
				}
				if id == "" {
					continue
				}
				key := strings.ToLower(id)
				if overlayURLByID[key] != "" {
					continue // remoteFilters thắng (ưu tiên đầu tiên)
				}
				url := ""
				for _, k := range []string{"overlayImageUrl", "overlayImageURL", "imageUrl", "iconUrl"} {
					if s, ok := f[k].(string); ok && s != "" {
						url = s
						break
					}
				}
				if url == "" {
					if ic, ok := f["icon"].(map[string]any); ok {
						if s, ok := ic["remoteImage"].(string); ok && s != "" {
							url = s
						} else if s, ok := ic["url"].(string); ok && s != "" {
							url = s
						}
					}
				}
				if url != "" {
					overlayURLByID[key] = url
				}
			}
		}
	})
}

// ResolveOverlayFrameURL trả về URL ảnh khung cho filter id trong RC
// (overlayImageUrl || overlayImageURL || imageUrl || iconUrl || icon.remoteImage).
func ResolveOverlayFrameURL(fid string) string {
	fid = strings.ToLower(strings.TrimSpace(fid))
	if fid == "" {
		return ""
	}
	loadOverlayIndex()
	return overlayURLByID[fid]
}

// OverlayFilterCount — số khung đã được đăng ký trong RC (dùng cho diagnostics/tests).
func OverlayFilterCount() int {
	loadOverlayIndex()
	return len(overlayURLByID)
}
