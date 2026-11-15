#!/usr/bin/env python3
"""B1sTeam — sinh Root CA ECDSA P-256 cho proxy MITM LocketGold (Free).

Sinh:
    <out>/root-ca.crt   — certificate dang PEM (chu ky)
    <out>/root-ca.key   — private key dang PEM (SEC1, chmod 600)
    <out>/root-ca.cer   — certificate dang DER (cho payload iOS)

Dung:
    python ca/gen-ca.py --out /tmp/b1s-test          # thu nghiem (khong ghi de cert cu)
    python ca/gen-ca.py                              # ghi vao ca/ (tu choi neu da ton tai)
    python ca/gen-ca.py --out /tmp/x --force         # ghi de duoc

KHONG dung openssl subprocess — chi dung thu vien `cryptography`.
Private key KHONG commit (file .key nam trong .gitignore).

B1sTeam — b1s.id.vn · Nguyen Hoang Bach
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import os
import sys
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

DEFAULT_CN = "B1sTeam Root CA"
DEFAULT_ORG = "B1sTeam"
DEFAULT_UNIT = "B1sTeam Trust Services"
DEFAULT_LOCALITY = "Ho Chi Minh City"
DEFAULT_COUNTRY = "VN"


def build_name(cn: str, org: str, unit: str, locality: str, country: str) -> x509.Name:
    """Tao distinguished name cho Root CA."""
    return x509.Name(
        [
            x509.NameAttribute(NameOID.COUNTRY_NAME, country),
            x509.NameAttribute(NameOID.LOCALITY_NAME, locality),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, org),
            x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, unit),
            x509.NameAttribute(NameOID.COMMON_NAME, cn),
        ]
    )


def fingerprint(cert: x509.Certificate, algo: hashes.HashAlgorithm) -> str:
    """Tra fingerprint dang hex tach dau ':' nhu openssl."""
    raw = cert.fingerprint(algo).hex().upper()
    return ":".join(raw[i : i + 2] for i in range(0, len(raw), 2))


def main() -> int:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(
        description="Sinh Root CA ECDSA P-256 cho B1sTeam LocketGold (Free).",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    ap.add_argument("--out", default=str(here), help="thu muc chua root-ca.crt / .key / .cer")
    ap.add_argument("--cn", default=DEFAULT_CN, help="Common Name cua Root CA")
    ap.add_argument("--org", default=DEFAULT_ORG, help="Organization")
    ap.add_argument("--unit", default=DEFAULT_UNIT, help="Organizational Unit")
    ap.add_argument("--locality", default=DEFAULT_LOCALITY, help="Locality")
    ap.add_argument("--country", default=DEFAULT_COUNTRY, help="Country (2 ky tu)")
    ap.add_argument("--days", type=int, default=3650, help="so ngay hieu luc")
    ap.add_argument("--force", action="store_true", help="ghi de file da ton tai")
    args = ap.parse_args()

    outdir = Path(args.out).expanduser().resolve()
    outdir.mkdir(parents=True, exist_ok=True)

    crt_path = outdir / "root-ca.crt"
    key_path = outdir / "root-ca.key"
    cer_path = outdir / "root-ca.cer"

    existing = [p for p in (crt_path, key_path, cer_path) if p.exists()]
    if existing and not args.force:
        print("ERROR: file da ton tai, khong ghi de (them --force neu that su can):", file=sys.stderr)
        for p in existing:
            print(f"  - {p}", file=sys.stderr)
        return 1

    # --- Key: ECDSA P-256 ---
    key = ec.generate_private_key(ec.SECP256R1())

    now = dt.datetime.now(dt.timezone.utc)
    subject = build_name(args.cn, args.org, args.unit, args.locality, args.country)
    serial = x509.random_serial_number()

    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(serial)
        .not_valid_before(now - dt.timedelta(minutes=5))
        .not_valid_after(now + dt.timedelta(days=args.days))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                key_cert_sign=True,
                crl_sign=True,
                content_commitment=False,
                data_encipherment=False,
                key_agreement=False,
                key_encipherment=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(x509.SubjectKeyIdentifier.from_public_key(key.public_key()), critical=False)
        .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(key.public_key()), critical=False)
        .sign(key, hashes.SHA256())
    )

    cert_pem = cert.public_bytes(serialization.Encoding.PEM)
    key_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    )

    crt_path.write_bytes(cert_pem)
    key_path.write_bytes(key_pem)
    cer_path.write_bytes(cert.public_bytes(serialization.Encoding.DER))
    try:
        os.chmod(key_path, 0o600)
    except OSError:
        pass  # tren Windows chmod co the bo qua

    sha256_fp = fingerprint(cert, hashes.SHA256())
    sha1_fp = fingerprint(cert, hashes.SHA1())

    print("=== B1sTeam Root CA (ECDSA P-256) ===")
    print(f"Certificate      : {crt_path}")
    print(f"Private key      : {key_path}   (BI MAT - KHONG commit)")
    print(f"Certificate (DER): {cer_path}")
    print(f"Subject          : {subject.rfc4514_string()}")
    print(f"Serial           : {serial}")
    print(f"Valid            : {now.date()} -> {(now + dt.timedelta(days=args.days)).date()}")
    print(f"SHA-256          : {sha256_fp}")
    print(f"SHA-1            : {sha1_fp}")
    print()
    print("--- Cai dat len iOS (dung dung 1 lan) ---")
    print("1) copy 3 file tren vao may chu nhan (scp/OneDrive)")
    print("2) Settings > General > VPN & Device Management > Download profile (.cer)")
    print("3) Settings > General > About > Certificate Trust Settings -> bat 'B1sTeam Root CA'")
    print("4) dung file .mobileconfig cua B1sTeam de them DoH + Root CA")
    print()
    print("--- Bien moi truong Fly.io (copy nguyen 2 dong duoi) ---")
    print("ROOT_CA_CRT=" + base64.b64encode(cert_pem).decode())
    print("ROOT_CA_KEY=" + base64.b64encode(key_pem).decode())
    return 0


if __name__ == "__main__":
    sys.exit(main())
