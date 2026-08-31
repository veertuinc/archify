# Veertu diagram branding — implementation plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox syntax.

**Goal:** Add a default Veertu-branded Archify preset with watermark, and align docs use-case SVGs to the same tokens.

**Architecture:** Shared brand tokens documented in the design spec. Archify owns the `veertu` preset + SVG watermark injection. Docs SVGs get a shared style/watermark fragment applied in place.

**Tech Stack:** Archify HTML/CSS template, Node renderers, static SVG in Hugo docs.

## Global Constraints

- Default preset is `veertu` (not classic)
- Watermark: Veertu atom, bottom-right, ~55% opacity
- Colors from design spec; do not invent new accents
- Museo Sans Rounded with system-ui fallback
- Keep classic / signal-flow / blueprint / editorial

---

### Task 1: Archify veertu preset + default + watermark

**Files:**
- `archify/schemas/common.schema.json`
- `archify/assets/template.html`
- `archify/renderers/shared/cli.mjs`
- `archify/renderers/shared/i18n.mjs`
- `archify/renderers/shared/utils.mjs` (or watermark helper)
- `archify/assets/` font if needed
- `DESIGN.md` (token note)

- [ ] Add `veertu` to schema enum
- [ ] Add light + dark CSS variable blocks for `veertu`
- [ ] Default `visual_preset` to `veertu` in cli
- [ ] i18n strings for veertu preset
- [ ] Inject watermark group into SVG on write
- [ ] @font-face Museo for veertu (local asset or linked woff2)
- [ ] Smoke-render one example diagram

### Task 2: Brand marks catalog

- [ ] Add custom `veertu` / `anka` entries to `brand-marks/catalog.json`
- [ ] Regenerate `generated-brand-marks.mjs` if scripted

### Task 3: Docs use-case SVGs

**Repo:** `~/anka-docs-wrapper`

- [ ] Script or batch-update 29 SVGs: tokens, font stack, watermark
- [ ] Spot-check shared/deployment-architecture.svg

### Task 4: Verify

- [ ] Archify tests / example render
- [ ] Confirm watermark present in output HTML SVG
- [ ] Confirm docs SVG colors match tokens
