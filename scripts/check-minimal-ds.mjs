#!/usr/bin/env node
/**
 * AL5 guard: every exporter must survive a *minimal but valid* design system.
 *
 * Why this exists: the AL5 diagnostics sweep started by using the tool wrongly,
 * and the worst failure turned out to be a case where the user does nothing
 * wrong at all. A design system that authors only a brand color, a surface, and
 * a text color is legal — nothing requires a radius scale or a border color —
 * and `transtyle build bootstrap` answered it with a bare
 * `TypeError: Cannot read properties of undefined (reading 'value')`: no code,
 * no slot name, no hint, no output. Two more exporters silently wrote the
 * literal string `undefined` into their stylesheets.
 *
 * None of the existing checks could see it. `check:fixtures`, `check:coverage-bar`
 * and `check:bootstrap-surface` all run against the four examples, and every one
 * of those authors a complete token set — exactly the shape that hides this
 * class of bug.
 *
 * Asserts, for every registered exporter, across every mode SHAPE below:
 *   1. it compiles without throwing;
 *   2. no emitted file contains a leaked `undefined` / `null` / `NaN` value;
 *   3. every emitted file has content;
 *   4. **coverage honesty**: no row classed `native`/`derived` names an IR slot
 *      that doesn't resolve.
 *
 * (4) came from the AL5 follow-up sweep, and found what (1)–(3) structurally
 * cannot: exporters that correctly *skip* an absent value — so nothing leaks and
 * nothing crashes — while still reporting it as covered. Storybook claimed five
 * ThemeVars its theme did not contain, because its class came from
 * `provenance.kind` and "no entry" fell through to `native`, the strongest claim
 * available. Silence plus a coverage claim is worse than either alone: the
 * report is the artifact users audit.
 *
 * The **mode shapes** are the second axis of sparseness (the token set is the
 * first). The original harness only ever tried `color-scheme: [light, dark]`;
 * real configs also come light-only, dark-only, density-only (no color-scheme at
 * all), three-valued, and multi-dimension. Sweeping the invariants above across
 * all of them is how we know an exporter doesn't assume a particular mode layout
 * — a light-only DS must not crash for want of a `dark` map, a density-only DS
 * has no `modes.light` at all, and so on.
 *
 * **Authored extra scheme values.** For every shape whose `color-scheme`
 * carries a value we have fixture data for (`dark`, and `three-scheme`'s third
 * value `dim`), the harness authors a distinct surface + text via a
 * mode-scoped layer — see `EXTRA_SCHEME_TOKENS`. The three-token floor is
 * otherwise all-light: with `autoDark` off and no non-default values authored,
 * those combos' *anchor* slots (surface, text) fall back to the light value, so
 * everything derived from that canvas (text-muted/subtle/inverse, on-colors,
 * contrast pairs) is computed against a light anchor even in a nominally
 * non-light mode. The `isDark` role grid runs regardless — but derivation
 * against a genuinely different *authored* canvas never did. `dim` specifically
 * tests something `dark` can't: whether the ENGINE (normalize/derive) keeps a
 * THIRD color-scheme value's data distinct through per-dimension resolution, or
 * silently collapses it into light or dark somewhere in the pipeline — no
 * exporter binds a third value structurally (every binding is `:root`/`.dark`,
 * never data-driven off the value list), so this assertion lives at the IR
 * boundary, not in emitted output. A fifth invariant checks every authored
 * value's surface distinctly reached its own combo map, pairwise distinct from
 * light and from every other authored value — so a future glob/layer
 * regression, or a resolution bug that collapses two non-default values onto
 * one slot, fails loudly rather than quietly turning the sweep into a no-op.
 * Shapes with no fixture-backed non-default value (light-only, dark-only where
 * dark IS the default, density-only) get no extra layer — a mode-scoped file
 * there would be a TST1109 or dead weight, not a test.
 *
 * Plus one negative-space case: a config that declares `color-scheme` after
 * another dimension must raise TST1112 *as an error*, because the polarity axis
 * has to be first or dark mode silently never ships — and shipping a dark block
 * full of light values is exactly the AL5 failure class, too wrong to be a mere
 * warning the default `failOn: error` waves through.
 *
 * **`autoDark`** is a third, orthogonal axis: every shape/exporter combination
 * runs once with `derivation.autoDark: false` (today's default) and once with
 * `true`. `autoDark` does not change any compiled VALUE (see
 * docs/worklog/2026-07-27-tst1204-silent-dark-fallback.md — computing a
 * genuinely different dark color is a still-open, deliberately deferred
 * research question, not implemented) — it only reclassifies a role `.solid`'s
 * cross-mode carry-over `derived` instead of `authored` in provenance. Checked
 * both at the IR boundary (every authored extra scheme value, not just
 * "dark" — `three-scheme`'s `dim` must be tagged too, proving the tagging
 * isn't keyed to the literal string "dark") and in real exporter OUTPUT
 * (css-variables' emitted `/* derived · ... *\/` comment on the dark block's
 * `--color-primary-solid` line) — an internal-state-only check could not have
 * caught a regression that flips the IR flag but never wires it into what an
 * exporter actually renders.
 *
 * Run: node scripts/check-minimal-ds.mjs   (npm run check:minimal-ds)
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile } from '@transtyle/core';

const EXPORTERS = {
  shadcn: '@transtyle/exporter-shadcn',
  echarts: '@transtyle/exporter-echarts',
  daisyui: '@transtyle/exporter-daisyui',
  bootstrap: '@transtyle/exporter-bootstrap',
  storybook: '@transtyle/exporter-storybook',
  'css-variables': '@transtyle/exporter-css-variables',
  radix: '@transtyle/exporter-radix',
  primeng: '@transtyle/exporter-primeng',
};

/**
 * The floor, not a realistic design system: the brand color the engine cannot
 * invent, plus the two anchors every derivation reads. Deliberately no radius
 * scale, no spacing, no fonts, no dark-mode values — each omission is a real
 * authoring choice a first-time user makes, and each one used to break something.
 */
const MINIMAL_TOKENS = {
  semantic: {
    color: {
      primary: { solid: { $type: 'color', $value: '#3b5bdb' } },
      surface: { $type: 'color', $value: '#ffffff' },
      text: { base: { $type: 'color', $value: '#212529' } },
    },
  },
};

/**
 * Legal mode layouts a real config comes in. Each is the SAME 3-token design
 * system under a different `modes` block. `light-dark` is the original harness;
 * the rest are the shapes it never tried.
 */
const MODE_SHAPES = {
  'light-dark': { 'color-scheme': { values: ['light', 'dark'], default: 'light' } },
  'light-only': { 'color-scheme': { values: ['light'], default: 'light' } },
  'dark-only': { 'color-scheme': { values: ['dark'], default: 'dark' } },
  'density-only': { density: { values: ['comfortable', 'compact'], default: 'comfortable' } },
  'three-scheme': { 'color-scheme': { values: ['light', 'dark', 'dim'], default: 'light' } },
  'two-dimension': {
    'color-scheme': { values: ['light', 'dark'], default: 'light' },
    density: { values: ['comfortable', 'compact'], default: 'comfortable' },
  },
};

/**
 * A genuinely different surface + text per NON-DEFAULT `color-scheme` value,
 * each authored via its own mode-scoped layer. Lives at the temp-dir ROOT,
 * deliberately outside the `tokens/*.tokens.json` base glob (which matches
 * only direct children of `tokens/`), so a layer is never picked up as a base
 * layer — only when a shape's config references it as a
 * `{ color-scheme: <value> }` mode layer.
 *
 * `dark` covers the two-value shapes. `dim` covers `three-scheme`'s THIRD
 * value — the one that is neither the default nor the polarity value `isDark`
 * keys on (derive.js: `isDark = (... === 'dark')`). No exporter binds a
 * color-scheme value beyond light/dark structurally (every binding is
 * `:root`/`.dark`, never data-driven off the configured value list) — that is
 * a known, current limitation, not a bug this sweep is trying to catch. What
 * IS worth catching: whether the ENGINE (normalize/derive) keeps a third
 * value's authored data distinct through the pipeline, or silently collapses
 * it into light or dark somewhere in per-dimension resolution. Each value's
 * color is chosen to be distinguishable from both light (#ffffff/#212529) and
 * every other authored value.
 */
const EXTRA_SCHEME_TOKENS = {
  dark: {
    semantic: { color: {
      surface: { $type: 'color', $value: '#101114' },
      text: { base: { $type: 'color', $value: '#f8f9fa' } },
    } },
  },
  dim: {
    semantic: { color: {
      surface: { $type: 'color', $value: '#2b2417' },
      text: { base: { $type: 'color', $value: '#f5ecd9' } },
    } },
  },
};

const dir = mkdtempSync(join(tmpdir(), 'transtyle-minimal-'));
mkdirSync(join(dir, 'tokens'));
writeFileSync(join(dir, 'tokens', 'base.tokens.json'), JSON.stringify(MINIMAL_TOKENS, null, 2));
for (const [value, tree] of Object.entries(EXTRA_SCHEME_TOKENS)) {
  writeFileSync(join(dir, `${value}.tokens.json`), JSON.stringify(tree, null, 2));
}

/** Non-default `color-scheme` values this shape has, that we have authored
 *  token data for — i.e. genuinely different from the default and worth a
 *  mode-scoped layer, rather than a value the harness has no fixture for. */
const extraSchemeValues = (modes) => {
  const cs = modes['color-scheme'];
  if (!cs) return [];
  return cs.values.filter((v) => v !== cs.default && v in EXTRA_SCHEME_TOKENS);
};

const writeConfig = (modes, autoDark = false) =>
  writeFileSync(
    join(dir, 'transtyle.config.json'),
    JSON.stringify(
      {
        name: 'minimal',
        tokens: [
          'tokens/*.tokens.json',
          ...extraSchemeValues(modes).map((v) => ({ files: `${v}.tokens.json`, mode: { 'color-scheme': v } })),
        ],
        modes,
        derivation: { rules: 'standard@1', autoDark },
        targets: Object.fromEntries(Object.keys(EXPORTERS).map((n) => [n, { output: `dist/${n}` }])),
      },
      null,
      2,
    ),
  );

const errors = [];
// `undefined` etc. as a whole word on the value side of a declaration. Matching
// the value side only keeps legitimate prose (a comment mentioning "undefined")
// out of it — the emitted files carry a lot of explanatory comments.
const LEAK = /(:|=>?)\s*(undefined|null|NaN)\b/;

let files = 0;
for (const [shape, modes] of Object.entries(MODE_SHAPES)) {
  const extraValues = extraSchemeValues(modes);
  for (const autoDark of [false, true]) {
    writeConfig(modes, autoDark);
    for (const [name, pkg] of Object.entries(EXPORTERS)) {
      const loadExporter = async () => (await import(pkg)).default;
      const at = `${name} (${shape}, autoDark=${autoDark})`;
      let result;
      try {
        result = await compile({ cwd: dir, targets: [name], emit: false, loadExporter });
      } catch (e) {
        errors.push(`${at}: threw instead of reporting — ${e.message}`);
        continue;
      }
      const hardErrors = result.diagnostics.errors;
      if (hardErrors.length) {
        errors.push(`${at}: a minimal design system produced errors — ${hardErrors.map((d) => `${d.code} ${d.message}`).join('; ')}`);
        continue;
      }
      const emitted = result.results.find((r) => r.target === name);
      if (!emitted) {
        errors.push(`${at}: produced no result`);
        continue;
      }
      for (const f of emitted.emitted ?? []) {
        files++;
        const contents = f.contents ?? '';
        if (!contents.trim()) errors.push(`${at}/${f.path}: emitted an empty file`);
        contents.split('\n').forEach((line, i) => {
          if (LEAK.test(line)) errors.push(`${at}/${f.path}:${i + 1} leaked a JS value into output: ${line.trim()}`);
        });

        // 6b. autoDark's provenance reclassification must reach real exporter
        //     OUTPUT, not just internal IR state — css-variables renders a
        //     non-"authored" cell with a `/* <kind> · ... */` comment, so the
        //     dark block's primary-solid line must say "derived" once autoDark
        //     is on. An IR-only check (7 below) could not catch a regression
        //     that flips the flag but never wires it into what gets rendered.
        if (name === 'css-variables' && autoDark && extraValues.includes('dark') && f.path.endsWith('.css')) {
          const darkBlock = contents.match(/\[data-color-scheme="dark"\]\s*\{([\s\S]*?)\}/)?.[1] ?? '';
          const line = darkBlock.split('\n').find((l) => l.includes('--color-primary-solid:'));
          if (!line?.includes('derived')) {
            errors.push(`${at}/${f.path}: autoDark did not mark the dark-mode primary-solid carry-over "derived" in emitted output (line: ${line ?? '<not found>'})`);
          }
        }
      }

      // 4. Coverage honesty. Only rows whose `slot` is a single, complete IR path
      //    are checkable — many rows legitimately carry a summary label instead
      //    (`semantic.{font.sans, type.size.md}`, `semantic.color.primary.1–8`, or a
      //    target's own namespace such as PrimeNG's `{primary.color}` runtime
      //    reference). Those are skipped rather than guessed at.
      const map = result.normalized.modes[result.normalized.defaultMode];
      for (const c of emitted.coverage ?? []) {
        if (!['native', 'derived'].includes(c.class)) continue;
        const slot = String(c.slot ?? '');
        if (!/^(semantic|component|option)\.[\w.-]+$/.test(slot)) continue;
        if (map.get(slot)?.value === undefined) {
          errors.push(`${at}: coverage row "${c.variable}" claims class ${c.class} from ${slot}, which does not resolve — absence is not coverage`);
        }
      }

      // 5. Every authored extra scheme value's anchor actually reached its OWN
      //    combo map, distinct from light AND from every other authored value.
      //    This guards the sweep's own premise: if a regression swallowed a mode
      //    layer (a value == light), or per-dimension resolution collapsed two
      //    non-default values onto the same slot (`dim` == `dark`), the affected
      //    derivation path would silently stop being exercised while every
      //    invariant above still passed — a silent no-op test. `three-scheme`'s
      //    `dim` is the one case testing the ENGINE keeps a THIRD color-scheme
      //    value distinct through normalize/derive — not that any exporter binds
      //    it (none structurally can; see EXTRA_SCHEME_TOKENS doc comment).
      //    Checked at the IR boundary (not by grepping output) so it is robust to
      //    each exporter's color rendering.
      if (extraValues.length) {
        const seen = new Map([['light', map.get('semantic.color.surface')?.value]]);
        for (const value of extraValues) {
          const surface = result.normalized.modes[value]?.get('semantic.color.surface')?.value;
          if (surface === undefined) {
            errors.push(`${at}: authored "${value}" surface did not reach modes.${value}`);
            continue;
          }
          for (const [otherName, otherSurface] of seen) {
            if (JSON.stringify(surface) === JSON.stringify(otherSurface)) {
              errors.push(`${at}: authored "${value}" surface is indistinguishable from "${otherName}" — the sweep degenerated (values collapsed onto the same canvas)`);
            }
          }
          seen.set(value, surface);
        }

        // 7. autoDark's provenance effect, at the IR boundary, for EVERY authored
        //    extra scheme value — not just "dark". `three-scheme`'s `dim` must be
        //    reclassified too, proving the tagging isn't keyed to the literal
        //    string "dark". The compiled VALUE never changes (autoDark doesn't
        //    compute a distinct color — see the worklog); only provenance.kind
        //    does, `authored` -> `derived`, only while `autoDark` is on.
        for (const value of extraValues) {
          const entry = result.normalized.modes[value]?.get('semantic.color.primary.solid');
          const wantKind = autoDark ? 'derived' : 'authored';
          if (entry?.provenance?.kind !== wantKind) {
            errors.push(`${at}: primary.solid carried into color-scheme=${value} has provenance.kind "${entry?.provenance?.kind}", expected "${wantKind}"`);
          }
          if (autoDark && !entry?.provenance?.rule?.startsWith('auto-dark-carry')) {
            errors.push(`${at}: primary.solid carried into color-scheme=${value} is missing its auto-dark-carry rule trace`);
          }
        }
      }
    }
  }
}

// Negative-space case: the polarity axis MUST be the first dimension, or dark
// mode silently never reaches an exporter (the values land in their combos, but
// no `modes.dark` alias is created for a non-primary dimension). This must be an
// ERROR — a warning would let the guaranteed-wrong output through the default
// `failOn: error`. `color-scheme` here carries two values, so there is a real
// non-default dark to drop (the single-value case is intentionally not flagged).
writeConfig({
  density: { values: ['comfortable', 'compact'], default: 'comfortable' },
  'color-scheme': { values: ['light', 'dark'], default: 'light' },
});
const loadNoop = async () => ({ name: 'noop', optionsSchema: { type: 'object' }, emit: () => ({ files: [], coverage: [] }) });
const df = await compile({ cwd: dir, targets: [], emit: false, loadExporter: loadNoop });
if (!df.diagnostics.errors.some((d) => d.code === 'TST1112')) {
  errors.push('color-scheme declared after another dimension must raise TST1112 as an ERROR (dark mode would silently never ship, so the build must stop), but it did not');
}

rmSync(dir, { recursive: true, force: true });

// Binding-layer case: TST1204 must judge the RESOLVED value, not the slot's own
// text. A design system adopted the way the docs recommend binds catalog slots
// to its own vocabulary with one-line aliases, and the per-mode values live on
// the alias TARGET — the alias string itself reads identically in every mode.
// Judging it there called every such role a silent dark-mode carry-over: four
// of Carbon's seven notes, and Cathode's `primary`, were wrong that way while
// the emitted dark themes genuinely differed. One bound role with a dark value
// on its target, one without: exactly one note, on the second.
const bindDir = mkdtempSync(join(tmpdir(), 'transtyle-binding-'));
mkdirSync(join(bindDir, 'tokens'));
writeFileSync(
  join(bindDir, 'tokens', 'base.tokens.json'),
  JSON.stringify(
    {
      semantic: {
        color: {
          house: {
            // Its own vocabulary — the design system's names, not ours.
            brand: {
              $type: 'color',
              $value: '#1d70b8',
              $extensions: { 'transtyle.modes': { 'color-scheme': { dark: '#66b2ff' } } },
            },
            alert: { $type: 'color', $value: '#ca3535' },
          },
          surface: { $type: 'color', $value: '#ffffff' },
          text: { base: { $type: 'color', $value: '#212529' } },
          // The binding layer: catalog meaning ← house name.
          primary: { solid: { $value: '{semantic.color.house.brand}' } },
          danger: { solid: { $value: '{semantic.color.house.alert}' } },
        },
      },
    },
    null,
    2,
  ),
);
writeFileSync(
  join(bindDir, 'transtyle.config.json'),
  JSON.stringify(
    {
      name: 'binding',
      tokens: ['tokens/*.tokens.json'],
      modes: { 'color-scheme': { values: ['light', 'dark'], default: 'light' } },
      derivation: { rules: 'standard@1' },
      targets: { 'css-variables': { output: 'dist/css-variables' } },
    },
    null,
    2,
  ),
);
const bound = await compile({
  cwd: bindDir,
  emit: false,
  loadExporter: async () => (await import('@transtyle/exporter-css-variables')).default,
});
const carryOver = bound.diagnostics.items.filter((d) => d.code === 'TST1204').map((d) => d.message);
const mentions = (slot) => carryOver.some((m) => m.includes(slot));
if (mentions('semantic.color.primary.solid')) {
  errors.push('binding layer: TST1204 fired on a role whose alias target HAS a dark value — the resolved colors differ, so nothing carried over');
}
if (!mentions('semantic.color.danger.solid')) {
  errors.push('binding layer: TST1204 did not fire on a bound role whose alias target has no dark value — that carry-over is real and must be surfaced');
}
const boundPrimary = (mode) => JSON.stringify(bound.normalized.modes[mode].get('semantic.color.primary.solid')?.value);
if (boundPrimary('light') === boundPrimary('dark')) {
  errors.push('binding layer: the fixture degenerated — primary resolves identically in both modes, so the case proves nothing');
}
rmSync(bindDir, { recursive: true, force: true });

if (errors.length) {
  console.error(`✘ minimal-ds check: ${errors.length} problem(s)`);
  for (const e of errors) console.error('  - ' + e);
  console.error('\n  A design system may author only a brand color, a surface, and a text color,');
  console.error('  in any legal mode layout. Exporters must read absent slots and absent modes');
  console.error('  defensively — never crash, never leak a JS value, never over-claim coverage.');
  process.exit(1);
}
console.log(`✔ minimal-ds: all ${Object.keys(EXPORTERS).length} exporters compile a 3-token design system cleanly across ${Object.keys(MODE_SHAPES).length} mode shapes × autoDark on/off (${files} files, no leaks; authored dark/dim distinctly reach the IR where declared; autoDark reclassifies carry-over provenance without touching values, in the IR and in emitted output); polarity-axis-not-first is a build error`);
