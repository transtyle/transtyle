#!/usr/bin/env node
/**
 * AL3 for Material UI: extract MUI's theming surface into a machine-readable
 * inventory — the MUI twin of packages/exporter-mantine/tools/extract-surface.mjs
 * and packages/exporter-chakra/tools/extract-surface.mjs.
 *
 * Source of truth is `createTheme()` from the installed `@mui/material` (a
 * demo dependency, never a package dependency), called the way this exporter
 * calls it: CSS-variables mode, both colour schemes. The inventory has two
 * halves, like Mantine's:
 *
 *   - variables / light / dark — every CSS variable `generateStyleSheets()`
 *               writes, per block: `:root` (spacing, shape, shadows, z-index,
 *               the typography shorthands) and the two scheme blocks (the
 *               palette, the per-component palette tokens, `opacity`, and the
 *               dark scheme's `overlays`).
 *   - theme   — the theme leaves no variable carries, which `createTheme()`
 *               reads anyway: the typography variants field by field, the
 *               transitions, the breakpoints, the opt-in focus ring
 *               (`focusVisible`, listed as MUI resolves it when turned on),
 *               `motion.reducedMotion`, and the two palette parameters MUI
 *               derives shades and contrast text with (`tonalOffset`,
 *               `contrastThreshold`). `components.*.styleOverrides` is
 *               open-ended and stays out: the slots of it the exporter writes
 *               have their own rows.
 *
 * Each entry records `path`, the ThemeOptions leaf that sets it when there is
 * one (`colorSchemes.light.palette.primary.main`, `shadows.3`), and `from`,
 * what MUI computes its value from. `from` is measured, not read from MUI's
 * source: every leaf is changed in turn in the options, the theme is created
 * again, and the entries whose value moved depend on it. A dependency that
 * only reaches an entry through another settable leaf (`typography.fontSize`
 * reaches `--mui-font-h1` through `typography.h1.fontSize`) is checked once
 * more with that leaf pinned, and dropped if the entry no longer moves, so
 * `from` lists what an entry reads directly. The `var(--mui-…)` a value
 * references are added too, which is how a per-component palette token
 * records that MUI points it at another palette variable
 * (`--mui-palette-AppBar-defaultBg` is `var(--mui-palette-grey-100)`): such an
 * entry has `kind: "reference"`, one whose value MUI writes out has
 * `kind: "literal"` (`--mui-palette-Slider-primaryTrack`, lightened from
 * `primary.main` at creation). `createTheme()` is a pure function, so the
 * extraction is deterministic: no timestamps, sorted, one entry per line.
 *
 * Usage: node tools/extract-surface.mjs [--write]   (from packages/exporter-mui)
 * Exported for scripts/check-coverage-bar.mjs, which regenerates and diffs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

const SCHEMES = ['light', 'dark'];
const FAMILIES = ['theme', 'variables', 'light', 'dark'];
/** The options this exporter's theme starts from (the focus ring is opt-in: turned on to list its leaves). */
const BASE = { cssVariables: { colorSchemeSelector: '[data-color-scheme="%s"]' }, colorSchemes: { light: true, dark: true }, focusVisible: true };
/** Option roots whose value is replaced whole, not merged: a probe passes the full array or object. */
const WHOLE = ['shadows', 'breakpoints.values'];
/** Scheme leaves that are the scheme's identity or MUI's machinery, not a value a theme sets. */
const SCHEME_SKIP = new Set(['palette.mode']);
/** Non-variable theme leaves: [root path, keep(leafPath, value)]. */
const THEME_ROOTS = [
  ['typography', () => true],
  ['transitions.duration', () => true],
  ['transitions.easing', () => true],
  ['breakpoints.values', () => true],
  // `boxShadow` only wires MUI's private `--_focusVisible-*` variables.
  ['focusVisible', (path) => path !== 'focusVisible.boxShadow'],
  ['motion', () => true],
];
/**
 * Two probe colours, one dark and one light: MUI picks contrast text by
 * luminance, so a single probe can land on the same black or white as the
 * default and hide the dependency.
 */
const PROBE_COLORS = ['#123456', '#fedcba'];

const isColor = (v) => typeof v === 'string' && /^(#|rgba?\(|hsla?\(|var\(--mui-)/.test(v);

/** Every primitive leaf under `obj`, as [dotted path, value]; functions are skipped. */
function leaves(obj, prefix) {
  const out = [];
  for (const [k, v] of Object.entries(obj ?? {})) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'function') continue;
    if (v && typeof v === 'object') out.push(...leaves(v, path));
    else if (v !== undefined) out.push([path, v]);
  }
  return out;
}

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) {
    if (o[k] === true || o[k] == null || typeof o[k] !== 'object') o[k] = {};
    o = o[k];
  }
  o[keys.at(-1)] = value;
}

const clone = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);

/** Different but valid values for one leaf. */
function probeValues(path, value) {
  if (typeof value === 'number') return [Number.isInteger(value) ? value + 1 : Math.round(value * 5000) / 10000];
  if (typeof value === 'boolean') return [!value];
  if (path.startsWith('colorSchemes.') && path.includes('.palette.') && isColor(value)) {
    return PROBE_COLORS.filter((c) => c !== value.toLowerCase());
  }
  if (path === 'motion.reducedMotion') return [value === 'always' ? 'system' : 'always'];
  const length = /^(-?[\d.]+)(px|rem|em)$/.exec(String(value));
  if (length) return [`${Number(length[1]) + 1}${length[2]}`];
  return [`${value} probe`];
}

/** The options that set `path` to `value` over BASE (whole arrays and objects where MUI replaces them). */
function optionsWith(base, sets) {
  const options = clone({ ...BASE, colorSchemes: { light: {}, dark: {} } });
  for (const s of SCHEMES) options.colorSchemes[s] = true;
  for (const [path, value] of sets) {
    const whole = WHOLE.find((w) => path.startsWith(`${w}.`));
    if (whole) {
      if (get(options, whole) === undefined) setPath(options, whole, clone(get(base, whole)));
      setPath(options, path, value);
      continue;
    }
    const overlay = /^colorSchemes\.(\w+)\.overlays\.\d+$/.exec(path);
    if (overlay) {
      const at = `colorSchemes.${overlay[1]}.overlays`;
      if (!Array.isArray(get(options, at))) setPath(options, at, clone(get(base, at)));
    }
    setPath(options, path, value);
  }
  // A palette colour MUI ships (`primary` … `success`) is a literal ramp, but
  // one passed in the options gets its missing shades computed from `main`
  // (and MUI refuses one without `main`). A probe of one shade therefore
  // passes MUI's other shades as they are, so it moves that shade alone.
  for (const s of SCHEMES) {
    for (const [key, color] of Object.entries(options.colorSchemes[s]?.palette ?? {})) {
      const own = base.colorSchemes[s].palette[key];
      if (own?.main === undefined || !color || typeof color !== 'object') continue;
      for (const shade of ['main', 'light', 'dark', 'contrastText']) color[shade] ??= own[shade];
    }
  }
  return options;
}

/** `{ id: value }` for every variable (`<block>.<name>`) and every theme leaf (`theme.<path>`) of a created theme. */
function snapshot(theme, themePaths) {
  const out = {};
  const [root, light, dark] = theme.generateStyleSheets().map((sheet) => Object.values(sheet)[0]);
  for (const [block, vars] of [['variables', root], ['light', light], ['dark', dark]]) {
    for (const [name, value] of Object.entries(vars ?? {})) if (name.startsWith('--')) out[`${block}.${name}`] = String(value);
  }
  for (const path of themePaths) {
    const v = get(theme, path);
    if (v !== undefined && typeof v !== 'function') out[`theme.${path}`] = String(v);
  }
  return out;
}

export async function extractSurface() {
  const { createTheme } = await import('@mui/material/styles');
  const version = JSON.parse(readFileSync(join(repoRoot, 'node_modules', '@mui', 'material', 'package.json'), 'utf8')).version;
  const base = createTheme(BASE);

  // ---- the input leaves: every settable leaf, with the entry it is ----
  const varName = (path) => `--mui-${path.replaceAll('.', '-')}`;
  const themePaths = [];
  for (const [rootPath, keep] of THEME_ROOTS) {
    for (const [path] of leaves(get(base, rootPath), rootPath)) if (keep(path)) themePaths.push(path);
  }
  for (const s of SCHEMES) {
    for (const k of ['contrastThreshold', 'tonalOffset']) themePaths.push(`colorSchemes.${s}.palette.${k}`);
  }
  const baseline = snapshot(base, themePaths);

  /** [{ id, path (option), value }] — the leaves a probe changes. */
  const inputs = [];
  for (const s of SCHEMES) {
    for (const [path, value] of leaves(base.colorSchemes[s], '')) {
      if (SCHEME_SKIP.has(path)) continue;
      const id = `${s}.${varName(path)}`;
      if (id in baseline) inputs.push({ id, path: `colorSchemes.${s}.${path}`, value });
    }
  }
  for (const rootPath of ['spacing', 'shape', 'shadows', 'zIndex', 'font']) {
    const node = rootPath === 'spacing' ? { spacing: base.spacing(1) } : { [rootPath]: base[rootPath] };
    for (const [path, value] of leaves(node, '')) {
      const id = `variables.${varName(path)}`;
      if (id in baseline) inputs.push({ id, path, value: rootPath === 'spacing' ? 8 : value });
    }
  }
  for (const path of themePaths) inputs.push({ id: `theme.${path}`, path, value: get(base, path) });

  const changed = (a, b) => Object.keys(b).filter((id) => a[id] !== b[id]);
  const probe = (sets) => snapshot(createTheme(optionsWith(base, sets)), themePaths);

  // ---- 1. what each leaf moves ----
  const affects = new Map(); // input id -> Set of entry ids
  const settable = new Map(); // entry id -> option path
  for (const input of inputs) {
    const moved = new Set(probeValues(input.path, input.value).flatMap((v) => changed(baseline, probe([[input.path, v]]))));
    if (!moved.has(input.id)) continue; // MUI recomputes it whatever the options say: not settable
    settable.set(input.id, input);
    moved.delete(input.id);
    affects.set(input.id, moved);
  }

  // ---- 2. direct dependencies only ----
  const from = new Map(Object.keys(baseline).map((id) => [id, new Set()]));
  for (const [dep, moved] of affects) for (const id of moved) from.get(id).add(dep);
  for (const [id, deps] of from) {
    for (const dep of [...deps]) {
      const via = [...deps].filter((e) => e !== dep && affects.get(dep).has(e) && settable.has(e));
      if (!via.length) continue;
      const input = settable.get(dep);
      const pinned = via.map((e) => [settable.get(e).path, settable.get(e).value]);
      const still = probeValues(input.path, input.value).some((v) => probe([...pinned, [input.path, v]])[id] !== baseline[id]);
      if (!still) deps.delete(dep);
    }
  }

  // ---- 3. the variables a value references ----
  const blockOf = (id) => id.slice(0, id.indexOf('.'));
  const refsOf = (id) =>
    [...baseline[id].matchAll(/var\((--mui-[\w-]+)/g)].flatMap(([, name]) => {
      const block = blockOf(id);
      if (block !== 'theme' && `${block}.${name}` in baseline) return [`${block}.${name}`];
      if (`variables.${name}` in baseline) return [`variables.${name}`];
      // Defined per scheme only: a root value or a theme leaf reads both.
      return SCHEMES.map((s) => `${s}.${name}`).filter((k) => k in baseline);
    });

  const entries = Object.keys(baseline).map((id) => {
    const block = blockOf(id);
    const deps = new Set([...from.get(id), ...refsOf(id)].filter((d) => d !== id));
    return {
      id,
      block,
      ...(settable.has(id) ? { path: settable.get(id).path } : {}),
      value: baseline[id],
      ...(block === 'theme' ? {} : { kind: /var\(--mui-/.test(baseline[id]) ? 'reference' : 'literal' }),
      ...(deps.size ? { from: [...deps].sort() } : {}),
    };
  });
  const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const list = FAMILIES.flatMap((f) => entries.filter((e) => e.block === f).sort(byId));
  const families = {};
  for (const f of FAMILIES) families[f] = list.filter((e) => e.block === f).length;
  return {
    muiVersion: version,
    generatedBy: 'packages/exporter-mui/tools/extract-surface.mjs',
    counts: {
      total: list.length,
      theme: families.theme,
      variables: list.length - families.theme,
      settable: list.filter((e) => e.path).length,
      references: list.filter((e) => e.kind === 'reference').length,
      families,
    },
    entries: list,
  };
}

/**
 * The inventory as written to disk: pretty-printed like the others, except
 * that each entry sits on one line, so a diff names the entries that changed.
 */
export function formatInventory(inventory) {
  const { entries, ...head } = inventory;
  const top = JSON.stringify(head, null, 2).replace(/\n}$/, '');
  return `${top},\n  "entries": [\n${entries.map((e) => `    ${JSON.stringify(e)}`).join(',\n')}\n  ]\n}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const inventory = await extractSurface();
  if (process.argv.includes('--write')) {
    const out = join(here, '..', 'surface-inventory.json');
    writeFileSync(out, formatInventory(inventory));
    console.log(
      `wrote ${out} (@mui/material@${inventory.muiVersion}: ${inventory.counts.total} entries, ${inventory.counts.variables} variables, ${inventory.counts.theme} theme leaves)`,
    );
  } else {
    console.log(JSON.stringify(inventory.counts, null, 2));
  }
}
