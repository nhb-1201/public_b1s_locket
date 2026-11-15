package handler

import (
	"strings"
	"testing"
)

func TestInjectFirebaseEmitsB1sLocketVipFrames(t *testing.T) {
	catalog, err := Manifest()
	if err != nil {
		t.Fatal(err)
	}
	body := []byte(`{"entries":{}}`)
	out, err := InjectFirebase(body, catalog, nil)
	if err != nil {
		t.Fatal(err)
	}
	s := string(out)
	for _, probe := range []string{
		"camera_filter_config",
		"b1s_frame_catalog",
	} {
		if !strings.Contains(s, probe) {
			t.Errorf("injected RC missing %q", probe)
		}
	}
	if strings.Contains(s, "mhiep20077.workers.dev") || strings.Contains(s, "uplocket.io.vn") {
		t.Fatal("injected RC still references dead hosts")
	}
}
