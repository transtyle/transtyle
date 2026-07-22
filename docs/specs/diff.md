# `transtyle diff` — semantic diff + per-target impact

**Status: implemented** (ROADMAP P6). `transtyle diff [ref]` answers the question a design-system PR reviewer actually has: _what did this change do to the compiled themes?_ — not "which token-file lines moved," but which **resolved semantic values** changed and how that propagates to each target's output.

## What it diffs, and why that's the right unit

The unit of change is a **resolved semantic slot value in a mode**, computed by running the full pipeline (`compile({ emit: false })`) on both sides and comparing the resolved graphs — not the token files.

This matters because the source and the meaning are different things:

- **Renaming an option token, or restructuring layers, with identical resolved values → reported as no change.** The compiled themes are byte-identical, so there is nothing for a consumer to review. Diffing source lines would cry wolf; diffing the resolved graph correctly stays silent.
- **Changing one authored value that cascades through derivation → every affected slot is reported.** Editing `primary.solid` moves `accent.*` (which aliases it), every derived hover/tint/on-color, and both modes — and the diff shows the whole blast radius, because that is what actually ships.

## Two layers of output

**1. Semantic diff** — per mode, the slots that changed:

- `+ <slot>` added (exists now, absent at the ref)
- `- <slot>` removed
- `~ <slot>  <before> → <after>` value changed, with hex alongside OKLCH for colors
- a `(<kind> → <kind>)` note when only the **provenance** changed (e.g. a value that used to be `derived` is now `authored` because someone pinned it — same value, meaningful governance change)

**2. Contrast regressions** — the accessibility cost of the change. `check` tells you contrast is bad _now_; diff tells you **this change made it bad**, which is the reviewer's actual question and the thing a green CI baseline can silently lose:

```
⚠ Contrast regressions:
  ✖ text.base on elevation.0.surface (light): 18.1:1 → 2.2:1 — now FAILS 4.5:1

  1 pair passed before this change and fails after it.
```

Two severities: `regressed` (passed the configured standard before, fails now) and `worsened` (already failing, and the ratio dropped further). Pairs that improve, or that fail identically on both sides, are not reported — so an unrelated change (a brand colour that touches no text/surface pair) reports nothing. It reuses `runChecks`' pair list and threshold via shared exports, so `diff` and `check` can never disagree about what "passing" means, and it honors `check.contrast.standard` (`wcag21-aa` → 4.5, `wcag21-aaa` → 7).

**3. Per-target impact** — for each configured target, the diff re-emits both sides in memory and diffs the emitted artifacts, reporting how many output lines changed and a sample of the changed variables:

```
Per-target impact:
  bootstrap: 63 lines changed
      _variables.transtyle.scss: $primary: #ca3535;
      ...
  shadcn: 34 lines changed
  echarts: 32 lines changed
```

Generated `usage.md` docs are excluded (they're documentation, not the theme). Because emit is deterministic per exporter version, this diff is stable — a change shows up only when a real output value moves.

## Resolving "before": the git ref

`ref` defaults to `HEAD`; any commit-ish works (`main`, a tag, a SHA, `HEAD~3`). The project at that ref is materialized with `git archive <ref> <project-prefix> | tar -x` into a temp dir and compiled there; "after" is the working tree (including uncommitted edits). So `transtyle diff` with no argument answers "what have I changed since my last commit?", and `transtyle diff main` answers "what does this branch do to the themes?".

The project subtree is located via `git rev-parse --show-prefix` (not `path.relative`), so it is correct regardless of symlinked temp paths.

## CLI contract

|               |                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| **Exit 0**    | no semantic changes (compiled themes identical)                                                            |
| **Exit 1**    | changes found — composes in CI like `git diff --exit-code`                                                 |
| **Exit 2**    | not a git repo, unknown ref, or the project can't be resolved at the ref                                   |
| `--json`      | print a machine-readable report to stdout (for PR-comment tooling); human summary otherwise goes to stderr |
| `--cwd <dir>` | project directory, as for every command                                                                    |

If the project didn't exist at the ref, diff says so and exits 0 (nothing to diff against).

### `--json` shape

```jsonc
{
  "ref": "HEAD",
  "hasChanges": true,
  "semantic": [
    {
      "mode": "light",
      "added": [],
      "removed": [],
      "changed": [
        {
          "slot": "semantic.color.primary.solid",
          "before": "oklch(0.55 0.18 255)  [#026fd7]",
          "after": "oklch(0.55 0.19 25)  [#ca3535]",
          "provenance": "authored",
        },
      ],
    },
  ],
  "impact": [{ "target": "shadcn", "status": "changed", "changedLines": 34 }],
}
```

## Scope (skeleton)

Implemented: the resolved-graph semantic diff, contrast-regression flagging, per-target output impact, git-ref resolution, `--json`, and the exit-code contract, all exercised by `scripts/check-cli.mjs`.

Deliberately not yet done: a rich token-level line diff inside each target (the current impact is a count plus a sample), and contrast checking beyond the four `text.{base,muted}` × `elevation.{0,1}.surface` pairs `runChecks` defines — extending that list benefits `check` and `diff` together, by construction. Neither changes this command's contract.

**A note on the exit code:** a contrast regression does not get its own exit code. Any regression implies a semantic change, which already exits `1`; CI that needs to fail _specifically_ on accessibility reads `contrastRegressions` from `--json`. Keeping one meaning for exit `1` is worth more than a second signal.
