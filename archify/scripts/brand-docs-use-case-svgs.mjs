#!/usr/bin/env node
/**
 * Align Anka docs use-case SVGs with Veertu brand tokens + corner watermark.
 * Run: node scripts/brand-docs-use-case-svgs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectVeertuWatermark } from '../renderers/shared/veertu-watermark.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = process.env.ANKA_DOCS_USE_CASES
  || path.resolve(__dirname, '../../../anka-docs-wrapper/content/static/images/use-cases');

const FONT = "'Museo Sans Rounded', system-ui, -apple-system, 'Segoe UI', sans-serif";

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.svg')) out.push(full);
  }
  return out;
}

function brandFonts(svg) {
  return svg
    .replace(/font:\s*([^;"]+);\s*/g, (match, face) => {
      const m = face.match(/^(\d+\s+)?(\d+px)\s+(.+)$/);
      if (!m) return match;
      const weight = (m[1] || '').trim();
      const size = m[2];
      const rest = weight ? `${weight} ${size}` : size;
      return `font: ${rest} ${FONT}; `;
    })
    .replace(/font-family:\s*[^;"]+/g, `font-family: ${FONT}`);
}

function brandColors(svg) {
  return svg
    .replace(/#f8fafc/gi, '#F4F1F8')
    .replace(/#1f2937/gi, '#1F1630')
    .replace(/fill="#F4F1F8"/g, 'fill="#F4F1F8"'); // normalize noop
}

function processFile(file) {
  const before = fs.readFileSync(file, 'utf8');
  let next = brandFonts(brandColors(before));
  next = injectVeertuWatermark(next);
  if (next !== before) {
    fs.writeFileSync(file, next);
    return true;
  }
  return false;
}

if (!fs.existsSync(DOCS_ROOT)) {
  console.error(`Docs SVG root not found: ${DOCS_ROOT}`);
  process.exit(1);
}

const files = walk(DOCS_ROOT);
let changed = 0;
for (const file of files) {
  if (processFile(file)) {
    changed += 1;
    console.log(`updated ${path.relative(DOCS_ROOT, file)}`);
  }
}
console.log(`branded ${changed}/${files.length} SVGs under ${DOCS_ROOT}`);
