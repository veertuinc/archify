#!/usr/bin/env node
/**
 * Thin stdio MCP for the Archify library HTTP API.
 * Requires archify-app-server (scripts/serve-gallery.sh) to be running.
 *
 * Env:
 *   ARCHIFY_API_BASE  default http://127.0.0.1:8787
 */
import { createInterface } from 'node:readline';

const BASE = (process.env.ARCHIFY_API_BASE || 'http://127.0.0.1:8787').replace(/\/$/, '');
const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'archify-library', version: '1.0.0' };

function textResult(payload, isError = false) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: 'text', text }], isError };
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${method} ${path}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const TOOLS = [
  {
    name: 'describe_api',
    description: 'Return the Archify library HTTP API catalog (routes, bodies, security note).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'health',
    description: 'Check that the Archify gallery API is reachable.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_diagrams',
    description: 'List diagram entries in the library manifest.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_diagram',
    description: 'Get one diagram entry and its JSON IR document by id.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Diagram id (lowercase, numbers, hyphens).' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_templates',
    description: 'List example templates available for create_diagram when document is omitted.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'create_diagram',
    description: 'Create a diagram from a JSON IR document or an example template, then deliver HTML.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'New diagram id.' },
        type: {
          type: 'string',
          enum: ['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle'],
        },
        document: { type: 'object', description: 'Optional full JSON IR. If omitted, uses a template.' },
        template: { type: 'string', description: 'Optional template id or filename when document is omitted.' },
        title: { type: 'string', description: 'Optional title when seeding from a template.' },
      },
      required: ['id', 'type'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_diagram',
    description: 'Replace a diagram document and re-deliver, or validate only.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        document: { type: 'object', description: 'Full JSON IR document.' },
        validateOnly: { type: 'boolean', description: 'If true, validate without writing the delivered artifact.' },
      },
      required: ['id', 'document'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_diagram',
    description: 'Delete a diagram source, artifact, and manifest entry.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
];

async function callTool(name, args = {}) {
  switch (name) {
    case 'describe_api':
      return textResult(await api('GET', '/api'));
    case 'health':
      return textResult(await api('GET', '/api/health'));
    case 'list_diagrams':
      return textResult(await api('GET', '/api/diagrams'));
    case 'get_diagram':
      return textResult(await api('GET', `/api/diagrams/${encodeURIComponent(args.id)}`));
    case 'list_templates':
      return textResult(await api('GET', '/api/templates'));
    case 'create_diagram': {
      const body = { id: args.id, type: args.type };
      if (args.document) body.document = args.document;
      if (args.template) body.template = args.template;
      if (args.title) body.title = args.title;
      return textResult(await api('POST', '/api/diagrams', body));
    }
    case 'update_diagram': {
      const body = { document: args.document };
      if (args.validateOnly === true) body.validateOnly = true;
      return textResult(await api('PUT', `/api/diagrams/${encodeURIComponent(args.id)}`, body));
    }
    case 'delete_diagram':
      return textResult(await api('DELETE', `/api/diagrams/${encodeURIComponent(args.id)}`));
    default:
      return textResult({ error: 'unknown_tool', name }, true);
  }
}

function send(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function replyError(id, code, message, data) {
  send({ jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } });
}

async function handleMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  const { id, method, params } = msg;

  if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
    return;
  }

  if (id === undefined || id === null) return;

  try {
    if (method === 'initialize') {
      return reply(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions:
          `Archify library MCP. Talks to ${BASE}. No auth in v1 — private network only. `
          + 'Start the gallery with scripts/serve-gallery.sh (or archify-app-server.mjs) first.',
      });
    }

    if (method === 'ping') {
      return reply(id, {});
    }

    if (method === 'tools/list') {
      return reply(id, { tools: TOOLS });
    }

    if (method === 'tools/call') {
      const name = params?.name;
      const args = params?.arguments || {};
      try {
        const result = await callTool(name, args);
        return reply(id, result);
      } catch (err) {
        return reply(id, textResult({
          error: err.message,
          status: err.status,
          data: err.data,
          base: BASE,
        }, true));
      }
    }

    return replyError(id, -32601, `Method not found: ${method}`);
  } catch (err) {
    return replyError(id, -32603, err.message || 'internal error');
  }
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
