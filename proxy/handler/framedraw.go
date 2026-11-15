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

// postToWorker — khung POST JSON chung tới worker photon (x-b1s-proxy-key xác thực).
func postToWorker(ctx context.Context, worker, key string, body []byte) ([]byte, error) {
	worker = strings.TrimRight(strings.TrimSpace(worker), "/")
	if worker == "" || strings.TrimSpace(key) == "" {
		return nil, fmt.Errorf("frame draw chưa được cấu hình (worker/key rỗng)")
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

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20)) // 16 MB tối đa
	if err != nil {
		return nil, err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		snippet := respBody
		if len(snippet) > 240 {
			snippet = snippet[:240]
		}
		return nil, fmt.Errorf("worker trả %d: %s", resp.StatusCode, string(snippet))
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
		return nil, fmt.Errorf("worker trả lỗi: %s", string(snippet))
	}
	return respBody, nil
}

// DrawFrame gọi worker "vẽ khung" (photon WASM) để WA ảnh + khung Kawaii ROI về
// response Locket-shaped (result.outputUrl = data:image/png;base64).
//
// Dùng cho endPoint generateFilteredImage khi filter là khung (overlay/photobooth).
// Fail-OPEN: lỗi bất kỳ -> trả về lỗi => gọi từ handleMITM sẽ fallback về mock
// (ảnh gốc di nguyên trạng, không lộ).
func DrawFrame(ctx context.Context, worker, key string, body []byte) ([]byte, error) {
	return postToWorker(ctx, worker, key, body)
}

// DrawFrameWithURL — như DrawFrame nhưng ép worker dùng frame URL cụ thể (từ RC config).
// Đây là đường chính cho app store flow: filter id không cần map qua FRAME_URLS,
// chỉ cần URL khung trong camera_filter_config.
func DrawFrameWithURL(ctx context.Context, worker, key string, body []byte, frameURL string) ([]byte, error) {
	if strings.TrimSpace(frameURL) == "" {
		return nil, fmt.Errorf("frame_url rỗng")
	}
	if root := map[string]any{}; root != nil {
		if err := json.Unmarshal(body, &root); err == nil {
			root["frame_url"] = frameURL
			root["frameUrl"] = frameURL
			if b, err := json.Marshal(root); err == nil {
				body = b
			}
		}
	}
	return postToWorker(ctx, worker, key, body)
}
