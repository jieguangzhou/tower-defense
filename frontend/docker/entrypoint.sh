#!/usr/bin/env sh
set -eu

API_BASE_URL="${API_BASE_URL:-}"

cat <<CONFIG > /usr/share/nginx/html/config.local.js
window.__APP_CONFIG__ = { apiBaseUrl: "${API_BASE_URL}" };
CONFIG

exec nginx -g "daemon off;"
