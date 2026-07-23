# Demo parity — a prose invariant, mechanized

The tooltip added to Acme's demos to type-check `component.tooltip.max-width` was only added to **Acme's** demos. That broke something the demo harness quietly depends on.

## The invariant

[`demo-app.md`](../specs/demo-app.md) has said it since the projects were built:

> Within a target, the project is file-identical across examples except `src/ds.config.{js,ts}` and `package.json`. If an example needs any other difference, that's a finding, not a patch.

It is the whole reason the demos are worth having. Put Acme's Bootstrap demo next to Carbon's and **every visible difference is attributable to the design system**, because the markup, the components and the interactions are byte-identical — only `dist/` differs. A section added to one and not the others destroys that property silently: the pages still work, they just stop being a comparison.

Nothing was checking it. Three files had already diverged.

## Measured first

Before propagating anything, I measured how much drift actually existed, per target, across all four examples. The answer was reassuring: **the demos were already uniform**. Section structure matched exactly (`2 · Buttons`, `3 · Form`, `4 · Card`, `5 · Table`, `6 · Modal` in every example, on both Bootstrap and PrimeNG), and every shared source file was byte-identical. The only drift in the repo was the three files I had just touched.

That measurement also produced the exception list, which is smaller than expected:

| File                                  | Per-example? | Why                                                                                                                                                                                          |
| ------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/ds.config.{js,ts}`               | yes          | the DS's own identity — label, font stylesheet, default mode. The one thing a demo is _supposed_ to know.                                                                                    |
| `demo/radix/src/theme-override.css`   | yes          | Radix's `<Theme accentColor>` accepts only Radix's own preset names, so each example aliases a different one onto our primary ramp (violet / green / blue / indigo). The target forces this. |
| everything else (45 files, 8 targets) | **no**       | must be identical                                                                                                                                                                            |

The Radix file was an undocumented exception — the spec's prose said "any other difference is a finding", and this one was never recorded. Now it is, with its reason.

## Restored, then guarded

The tooltip is now in all four examples' Bootstrap and PrimeNG demos, with the comment rewritten so the same text is true everywhere:

> Acme authors the slot, so its tooltips wrap at 18rem here AND in the other demo; the other examples don't, so they show the target's own 200px. Same markup everywhere — only `dist/` differs.

**`check:demo-parity`** (new, in `check:all`, now 63 checks) walks every demo source file and asserts byte-identity across examples, in both directions — a divergent edit _and_ a file that exists in one example's demo but not another's. Both failure modes verified by introducing them:

```
✘ demo parity: 2 problem(s)
  - carbon/demo/bootstrap/index.html differs from acme's copy — demo sources
    must be identical across examples (only dist/ may differ)
  - govuk/demo/primeng/src/app/extra.ts exists but acme's demo has no such
    file — add it there too, or remove it
```

## What the four demos now show

The tooltip is a genuinely good parity subject, because the same markup produces two _different, both-correct_ results:

| Example                   | Authors the slot? | Bootstrap                 | PrimeNG              |
| ------------------------- | ----------------- | ------------------------- | -------------------- |
| Acme                      | yes, `18rem`      | `max-width: 288px`        | `max-width: 288px`   |
| Cathode / GOV.UK / Carbon | no                | `200px` (Bootstrap's own) | `200px` (Aura's own) |

Measured in the running demos, not asserted. That is the promoted slot's full contract visible side by side: authored, it overrides both targets identically; unauthored, each target keeps its own default and nothing is invented.

All 8 demo projects build (`vite build` ×4, `ng build` ×4, no errors, no console errors). `check:all` green at 63.
