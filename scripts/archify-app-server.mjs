#!/usr/bin/env node
/**
 * Archify library app: static UI + CRUD API over JSON IR, using local `archify deliver`.
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  createHttpApi,
  createToolCaller,
  handleJsonRpc,
} from './lib/archify-mcp-core.mjs';
import { ExportPathError, resolveExportOutputPath } from './lib/archify-export-path.mjs';
import {
  EXPORT_FORMATS,
  HeadlessExportError,
  exportDiagramArtifact,
} from './lib/archify-headless-export.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WWW = path.join(ROOT, 'var', 'www');
const ARCHIFY_ASSETS = path.join(ROOT, 'archify', 'assets');
const LIBRARY = path.join(ROOT, 'var', 'library');
const SOURCES = path.join(LIBRARY, 'sources');
const ARTIFACTS = path.join(LIBRARY, 'artifacts');
const MANIFEST = path.join(LIBRARY, 'manifest.json');
const ARCHIFY_BIN = path.join(ROOT, 'archify', 'bin', 'archify.mjs');
const EXAMPLES = path.join(ROOT, 'archify', 'examples');
const NODE_BIN = process.env.NODE_BIN || process.execPath;
const HOST = process.env.ARCHIFY_GALLERY_HOST || '0.0.0.0';
const PORT = Number(process.env.ARCHIFY_GALLERY_PORT || 8787);
const TYPES = new Set(['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function send(res, code, body, headers = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body, null, 2);
  res.writeHead(code, {
    'Content-Type': typeof body === 'object' && !Buffer.isBuffer(body)
      ? 'application/json; charset=utf-8'
      : (headers['Content-Type'] || 'text/plain; charset=utf-8'),
    ...headers,
  });
  res.end(payload);
}

function safeId(id) {
  return typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,62}$/.test(id);
}

function sourceName(id, type) {
  return `${id}.${type}.json`;
}

function artifactName(id, type) {
  return `${id}.${type}.html`;
}

async function readJson(file) {
  return JSON.parse(await fsp.readFile(file, 'utf8'));
}

async function writeJson(file, data) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function loadManifest() {
  try {
    return await readJson(MANIFEST);
  } catch {
    return { schemaVersion: 1, entries: [] };
  }
}

async function saveManifest(manifest) {
  await writeJson(MANIFEST, manifest);
}

function titleFromDoc(doc, fallback) {
  return doc?.meta?.title || fallback;
}

function runArchify(args) {
  return new Promise((resolve) => {
    const child = spawn(NODE_BIN, [ARCHIFY_BIN, ...args], {
      cwd: path.join(ROOT, 'archify'),
      env: {
        ...process.env,
        ARCHIFY_UPDATE_CHECK_DISABLED: '1',
      },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function deliverDiagram(type, sourcePath, artifactPath) {
  const result = await runArchify([
    'deliver', type, sourcePath, artifactPath,
    '--quality', 'showcase', '--json',
  ]);
  let receipt = null;
  try {
    receipt = JSON.parse(result.stdout || '{}');
  } catch {
    receipt = { raw: result.stdout };
  }
  return { ok: result.code === 0, code: result.code, receipt, stderr: result.stderr };
}

async function validateDiagram(type, sourcePath) {
  const result = await runArchify([
    'validate', type, sourcePath,
    '--quality', 'showcase', '--json',
  ]);
  let receipt = null;
  try {
    receipt = JSON.parse(result.stdout || '{}');
  } catch {
    receipt = { raw: result.stdout };
  }
  return { ok: result.code === 0, code: result.code, receipt, stderr: result.stderr };
}

async function seedLibraryIfEmpty() {
  await fsp.mkdir(SOURCES, { recursive: true });
  await fsp.mkdir(ARTIFACTS, { recursive: true });
  const manifest = await loadManifest();
  if (manifest.entries.length) return;

  const seedRoot = path.join(ROOT, 'var', 'www', 'gallery');
  const seedManifestPath = path.join(seedRoot, 'manifest.json');
  if (!fs.existsSync(seedManifestPath)) return;

  const seed = await readJson(seedManifestPath);
  const entries = [];
  for (const e of seed.entries || []) {
    const type = e.type;
    const id = e.id;
    if (!TYPES.has(type) || !safeId(id)) continue;
    // e.input is like gallery/sources/foo.json — under www
    const srcIn = path.join(ROOT, 'var', 'www', e.input);
    const artIn = path.join(ROOT, 'var', 'www', e.artifact);
    const srcOut = path.join(SOURCES, sourceName(id, type));
    const artOut = path.join(ARTIFACTS, artifactName(id, type));
    if (!fs.existsSync(srcIn)) continue;
    await fsp.copyFile(srcIn, srcOut);
    if (fs.existsSync(artIn)) {
      await fsp.copyFile(artIn, artOut);
    } else {
      await deliverDiagram(type, srcOut, artOut);
    }
    const doc = await readJson(srcOut);
    entries.push({
      id,
      type,
      title: titleFromDoc(doc, e.title || id),
      source: `sources/${sourceName(id, type)}`,
      artifact: `artifacts/${artifactName(id, type)}`,
      updatedAt: new Date().toISOString(),
    });
  }
  await saveManifest({ schemaVersion: 1, entries });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return null;
  return JSON.parse(raw);
}

async function listTemplates() {
  const files = await fsp.readdir(EXAMPLES);
  return files
    .filter((f) => f.endsWith('.json') && !f.includes('.base.') && !f.includes('.head.'))
    .map((f) => {
      const m = f.match(/^(.+)\.(architecture|workflow|sequence|dataflow|lifecycle)\.json$/);
      if (!m) return null;
      return { id: m[1], type: m[2], file: f };
    })
    .filter(Boolean);
}

function apiCatalog() {
  return {
    name: 'archify-library-api',
    version: 1,
    security: {
      auth: 'none',
      warning: 'No authentication in v1. Expose only on localhost or a private/VPN network.',
    },
    baseUrlHint: `http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}`,
    idRules: 'lowercase letters, numbers, hyphens; /^[a-z0-9][a-z0-9-]{0,62}$/',
    types: [...TYPES],
    artifactUrl: '/library/artifacts/{id}.{type}.html',
    sourceUrl: '/library/sources/{id}.{type}.json',
    endpoints: [
      {
        method: 'GET',
        path: '/api',
        description: 'This catalog.',
      },
      {
        method: 'GET',
        path: '/api/health',
        description: 'Liveness check.',
        response: { ok: true },
      },
      {
        method: 'GET',
        path: '/api/diagrams',
        description: 'List library entries (manifest).',
      },
      {
        method: 'GET',
        path: '/api/templates',
        description: 'List example templates usable for create.',
      },
      {
        method: 'GET',
        path: '/api/diagrams/{id}',
        description: 'Get one entry plus its JSON IR document.',
      },
      {
        method: 'POST',
        path: '/api/diagrams',
        description: 'Create a diagram from document or template, then deliver HTML.',
        body: {
          id: 'string (required)',
          type: 'architecture|workflow|sequence|dataflow|lifecycle (required)',
          document: 'object (optional JSON IR)',
          template: 'string (optional template id/file when document omitted)',
          title: 'string (optional when seeding from template)',
        },
      },
      {
        method: 'PUT',
        path: '/api/diagrams/{id}',
        description: 'Replace document and re-deliver, or validateOnly.',
        body: {
          document: 'object (required JSON IR)',
          validateOnly: 'boolean (optional)',
        },
      },
      {
        method: 'DELETE',
        path: '/api/diagrams/{id}',
        description: 'Delete source, artifact, and manifest entry.',
      },
      {
        method: 'POST',
        path: '/api/diagrams/{id}/export',
        description: 'Export a delivered diagram via headless Chrome (viewer export menu).',
        body: {
          format: EXPORT_FORMATS.join('|'),
          outputPath: 'string (optional; under docs/ or var/library/exports/)',
          includeBase64: 'boolean (optional; default false when outputPath set)',
          route: '{ source, target } (required for route-share-card)',
          reach: '{ nodeId, direction } (required for reach-share-card)',
          theme: 'string (optional)',
        },
      },
    ],
    mcp: {
      streamableHttp: {
        path: '/mcp',
        urlHint: `http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}/mcp`,
        methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        note: 'Remote Cursor config: { "url": "http://HOST:PORT/mcp" }. No SSH needed.',
      },
      stdio: {
        script: 'scripts/archify-mcp.mjs',
        env: { ARCHIFY_API_BASE: 'http://127.0.0.1:8787' },
      },
    },
  };
}

/** MCP Streamable HTTP sessions (sessionId → metadata). */
const mcpSessions = new Map();

function mcpInstructions() {
  return (
    `Archify library MCP (Streamable HTTP on /mcp). No auth in v1 — private network only. `
    + `REST API on the same origin. Stdio client: scripts/archify-mcp.mjs `
    + `Create or update a diagram before export_diagram if the artifact is missing. `
    + `export_diagram formats: ${EXPORT_FORMATS.join(', ')}. `
    + `Prefer outputPath under docs/ for documentation assets; omit it to receive base64. `
    + `route-share-card needs route:{source,target}; reach-share-card needs reach:{nodeId,direction}. `
    + `WebM needs Chrome with MediaRecorder; set ARCHIFY_CHROME if needed.`
  );
}

function writeSseMessage(res, message) {
  res.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`);
}

function mcpJsonHeaders(sessionId, extra = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
    ...extra,
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  return headers;
}

async function handleMcpHttp(req, res, url) {
  const method = req.method || 'GET';
  const loopbackBase = `http://127.0.0.1:${PORT}`;
  const callTool = createToolCaller(createHttpApi(loopbackBase), loopbackBase);

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version',
      'Access-Control-Expose-Headers': 'Mcp-Session-Id',
    });
    res.end();
    return;
  }

  if (method === 'DELETE') {
    const sid = req.headers['mcp-session-id'];
    if (sid) mcpSessions.delete(String(sid));
    res.writeHead(200, mcpJsonHeaders(sid || undefined, { 'Access-Control-Allow-Origin': '*' }));
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (method === 'GET') {
    const sid = req.headers['mcp-session-id'];
    if (!sid || !mcpSessions.has(String(sid))) {
      return send(res, 400, { error: 'session_required', hint: 'POST initialize first; send Mcp-Session-Id' });
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Mcp-Session-Id': String(sid),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Mcp-Session-Id',
    });
    res.write(': connected\n\n');
    const keep = setInterval(() => {
      if (!res.writableEnded) res.write(': ping\n\n');
    }, 25000);
    const cleanup = () => clearInterval(keep);
    req.on('close', cleanup);
    res.on('close', cleanup);
    return;
  }

  if (method !== 'POST') {
    return send(res, 405, { error: 'method_not_allowed' });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, { error: 'invalid_json' });
  }
  if (body == null) return send(res, 400, { error: 'body_required' });

  const messages = Array.isArray(body) ? body : [body];
  const accept = String(req.headers.accept || '');
  const wantsSse = accept.includes('text/event-stream');
  let sessionId = req.headers['mcp-session-id'] ? String(req.headers['mcp-session-id']) : null;

  const isInit = messages.some((m) => m && m.method === 'initialize');
  if (isInit) {
    sessionId = randomUUID();
    mcpSessions.set(sessionId, { createdAt: Date.now() });
  } else if (sessionId && !mcpSessions.has(sessionId)) {
    mcpSessions.set(sessionId, { createdAt: Date.now() });
  } else if (!sessionId) {
    sessionId = randomUUID();
    mcpSessions.set(sessionId, { createdAt: Date.now() });
  }

  const responses = [];
  for (const msg of messages) {
    const out = await handleJsonRpc(msg, {
      callTool,
      instructions: mcpInstructions(),
      baseLabel: loopbackBase,
    });
    if (out.kind === 'response') responses.push(out.message);
  }

  if (responses.length === 0) {
    res.writeHead(202, mcpJsonHeaders(sessionId, { 'Access-Control-Allow-Origin': '*' }));
    res.end();
    return;
  }

  if (wantsSse) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Mcp-Session-Id': sessionId,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Mcp-Session-Id',
    });
    for (const message of responses) writeSseMessage(res, message);
    res.end();
    return;
  }

  const payload = responses.length === 1 ? responses[0] : responses;
  res.writeHead(200, mcpJsonHeaders(sessionId, { 'Access-Control-Allow-Origin': '*' }));
  res.end(JSON.stringify(payload));
}

async function handleApi(req, res, url) {
  const method = req.method || 'GET';

  if (method === 'GET' && (url.pathname === '/api' || url.pathname === '/api/')) {
    return send(res, 200, apiCatalog());
  }

  if (method === 'GET' && url.pathname === '/api/health') {
    return send(res, 200, { ok: true });
  }

  if (method === 'GET' && url.pathname === '/api/diagrams') {
    const manifest = await loadManifest();
    return send(res, 200, manifest);
  }

  if (method === 'GET' && url.pathname === '/api/templates') {
    return send(res, 200, { templates: await listTemplates() });
  }

  const exportMatch = url.pathname.match(/^\/api\/diagrams\/([a-z0-9][a-z0-9-]{0,62})\/export$/);
  if (exportMatch && method === 'POST') {
    const id = exportMatch[1];
    const manifest = await loadManifest();
    const entry = manifest.entries.find((e) => e.id === id);
    if (!entry) return send(res, 404, { error: 'not_found' });

    const artifactAbs = path.join(LIBRARY, entry.artifact);
    if (!fs.existsSync(artifactAbs)) {
      return send(res, 404, { error: 'artifact_missing' });
    }

    const body = await readBody(req);
    if (!body || typeof body.format !== 'string') {
      return send(res, 400, { error: 'format_required', formats: [...EXPORT_FORMATS] });
    }
    if (!EXPORT_FORMATS.includes(body.format)) {
      return send(res, 400, { error: 'bad_format', formats: [...EXPORT_FORMATS] });
    }

    let resolvedPath = null;
    if (body.outputPath) {
      try {
        resolvedPath = resolveExportOutputPath(ROOT, body.outputPath);
      } catch (err) {
        if (err instanceof ExportPathError) {
          return send(res, 400, { error: err.code, message: err.message });
        }
        throw err;
      }
    }

    const artifactUrl = `http://127.0.0.1:${PORT}/library/${entry.artifact.split(path.sep).join('/')}`;
    let exported;
    try {
      exported = await exportDiagramArtifact({
        artifactUrl,
        format: body.format,
        route: body.route,
        reach: body.reach,
        theme: body.theme,
        omitText: body.omitText === true,
      });
    } catch (err) {
      if (err instanceof HeadlessExportError) {
        return send(res, err.status, {
          error: err.code,
          message: err.message,
        });
      }
      throw err;
    }

    const includeBase64 = resolvedPath
      ? body.includeBase64 === true
      : true;

    if (resolvedPath) {
      await fsp.mkdir(path.dirname(resolvedPath.absolute), { recursive: true });
      await fsp.writeFile(resolvedPath.absolute, exported.buffer);
    }

    const response = {
      ok: true,
      id,
      format: exported.format,
      mimeType: exported.mimeType,
      bytes: exported.bytes,
      path: resolvedPath ? resolvedPath.relative : null,
    };
    if (includeBase64) response.base64 = exported.buffer.toString('base64');
    return send(res, 200, response);
  }

  const one = url.pathname.match(/^\/api\/diagrams\/([a-z0-9][a-z0-9-]{0,62})$/);
  if (one) {
    const id = one[1];
    const manifest = await loadManifest();
    const entry = manifest.entries.find((e) => e.id === id);

    if (method === 'GET') {
      if (!entry) return send(res, 404, { error: 'not_found' });
      const sourcePath = path.join(LIBRARY, entry.source);
      const doc = await readJson(sourcePath);
      return send(res, 200, { entry, document: doc });
    }

    if (method === 'DELETE') {
      if (!entry) return send(res, 404, { error: 'not_found' });
      await fsp.rm(path.join(LIBRARY, entry.source), { force: true });
      await fsp.rm(path.join(LIBRARY, entry.artifact), { force: true });
      manifest.entries = manifest.entries.filter((e) => e.id !== id);
      await saveManifest(manifest);
      return send(res, 200, { ok: true });
    }

    if (method === 'PUT') {
      if (!entry) return send(res, 404, { error: 'not_found' });
      const body = await readBody(req);
      if (!body || typeof body.document !== 'object' || body.document === null) {
        return send(res, 400, { error: 'document_required' });
      }
      const doc = body.document;
      const type = doc.diagram_type || entry.type;
      if (!TYPES.has(type)) return send(res, 400, { error: 'bad_type' });

      // If type changed, rename files.
      let sourceRel = entry.source;
      let artifactRel = entry.artifact;
      if (type !== entry.type) {
        sourceRel = `sources/${sourceName(id, type)}`;
        artifactRel = `artifacts/${artifactName(id, type)}`;
        await fsp.rm(path.join(LIBRARY, entry.source), { force: true });
        await fsp.rm(path.join(LIBRARY, entry.artifact), { force: true });
      }

      const sourcePath = path.join(LIBRARY, sourceRel);
      const artifactPath = path.join(LIBRARY, artifactRel);
      await writeJson(sourcePath, doc);

      if (body.validateOnly) {
        const validation = await validateDiagram(type, sourcePath);
        return send(res, validation.ok ? 200 : 422, { ok: validation.ok, validation });
      }

      const delivery = await deliverDiagram(type, sourcePath, artifactPath);
      if (!delivery.ok) {
        return send(res, 422, { ok: false, delivery });
      }

      entry.type = type;
      entry.title = titleFromDoc(doc, id);
      entry.source = sourceRel;
      entry.artifact = artifactRel;
      entry.updatedAt = new Date().toISOString();
      await saveManifest(manifest);
      return send(res, 200, { ok: true, entry, delivery });
    }
  }

  if (method === 'POST' && url.pathname === '/api/diagrams') {
    const body = await readBody(req);
    if (!body) return send(res, 400, { error: 'body_required' });
    const id = body.id;
    const type = body.type;
    if (!safeId(id)) return send(res, 400, { error: 'bad_id', hint: 'use lowercase letters, numbers, hyphens' });
    if (!TYPES.has(type)) return send(res, 400, { error: 'bad_type' });

    const manifest = await loadManifest();
    if (manifest.entries.some((e) => e.id === id)) {
      return send(res, 409, { error: 'exists' });
    }

    let doc = body.document;
    if (!doc) {
      const templateName = body.template || null;
      const templates = await listTemplates();
      const pick = templates.find((t) => t.type === type && (!templateName || t.file === templateName || t.id === templateName))
        || templates.find((t) => t.type === type);
      if (!pick) return send(res, 400, { error: 'no_template' });
      doc = await readJson(path.join(EXAMPLES, pick.file));
      doc.diagram_type = type;
      if (!doc.meta) doc.meta = {};
      doc.meta.title = body.title || `${id} (${type})`;
      doc.meta.quality_profile = doc.meta.quality_profile || 'showcase';
    }

    const sourceRel = `sources/${sourceName(id, type)}`;
    const artifactRel = `artifacts/${artifactName(id, type)}`;
    const sourcePath = path.join(LIBRARY, sourceRel);
    const artifactPath = path.join(LIBRARY, artifactRel);
    await writeJson(sourcePath, doc);
    const delivery = await deliverDiagram(type, sourcePath, artifactPath);
    if (!delivery.ok) {
      await fsp.rm(sourcePath, { force: true });
      return send(res, 422, { ok: false, delivery });
    }

    const entry = {
      id,
      type,
      title: titleFromDoc(doc, id),
      source: sourceRel,
      artifact: artifactRel,
      updatedAt: new Date().toISOString(),
    };
    manifest.entries.push(entry);
    await saveManifest(manifest);
    return send(res, 201, { ok: true, entry, delivery });
  }

  return send(res, 404, { error: 'not_found' });
}

function serveFile(res, file) {
  const ext = path.extname(file).toLowerCase();
  const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
  if (ext === '.woff2') {
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  }
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';

  // Library artifacts/sources
  if (rel.startsWith('/library/')) {
    const file = path.normalize(path.join(LIBRARY, rel.slice('/library/'.length)));
    if (!file.startsWith(LIBRARY) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return send(res, 404, 'Not found');
    }
    serveFile(res, file);
    return;
  }

  const wwwFile = path.normalize(path.join(WWW, rel));
  if (wwwFile.startsWith(WWW) && fs.existsSync(wwwFile) && !fs.statSync(wwwFile).isDirectory()) {
    serveFile(res, wwwFile);
    return;
  }

  // Bundled Archify assets (fonts, etc.) when not copied into var/www.
  if (rel.startsWith('/assets/')) {
    const assetFile = path.normalize(path.join(ARCHIFY_ASSETS, rel.slice('/assets/'.length)));
    if (assetFile.startsWith(ARCHIFY_ASSETS) && fs.existsSync(assetFile) && !fs.statSync(assetFile).isDirectory()) {
      serveFile(res, assetFile);
      return;
    }
  }

  return send(res, 404, 'Not found');
}

await seedLibraryIfEmpty();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
      await handleMcpHttp(req, res, url);
      return;
    }
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (err) {
    console.error(err);
    send(res, 500, { error: 'server_error', message: String(err?.message || err) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Archify library app on http://${HOST}:${PORT}/`);
  console.log(`MCP Streamable HTTP on http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}/mcp`);
});
