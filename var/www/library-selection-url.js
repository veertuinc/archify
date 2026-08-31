/** Diagram id shape used by the library API and gallery UI. */
export const DIAGRAM_ID_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Read a diagram id from a location search string (e.g. "?id=web-app").
 * @param {string} search
 * @returns {string|null}
 */
export function getDiagramIdFromSearch(search) {
  const raw = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('id');
  if (!raw || !DIAGRAM_ID_RE.test(raw)) return null;
  return raw;
}

/**
 * Build path + search with `id` set (keeps other query params).
 * @param {string} href absolute or path URL
 * @param {string} id
 * @returns {string} pathname + search
 */
export function setDiagramIdInUrl(href, id) {
  const url = new URL(href, 'http://local.test');
  if (!DIAGRAM_ID_RE.test(id)) return url.pathname + url.search;
  url.searchParams.set('id', id);
  return url.pathname + url.search;
}

/**
 * Build path + search with `id` removed.
 * @param {string} href
 * @returns {string}
 */
export function clearDiagramIdInUrl(href) {
  const url = new URL(href, 'http://local.test');
  url.searchParams.delete('id');
  const search = url.searchParams.toString();
  return url.pathname + (search ? `?${search}` : '');
}

/**
 * Pick which diagram id to open after a list refresh.
 * Priority: explicit selectId → current in-memory id → URL id → first entry.
 * @param {{ selectId?: string|null, currentId?: string|null, urlId?: string|null, entryIds: string[] }} opts
 * @returns {string|null}
 */
export function resolveSelectionId({ selectId = null, currentId = null, urlId = null, entryIds }) {
  const ids = new Set(entryIds);
  for (const candidate of [selectId, currentId, urlId]) {
    if (candidate && ids.has(candidate)) return candidate;
  }
  return entryIds[0] || null;
}
