// B1sTeam - locket-filter-frame (frame.b1s.id.vn) - TypeScript
// Worker VE KHUNG KAWAII len anh user chup (KHONG AI):
//   user chon bo loc khung trong Locket -> app goi generateFilteredImage ->
//   MITM (proxy) route request toi worker nay ->
//   worker tai anh tu input_url (CDN Locket) -> resize ve 1:1 -> ve khung len ->
//   tra anh da khung dung format response cua Locket (result.outputUrl).
//
// BAO MAT: worker chi chap nhan request tu MITM proxy cua B1sTeam (header
// `x-b1s-proxy-key` = secret chia se, dat qua `wrangler secret put PROXY_SHARED_KEY`).
// Worker KHONG kiem tra giay phep cua user - app da bi chan/mo khoa tai tang DNS + MITM.
// KHONG luu anh - anh di thang qua memory.
// B1sTeam - b1s.id.vn · Nguyen Hoang Bach

import { PhotonImage, SamplingFilter, crop, resize, watermark } from "@cf-wasm/photon/workerd";

import { FRAMES, FRAME_B64, FRAME_URLS, EMBEDDED } from "./frames-data";

interface Env { PROXY_SHARED_KEY?: string; ASSET_RAW_BASE?: string; }

export interface ExecutionContext { waitUntil(promise: Promise<unknown>): void }

const frameBytesCache = new Map<string, Uint8Array>();

async function loadFrame(name: string): Promise<PhotonImage | null> {
  if (EMBEDDED[name]) return PhotonImage.new_from_base64(EMBEDDED[name]);
  const url = FRAME_URLS[name];
  if (!url) return null;
  let buf = frameBytesCache.get(name);
  if (!buf) {
    const r = await fetch(url, { cf: { cacheTtl: 86400, cacheEverything: true } } as unknown as RequestInit);
    if (!r.ok) return null;
    buf = new Uint8Array(await r.arrayBuffer());
    frameBytesCache.set(name, buf);
  }
  return PhotonImage.new_from_byteslice(buf);
}

function frameNameForFid(fid: string): string {
  const f = String(fid || "").toLowerCase();
  for (let i = 1; i <= 7; i++) {
    const n = "0" + i;
    if (f.includes("kawaii_" + n) || f.includes("frame_" + n) || f.includes("kawaii" + n) || f.includes("k_" + n)) return "frame-" + n;
  }
  if (/valentine|frame-08/.test(f)) return "frame-08-valentine";
  if (/christmas|xmas|frame-09/.test(f)) return "frame-09-christmas";
  if (/halloween|frame-10/.test(f)) return "frame-10-halloween";
  if (/neon|frame-11/.test(f)) return "frame-11-neon";
  if (/crayon|frame-14/.test(f)) return "frame-14-crayon";
  if (/pastel|frame-13/.test(f)) return "frame-13-pastel";
  if (/gold|crown|frame-12/.test(f)) return "frame-12-gold";
  return "frame-12-gold";
}

// Proxy shared-key gate — worker CHỈ phục vụ MITM proxy của B1sTeam.
// So khớp thô (không lộ key theo độ dài) và fail-closed nếu secret chưa được cấu hình.
function verifyProxyKey(req: Request, env: Env): boolean {
  const expected = (env.PROXY_SHARED_KEY || "").trim();
  if (expected.length < 16) return false;
  const provided = (req.headers.get("x-b1s-proxy-key") || "").trim();
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}

function sq(img: PhotonImage): PhotonImage {
  // cover-crop về vuông 1024x1024
  const w = img.get_width(), h = img.get_height();
  const side = Math.min(w, h);
  const x = Math.floor((w - side) / 2), y = Math.floor((h - side) / 2);
  const cropped = crop(img, x, y, x + side, y + side);
  try { img.free(); } catch (e) {}
  return resize(cropped, 1024, 1024, SamplingFilter.Lanczos3);
}

function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** base64 (có thể kèm data: prefix) → Uint8Array. */
function b64ToBytes(b64: string): Uint8Array {
  const clean = String(b64 || "")
    .replace(/^data:[^;]+;base64,/, "")
    .replace(/[^A-Za-z0-9+/=]/g, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Vẽ khung Kawaii lên ảnh. Trả { b64, frameName, width, height } — b64 là PNG.
 * Không lưu ảnh — mọi thứ trong memory.
 */
async function frameImage(imgBytes: Uint8Array, filterId: string): Promise<{ b64: string; frameName: string; width: number; height: number }> {
  const src = PhotonImage.new_from_byteslice(imgBytes);
  const sqImg = sq(src);
  const frameName = frameNameForFid(filterId);
  let frame = null;
  try { frame = await loadFrame(frameName); } catch (e) { console.log("[frame] loadFrame lỗi:", String(e).slice(0, 80)); }
  if (!frame && frameName !== "frame-12-gold") {
    try { frame = await loadFrame("frame-12-gold"); } catch (e) {}
  }
  // Khung kích thước khác 1024² (vd frame-01..07 = 1254²) → resize về đúng 1024² trước khi watermark
  try {
    if (frame && (frame.get_width() !== 1024 || frame.get_height() !== 1024)) {
      const resized = resize(frame, 1024, 1024, SamplingFilter.Lanczos3);
      try { frame.free(); } catch (e) {}
      frame = resized;
    }
  } catch (e) { console.log("[frame] resize lỗi:", String(e).slice(0, 80)); }
  try {
    if (frame) watermark(sqImg, frame, BigInt(0), BigInt(0));
    const w = sqImg.get_width(), h = sqImg.get_height();
    const outB64 = String(sqImg.get_base64());
    return { b64: outB64, frameName, width: w, height: h };
  } finally {
    try { frame && frame.free(); } catch (e) {}
    try { sqImg.free(); } catch (e) {}
  }
}

/** Version + ngày build — hiện trong /health. */
const FRAME_VERSION = "1.4.0";
const FRAME_BUILD_DATE = "2026-11-14";
const FRAME_BUILD_AT = "2026-11-14T10:00:00Z";

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({
        ok: true, service: "locket-filter-frame", version: FRAME_VERSION,
        updated: FRAME_BUILD_DATE, builtAt: FRAME_BUILD_AT,
      }), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
    }

    // /assets/* — URL trong camera_filter_config tro vao day.
    // File nhi phan nam trong repo locket-gold-hub (raw.githubusercontent.com) → 301 redirect.
    if (url.pathname.startsWith("/assets/")) {
      const base = (env.ASSET_RAW_BASE || "https://raw.githubusercontent.com/Xwuan19/locket-gold-hub/main").replace(/\/+$/, "");
      return new Response(null, {
        status: 301,
        headers: {
          Location: base + url.pathname,
          "Cache-Control": "public, max-age=86400",
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    if (url.pathname === "/frame-raw") {
      // Ảnh nhị phân từ MITM (upload Locket) → khung Kawaii → base64 PNG
      return await handleFrameRaw(req, env);
    }

    if (url.pathname !== "/apply-frame") {
      return jsonResponse({ error: "not_found" }, 404);
    }

    // Pure DNS + MITM shared-key — không còn license riêng.
    if (!verifyProxyKey(req, env)) {
      return jsonResponse({ result: { status: 403, errors: ["proxy required"], is_gold: false, requires_gold: true }, error: { message: "proxy required", status: "PERMISSION_DENIED" } }, 403);
    }

    let body: Record<string, unknown> | null = null;
    try { body = (await req.json()) as Record<string, unknown>; } catch { body = null; }
    if (!body || typeof body !== "object") return jsonResponse({ error: "bad_body" }, 400);

    const fid = String(body.filter_id || body.filterId || body.id || "").toLowerCase();
    const inputUrl = String(body.input_url || body.imageUrl || body.image_url || body.url || "");
    if (!/^https?:\/\//i.test(inputUrl)) return jsonResponse({ error: { message: "input_url required", status: "INVALID_ARGUMENT" } }, 400);

    // Tải ảnh nguồn
    let imgBytes;
    try {
      const r = await fetch(inputUrl, { headers: { "User-Agent": "Locket/3938" } });
      if (!r.ok) return jsonResponse({ error: { message: "fetch upstream failed", status: "UPSTREAM_ERROR" } }, 502);
      imgBytes = new Uint8Array(await r.arrayBuffer());
    } catch (e) {
      return jsonResponse({ error: { message: "fetch upstream failed", status: "UPSTREAM_ERROR" } }, 502);
    }

    let out;
    try {
      out = await frameImage(imgBytes, fid);
      const dataUrl = out.b64.startsWith("data:") ? out.b64 : "data:image/png;base64," + out.b64;
      return jsonResponse({
        ok: true,
        frame: out.frameName,
        width: out.width,
        height: out.height,
        result: {
          outputUrl: dataUrl, output_url: dataUrl, url: dataUrl, imageUrl: dataUrl, image_url: dataUrl,
          status: 200, is_locked: false, is_gold: true, is_premium: true,
          requires_gold: false, requires_subscription: false, is_subscribed: true, unlocked: true,
          data: { outputUrl: dataUrl, output_url: dataUrl, imageUrl: dataUrl, image_url: dataUrl, url: dataUrl, status: 200 },
        },
      });
    } catch (e) {
      return jsonResponse({ error: { message: "process failed: " + String(e).slice(0, 120), status: "INTERNAL" } }, 500);
    }
  },
};

/**
 * /frame-raw — nhận ảnh nhị phân từ MITM (upload Locket chụp xong, TRƯỚC khi rời máy).
 * POST
 *   headers: x-b1s-proxy-key   (bắt buộc — secret chia sẻ với MITM proxy)
 *   body:    { image_base64: "<base64 PNG/JPEG>", filter_id?: "khung_gold" | … }
 * → 200 { ok: true, frame, width, height, content_type: "image/png", image_base64 }
 *   403 proxy key sai · 400 thiếu/hỏng ảnh · 413 quá lớn
 * KHÔNG lưu ảnh — ảnh đi thẳng qua memory.
 */
async function handleFrameRaw(req: Request, env: Env): Promise<Response> {
  if (!verifyProxyKey(req, env)) {
    return jsonResponse({ ok: false, error: { message: "proxy required", status: "PERMISSION_DENIED" } }, 403);
  }

  let body: Record<string, unknown> | null = null;
  try { body = (await req.json()) as Record<string, unknown>; } catch { body = null; }
  if (!body || typeof body !== "object") {
    return jsonResponse({ ok: false, error: { message: "bad_body", status: "INVALID_ARGUMENT" } }, 400);
  }
  const b64in = String(body.image_base64 || body.imageBase64 || "");
  if (b64in.length < 64) {
    return jsonResponse({ ok: false, error: { message: "image_base64 required", status: "INVALID_ARGUMENT" } }, 400);
  }
  let bytes;
  try {
    bytes = b64ToBytes(b64in);
  } catch (e) {
    return jsonResponse({ ok: false, error: { message: "image_base64 invalid", status: "INVALID_ARGUMENT" } }, 400);
  }
  if (!bytes.length || bytes.length > 15 * 1024 * 1024) {
    return jsonResponse({ ok: false, error: { message: "image_too_big", status: "INVALID_ARGUMENT" } }, 413);
  }

  try {
    const fid = String(body.filter_id || body.filterId || "khung_gold").toLowerCase();
    const out = await frameImage(bytes, fid);
    return jsonResponse({
      ok: true,
      frame: out.frameName,
      width: out.width,
      height: out.height,
      content_type: "image/png",
      image_base64: String(out.b64).replace(/^data:[^;]+;base64,/, ""),
    });
  } catch (e) {
    return jsonResponse({ ok: false, error: { message: "process failed: " + String(e).slice(0, 120), status: "INTERNAL" } }, 500);
  }
}
