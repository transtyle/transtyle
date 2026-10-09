#!/usr/bin/env node
/**
 * AL5 guard: every exporter must survive a *minimal but valid* design system.
 *
 * Why this exists: the AL5 diagnostics sweep started by using the tool wrongly,
 * and the worst failure turned out to be a case where the user does nothing
 * wrong at all. A design system that authors only a brand color, a page
 * background (`elevation.0.surface`) and a text color is legal — nothing requires a radius scale or a border color —
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
 * **The one-token floor** (#23). The docs make `semantic.color.primary.solid`
 * the only token whose absence is an error (`TST1201`), so a design system
 * that authors nothing else is legal too — and Bootstrap threw on it. With no
 * `text.base`, the engine then left the whole content side empty (`text.*`,
 * `neutral.text-strong`; `border` is never derived), and the exporter mixed `undefined` for its
 * `$dark` pseudo-role, then fed it to `rgbTriplet()`, then wrote it as the last
 * entry of a Sass map where the drop pattern couldn't see it. The three-token
 * fixture authors `text.base`, so it could never get there.
 *
 * **The default text** (#116). DERIVE now fills an unauthored `text.base` the
 * way it fills the canvas: a contrast pick between the two default canvases
 * against the mode's own `elevation.0.surface` (`default-text`, `defaulted`).
 * Invariant 8 holds the one-token fixture to it in every combo of every shape:
 * the text side is there, near-black on white or white on near-black, and no
 * contrast pair fails. That takes the one-token system off the drop path, so a
 * third fixture keeps it under test: `late-text` binds `text.base` to a role
 * cell (`{semantic.color.neutral.solid}`), legal but read too late (`TST1205`),
 * which leaves `neutral.text-strong` and the content ladder empty in every
 * mode while `text.base` itself resolves. The default must never replace that
 * pending alias, and the fixture must really reach Bootstrap's `$dark` drop
 * path, or it proves nothing.
 *
 * **The neutral swap** (#29). A design system that authors its body text with
 * no dark value and no page got its light text on the default dark canvas,
 * at 1:1. DERIVE now swaps the light pair into the other polarity
 * (`swap-neutrals`). The `light-text` fixture (brand + `text.base`) holds
 * invariant 9 in every combo of every shape: the dark combos of a light
 * default get the swapped pair, `derived`, read from the light combo (and
 * `explain` follows it there), with the content side and no failing contrast
 * pair; every other combo keeps the carried text on the default canvas. A
 * separate block covers the swap's edges: the dark-native direction, and four
 * shapes it must leave alone (a dark value on the slot or on its alias
 * target, an authored page, a light text on the white default page).
 *
 * All FIXTURES run through every invariant below; the one-token and late-text
 * ones have no extra scheme layers, because a mode-scoped value for a token
 * the base doesn't define is skipped (`TST1107`) and there is nothing to author
 * per mode anyway. Their Bootstrap Sass output is also compiled against the
 * installed Bootstrap, the one place a text check can't reach: a theme map
 * entry with no value keeps Bootstrap's own variable, and only Sass can say
 * that still builds.
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
 * **DTCG object forms** (issue #24) are another case: the same design system
 * authored twice, once with CSS strings (`"0.5rem"`, `"cubic-bezier(…)"`, `600`)
 * and once with the DTCG structured forms (`{ "value": 0.5, "unit": "rem" }`,
 * `[0.2, 0, 0, 1]`, `"semi-bold"`), at the top level and as typography
 * members, must compile byte-identical on every exporter. Before NORMALIZE
 * parsed those forms, the object one wrote `[object Object]` into six targets,
 * dropped the value in two more, and broke the derived radius scale with a
 * false TST1105, all under a green build; the leak pattern below never looked
 * for `[object Object]` either. Malformed structured values must stop the build
 * with TST1106 naming the token (or the composite member's own path), the type
 * and the accepted forms. Validated by reverting normalize.js to carry those
 * values as authored: the twin fails on all eight exporters.
 *
 * **Per-target mode subsets** (issue #89, `targets.<t>.modes`): Acme with one
 * target narrowed at a time. Restricted to light, a target emits no dark block
 * and no `dropped` coverage row for the deliberate exclusion, its usage.md
 * says which modes it holds, and every exporter survives it; a bad subset
 * (default omitted, undeclared value or dimension) is TST1308 and emits nothing.
 *
 * Run: node scripts/check-minimal-ds.mjs   (npm run check:minimal-ds)
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, explainToken } from '@transtyle/core';
import { comboKey } from '@transtyle/ir';
import { LEAK, LEAK_INSIDE } from '@transtyle/plugin-kit';
import { compileString } from 'sass';

const EXPORTERS = {
  shadcn: '@transtyle/exporter-shadcn',
  echarts: '@transtyle/exporter-echarts',
  daisyui: '@transtyle/exporter-daisyui',
  bootstrap: '@transtyle/exporter-bootstrap',
  storybook: '@transtyle/exporter-storybook',
  'css-variables': '@transtyle/exporter-css-variables',
  radix: '@transtyle/exporter-radix',
  primeng: '@transtyle/exporter-primeng',
  mantine: '@transtyle/exporter-mantine',
  chakra: '@transtyle/exporter-chakra',
  mui: '@transtyle/exporter-mui',
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
      elevation: { 0: { surface: { $type: 'color', $value: '#ffffff' } } },
      text: { base: { $type: 'color', $value: '#212529' } },
    },
  },
};

/** The page background: the catalog's canvas slot, the one every derivation reads. */
const CANVAS = 'semantic.color.elevation.0.surface';

/** The floor below the floor: the one token whose absence is an error. */
const ONE_TOKEN = {
  semantic: { color: { primary: { solid: { $type: 'color', $value: '#3b5bdb' } } } },
};

/**
 * The brand plus a text color bound to a role cell. The alias resolves, but
 * after DERIVE read `text.base` (TST1205), so nothing on the content side is
 * derived: the one shape left that reaches an exporter without
 * `neutral.text-strong`.
 */
const LATE_TEXT = {
  semantic: {
    color: {
      ...ONE_TOKEN.semantic.color,
      text: { base: { $type: 'color', $value: '{semantic.color.neutral.solid}' } },
    },
  },
};

/**
 * The brand plus a body text with no dark value, and no page: issue #29's
 * black-on-black case. The text carried over from light used to sit on the
 * default dark canvas at 1:1 (`TST2101`); `swap-neutrals` now gives the dark
 * mode the light pair swapped, page and text.
 */
const LIGHT_TEXT = {
  semantic: {
    color: {
      ...ONE_TOKEN.semantic.color,
      text: { base: { $type: 'color', $value: '#212529' } },
    },
  },
};

/** The two default canvases, which are also the two default text colors (derive.js). */
const WHITE_L = 1;
const NEARBLACK_L = 0.145;

/**
 * Legal mode layouts a real config comes in. Each fixture compiles under every
 * one of these `modes` blocks. `light-dark` is the original harness;
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
      elevation: { 0: { surface: { $type: 'color', $value: '#101114' } } },
      text: { base: { $type: 'color', $value: '#f8f9fa' } },
    } },
  },
  dim: {
    semantic: { color: {
      elevation: { 0: { surface: { $type: 'color', $value: '#2b2417' } } },
      text: { base: { $type: 'color', $value: '#f5ecd9' } },
    } },
  },
};

/**
 * Each fixture is a token set, the mode-scoped layers it can author, and the
 * catalog slots it claims to anchor. Invariant 0 holds the fixture to that
 * claim: the three-token one used to author `semantic.color.surface`, a custom
 * token no derivation or exporter reads, so its page background was the
 * engine's `defaulted` canvas and the check guarded brand + text only.
 */
const FIXTURES = {
  'three-token': {
    tokens: MINIMAL_TOKENS,
    extraScheme: EXTRA_SCHEME_TOKENS,
    anchors: ['semantic.color.primary.solid', CANVAS, 'semantic.color.text.base'],
  },
  'one-token': { tokens: ONE_TOKEN, extraScheme: {}, anchors: ['semantic.color.primary.solid'] },
  'late-text': { tokens: LATE_TEXT, extraScheme: {}, anchors: ['semantic.color.primary.solid'] },
  'light-text': {
    tokens: LIGHT_TEXT,
    extraScheme: {},
    anchors: ['semantic.color.primary.solid', 'semantic.color.text.base'],
  },
};

const root = mkdtempSync(join(tmpdir(), 'transtyle-minimal-'));
let dir;
/** Lay a fixture out in its own directory; every later step reads `dir`. */
const useFixture = (name) => {
  const { tokens, extraScheme } = FIXTURES[name];
  dir = join(root, name);
  mkdirSync(join(dir, 'tokens'), { recursive: true });
  writeFileSync(join(dir, 'tokens', 'base.tokens.json'), JSON.stringify(tokens, null, 2));
  for (const [value, tree] of Object.entries(extraScheme)) {
    writeFileSync(join(dir, `${value}.tokens.json`), JSON.stringify(tree, null, 2));
  }
  return extraScheme;
};
let extraScheme = {};

/** Non-default `color-scheme` values this shape has, that we have authored
 *  token data for — i.e. genuinely different from the default and worth a
 *  mode-scoped layer, rather than a value the harness has no fixture for. */
const extraSchemeValues = (modes) => {
  const cs = modes['color-scheme'];
  if (!cs) return [];
  return cs.values.filter((v) => v !== cs.default && v in extraScheme);
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

/** `combo` with some dimensions moved to other values (the key of that combo). */
const comboOf = (n, combo, values) =>
  n.dimensionNames && n.comboDims?.[combo] ? comboKey(n.dimensionNames, { ...n.comboDims[combo], ...values }) : Object.values(values)[0];

const errors = [];
// `undefined`/`null`/`NaN` on the value side of a declaration, and the two
// that hide inside a value (`oklch(NaN NaN NaN)`, `[object Object]`): the
// plugin kit's `no-leaked-values` patterns, one copy for both. An authored
// shadow shipped the `NaN` for months behind a check that only looked right
// after the colon (#26).
const leaks = (line) => LEAK.test(line) || LEAK_INSIDE.test(line);

let files = 0;
// Fixtures × mode shapes, flattened so each fixture is laid out once.
const sweep = Object.keys(FIXTURES).flatMap((fixture) => Object.entries(MODE_SHAPES).map(([shape, modes]) => [fixture, shape, modes]));
for (const [fixture, shape, modes] of sweep) {
  if (dir !== join(root, fixture)) extraScheme = useFixture(fixture);
  const extraValues = extraSchemeValues(modes);
  for (const autoDark of [false, true]) {
    writeConfig(modes, autoDark);
    for (const [name, pkg] of Object.entries(EXPORTERS)) {
      const loadExporter = async () => (await import(pkg)).default;
      const at = `${name} (${fixture}, ${shape}, autoDark=${autoDark})`;
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
          if (leaks(line)) errors.push(`${at}/${f.path}:${i + 1} leaked a JS value into output: ${line.trim()}`);
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

      // 0. The fixture is what it says it is: every anchor it claims reached the
      //    default map as `authored`, and so did the canvas and text of every
      //    mode-scoped layer it wrote. A token authored under a name that is
      //    not a catalog slot is legal (custom vocabulary) and compiles
      //    silently, so only this assertion can tell an anchor from a no-op.
      const map = result.normalized.modes[result.normalized.defaultMode];
      for (const slot of FIXTURES[fixture].anchors) {
        const kind = map.get(slot)?.provenance?.kind;
        if (kind !== 'authored') errors.push(`${at}: the fixture authors ${slot}, but the default mode holds it as "${kind}" — it anchors nothing`);
      }
      for (const value of extraValues) {
        for (const slot of [CANVAS, 'semantic.color.text.base']) {
          const kind = result.normalized.modes[value]?.get(slot)?.provenance?.kind;
          if (kind !== 'authored') errors.push(`${at}: the "${value}" layer authors ${slot}, but modes.${value} holds it as "${kind}"`);
        }
      }

      // 8. The default text (#116). In the one-token system every combo's
      //    `text.base` is the `default-text` pick against that combo's own
      //    canvas, the opposite default (near-black on white, white on
      //    near-black), and the content side derives from it as it does from
      //    an authored one. In the late-text system the alias wins, pending or
      //    not, and the content side stays empty, or the fixture degenerated.
      const combos = result.normalized.allCombos ?? result.normalized.modeValues;
      if (fixture === 'one-token') {
        for (const combo of combos) {
          const m = result.normalized.modes[combo];
          const text = m.get('semantic.color.text.base');
          const { kind, rule, inputs } = text?.provenance ?? {};
          if (kind !== 'defaulted' || rule !== 'default-text@standard@1' || inputs?.join() !== 'elevation.0.surface') {
            errors.push(`${at} [${combo}]: text.base is not defaulted by default-text from elevation.0.surface (${JSON.stringify(text?.provenance)})`);
            continue;
          }
          const pair = [m.get(CANVAS)?.value?.l, text.value.l];
          if (!(pair[0] === WHITE_L && pair[1] === NEARBLACK_L) && !(pair[0] === NEARBLACK_L && pair[1] === WHITE_L)) {
            errors.push(`${at} [${combo}]: default page/text lightness is ${pair.join(' / ')}, expected white/near-black or near-black/white`);
          }
          for (const slot of ['text.muted', 'text.subtle', 'text.disabled', 'text.strong', 'neutral.text-strong', 'primary.text-strong']) {
            if (m.get(`semantic.color.${slot}`)?.value === undefined) errors.push(`${at} [${combo}]: ${slot} is not derived from the default text.base`);
          }
        }
        const failing = result.diagnostics.items.filter((d) => d.code === 'TST2101');
        if (failing.length) errors.push(`${at}: the default page/text pair fails a contrast check — ${failing.map((d) => d.message).join('; ')}`);
      }
      if (fixture === 'late-text') {
        for (const combo of combos) {
          const m = result.normalized.modes[combo];
          const kind = m.get('semantic.color.text.base')?.provenance?.kind;
          if (kind !== 'aliased') errors.push(`${at} [${combo}]: text.base bound to a role cell is held as "${kind}" — the default replaced an authored alias`);
          if (m.get('semantic.color.neutral.text-strong')?.value !== undefined) {
            errors.push(`${at} [${combo}]: neutral.text-strong is derived, so the late-text fixture no longer reaches the absent-slot path it exists for`);
          }
        }
      }

      // 9. The neutral swap (#29). In the light-text system, every combo whose
      //    color-scheme is dark under a light default gets the light pair
      //    swapped (`swap-neutrals`, `derived`, both inputs read from the
      //    light combo, which `explain` must follow), the content side derives
      //    from it, TST1206 says so and no contrast pair fails. Every other
      //    combo (light, `dim`, density-only, dark-only) keeps the carried
      //    text on the default canvas, untouched.
      if (fixture === 'light-text') {
        const n = result.normalized;
        const cs = modes['color-scheme'];
        let swaps = 0;
        for (const combo of combos) {
          const m = n.modes[combo];
          const page = m.get(CANVAS);
          const text = m.get('semantic.color.text.base');
          const scheme = n.comboDims?.[combo]?.['color-scheme'];
          if (cs?.default === 'light' && scheme === 'dark') {
            swaps++;
            const base = comboOf(n, combo, { 'color-scheme': 'light' });
            const lightText = n.modes[base].get('semantic.color.text.base')?.value;
            for (const [slot, entry, want, inputs] of [
              ['elevation.0.surface', page, lightText, 'text.base,elevation.0.surface'],
              ['text.base', text, n.modes[base].get(CANVAS)?.value, 'elevation.0.surface,text.base'],
            ]) {
              const p = entry?.provenance ?? {};
              if (p.kind !== 'derived' || p.rule !== 'swap-neutrals@standard@1' || p.inputs?.join() !== inputs || p.inputMode !== base) {
                errors.push(`${at} [${combo}]: ${slot} is not derived by swap-neutrals from the ${base} pair (${JSON.stringify(p)})`);
              } else if (JSON.stringify({ ...entry.value, alpha: 1 }) !== JSON.stringify({ ...want, alpha: 1 })) {
                errors.push(`${at} [${combo}]: swapped ${slot} is ${JSON.stringify(entry.value)}, expected the ${base} ${slot === 'text.base' ? 'page' : 'text'} ${JSON.stringify(want)}`);
              }
            }
            const why = explainToken(n, 'text.base', { mode: combo });
            if (why.inputs.map((i) => `${i.path}@${i.mode}`).join() !== `${CANVAS}@${base},semantic.color.text.base@${base}`) {
              errors.push(`${at} [${combo}]: explain does not follow swap-neutrals' inputs into ${base} (${why.inputs.map((i) => `${i.path}@${i.mode}`).join()})`);
            }
            for (const slot of ['text.muted', 'text.subtle', 'text.disabled', 'text.inverse', 'elevation.1.surface', 'primary.text-strong']) {
              if (m.get(`semantic.color.${slot}`)?.value === undefined) errors.push(`${at} [${combo}]: ${slot} is not derived from the swapped pair`);
            }
          } else {
            if (page?.provenance?.rule !== 'default-canvas@standard@1') errors.push(`${at} [${combo}]: the page is ${page?.provenance?.rule ?? page?.provenance?.kind}, expected the untouched default canvas`);
            if (text?.provenance?.kind !== 'authored') errors.push(`${at} [${combo}]: text.base is "${text?.provenance?.kind}", expected the authored value carried over`);
          }
        }
        const notes = result.diagnostics.items.filter((d) => d.code === 'TST1206');
        if (notes.length !== (swaps ? 1 : 0)) errors.push(`${at}: ${notes.length} TST1206 note(s) for ${swaps} swapped combo(s), expected ${swaps ? 'one' : 'none'}`);
        const failing = result.diagnostics.items.filter((d) => d.code === 'TST2101');
        if (shape !== 'dark-only' && failing.length) errors.push(`${at}: the swapped pair fails a contrast check — ${failing.map((d) => d.message).join('; ')}`);
      }

      // 4. Coverage honesty. Only rows whose `slot` is a single, complete IR path
      //    are checkable — many rows legitimately carry a summary label instead
      //    (`semantic.color.elevation.1.surface + border + text.base`, `semantic.color.primary.*`, or a
      //    target's own namespace such as PrimeNG's `{primary.color}` runtime
      //    reference). Those are skipped rather than guessed at.
      for (const c of emitted.coverage ?? []) {
        // 4a. Tier: exporters bind to the semantic tier or above (ir.md). A row
        //     naming `option.*` reads private vocabulary, whatever its class.
        if (String(c.slot ?? '').startsWith('option.')) {
          errors.push(`${at}: coverage row "${c.variable}" binds ${c.slot}, below the semantic tier — exporters read semantic or component slots, never option.*`);
        }
        if (!['native', 'derived'].includes(c.class)) continue;
        const slot = String(c.slot ?? '');
        if (!/^(semantic|component|option)\.[\w.-]+$/.test(slot)) continue;
        if (map.get(slot)?.value === undefined) {
          errors.push(`${at}: coverage row "${c.variable}" claims class ${c.class} from ${slot}, which does not resolve — absence is not coverage`);
        }
      }
      // 4b. A variable Bootstrap drops for want of a value is reported under its
      //     own name — `$border-color`, `--bs-dark-rgb`, a map entry as
      //     `$theme-colors-text.dark` — never as the whole line it sat on.
      if (name === 'bootstrap') {
        for (const c of emitted.coverage ?? []) {
          if (c.class === 'dropped' && /provides no value/.test(c.note ?? '') && !/^(\$|--)[\w-]+(\.[\w-]+)?$/.test(c.variable)) {
            errors.push(`${at}: dropped row is not named by its variable: "${c.variable}"`);
          }
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
        const seen = new Map([['light', map.get(CANVAS)?.value]]);
        for (const value of extraValues) {
          const surface = result.normalized.modes[value]?.get(CANVAS)?.value;
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

// The one-token and late-text Bootstrap Sass output against real Bootstrap, in
// the order usage.md gives. A theme map entry this design system has no value
// for keeps Bootstrap's own variable (`"dark": $dark-text-emphasis`); leaving
// the key out instead would drop `--bs-dark-text-emphasis` and its siblings
// from the compiled CSS while `.alert-dark` and `.bg-dark-subtle` still read
// them, and a text check can't tell that from a valid file. Only late-text
// still reaches that fallback (one-token gets a `dark` from the default text),
// so it must report the entry dropped, or the case went quiet.
for (const fixture of ['one-token', 'late-text']) {
  extraScheme = useFixture(fixture);
  writeConfig(MODE_SHAPES['light-dark']);
  try {
    const bs = await compile({
      cwd: dir,
      targets: ['bootstrap'],
      emit: false,
      loadExporter: async () => (await import(EXPORTERS.bootstrap)).default,
    });
    const out = bs.results.find((r) => r.target === 'bootstrap');
    const dropsDark = (out?.coverage ?? []).some((c) => c.class === 'dropped' && c.variable === '$theme-colors-text.dark');
    if (dropsDark !== (fixture === 'late-text')) {
      errors.push(`bootstrap (${fixture}, Sass): $theme-colors-text.dark is ${dropsDark ? '' : 'not '}reported dropped — expected only when neutral.text-strong is absent (late-text)`);
    }
    const scssDir = join(dir, 'scss');
    mkdirSync(scssDir, { recursive: true });
    for (const f of out?.emitted ?? []) {
      if (f.path.endsWith('.scss')) writeFileSync(join(scssDir, f.path), f.contents);
    }
    const css = compileString(
      ['variables.transtyle', 'bootstrap/scss/functions', 'bootstrap/scss/variables', 'bootstrap/scss/variables-dark', 'maps.transtyle', 'bootstrap/scss/bootstrap']
        .map((m) => `@import "${m}";`)
        .join('\n'),
      { loadPaths: [scssDir, join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules')], logger: { warn: () => {} } },
    ).css;
    for (const want of ['--bs-dark-text-emphasis:', '--bs-dark-bg-subtle:', '--bs-dark-border-subtle:']) {
      if (!css.includes(want)) errors.push(`bootstrap (${fixture}, Sass): the compiled CSS has no ${want} — a theme map lost its "dark" entry`);
    }
  } catch (e) {
    errors.push(`bootstrap (${fixture}, Sass): the Sass path does not compile against Bootstrap — ${e.message.split('\n')[0]}`);
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

rmSync(root, { recursive: true, force: true });

// The neutral swap's edges (#29), each a light/dark design system with no page
// unless said otherwise. The swap runs in both directions, and it never
// touches a value the design system wrote for that scheme, on the slot or on
// its alias target, an authored page, or a text color that would swap into
// the wrong polarity.
const swapDir = mkdtempSync(join(tmpdir(), 'transtyle-swap-'));
const swapCase = async (color, { modes = MODE_SHAPES['light-dark'], dark } = {}) => {
  rmSync(swapDir, { recursive: true, force: true });
  mkdirSync(join(swapDir, 'tokens'), { recursive: true });
  writeFileSync(join(swapDir, 'tokens', 'base.tokens.json'), JSON.stringify({ semantic: { color: { primary: ONE_TOKEN.semantic.color.primary, ...color } }, ...(dark ? { option: dark } : {}) }));
  writeFileSync(join(swapDir, 'transtyle.config.json'), JSON.stringify({ name: 'swap', tokens: ['tokens/*.tokens.json'], modes, derivation: { rules: 'standard@1' }, targets: {} }));
  const r = await compile({ cwd: swapDir, targets: [], emit: false, loadExporter: loadNoop });
  const rule = (mode, slot) => r.normalized.modes[mode].get(`semantic.color.${slot}`)?.provenance?.rule ?? r.normalized.modes[mode].get(`semantic.color.${slot}`)?.provenance?.kind;
  return { r, rule, notes: r.diagnostics.items.filter((d) => d.code === 'TST1206').length, contrast: r.diagnostics.items.filter((d) => d.code === 'TST2101').length };
};
const textOf = (value, darkValue) => ({
  text: { base: { $type: 'color', $value: value, ...(darkValue ? { $extensions: { 'transtyle.modes': { 'color-scheme': { dark: darkValue } } } } : {}) } },
});
{
  // Dark-native: a light text on a dark default gets a light mode, the swap the other way.
  const native = await swapCase(textOf('#f1f3f5'), { modes: { 'color-scheme': { values: ['light', 'dark'], default: 'dark' } } });
  const lightPage = native.r.normalized.modes.light.get(CANVAS)?.value;
  if (native.rule('light', 'text.base') !== 'swap-neutrals@standard@1' || !(lightPage?.l > 0.9) || native.contrast) {
    errors.push(`neutral swap (dark default): the light mode is not the dark pair swapped (text.base ${native.rule('light', 'text.base')}, page l=${lightPage?.l}, ${native.contrast} TST2101)`);
  }
  for (const [why, c] of [
    ['a text.base with its own dark value', await swapCase(textOf('#212529', '#f8f9fa'))],
    ['a text.base bound to a token with a dark value', await swapCase(
      { text: { base: { $value: '{option.ink}' } } },
      { dark: { ink: { $type: 'color', $value: '#212529', $extensions: { 'transtyle.modes': { 'color-scheme': { dark: '#f8f9fa' } } } } } },
    )],
    ['an authored page (the scaffold shape, left to init)', await swapCase({ ...textOf('#212529'), elevation: { 0: { surface: { $type: 'color', $value: '#ffffff' } } } })],
    ['a light text on the white default page (wrong polarity)', await swapCase(textOf('#f8f9fa'))],
  ]) {
    if (c.rule('dark', 'text.base') === 'swap-neutrals@standard@1' || c.rule('dark', 'elevation.0.surface') === 'swap-neutrals@standard@1' || c.notes) {
      errors.push(`neutral swap: ${why} was swapped in dark mode — it must be left as written`);
    }
  }
}
rmSync(swapDir, { recursive: true, force: true });

// Per-target mode subsets (issue #89, `targets.<t>.modes`). Acme (color-scheme
// light/dark x density comfortable/compact) with one target narrowed at a time:
//  - light only: no dark in the files, no `dropped` row for a deliberate
//    exclusion, usage.md says what it holds, and the unnarrowed run of the same
//    target is untouched;
//  - density narrowed to one value on a target that never expresses density:
//    still no `dropped` row, where leaving density wholly out of the subset
//    keeps it;
//  - a subset that names an undeclared value or dimension, or drops the
//    default, is TST1308 and emits nothing for ANY target.
const subsetDir = mkdtempSync(join(tmpdir(), 'transtyle-subset-'));
cpSync('examples/acme', subsetDir, { recursive: true, filter: (src) => !/[\\/](demo|expected|dist)([\\/]|$)/.test(src) });
const subsetConfig = JSON.parse(readFileSync(join(subsetDir, 'transtyle.config.json'), 'utf8'));
const compileSubset = async (name, modes) => {
  const cfg = structuredClone(subsetConfig);
  cfg.targets = { [name]: { ...cfg.targets[name] } };
  if (modes) cfg.targets[name].modes = modes;
  writeFileSync(join(subsetDir, 'transtyle.config.json'), JSON.stringify(cfg, null, 2));
  const r = await compile({ cwd: subsetDir, emit: false, loadExporter: async () => (await import(EXPORTERS[name])).default });
  return { r, res: r.results.find((x) => x.target === name) };
};
const droppedRows = (res) => (res?.coverage ?? []).filter((c) => c.class === 'dropped' && c.variable.startsWith('(mode:'));
const fileOf = (res, f) => res?.emitted.find((x) => x.path === f)?.contents ?? '';
{
  const full = await compileSubset('bootstrap', null);
  const light = await compileSubset('bootstrap', { 'color-scheme': ['light'] });
  if (light.r.diagnostics.errors.length) errors.push(`target modes: bootstrap light-only produced errors — ${light.r.diagnostics.errors.map((d) => d.message).join('; ')}`);
  if (!/\[data-bs-theme=dark\]|data-bs-theme="dark"/.test(fileOf(full.res, 'bootstrap-theme.css'))) errors.push('target modes: the full Acme Bootstrap theme has no dark block, so the light-only case proves nothing');
  if (/\[data-bs-theme=dark\]|data-bs-theme="dark"/.test(fileOf(light.res, 'bootstrap-theme.css'))) errors.push('target modes: bootstrap restricted to light still emitted a dark block');
  if (droppedRows(light.res).some((c) => c.variable === '(mode:color-scheme)')) errors.push('target modes: a deliberate color-scheme exclusion produced a `dropped` row');
  if (!droppedRows(full.res).some((c) => c.variable === '(mode:density)')) errors.push('target modes: the full Bootstrap build lost its (mode:density) dropped row');
  if (!fileOf(light.res, 'usage.md').includes('- `color-scheme`: light')) errors.push('target modes: usage.md does not state the modes the files contain');

  const dens = await compileSubset('bootstrap', { density: ['comfortable'] });
  if (droppedRows(dens.res).length) errors.push('target modes: density narrowed to one value still produced a `dropped` row');
  if (fileOf(dens.res, 'bootstrap-theme.css') !== fileOf(full.res, 'bootstrap-theme.css')) errors.push('target modes: narrowing a dimension Bootstrap does not express changed its stylesheet');

  const echarts = await compileSubset('echarts', { 'color-scheme': ['light'] });
  const themes = (echarts.res?.emitted ?? []).filter((f) => /^theme\..*\.json$/.test(f.path));
  if (themes.length !== 1) errors.push(`target modes: echarts restricted to light should emit one theme, got ${themes.length}`);

  const css = await compileSubset('css-variables', { density: ['comfortable'] });
  if (/data-density/.test(fileOf(css.res, 'variables.transtyle.css'))) errors.push('target modes: css-variables narrowed to density: comfortable still emitted a compact block');

  const mantine = await compileSubset('mantine', { 'color-scheme': ['light'] });
  if ((mantine.res?.emitted ?? []).some((f) => /primary-dark/.test(f.contents ?? ''))) errors.push('target modes: mantine restricted to light still emitted a primary-dark tuple');

  for (const name of Object.keys(EXPORTERS)) {
    const r = await compileSubset(name, { 'color-scheme': ['light'] });
    if (r.r.diagnostics.errors.length) errors.push(`target modes (${name}, light only): ${r.r.diagnostics.errors.map((d) => d.message).join('; ')}`);
    for (const f of r.res?.emitted ?? []) if (leaks(f.contents ?? '')) errors.push(`target modes (${name}, light only)/${f.path}: leaked a JS value into output`);
  }

  for (const [why, modes, wantInMessage] of [
    ['omits the default', { 'color-scheme': ['dark'] }, 'leaves out the default value "light"'],
    ['names an undeclared value', { 'color-scheme': ['light', 'sepia'] }, '"sepia"'],
    ['names an undeclared dimension', { brand: ['a'] }, '"brand" is not a mode dimension'],
  ]) {
    const bad = await compileSubset('bootstrap', modes);
    const hit = bad.r.diagnostics.errors.find((d) => d.code === 'TST1308');
    if (!hit || !hit.message.includes(wantInMessage)) errors.push(`target modes (${why}): expected TST1308 containing ${wantInMessage} — got ${bad.r.diagnostics.errors.map((d) => `${d.code} ${d.message}`).join('; ') || 'no errors'}`);
    if (bad.res) errors.push(`target modes (${why}): a bad subset still emitted`);
  }
}
rmSync(subsetDir, { recursive: true, force: true });

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
          elevation: { 0: { surface: { $type: 'color', $value: '#ffffff' } } },
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

// Authored composites (#26). Every derived composite — the elevation ladder's
// shadows, the type roles — is built in DERIVE with its members already in IR
// form, so a sweep over a design system that authors none can never see what
// happens to one the user wrote. What happened: NORMALIZE passed the whole
// `$value` through, `shadow.color` reached the exporters as the string
// "#00000033", and css-variables shipped `oklch(NaN NaN NaN)` with no
// diagnostic. Each DTCG composite the catalog or css-variables consumes is
// authored here in the shapes that matter: a literal member, a per-mode
// value, a member aliasing an authored token, a member aliasing a slot only
// DERIVE fills (the deferred path), the stacked-shadow array form with
// `inset`, and a whole-token alias to an authored composite. All eight
// exporters must compile it cleanly in both modes with nothing leaking.
const compDir = mkdtempSync(join(tmpdir(), 'transtyle-composites-'));
mkdirSync(join(compDir, 'tokens'));
const layer = (color, y, blur, extra = {}) => ({ color, offsetX: '0px', offsetY: y, blur, spread: '0px', ...extra });
writeFileSync(
  join(compDir, 'tokens', 'base.tokens.json'),
  JSON.stringify(
    {
      option: { color: { $type: 'color', ink: { $value: '#1a1a2e' } } },
      semantic: {
        color: {
          ...MINIMAL_TOKENS.semantic.color,
          elevation: {
            ...MINIMAL_TOKENS.semantic.color.elevation,
            1: {
              shadow: {
                $type: 'shadow',
                $value: layer('#00000033', '2px', '8px'),
                $extensions: { 'transtyle.modes': { 'color-scheme': { dark: layer('#00000099', '2px', '8px') } } },
              },
            },
            2: {
              shadow: {
                $type: 'shadow',
                $value: [layer('{semantic.color.scrim}', '1px', '2px'), layer('{option.color.ink}', '4px', '12px', { spread: '-2px', inset: true })],
              },
            },
            3: { shadow: { $type: 'shadow', $value: '{semantic.color.elevation.1.shadow}' } },
          },
        },
        border: { focus: { $type: 'border', $value: { color: '{semantic.color.primary.solid}', width: '2px', style: 'solid' } } },
        motion: { fade: { $type: 'transition', $value: { duration: '{semantic.duration.fast}', delay: '0ms', timingFunction: [0.4, 0, 0.2, 1] } } },
        type: { role: { body: { md: { $type: 'typography', $value: { fontSize: '{semantic.type.size.lg}', fontWeight: 500, lineHeight: 1.5 } } } } },
      },
    },
    null,
    2,
  ),
);
writeFileSync(
  join(compDir, 'transtyle.config.json'),
  JSON.stringify(
    {
      name: 'composites',
      tokens: ['tokens/*.tokens.json'],
      modes: MODE_SHAPES['light-dark'],
      derivation: { rules: 'standard@1' },
      targets: Object.fromEntries(Object.keys(EXPORTERS).map((n) => [n, { output: `dist/${n}` }])),
    },
    null,
    2,
  ),
);
const isOklch = (v) => v && ['l', 'c', 'h', 'alpha'].every((k) => typeof v[k] === 'number' && !Number.isNaN(v[k]));
let compFiles = 0;
for (const [name, pkg] of Object.entries(EXPORTERS)) {
  const at = `${name} (authored composites)`;
  let result;
  try {
    result = await compile({ cwd: compDir, targets: [name], emit: false, loadExporter: async () => (await import(pkg)).default });
  } catch (e) {
    errors.push(`${at}: threw instead of reporting — ${e.message}`);
    continue;
  }
  if (result.diagnostics.errors.length) {
    errors.push(`${at}: produced errors — ${result.diagnostics.errors.map((d) => `${d.code} ${d.message}`).join('; ')}`);
    continue;
  }
  for (const f of result.results.find((r) => r.target === name)?.emitted ?? []) {
    compFiles++;
    (f.contents ?? '').split('\n').forEach((line, i) => {
      if (leaks(line)) errors.push(`${at}/${f.path}:${i + 1} leaked a JS value into output: ${line.trim()}`);
    });
    if (name === 'css-variables' && f.path.endsWith('.css')) {
      for (const want of ['--elevation-2-shadow: 0px 1px 2px 0px oklch(0.1 0 0 / 0.5), inset 0px 4px 12px -2px oklch(', '--border-focus: 2px solid oklch(', '--motion-fade: 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms']) {
        if (!f.contents.includes(want)) errors.push(`${at}/${f.path}: expected a line starting "${want}"`);
      }
    }
    if (name === 'primeng' && !f.path.endsWith('.md') && f.path !== 'report.json' && !f.contents.includes('inset 0px 4px 12px -2px oklch(')) {
      errors.push(`${at}/${f.path}: the overlays read elevation.2.shadow, but the authored stacked shadow did not reach the preset`);
    }
  }
  if (name !== 'css-variables') continue;
  // IR boundary, once: every member parsed, per mode, with its aliases recorded.
  for (const mode of ['light', 'dark']) {
    const map = result.normalized.modes[mode];
    const value = (p) => map.get(p)?.value;
    const layers = ['1', '2', '3'].flatMap((n) => [value(`semantic.color.elevation.${n}.shadow`)].flat());
    if (layers.length !== 4 || !layers.every((l) => isOklch(l?.color))) {
      errors.push(`${at} [${mode}]: authored shadow layers did not all parse to OKLCH colors — ${JSON.stringify(layers)}`);
    }
    if (JSON.stringify(value('semantic.color.elevation.2.shadow')?.[0]?.color) !== JSON.stringify(value('semantic.color.scrim'))) {
      errors.push(`${at} [${mode}]: a shadow member aliasing the derived scrim did not resolve to the scrim`);
    }
    if (JSON.stringify(value('semantic.color.elevation.3.shadow')) !== JSON.stringify(value('semantic.color.elevation.1.shadow'))) {
      errors.push(`${at} [${mode}]: a whole-token alias to an authored shadow did not carry its parsed value`);
    }
    if (!isOklch(value('semantic.border.focus')?.color) || value('semantic.motion.fade')?.duration !== '150ms' || value('semantic.type.role.body.md')?.fontSize !== value('semantic.type.size.lg')) {
      errors.push(`${at} [${mode}]: border/transition/typography members did not resolve (${JSON.stringify([value('semantic.border.focus'), value('semantic.motion.fade'), value('semantic.type.role.body.md')])})`);
    }
    const members = map.get('semantic.color.elevation.2.shadow')?.provenance?.members;
    if (members?.['0.color'] !== 'semantic.color.scrim' || members?.['1.color'] !== 'option.color.ink') {
      errors.push(`${at} [${mode}]: provenance.members does not record the member aliases explain prints (${JSON.stringify(members)})`);
    }
  }
  const alpha = (mode) => result.normalized.modes[mode].get('semantic.color.elevation.1.shadow')?.value?.color?.alpha;
  if (alpha('light') === alpha('dark')) {
    errors.push(`${at}: the dark-mode value authored for elevation.1.shadow did not reach the dark map`);
  }
}

// …and a composite the user got wrong must say where. One run, every kind of
// mistake, each reported under its member's own path.
writeFileSync(
  join(compDir, 'tokens', 'base.tokens.json'),
  JSON.stringify({
    semantic: {
      color: {
        ...MINIMAL_TOKENS.semantic.color,
        elevation: {
          ...MINIMAL_TOKENS.semantic.color.elevation,
          1: { shadow: { $type: 'shadow', $value: { color: 'not-a-color', offsetX: '0px', offsetY: '2px', blur: '8px' } } },
          2: { shadow: { $type: 'shadow', $value: [layer('{semantic.color.nope}', '1px', '2px')] } },
          3: { shadow: { $type: 'shadow', $value: '0 1px 2px #000' } },
        },
      },
    },
  }),
);
const bad = await compile({ cwd: compDir, targets: [], emit: false, loadExporter: loadNoop });
for (const [code, path] of [
  ['TST1106', 'semantic.color.elevation.1.shadow.color'],
  ['TST1106', 'semantic.color.elevation.1.shadow.spread'],
  ['TST1105', 'semantic.color.elevation.2.shadow.0.color'],
  ['TST1106', 'semantic.color.elevation.3.shadow'],
]) {
  if (!bad.diagnostics.errors.some((d) => d.code === code && d.message.includes(path))) {
    errors.push(`authored composites: expected ${code} naming ${path} — got ${bad.diagnostics.errors.map((d) => `${d.code} ${d.message}`).join('; ') || 'no errors'}`);
  }
}
rmSync(compDir, { recursive: true, force: true });

// DTCG object-form twin (issue #24): one design system, authored once with CSS
// strings and once with the DTCG structured forms, must compile to the same
// bytes on every exporter. Covers each parsed type, a per-mode value, an alias
// to a structured value, and composite members.
const twinTokens = (structured) => {
  const pick = (string, dtcg) => (structured ? dtcg : string);
  return {
    semantic: {
      ...MINIMAL_TOKENS.semantic,
      radius: { md: { $type: 'dimension', $value: pick('0.375rem', { value: 0.375, unit: 'rem' }) } },
      space: {
        $type: 'dimension',
        4: {
          $value: pick('16px', { value: 16, unit: 'px' }),
          $extensions: { 'transtyle.modes': { density: { compact: pick('12px', { value: 12, unit: 'px' }) } } },
        },
        // Exponent territory: String(1e-7) is "1e-7", which no stylesheet parses.
        px: { $value: pick('0.0000001rem', { value: 1e-7, unit: 'rem' }) },
      },
      border: { $type: 'dimension', 'radius-alias': { $value: '{semantic.radius.md}' } },
      duration: { fast: { $type: 'duration', $value: pick('120ms', { value: 120, unit: 'ms' }) } },
      easing: { standard: { $type: 'cubicBezier', $value: pick('cubic-bezier(0.2, 0, 0, 1)', [0.2, 0, 0, 1]) } },
      type: {
        weight: { semibold: { $type: 'fontWeight', $value: pick(600, 'semi-bold') } },
        role: {
          body: {
            md: {
              $type: 'typography',
              $value: {
                fontFamily: 'Inter',
                fontSize: pick('1rem', { value: 1, unit: 'rem' }),
                fontWeight: pick(300, 'light'),
                lineHeight: 1.5,
                letterSpacing: pick('0.5px', { value: 0.5, unit: 'px' }),
              },
            },
          },
        },
      },
    },
  };
};
const twinBuild = async (structured) => {
  const d = mkdtempSync(join(tmpdir(), 'transtyle-twin-'));
  mkdirSync(join(d, 'tokens'));
  writeFileSync(join(d, 'tokens', 'base.tokens.json'), JSON.stringify(twinTokens(structured), null, 2));
  writeFileSync(
    join(d, 'transtyle.config.json'),
    JSON.stringify({
      name: 'twin',
      tokens: ['tokens/*.tokens.json'],
      modes: MODE_SHAPES['two-dimension'],
      derivation: { rules: 'standard@1' },
      targets: Object.fromEntries(Object.keys(EXPORTERS).map((n) => [n, { output: `dist/${n}` }])),
    }),
  );
  const r = await compile({
    cwd: d,
    targets: Object.keys(EXPORTERS),
    emit: false,
    loadExporter: async (n) => (await import(EXPORTERS[n])).default,
  });
  rmSync(d, { recursive: true, force: true });
  return r;
};
const asString = await twinBuild(false);
const asDtcg = await twinBuild(true);
let twinFiles = 0;
for (const [label, r] of [['string twin', asString], ['DTCG object-form twin', asDtcg]]) {
  for (const d of r.diagnostics.errors) errors.push(`${label}: ${d.code} ${d.message}`);
}
for (const name of Object.keys(EXPORTERS)) {
  const files = (r) => r.results.find((x) => x.target === name)?.emitted ?? [];
  const want = files(asString);
  const got = files(asDtcg);
  if (!want.length) errors.push(`object-form twin: ${name} emitted nothing for the string twin, so the comparison proves nothing`);
  for (const f of want) {
    twinFiles++;
    const g = got.find((x) => x.path === f.path);
    if (!g) {
      errors.push(`object-form twin: ${name}/${f.path} is missing when the same tokens are authored in DTCG object form`);
      continue;
    }
    if (g.contents === f.contents) continue;
    const a = f.contents.split('\n');
    const b = g.contents.split('\n');
    const i = a.findIndex((line, n) => line !== b[n]);
    errors.push(`object-form twin: ${name}/${f.path}:${i + 1} differs from the string twin — "${b[i]?.trim()}" vs "${a[i]?.trim()}". DTCG object forms must canonicalize to the CSS string in NORMALIZE (packages/core/src/values.js)`);
  }
  for (const f of [...want, ...got]) {
    f.contents.split('\n').forEach((line, i) => {
      if (leaks(line)) errors.push(`object-form twin: ${name}/${f.path}:${i + 1} leaked a JS value into output: ${line.trim()}`);
    });
  }
}

// Malformed structured values: each must stop the build with TST1106 naming the
// token and its type — never pass through to an exporter.
const MALFORMED = {
  'no-unit': ['dimension', { value: 16 }],
  'string-value': ['dimension', { value: '16', unit: 'px' }],
  'unknown-unit': ['dimension', { value: 16, unit: 'em' }],
  'bare-number': ['dimension', 16],
  'duration-unit': ['duration', { value: 1, unit: 'min' }],
  'three-points': ['cubicBezier', [0.2, 0, 0]],
  'x-out-of-range': ['cubicBezier', [1.2, 0, 0, 1]],
  'unknown-weight': ['fontWeight', 'semi-boldish'],
};
// …and the same mistakes inside a composite, where resolveComposite() hands
// each member to the same parser: reported under the member's own path, with
// the member's type and the same hint.
const MALFORMED_MEMBERS = {
  'member-no-unit': ['shadow', { color: '#000', offsetX: '0px', offsetY: '2px', blur: { value: 8 }, spread: '0px' }, 'blur', 'dimension'],
  'member-three-points': ['transition', { duration: '100ms', delay: '0ms', timingFunction: [0.2, 0, 0] }, 'timingFunction', 'cubicBezier'],
};
const badDir = mkdtempSync(join(tmpdir(), 'transtyle-malformed-'));
mkdirSync(join(badDir, 'tokens'));
writeFileSync(
  join(badDir, 'tokens', 'base.tokens.json'),
  JSON.stringify({
    semantic: {
      ...MINIMAL_TOKENS.semantic,
      probe: Object.fromEntries(
        [...Object.entries(MALFORMED), ...Object.entries(MALFORMED_MEMBERS)].map(([k, [type, value]]) => [k, { $type: type, $value: value }]),
      ),
    },
  }),
);
writeFileSync(
  join(badDir, 'transtyle.config.json'),
  JSON.stringify({ name: 'malformed', tokens: ['tokens/*.tokens.json'], derivation: { rules: 'standard@1' }, targets: {} }),
);
const malformed = await compile({ cwd: badDir, targets: [], emit: false, loadExporter: loadNoop });
rmSync(badDir, { recursive: true, force: true });
for (const [k, [type, value]] of Object.entries(MALFORMED)) {
  const slot = `semantic.probe.${k}`;
  const d = malformed.diagnostics.errors.find((x) => x.code === 'TST1106' && x.message.startsWith(`${slot}:`));
  if (!d) errors.push(`malformed ${type} ${JSON.stringify(value)} (${slot}) must fail with TST1106, but it did not`);
  else if (!d.message.includes(type)) errors.push(`TST1106 for ${slot} does not name the type "${type}": ${d.message}`);
  else if (!d.hint) errors.push(`TST1106 for ${slot} carries no hint naming the accepted forms`);
}
for (const [k, [composite, value, member, type]] of Object.entries(MALFORMED_MEMBERS)) {
  const slot = `semantic.probe.${k}.${member}`;
  const d = malformed.diagnostics.errors.find((x) => x.code === 'TST1106' && x.message.startsWith(`${slot}:`));
  if (!d) errors.push(`malformed ${composite} member ${JSON.stringify(value[member])} (${slot}) must fail with TST1106 under the member's path, but it did not — got ${malformed.diagnostics.errors.map((x) => `${x.code} ${x.message}`).join('; ') || 'no errors'}`);
  else if (!d.message.includes(type)) errors.push(`TST1106 for ${slot} does not name the member's type "${type}": ${d.message}`);
  else if (!d.hint) errors.push(`TST1106 for ${slot} carries no hint naming the accepted forms`);
}

if (errors.length) {
  console.error(`✘ minimal-ds check: ${errors.length} problem(s)`);
  for (const e of errors) console.error('  - ' + e);
  console.error('\n  A design system may author only a brand color (or that plus a surface and a text color),');
  console.error('  in any legal mode layout. Exporters must read absent slots and absent modes');
  console.error('  defensively — never crash, never leak a JS value, never over-claim coverage.');
  process.exit(1);
}
console.log(`✔ minimal-ds: all ${Object.keys(EXPORTERS).length} exporters compile a 1-token, a late-bound-text, a 2-token (text, no page) and a 3-token design system cleanly across ${Object.keys(MODE_SHAPES).length} mode shapes × autoDark on/off (${files} files, no leaks; every anchor a fixture authors reaches the IR authored; the 1-token system gets a defaulted text.base and its full content side in every combo, with no failing contrast pair; a text.base alias read too late is never defaulted; a light text with no page is swapped into the other polarity, and only there; the 1-token and late-text Bootstrap Sass paths build against Bootstrap; authored dark/dim distinctly reach the IR where declared; autoDark reclassifies carry-over provenance without touching values, in the IR and in emitted output); polarity-axis-not-first is a build error; authored shadow/border/transition/typography composites reach every exporter parsed (${compFiles} files), and malformed ones name the member; DTCG object forms compile byte-identical to their string twin (${twinFiles} files) and ${Object.keys(MALFORMED).length + Object.keys(MALFORMED_MEMBERS).length} malformed values fail with TST1106; per-target mode subsets drop the excluded values with no \`dropped\` row and a bad subset is TST1308 (nothing emitted)`);
