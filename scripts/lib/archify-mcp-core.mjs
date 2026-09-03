/**
 * Shared Archify library MCP tool definitions and JSON-RPC handling.
 * Used by stdio (archify-mcp.mjs) and Streamable HTTP (/mcp on app server).
 */

export const PROTOCOL_VERSION = '2024-11-05';
export const SERVER_INFO = { name: 'archify-library', version: '1.1.0' };

export const TOOLS = [
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
  {
    name: 'export_diagram',
    description:
      'Export a delivered library diagram (viewer export menu). '
      + 'Formats: svg, png, jpeg, webp, webm, share-card, route-share-card, reach-share-card. '
      + 'Optional outputPath under docs/ or var/library/exports/; otherwise returns base64.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Diagram id.' },
        format: {
          type: 'string',
          enum: [
            'svg',
            'png',
            'jpeg',
            'webp',
            'webm',
            'share-card',
            'route-share-card',
            'reach-share-card',
          ],
        },
        outputPath: {
          type: 'string',
          description: 'Optional write path under docs/ or var/library/exports/.',
        },
        includeBase64: {
          type: 'boolean',
          description: 'When outputPath is set, also include base64 (default false).',
        },
        route: {
          type: 'object',
          description: 'Required for route-share-card.',
          properties: {
            source: { type: 'string' },
            target: { type: 'string' },
          },
          additionalProperties: false,
        },
        reach: {
          type: 'object',
          description: 'Required for reach-share-card.',
          properties: {
            nodeId: { type: 'string' },
            direction: { type: 'string' },
          },
          additionalProperties: false,
        },
        theme: { type: 'string', description: 'Optional viewer theme.' },
        omitText: {
          type: 'boolean',
          description: 'Strip diagram labels and Share Card branding from the export.',
        },
      },
      required: ['id', 'format'],
      additionalProperties: false,
    },
  },
];

export function textResult(payload, isError = false) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: 'text', text }], isError };
}

export function createHttpApi(baseUrl) {
  const BASE = String(baseUrl || '').replace(/\/$/, '');
  return async function api(method, path, body) {
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
  };
}

export function createToolCaller(api, baseLabel = '') {
  return async function callTool(name, args = {}) {
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
      case 'export_diagram': {
        const body = { format: args.format };
        if (args.outputPath) body.outputPath = args.outputPath;
        if (args.includeBase64 === true) body.includeBase64 = true;
        if (args.route) body.route = args.route;
        if (args.reach) body.reach = args.reach;
        if (args.theme) body.theme = args.theme;
        if (args.omitText === true) body.omitText = true;
        return textResult(await api('POST', `/api/diagrams/${encodeURIComponent(args.id)}/export`, body));
      }
      default:
        return textResult({ error: 'unknown_tool', name }, true);
    }
  };
}

export function initializeResult(instructions) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: { tools: {} },
    serverInfo: SERVER_INFO,
    instructions,
  };
}

/**
 * Handle one JSON-RPC request object.
 * Returns { kind: 'empty' } for notifications,
 * { kind: 'response', message } for JSON-RPC responses,
 * or { kind: 'none' } when ignored.
 */
export async function handleJsonRpc(msg, { callTool, instructions, baseLabel }) {
  if (!msg || typeof msg !== 'object') return { kind: 'none' };
  const { id, method, params } = msg;

  if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
    return { kind: 'empty' };
  }

  if (id === undefined || id === null) return { kind: 'none' };

  try {
    if (method === 'initialize') {
      return {
        kind: 'response',
        message: {
          jsonrpc: '2.0',
          id,
          result: initializeResult(instructions),
        },
      };
    }

    if (method === 'ping') {
      return { kind: 'response', message: { jsonrpc: '2.0', id, result: {} } };
    }

    if (method === 'tools/list') {
      return { kind: 'response', message: { jsonrpc: '2.0', id, result: { tools: TOOLS } } };
    }

    if (method === 'tools/call') {
      const name = params?.name;
      const args = params?.arguments || {};
      try {
        const result = await callTool(name, args);
        return { kind: 'response', message: { jsonrpc: '2.0', id, result } };
      } catch (err) {
        return {
          kind: 'response',
          message: {
            jsonrpc: '2.0',
            id,
            result: textResult({
              error: err.message,
              status: err.status,
              data: err.data,
              base: baseLabel,
            }, true),
          },
        };
      }
    }

    return {
      kind: 'response',
      message: {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      },
    };
  } catch (err) {
    return {
      kind: 'response',
      message: {
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: err.message || 'internal error' },
      },
    };
  }
}
