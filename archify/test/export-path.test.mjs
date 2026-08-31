import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ExportPathError,
  resolveExportOutputPath,
} from '../../scripts/lib/archify-export-path.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

test('accepts docs/ and var/library/exports/ relative paths', () => {
  const docs = resolveExportOutputPath(repoRoot, 'docs/assets/demo.png');
  assert.equal(docs.relative, 'docs/assets/demo.png');
  assert.equal(docs.absolute, path.join(repoRoot, 'docs/assets/demo.png'));

  const lib = resolveExportOutputPath(repoRoot, 'var/library/exports/demo.svg');
  assert.equal(lib.relative, 'var/library/exports/demo.svg');
});

test('accepts absolute paths under allowlist', () => {
  const abs = path.join(repoRoot, 'docs', 'assets', 'abs.png');
  const resolved = resolveExportOutputPath(repoRoot, abs);
  assert.equal(resolved.relative, 'docs/assets/abs.png');
});

test('rejects paths outside allowlist', () => {
  assert.throws(
    () => resolveExportOutputPath(repoRoot, 'var/www/index.html'),
    (err) => err instanceof ExportPathError && err.code === 'bad_output_path',
  );
  assert.throws(
    () => resolveExportOutputPath(repoRoot, '../outside.png'),
    ExportPathError,
  );
  assert.throws(
    () => resolveExportOutputPath(repoRoot, 'docs'),
    ExportPathError,
  );
});

test('rejects symlink escape when link exists', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-export-path-'));
  const root = path.join(tmp, 'repo');
  fs.mkdirSync(path.join(root, 'docs', 'assets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'var', 'library', 'exports'), { recursive: true });
  const outside = path.join(tmp, 'secret.png');
  fs.writeFileSync(outside, 'x');
  const link = path.join(root, 'docs', 'assets', 'escape.png');
  try {
    fs.symlinkSync(outside, link);
  } catch (err) {
    if (err?.code === 'EPERM' || err?.code === 'EACCES') {
      // Windows without symlink privilege
      return;
    }
    throw err;
  }
  assert.throws(
    () => resolveExportOutputPath(root, 'docs/assets/escape.png'),
    ExportPathError,
  );
});
