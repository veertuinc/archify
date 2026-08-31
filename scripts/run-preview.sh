#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/veertu/archify"
ARCHIFY_DIR="${ROOT}/archify"
SOURCE="${ROOT}/var/preview/live.workflow.json"
OUTPUT="${ROOT}/var/preview/live.workflow.html"
NODE_BIN="${HOME}/.nvm/versions/node/v22.23.2/bin/node"

mkdir -p "${ROOT}/var/preview"
if [[ ! -f "${SOURCE}" ]]; then
  cp "${ARCHIFY_DIR}/examples/agent-tool-call.workflow.json" "${SOURCE}"
fi

cd "${ARCHIFY_DIR}"
exec "${NODE_BIN}" bin/archify.mjs preview workflow "${SOURCE}" "${OUTPUT}" \
  --quality showcase --no-open
