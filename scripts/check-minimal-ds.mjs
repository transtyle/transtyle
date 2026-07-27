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
 * **Authored dark.** For every shape whose `color-scheme` carries a *non-default*
 * dark value, the harness authors a distinct dark surface + text via a
 * mode-scoped layer. The three-token floor is otherwise all-light: with
 * `autoDark` off and no dark values authored, the dark map's *anchor* slots
 * (surface, text) fall back to their light values, so the dark block an exporter
 * emits carries a light canvas, and every value derived from that canvas
 * (text-muted/subtle/inverse, the on-colors, contrast pairs) is computed against
 * a light anchor even in dark mode. The `isDark` role grid runs regardless — but
 * derivation against a genuinely dark *authored* canvas never did. Authoring a
 * real dark surface + text exercises exactly that path, and any exporter that
 * only emits a dark override when it differs from light (css-variables emits the
 * dark block unconditionally; others may gate on a diff) gets its diff branch
 * covered too. A fifth assertion checks the dark surface distinctly reached the
 * dark map — so a future glob/layer regression that silently swallows the dark
 * layer (making dark == light again) fails loudly rather than quietly turning
 * the dark sweep back into a no-op. Shapes with no non-default dark (light-only,
 * dark-only where dark IS the default, density-only) get no dark layer — a
 * dark-scoped file there is a TST1109 or dead weight, not a test.
 *
 * Plus one negative-space case: a config that declares `color-scheme` after
 * another dimension must raise TST1112 *as an error*, because the polarity axis
 * has to be first or dark mode silently never ships — and shipping a dark block
 * full of light values is exactly the AL5 failure class, too wrong to be a mere
 * warning the default `failOn: error` waves through.
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
 * A genuinely different dark surface + text, authored via a mode-scoped layer.
 * Lives at the temp-dir ROOT, deliberately outside the `tokens/*.tokens.json`
 * base glob (which matches only direct children of `tokens/`), so it is never
 * picked up as a base layer — only when a shape's config references it as a
 * `{ color-scheme: dark }` mode layer.
 */
const DARK_TOKENS = {
  semantic: {
    color: {
      surface: { $type: 'color', $value: '#101114' },
      text: { base: { $type: 'color', $value: '#f8f9fa' } },
    },
  },
};

const dir = mkdtempSync(join(tmpdir(), 'transtyle-minimal-'));
mkdirSync(join(dir, 'tokens'));
writeFileSync(join(dir, 'tokens', 'base.tokens.json'), JSON.stringify(MINIMAL_TOKENS, null, 2));
writeFileSync(join(dir, 'dark.tokens.json'), JSON.stringify(DARK_TOKENS, null, 2));

const writeConfig = (modes, withDark = false) =>
  writeFileSync(
    join(dir, 'transtyle.config.json'),
    JSON.stringify(
      {
        name: 'minimal',
        tokens: [
          'tokens/*.tokens.json',
          ...(withDark ? [{ files: 'dark.tokens.json', mode: { 'color-scheme': 'dark' } }] : []),
        ],
        modes,
        derivation: { rules: 'standard@1' },
        targets: Object.fromEntries(Object.keys(EXPORTERS).map((n) => [n, { output: `dist/${n}` }])),
      },
      null,
      2,
    ),
  );

/** True when the shape has a `dark` color-scheme value that isn't the default —
 *  i.e. there is a genuine non-default dark for the mode layer to override. */
const hasNonDefaultDark = (modes) => {
  const cs = modes['color-scheme'];
  return Boolean(cs && cs.values.includes('dark') && cs.default !== 'dark');
};

const errors = [];
// `undefined` etc. as a whole word on the value side of a declaration. Matching
// the value side only keeps legitimate prose (a comment mentioning "undefined")
// out of it — the emitted files carry a lot of explanatory comments.
const LEAK = /(:|=>?)\s*(undefined|null|NaN)\b/;

let files = 0;
for (const [shape, modes] of Object.entries(MODE_SHAPES)) {
  const withDark = hasNonDefaultDark(modes);
  writeConfig(modes, withDark);
  for (const [name, pkg] of Object.entries(EXPORTERS)) {
    const loadExporter = async () => (await import(pkg)).default;
    const at = `${name} (${shape})`;
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

    // 5. The authored dark anchor actually reached the dark map, distinct from
    //    light. This guards the sweep's own premise: if a regression swallowed
    //    the dark layer (dark == light), the dark canvas would silently be a
    //    light one again and the authored-dark derivation path would stop being
    //    exercised, while every invariant above still passed — a silent no-op
    //    test. Checked at the IR boundary (not by grepping output) so it is
    //    robust to each exporter's color rendering.
    if (withDark) {
      const lightSurface = map.get('semantic.color.surface')?.value;
      const darkSurface = result.normalized.modes.dark?.get('semantic.color.surface')?.value;
      if (darkSurface === undefined || JSON.stringify(darkSurface) === JSON.stringify(lightSurface)) {
        errors.push(`${at}: authored dark surface did not distinctly reach modes.dark — the dark sweep degenerated to a light canvas`);
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

if (errors.length) {
  console.error(`✘ minimal-ds check: ${errors.length} problem(s)`);
  for (const e of errors) console.error('  - ' + e);
  console.error('\n  A design system may author only a brand color, a surface, and a text color,');
  console.error('  in any legal mode layout. Exporters must read absent slots and absent modes');
  console.error('  defensively — never crash, never leak a JS value, never over-claim coverage.');
  process.exit(1);
}
console.log(`✔ minimal-ds: all ${Object.keys(EXPORTERS).length} exporters compile a 3-token design system cleanly across ${Object.keys(MODE_SHAPES).length} mode shapes (${files} files, no leaks; authored dark distinctly emitted where declared); polarity-axis-not-first is a build error`);
