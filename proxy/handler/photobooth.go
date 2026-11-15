package handler

import (
	"encoding/json"
	"regexp"
	"strings"
)

// photoURLRegex tìm URL ảnh khi body không parse được thành JSON.
var photoURLRegex = regexp.MustCompile(`https?://[^\s"'<>\\)]+\.(?:jpg|jpeg|png|webp|heic)[^\s"'<>\\)]*`)

// photoKeys là các key chứa URL ảnh gốc trong request generateFilteredImage.
var photoKeys = []string{
	"imageUrl",
	"image_url",
	"inputUrl",
	"input_url",
	"downloadUrl",
	"download_url",
	"photoUrl",
	"photo_url",
	"url",
}

// filterKeys là các key chứa id bộ lọc / khung trong request.
var filterKeys = []string{
	"filterId",
	"filter_id",
	"filterUid",
	"filter_uid",
	"filter",
	"id",
}

// overlayPrefixes: các prefix id bộ lọc được coi là khung vẽ đè (overlay).
// b1s_locketvip_* : toàn bộ 132 khung B1sTeam re-hosted (assets/rc/frames) — client composite.
var overlayPrefixes = []string{"khung_", "frame_", "pb_", "cmt_", "b1s_locketvip_", "sticker_"}

// overlayKeywords: các từ khoá trong id bộ lọc bị coi là photobooth.
var overlayKeywords = []string{"photobooth", "4cut"}

// ExtractPhotoURLAndFilterID lấy URL ảnh + id bộ lọc từ body request.
func ExtractPhotoURLAndFilterID(body []byte) (string, string) {
	var photoURL, filterID string
	if len(body) == 0 {
		return "", ""
	}

	var root map[string]any
	if err := json.Unmarshal(body, &root); err == nil && root != nil {
		scopes := []map[string]any{root}
		if data, ok := root["data"].(map[string]any); ok && data != nil {
			scopes = append(scopes, data)
		}
		if req, ok := root["request"].(map[string]any); ok && req != nil {
			scopes = append(scopes, req)
		}

		for _, scope := range scopes {
			if photoURL == "" {
				photoURL = pickString(scope, photoKeys)
			}
			if filterID == "" {
				filterID = pickString(scope, filterKeys)
			}
			if photoURL != "" && filterID != "" {
				break
			}
		}
	}

	if photoURL == "" {
		if m := photoURLRegex.Find(body); len(m) > 0 {
			photoURL = strings.ReplaceAll(string(m), `\u0026`, "&")
			photoURL = strings.ReplaceAll(photoURL, `\`, "")
		}
	}

	return photoURL, filterID
}

// pickString trả về giá trị chuỗi đầu tiên tìm thấy trong map.
func pickString(scope map[string]any, keys []string) string {
	for _, key := range keys {
		if s, ok := scope[key].(string); ok && s != "" {
			return s
		}
	}
	return ""
}

// IsOverlayOrPhotoboothFilter kiểm tra id bộ lọc có phải khung overlay hay không.
//
// Khung overlay (khung_, frame_, pb_, cmt_) hoặc photobooth/4cut.
func IsOverlayOrPhotoboothFilter(filterID string) bool {
	if filterID == "" {
		return false
	}
	lower := strings.ToLower(filterID)
	for _, prefix := range overlayPrefixes {
		if strings.HasPrefix(lower, prefix) {
			return true
		}
	}
	for _, keyword := range overlayKeywords {
		if strings.Contains(lower, keyword) {
			return true
		}
	}
	return false
}

// BuildMockFilterResponse tạo response 200 giả với URL ảnh gốc.
//
// App Locket sẽ tự vẽ khung overlay lên ảnh gốc nên không cần server render.
func BuildMockFilterResponse(photoURL string) []byte {
	inner := map[string]any{
		"outputUrl":  photoURL,
		"output_url": photoURL,
		"url":        photoURL,
		"imageUrl":   photoURL,
		"image_url":  photoURL,
		"status":     200,
	}
	inner["data"] = map[string]any{
		"outputUrl":  photoURL,
		"output_url": photoURL,
		"url":        photoURL,
		"imageUrl":   photoURL,
		"image_url":  photoURL,
	}

	result := map[string]any{
		"outputUrl":  photoURL,
		"output_url": photoURL,
		"url":        photoURL,
		"imageUrl":   photoURL,
		"image_url":  photoURL,
		"status":     200,
		"is_locked":  false,
		"requires_gold":  false,
		"requires_subscription": false,
		"unlocked":   true,
		"is_gold":    true,
		"is_premium": true,
		"data":       inner["data"],
	}

	resp := map[string]any{
		"ok":     true,
		"result": result,
		"data":   inner,
	}

	b, err := json.Marshal(resp)
	if err != nil {
		return []byte(`{"ok":true,"result":{"status":200}}`)
	}
	return b
}

// CleanFilterResponse làm sạch response lỗi của endpoint filter.
//
// Xoá field error, ép status 200 + cờ mở khoá để app không hiện paywall.
func CleanFilterResponse(body []byte) []byte {
	if len(body) == 0 {
		return body
	}
	var root map[string]any
	if err := json.Unmarshal(body, &root); err != nil {
		return body
	}
	if root == nil {
		root = map[string]any{}
	}

	delete(root, "error")
	delete(root, "errors")

	if res, ok := root["result"].(map[string]any); ok && res != nil {
		delete(res, "error")
		delete(res, "errors")
		res["status"] = 200
		res["is_locked"] = false
		res["requires_gold"] = false
		res["requires_subscription"] = false
		res["unlocked"] = true
		res["is_gold"] = true
	} else {
		root["result"] = map[string]any{
			"status":               200,
			"is_gold":              true,
			"unlocked":             true,
			"is_locked":            false,
			"requires_gold":        false,
			"requires_subscription": false,
		}
	}

	cleaned, err := json.Marshal(root)
	if err != nil {
		return body
	}
	return cleaned
}
