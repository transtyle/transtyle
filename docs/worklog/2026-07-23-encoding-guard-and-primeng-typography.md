# Encoding guard + PrimeNG typography (two AL3 follow-ups)

## 1. `check:encoding` — the guard the NUL-byte defect earned

[The overlay pass](2026-07-23-overlay-scrim-pass.md) found two NUL bytes inside a template literal in `packages/exporter-bootstrap/src/components.js`. They survived three commits because JavaScript accepts NUL in a string: every test passed, every emitted artifact was correct. The damage was to **reviewability** — git recorded the file as `Bin 0 -> 10525 bytes`, so AL1.4's principal new file was committed with no reviewable diff, and `grep` refused to show lines. No check in the repo was looking at that class of problem.

`scripts/check-encoding.mjs` (in `check:all`, now 61 checks) walks every git-tracked file that isn't a known binary type — 533 of them — and rejects NUL bytes, invalid UTF-8, and UTF-8 BOMs (which break shebangs and strict JSON parsers).

**Verified against the real defect**, not a synthetic one: a scripted negative test reintroduced the exact byte at the exact position and confirmed the guard fails with a useful message —

```
packages/exporter-bootstrap/src/components.js:201 contains a NUL byte (offset 7647)
  near: …lue, slot) => {⏎    if (seen.has(`${sel}␀${cssVar}`)) return…
```

— then restored the file byte-for-byte. The message names the file, the line, the offset, renders the offending byte visibly (`␀`), and says where NULs usually come from, because the failure is otherwise invisible by construction.

## 2. Driving PrimeNG's semantic typography

The gap [AL3](2026-07-23-al3.md) surfaced and left open. PrimeNG's `semantic.typography.{fontFamily,fontSize,fontWeight,lineHeight}` sat on Aura's defaults (`inherit`, `0.875rem`, `normal`, `1.5`), and it cascaded: 60 component slots reference `{typography.font.size}` or `{typography.font.weight}`, so they inherited Aura's type rather than the compiled design system's.

Mapped by meaning — PrimeNG's semantic type base ← the IR's base body rungs (`font.sans`, `type.size.md`, `type.weight.regular`, `type.leading.normal`). `fontFamily` is emitted only when a font stack actually resolves; otherwise Aura's `inherit` is left alone rather than inventing one.

**Measured effect** (the point of having a bar): `75 driven · 1492 inherited · 1192 Aura default` → **`79 driven · 1552 inherited · 1128 Aura default`** — 64 slots converted, matching the prediction exactly.

**Verified in the demos**, since font size and family are visible changes: Acme's PrimeNG components render at 16px Inter (the DS base) instead of Aura's 0.875rem, and — the big-DS proof — **Carbon's render in IBM Plex Sans**, Carbon's real typeface, in a component library it was never designed for. No console errors in either. `check:all` green at 61.
