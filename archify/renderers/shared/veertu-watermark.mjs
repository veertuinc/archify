// Veertu corner watermark for delivered diagram SVGs.
// Atom mark is intentionally simplified so it stays legible at small size.

const WATERMARK_CLASS = 'veertu-watermark';
const VIEWBOX_RE = /\bviewBox\s*=\s*["']([^"']+)["']/i;
const SVG_OPEN_RE = /<svg\b[^>]*>/i;

function parseViewBox(svg) {
  const match = svg.match(VIEWBOX_RE);
  if (!match) return null;
  const parts = match[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
}

function watermarkMarkup(viewBox) {
  const size = Math.max(28, Math.min(48, Math.round(Math.min(viewBox.width, viewBox.height) * 0.07)));
  const pad = Math.max(12, Math.round(size * 0.35));
  const x = viewBox.minX + viewBox.width - size - pad;
  const y = viewBox.minY + viewBox.height - size - pad;
  const scale = size / 64;
  return `<g class="${WATERMARK_CLASS}" aria-hidden="true" pointer-events="none" opacity="0.55" transform="translate(${x} ${y}) scale(${scale})">
  <ellipse cx="32" cy="32" rx="26" ry="10" fill="none" stroke="#60259F" stroke-width="3" transform="rotate(60 32 32)"/>
  <ellipse cx="32" cy="32" rx="26" ry="10" fill="none" stroke="#60259F" stroke-width="3" transform="rotate(-60 32 32)"/>
  <ellipse cx="32" cy="32" rx="26" ry="10" fill="none" stroke="#60259F" stroke-width="3"/>
  <circle cx="32" cy="32" r="8" fill="#EA1D76"/>
</g>`;
}

/**
 * Append a bottom-right Veertu atom watermark before </svg>.
 * Idempotent: skips if a watermark group is already present.
 */
export function injectVeertuWatermark(svg) {
  if (typeof svg !== 'string' || !svg.includes('<svg')) return svg;
  if (svg.includes(`class="${WATERMARK_CLASS}"`) || svg.includes(`class='${WATERMARK_CLASS}'`)) {
    return svg;
  }
  const viewBox = parseViewBox(svg) || { minX: 0, minY: 0, width: 960, height: 540 };
  if (!SVG_OPEN_RE.test(svg)) return svg;
  const mark = watermarkMarkup(viewBox);
  if (/<\/svg>\s*$/i.test(svg)) {
    return svg.replace(/<\/svg>\s*$/i, `${mark}\n</svg>`);
  }
  const idx = svg.lastIndexOf('</svg>');
  if (idx === -1) return svg;
  return `${svg.slice(0, idx)}${mark}\n${svg.slice(idx)}`;
}

export const VEERTU_DEFAULT_PRESET = 'veertu';
