---
'@transtyle/exporter-primeng': patch
---

Restore Aura's dialog and popover padding shape in the PrimeNG preset.

The exporter wrote the modal padding straight onto `dialog.header`, `dialog.content` and `dialog.footer` (and the popover padding onto `popover.content`), which replaced Aura's own definition. Aura reads `overlay.modal.padding` for the header and a top-less `0 p p p` shape for the content and footer, so the body sat under the header with two spacing steps instead of one, and again above the footer. The padding now goes where Aura reads it, `semantic.overlay.modal.padding` and `semantic.overlay.popover.padding`, and the per-part overrides are gone, so the dialog keeps Aura's layout at the token-driven size.
