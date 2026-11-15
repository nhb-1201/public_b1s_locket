#!/usr/bin/env python3
"""B1sTeam — sinh ho so iOS .mobileconfig cho LocketGold (Free).

Hồ sơ gồm HAI payload:
  1. com.apple.security.root       — Root CA B1sTeam (DER base64, xong <=76 ky tu/dong)
  2. com.apple.dnsSettings.managed  — DoH cua B1sTeam + SupplementalMatchDomains

Dung:
    python ca/gen-mobileconfig.py --out /tmp/test.mobileconfig
    python ca/gen-mobileconfig.py --out mobileconfig/B1sTeam-LocketGold.mobileconfig
    python ca/gen-mobileconfig.py > /tmp/x.mobileconfig      # stdout

Chi dung stdlib + `cryptography` (tuong thich gen-ca.py). KHONG dung openssl.

B1sTeam — b1s.id.vn · Nguyen Hoang Bach
"""
from __future__ import annotations

import argparse
import base64
import re
import sys
import uuid
from pathlib import Path

DEFAULT_DOH_URL = "https://doh.b1s.id.vn/fly/dns-query"

DEFAULT_DOMAINS = [
    "api.revenuecat.com",
    "api.rc-backup.com",
    "rev.cat",
    "firebaseremoteconfig.googleapis.com",
    "firebaseremoteconfig.google.com",
    "www.remoteconfig.googleapis.com",
    "firebaseremoteconfigrealtime.googleapis.com",
    "api.locketcamera.com",
    "cdn.locketcamera.com",
    "public.locketcamera.com",
    "locket.camera",
    "us-central1-locket-4252a.cloudfunctions.net",
    "firebasestorage.googleapis.com",
    "storage.googleapis.com",
    "firebaselogging.googleapis.com",
]

PEM_RE = re.compile(
    rb"-----BEGIN CERTIFICATE-----\s*([A-Za-z0-9+/=\s]+?)\s*-----END CERTIFICATE-----",
    re.DOTALL,
)


def der_from_pem(pem_bytes: bytes) -> bytes:
    """Chuyen PEM -> DER (tu choi ro rang neu khong dung format)."""
    m = PEM_RE.search(pem_bytes)
    if not m:
        raise ValueError("khong tim thay block CERTIFICATE trong file PEM")
    body = re.sub(rb"\s+", b"", m.group(1))
    return base64.b64decode(body)


def wrap76(text: str, width: int = 76) -> str:
    """Ngat base64 thanh nhieu dong <= width ky tu (Apple yeu cau 76)."""
    if width <= 0:
        width = 76
    return "\n".join(text[i : i + width] for i in range(0, len(text), width))


def esc(text: str) -> str:
    """Escape XML cho text thuong."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def build_profile(ca_der: bytes, doh_url: str, domains: list[str]) -> str:
    """Tra ve noi dung plist XML cua ho so .mobileconfig."""
    ca_b64 = base64.b64encode(ca_der).decode("ascii")
    domain_xml = "\n".join(f"\t\t\t\t\t<string>{esc(d)}</string>" for d in domains)

    cert_uuid = str(uuid.uuid4()).upper()
    dns_uuid = str(uuid.uuid4()).upper()
    profile_uuid = str(uuid.uuid4()).upper()

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>PayloadContent</key>
\t<array>
\t\t<dict>
\t\t\t<key>PayloadCertificateFileName</key>
\t\t\t<string>B1sTeam-Root-CA.cer</string>
\t\t\t<key>PayloadContent</key>
\t\t\t<data>
{wrap76(ca_b64)}
\t\t\t</data>
\t\t\t<key>PayloadDescription</key>
\t\t\t<string>B1sTeam Root CA - proxy MITM Locket / RevenueCat / Firebase (Gold vinh vien).</string>
\t\t\t<key>PayloadDisplayName</key>
\t\t\t<string>B1sTeam Root CA</string>
\t\t\t<key>PayloadEnabled</key>
\t\t\t<true/>
\t\t\t<key>PayloadIdentifier</key>
\t\t\t<string>vn.b1steam.locketgold.rootca</string>
\t\t\t<key>PayloadOrganization</key>
\t\t\t<string>B1sTeam - b1s.id.vn</string>
\t\t\t<key>PayloadType</key>
\t\t\t<string>com.apple.security.root</string>
\t\t\t<key>PayloadUUID</key>
\t\t\t<string>{cert_uuid}</string>
\t\t\t<key>PayloadVersion</key>
\t\t\t<integer>1</integer>
\t\t</dict>
\t\t<dict>
\t\t\t<key>DNSSettings</key>
\t\t\t<dict>
\t\t\t\t<key>DNSProtocol</key>
\t\t\t\t<string>HTTPS</string>
\t\t\t\t<key>ServerURL</key>
\t\t\t\t<string>{esc(doh_url)}</string>
\t\t\t\t<key>SupplementalMatchDomains</key>
\t\t\t\t<array>
{domain_xml}
\t\t\t\t</array>
\t\t\t</dict>
\t\t\t<key>PayloadDescription</key>
\t\t\t<string>DoH cua B1sTeam cho Locket / Firebase / RevenueCat.</string>
\t\t\t<key>PayloadDisplayName</key>
\t\t\t<string>B1sTeam LocketGold - DoH</string>
\t\t\t<key>PayloadIdentifier</key>
\t\t\t<string>vn.b1steam.locketgold.dns</string>
\t\t\t<key>PayloadOrganization</key>
\t\t\t<string>B1sTeam - b1s.id.vn</string>
\t\t\t<key>PayloadType</key>
\t\t\t<string>com.apple.dnsSettings.managed</string>
\t\t\t<key>PayloadUUID</key>
\t\t\t<string>{dns_uuid}</string>
\t\t\t<key>PayloadVersion</key>
\t\t\t<integer>1</integer>
\t\t\t<key>ProhibitDisablement</key>
\t\t\t<false/>
\t\t</dict>
\t</array>
\t<key>PayloadDescription</key>
\t<string>B1sTeam LocketGold (Free) - Gold vinh vien, cai 1 cham khong can Shadowrocket.</string>
\t<key>PayloadDisplayName</key>
\t<string>B1sTeam LocketGold (Free) - MITM + DoH</string>
\t<key>PayloadIdentifier</key>
\t<string>vn.b1steam.locketgold.profile</string>
\t<key>PayloadOrganization</key>
\t<string>B1sTeam - b1s.id.vn</string>
\t<key>PayloadRemovalDisallowed</key>
\t<false/>
\t<key>PayloadScope</key>
\t<string>System</string>
\t<key>PayloadType</key>
\t<string>Configuration</string>
\t<key>PayloadUUID</key>
\t<string>{profile_uuid}</string>
\t<key>PayloadVersion</key>
\t<integer>1</integer>
</dict>
</plist>
"""


def main() -> int:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(
        description="Sinh ho so iOS .mobileconfig (Root CA + DoH) cho B1sTeam LocketGold.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    ap.add_argument("--ca", default=str(here / "root-ca.crt"), help="duong dan Root CA (PEM)")
    ap.add_argument("--out", default="-", help="file dich (mac dinh: '-' = stdout)")
    ap.add_argument("--doh", default=DEFAULT_DOH_URL, help="DoH ServerURL")
    ap.add_argument("--domain", action="append", default=[], help="them domain cho DoH (lap lai nhieu lan)")
    args = ap.parse_args()

    ca_path = Path(args.ca).expanduser()
    if not ca_path.is_file():
        print(f"ERROR: khong tim thay Root CA: {ca_path}", file=sys.stderr)
        print("Hay chay: python ca/gen-ca.py --out <thu muc> truoc.", file=sys.stderr)
        return 1

    try:
        ca_der = der_from_pem(ca_path.read_bytes())
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    domains = args.domain if args.domain else list(DEFAULT_DOMAINS)
    profile = build_profile(ca_der, args.doh, domains)

    if args.out == "-":
        sys.stdout.write(profile)
    else:
        out_path = Path(args.out).expanduser()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(profile, encoding="utf-8", newline="\n")
        print(f"Da tao: {out_path} ({len(profile)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
