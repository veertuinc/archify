import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getDiagramIdFromSearch,
  setDiagramIdInUrl,
  clearDiagramIdInUrl,
  resolveSelectionId,
} from '../../var/www/library-selection-url.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtml = path.resolve(__dirname, '../../var/www/index.html');

test('getDiagramIdFromSearch reads a valid id and rejects junk', () => {
  assert.equal(getDiagramIdFromSearch('?id=web-app'), 'web-app');
  assert.equal(getDiagramIdFromSearch('id=agent-run&x=1'), 'agent-run');
  assert.equal(getDiagramIdFromSearch('?id=Bad_ID'), null);
  assert.equal(getDiagramIdFromSearch(''), null);
  assert.equal(getDiagramIdFromSearch('?foo=bar'), null);
});

test('setDiagramIdInUrl and clearDiagramIdInUrl keep other params', () => {
  assert.equal(setDiagramIdInUrl('/?theme=dark', 'web-app'), '/?theme=dark&id=web-app');
  assert.equal(setDiagramIdInUrl('/?id=old', 'new-id'), '/?id=new-id');
  assert.equal(clearDiagramIdInUrl('/?id=web-app&theme=dark'), '/?theme=dark');
  assert.equal(clearDiagramIdInUrl('/?id=web-app'), '/');
});

test('resolveSelectionId prefers selectId, then current, then URL, then first entry', () => {
  const entryIds = ['a', 'b', 'c'];
  assert.equal(resolveSelectionId({ selectId: 'b', currentId: 'a', urlId: 'c', entryIds }), 'b');
  assert.equal(resolveSelectionId({ selectId: null, currentId: 'c', urlId: 'a', entryIds }), 'c');
  assert.equal(resolveSelectionId({ selectId: null, currentId: null, urlId: 'b', entryIds }), 'b');
  assert.equal(resolveSelectionId({ selectId: null, currentId: null, urlId: null, entryIds }), 'a');
  assert.equal(resolveSelectionId({ selectId: 'missing', currentId: null, urlId: 'also-missing', entryIds }), 'a');
  assert.equal(resolveSelectionId({ entryIds: [] }), null);
});

test('library index.html syncs selection to ?id= and restores it on load', () => {
  const html = fs.readFileSync(indexHtml, 'utf8');
  assert.match(html, /from ['"]\.\/library-selection-url\.js['"]/);
  assert.match(html, /getDiagramIdFromSearch/);
  assert.match(html, /setDiagramIdInUrl/);
  assert.match(html, /resolveSelectionId/);
  assert.match(html, /history\.replaceState/);
  assert.match(html, /clearDiagramIdInUrl/);
});
