/**
 * B1sTeam — LocketGold (Free)
 * Rotating frame worker.
 *
 * Routes:
 *   GET /frames      -> JSON catalog of every frame
 *   GET /f/:id       -> the PNG bytes (KV / R2 binding) or a 1x1 placeholder
 *   GET /health      -> {"ok":true,"worker":"b1steam-frames"}
 *
 * The worker never returns a 5xx for a missing asset: a transparent 1x1 PNG
 * is served instead so the mobile app always has something to render.
 */

import { FRAMES, CATALOG_VERSION, PLACEHOLDER_PNG_BASE64, findFrame, groupCounts } from './catalog.ts';
import type { FrameEntry } from './catalog.ts';

/** Minimal KV binding contract (no @cloudflare/workers-types dependency). */
interface KVNamespaceLike {
  get(key: string, type?: 'text' | 'arrayBuffer' | 'stream'): Promise<string | ArrayBuffer | ReadableStream | null>;
}

/** Minimal R2 binding contract. */
interface R2BucketLike {
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
}

/** Bindings available to the worker. */
interface Env {
  /** KV namespace holding the PNG assets (base64 strings). */
  FRAMES?: KVNamespaceLike;
  /** R2 bucket holding the PNG assets (binary). */
  FRAMES_BUCKET?: R2BucketLike;
  /** Raw GitHub base used when neither KV nor R2 is bound. */
  ASSET_RAW_BASE?: string;
}

/** Default raw base — repo public_b1s_locket, nhánh main. */
const DEFAULT_ASSET_RAW_BASE = 'https://raw.githubusercontent.com/nhb-1201/public_b1s_locket/main';

/** Worker name reported by /health. */
const WORKER_NAME = 'b1steam-frames';

/** TTL of the cached frames (seconds). */
const FRAME_TTL = 86400;

/**
 * Build the shared response headers.
 *
 * @param extra
 */
function baseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Cache-Control': `public, max-age=${FRAME_TTL}`,
    'X-B1s-Worker': WORKER_NAME,
    ...extra,
  };
}

/**
 * JSON response helper.
 *
 * @param payload
 * @param status
 */
function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: baseHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
  });
}

/**
 * Decode a base64 string into bytes.
 *
 * @param value
 */
function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Bytes of the 1x1 transparent placeholder PNG. */
const PLACEHOLDER_PNG = base64ToBytes(PLACEHOLDER_PNG_BASE64);

/**
 * Load the bytes of a frame from the KV / R2 binding.
 *
 * @param frame
 * @param env
 * @returns {Promise<Uint8Array|null>}
 */
async function loadFrameBytes(frame: FrameEntry, env: Env): Promise<Uint8Array | null> {
  const keys = [frame.id, frame.file, `frames/${frame.file}`, `frames/${frame.id}`];

  if (env.FRAMES) {
    for (const key of keys) {
      try {
        const stored = await env.FRAMES.get(key, 'arrayBuffer');
        if (stored) return new Uint8Array(stored as ArrayBuffer);
      } catch (_err) {
        // try the next key
      }
    }
  }

  if (env.FRAMES_BUCKET) {
    for (const key of keys) {
      try {
        const object = await env.FRAMES_BUCKET.get(key);
        if (object) return new Uint8Array(await object.arrayBuffer());
      } catch (_err) {
        // try the next key
      }
    }
  }

  // Fallback: lấy ảnh trực tiếp từ repo công khai (không cần KV/R2).
  const rawBase = (env.ASSET_RAW_BASE || DEFAULT_ASSET_RAW_BASE).replace(/\/+$/, '');
  try {
    const res = await fetch(`${rawBase}/assets/frames/${encodeURIComponent(frame.file)}`, {
      cf: { cacheTtl: 86400, cacheEverything: true },
    });
    if (res.ok) {
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length > 0) return buf;
    }
  } catch (_err) {
    // không có mạng / asset sai → placeholder
  }

  return null;
}

/**
 * Serve the catalog.
 *
 * @param url
 */
function handleCatalog(url: URL): Response {
  const group = (url.searchParams.get('group') || '').trim();
  const premium = url.searchParams.get('premium');

  let frames = FRAMES.slice();
  if (group) {
    frames = frames.filter((frame) => frame.group.toLowerCase() === group.toLowerCase());
  }
  if (premium === '1' || premium === 'true') {
    frames = frames.filter((frame) => frame.premium);
  }
  if (premium === '0' || premium === 'false') {
    frames = frames.filter((frame) => !frame.premium);
  }

  return jsonResponse({
    ok: true,
    worker: WORKER_NAME,
    version: CATALOG_VERSION,
    count: frames.length,
    groups: groupCounts(),
    frames,
  });
}

/**
 * Serve the PNG of a frame.
 *
 * @param id
 * @param env
 */
async function handleFrame(id: string, env: Env): Promise<Response> {
  const frame = findFrame(id);
  if (!frame) {
    // Unknown slug -> placeholder (never a hard failure).
    return new Response(PLACEHOLDER_PNG, {
      status: 200,
      headers: baseHeaders({
        'Content-Type': 'image/png',
        'X-B1s-Frame': 'placeholder',
      }),
    });
  }

  const bytes = await loadFrameBytes(frame, env);
  if (!bytes || bytes.length === 0) {
    return new Response(PLACEHOLDER_PNG, {
      status: 200,
      headers: baseHeaders({
        'Content-Type': 'image/png',
        'X-B1s-Frame': 'placeholder',
      }),
    });
  }

  return new Response(bytes, {
    status: 200,
    headers: baseHeaders({
      'Content-Type': 'image/png',
      'X-B1s-Frame': frame.id,
    }),
  });
}

export default {
  /**
   * Worker entrypoint.
   *
   * @param request
   * @param env
   */
  async fetch(request: Request, env: Env = {}): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: baseHeaders() });
    }

    if (pathname === '/health' || pathname === '/healthz') {
      return jsonResponse({ ok: true, worker: WORKER_NAME, version: CATALOG_VERSION });
    }

    if (pathname === '/frames' || pathname === '/frames/') {
      return handleCatalog(url);
    }

    const frameMatch = /^\/f\/([A-Za-z0-9._-]{1,120})$/.exec(pathname);
    if (frameMatch) {
      return handleFrame(frameMatch[1], env);
    }

    return jsonResponse({ ok: false, error: 'Not found', worker: WORKER_NAME }, 404);
  },
};

export { FRAMES, CATALOG_VERSION, findFrame, groupCounts };
