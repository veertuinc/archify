# Veertu diagram branding — design

Date: 2026-08-31

## Goal

Align Archify diagrams and Anka docs use-case SVGs with Veertu/Anka brand styling from `anka-docs-wrapper` and veertu.com, including a corner Veertu logo watermark.

## Decisions

- Scope: Archify diagram system + docs use-case SVGs (both)
- Logo: bottom-right Veertu atom watermark on every diagram
- Theme: new `veertu` visual preset, light-first, set as default; keep classic / signal-flow / blueprint / editorial
- Font: Museo Sans Rounded with system-ui fallback
- Approach: shared token set applied in both repos (no Archify IR rewrite of docs SVGs)

## Tokens

| Role | Hex |
|------|-----|
| Primary | `#60259F` |
| Accent | `#EA1D76` |
| Docs purple | `#624495` |
| Connector | `#30638E` |
| Canvas | `#F4F1F8` |
| Ink | `#1F1630` |
| Soft node | `#eef2ff` |

Dark veertu canvas: `#1F1630`.

## Archify

- Add `veertu` to schema + CSS in `template.html` + i18n
- Default `meta.visual_preset` → `veertu`
- Inject watermark into delivered SVG
- Embed Museo for veertu preset
- Add `veertu` / `anka` brand-mark catalog entries (optional node badges)

## Docs SVGs

- Update all SVGs under `anka-docs-wrapper/content/static/images/use-cases/`
- Shared CSS tokens + Museo stack + bottom-right watermark fragment
- Keep hand layouts

## Out of scope

- Regenerating docs diagrams from Archify IR
- Docsy / veertu.com site chrome rewrites
