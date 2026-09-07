# CI Builder Overhaul — Known Gaps QA matrix

Cross-check against audit "Known Gaps & Bugs". Disposition from DECISIONS.md.

| # | Issue | Disposition | Verification |
|---|-------|-------------|--------------|
| 1 | Dead Copy prompt on Greenpoint | Fixed — `CopyPromptButton` on all templates | Open Greenpoint + AI System Prompt; click Copy prompt |
| 2 | Primary Typeface inconsistent fallback | Fixed — explicit “not set” only when no `heading-primary` role | Type scale without role tag shows same message in all templates |
| 3 | Clear Space missing Foundry/Multipage | Fixed — module pages render all visible sections | Add clear_space content; check Foundry + Multipage module pages |
| 4 | Empty/Error missing 2 templates | Fixed — `ui_empty_error` in catalog; all templates render module sections | Populate Empty & Error; view all 3 templates |
| 5 | UI Elements not built | Built — `ui_buttons`, `ui_form_controls`, badges/containers, empty/error | Edit UI Elements in AdminEditor; persist + client render |
| 6 | Layout Grid no edit | Fixed — editable number fields in `layout_grid` renderer | Change columns/gutters; reload |
| 7 | Brand Photography not on Imagery page | Fixed — templates render Imagery sections including brand_photography | Upload photos; open Imagery module on each template |
| 8 | `+` duplicates last row | Fixed — `KeyedListEditor` blank-add contract | Add on empty photography/touchpoints lists |
| 9 | Touchpoints no image upload | Partial — deck/email use LocalImage slots; social still image_dual path | Upload on email/deck rows |
| 10 | Download links fake ZIP | Deferred packaging; honest `link_list` labels | Default labels do not say ZIP |
| 11 | Color no copy/export | Partial — copy-hex/RGB/CMYK in ColorSwatchPanel | Edit swatch; copy values |
| 12 | Re-sync non-functional | Wire via Import wizard / figma sync API + `theme.figmaSync` | Prefer Import panel; no decorative button in new UI |
| 13 | No persistence | Already solved in production | Debounced AdminEditor saves |

## Template parity smoke

- [ ] Same guideline JSON → Greenpoint / Foundry / Multipage without data duplication
- [ ] Theme `clientTemplate` switch updates client preview
- [ ] Module visibility (`hiddenModules`) hides landing tiles + nav
- [ ] Logo MAIN light+dark always both shown (no viewer toggle)
- [ ] Legacy open auto-migrates to `logo_marks` + `schemaVersion: 2`
