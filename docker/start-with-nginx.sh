#!/usr/bin/env sh
set -eu

APP_PORT="${APP_INTERNAL_PORT:-4001}"
SSL_CERT_PATH="${SSL_CERT_PATH:-/etc/nginx/certs/server.crt}"
SSL_KEY_PATH="${SSL_KEY_PATH:-/etc/nginx/certs/server.key}"
SSL_CERT_DOMAIN="${SSL_CERT_DOMAIN:-localhost}"

mkdir -p /etc/nginx/certs
mkdir -p /var/log/nginx /var/lib/nginx /run/nginx

if [ ! -f "$SSL_CERT_PATH" ] || [ ! -f "$SSL_KEY_PATH" ]; then
  echo "[container-init] TLS cert/key not provided, generating self-signed cert for ${SSL_CERT_DOMAIN}" >&2
  openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -subj "/CN=${SSL_CERT_DOMAIN}" \
    -keyout /etc/nginx/certs/server.key \
    -out /etc/nginx/certs/server.crt >/dev/null 2>&1
fi

PORT="$APP_PORT" HOST="127.0.0.1" node /app/dist/container/entrypoint.js &
NODE_PID=$!

cleanup() {
  kill "$NODE_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

exec nginx -c /etc/nginx/nginx.conf -g 'daemon off;'
