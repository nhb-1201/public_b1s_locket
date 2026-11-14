# -*- coding: utf-8 -*-
"""
B1sTeam — phát hiện IP công khai của máy (IP động).

Cache 300s tại `proxy/.public-ip` để không spam dịch vụ ngoài.
"""
from __future__ import annotations

import ipaddress
import time
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CACHE = REPO / "proxy" / ".public-ip"

_PROVIDERS = (
    "https://api.ipify.org",
    "https://ifconfig.me/ip",
    "https://api.myip.com/v4",  # JSON {"ip": "..."} — decode đặc biệt
)


def _parse_provider_response(url: str, raw: bytes) -> str | None:
    text = raw.decode("utf-8", "ignore").strip()
    if url.startswith("https://api.myip.com"):
        try:
            import json
            text = json.loads(text).get("ip", "")
        except Exception:
            return None
    try:
        return str(ipaddress.ip_address(text))
    except ValueError:
        return None


def detect_public_ip(ttl: int = 300, force: bool = False) -> str | None:
    now = time.time()
    if not force:
        try:
            ip, ts = CACHE.read_text(encoding="utf-8").split()
            if now - float(ts) < ttl:
                return ip
        except OSError:
            pass
        except ValueError:
            pass

    for url in _PROVIDERS:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "B1sTeam/1.0"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                ip = _parse_provider_response(url, resp.read())
                if ip:
                    try:
                        CACHE.write_text(f"{ip}\n{time.time()}\n", encoding="utf-8")
                    except OSError:
                        pass
                    return ip
        except Exception:
            continue
    return None


if __name__ == "__main__":
    import sys
    force = "--force" in sys.argv
    print(detect_public_ip(ttl=0 if force else 300, force=force) or "UNAVAILABLE")
