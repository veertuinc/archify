#!/usr/bin/env node
/**
 * Re-deliver every library manifest entry so HTML artifacts pick up
 * template/runtime changes without touching authored JSON sources.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LIBRARY = path.join(ROOT, 'var', 'library');
const MANIFEST = path.join(LIBRARY, 'manifest.json');
const ARCHIFY_BIN = path.join(ROOT, 'archify', 'bin', 'archify.mjs');
const NODE_BIN = process.env.NODE_BIN || process.execPath;

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
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
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
  return { ok: result.code === 0, code: result.code, stderr: result.stderr };
}

async function main() {
  if (!fs.existsSync(MANIFEST)) {
    console.error('refresh-library: manifest not found at', MANIFEST);
    process.exit(1);
  }

  const manifest = JSON.parse(await fsp.readFile(MANIFEST, 'utf8'));
  const entries = manifest.entries || [];
  if (!entries.length) {
    console.log('refresh-library: no entries to refresh');
    return;
  }

  const failures = [];
  for (const entry of entries) {
    const sourcePath = path.join(LIBRARY, entry.source);
    const artifactPath = path.join(LIBRARY, entry.artifact);
    if (!fs.existsSync(sourcePath)) {
      failures.push({ id: entry.id, error: `missing source ${entry.source}` });
      continue;
    }
    const delivery = await deliverDiagram(entry.type, sourcePath, artifactPath);
    if (!delivery.ok) {
      failures.push({ id: entry.id, error: delivery.stderr || `deliver exited ${delivery.code}` });
      continue;
    }
    entry.updatedAt = new Date().toISOString();
    console.log(`refresh-library: ok ${entry.id}`);
  }

  await fsp.writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

  if (failures.length) {
    console.error('refresh-library: failures:', failures);
    process.exit(1);
  }

  console.log(`refresh-library: refreshed ${entries.length} diagram(s)`);
}

main().catch((err) => {
  console.error('refresh-library:', err);
  process.exit(1);
});
