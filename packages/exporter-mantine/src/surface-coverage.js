/**
 * AL3 for Mantine: classify every entry of Mantine's theming surface
 * (surface-inventory.json) against what this exporter emits. The exporter
 * turns it into report.json rows; scripts/check-coverage-bar.mjs reconciles
 * those rows against the inventory, so the two read the same classification.
 *
 * Mantine is neither per-variable like Bootstrap nor per-family like PrimeNG:
 * a theme key and the CSS variable Mantine computes from it are two entries,
 * and the variables mostly point at each other (`--mantine-color-dimmed` is
 * `var(--mantine-color-gray-6)`). So an entry is one of three things:
 *
 *   set     — this exporter writes it: a leaf of the emitted `createTheme()`
 *             object, or a variable the emitted `cssVariablesResolver` returns.
 *   follows — not written, but everything Mantine computes it from (its
 *             `from` in the inventory: theme keys and referenced variables) is
 *             set or follows in turn, so Mantine derives it from this theme.
 *             `--mantine-font-size-xs` follows `fontSizes.xs`.
 *   default — something it is computed from stays Mantine's, so the entry
 *             keeps Mantine's value. Every one is reported on its own row with
 *             the reason (REASONS below). An entry with no reason of its own
 *             gets UNMAPPED, which check:coverage-bar refuses on the examples.
 */

import { readFileSync } from 'node:fs';

let inventory;
/** The checked-in inventory, read on first use (the extractor imports this module before the file exists). */
export function INVENTORY() {
  inventory ??= JSON.parse(readFileSync(new URL('../surface-inventory.json', import.meta.url), 'utf8'));
  return inventory;
}

/**
 * Collapse one resolver variable name to its inventory name. `palettes` are
 * the colour names that collapse to `<color>`; `named` are the palettes the
 * inventory keeps by name. A per-colour variant (`-filled`, `-light`, …)
 * always collapses: it is the same variable for every palette. Shades
 * collapse unless the palette is named, because the page reads
 * `--mantine-color-gray-6`, not any palette's 6. Used by the extractor on
 * Mantine's defaults and here on what the exporter emits.
 *
 * Mantine's names are ambiguous once a palette name contains a hyphen: with a
 * `primary-light` tuple next to a `primary` virtual colour,
 * `--mantine-color-primary-light-color` parses both ways. `suffixes`, the
 * variant suffixes the inventory knows, settles it: the parse must end in one.
 */
export function collapseVariable(name, palettes, named = [], suffixes = null) {
  if (/^--mantine-primary-color-\d$/.test(name)) return '--mantine-primary-color-<shade>';
  const prefix = '--mantine-color-';
  if (!name.startsWith(prefix)) return name;
  const rest = name.slice(prefix.length);
  const candidates = [...palettes, ...named].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  for (const palette of candidates) {
    if (!rest.startsWith(`${palette}-`)) continue;
    const tail = rest.slice(palette.length + 1);
    if (/^\d$/.test(tail)) {
      return named.includes(palette) ? `${prefix}${palette}-<shade>` : `${prefix}<color>-<shade>`;
    }
    if (!suffixes || suffixes.includes(tail)) return `${prefix}<color>-${tail}`;
  }
  return name;
}

const behaviour = (what) => ({
  cls: 'unsupported',
  meaning: 'target.config',
  note: `${what}: a behaviour switch, not a design value, so no catalog slot`,
});
const palette = (name, variable, slot) => ({
  cls: 'unsupported',
  meaning: 'color.named-palette',
  note: `Mantine's own ${name} palette, kept: the page reads it only for ${variable}, which this theme sets from ${slot}; the design system's roles are named colours of their own`,
});

/**
 * Why an entry keeps Mantine's value, keyed by inventory id. `cls` is
 * `unsupported` (Mantine has the slot, the catalog has no concept for it) or
 * `dropped` (the catalog has it, Mantine does not read it); `slot` names the
 * catalog side when there is one; `meaning` is the report's catalog-signal key
 * (docs/findings/catalog-meanings.json) for an `unsupported` one. An entry on Mantine's default with no
 * reason here gets UNMAPPED, which check:coverage-bar refuses on the examples.
 */
export const REASONS = {
  'theme.activeClassName': behaviour("the class Mantine adds for its pressed-state transform"),
  'theme.focusClassName': behaviour("a class that replaces Mantine's focus class (the ring itself has no variable: see the focus ring row)"),
  'theme.focusRing': behaviour('when focus outlines show (auto, always, never)'),
  'theme.respectReducedMotion': behaviour("whether Mantine turns its transitions off under prefers-reduced-motion"),
  'theme.cursorType': behaviour('the cursor on checkboxes, radios and switches (default or pointer)'),
  'variables.--mantine-cursor-type': behaviour('the cursor on checkboxes, radios and switches, from cursorType'),
  'theme.fontSmoothing': behaviour('whether Mantine turns antialiased font smoothing on'),
  'variables.--mantine-webkit-font-smoothing': behaviour('font smoothing, from fontSmoothing'),
  'variables.--mantine-moz-font-smoothing': behaviour('font smoothing, from fontSmoothing'),
  'theme.headings.textWrap': { cls: 'unsupported', meaning: 'type.text-wrap', note: 'text-wrap for headings (wrap, balance, pretty): the catalog has no text-wrap slot' },
  'variables.--mantine-heading-text-wrap': { cls: 'unsupported', meaning: 'type.text-wrap', note: 'text-wrap for headings, from headings.textWrap: the catalog has no text-wrap slot' },
  'theme.luminanceThreshold': {
    cls: 'unsupported',
    meaning: 'target.config',
    note: "the luminance cut-off autoContrast uses to pick black or white text; every role's contrast colour is set from its on-solid, so the threshold only decides Mantine's own palettes",
  },
  'theme.scale': {
    cls: 'unsupported',
    meaning: 'target.config',
    note: "a multiplier Mantine's own sizes are written against (calc(… * var(--mantine-scale))); this theme's sizes are emitted as authored and do not reference it, so it stays 1",
  },
  'variables.--mantine-scale': {
    cls: 'unsupported',
    meaning: 'target.config',
    note: "from scale, which stays 1: this theme's sizes do not reference it",
  },
  'theme.defaultGradient.deg': { cls: 'unsupported', meaning: 'color.gradient', note: "the angle of Mantine's gradient variant: the catalog has no gradient" },
  'theme.defaultGradient.from': { cls: 'unsupported', meaning: 'color.gradient', note: "the start colour of Mantine's gradient variant: the catalog has no gradient" },
  'theme.defaultGradient.to': { cls: 'unsupported', meaning: 'color.gradient', note: "the end colour of Mantine's gradient variant: the catalog has no gradient" },
  'theme.white': {
    cls: 'unsupported',
    meaning: 'color.named-palette',
    slot: 'semantic.color.elevation.1.surface',
    note: "Mantine's white stays #fff in the theme, because it is also the icon colour on filled controls; the light scheme's raised surfaces are set through --mantine-color-white in the resolver instead (see that row)",
  },
  'theme.black': {
    cls: 'unsupported',
    meaning: 'color.named-palette',
    note: "Mantine's black, kept: the light-scheme colours it seeds are set directly (--mantine-color-text, -bright, -default-color), so it is left where Mantine's stylesheet names black itself",
  },
  'variables.--mantine-color-black': {
    cls: 'unsupported',
    meaning: 'color.named-palette',
    note: "from black, kept: the light-scheme colours that read it are set directly, so it is left where Mantine's stylesheet names black itself",
  },
  'theme.colors.red': palette('red', '--mantine-color-error', 'danger.text'),
  'variables.--mantine-color-red-<shade>': palette('red', '--mantine-color-error', 'danger.text'),
  'theme.colors.teal': palette('teal', '--mantine-color-success', 'success.text'),
  'variables.--mantine-color-teal-<shade>': palette('teal', '--mantine-color-success', 'success.text'),
  'theme.fontFamilyMonospace': {
    cls: 'unsupported',
    slot: 'semantic.font.mono',
    note: "set whenever the design system defines font.mono; this one does not, so Mantine's monospace stack stays",
  },
  'variables.--mantine-font-family-monospace': {
    cls: 'unsupported',
    slot: 'semantic.font.mono',
    note: "from fontFamilyMonospace, set whenever the design system defines font.mono; this one does not, so Mantine's monospace stack stays",
  },
  'light.--mantine-color-scheme': { cls: 'unsupported', meaning: 'target.config', note: "the scheme's own name (light), a constant Mantine writes for color-scheme: not a design value" },
  'dark.--mantine-color-scheme': { cls: 'unsupported', meaning: 'target.config', note: "the scheme's own name (dark), a constant Mantine writes for color-scheme: not a design value" },
  ...Object.fromEntries(
    ['app', 'modal', 'popover', 'overlay', 'max'].map((layer) => [
      `variables.--mantine-z-index-${layer}`,
      {
        cls: 'dropped',
        slot: 'semantic.z.*',
        note: "Mantine components take their z-index from getDefaultZIndex() in JS and its stylesheet does not read this variable, so setting it would change nothing (see the z-index ladder row)",
      },
    ]),
  ),
};

/**
 * The reason for an entry with none of its own: the exporter maps it, but this
 * design system defines nothing it is mapped from (a minimal one with no type
 * scale, say), so a user's report never carries a silent row. The four
 * examples author everything a theme maps, so check:coverage-bar refuses this
 * note there: an entry new in a Mantine upgrade still has to get a real reason.
 */
export const UNMAPPED = {
  cls: 'unsupported',
  note: "this design system defines nothing the exporter maps to this entry, so Mantine's value stays",
};

/** For a design system with no dark scheme, every entry that reads the dark scheme stays Mantine's. */
const NO_DARK = {
  cls: 'dropped',
  note: "the design system publishes no dark scheme, so this keeps Mantine's dark value; usage.md forces the provider to light, where it never shows",
};
const DARK_SOURCES = new Set(['theme.colors.dark', 'variables.--mantine-color-dark-<shade>']);

const leaf = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/**
 * Classify the inventory against the emitted theme and resolver.
 * `emitted` is `{ theme, colorNames, blocks: { variables, light, dark }, hasDark }`:
 * the `createTheme()` object, every colour name it defines (tuples and
 * virtual colours), the resolver's three blocks, and whether the design
 * system has a dark scheme.
 */
export function classifySurface(inv, emitted) {
  const { named, collapsed } = inv.palettes;
  const extra = emitted.colorNames.filter((n) => !named.includes(n));
  const suffixes = inv.entries
    .map((e) => /^--mantine-color-<color>-(?!<shade>)(.+)$/.exec(e.name ?? '')?.[1])
    .filter(Boolean);
  const written = new Set();
  for (const [block, vars] of Object.entries(emitted.blocks)) {
    for (const name of Object.keys(vars ?? {})) {
      written.add(`${block}.${collapseVariable(name, [...collapsed, ...extra], named, suffixes)}`);
    }
  }
  const isSet = (entry) => {
    if (entry.block === 'theme') {
      if (entry.path === 'colors.<color>') return extra.length > 0;
      return leaf(emitted.theme, entry.path) !== undefined;
    }
    // A `variables` entry the resolver writes per scheme is set too
    // (`--mantine-color-white`, which the exporter scopes to light).
    if (entry.block === 'variables') {
      return ['variables', 'light', 'dark'].some((b) => written.has(`${b}.${entry.name}`));
    }
    return written.has(entry.id);
  };

  const byId = new Map(inv.entries.map((e) => [e.id, e]));
  const status = new Map();
  const statusOf = (id, seen = new Set()) => {
    if (status.has(id)) return status.get(id);
    const entry = byId.get(id);
    let s = 'default';
    if (!entry) return s;
    if (isSet(entry)) s = 'set';
    else if (entry.from?.length && !seen.has(id)) {
      seen.add(id);
      if (entry.from.every((dep) => statusOf(dep, seen) !== 'default')) s = 'follows';
    }
    status.set(id, s);
    return s;
  };
  for (const entry of inv.entries) statusOf(entry.id);

  // Without a dark scheme, the dark block and whatever reads it stay Mantine's
  // for that one reason, not for a reason of their own.
  const noDark = new Map();
  const readsDark = (id) => {
    if (emitted.hasDark || status.get(id) !== 'default') return false;
    if (noDark.has(id)) return noDark.get(id);
    noDark.set(id, false);
    const entry = byId.get(id);
    const result =
      entry.block === 'dark' || DARK_SOURCES.has(id) || (entry.from ?? []).some((dep) => readsDark(dep));
    noDark.set(id, result);
    return result;
  };
  return inv.entries.map((entry) => {
    const s = status.get(entry.id);
    const reason = s === 'default' ? (REASONS[entry.id] ?? (readsDark(entry.id) ? NO_DARK : UNMAPPED)) : null;
    return { entry, status: s, reason };
  });
}

/**
 * report.json rows: one summary row per inventory family (`theme`, and the
 * resolver's `variables`, `light`, `dark` blocks) whose three counts add up to
 * the family's size, one row per entry on Mantine's default with its reason,
 * and a totals row.
 */
export function surfaceRows(emitted, inv = INVENTORY()) {
  const classified = classifySurface(inv, emitted);
  const rows = [];
  const totals = { set: 0, follows: 0, default: 0 };
  for (const family of Object.keys(inv.counts.families)) {
    const members = classified.filter((c) => c.entry.block === family);
    const n = { set: 0, follows: 0, default: 0 };
    for (const c of members) n[c.status]++;
    for (const k of Object.keys(totals)) totals[k] += n[k];
    rows.push({
      variable: `${family}.* (${members.length} entries)`,
      slot: `${n.set} set · ${n.follows} follow · ${n.default} on Mantine's default`,
      class: n.set ? 'native' : n.follows > n.default ? 'derived' : 'unsupported',
      note: n.default
        ? n.default === 1
          ? "1 entry keeps Mantine's value, on its own row with the reason"
          : `${n.default} entries keep Mantine's value, each on its own row with the reason`
        : 'every entry is set by this theme or follows it',
    });
    for (const c of members) {
      if (c.status !== 'default') continue;
      const { reason } = c;
      rows.push({
        variable: c.entry.id,
        slot: reason?.slot ?? '—',
        class: reason?.cls ?? 'unsupported',
        ...(reason?.meaning ? { meaning: reason.meaning } : {}),
        ...(reason ? { note: reason.note } : {}),
      });
    }
  }
  rows.push({
    variable: 'Mantine surface totals',
    slot: `${totals.set} set · ${totals.follows} follow · ${totals.default} on Mantine's default`,
    class: 'derived',
    note: `measured against surface-inventory.json (@mantine/core ${inv.mantineVersion}); AL3 bar: every entry classified, no silent gap`,
  });
  return rows;
}
