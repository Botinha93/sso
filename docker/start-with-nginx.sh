#!/usr/bin/env bash
# The container runs two processes: the Node app and the nginx that proxies to
# it. This script stays PID 1 and waits on both, so if either one dies the
# container exits and the restart policy fires. `exec nginx` here instead made
# nginx PID 1: a dead app left the container "up" and serving 502s indefinitely,
# with no crash-loop to notice.
#
# bash (not sh) because of `wait -n`; it ships in the Debian base image.
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

nginx -c /etc/nginx/nginx.conf -g 'daemon off;' &
NGINX_PID=$!

stop_children() {
  kill -TERM "$NODE_PID" "$NGINX_PID" 2>/dev/null || true
  wait "$NODE_PID" 2>/dev/null || true
  wait "$NGINX_PID" 2>/dev/null || true
}

# `docker stop` is a clean shutdown, so drain both children and exit 0.
shutdown() {
  trap - INT TERM
  echo "[container-init] shutdown signal received, stopping app and nginx" >&2
  stop_children
  exit 0
}
trap shutdown INT TERM

# Whichever process exits first ends the container. Without this the survivor
# keeps the container alive and hides the failure.
status=0
wait -n || status=$?

if kill -0 "$NODE_PID" 2>/dev/null; then
  echo "[container-init] nginx exited (status ${status}); stopping app so the container restarts" >&2
else
  echo "[container-init] app exited (status ${status}); stopping nginx so the container restarts" >&2
fi

stop_children

# Neither process should ever exit on its own, so report failure even on a 0
# exit code: `restart: on-failure` has to see it as a crash.
if [ "$status" -eq 0 ]; then
  status=1
fi

exit "$status"
