#!/usr/bin/env node
/**
 * AL3 for Chakra UI: extract Chakra's theming surface into a machine-readable
 * inventory — the Chakra twin of packages/exporter-mantine/tools/extract-surface.mjs
 * and packages/exporter-primeng/tools/extract-surface.mjs.
 *
 * Source of truth is `defaultConfig` from the installed `@chakra-ui/react` (a
 * demo dependency, never a package dependency): the config `createSystem()`
 * merges a theme over. The inventory has two tiers:
 *
 *   - the token tiers — every leaf of `theme.tokens`, `theme.semanticTokens`
 *     and `theme.breakpoints`, and every leaf of `theme.textStyles` and
 *     `theme.layerStyles` but their structure (isStructure below);
 *   - the recipe tier — every leaf of `theme.recipes` and `theme.slotRecipes`
 *     whose CSS reads a token. Chakra writes those references as bare names
 *     whose category depends on the CSS property (`px: "4"` is spacing,
 *     `borderRadius: "l2"` a radius), so each leaf is resolved with
 *     `defaultSystem.css()` from the same package, and the `var(--chakra-…)`
 *     it produces are mapped back to token names. A leaf that reads no token
 *     (`display: "inline-flex"`) is not a theming slot and is left out.
 *
 * Palettes are collapsed so the inventory does not grow with Chakra's hue
 * palettes: `colors.red.solid` … `colors.pink.solid` are one entry,
 * `semanticTokens.colors.<palette>.solid`, and their shades one entry,
 * `tokens.colors.<palette>.<shade>`. The alpha scales (`whiteAlpha`,
 * `blackAlpha`) fold their shades the same way under their own name. Chakra's
 * `sizes` fold the same way where they are not a scale of their own: the
 * steps that repeat `spacing` (`sizes.10` is `spacing.10`'s 2.5rem, written
 * again) are `tokens.sizes.<step>`, the fractions `tokens.sizes.<fraction>`,
 * the CSS keywords and viewport units `tokens.sizes.<keyword>`.
 *
 * `colorPalette.<key>` is Chakra's palette indirection: recipes read
 * `colorPalette.solid`, which is whatever palette the element (or, by default,
 * `globalCss.html.colorPalette`) names. Those are entries of their own, in the
 * `colorPalette` family, next to that default route (`colorPalette.default`).
 * They have no `from`: which palette they resolve to is the route's value, so
 * src/surface-coverage.js reads them off the emitted config.
 *
 * Each entry records `from`, what its value is read from: the `{reference}`
 * of a semantic token (the Chakra counterpart of PrimeNG's `{ref}`), the
 * tokens a recipe leaf's CSS reads. Deterministic: no timestamps, sorted.
 *
 * Usage: node tools/extract-surface.mjs [--write]   (from packages/exporter-chakra)
 * Exported for scripts/check-coverage-bar.mjs, which regenerates and diffs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

const ALPHA_SCALES = ['whiteAlpha', 'blackAlpha'];
/** `sizes` keys that are CSS keywords and viewport units, not a scale. */
const SIZE_KEYWORDS = new Set(['max', 'min', 'fit', 'full', 'dvh', 'svh', 'lvh', 'dvw', 'svw', 'lvw', 'vw', 'vh']);
/** The order families appear in, and in the report. */
const FAMILIES = ['breakpoints', 'tokens', 'semanticTokens', 'textStyles', 'layerStyles', 'colorPalette', 'recipes', 'slotRecipes'];

const isTokenLeaf = (v) => v && typeof v === 'object' && 'value' in v;

/** Every `{ value }` leaf of a token tree, as [pathSegments, value]. */
function tokenLeaves(tree, prefix = []) {
  const out = [];
  for (const [k, v] of Object.entries(tree)) {
    if (isTokenLeaf(v)) out.push([[...prefix, k], v.value]);
    else if (v && typeof v === 'object') out.push(...tokenLeaves(v, [...prefix, k]));
  }
  return out;
}

/** Every primitive leaf of a style object, as [pathSegments, value]. */
function styleLeaves(obj, prefix = []) {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...styleLeaves(v, [...prefix, k]));
    else if (typeof v === 'string' || typeof v === 'number') out.push([[...prefix, k], v]);
  }
  return out;
}

/** The style roots of a recipe: `[pathSegments, styleObject]`, one level deeper per slot for a slot recipe. */
function styleRoots(recipe, slotted) {
  const roots = [];
  const add = (path, style) => {
    if (!style || typeof style !== 'object') return;
    if (slotted) for (const [slot, s] of Object.entries(style)) roots.push([[...path, slot], s]);
    else roots.push([path, style]);
  };
  add(['base'], recipe.base);
  for (const [variant, values] of Object.entries(recipe.variants ?? {})) {
    for (const [value, style] of Object.entries(values)) add(['variants', variant, value], style);
  }
  (recipe.compoundVariants ?? []).forEach((cv, i) => add(['compoundVariants', String(i), 'css'], cv.css));
  return roots;
}

/**
 * A style leaf that positions an element or wires a component-local custom
 * property (`position: absolute`, `content: ""`, `bottom: var(--indicator-offset-y, 0)`)
 * is structure, not a themable value: left out, like a recipe's `display`.
 */
const isStructure = (prop, value) => ['position', 'content'].includes(prop) || String(value).includes('var(--');

/** `{ a: { b: value } }` from `['a', 'b']`. */
const nest = (keys, value) => keys.reduceRight((acc, k) => ({ [k]: acc }), value);

export async function extractSurface() {
  const chakra = await import('@chakra-ui/react');
  const { defaultConfig, defaultSystem } = chakra;
  const theme = defaultConfig.theme;
  const version = JSON.parse(
    readFileSync(join(repoRoot, 'node_modules', '@chakra-ui', 'react', 'package.json'), 'utf8'),
  ).version;

  // Hue palettes: the colour scales that also have Chakra's palette keys.
  const scales = Object.entries(theme.tokens.colors)
    .filter(([, v]) => v && typeof v === 'object' && !isTokenLeaf(v))
    .map(([k]) => k);
  const hues = scales.filter((k) => !ALPHA_SCALES.includes(k) && theme.semanticTokens.colors[k]);
  const paletteKeys = [...new Set(hues.flatMap((h) => Object.keys(theme.semanticTokens.colors[h])))].sort();

  // Chakra token name (`colors.bg`, `colors.gray.50`, `spacing.4`) → inventory id.
  const semanticNames = new Set(
    tokenLeaves(theme.semanticTokens).map(([path]) => path.filter((k) => k !== 'DEFAULT').join('.')),
  );
  const idOf = (name) => {
    const [category, ...rest] = name.split('.');
    if (category === 'colors' && rest[0] === 'colorPalette') return `colorPalette.${rest.slice(1).join('.')}`;
    const tier = semanticNames.has(name) ? 'semanticTokens' : 'tokens';
    if (category === 'colors' && rest.length === 2) {
      if (hues.includes(rest[0])) {
        return tier === 'semanticTokens' ? `${tier}.colors.<palette>.${rest[1]}` : `${tier}.colors.<palette>.<shade>`;
      }
      if (ALPHA_SCALES.includes(rest[0])) return `${tier}.colors.${rest[0]}.<shade>`;
    }
    if (category === 'sizes' && rest.length) {
      const key = rest.join('.');
      if (/^\d+(\.5)?$/.test(key)) return 'tokens.sizes.<step>';
      if (/^\d+\/\d+$/.test(key)) return 'tokens.sizes.<fraction>';
      if (SIZE_KEYWORDS.has(key)) return 'tokens.sizes.<keyword>';
    }
    return `${tier}.${name}`;
  };

  // CSS variable → token name, from the system Chakra builds.
  // Negative spacing (`spacing.-1`, `calc(var(--chakra-spacing-1) * -1)`)
  // shares its variable with the positive step: the step is what is read.
  const byVar = new Map();
  for (const t of defaultSystem.tokens.allTokens) {
    if (!/(^|\.)-/.test(t.name) && !byVar.has(t.extensions.cssVar.var)) byVar.set(t.extensions.cssVar.var, t.name);
  }
  const tokenNames = new Set(byVar.values());
  /** The tokens a style object's CSS reads, as inventory ids. */
  const readsOf = (style) => {
    let css;
    try {
      css = defaultSystem.css(style);
    } catch {
      return [];
    }
    const values = [];
    const collect = (o) => {
      for (const v of Object.values(o)) {
        if (v && typeof v === 'object') collect(v);
        else values.push(String(v));
      }
    };
    collect(css);
    // A variable name escapes the dot of a half step: `--chakra-spacing-1\.5`.
    return [...values.join(' ').matchAll(/var\((--chakra-(?:[\w-]|\\.)+)/g)]
      .map((m) => byVar.get(m[1]))
      .filter(Boolean)
      .map(idOf);
  };
  /** The `{references}` in a token value (`{colors.gray.900/10}`, `{black/64}`). */
  const refsOf = (value) => {
    const text = typeof value === 'object' ? Object.values(value).join(' ') : String(value);
    return [...text.matchAll(/\{([^}]+)\}/g)].map((m) => {
      const name = m[1].split('/')[0];
      return idOf(tokenNames.has(name) ? name : `colors.${name}`);
    });
  };
  const show = (value) =>
    typeof value === 'object' ? Object.entries(value).map(([k, v]) => `${k}: ${v}`).join(' · ') : String(value);

  const entries = new Map();
  const add = (id, block, fields) => {
    const prev = entries.get(id);
    if (prev) {
      prev.members = (prev.members ?? 1) + 1;
      for (const f of fields.from ?? []) prev.from.add(f);
      return;
    }
    entries.set(id, { id, block, ...fields, from: new Set(fields.from ?? []) });
  };

  // ---- token tiers ----
  for (const [k, v] of Object.entries(theme.breakpoints)) {
    add(`breakpoints.${k}`, 'breakpoints', { path: ['theme', 'breakpoints', k], value: String(v) });
  }
  for (const [tier, tree] of [['tokens', theme.tokens], ['semanticTokens', theme.semanticTokens]]) {
    for (const [path, value] of tokenLeaves(tree)) {
      const name = path.filter((k) => k !== 'DEFAULT').join('.');
      const id = idOf(name);
      const folded = id.includes('<');
      add(id, tier, {
        ...(folded ? {} : { path: ['theme', tier, ...path] }),
        ...(folded ? {} : { value: show(value) }),
        from: refsOf(value).filter((ref) => ref !== id),
      });
    }
  }
  for (const tier of ['textStyles', 'layerStyles']) {
    for (const [name, style] of Object.entries(theme[tier])) {
      for (const [path, value] of styleLeaves(style.value ?? {})) {
        const from = [...new Set(readsOf(nest(path, value)))];
        if (!from.length && isStructure(path.at(-1), value)) continue;
        add(`${tier}.${name}.${path.join('.')}`, tier, {
          path: ['theme', tier, name, 'value', ...path],
          value: String(value),
          from,
        });
      }
    }
  }

  // ---- the palette indirection ----
  add('colorPalette.default', 'colorPalette', {
    path: ['globalCss', 'html', 'colorPalette'],
    value: String(defaultConfig.globalCss.html.colorPalette),
  });

  // ---- recipe tier: leaves whose CSS reads a token ----
  for (const [tier, slotted] of [['recipes', false], ['slotRecipes', true]]) {
    for (const [name, recipe] of Object.entries(theme[tier])) {
      for (const [root, style] of styleRoots(recipe, slotted)) {
        for (const [path, value] of styleLeaves(style)) {
          const from = [...new Set(readsOf(nest(path, value)))];
          if (!from.length) continue;
          add(`${tier}.${name}.${[...root, ...path].join('.')}`, tier, {
            path: ['theme', tier, name, ...root, ...path],
            value: String(value),
            from,
          });
        }
      }
    }
  }
  // Every colorPalette key something reads is an entry of its own.
  for (const e of [...entries.values()]) {
    for (const ref of e.from) {
      if (ref.startsWith('colorPalette.') && !entries.has(ref)) {
        add(ref, 'colorPalette', {});
      }
    }
  }

  const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const list = FAMILIES.flatMap((f) =>
    [...entries.values()]
      .filter((e) => e.block === f)
      .sort(byId)
      .map(({ from, ...e }) => ({ ...e, ...(from.size ? { from: [...from].sort() } : {}) })),
  );
  const families = {};
  for (const f of FAMILIES) families[f] = list.filter((e) => e.block === f).length;
  return {
    chakraVersion: version,
    generatedBy: 'packages/exporter-chakra/tools/extract-surface.mjs',
    palettes: { hues, alpha: ALPHA_SCALES, keys: paletteKeys },
    counts: {
      total: list.length,
      tokenTiers: list.filter((e) => !['recipes', 'slotRecipes'].includes(e.block)).length,
      recipeTier: families.recipes + families.slotRecipes,
      families,
    },
    entries: list,
  };
}

/**
 * The inventory as written to disk: pretty-printed like the other two, except
 * that each entry sits on one line, so the file stays reviewable at a few
 * thousand entries and a diff names the entries that changed.
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
      `wrote ${out} (@chakra-ui/react@${inventory.chakraVersion}: ${inventory.counts.total} entries, ${inventory.counts.tokenTiers} in the token tiers, ${inventory.counts.recipeTier} recipe leaves)`,
    );
  } else {
    console.log(JSON.stringify({ palettes: inventory.palettes, counts: inventory.counts }, null, 2));
  }
}
