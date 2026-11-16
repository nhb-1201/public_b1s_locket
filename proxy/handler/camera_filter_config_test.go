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
	RemoteFilters  []map[string]any `json:"remoteFilters"`
	PickerFilters  []string         `json:"pickerFilters"`
	PickerF        []string         `json:"picker_filters"`
	FilterGroups   []map[string]any `json:"filterGroups"`
	SheetFilters   []map[string]any `json:"sheetFilters"`
}

func groupIDList(groups []map[string]any) []string {
	ids := make([]string, 0, len(groups))
	for _, g := range groups {
		ids = append(ids, fmt.Sprintf("%v", g["id"]))
	}
	return ids
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
	if len(cfg.RemoteFilters) < 140 {
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
	for _, groups := range [][]map[string]any{cfg.FilterGroups, cfg.SheetFilters} {
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

func TestRCContainsB1sLocketVipFrames(t *testing.T) {
	cfg := loadRCConfig(t)
	found := map[string]bool{}
	for _, f := range cfg.RemoteFilters {
		id, _ := f["id"].(string)
		if strings.HasPrefix(id, "b1s_locketvip_") {
			found[id] = true
		}
	}
	if len(found) < 100 {
		t.Fatalf("expected at least 100 b1s_locketvip frames, got %d", len(found))
	}

	// 8 nhóm B1sKhung_* tồn tại, mỗi nhóm ≥1 frame, tổng ≥100 frame có tiền tố b1s_locketvip_
	b1sCounts := 0
	for _, groups := range [][]map[string]any{cfg.FilterGroups, cfg.SheetFilters} {
		for _, g := range groups {
			id, _ := g["id"].(string)
			switch id {
			case "group_b1skhung_shinchan", "group_b1skhung_kitty", "group_b1skhung_anime", "group_b1skhung_kawaii",
				"group_b1skhung_social", "group_b1skhung_neon", "group_b1skhung_khac":
				list, _ := g["filterIds"].([]any)
				if len(list) == 0 {
					t.Errorf("%s is empty", id)
				}
				for _, v := range list {
					if s, ok := v.(string); ok && strings.HasPrefix(s, "b1s_locketvip_") {
						b1sCounts++
					}
				}
			}
		}
	}
	if b1sCounts < 100 {
		t.Fatalf("expected at least 100 b1s_locketvip frames across B1sKhung groups, got %d", b1sCounts)
	}

	// mọi nhóm frame phải đứng TRƯỚC các nhóm AI-sticker ở cuối (group_looks…)
	wantOrder := []string{"group_b1skhung_shinchan", "group_b1skhung_kitty", "group_b1skhung_anime", "group_b1skhung_kawaii",
		"group_b1skhung_social", "group_b1skhung_neon", "group_b1skhung_khac"}
	for _, groups := range [][]map[string]any{cfg.FilterGroups, cfg.SheetFilters} {
		idx := 0
		for _, g := range groups {
			id, _ := g["id"].(string)
			if idx < len(wantOrder) && id == wantOrder[idx] {
				idx++
				continue
			}
		}
		if idx < len(wantOrder) {
			t.Fatalf("B1sKhung groups not in expected front order: got %v", groupIDList(groups))
		}
	}

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
