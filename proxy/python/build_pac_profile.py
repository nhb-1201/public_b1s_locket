# -*- coding: utf-8 -*-
"""
B1sTeam — sinh hồ sơ "B1sTeam Proxy (PAC)" (.mobileconfig) cho iOS/macOS

Hai payload:
  1. B1sTeam Root CA (com.apple.security.root)      — thiết bị tin leaf proxy ký
  2. Global HTTP Proxy (com.apple.proxy.http, Auto) — PAC URL trỏ về http://<public-ip>:8443/proxy.pac

Chạy:  python proxy/python/build_pac_profile.py
Kết quả: proxy/b1steam-pac-profile.mobileconfig  (gitignored)
"""

from __future__ import annotations

import base64
import re
import sys
import uuid
import xml.sax.saxutils as sax
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # public_b1s_locket
CA_DER_B64 = ROOT / "ca" / "b1steam-root-ca.der.b64"
OUT = ROOT / "proxy" / "b1steam-pac-profile.mobileconfig"
ENV_PUBLIC_IP = ROOT / "proxy" / ".public-ip"

PAC_HOSTNAMES = [
    "locketcamera.com",
    "locket.camera",
    "revenuecat.com",
    "rc-backup.com",
    "rev.cat",
    "firebaseremoteconfig.googleapis.com",
    "firebaseremoteconfig.google.com",
    "us-central1-locket-4252a.cloudfunctions.net",
]


def current_public_ip() -> str:
    try:
        return open(ENV_PUBLIC_IP, encoding="utf-8").read().split()[0].strip()
    except OSError:
        sys.path.insert(0, str(ROOT / "proxy" / "python"))
        import public_ip
        ip = public_ip.detect_public_ip(ttl=0, force=True)
        if not ip:
            raise SystemExit("Không lấy được IP công khai — kiểm tra kết nối Internet.")
        return ip


def main() -> None:
    der_b64 = CA_DER_B64.read_text(encoding="utf-8").strip()
    if len(der_b64) < 300:
        raise SystemExit(f"CA DER base64 quá ngắn tại {CA_DER_B64}")
    ip = current_public_ip()
    pac_url = f"http://{ip}:8443/proxy.pac"
    today = date.today().isoformat()

    ca_uuid = str(uuid.uuid4()).upper()
    proxy_uuid = str(uuid.uuid4()).upper()
    profile_uuid = str(uuid.uuid4()).upper()

    domains_xml = "\n".join(f"\t\t\t\t\t<string>{sax.escape(d)}</string>" for d in PAC_HOSTNAMES)

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>PayloadContent</key>
	<array>
		<dict>
			<key>PayloadCertificateFileName</key>
			<string>b1steam-root-ca.crt</string>
			<key>PayloadContent</key>
			<data>{der_b64}</data>
			<key>PayloadDescription</key>
			<string>B1sTeam Root CA — cai 1 lan, tin cay proxy B1sTeam. Vao Cai dat &gt; Cai dat chung &gt; Gioi thieu &gt; Cai dat tin cay chung nhan va bat tin cay.</string>
			<key>PayloadDisplayName</key>
			<string>B1sTeam Root CA</string>
			<key>PayloadIdentifier</key>
			<string>vn.b1steam.proxy.ca</string>
			<key>PayloadType</key>
			<string>com.apple.security.root</string>
			<key>PayloadUUID</key>
			<string>{ca_uuid}</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
		</dict>
		<dict>
			<key>PayloadDescription</key>
			<string>B1sTeam Proxy qua PAC — chi cac host B1sTeam can MITM di qua proxy (Locket/RC/FC), tat ca traffic khac ra thang Internet.</string>
			<key>PayloadDisplayName</key>
			<string>B1sTeam Proxy (PAC)</string>
			<key>PayloadIdentifier</key>
			<string>vn.b1steam.proxy.http</string>
			<key>PayloadType</key>
			<string>com.apple.proxy.http</string>
			<key>PayloadUUID</key>
			<string>{proxy_uuid}</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
			<key>ProxyType</key>
			<string>Auto</string>
			<key>ProxyPACURL</key>
			<string>{pac_url}</string>
			<key>ProxyPACFallbackAllowed</key>
			<true/>
		</dict>
	</array>
	<key>PayloadDescription</key>
	<string>B1sTeam LocketGold — Proxy Internet route (PAC). IP {ip} (snapshot {today}); khi doi IP hay chay lai build_pac_profile.py roi cai lai ho so.</string>
	<key>PayloadDisplayName</key>
	<string>B1sTeam Proxy (PAC)</string>
	<key>PayloadIdentifier</key>
	<string>vn.b1steam.proxy.profile</string>
	<key>PayloadOrganization</key>
	<string>B1sTeam — b1s.id.vn</string>
	<key>PayloadRemovalDisallowed</key>
	<false/>
	<key>PayloadType</key>
	<string>Configuration</string>
	<key>PayloadUUID</key>
	<string>{profile_uuid}</string>
	<key>PayloadVersion</key>
	<integer>1</integer>
</dict>
</plist>
"""
    OUT.write_text(xml, encoding="utf-8")
    print(f"Written: {OUT}")
    print(f"PAC URL: {pac_url}  (IP {ip})")


if __name__ == "__main__":
    main()
