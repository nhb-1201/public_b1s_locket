# B1sTeam — CA & hồ sơ iOS (LocketGold Free)

Thư mục này chứa công cụ sinh **Root CA** và **hồ sơ cài đặt iOS** cho proxy MITM
[B1sTeam LocketGold (Free)](../proxy/README.md).

> **B1sTeam** — b1s.id.vn · Nguyen Hoang Bach

---

## 1. `gen-ca.py` — sinh Root CA

Sinh **Root CA ECDSA P-256** (self-signed):

| File | Nội dung |
|------|----------|
| `root-ca.crt` | Certificate dạng PEM |
| `root-ca.key` | Private key dạng PEM (SEC1, `chmod 600`) — **BÍ MẬT** |
| `root-ca.cer` | Certificate dạng DER (để nhúng vào payload iOS) |

Thông tin Subject: `CN=B1sTeam Root CA, OU=B1sTeam Trust Services, O=B1sTeam, L=Ho Chi Minh City, C=VN`.
Chữ ký: `ecdsa-with-SHA256`. Hạn mặc định 3650 ngày.

### Dùng

```bash
# 1) Thử nghiệm ra thư mục tạm (KHÔNG đụng vào ca/ hiện có)
python ca/gen-ca.py --out /tmp/b1s-ca

# 2) Sinh thật vào ca/ (script từ chối ghi đè nếu file đã tồn tại)
python ca/gen-ca.py

# 3) Ghi đè có chủ đích
python ca/gen-ca.py --out ca --force
```

Tuỳ chọn: `--cn`, `--org`, `--unit`, `--locality`, `--country`, `--days`, `--force`.

Script in ra **fingerprint SHA-256** và **SHA-1** (định dạng `AA:BB:CC:…`) kèm 2 dòng
`ROOT_CA_CRT=…` / `ROOT_CA_KEY=…` (base64) để dán thẳng vào `flyctl secrets set`.

> Script **không** gọi `openssl` — chỉ dùng thư viện `cryptography`.

---

## 2. `gen-mobileconfig.py` — sinh hồ sơ iOS

Hồ sơ `.mobileconfig` (plist XML) gồm **2 payload**:

1. `com.apple.security.root` — Root CA B1sTeam:
   - `PayloadContent` chứa **DER base64**, xong **≤ 76 ký tự/dòng** (yêu cầu của Apple)
   - `PayloadCertificateFileName`, `PayloadEnabled = true`
2. `com.apple.dnsSettings.managed` — DoH:
   - `DNSSettings.ServerURL = https://doh.b1s.id.vn/fly/dns-query`
   - `DNSSettings.SupplementalMatchDomains` = danh sách host cần ép DNS

### Dùng

```bash
# Ghi ra file
python ca/gen-mobileconfig.py --out mobileconfig/B1sTeam-LocketGold.mobileconfig

# Hoặc ra stdout
python ca/gen-mobileconfig.py > /tmp/B1sTeam-LocketGold.mobileconfig

# Tu chon cert / DoH / domain
python ca/gen-mobileconfig.py --ca ca/root-ca.crt \
    --doh https://doh.b1s.id.vn/fly/dns-query \
    --domain api.revenuecat.com \
    --out /tmp/profile.mobileconfig
```

Kiểm tra nhanh:

```bash
python -c "import plistlib;print(plistlib.load(open(r'mobileconfig/B1sTeam-LocketGold.mobileconfig','rb'))['PayloadContent'][0]['PayloadType'])"
# -> com.apple.security.root
```

---

## 3. Cài đặt lên iPhone / iPad

1. **Tải hồ sơ**: mở `https://<domain-cua-ban>/B1sTeam-LocketGold.mobileconfig` bằng Safari → chọn *Cho phép*.
2. **Cài Root CA**: *Cài đặt → Chung → VPN & Thiết bị quản lý →* chạm hồ sơ vừa tải → *Cài đặt*.
3. **Tin cậy Root CA**: *Cài đặt → Chung → Giới thiệu → Tin cậy Chứng chương Cài đặt* → bật **B1sTeam Root CA**.
   > Bắt buộc bật, nếu không iOS sẽ không tin proxy MITM.
4. **Cài lại Locket**: xoá app Locket → tải lại từ App Store (bắt buộc để app lấy lại endpoint).
5. **Mở Locket** → badge Gold ✦ hiện ra.

### Gỡ cài đặt

*Cài đặt → Chung → VPN & Thiết bị quản lý → B1sTeam LocketGold → Xoá hồ sơ*,
rồi tắt *Tin cậy Chứng thư Cài đặt* cho **B1sTeam Root CA**.

---

## 4. Bảo mật

- **Private key KHÔNG được commit.** `root-ca.key` là bí mật tuyệt đối: ai có key này đều MITM được mọi thiết bị đã cài hồ sơ.
- Nếu bị lộ → **xoá hồ sơ trên toàn bộ thiết bị** và **sinh CA mới** (`python ca/gen-ca.py --force`).
- Chỉ dùng CA cho **thiết bị của chính bạn**. Không chia sẻ `root-ca.key`, không commit file `.key` lên Git.
- Deploy lên Fly.io bằng **secret**, không nhúng key vào image:

```bash
flyctl secrets set ROOT_CA_CRT="$(base64 -w0 ca/root-ca.crt)" \
                   ROOT_CA_KEY="$(base64 -w0 ca/root-ca.key)"
```

---

## 5. File trong thư mục

```
ca/
├── gen-ca.py             # sinh Root CA ECDSA P-256 (PEM + DER + fingerprint)
├── gen-mobileconfig.py   # sinh .mobileconfig iOS (Root CA + DoH)
├── README.md             # file này
├── root-ca.crt           # (sinh ra) certificate PEM  — KHÔNG commit nếu không cần
├── root-ca.key           # (sinh ra) private key PEM  — TUYET DOI KHONG COMMIT
└── root-ca.cer           # (sinh ra) certificate DER
```

B1sTeam — b1s.id.vn · Nguyen Hoang Bach
