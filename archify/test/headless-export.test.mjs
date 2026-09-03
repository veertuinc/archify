import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  exportDiagramArtifact,
  findChrome,
  HeadlessExportError,
} from '../../scripts/lib/archify-headless-export.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(__dirname, '../examples/web-app-rendered.html');
const chrome = findChrome();

test('rejects bad format without Chrome', async () => {
  await assert.rejects(
    () => exportDiagramArtifact({ artifactPath: fixture, format: 'gif' }),
    (err) => err instanceof HeadlessExportError && err.code === 'bad_format',
  );
});

test('rejects route-share-card without route', async () => {
  await assert.rejects(
    () => exportDiagramArtifact({ artifactPath: fixture, format: 'route-share-card' }),
    (err) => err instanceof HeadlessExportError && err.code === 'route_required',
  );
});

test('headless export forwards omitText through exportOmitText URL param', async () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../scripts/lib/archify-headless-export.mjs'),
    'utf8',
  );
  assert.match(source, /options\.omitText === true/);
  assert.match(source, /u\.searchParams\.set\('exportOmitText', '1'\)/);
});

test(
  'exports svg from fixture HTML via Chrome',
  { skip: !chrome ? 'Chrome/Chromium not available' : false },
  async () => {
    const result = await exportDiagramArtifact({
      artifactPath: fixture,
      format: 'svg',
      timeoutMs: 90000,
    });
    assert.equal(result.format, 'svg');
    assert.ok(result.bytes > 100);
    assert.match(result.mimeType, /svg/);
    const text = result.buffer.toString('utf8');
    assert.match(text, /<svg[\s>]/i);
  },
);
