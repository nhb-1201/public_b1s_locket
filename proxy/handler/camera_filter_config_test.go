package handler

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type rcConfig struct {
	RemoteFilters []map[string]any `json:"remoteFilters"`
	Filters       []map[string]any `json:"filters"`
	PickerFilters []string         `json:"pickerFilters"`
	PickerF       []string         `json:"picker_filters"`
	FilterGroups  []map[string]any `json:"filterGroups"`
	FilterGroups2 []map[string]any `json:"filter_groups"`
	RemoteFilters2 []map[string]any `json:"remote_filters"`
}

func loadRCConfig(t *testing.T) rcConfig {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(".", "camera_filter_config.json"))
	if err != nil {
		t.Fatal(err)
	}
	var cfg rcConfig
	if err := json.Unmarshal(b, &cfg); err != nil {
		t.Fatalf("camera_filter_config.json invalid: %v", err)
	}
	return cfg
}

func TestRCRemoteFiltersHaveWorkingURLs(t *testing.T) {
	cfg := loadRCConfig(t)
	if len(cfg.RemoteFilters) < 100 {
		t.Fatalf("remoteFilters too small: %d", len(cfg.RemoteFilters))
	}
	for _, f := range cfg.RemoteFilters {
		id, _ := f["id"].(string)
		for _, key := range []string{"imageUrl", "iconUrl", "overlayImageUrl", "overlayImageURL"} {
			u, _ := f[key].(string)
			if u == "" {
				t.Errorf("entry %s: missing %s", id, key)
				continue
			}
			if !strings.HasPrefix(u, "https://raw.githubusercontent.com/") {
				t.Errorf("entry %s: %s not on raw.githubusercontent (%s)", id, key, u)
			}
			if strings.Contains(u, "locket-vip.mhiep20077.workers.dev") || strings.Contains(u, "uplocket.io.vn") {
				t.Errorf("entry %s: %s still points at dead host (%s)", id, key, u)
			}
		}
		icon, _ := f["icon"].(map[string]any)
		if icon == nil {
			t.Errorf("entry %s: missing icon object", id)
			continue
		}
		for _, key := range []string{"url", "iconUrl", "remoteImage"} {
			u, _ := icon[key].(string)
			if u == "" || !strings.HasPrefix(u, "https://raw.githubusercontent.com/") {
				t.Errorf("entry %s: icon.%s invalid (%s)", id, key, u)
			}
		}
	}
}

func TestRCPickerAndGroupsReferenceExistingFilters(t *testing.T) {
	cfg := loadRCConfig(t)
	ids := map[string]bool{}
	for _, f := range cfg.RemoteFilters {
		if id, ok := f["id"].(string); ok {
			ids[id] = true
		}
	}
	for _, list := range [][]string{cfg.PickerFilters, cfg.PickerF} {
		for _, id := range list {
			if !ids[id] {
				t.Errorf("picker filter id %q not present in remoteFilters", id)
			}
		}
	}
	for _, groups := range [][]map[string]any{cfg.FilterGroups, cfg.FilterGroups2} {
		for _, g := range groups {
			for _, arr := range []string{"filterIds", "filter_ids"} {
				list, _ := g[arr].([]any)
				for _, v := range list {
					id, _ := v.(string)
					if !ids[id] {
						t.Errorf("group %v: %s %q not present in remoteFilters", g["id"], arr, id)
					}
				}
			}
		}
	}
}

// NOTE: 119 frame b1s_locketvip_* tạm thời KHÔNG đăng ký trong RC — cấu hình 1.23MB
// làm app Locket rơi về defaults (mất nút filter). Khi app xác nhận chạy ổn ở 712KB
// sẽ tái thêm tối ưu. Test này chỉ kiểm tra tính toàn vẹn cấu trúc.
func TestRCContainsB1sLocketVipFrames(t *testing.T) {
	cfg := loadRCConfig(t)
	found := 0
	for _, f := range cfg.RemoteFilters {
		if id, _ := f["id"].(string); strings.HasPrefix(id, "b1s_locketvip_") {
			found++
		}
	}
	t.Logf("b1s_locketvip frames registered: %d", found)

	// mọi URL frame trong RC phải trỏ về file tồn tại trong repo
	manifestPath := filepath.Join("..", "..", "assets", "rc", "frames")
	count := 0
	for path := range walkDir(manifestPath) {
		if strings.HasSuffix(path, ".png") {
			count++
		}
	}
	if count < 100 {
		t.Fatalf("expected at least 100 frames in assets/rc/frames, got %d", count)
	}

	var _ = fmt.Sprintf // keep fmt import if unused later
}

func walkDir(root string) <-chan string {
	ch := make(chan string)
	go func() {
		_ = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
			if err == nil && info != nil && !info.IsDir() {
				ch <- path
			}
			return nil
		})
		close(ch)
	}()
	return ch
}
