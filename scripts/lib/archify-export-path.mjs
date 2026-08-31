/**
 * Resolve and validate diagram export output paths.
 * Allowed roots (under repo root): docs/, var/library/exports/
 */

import fs from 'node:fs';
import path from 'node:path';

export class ExportPathError extends Error {
  constructor(message, code = 'bad_output_path') {
    super(message);
    this.name = 'ExportPathError';
    this.code = code;
  }
}

function isUnderAllowedRelative(relativePosix) {
  const withSep = relativePosix.endsWith('/') ? relativePosix : `${relativePosix}/`;
  // Exact file under allowed dir: normalize to use /
  const norm = relativePosix.replace(/\\/g, '/');
  if (norm === 'docs' || norm === 'var/library/exports') {
    return false; // must be a file path, not the directory itself
  }
  return (
    norm.startsWith('docs/')
    || norm.startsWith('var/library/exports/')
  );
}

/**
 * @param {string} root Absolute repository root
 * @param {string} outputPath Absolute or repo-relative path
 * @returns {{ absolute: string, relative: string }}
 */
export function resolveExportOutputPath(root, outputPath) {
  if (typeof outputPath !== 'string' || !outputPath.trim()) {
    throw new ExportPathError('outputPath is required when resolving a write path');
  }
  const rootAbs = path.resolve(root);
  const candidate = path.isAbsolute(outputPath)
    ? path.resolve(outputPath)
    : path.resolve(rootAbs, outputPath);

  const relative = path.relative(rootAbs, candidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ExportPathError(`outputPath escapes repository root: ${outputPath}`);
  }

  const relativePosix = relative.split(path.sep).join('/');
  if (relativePosix.split('/').includes('..')) {
    throw new ExportPathError(`outputPath contains parent segments: ${outputPath}`);
  }
  if (!isUnderAllowedRelative(relativePosix)) {
    throw new ExportPathError(
      `outputPath must be under docs/ or var/library/exports/: ${outputPath}`,
    );
  }

  // Reject symlink escape of final path or any parent under root
  let probe = candidate;
  const seen = new Set();
  while (probe && probe !== rootAbs && !seen.has(probe)) {
    seen.add(probe);
    try {
      const stat = fs.lstatSync(probe);
      if (stat.isSymbolicLink()) {
        const real = fs.realpathSync(probe);
        const realRel = path.relative(rootAbs, real);
        if (!realRel || realRel.startsWith('..') || path.isAbsolute(realRel)) {
          throw new ExportPathError(`outputPath symlink escapes repository root: ${outputPath}`);
        }
        const realPosix = realRel.split(path.sep).join('/');
        if (probe === candidate && !isUnderAllowedRelative(realPosix)) {
          throw new ExportPathError(`outputPath symlink target not under allowlist: ${outputPath}`);
        }
      }
    } catch (err) {
      if (err instanceof ExportPathError) throw err;
      if (err?.code !== 'ENOENT') throw err;
      // Missing path is fine — we create parents later
    }
    const parent = path.dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }

  return {
    absolute: candidate,
    relative: relativePosix,
  };
}
