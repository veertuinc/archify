#!/usr/bin/env node
/**
 * Thin stdio MCP for the Archify library HTTP API.
 * Requires archify-app-server (scripts/serve-gallery.sh) to be running.
 *
 * Prefer remote Streamable HTTP when the gallery is on another host:
 *   Cursor mcpServers.archify.url = "http://HOST:8787/mcp"
 *
 * Env:
 *   ARCHIFY_API_BASE  default http://127.0.0.1:8787
 */
import { createInterface } from 'node:readline';
import {
  createHttpApi,
  createToolCaller,
  handleJsonRpc,
} from './lib/archify-mcp-core.mjs';

const BASE = (process.env.ARCHIFY_API_BASE || 'http://127.0.0.1:8787').replace(/\/$/, '');
const callTool = createToolCaller(createHttpApi(BASE), BASE);
const instructions =
  `Archify library MCP (stdio). Talks to ${BASE}. No auth in v1 — private network only. `
  + 'For remote hosts without SSH, use Streamable HTTP: http://HOST:8787/mcp';

function send(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

async function handleMessage(msg) {
  const out = await handleJsonRpc(msg, { callTool, instructions, baseLabel: BASE });
  if (out.kind === 'response') send(out.message);
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }
  handleMessage(msg).catch((err) => {
    process.stderr.write(`archify-mcp: ${err.stack || err}\n`);
  });
});

process.stderr.write(`archify-mcp: base=${BASE}\n`);
