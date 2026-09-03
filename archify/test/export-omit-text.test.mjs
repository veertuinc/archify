import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, '..');
const template = fs.readFileSync(path.join(skillRoot, 'assets', 'template.html'), 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-export-omit-text-'));

function renderArchitecture() {
  const output = path.join(tmp, 'architecture.html');
  execFileSync(process.execPath, [
    path.join(skillRoot, 'renderers/architecture/render-architecture.mjs'),
    path.join(skillRoot, 'examples', 'web-app.architecture.json'),
    output,
  ]);
  return fs.readFileSync(output, 'utf8');
}

test('export menu exposes Share Card title/branding toggle without stripping diagram labels', () => {
  assert.match(template, /id="export-omit-text"/);
  assert.match(template, /\{\{i18n:viewer\.export\.omitText\}\}/);
  assert.doesNotMatch(template, /function stripDiagramText\(root\)/);
  assert.doesNotMatch(template, /if \(opts\.omitText\) stripDiagramText\(clone\);/);
  assert.match(template, /if \(!omitText\) \{[\s\S]*?ctx\.fillText\(fittedTitle/);
  assert.match(template, /if \(!omitText\) \{[\s\S]*?ctx\.fillText\(cardLabel/);
  assert.match(template, /var headerOffset = omitText[\s\S]*?SHARE_CARD_HEADER;/);
  assert.match(template, /if \(omitText\) \{[\s\S]*?tightCanvas\.width = data\.width;/);
  assert.match(template, /var sourceScale = pickSafeScale\(vb\.width, vb\.height\);/);
  assert.doesNotMatch(template, /Math\.min\(2, pickSafeScale/);
  assert.match(template, /data-last-export-omit-text/);
});

test('rendered artifacts keep diagram labels in serializeSvg while Share Card omits title and badge', () => {
  const html = renderArchitecture();
  assert.match(html, /id="export-omit-text"/);
  assert.match(html, /Hide title and branding/);
  assert.doesNotMatch(html, /function stripDiagramText\(root\)/);
  assert.match(html, /var data = serializeSvg\(scale\);/);
  assert.match(html, /serializeSvg\(1, \{ autoTheme: true \}\)/);
  assert.match(html, /serializeSvg\(sourceScale, \{[\s\S]*?routeSnapshot: routeSnapshot,[\s\S]*?reachSnapshot: reachSnapshot[\s\S]*?\}\)/);
  assert.doesNotMatch(html, /withExportOmitText/);
});

test('i18n defines Share Card title/branding copy', () => {
  const i18n = fs.readFileSync(path.join(skillRoot, 'renderers/shared/i18n.mjs'), 'utf8');
  assert.match(i18n, /'viewer\.export\.omitText': "Hide title and branding"/);
  assert.match(i18n, /'viewer\.export\.omitText\.hint': "Share Card: crop to diagram frame; no title or ARCHIFY badge"/);
});

process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
