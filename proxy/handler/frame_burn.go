package handler

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"strings"
	"time"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp" // decode .webp (Locket CDN hay phục vụ webp)
)

// maxFrameDownload giới hạn kích thước ảnh tải về (25 MB).
const maxFrameDownload = 25 << 20

// BurnFrame tải photoURL (ảnh chụp Locket) + frameURL (khung từ RC config) →
// compose khung lên ảnh → trả về body JSON chuẩn Locket (result.outputUrl =
// data:image/jpeg;base64). Đây là đường compositing SERVER-SIDE — bản Locket
// trên App Store không tự vẽ overlay tại thời điểm chụp.
//
// Frame được vẽ đè lên ảnh vuông 1024×1024 (cover-crop). Nếu frame không khớp
// 1024×1024 thì được scale về đúng 1024×1024.
func BurnFrame(ctx context.Context, photoURL, frameURL string) ([]byte, error) {
	if !strings.HasPrefix(strings.ToLower(strings.TrimSpace(photoURL)), "http") {
		return nil, fmt.Errorf("photoURL không hợp lệ")
	}
	if !strings.HasPrefix(strings.ToLower(strings.TrimSpace(frameURL)), "https://") {
		return nil, fmt.Errorf("frameURL phải là https")
	}

	c, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	photo, err := fetchAndDecode(c, photoURL)
	if err != nil {
		return nil, err
	}
	frame, err := fetchAndDecode(c, frameURL)
	if err != nil {
		return nil, err
	}

	// cover-crop ảnh chụp về vuông rồi resize 1024×1024 (ApproxBiLinear — nhẹ RAM hơn CatmullRom trên VM 256-512MB)
	pw, ph := photo.Bounds().Dx(), photo.Bounds().Dy()
	var photoSquare *image.RGBA
	if pw == 1024 && ph == 1024 {
		// fast path: không cần crop/scale
		rgba, ok := photo.(*image.RGBA)
		if !ok {
			rgba = image.NewRGBA(image.Rect(0, 0, 1024, 1024))
			draw.Draw(rgba, rgba.Bounds(), photo, image.Point{}, draw.Over)
		}
		photoSquare = rgba
	} else {
		side := pw
		if ph < side {
			side = ph
		}
		x0 := (pw - side) / 2
		y0 := (ph - side) / 2
		photoSquare = image.NewRGBA(image.Rect(0, 0, 1024, 1024))
		draw.ApproxBiLinear.Scale(photoSquare, photoSquare.Bounds(), photo, image.Rect(x0, y0, x0+side, y0+side), draw.Over, nil)
	}

	// frame → 1024×1024 nếu khác size
	fw, fh := frame.Bounds().Dx(), frame.Bounds().Dy()
	if fw != 1024 || fh != 1024 {
		fresized := image.NewRGBA(image.Rect(0, 0, 1024, 1024))
		draw.ApproxBiLinear.Scale(fresized, fresized.Bounds(), frame, frame.Bounds(), draw.Over, nil)
		frame = fresized
	}

	// vẽ khung lên ảnh (giữ alpha của frame)
	draw.Draw(photoSquare, photoSquare.Bounds(), frame, image.Point{}, draw.Over)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, photoSquare, &jpeg.Options{Quality: 90}); err != nil {
		return nil, err
	}
	dataURL := "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())
	return locketLikeJSON(dataURL, 1024, 1024)
}

func fetchAndDecode(ctx context.Context, url string) (image.Image, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Locket/3938")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxFrameDownload))
	if err != nil {
		return nil, err
	}
	img, _, err := image.Decode(bytes.NewReader(body))
	if err != nil {
		// PNG trong trường hợp WebP lỗi → thử decode riêng (image.Decode đã bao gồm png+webp qua blank imports)
		if img2, pngErr := png.Decode(bytes.NewReader(body)); pngErr == nil {
			return img2, nil
		}
		return nil, err
	}
	return img, nil
}

// locketLikeJSON đóng gói ảnh thành response "Locket-shaped".
func locketLikeJSON(dataURL string, width, height int) ([]byte, error) {
	inner := map[string]any{
		"outputUrl":  dataURL,
		"output_url": dataURL,
		"url":        dataURL,
		"imageUrl":   dataURL,
		"image_url":  dataURL,
		"status":     200,
		"data": map[string]any{
			"outputUrl":  dataURL,
			"output_url": dataURL,
			"url":        dataURL,
			"imageUrl":   dataURL,
			"image_url":  dataURL,
			"status":     200,
		},
	}
	result := map[string]any{
		"outputUrl":            dataURL,
		"output_url":           dataURL,
		"url":                  dataURL,
		"imageUrl":             dataURL,
		"image_url":            dataURL,
		"status":               200,
		"is_locked":            false,
		"is_gold":              true,
		"is_premium":           true,
		"requires_gold":        false,
		"requires_subscription": false,
		"is_subscribed":        true,
		"unlocked":             true,
		"data":                 inner["data"],
	}
	resp := map[string]any{
		"ok":     true,
		"frame":  "burned",
		"width":  width,
		"height": height,
		"result": result,
		"data":   inner,
	}
	return json.Marshal(resp)
}
