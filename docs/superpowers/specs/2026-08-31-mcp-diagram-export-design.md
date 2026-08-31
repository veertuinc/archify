# Library diagram export API + MCP

**Date:** 2026-08-31  
**Status:** approved (approach 1 — shared headless exporter + REST + MCP)  
**Extends:** `2026-08-31-diagram-api-mcp-design.md`

## Goal

Agents regenerate documentation images through the library. They pick any viewer export format, optionally write under allowed paths, or receive bytes in the response.

## Decisions

| Topic | Choice |
|-------|--------|
| Architecture | Shared headless exporter; REST canonical; MCP wraps REST |
| Formats (v1) | Full viewer menu: `svg`, `png`, `jpeg`, `webp`, `webm`, `share-card`, `route-share-card`, `reach-share-card` |
| Delivery | Optional `outputPath` write **or** base64 in response (both supported) |
| Source | Existing library diagram with delivered HTML only |
| Host deps | Chrome/Chromium required; ffmpeg required for `webm` |
| Auth | Unchanged — none in v1; private network only |

## Architecture

```
Agent (export_diagram)  ──┐
Scripts / CI (REST)     ──┼──► POST /api/diagrams/{id}/export
                          │         │
                          │         ▼
                          │   scripts/lib/archify-headless-export.mjs
                          │   (Chrome + Archify.exportMenu)
                          │         │
                          │         ├─► write under docs/ or var/library/exports/
                          │         └─► JSON { path?, base64?, mimeType, bytes, … }
                          ▼
                var/library/artifacts/{id}.{type}.html
```

- Create/update remains the path that delivers HTML.
- Export never re-delivers; it opens the current artifact.
- One module owns Chrome launch, page load, viewer setup, and blob capture (same family as `visual-check` / WebM smoke).

## HTTP API

**Endpoint:** `POST /api/diagrams/{id}/export`

**Body:**

| Field | Required | Notes |
|-------|----------|--------|
| `format` | yes | Enum above |
| `outputPath` | no | Repo-relative or absolute; resolved under allowlist |
| `includeBase64` | no | Default `false` when `outputPath` is set; ignored/`true` when omitted |
| `route` | for `route-share-card` | `{ source: string, target: string }` — calls `routeProbe.begin` then `choose` before export |
| `reach` | for `reach-share-card` | `{ nodeId: string, direction: string }` — select/focus node then `focus.reach(direction)` before export |
| `theme` | no | Applied only if the delivered viewer exposes a supported theme switch for export; otherwise ignored |

**Success (200):**

```json
{
  "ok": true,
  "id": "web-app",
  "format": "png",
  "mimeType": "image/png",
  "bytes": 12345,
  "path": "docs/assets/web-app.png",
  "base64": "…"
}
```

- With `outputPath`: always return `path` (repo-relative). Include `base64` only if `includeBase64: true`.
- Without `outputPath`: `path` is `null`; `base64` is required.

**`outputPath` safety:**

- Resolve against repository root (`ROOT` of the gallery server).
- Allow only under `docs/` and `var/library/exports/`.
- Reject `..` segments, symlink escapes, and missing parent directories that cannot be created safely.
- Create parent directories as needed inside the allowlist.

**Errors:**

| Code | When |
|------|------|
| 404 | Unknown id or missing artifact |
| 400 | Bad format, bad path, or missing/invalid `route` / `reach` |
| 422 | Viewer export failed (message + viewer error attrs when present) |
| 503 | Chrome missing, or ffmpeg missing for `webm` |

Register the endpoint on `GET /api`.

## MCP

**Tool:** `export_diagram`

Args: `id` plus the REST body fields. Implementation: `POST /api/diagrams/{id}/export` via existing `createHttpApi` / `createToolCaller`.

Update Streamable HTTP / stdio instructions:

1. Create or update the diagram before export if the artifact is missing or stale.
2. Choose `format` from the full menu.
3. Prefer `outputPath` under `docs/` for documentation assets; use base64 only when the agent must handle bytes itself.
4. `route-share-card` / `reach-share-card` require `route` / `reach`.
5. WebM needs Chrome and ffmpeg on the library host.

Formats appear in the tool schema enum and in `describe_api`. No separate list-formats tool.

## Headless exporter

**Module:** `scripts/lib/archify-headless-export.mjs`

Responsibilities:

1. Resolve Chrome (`ARCHIFY_CHROME` or common paths), same idea as `visual-check`.
2. Load the artifact over the gallery HTTP origin (not `file://`) so relative assets work.
3. Wait until `window.Archify.exportMenu` is ready.
4. For route/reach formats, apply `route` / `reach` state before export.
5. Capture bytes:
   - Prefer calling `Archify.exportMenu` APIs that return blobs (`run`, `shareCard`, route/reach helpers) and convert blob → base64 in-page, then return to Node.
   - Avoid relying on browser download UI.
6. For `webm`, require ffmpeg availability consistent with existing motion capture paths; surface 503 if missing.
7. Tear down Chrome cleanly; timeout bounded (e.g. 60s default, longer for webm).

Do not duplicate export geometry logic in Node — the viewer remains the source of truth.

## Testing

- Unit: `outputPath` allowlist (accept/reject cases).
- Integration: start gallery (or call exporter against a fixture HTML), export `svg` and `png` for a known library example, assert mime and non-empty bytes.
- Route/reach: one happy-path each with known source/target or node/direction from an example diagram.
- MCP core: tool schema includes `export_diagram`; caller maps args to POST.
- Skip or mark Chrome-dependent tests when Chrome is absent (same pattern as existing visual smoke).

## Out of scope

- Auth / TLS
- CLI `archify export` (can wrap the same module later)
- Export without a library id (ad-hoc IR upload)
- Changing viewer export geometry or share-card layout
- Writing outside `docs/` and `var/library/exports/`
