# -*- coding: utf-8 -*-
"""
B1sTeam MITM Proxy — LocketGold

One-file runnable MITM HTTPS proxy for the LocketGold DNS system:
  · TLS intercept with per-SNI leaf certificate forging (B1sTeam Root CA)
  · Allowlist-only (mọi host khác → 403/insecure alert)
  · Rewrites Firebase RemoteConfig / RevenueCat / Locket API responses
  · Forwards generateFilteredImage to the B1sTeam frame worker (x-b1s-proxy-key)
  · changeProfileInfo → instant 200 Gold+Verified badge (no round trip)
  · /healthz for the watchdog

ENV:
  PORT              (default 443, dev 8443)
  BIND              (default 0.0.0.0; dùng 127.0.0.1 nếu chỉ serve LAN)
  CA_CERT           (default ca/b1steam-root-ca.crt)
  CA_KEY            (default ca/b1steam-root-ca.key)
  FRAME_WORKER_URL  (default — random edge trong FRAME_EDGES)
  PROXY_SHARED_KEY  (shared với frame worker — BẮT BUỘC để vẽ khung)
  MAX_BODY_BYTES    (default 12MB)

Run:  python mitm_proxy.py
"""
from __future__ import annotations

import json
import logging
import os
import random
import socket
import ssl
import tempfile
import threading
from datetime import datetime, timedelta, UTC
from http.server import BaseHTTPRequestHandler
from pathlib import Path

import requests
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("b1steam-proxy")

HERE = Path(__file__).resolve()
REPO = HERE.parents[2]  # public_b1s_locket

ALLOWED_HOSTS = {
    "api.locketcamera.com",
    "locketcamera.com",
    "cdn.locketcamera.com",
    "public.locketcamera.com",
    "api.locket.camera",
    "locket.camera",
    "us-central1-locket-4252a.cloudfunctions.net",
    "firebaseremoteconfig.googleapis.com",
    "firebaseremoteconfig.google.com",
    "api.revenuecat.com",
    "api.rc-backup.com",
    "rev.cat",
}
ALLOWED_SUFFIXES = (".locketcamera.com", ".locket.camera")

FRAME_EDGES = [
    "https://locket-filter-frame.b1s-locket02-b1steam.workers.dev",
    "https://locket-filter-frame.b1steam-edge-03.workers.dev",
    "https://locket-filter-frame.beslin.workers.dev",
    "https://locket-filter-frame.b1steam-edge-05.workers.dev",
]


def is_allowed_host(host: str) -> bool:
    h = (host or "").strip().lower().rstrip(".")
    if not h:
        return False
    if h in ALLOWED_HOSTS:
        return True
    return any(h.endswith(s) for s in ALLOWED_SUFFIXES)


# ───────────────────────────── Root CA & leaf forging ─────────────────────────────

_ca_cert: x509.Certificate | None = None
_ca_key = None
_leaf_cache: dict[str, tuple[x509.Certificate, object]] = {}
_leaf_lock = threading.Lock()
_ctx_counter = 0


def load_ca(cert_path: Path, key_path: Path) -> None:
    global _ca_cert, _ca_key
    certs = x509.load_pem_x509_certificates(cert_path.read_bytes())
    if not certs:
        raise SystemExit(f"Không tìm thấy certificate trong {cert_path}")
    _ca_cert = certs[0]
    try:
        _ca_key = serialization.load_pem_private_key(key_path.read_bytes(), password=None)
    except Exception as e:
        raise SystemExit(f"Không đọc được private key tại {key_path}: {e}") from e


def forge_leaf(host: str):
    with _leaf_lock:
        cached = _leaf_cache.get(host)
        if cached:
            return cached

    now = datetime.now(UTC).replace(microsecond=0)
    cn = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, host),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "B1sTeam"),
        x509.NameAttribute(NameOID.COUNTRY_NAME, "VN"),
    ])
    key = ec.generate_private_key(ec.SECP256R1())
    cert = (
        x509.CertificateBuilder()
        .subject_name(cn)
        .issuer_name(_ca_cert.subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(hours=1))
        .not_valid_after(now + timedelta(days=365))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True, key_encipherment=True, content_commitment=False,
                data_encipherment=False, key_agreement=False, key_cert_sign=False,
                crl_sign=False, encipher_only=False, decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(x509.ExtendedKeyUsage([x509.ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
        .add_extension(x509.SubjectAlternativeName([x509.DNSName(host)]), critical=False)
        .add_extension(
            x509.AuthorityKeyIdentifier.from_issuer_public_key(_ca_cert.public_key()),
            critical=False,
        )
    ).sign(_ca_key, hashes.SHA256())

    with _leaf_lock:
        if len(_leaf_cache) >= 500:
            _leaf_cache.clear()
        _leaf_cache[host] = (cert, key)
    return cert, key


def build_context_for(host: str) -> ssl.SSLContext | None:
    global _ctx_counter
    if not is_allowed_host(host):
        return None
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    cert_dir = Path(os.environ.get("MITM_CERT_TMPDIR") or Path(tempfile.gettempdir()) / "b1steam-certs")
    cert_dir.mkdir(parents=True, exist_ok=True)
    cert, key = forge_leaf(host)
    with _leaf_lock:
        _ctx_counter += 1
        token = _ctx_counter
    p_cert = cert_dir / f"leaf-{token}-cert.pem"
    p_key = cert_dir / f"leaf-{token}-key.pem"
    try:
        pem_chain = (
            cert.public_bytes(serialization.Encoding.PEM)
            + _ca_cert.public_bytes(serialization.Encoding.PEM)
        )
        pem_key = key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
        p_cert.write_bytes(pem_chain)
        p_key.write_bytes(pem_key)
        ctx.load_cert_chain(p_cert, p_key)
    finally:
        try:
            p_cert.unlink(missing_ok=True)
            p_key.unlink(missing_ok=True)
        except OSError:
            pass
    return ctx


# ───────────────────────────── ClientHello peek → chọn leaf theo SNI ──────────────────────────
# set_servername_callback không cho đổi context sau khi handshake bắt đầu,
# nên proxy tự đọc TLS record đầu tiên (ClientHello) bằng MSG_PEEK — kernel buffer
# không bị mất byte — phân tích SNI, chọn đúng leaf ký sẵn rồi mới wrap TLS.

def _recv_exactly_peek(sock, n: int) -> bytes:
    import time as _time
    deadline = _time.time() + 10.0
    buf = b""
    while len(buf) < n and _time.time() < deadline:
        try:
            chunk = sock.recv(n - len(buf), socket.MSG_PEEK)
        except BlockingIOError:
            _time.sleep(0.005)
            continue
        if not chunk:
            break
        if len(chunk) == len(buf):
            _time.sleep(0.005)
            continue
        buf = chunk  # PEEK luôn bắt đầu từ offset 0 — giữ chunk dài nhất thôi
    return buf


def parse_sni(buf: bytes) -> str | None:
    try:
        if len(buf) < 5:
            return None
        rec_len = int.from_bytes(buf[3:5], "big")
        if len(buf) < 5 + rec_len:
            return None
        pos = 5
        pos += 4            # handshake: type(1) + length(3)
        pos += 2 + 32       # client_version + random
        sess_len = buf[pos]; pos += 1 + sess_len
        cs_len = int.from_bytes(buf[pos:pos + 2], "big"); pos += 2 + cs_len
        comp_len = buf[pos]; pos += 1 + comp_len
        ext_len = int.from_bytes(buf[pos:pos + 2], "big"); pos += 2
        ext_end = pos + ext_len
        while pos + 4 <= ext_end:
            etype = int.from_bytes(buf[pos:pos + 2], "big")
            elen = int.from_bytes(buf[pos + 2:pos + 4], "big")
            val = buf[pos + 4:pos + 4 + elen]
            if etype == 0 and len(val) >= 5:  # server_name extension
                list_len = int.from_bytes(val[:2], "big")
                i = 2
                list_end = min(len(val), 2 + list_len)
                while i + 3 <= list_end:
                    ntype = val[i]
                    nlen = int.from_bytes(val[i + 1:i + 3], "big")
                    if ntype == 0:  # host_name
                        return val[i + 3:i + 3 + nlen].decode("ascii", "ignore").strip().lower().rstrip(".") or None
                    i += 3 + nlen
            pos += 4 + elen
    except Exception:
        return None
    return None


def peek_sni(sock) -> str | None:
    sock.settimeout(10)
    first = _recv_exactly_peek(sock, 5)
    if len(first) < 5:
        return None
    rec_len = int.from_bytes(first[3:5], "big")
    total = 5 + rec_len
    if total > 16384 + 5:
        return None
    buf = _recv_exactly_peek(sock, total)
    return parse_sni(buf)


def _send_tls_alert_and_close(sock, alert: int = 112) -> None:
    """Gửi TLS fatal alert (vd. unrecognized_name = 112) rồi đóng kết nối."""
    body = bytes([2, alert])  # 2 = fatal
    record = bytes([21, 3, 1]) + len(body).to_bytes(2, "big") + body
    try:
        sock.sendall(record)
    except OSError:
        pass


# ───────────────────────────── Payload builders ─────────────────────────────

GOLD_PROFILE_JSON = json.dumps({
    "data": {"badge": "locket_gold", "badge_tier": "gold", "is_gold": True, "success": True},
    "result": {"badge": "locket_gold", "badge_tier": "gold", "is_gold": True, "success": True},
}, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

GOLD_ENTITLEMENT = {
    "grace_period_expires_date": None,
    "purchase_date": "2024-01-01T00:00:00Z",
    "product_identifier": "locket_1600_1y",
    "expires_date": "9999-01-09T10:10:14Z",
}
GOLD_SUBSCRIPTION = {
    "auto_resume_date": None,
    "display_name": "locket_1600_1y",
    "is_sandbox": False,
    "ownership_type": "PURCHASED",
    "billing_issues_detected_at": None,
    "management_url": "https://apps.apple.com/account/subscriptions",
    "period_type": "normal",
    "price": {"amount": 399000.0, "currency": "VND"},
    "expires_date": "9999-01-09T10:10:14Z",
    "grace_period_expires_date": None,
    "refunded_at": None,
    "unsubscribe_detected_at": None,
    "original_purchase_date": "2024-01-01T00:00:00Z",
    "purchase_date": "2024-01-01T00:00:00Z",
    "store": "app_store",
    "store_transaction_id": "2000001108724193",
}


def inject_revenuecat(body: bytes) -> bytes:
    try:
        raw = json.loads(body)
    except Exception:
        raw = {}
    subs = raw.setdefault("subscriber", {})
    if not isinstance(subs, dict):
        subs = {}
        raw["subscriber"] = subs
    subscriptions = subs.get("subscriptions")
    if not isinstance(subscriptions, dict):
        subscriptions = {}
        subs["subscriptions"] = subscriptions
    entitlements = subs.get("entitlements")
    if not isinstance(entitlements, dict):
        entitlements = {}
        subs["entitlements"] = entitlements
    for k in ("locket_1600_1y", "com.locket02.premium.yearly", "locket_199_1m", "locket.premium.yearly"):
        subscriptions[k] = dict(GOLD_SUBSCRIPTION)
    for k in ("Gold", "gold", "pro", "premium", "locket_gold"):
        entitlements[k] = dict(GOLD_ENTITLEMENT)
    raw["Attention"] = "B1sTeam Activated (Gold Lifetime)!"
    return json.dumps(raw, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def inject_firebase(body: bytes) -> bytes:
    try:
        raw = json.loads(body)
    except Exception:
        raw = {}
    if not isinstance(raw, dict):
        raw = {}
    from firebase_overrides import FIREBASE_OVERRIDES  # generated module

    raw["Attention"] = "B1sTeam DNS Activated"
    raw["state"] = "UPDATE"
    raw["templateVersion"] = str(int(datetime.now(UTC).timestamp() * 1000))
    entries = raw.get("entries")
    if not isinstance(entries, dict):
        entries = {}
        raw["entries"] = entries
    for k, v in FIREBASE_OVERRIDES.items():
        entries[k] = v
    return json.dumps(raw, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def transform_node(node):
    if isinstance(node, dict):
        for k in list(node.keys()):
            lk = k.lower()
            if lk in {"is_gold", "is_premium", "unlocked", "is_subscribed", "has_access"}:
                node[k] = True
            elif lk in {
                "is_locked", "needs_gold", "requires_gold", "requires_subscription",
                "is_blurred", "blurred", "has_blur",
            }:
                node[k] = False
        for k in list(node.keys()):
            v = node[k]
            if isinstance(v, (dict, list)):
                transform_node(v)
        for clear, wrong in (("image_url", "blurred_url"), ("output_url", "blurred_url"), ("outputUrl", "blurred_url")):
            if clear in node and node.get(wrong):
                node[wrong] = node[clear]
                node["is_blurred"] = False
    elif isinstance(node, list):
        for item in node:
            transform_node(item)


def apply_gold_badge(m: dict) -> None:
    m["badge"] = "locket_gold"
    m["badge_tier"] = "gold"
    m["is_gold"] = True
    m["is_locked"] = False
    m["requires_gold"] = False


def rewrite_locket_api(body: bytes) -> bytes:
    try:
        raw = json.loads(body)
    except Exception:
        return body
    transform_node(raw)
    if isinstance(raw, dict):
        for sub in ("data", "result", "user"):
            if isinstance(raw.get(sub), dict):
                apply_gold_badge(raw[sub])
        apply_gold_badge(raw)
    return json.dumps(raw, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def overlay_filter_id(body: bytes) -> str:
    try:
        data = json.loads(body)
    except Exception:
        return ""
    if not isinstance(data, dict):
        return ""
    root = data.get("data") if isinstance(data.get("data"), dict) else data
    if isinstance(root, dict):
        for k in ("filter_id", "filterId", "filter_uid", "filterUid", "filter"):
            v = root.get(k)
            if isinstance(v, str) and v:
                return v
    for k in ("filter_id", "filterId"):
        v = data.get(k)
        if isinstance(v, str) and v:
            return v
    return ""


def is_overlay_filter(filter_id: str) -> bool:
    f = (filter_id or "").lower()
    return (
        f.startswith("khung_") or f.startswith("frame_") or f.startswith("pb_")
        or "photobooth" in f or "4cut" in f or "cmt_locket" in f or "sticker" in f
    )


def build_overlay_response(photo_url: str) -> bytes:
    resp = {
        "result": {
            "outputUrl": photo_url, "output_url": photo_url, "url": photo_url,
            "imageUrl": photo_url, "image_url": photo_url,
            "status": 200,
            "data": {
                "outputUrl": photo_url, "output_url": photo_url, "url": photo_url,
                "imageUrl": photo_url, "image_url": photo_url,
            },
        }
    }
    return json.dumps(resp, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def clean_filter_response(body: bytes) -> bytes:
    try:
        root = json.loads(body)
    except Exception:
        return body
    if not isinstance(root, dict):
        root = {"result": {}}
    root.pop("error", None)
    root.pop("errors", None)
    if isinstance(root.get("result"), dict):
        root["result"].pop("error", None)
        root["result"].pop("errors", None)
        root["result"]["status"] = 200
        root["result"]["is_locked"] = False
        root["result"]["requires_gold"] = False
        root["result"]["unlocked"] = True
    else:
        root["result"] = {"status": 200, "is_gold": True, "unlocked": True, "is_locked": False, "requires_gold": False}
    return json.dumps(root, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


# ───────────────────────────── HTTP plumbing ─────────────────────────────

MAX_BODY = int(os.environ.get("MAX_BODY_BYTES", str(12 * 1024 * 1024)))


def frame_edge() -> str:
    v = os.environ.get("FRAME_WORKER_URL", "").strip()
    return v.rstrip("/") if v else random.choice(FRAME_EDGES)


def proxy_key() -> str:
    return os.environ.get("PROXY_SHARED_KEY", "")


def is_media_ext(path: str) -> bool:
    p = path.lower().split("?")[0].split("#")[0]
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".gif", ".mp4", ".mov", ".m4a", ".mp3", ".pdf", ".zip"):
        if p.endswith(ext):
            return True
    return False


class Handler(BaseHTTPRequestHandler):
    server_version = "B1sTeamProxy/1.0"

    def log_message(self, fmt, *args):
        log.info("%s - %s", self.address_string(), fmt % args)

    def _sni_host(self) -> str:
        conn = self.connection
        host = getattr(conn, "sni_host", "") or ""
        if not host:
            host = (self.headers.get("Host") or "").strip().lower().rstrip(".")
        return host

    def _read_body(self) -> bytes:
        n = int(self.headers.get("Content-Length", "0") or 0)
        if n > MAX_BODY:
            self.send_error(413, "Payload too large")
            return b""
        return self.rfile.read(n) if n > 0 else b""

    def _send_bytes(self, status: int, body: bytes, content_type: str = "application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _call_upstream(self, method: str, host: str, path: str, body: bytes):
        hdrs = {}
        skip = {
            "host", "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
            "te", "trailers", "transfer-encoding", "upgrade", "if-none-match", "if-modified-since",
            "x-revenuecat-etag",
        }
        for k, v in self.headers.items():
            if k.lower() in skip:
                continue
            hdrs[k] = v
        hdrs["Host"] = host
        headers = dict(hdrs)

        try:
            resp = requests.request(
                method, f"https://{host}{path}", data=body if body else None, headers=headers,
                timeout=25, allow_redirects=False, verify=True,
            )
        except Exception as e:
            self._send_bytes(502, json.dumps({"error": {"message": "upstream_unreachable"}}).encode(), "application/json")
            log.error("upstream %s error: %s", host, str(e)[:200])
            return None

        content_type = resp.headers.get("Content-Type", "application/json; charset=utf-8")
        payload = resp.content
        path_lower = path.split("?")[0].lower()

        if "firebaseremoteconfig" in host and resp.status_code == 200:
            payload = inject_firebase(payload)
        elif host == "api.revenuecat.com" and resp.status_code == 200:
            payload = inject_revenuecat(payload)
        elif "locketcamera" in host or "locket.camera" in host or "cloudfunctions.net" in host:
            is_feed = any(k in path_lower for k in ("getfriends", "getusers", "fetchfriends", "getrecipients", "moments", "contacts"))
            if resp.status_code in (400, 402, 403) and not is_feed:
                payload = json.dumps({
                    "result": {"status": 200, "is_gold": True, "is_locked": False, "requires_gold": False, "unlocked": True},
                    "data": {"status": 200, "is_locked": False, "is_gold": True, "unlocked": True},
                    "error": None,
                }, separators=(",", ":"), ensure_ascii=False).encode()
                self._send_bytes(200, payload, content_type)
                return 200
            payload = rewrite_locket_api(payload)

        self._send_bytes(resp.status_code, payload, content_type)
        return resp.status_code

    def do_HEAD(self):
        self._handle_request("HEAD")

    def do_GET(self):
        self._handle_request("GET")

    def do_POST(self):
        self._handle_request("POST")

    def do_PUT(self):
        self._handle_request("PUT")

    def do_PATCH(self):
        self._handle_request("PATCH")

    def do_DELETE(self):
        self._handle_request("DELETE")

    def do_OPTIONS(self):
        self._handle_request("OPTIONS")

    def _handle_request(self, method: str):
        host = self._sni_host()

        # /healthz — cho watchdog, không cần SNI allowlist
        if self.path == "/healthz":
            self._send_bytes(200, b"ok", "text/plain; charset=utf-8")
            return

        if not host or not is_allowed_host(host):
            self._send_bytes(403, json.dumps({"error": {"message": "host not allowed"}}).encode(), "application/json")
            return

        path = self.path or "/"
        body = self._read_body() if method in ("POST", "PUT", "PATCH") else b""

        if "changeProfileInfo" in path:
            self._send_bytes(200, GOLD_PROFILE_JSON, "application/json; charset=utf-8")
            return

        if "generateFilteredImage" in path and method == "POST":
            photo_url = None
            try:
                data = json.loads(body)
                root = data.get("data") if isinstance(data.get("data"), dict) else data
                if isinstance(root, dict):
                    for k in ("imageUrl", "image_url", "inputUrl", "input_url", "url", "downloadUrl", "download_url"):
                        v = root.get(k)
                        if isinstance(v, str) and v:
                            photo_url = v
                            break
            except Exception:
                pass
            filter_id = overlay_filter_id(body)
            if photo_url and is_overlay_filter(filter_id):
                self._send_bytes(200, build_overlay_response(photo_url), "application/json; charset=utf-8")
                return
            try:
                fw = frame_edge()
                headers = {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "x-b1s-proxy-key": proxy_key(),
                    "X-B1s-Module-Origin": "B1sTeam",
                }
                r = requests.post(fw + "/apply-frame", data=body, headers=headers, timeout=30)
                self._send_bytes(r.status_code, clean_filter_response(r.content), "application/json; charset=utf-8")
                return
            except Exception as e:
                log.error("frame worker error: %s", str(e)[:200])
                self._send_bytes(502, json.dumps({"error": {"message": "frame worker unreachable"}}).encode(), "application/json; charset=utf-8")
                return

        self._call_upstream(method, host, path, body)


class _DummyServer:
    """Tối thiểu cho BaseHTTPRequestHandler (không dùng để serve)."""

    server_version = "B1sTeamProxy/1.0"

    def log_internal(self, fmt, *args):
        log.info(fmt, *args)


def _handle_connection(raw_sock, addr) -> None:
    try:
        host = peek_sni(raw_sock)
    except Exception:
        log.info("peek failed from %s", addr)
        host = None
    if not host or not is_allowed_host(host):
        log.warning("reject (no/invalid/disallowed SNI) from %s: %s", addr, host or "<none>")
        _send_tls_alert_and_close(raw_sock, 112)
        try:
            raw_sock.close()
        except OSError:
            pass
        return
    try:
        ctx = build_context_for(host)
        if ctx is None:
            raise ssl.SSLError("no context")
        tls_sock = ctx.wrap_socket(raw_sock, server_side=True)
        tls_sock.sni_host = host
    except ssl.SSLError as e:
        log.info("TLS handshake failed from %s (%s): %s", addr, host, str(e)[:120])
        try:
            raw_sock.close()
        except OSError:
            pass
        return
    except OSError:
        try:
            raw_sock.close()
        except OSError:
            pass
        return

    try:
        Handler(tls_sock, addr, _DummyServer())
    except (BrokenPipeError, ConnectionResetError, ssl.SSLError, TimeoutError):
        pass
    except Exception:
        log.exception("handler error from %s (%s)", addr, host)
    finally:
        try:
            tls_sock.close()
        except OSError:
            pass


def main():
    ca_cert = Path(os.environ.get("CA_CERT", REPO / "ca" / "b1steam-root-ca.crt"))
    ca_key = Path(os.environ.get("CA_KEY", REPO / "ca" / "b1steam-root-ca.key"))
    if not ca_cert.exists() or not ca_key.exists():
        raise SystemExit(f"Không tìm thấy Root CA tại {ca_cert} / {ca_key}")
    load_ca(ca_cert, ca_key)

    bind = os.environ.get("BIND", "0.0.0.0")
    port = int(os.environ.get("PORT", "443"))

    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    listener.bind((bind, port))
    listener.listen(256)
    log.info("B1sTeam MITM Proxy listening on %s:%d (TLS)", bind, port)
    try:
        while True:
            raw_sock, addr = listener.accept()
            threading.Thread(target=_handle_connection, args=(raw_sock, addr), daemon=True).start()
    except KeyboardInterrupt:
        log.info("shutdown")
    finally:
        listener.close()


if __name__ == "__main__":
    main()
