# B1sTeam — LocketGold (Free) MITM proxy
# Build (context = thư mục proxy/):
#   docker build -t b1steam-locketgold .
# Run:
#   docker run --rm -p 8443:8443 -p 8080:8080 \
#     -e ROOT_CA_CRT="$(base64 -w0 ca/root-ca.crt)" \
#     -e ROOT_CA_KEY="$(base64 -w0 ca/root-ca.key)" \
#     b1steam-locketgold
#
# B1sTeam — b1s.id.vn · Nguyễn Hoàng Bách

FROM golang:1.23-alpine AS builder

WORKDIR /src

# Binary tĩnh: không phụ thuộc, dùng chung stdlib Go.
# vendor/ đã được commit — build không cần network với Go modules.
ENV CGO_ENABLED=0 \
    GOOS=linux \
    GOARCH=amd64 \
    GOTOOLCHAIN=local \
    GOFLAGS=-mod=vendor

COPY go.mod go.sum ./
COPY vendor ./vendor
COPY . ./

RUN go build -trimpath -ldflags="-s -w" -o /out/b1steam-locketgold .

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata && \
    adduser -D -H -u 10001 b1steam

WORKDIR /app

COPY --from=builder /out/b1steam-locketgold /app/b1steam-locketgold

# Root CA lấy từ biến môi trường (ROOT_CA_CRT / ROOT_CA_KEY).
# Nếu cần dùng file đĩa: mount thêm vào /app/ca/root-ca.crt + /app/ca/root-ca.key
VOLUME ["/app/ca"]

USER b1steam

EXPOSE 8443 8080

ENTRYPOINT ["/app/b1steam-locketgold"]
