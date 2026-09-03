import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectVeertuWatermark } from '../renderers/shared/veertu-watermark.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, '..');

const sample = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 380" role="img">
  <rect width="760" height="380" fill="#F4F1F8"/>
  <text x="20" y="20">Demo</text>
</svg>`;

const once = injectVeertuWatermark(sample);
assert.match(once, /class="veertu-watermark"/);
assert.match(once, /data-veertu-logo="wordmark"/);
assert.match(once, /#EA1D76/);
assert.match(once, /#62269E/);
assert.match(once, /#BCBEC0/);
assert.doesNotMatch(once, /<ellipse /);
assert.ok(once.indexOf('veertu-watermark') < once.lastIndexOf('</svg>'));

const twice = injectVeertuWatermark(once);
assert.equal((twice.match(/veertu-watermark/g) || []).length, 1);
assert.match(twice, /data-veertu-logo="wordmark"/);

const withAtom = `<svg viewBox="0 0 100 100"><g class="veertu-watermark"><circle cx="10" cy="10" r="8" fill="#EA1D76"/></g></svg>`;
const replaced = injectVeertuWatermark(withAtom);
assert.equal((replaced.match(/veertu-watermark/g) || []).length, 1);
assert.match(replaced, /data-veertu-logo="wordmark"/);
assert.doesNotMatch(replaced, /<circle cx="10"/);

const template = fs.readFileSync(path.join(skillRoot, 'assets', 'template.html'), 'utf8');
assert.doesNotMatch(template, /veertu\.com\/wp-content\/uploads\/.*\.woff2/);
assert.match(template, /url\('\/assets\/fonts\/MuseoSansRounded-300\.woff2'\)/);
assert.match(template, /url\('\/assets\/fonts\/MuseoSansRounded-500\.woff2'\)/);
for (const weight of ['300', '500']) {
  const fontPath = path.join(skillRoot, 'assets', 'fonts', `MuseoSansRounded-${weight}.woff2`);
  assert.ok(fs.existsSync(fontPath), `missing bundled font ${fontPath}`);
}

console.log('veertu-watermark.test.mjs: ok');
