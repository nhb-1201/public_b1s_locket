package handler

import (
	"encoding/json"
	"regexp"
	"strings"
)

var photoURLRegex = regexp.MustCompile(`https?://[^\s"'<>\\]+\.(jpg|jpeg|png|webp)[^\s"'<>\\]*|https?://firebasestorage\.googleapis\.com/[^\s"'<>\\]+|https?://[^\s"'<>\\]*locket[^\s"'<>\\]*`)

// ExtractPhotoURLAndFilterID extracts the photo image URL and filter ID from request payload.
func ExtractPhotoURLAndFilterID(body []byte) (string, string) {
	var photoURL, filterID string

	var root map[string]any
	if err := json.Unmarshal(body, &root); err == nil {
		dataMap := root
		if d, ok := root["data"].(map[string]any); ok && d != nil {
			dataMap = d
		}

		for _, k := range []string{"imageUrl", "image_url", "inputUrl", "input_url", "url", "downloadUrl", "download_url"} {
			if s, ok := dataMap[k].(string); ok && s != "" {
				photoURL = s
				break
			}
		}

		for _, k := range []string{"filterId", "filter_id", "filterUid", "filter_uid", "filter"} {
			if s, ok := dataMap[k].(string); ok && s != "" {
				filterID = s
				break
			}
		}
		if filterID == "" {
			for _, k := range []string{"filterId", "filter_id"} {
				if s, ok := root[k].(string); ok && s != "" {
					filterID = s
					break
				}
			}
		}
	}

	if photoURL == "" && len(body) > 0 {
		m := photoURLRegex.Find(body)
		if len(m) > 0 {
			photoURL = strings.ReplaceAll(string(m), `\u0026`, "&")
			photoURL = strings.ReplaceAll(photoURL, `\`, "")
		}
	}

	return photoURL, filterID
}

// IsOverlayOrPhotoboothFilter checks if the filter is an overlay frame (Shin-chan, Hello Kitty, Photobooth 4-cut, etc.)
func IsOverlayOrPhotoboothFilter(filterID string) bool {
	if filterID == "" {
		return false
	}
	lower := strings.ToLower(filterID)
	return strings.HasPrefix(lower, "khung_") ||
		strings.HasPrefix(lower, "frame_") ||
		strings.HasPrefix(lower, "pb_") ||
		strings.Contains(lower, "photobooth") ||
		strings.Contains(lower, "4cut") ||
		strings.Contains(lower, "cmt_locket") ||
		strings.Contains(lower, "sticker_b_nh_lu_n")
}

// BuildMockFilterResponse creates a mock 200 OK response with the user's photo URL so Locket renders overlay frames natively.
func BuildMockFilterResponse(photoURL string) []byte {
	resp := map[string]any{
		"result": map[string]any{
			"outputUrl":  photoURL,
			"output_url": photoURL,
			"url":        photoURL,
			"imageUrl":   photoURL,
			"image_url":  photoURL,
			"status":     200,
			"data": map[string]any{
				"outputUrl":  photoURL,
				"output_url": photoURL,
				"url":        photoURL,
				"imageUrl":   photoURL,
				"image_url":  photoURL,
			},
		},
	}
	b, _ := json.Marshal(resp)
	return b
}

// ponytail: strips error objects to enforce 200 OK for Photobooth/AI filter responses. Upgrade if partial error logging is needed.
func CleanFilterResponse(body []byte) []byte {
	var root map[string]any
	if err := json.Unmarshal(body, &root); err != nil {
		return body
	}

	delete(root, "error")
	delete(root, "errors")

	if res, ok := root["result"].(map[string]any); ok {
		delete(res, "error")
		delete(res, "errors")
		res["status"] = 200
		res["is_locked"] = false
		res["requires_gold"] = false
		res["unlocked"] = true
	} else {
		root["result"] = map[string]any{
			"status":        200,
			"is_gold":       true,
			"unlocked":      true,
			"is_locked":     false,
			"requires_gold": false,
		}
	}

	cleaned, err := json.Marshal(root)
	if err != nil {
		return body
	}
	return cleaned
}
