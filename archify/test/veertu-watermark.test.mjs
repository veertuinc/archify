import assert from 'node:assert/strict';
import { injectVeertuWatermark } from '../renderers/shared/veertu-watermark.mjs';

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

console.log('veertu-watermark.test.mjs: ok');
