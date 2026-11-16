package handler

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

func TestDailyWidgetInjectionOutput(t *testing.T) {
	catalog, err := Manifest()
	if err != nil {
		t.Fatal(err)
	}
	out, err := InjectFirebase([]byte(`{"entries":{}}`), catalog, nil)
	if err != nil {
		t.Fatal(err)
	}
	var root map[string]any
	if err := json.Unmarshal(out, &root); err != nil {
		t.Fatal(err)
	}
	entries := root["entries"].(map[string]any)
	cat := entries["b1s_frame_catalog"].(string)

	for _, want := range []string{
		"https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_sakura_tho_meo_torii.png",
		"https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_shinchan_neon.png",
		"https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main/assets/rc/frames/b1s_locketvip_dragonball_rainbow.png",
	} {
		if !strings.Contains(cat, want) {
			t.Errorf("catalog missing raw URL %s", want)
		}
	}

	// widget_frame_event phải chứa 1 URL raw hợp lệ
	wfe := entries["widget_frame_event"].(string)
	if !strings.Contains(wfe, "raw.githubusercontent.com") {
		t.Fatalf("widget_frame_event URL not raw github: %s", wfe[:120])
	}

	// camera_frame_config default = 1 trong 8 khung xoay vòng
	cff := entries["camera_frame_config"].(string)

	// 8 khung xoay vòng đều có mặt trong catalog
	for _, id := range []string{
		"b1s_locketvip_sakura_tho_meo_torii", "b1s_locketvip_hello_kitty_hearts_pink",
		"b1s_locketvip_shinchan_neon", "b1s_locketvip_my_melody_plaid_hearts",
		"b1s_locketvip_frieren_ice", "b1s_locketvip_doraemon_besties",
		"b1s_locketvip_kawaii_banana_border_frame", "b1s_locketvip_dragonball_rainbow",
	} {
		if !strings.Contains(cat, id) {
			t.Errorf("catalog missing curated frame %s", id)
		}
		if !strings.Contains(cff, id) {
			t.Errorf("camera_frame_config missing curated frame %s", id)
		}
	}

	fmt.Printf("WIDGET EVENT: %s\n", wfe)
	fmt.Printf("DAILY DEFAULT: %s\n", cff[:100])
}
