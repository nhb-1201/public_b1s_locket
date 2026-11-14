package main

import (
	"bytes"
	"crypto/tls"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"os"
	"strconv"
	"strings"
	"time"

	"locket-proxy/proxy/handler"
	tlspkg "locket-proxy/proxy/tls"
)

func getCAData() ([]byte, []byte, error) {
	crt := os.Getenv("ROOT_CA_CRT")
	key := os.Getenv("ROOT_CA_KEY")
	if crt != "" && key != "" {
		return []byte(crt), []byte(key), nil
	}

	crtBytes, err := os.ReadFile("ca/root-ca.crt")
	if err != nil {
		return nil, nil, err
	}
	keyBytes, err := os.ReadFile("ca/root-ca.key")
	if err != nil {
		return nil, nil, err
	}
	return crtBytes, keyBytes, nil
}

// frameWorkerURL is the B1sTeam image/frame worker that renders widget frames.
// Configure with FRAME_WORKER_URL (default: the official B1sTeam deployment).
func frameWorkerURL() string {
	if v := os.Getenv("FRAME_WORKER_URL"); v != "" {
		return strings.TrimRight(v, "/")
	}
	return "https://frame.b1s.id.vn"
}

// proxySharedKey la secret chia se giua MITM proxy va frame worker
// (header `x-b1s-proxy-key`). Dat qua bien moi truong PROXY_SHARED_KEY.
// Frame worker tu choi moi request khong co key -> moi request tu proxy deu
// phai duoc cau hinh day du, neu khong frame se khong chay.
func proxySharedKey() string {
	return strings.TrimSpace(os.Getenv("PROXY_SHARED_KEY"))
}

func main() {
	crtBytes, keyBytes, err := getCAData()
	if err != nil {
		log.Fatalf("failed to load root CA credentials: %v", err)
	}

	ca, err := tlspkg.LoadCA(crtBytes, keyBytes)
	if err != nil {
		log.Fatalf("failed to initialize CA: %v", err)
	}
	cache := tlspkg.NewCertCache(ca)

	// Static assets (stickers / frames) trong catalog filter -> tro ve CDN cua B1sTeam.
	log.Printf("Static asset CDN: %s", handler.SetAssetBaseURL(os.Getenv("ASSET_CDN_BASE")))
	if proxySharedKey() == "" {
		log.Printf("WARNING: PROXY_SHARED_KEY rong — frame worker se tu choi moi request /apply-frame (403). Hay dat secret khop voi locket-filter-frame.")
	}

	revProxy := &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			// Strip cache headers
			req.Header.Del("Accept-Encoding")
			req.Header.Del("If-None-Match")
			req.Header.Del("if-none-match")
			req.Header.Del("If-Modified-Since")
			req.Header.Del("if-modified-since")
			req.Header.Del("X-RevenueCat-ETag")
			req.Header.Del("x-revenuecat-etag")

			if strings.Contains(req.URL.Path, "generateFilteredImage") {
				frameHost := frameWorkerURL()
				req.URL.Scheme = "https"
				req.URL.Host = frameHost
				// Locket dung path rieng (vd: /v1/generateFilteredImage) nhung worker
				// phuc vu /apply-frame -> viec nay fix 404 truoc day.
				req.URL.Path = "/apply-frame"
				req.URL.RawPath = ""
				req.Host = frameHost
				req.Header.Set("Host", frameHost)
				// Xac thuc worker bang shared-key (khong dua license/key cua user).
				req.Header.Set("x-b1s-proxy-key", proxySharedKey())
				req.Header.Set("X-Module-Origin", "B1sTeam_FrameWorker")
				q := req.URL.Query()
				q.Set("module", "B1sTeam_FrameWorker")
				req.URL.RawQuery = q.Encode()
				return
			}

			req.URL.Scheme = "https"
			req.URL.Host = req.Host
		},
		ModifyResponse: func(resp *http.Response) error {
			host := resp.Request.Host
			path := resp.Request.URL.Path

			if strings.Contains(path, "generateFilteredImage") {
				body, err := io.ReadAll(resp.Body)
				if err != nil {
					return err
				}
				_ = resp.Body.Close()
				modBody := handler.CleanFilterResponse(body)
				resp.StatusCode = http.StatusOK
				resp.Body = io.NopCloser(bytes.NewReader(modBody))
				resp.ContentLength = int64(len(modBody))
				resp.Header.Set("Content-Length", strconv.Itoa(len(modBody)))
				resp.Header.Del("Content-Encoding")
				return nil
			}

			if resp.StatusCode != http.StatusOK && !strings.Contains(host, "locketcamera.com") {
				return nil
			}

			if strings.Contains(host, "firebaseremoteconfig.googleapis.com") {
				body, err := io.ReadAll(resp.Body)
				if err != nil {
					return err
				}
				_ = resp.Body.Close()
				modBody, err := handler.InjectFirebase(body)
				if err == nil {
					resp.Body = io.NopCloser(bytes.NewReader(modBody))
					resp.ContentLength = int64(len(modBody))
					resp.Header.Set("Content-Length", strconv.Itoa(len(modBody)))
				} else {
					resp.Body = io.NopCloser(bytes.NewReader(body))
				}
			} else if strings.Contains(host, "api.revenuecat.com") {
				body, err := io.ReadAll(resp.Body)
				if err != nil {
					return err
				}
				_ = resp.Body.Close()
				modBody, err := handler.InjectRevenueCat(body)
				if err == nil {
					resp.Body = io.NopCloser(bytes.NewReader(modBody))
					resp.ContentLength = int64(len(modBody))
					resp.Header.Set("Content-Length", strconv.Itoa(len(modBody)))
				} else {
					resp.Body = io.NopCloser(bytes.NewReader(body))
				}
			} else if strings.Contains(host, "locketcamera.com") {
				body, err := io.ReadAll(resp.Body)
				if err != nil {
					return err
				}
				_ = resp.Body.Close()

				isFriendsOrFeed := strings.Contains(path, "getFriends") ||
					strings.Contains(path, "getUsers") ||
					strings.Contains(path, "fetchFriends") ||
					strings.Contains(path, "getRecipients") ||
					strings.Contains(path, "moments") ||
					strings.Contains(path, "contacts")
				if !isFriendsOrFeed && (resp.StatusCode == 400 || resp.StatusCode == 402 || resp.StatusCode == 403) {
					resp.StatusCode = http.StatusOK
				}

				modBody := handler.RewriteLocketAPI(body)
				resp.Body = io.NopCloser(bytes.NewReader(modBody))
				resp.ContentLength = int64(len(modBody))
				resp.Header.Set("Content-Length", strconv.Itoa(len(modBody)))
				resp.Header.Del("Content-Encoding")
			}
			return nil
		},
		Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   30 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			ForceAttemptHTTP2:     true,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
		},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if handler.IsChangeProfileInfo(r.URL.Path) {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(handler.ChangeProfileInfoMockResponse())
			return
		}
		if strings.Contains(r.URL.Path, "generateFilteredImage") && r.Body != nil {
			bodyBytes, err := io.ReadAll(r.Body)
			if err == nil {
				r.Body = io.NopCloser(bytes.NewReader(bodyBytes))
				photoURL, filterID := handler.ExtractPhotoURLAndFilterID(bodyBytes)
				if photoURL != "" && handler.IsOverlayOrPhotoboothFilter(filterID) {
					w.Header().Set("Content-Type", "application/json; charset=utf-8")
					w.Header().Set("Access-Control-Allow-Origin", "*")
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write(handler.BuildMockFilterResponse(photoURL))
					return
				}
			}
		}
		revProxy.ServeHTTP(w, r)
	})

	tlsConfig := &tls.Config{
		GetConfigForClient: func(hello *tls.ClientHelloInfo) (*tls.Config, error) {
			host := hello.ServerName
			if host == "" {
				host = "firebaseremoteconfig.googleapis.com"
			}
			cert, err := cache.GetOrForge(host)
			if err != nil {
				return nil, err
			}
			return &tls.Config{
				Certificates: []tls.Certificate{*cert},
			}, nil
		},
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8443"
	}

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		TLSConfig:    tlsConfig,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	log.Printf("B1sTeam MITM Proxy listening on :%s (TLS)", port)
	ln, err := tls.Listen("tcp", server.Addr, tlsConfig)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}
	if err := server.Serve(ln); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
}
