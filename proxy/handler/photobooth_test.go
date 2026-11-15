package handler

import "testing"

func TestIsOverlayOrPhotoboothFilter(t *testing.T) {
	yes := []string{
		"b1s_locketvip_shinchan_neon",
		"b1s_locketvip_hello_kitty_hearts_pink",
		"b1s_locketvip_my_melody_plaid_hearts",
		"b1s_locketvip_detective_conan",
		"frame_berry_days",
		"khung_shinchan_x",
		"pb_holo_4cut",
		"cmt_locket",
		"sticker_trend_tic_toc",
		"photobooth_4cut",
		"photobooth_cute",
	}
	no := []string{
		"",
		"looks_maxxing",
		"influencer",
		"stk_rose_flower",
		"disco_lights",
	}
	for _, id := range yes {
		if !IsOverlayOrPhotoboothFilter(id) {
			t.Errorf("expected overlay: %q", id)
		}
	}
	for _, id := range no {
		if IsOverlayOrPhotoboothFilter(id) {
			t.Errorf("expected NOT overlay: %q", id)
		}
	}
}
