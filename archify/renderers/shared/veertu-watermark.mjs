// Veertu corner watermark: official wordmark from veertu.com.
// Source: https://veertu.com/wp-content/uploads/2020/07/veertu-logo.svg
// Local copy: archify/assets/brand/veertu-logo.svg

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WATERMARK_CLASS = 'veertu-watermark';
const WATERMARK_OPACITY = 0.35;
const LOGO_VIEW_W = 783.009;
const LOGO_VIEW_H = 188.156;
const VIEWBOX_RE = /\bviewBox\s*=\s*["']([^"']+)["']/i;
const SVG_OPEN_RE = /<svg\b[^>]*>/i;
const WATERMARK_GROUP_RE = /<g\b[^>]*class=["']veertu-watermark["'][\s\S]*?<\/g>\s*/gi;

const here = path.dirname(fileURLToPath(import.meta.url));
const logoPath = path.resolve(here, '../../assets/brand/veertu-logo.svg');

let cachedLogoPaths = null;

function loadLogoPaths() {
  if (cachedLogoPaths) return cachedLogoPaths;
  const raw = fs.readFileSync(logoPath, 'utf8');
  const paths = [...raw.matchAll(/<path\b[^>]*\/?>/gi)].map((m) => m[0]
    .replace(/\s+/g, ' ')
    .replace(/\sid="[^"]*"/gi, '')
    .trim());
  if (paths.length < 6) {
    throw new Error(`veertu-watermark: expected 6 paths in ${logoPath}, found ${paths.length}`);
  }
  cachedLogoPaths = paths.join('');
  return cachedLogoPaths;
}

function parseViewBox(svg) {
  const match = svg.match(VIEWBOX_RE);
  if (!match) return null;
  const parts = match[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
}

function watermarkMarkup(viewBox) {
  // Wide wordmark: size by width (~14% of canvas), clamp for small diagrams.
  const targetW = Math.max(96, Math.min(180, Math.round(viewBox.width * 0.14)));
  const scale = targetW / LOGO_VIEW_W;
  const targetH = LOGO_VIEW_H * scale;
  const pad = Math.max(10, Math.round(Math.min(viewBox.width, viewBox.height) * 0.02));
  const x = viewBox.minX + viewBox.width - targetW - pad;
  const y = viewBox.minY + viewBox.height - targetH - pad;
  const paths = loadLogoPaths();
  return `<g class="${WATERMARK_CLASS}" data-veertu-logo="wordmark" aria-hidden="true" pointer-events="none" opacity="${WATERMARK_OPACITY}" transform="translate(${x} ${y}) scale(${scale})">${paths}</g>`;
}

function stripWatermark(svg) {
  return svg.replace(WATERMARK_GROUP_RE, '');
}

/**
 * Append (or replace) a bottom-right Veertu wordmark before </svg>.
 */
export function injectVeertuWatermark(svg) {
  if (typeof svg !== 'string' || !svg.includes('<svg')) return svg;
  let next = stripWatermark(svg);
  const viewBox = parseViewBox(next) || { minX: 0, minY: 0, width: 960, height: 540 };
  if (!SVG_OPEN_RE.test(next)) return svg;
  const mark = watermarkMarkup(viewBox);
  if (/<\/svg>\s*$/i.test(next)) {
    return next.replace(/<\/svg>\s*$/i, `${mark}\n</svg>`);
  }
  const idx = next.lastIndexOf('</svg>');
  if (idx === -1) return svg;
  return `${next.slice(0, idx)}${mark}\n${next.slice(idx)}`;
}

export const VEERTU_DEFAULT_PRESET = 'veertu';
