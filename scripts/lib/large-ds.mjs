/**
 * A synthetic design system of any size, for the benchmark and the perf check.
 *
 * The four examples have tens of tokens; an enterprise system has thousands
 * (Carbon's full set, multi-brand overlays, per-component vocabularies). This
 * writes an Acme-shaped project of `tokens` tokens spread over `layers` base
 * files, with one, two or four mode combinations, a long alias chain, and
 * optionally many custom archetyped roles, the one input DERIVE scales with.
 *
 * The mix, by token count:
 *   - 45% option colors (`option.color.hue-<g>.<step>`), oklch literals;
 *   - 10% option dimensions (`option.size.s-<i>`);
 *   - 30% semantic color aliases (`semantic.color.app.<g>.<step>`) to an
 *     option color, each with a dark value in a mode-scoped layer;
 *   -  5% semantic dimensions (`semantic.layout.app.<i>`) aliasing an option
 *     dimension, each with a compact value in a mode-scoped layer;
 *   - 10% component aliases (`component.app.<g>.<prop>`) to a semantic token.
 * Plus the three anchors every derivation reads (brand, canvas, text), and two
 * alias chains of `chain` links each: `semantic.chain.authored.*` ends on an
 * option color (resolved during NORMALIZE), `semantic.chain.derived.*` ends on
 * `semantic.color.primary.solid-hover`, a slot DERIVE fills, so every link is
 * deferred and settled by the post-DERIVE pass. Both are listed head first,
 * so resolving the head walks the whole chain: the worst case.
 *
 * Everything is a function of the arguments: no randomness, no clock, so two
 * runs write byte-identical projects and a timing difference is the code's.
 * The project goes in a temp directory, never in the repository.
 *
 * Shared by scripts/bench.mjs and scripts/check-perf.mjs (issue #97).
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Every official exporter, one target each (packages/cli/src/main.js). */
export const TARGETS = ['shadcn', 'echarts', 'daisyui', 'bootstrap', 'storybook', 'css-variables', 'radix', 'primeng', 'mantine', 'chakra', 'mui'];

const MODES = {
  1: { 'color-scheme': { values: ['light'], default: 'light' } },
  2: { 'color-scheme': { values: ['light', 'dark'], default: 'light' } },
  4: {
    'color-scheme': { values: ['light', 'dark'], default: 'light' },
    density: { values: ['comfortable', 'compact'], default: 'comfortable' },
  },
};

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const PROPS = ['bg', 'fg', 'border', 'ring', 'shadow', 'accent', 'muted', 'hover', 'active', 'focus'];
const ARCHETYPES = ['brand', 'status', 'neutral'];

/** A deterministic, well-spread oklch colour for index `i`. */
function color(i, dark = false) {
  const l = dark ? 0.2 + ((i * 7) % 30) / 100 : 0.45 + ((i * 7) % 50) / 100;
  const c = ((i * 13) % 25) / 100;
  const h = (i * 47) % 360;
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h})`;
}

function put(tree, path, node) {
  const parts = path.split('.');
  let at = tree;
  for (const p of parts.slice(0, -1)) at = at[p] ??= {};
  at[parts.at(-1)] = node;
}

/**
 * Build the project in memory: `{ config, files }`, `files` mapping a relative
 * path to its JSON. `spec`: `{ tokens, layers, combos, chain, roles }`.
 */
export function largeDesignSystem({ tokens = 10000, layers = 20, combos = 4, chain = 10, roles = 0 } = {}) {
  if (!MODES[combos]) throw new Error(`combos must be 1, 2 or 4, got ${combos}`);
  const n = (share) => Math.max(1, Math.round(tokens * share));
  const optionColors = n(0.45);
  const optionSizes = n(0.1);
  const semanticColors = n(0.3);
  const semanticSizes = n(0.05);
  const componentAliases = Math.max(1, tokens - optionColors - optionSizes - semanticColors - semanticSizes);

  const colorPath = (i) => `option.color.hue-${Math.floor(i / STEPS.length)}.${STEPS[i % STEPS.length]}`;
  const sizePath = (i) => `option.size.s-${i}`;
  const semanticColorPath = (i) => `semantic.color.app.g${Math.floor(i / STEPS.length)}.${STEPS[i % STEPS.length]}`;
  const semanticSizePath = (i) => `semantic.layout.app.${i}`;

  // [path, token] in authoring order; base layers get contiguous slices of it.
  const base = [];
  const dark = [];
  const compact = [];
  for (let i = 0; i < optionColors; i++) base.push([colorPath(i), { $type: 'color', $value: color(i) }]);
  for (let i = 0; i < optionSizes; i++) base.push([sizePath(i), { $type: 'dimension', $value: `${((i % 64) + 1) * 0.125}rem` }]);
  for (let i = 0; i < semanticColors; i++) {
    const p = semanticColorPath(i);
    base.push([p, { $type: 'color', $value: `{${colorPath((i * 3) % optionColors)}}` }]);
    dark.push([p, { $type: 'color', $value: `{${colorPath((i * 3 + 1) % optionColors)}}` }]);
  }
  for (let i = 0; i < semanticSizes; i++) {
    const p = semanticSizePath(i);
    base.push([p, { $type: 'dimension', $value: `{${sizePath((i * 5) % optionSizes)}}` }]);
    compact.push([p, { $type: 'dimension', $value: `{${sizePath((i * 5 + 1) % optionSizes)}}` }]);
  }
  for (let i = 0; i < componentAliases; i++) {
    const prop = PROPS[i % PROPS.length];
    const target = prop === 'shadow' || prop === 'ring'
      ? semanticSizePath(i % semanticSizes)
      : semanticColorPath(i % semanticColors);
    const type = prop === 'shadow' || prop === 'ring' ? 'dimension' : 'color';
    base.push([`component.app.c${Math.floor(i / PROPS.length)}.${prop}`, { $type: type, $value: `{${target}}` }]);
  }

  // The anchors, the chains and the custom roles go in the first layer.
  const head = [
    ['semantic.color.primary.solid', { $type: 'color', $value: '{option.color.hue-0.600}' }],
    ['semantic.color.elevation.0.surface', { $type: 'color', $value: 'oklch(1 0 0)' }],
    ['semantic.color.text.base', { $type: 'color', $value: 'oklch(0.2 0.01 255)' }],
  ];
  dark.push(
    ['semantic.color.elevation.0.surface', { $type: 'color', $value: 'oklch(0.18 0.01 255)' }],
    ['semantic.color.text.base', { $type: 'color', $value: 'oklch(0.96 0.005 255)' }],
  );
  for (const [kind, end] of [['authored', '{option.color.hue-1.500}'], ['derived', '{semantic.color.primary.solid-hover}']]) {
    for (let i = 0; i < chain; i++) {
      head.push([`semantic.chain.${kind}.l${i}`, { $type: 'color', $value: i === chain - 1 ? end : `{semantic.chain.${kind}.l${i + 1}}` }]);
    }
  }
  for (let i = 0; i < roles; i++) {
    head.push([`semantic.color.custom-${i}`, {
      solid: { $type: 'color', $value: `{${colorPath((i * 11) % optionColors)}}` },
      $extensions: { 'transtyle.role': { archetype: ARCHETYPES[i % ARCHETYPES.length] } },
    }]);
  }

  const files = {};
  const tokenFiles = [];
  for (let k = 0; k < layers; k++) {
    const tree = {};
    if (k === 0) for (const [p, t] of head) put(tree, p, t);
    const from = Math.floor((k * base.length) / layers);
    const to = Math.floor(((k + 1) * base.length) / layers);
    for (const [p, t] of base.slice(from, to)) put(tree, p, t);
    const file = `tokens/layer-${String(k).padStart(3, '0')}.tokens.json`;
    files[file] = tree;
    tokenFiles.push(file);
  }
  const modeLayers = [];
  if (combos >= 2) {
    const tree = {};
    for (const [p, t] of dark) put(tree, p, t);
    files['modes/dark.tokens.json'] = tree;
    modeLayers.push({ files: 'modes/dark.tokens.json', mode: { 'color-scheme': 'dark' } });
  }
  if (combos === 4) {
    const tree = {};
    for (const [p, t] of compact) put(tree, p, t);
    files['modes/compact.tokens.json'] = tree;
    modeLayers.push({ files: 'modes/compact.tokens.json', mode: { density: 'compact' } });
  }

  const config = {
    name: `large-ds-${tokens}`,
    tokens: [...tokenFiles, ...modeLayers],
    modes: MODES[combos],
    derivation: { rules: 'standard@1', autoDark: false },
    targets: Object.fromEntries(TARGETS.map((t) => [t, { output: `dist/${t}` }])),
    check: { failOn: 'error' },
  };
  return { config, files };
}

/** Write the project to a fresh temp directory and return its path. */
export function writeLargeDesignSystem(spec) {
  const { config, files } = largeDesignSystem(spec);
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-large-ds-'));
  writeFileSync(join(dir, 'transtyle.config.json'), JSON.stringify(config, null, 2) + '\n');
  for (const [file, tree] of Object.entries(files)) {
    mkdirSync(join(dir, file, '..'), { recursive: true });
    writeFileSync(join(dir, file), JSON.stringify(tree, null, 2) + '\n');
  }
  return dir;
}
