# -*- coding: utf-8 -*-
"""
B1sTeam LocketGold — MITM Proxy Watchdog

Chạy trực tiếp trên máy (Windows) qua Task Scheduler:

  pythonw.exe proxy/watchdog.py

Chu trình:
  1. Nạp secrets từ `proxy/proxy.env` (PROXY_SHARED_KEY, PORT, BIND, ...) — file này gitignored.
  2. Start proxy (`proxy/python/mitm_proxy.py`) và giữ handle.
  3. Mỗi vòng lặp: sleep ngẫu nhiên 600–900 giây, sau đó:
       • nếu process proxy chết → start lại;
       • nếu /healthz trả sai → giết + start lại;
       • nếu /healthz đúng → ghi 1 dòng log.
  4. Log vào `proxy/watchdog.log` (xoay vòng khi > 5MB).

Task Scheduler (xem Install-AutoStart.ps1) đảm bảo watchdog tự chạy lại khi máy khởi động
và khi watchdog bị treo quá 60s (Task Scheduler restart action).
"""

from __future__ import annotations

import os
import random
import re
import signal
import socket
import ssl
import subprocess
import sys
import time
from datetime import datetime, UTC
from pathlib import Path

HERE = Path(__file__).resolve()
ROOT = HERE.parents[1]  # public_b1s_locket
PROXY_SCRIPT = ROOT / "proxy" / "python" / "mitm_proxy.py"
ENV_FILE = ROOT / "proxy" / "proxy.env"
CA_FILE = ROOT / "ca" / "b1steam-root-ca.crt"
LOG = ROOT / "proxy" / "watchdog.log"
HEALTH_SNI = "api.revenuecat.com"  # SNI hợp lệ; client tin CA vì .mobileconfig đã cài Root CA

HEALTH_MIN_SEC = 600
HEALTH_MAX_SEC = 900
MAX_LOG_BYTES = 5 * 1024 * 1024


def log(msg: str) -> None:
    ts = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
    line = f"{ts} {msg}"
    try:
        if LOG.exists() and LOG.stat().st_size > MAX_LOG_BYTES:
            bak = LOG.with_suffix(".log.1")
            try:
                bak.unlink(missing_ok=True)
            except OSError:
                pass
            LOG.rename(bak)
    except OSError:
        pass
    try:
        with LOG.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        print(line, flush=True)
    print(line, flush=True)


def load_env() -> dict:
    env = dict(os.environ)
    if ENV_FILE.exists():
        for raw in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
            if not m:
                continue
            key, value = m.group(1), m.group(2).strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                value = value[1:-1]
            env[key] = value
    return env


def proxy_env() -> dict:
    env = load_env()
    env.setdefault("PORT", "443")
    env.setdefault("BIND", "0.0.0.0")
    return env


def health_port(env: dict) -> int:
    ports = (env.get("PORTS") or "").strip()
    if ports:
        first = ports.split(",")[0].strip()
        if first.isdigit():
            return int(first)
    return int(env.get("PORT", "443"))


def start_proxy(env: dict) -> subprocess.Popen:
    cmd = [sys.executable, str(PROXY_SCRIPT)]
    if sys.platform == "win32":
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
        return subprocess.Popen(cmd, cwd=str(PROXY_SCRIPT.parent), env=env, creationflags=creationflags)
    return subprocess.Popen(cmd, cwd=str(PROXY_SCRIPT.parent), env=env, start_new_session=True)


def health_once(port: int, timeout: float = 10.0) -> bool:
    """Kết nối thẳng tới proxy (hoặc LAN IP): TLS + SNI hợp lệ + GET /healthz → 'ok'."""
    try:
        ctx = ssl.create_default_context(ssl.Purpose.SERVER_AUTH, cafile=str(CA_FILE))
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        raw = socket.create_connection(("127.0.0.1", port), timeout=timeout)
        sock = ctx.wrap_socket(raw, server_hostname=HEALTH_SNI)
        sock.settimeout(timeout)
        req = (
            f"GET /healthz HTTP/1.1\r\nHost: {HEALTH_SNI}\r\nConnection: close\r\n\r\n"
        ).encode("ascii")
        sock.sendall(req)
        chunks = []
        while True:
            try:
                chunk = sock.recv(4096)
            except (socket.timeout, TimeoutError):
                break
            if not chunk:
                break
            chunks.append(chunk)
        sock.close()
        body = b"".join(chunks)
        return b"\r\n\r\n" in body and body.rstrip().endswith(b"ok")
    except Exception as e:
        log(f"health check exception: {e!r}")
        return False


def main() -> None:
    env = proxy_env()
    port = health_port(env)
    public_ip = "unknown"
    try:
        sys.path.insert(0, str(PROXY_SCRIPT.parent))
        import public_ip as _public_ip
        public_ip = _public_ip.detect_public_ip(ttl=600) or "unavailable"
    except Exception as e:
        public_ip = f"error ({e})"
    log(f"watchdog start — proxy={PROXY_SCRIPT} health_port={port} public_ip={public_ip}")

    if not PROXY_SCRIPT.exists():
        log(f"FATAL: proxy script not found at {PROXY_SCRIPT}")
        sys.exit(2)
    if not CA_FILE.exists():
        log(f"FATAL: Root CA not found at {CA_FILE}")
        sys.exit(2)
    if not env.get("PROXY_SHARED_KEY"):
        log("WARN: PROXY_SHARED_KEY chưa đặt — frame worker sẽ từ chối vẽ khung (xem proxy.env).")

    proc = start_proxy(env)
    log(f"proxy started pid={proc.pid}")
    time.sleep(2)  # cho proxy bind port

    consecutive_failures = 0
    while True:
        interval = random.uniform(HEALTH_MIN_SEC, HEALTH_MAX_SEC)
        deadline = time.time() + interval
        while time.time() < deadline:
            # Proxy chết trong lúc chờ → restart ngay, không cần chờ hết interval
            rc = proc.poll()
            if rc is not None:
                log(f"proxy died (exit={rc}) — restart")
                proc = start_proxy(env)
                log(f"proxy restarted pid={proc.pid}")
                consecutive_failures = 0
            time.sleep(2)

        ok = health_once(port)
        if ok:
            consecutive_failures = 0
            log("healthz ok")
            continue

        consecutive_failures += 1
        log(f"healthz FAIL ({consecutive_failures})")
        if consecutive_failures >= 2:
            log("healthz fail x2 — restart proxy")
            try:
                if proc.poll() is None:
                    if sys.platform == "win32":
                        proc.terminate()
                        time.sleep(3)
                        if proc.poll() is None:
                            proc.kill()
                    else:
                        os.killpg(proc.pid, signal.SIGTERM)
                        time.sleep(3)
                        if proc.poll() is None:
                            os.killpg(proc.pid, signal.SIGKILL)
            except Exception as e:
                log(f"kill proxy error: {e!r}")
            proc = start_proxy(env)
            log(f"proxy restarted pid={proc.pid}")
            consecutive_failures = 0


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
