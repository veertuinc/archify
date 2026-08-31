# MCP / API diagram export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the full viewer export menu via `POST /api/diagrams/{id}/export` and MCP `export_diagram`, with optional allowlisted `outputPath` or base64 bytes.

**Architecture:** Shared headless Chrome module calls `Archify.exportMenu` on the delivered library HTML. Gallery REST is canonical; MCP wraps it.

**Tech Stack:** Node.js, Chrome CDP (`ChromeVisualBrowser` from `archify/bin/visual-check.mjs`), existing gallery server + `archify-mcp-core.mjs`.

**Spec:** `docs/superpowers/specs/2026-08-31-mcp-diagram-export-design.md`

## Global Constraints

- Formats: `svg` | `png` | `jpeg` | `webp` | `webm` | `share-card` | `route-share-card` | `reach-share-card`
- `outputPath` only under `docs/` or `var/library/exports/` (repo root)
- Export requires an existing library artifact; do not re-deliver inside export
- Prefer blob return from viewer APIs; intercept `URL.createObjectURL` when `run()` only downloads
- Chrome required; ffmpeg required for `webm` (503 if missing)

## File map

| File | Role |
|------|------|
| `scripts/lib/archify-export-path.mjs` | Resolve/validate `outputPath` |
| `scripts/lib/archify-headless-export.mjs` | Chrome export runner |
| `scripts/archify-app-server.mjs` | REST route + catalog |
| `scripts/lib/archify-mcp-core.mjs` | `export_diagram` tool |
| `archify/test/export-path.test.mjs` | Allowlist unit tests |
| `archify/test/headless-export.test.mjs` | Chrome integration (skip if no Chrome) |
| `archify/test/mcp-export-tool.test.mjs` | Tool schema + caller mapping |

---

### Task 1: `outputPath` allowlist

**Files:**
- Create: `scripts/lib/archify-export-path.mjs`
- Test: `archify/test/export-path.test.mjs`

- [ ] **Step 1:** Write tests for accept (`docs/assets/x.png`, `var/library/exports/x.svg`), reject (`../etc/passwd`, `var/www/x`, symlink escape).
- [ ] **Step 2:** Implement `resolveExportOutputPath(root, outputPath)` → `{ absolute, relative }` or throw with code `bad_output_path`.
- [ ] **Step 3:** Run `node --test archify/test/export-path.test.mjs` — expect PASS.
- [ ] **Step 4:** Commit.

### Task 2: Headless exporter

**Files:**
- Create: `scripts/lib/archify-headless-export.mjs`
- Test: `archify/test/headless-export.test.mjs`

**Interface:**

```js
export async function exportDiagramArtifact({
  artifactUrl, // http://127.0.0.1:PORT/library/artifacts/id.type.html
  format,
  route, // { source, target } | undefined
  reach, // { nodeId, direction } | undefined
  theme, // optional string
  timeoutMs,
}) // → { buffer: Buffer, mimeType: string, bytes: number }
```

- [ ] **Step 1:** Skip-aware test: if `findChrome()` null, skip; else export `svg` from a fixture HTML URL or file served locally.
- [ ] **Step 2:** Implement using `findChrome` + `ChromeVisualBrowser`; navigate to `artifactUrl`; wait for `Archify.exportMenu`; apply route/reach; capture blob → Buffer.
- [ ] **Step 3:** Map formats to mime types; throw structured errors (`chrome_missing`, `ffmpeg_missing`, `export_failed`, `route_required`, `reach_required`).
- [ ] **Step 4:** Commit.

### Task 3: REST + MCP wiring

**Files:**
- Modify: `scripts/archify-app-server.mjs`
- Modify: `scripts/lib/archify-mcp-core.mjs`
- Test: `archify/test/mcp-export-tool.test.mjs`

- [ ] **Step 1:** Add catalog endpoint + `POST /api/diagrams/{id}/export` handler (404/400/422/503 as spec).
- [ ] **Step 2:** Add MCP tool `export_diagram` and caller case.
- [ ] **Step 3:** Unit-test TOOLS includes tool; mock api asserts POST path/body.
- [ ] **Step 4:** Commit.

### Task 4: Smoke against gallery (optional if Chrome present)

- [ ] **Step 1:** With server + Chrome, create/use an example diagram, `POST` export png to `var/library/exports/`, assert file magic.
- [ ] **Step 2:** Commit if new test file or fixtures needed.
