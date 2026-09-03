#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="${NODE_BIN:-${HOME}/.nvm/versions/node/v22.23.2/bin/node}"
export NODE_BIN
export ARCHIFY_UPDATE_CHECK_DISABLED=1
cd "${ROOT}"
exec "${NODE_BIN}" "${ROOT}/scripts/refresh-library.mjs"
