import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TOOLS,
  createToolCaller,
} from '../../scripts/lib/archify-mcp-core.mjs';

test('TOOLS includes export_diagram with full format enum', () => {
  const tool = TOOLS.find((t) => t.name === 'export_diagram');
  assert.ok(tool);
  assert.deepEqual(tool.inputSchema.required, ['id', 'format']);
  assert.deepEqual(tool.inputSchema.properties.format.enum, [
    'svg',
    'png',
    'jpeg',
    'webp',
    'webm',
    'share-card',
    'route-share-card',
    'reach-share-card',
  ]);
});

test('export_diagram caller POSTs /api/diagrams/{id}/export', async () => {
  const calls = [];
  const api = async (method, path, body) => {
    calls.push({ method, path, body });
    return { ok: true, id: 'demo', format: 'png', bytes: 1, path: null, base64: 'YQ==' };
  };
  const callTool = createToolCaller(api);
  const result = await callTool('export_diagram', {
    id: 'demo',
    format: 'png',
    outputPath: 'docs/assets/demo.png',
    includeBase64: true,
    theme: 'dark',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].path, '/api/diagrams/demo/export');
  assert.deepEqual(calls[0].body, {
    format: 'png',
    outputPath: 'docs/assets/demo.png',
    includeBase64: true,
    theme: 'dark',
  });
  assert.equal(result.isError, false);
  assert.match(result.content[0].text, /"ok": true/);
});
