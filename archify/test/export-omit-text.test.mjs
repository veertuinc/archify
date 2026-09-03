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

test('export menu exposes a hide-labels option wired through serializeSvg and Share Card', () => {
  assert.match(template, /id="export-omit-text"/);
  assert.match(template, /\{\{i18n:viewer\.export\.omitText\}\}/);
  assert.match(template, /function stripDiagramText\(root\)/);
  assert.match(template, /function withExportOmitText\(opts\)/);
  assert.match(template, /if \(opts\.omitText\) stripDiagramText\(clone\);/);
  assert.match(template, /if \(!omitText\) \{[\s\S]*?ctx\.fillText\(cardLabel/);
  assert.match(template, /var headerOffset = omitText \? SHARE_CARD_PADDING : SHARE_CARD_HEADER;/);
  assert.match(template, /data-last-export-omit-text/);
});

test('rendered artifacts inherit the hide-labels export option', () => {
  const html = renderArchitecture();
  assert.match(html, /id="export-omit-text"/);
  assert.match(html, /Hide labels and branding/);
  assert.match(html, /function stripDiagramText\(root\)/);
  assert.match(html, /serializeSvg\(scale, withExportOmitText\(\)\)/);
  assert.match(html, /serializeSvg\(1, withExportOmitText\(\{ autoTheme: true \}\)\)/);
  assert.match(html, /serializeSvg\(sourceScale, withExportOmitText\(\{[\s\S]*?omitText: omitText/);
});

test('i18n defines hide-labels copy in both locales', () => {
  const i18n = fs.readFileSync(path.join(skillRoot, 'renderers/shared/i18n.mjs'), 'utf8');
  assert.match(i18n, /'viewer\.export\.omitText': \['Hide labels and branding', '隐藏标签与品牌标识'\]/);
  assert.match(i18n, /'viewer\.export\.omitText\.hint':/);
});

process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
