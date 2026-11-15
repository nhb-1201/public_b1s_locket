package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// DrawFrame goi worker "ve khung" (photon WASM) de WA anh + khung Kawaii ROI ve
// response Locket-shaped (result.outputUrl = data:image/png;base64).
//
// Dung cho endPoint generateFilteredImage khi filter la khung (overlay/photobooth).
// Fail-OPEN: loi bat ky -> tra ve loi => goi tu handleMITM se fallback ve mock
// (anh goc di nguyen trang, khong lo).
func DrawFrame(ctx context.Context, worker, key string, body []byte) ([]byte, error) {
	worker = strings.TrimRight(strings.TrimSpace(worker), "/")
	if worker == "" || strings.TrimSpace(key) == "" {
		return nil, fmt.Errorf("frame draw chua duoc cau hinh (worker/key rong)")
	}

	ctx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, worker+"/apply-frame", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("x-b1s-proxy-key", strings.TrimSpace(key))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20)) // 16 MB toi da
	if err != nil {
		return nil, err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		snippet := respBody
		if len(snippet) > 240 {
			snippet = snippet[:240]
		}
		return nil, fmt.Errorf("worker tra %d: %s", resp.StatusCode, string(snippet))
	}

	var parsed map[string]any
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, err
	}
	if ok, _ := parsed["ok"].(bool); !ok {
		snippet, _ := json.Marshal(parsed)
		if len(snippet) > 240 {
			snippet = snippet[:240]
		}
		return nil, fmt.Errorf("worker tra loi: %s", string(snippet))
	}
	return respBody, nil
}
