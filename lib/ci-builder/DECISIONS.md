# CI Builder Overhaul — Decision Record

Ratified for implementation (plan recommendations accepted as defaults).

| # | Decision | Choice |
|---|----------|--------|
| 1 | Logo catalog collapse (7 → unified `logo_marks`) | **Yes** — flat list with MAIN + light/dark slots; migrate tertiary into named custom marks |
| 2 | Elements mode vs templates | **Orthogonal** — templates replace Presentation; Elements stays a flat token/download mode on all templates |
| 3 | Real ZIP / SVG-PNG packaging for Download Links | **Defer** — keep label+URL; default labels must not imply ZIP |
| 4 | WCAG contrast checker | **Stay deferred** |
| 5 | Color export | **Partial now** — copy-hex + CSS variables; ASE/PDF later |
| 6 | Vision field | **Cut** — Mission + Claim/Pitch cover positioning |
| 7 | Copy prompt scope | **Catalog-wide** — every sub-module with `promptTemplate`; AI System Prompt copies raw compiled master |
| 8 | Materials tab / Essential tiers / Finalized / client logo toggle | **Cut** |
| 9 | Iconography & AI Image Prompts (Imagery) | **Cut / defer v2** |
| 10 | UI Interactive States gallery | **Cut** — Buttons, Forms, Badges/Containers, Empty/Error only |
| 11 | Module visibility | **Module-level only** via `theme.hiddenModules` |
| 12 | Team / POC | **`ci_guidelines.theme`** fields |
| 13 | Template settings | Multipage full; Foundry landing hero + density; Greenpoint cover/nav only |
| 14 | Re-sync from Figma | **Wire** to real sync API + `theme.figmaSync` timestamp (no decorative button) |
| 15 | Legacy migration | Auto on admin open + schemaVersion 2; batch for published; keep legacy render path temporarily |

`theme.schemaVersion = 2` marks overhaul-migrated guidelines.
