#!/usr/bin/env bash
set -euo pipefail
ROOT="/home/veertu/archify"
NODE_BIN="${HOME}/.nvm/versions/node/v22.23.2/bin/node"
export ARCHIFY_GALLERY_HOST="${ARCHIFY_GALLERY_HOST:-0.0.0.0}"
export ARCHIFY_GALLERY_PORT="${ARCHIFY_GALLERY_PORT:-8787}"
export ARCHIFY_UPDATE_CHECK_DISABLED=1
export NODE_BIN
cd "${ROOT}"
exec "${NODE_BIN}" "${ROOT}/scripts/archify-app-server.mjs"
