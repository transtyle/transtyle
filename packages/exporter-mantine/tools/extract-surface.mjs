#!/usr/bin/env node
/**
 * AL3 for Mantine: extract Mantine's theming surface into a machine-readable
 * inventory — the Mantine twin of packages/exporter-primeng/tools/extract-surface.mjs.
 *
 * Mantine's surface has two halves, and the inventory holds both:
 *
 *   - theme   — every leaf of `DEFAULT_THEME`, the object `createTheme()`
 *               overrides, minus functions (`variantColorResolver`) and the
 *               open-ended `components` / `other` maps. A colour tuple is one
 *               leaf, not ten.
 *   - variables / light / dark — every CSS variable `defaultCssVariablesResolver`
 *               writes, per block, the three blocks a `cssVariablesResolver`
 *               returns and Mantine merges over its own.
 *
 * Palettes are collapsed so the inventory does not grow with Mantine's
 * fourteen default palettes: `--mantine-color-pink-filled` … `-orange-filled`
 * are one entry, `--mantine-color-<color>-filled`; their shades are one entry,
 * `--mantine-color-<color>-<shade>`; `colors.pink` … `colors.orange` are
 * `colors.<color>`. A palette stays a named entry (its tuple and its shades)
 * when Mantine's own resolver reads it for something other than its own
 * variables: `gray` and `dark` for the page, `red` for the error colour,
 * `teal` for the success colour. That list is found below, not written by
 * hand: collapsing those would let "this theme sets some palettes" stand for
 * "it sets the one the page reads".
 *
 * Each variable records `from`, what its value is computed from — the Mantine
 * counterpart of PrimeNG's `{ref}`. It is measured, not read from Mantine's
 * source: every theme leaf is changed in turn on a copy of `DEFAULT_THEME` and
 * the resolver is re-run (a variable whose value changes depends on that
 * leaf), and the `var(--…)` the value references are added. The resolver is a
 * pure function, so this is deterministic.
 *
 * Usage: node tools/extract-surface.mjs [--write]   (from packages/exporter-mantine)
 * Exported for scripts/check-coverage-bar.mjs, which regenerates and diffs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collapseVariable } from '../src/surface-coverage.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

const BLOCKS = ['variables', 'light', 'dark'];
/** Theme keys that are not part of the themable surface: functions are skipped by type; these are open maps. */
const OPEN_MAPS = new Set(['components', 'other']);
const PROBE_HEX = '#123456';

/** Copy a theme, keeping its functions (structuredClone refuses them). */
function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]));
  }
  return value;
}

/** Every themable leaf path of the theme (arrays are leaves: a tuple is one value). */
function leaves(theme) {
  const out = [];
  const walk = (obj, prefix) => {
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (!prefix && OPEN_MAPS.has(k)) continue;
      if (typeof v === 'function') continue;
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, path);
      else out.push({ path, value: v });
    }
  };
  walk(theme, '');
  return out;
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k];
  o[keys.at(-1)] = value;
}

/** A different but valid value for one theme leaf. */
function probeValue(theme, value) {
  if (Array.isArray(value)) return value.map(() => PROBE_HEX);
  if (typeof value === 'boolean') return !value;
  if (typeof value === 'number') return Number.isInteger(value) ? (value >= 9 ? value - 1 : value + 1) : value + 0.1;
  if (typeof value === 'string') {
    const otherKey = (keys) => keys.find((k) => k !== value);
    if (value in theme.colors) return otherKey(Object.keys(theme.colors));
    if (value in theme.radius) return otherKey(Object.keys(theme.radius));
    if (/^#[0-9a-f]{3,8}$/i.test(value)) return PROBE_HEX;
    return `${value}-probe`;
  }
  return 'probe';
}

/** Run the resolver; keys are `<block>.<raw variable name>`. */
function resolve(resolver, theme) {
  const out = resolver(theme);
  const raw = {};
  for (const block of BLOCKS) for (const [name, value] of Object.entries(out[block] ?? {})) raw[`${block}.${name}`] = String(value);
  return raw;
}

const split = (key) => {
  const dot = key.indexOf('.');
  return [key.slice(0, dot), key.slice(dot + 1)];
};

export async function extractSurface() {
  const mantine = await import('@mantine/core');
  const base = mantine.DEFAULT_THEME;
  const resolver = mantine.defaultCssVariablesResolver;
  const version = JSON.parse(
    readFileSync(join(repoRoot, 'node_modules', '@mantine', 'core', 'package.json'), 'utf8'),
  ).version;
  const palettes = Object.keys(base.colors);
  const baseline = resolve(resolver, base);

  // 1. Theme dependencies: change one leaf, re-run the resolver, see what moved.
  const themeLeaves = leaves(base);
  const reachedBy = new Map(); // raw key -> Set of theme paths
  for (const { path, value } of themeLeaves) {
    const theme = clone(base);
    setPath(theme, path, probeValue(base, value));
    const probed = resolve(resolver, theme);
    for (const key of new Set([...Object.keys(baseline), ...Object.keys(probed)])) {
      if (baseline[key] === probed[key]) continue;
      if (!reachedBy.has(key)) reachedBy.set(key, new Set());
      reachedBy.get(key).add(path);
    }
  }

  // 2. CSS dependencies: the `var(--…)` a value references, resolved to the
  //    block that defines it (the same block, else `variables`, else both
  //    schemes). A reference the theme value itself carries (`fontSizes.xs` is
  //    `calc(0.75rem * var(--mantine-scale))`) is not one: a theme that sets
  //    that leaf replaces the value, reference and all.
  const valueOf = new Map(themeLeaves.map(({ path, value }) => [path, String(value)]));
  const refsOf = (key) => {
    const [block] = split(key);
    const carried = [...(reachedBy.get(key) ?? [])].map((path) => valueOf.get(path)).join(' ');
    return [...baseline[key].matchAll(/var\((--[\w-]+)\)/g)]
      .filter(([ref]) => !carried.includes(ref))
      .flatMap(([, name]) => {
        if (`${block}.${name}` in baseline) return [`${block}.${name}`];
        if (`variables.${name}` in baseline) return [`variables.${name}`];
        // Defined per scheme only: a `variables` value reads both.
        return ['light', 'dark'].map((b) => `${b}.${name}`).filter((k) => k in baseline);
      });
  };

  // 3. A palette is kept by name when something other than its own variables
  //    reads it: `gray` and `dark` for the page, `red` for the error colour…
  //    Variables that follow `primaryColor` read whichever palette it names,
  //    which is primaryColor's doing, not the palette's.
  const viaPrimary = (key) => reachedBy.get(key)?.has('primaryColor');
  const reads = (key, palette) =>
    reachedBy.get(key)?.has(`colors.${palette}`) ||
    refsOf(key).some((ref) => split(ref)[1].startsWith(`--mantine-color-${palette}-`));
  const named = palettes.filter((p) =>
    Object.keys(baseline).some(
      (key) => !split(key)[1].startsWith(`--mantine-color-${p}-`) && !viaPrimary(key) && reads(key, p),
    ),
  );
  const collapsed = palettes.filter((p) => !named.includes(p));

  const themeId = (path) => {
    const m = /^colors\.(.+)$/.exec(path);
    return m && collapsed.includes(m[1]) ? 'theme.colors.<color>' : `theme.${path}`;
  };
  const varId = (key) => {
    const [block, name] = split(key);
    return `${block}.${collapseVariable(name, collapsed, named)}`;
  };

  const theme = new Map();
  for (const { path, value } of themeLeaves) {
    const id = themeId(path);
    if (theme.has(id)) continue;
    theme.set(
      id,
      id === 'theme.colors.<color>'
        ? { id, block: 'theme', path: 'colors.<color>', kind: 'palette', members: collapsed.length }
        : {
            id,
            block: 'theme',
            path,
            kind: Array.isArray(value) ? 'palette' : typeof value,
            value: Array.isArray(value) ? value.join(' ') : String(value),
          },
    );
  }

  const variables = new Map();
  for (const key of Object.keys(baseline)) {
    const id = varId(key);
    if (!variables.has(id)) {
      const [block, name] = split(id);
      variables.set(id, { id, block, name, members: 0, from: new Set() });
    }
    const v = variables.get(id);
    v.members++;
    for (const path of reachedBy.get(key) ?? []) v.from.add(themeId(path));
    for (const ref of refsOf(key)) if (varId(ref) !== id) v.from.add(varId(ref));
  }

  const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const entries = [
    ...[...theme.values()].sort(byId),
    ...BLOCKS.flatMap((b) =>
      [...variables.values()]
        .filter((v) => v.block === b)
        .sort(byId)
        .map((v) => ({ ...v, from: [...v.from].sort() })),
    ),
  ];
  const families = {};
  for (const e of entries) families[e.block] = (families[e.block] ?? 0) + 1;
  return {
    mantineVersion: version,
    generatedBy: 'packages/exporter-mantine/tools/extract-surface.mjs',
    palettes: { collapsed, named },
    counts: {
      total: entries.length,
      theme: families.theme,
      variables: entries.length - families.theme,
      constants: entries.filter((e) => e.block !== 'theme' && !e.from.length).length,
      families,
    },
    entries,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const inventory = await extractSurface();
  if (process.argv.includes('--write')) {
    const out = join(here, '..', 'surface-inventory.json');
    writeFileSync(out, JSON.stringify(inventory, null, 2) + '\n');
    console.log(
      `wrote ${out} (@mantine/core@${inventory.mantineVersion}: ${inventory.counts.total} entries, ${inventory.counts.theme} theme keys, ${inventory.counts.variables} variables)`,
    );
  } else {
    console.log(JSON.stringify({ palettes: inventory.palettes, counts: inventory.counts }, null, 2));
  }
}
