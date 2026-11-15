// Package tls lo Root CA cua B1sTeam va forge leaf certificate cho MITM.
//
// Root CA: ECDSA P-256, self-signed (sinh boi ca/gen-ca.py).
// Leaf   : ECDSA P-256, do Root CA ky, hieu luc 397 ngay, SAN = host + allow-list.
//
// B1sTeam — b1s.id.vn · Nguyen Hoang Bach
package tls

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"
)

// LeafValidity la thoi gian hieu luc cua leaf certificate (397 ngay).
const LeafValidity = 397 * 24 * time.Hour

// LeafKeyUsage / LeafExtKeyUsage mo ta dung cho leaf certificate.
const (
	leafCommonNamePrefix = "B1sTeam LocketGold MITM"
	leafOrganization     = "B1sTeam"
	leafOrgUnit          = "B1sTeam Trust Services"
)

// CA la Root CA dang chay (cert + private key + danh sach SAN).
type CA struct {
	// Cert la Root CA certificate da parse.
	Cert *x509.Certificate
	// Key la private key ECDSA cua Root CA.
	Key *ecdsa.PrivateKey

	// sans la danh sach SAN co dinh gan vao moi leaf (mac dinh: allow-list).
	sans []string
}

// LoadCA parse Root CA tu raw PEM (hoac base64 cua PEM/DER) va private key.
//
// Input co the la:
//   - PEM certificate truc tiep ("-----BEGIN CERTIFICATE-----")
//   - base64 cua PEM certificate
//   - DER certificate (raw binary)
// Private key: "EC PRIVATE KEY" (SEC1) hoac "PRIVATE KEY" (PKCS#8).
func LoadCA(certInput, keyInput []byte) (*CA, error) {
	if len(bytes.TrimSpace(certInput)) == 0 {
		return nil, errors.New("B1sTeam: root CA certificate rong")
	}
	if len(bytes.TrimSpace(keyInput)) == 0 {
		return nil, errors.New("B1sTeam: root CA private key rong")
	}

	certDER, err := extractCertDER(certInput)
	if err != nil {
		return nil, err
	}
	cert, err := x509.ParseCertificate(certDER)
	if err != nil {
		return nil, fmt.Errorf("B1sTeam: parse root CA certificate: %w", err)
	}
	if !cert.IsCA {
		return nil, errors.New("B1sTeam: root CA certificate khong phai CA (BasicConstraints ca=true bi thieu)")
	}

	key, err := extractECDSAKey(keyInput)
	if err != nil {
		return nil, err
	}

	ca := &CA{Cert: cert, Key: key, sans: nil}
	return ca, nil
}

// SetSANs gan danh sach SAN co dinh cho moi leaf certificate.
//
// Day la danh sach host duoc phep MITM (allow-list) — trung voi MITM_SANS.
func (ca *CA) SetSANs(sans []string) {
	out := make([]string, 0, len(sans)+1)
	seen := make(map[string]bool, len(sans)+1)
	for _, s := range sans {
		item := normalizeHost(s)
		if item == "" || seen[item] {
			continue
		}
		seen[item] = true
		out = append(out, item)
	}
	ca.sans = out
}

// SANS tra ve danh sach SAN hien tai cua CA.
func (ca *CA) SANS() []string {
	out := make([]string, len(ca.sans))
	copy(out, ca.sans)
	return out
}

// ForgeLeaf tao leaf certificate moi cho host (ECDSA P-256, 397 ngay).
//
// SAN = host + danh sach SAN co dinh cua CA. Chu chain gom leaf + Root CA.
func (ca *CA) ForgeLeaf(host string) (*tls.Certificate, error) {
	name := normalizeHost(host)
	if name == "" {
		return nil, errors.New("B1sTeam: khong the forge leaf cho host rong")
	}
	if ca == nil || ca.Cert == nil || ca.Key == nil {
		return nil, errors.New("B1sTeam: Root CA chua duoc khoi tao")
	}

	leafKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("B1sTeam: sinh leaf key: %w", err)
	}

	serialLimit := new(big.Int).Lsh(big.NewInt(1), 128)
	serial, err := rand.Int(rand.Reader, serialLimit)
	if err != nil {
		return nil, fmt.Errorf("B1sTeam: sinh serial: %w", err)
	}

	now := time.Now()
	template := &x509.Certificate{
		SerialNumber: serial,
		Subject: pkix.Name{
			CommonName:   leafCommonNamePrefix + " (" + name + ")",
			Organization: []string{leafOrganization},
			OrganizationalUnit: []string{leafOrgUnit},
		},
		DNSNames:              ca.leafSANs(name),
		NotBefore:             now.Add(-1 * time.Hour),
		NotAfter:              now.Add(LeafValidity),
		KeyUsage:              x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		IsCA:                  false,
	}

	der, err := x509.CreateCertificate(rand.Reader, template, ca.Cert, &leafKey.PublicKey, ca.Key)
	if err != nil {
		return nil, fmt.Errorf("B1sTeam: ky leaf certificate: %w", err)
	}

	leaf, err := x509.ParseCertificate(der)
	if err != nil {
		return nil, fmt.Errorf("B1sTeam: parse leaf certificate: %w", err)
	}

	return &tls.Certificate{
		Certificate: [][]byte{der, ca.Cert.Raw},
		PrivateKey:  leafKey,
		Leaf:        leaf,
	}, nil
}

// leafSANs tra ve danh sach DNS names cua leaf: host truoc, sau do la SAN co dinh.
func (ca *CA) leafSANs(host string) []string {
	out := []string{host}
	seen := map[string]bool{host: true}
	for _, s := range ca.sans {
		if seen[s] {
			continue
		}
		seen[s] = true
		out = append(out, s)
	}
	return out
}

// RootPEM tra ve Root CA dang PEM (dung cho .mobileconfig).
func (ca *CA) RootPEM() []byte {
	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: ca.Cert.Raw})
}

// RootDER tra ve Root CA dang DER (dung cho payload com.apple.security.root).
func (ca *CA) RootDER() []byte {
	return ca.Cert.Raw
}

// FingerprintSHA256 tra ve fingerprint SHA-256 cua Root CA dang hex.
func (ca *CA) FingerprintSHA256() string {
	sum := sha256.Sum256(ca.Cert.Raw)
	return hex.EncodeToString(sum[:])
}

// extractCertDR lay DER tu PEM / base64(PEM) / DER thong.
func extractCertDER(data []byte) ([]byte, error) {
	raw := decodeMaybeBase64(data)
	if block, _ := pem.Decode(raw); block != nil {
		if block.Type != "CERTIFICATE" {
			return nil, fmt.Errorf("B1sTeam: PEM block khong phai CERTIFICATE (got %q)", block.Type)
		}
		return block.Bytes, nil
	}
	if cert, err := x509.ParseCertificate(raw); err == nil {
		return cert.Raw, nil
	}
	return nil, errors.New("B1sTeam: khong parse duoc root CA certificate (PEM/DER)")
}

// extractECDSAKey lay private key ECDSA tu PEM (SEC1) hoac PKCS#8.
func extractECDSAKey(data []byte) (*ecdsa.PrivateKey, error) {
	raw := decodeMaybeBase64(data)
	block, _ := pem.Decode(raw)
	if block == nil {
		return nil, errors.New("B1sTeam: khong parse duoc root CA private key (PEM)")
	}
	if key, err := x509.ParseECPrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	if parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		key, ok := parsed.(*ecdsa.PrivateKey)
		if !ok {
			return nil, errors.New("B1sTeam: root CA private key khong phai ECDSA")
		}
		return key, nil
	}
	return nil, errors.New("B1sTeam: root CA private key khong parse duoc (EC PRIVATE KEY / PKCS#8)")
}

// decodeMaybeBase64 giai ma base64 neu input khong phai PEM.
func decodeMaybeBase64(data []byte) []byte {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 {
		return trimmed
	}
	if bytes.Contains(trimmed, []byte("-----BEGIN")) {
		return trimmed
	}
	compact := stripWhitespace(trimmed)
	encodings := []*base64.Encoding{
		base64.StdEncoding,
		base64.RawStdEncoding,
		base64.URLEncoding,
		base64.RawURLEncoding,
	}
	for _, enc := range encodings {
		if decoded, err := enc.DecodeString(string(compact)); err == nil {
			return decoded
		}
	}
	return trimmed
}

// stripWhitespace bo khoang trang (kể cả newline trong base64 nhiều dòng).
func stripWhitespace(data []byte) []byte {
	out := make([]byte, 0, len(data))
	for _, c := range data {
		switch c {
		case ' ', '\t', '\r', '\n':
			continue
		}
		out = append(out, c)
	}
	return out
}

// normalizeHost chuan hoa host cho so sanh.
func normalizeHost(host string) string {
	h := strings.ToLower(strings.TrimSpace(host))
	h = strings.TrimSuffix(h, ".")
	return h
}
