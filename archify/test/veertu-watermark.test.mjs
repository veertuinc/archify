import assert from 'node:assert/strict';
import { injectVeertuWatermark } from '../renderers/shared/veertu-watermark.mjs';

const sample = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 380" role="img">
  <rect width="760" height="380" fill="#F4F1F8"/>
  <text x="20" y="20">Demo</text>
</svg>`;

const once = injectVeertuWatermark(sample);
assert.match(once, /class="veertu-watermark"/);
assert.match(once, /#60259F/);
assert.match(once, /#EA1D76/);
assert.ok(once.indexOf('veertu-watermark') < once.lastIndexOf('</svg>'));

const twice = injectVeertuWatermark(once);
assert.equal((twice.match(/veertu-watermark/g) || []).length, 1);

const noViewBox = injectVeertuWatermark('<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>');
assert.match(noViewBox, /veertu-watermark/);

console.log('veertu-watermark.test.mjs: ok');
