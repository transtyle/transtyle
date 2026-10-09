/**
 * Mode encodings shared by exporters (docs/architecture/ir.md#modes, issues
 * #49 and #50): the two ways a target expresses a mode dimension beyond
 * `color-scheme`.
 *
 * - **selector-per-value** (`modeBlocks`): CSS targets keep one stylesheet and
 *   add a block per non-default value, scoped by an attribute selector
 *   (`[data-contrast="more"]`) and, for the dimensions a media feature
 *   describes, by that media query too (`prefers-contrast: more`,
 *   `prefers-reduced-motion: reduce`).
 * - **file-per-value** (`emitPerValue`): targets with no runtime axis (Sass,
 *   TypeScript presets) emit their files once per value, `<file>.<value>.<ext>`.
 *
 * Both are pure functions of the normalized IR, so an exporter that uses them
 * stays as deterministic as one that doesn't.
 */

import { comboKey } from './index.js';

/**
 * The CSS media feature a reserved dimension's value stands for. A value listed
 * here gets an `@media` block next to its attribute block, so the user's OS
 * setting applies until the page sets the attribute itself.
 */
export const MODE_MEDIA_QUERIES = {
  contrast: { more: '(prefers-contrast: more)', less: '(prefers-contrast: less)' },
  motion: { reduced: '(prefers-reduced-motion: reduce)' },
};

/** The default selector template for a dimension: `[data-<dimension>="{value}"]`. */
export const defaultDimensionSelector = (dim) => `[data-${dim}="{value}"]`;

/**
 * A view of the normalized IR with some dimensions pinned to one value each
 * (`{ brand: 'globex' }`): only the combos holding those values are kept, each
 * pinned dimension has that value as its only value and default, and
 * `modes.light` / `modes.dark` alias the pinned combos. Every exporter already
 * renders a light/dark pair from those two aliases, so rendering one brand is
 * rendering one slice.
 */
export function pinDimension(normalized, pins) {
  const names = normalized.dimensionNames ?? [normalized.modeDimension];
  const dimensions = {};
  for (const n of names) {
    const def = normalized.dimensions?.[n];
    dimensions[n] = n in pins ? { ...def, values: [pins[n]], default: pins[n] } : def;
  }
  const allCombos = (normalized.allCombos ?? []).filter((key) =>
    Object.entries(pins).every(([d, v]) => normalized.comboDims[key]?.[d] === v),
  );
  const modes = {};
  const comboDims = {};
  for (const key of allCombos) {
    modes[key] = normalized.modes[key];
    comboDims[key] = normalized.comboDims[key];
  }
  const primary = normalized.modeDimension;
  const others = Object.fromEntries(names.filter((n) => n !== primary).map((n) => [n, dimensions[n].default]));
  for (const v of dimensions[primary].values) {
    modes[v] = normalized.modes[comboKey(names, { ...others, [primary]: v })];
  }
  return {
    ...normalized,
    modes,
    comboDims,
    allCombos,
    dimensions,
    modeValues: dimensions[primary].values,
    defaultMode: dimensions[primary].default,
  };
}

/** `preset.transtyle.ts` + `globex` -> `preset.transtyle.globex.ts`. */
export function withValueSuffix(path, value) {
  const slash = path.lastIndexOf('/');
  const dot = path.lastIndexOf('.');
  return dot > slash + 1 ? `${path.slice(0, dot)}.${value}${path.slice(dot)}` : `${path}.${value}`;
}

/**
 * file-per-value: run `emitOne(view)` once per value of `dim`, each on the IR
 * pinned to that value, and name every file `<file>.<value>.<ext>`. When the
 * dimension isn't declared, or a per-target subset left it one value, this is
 * `emitOne(normalized)` unchanged: no suffix, no extra text.
 *
 * Coverage and the shared `usage.md` come from the default value's run (slot
 * coverage is computed on the default, as for every other dimension); the
 * usage file gains a section naming each value's files. Exporter diagnostics
 * of every run are kept, each once.
 */
export function emitPerValue(normalized, dim, emitOne) {
  const def = normalized.dimensions?.[dim];
  if (!def || def.values.length < 2) return emitOne(normalized);
  const runs = def.values.map((value) => ({ value, out: emitOne(pinDimension(normalized, { [dim]: value })) }));
  const base = runs.find((r) => r.value === def.default) ?? runs[0];
  const files = [];
  const perValue = [];
  for (const { value, out } of runs) {
    const names = [];
    for (const f of out.files) {
      if (f.path === 'usage.md') continue;
      const path = withValueSuffix(f.path, value);
      names.push(path);
      files.push({ ...f, path });
    }
    perValue.push({ value, names });
  }
  const usage = base.out.files.find((f) => f.path === 'usage.md');
  if (usage) {
    const list = perValue
      .map(({ value, names }) => `- \`${value}\`${value === def.default ? ' (default)' : ''}: ${names.map((n) => `\`${n}\``).join(', ')}`)
      .join('\n');
    files.push({
      ...usage,
      contents:
        usage.contents.replace(/\n*$/, '\n') +
        `\n## One set of files per \`${dim}\`\n\nThis design system declares the \`${dim}\` mode dimension, and these files have no runtime switch for it, so each is emitted once per value, named \`<file>.<${dim}>.<ext>\`. Use the files of one value where the instructions above name the unsuffixed file:\n\n${list}\n`,
    });
  }
  const seen = new Set();
  const diagnostics = [];
  for (const { out } of runs) {
    for (const d of out.diagnostics ?? []) {
      const key = `${d.code}|${d.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      diagnostics.push(d);
    }
  }
  return {
    files,
    coverage: base.out.coverage.filter((c) => c.variable !== `(mode:${dim})`),
    diagnostics,
  };
}

/** Split a selector list on its top-level commas (not those inside `:not(…)` or `[…]`). */
function selectorList(sel) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      out.push(sel.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(sel.slice(start).trim());
  return out.filter(Boolean);
}

/** The compound of several (possibly listed) selectors on one element: their cross-product. */
function compound(parts) {
  let acc = [''];
  for (const part of parts) acc = acc.flatMap((a) => selectorList(part).map((s) => a + s));
  return acc;
}

/**
 * selector-per-value: the blocks a CSS target adds after its own `:root` (light)
 * and dark blocks so that every combination of `dims` (the non-primary
 * dimensions it expresses) resolves, through the cascade, to the engine's value
 * for that combination.
 *
 * `render(map, { dark })` returns the declarations the target writes for one
 * resolved mode map: `[{ name, value, line, scope? }]`, where `value` is what
 * is compared, `line` what is written, and `scope` an optional descendant
 * selector (`' .btn-primary'`) for rules that aren't on the root element. It
 * must return exactly what the target already writes in its `:root` block
 * (`dark: false`) and in its dark block (`dark: true`), because those two
 * blocks are the start of the simulated cascade.
 *
 * How the blocks are chosen. A combination is the set S of its non-base
 * values (`dark` counts as one when the target has a dark block). Its block is
 * the compound selector of S's parts (`[data-color-scheme="dark"][data-contrast="more"]`),
 * so its specificity grows with |S|. Blocks are emitted smallest S first, and
 * each holds only the declarations whose value differs from what the blocks
 * already emitted for the subsets of S would give it (highest |T| wins, the
 * later one on a tie). That is the whole cure for the leak #49 and #50 found:
 * a light `[data-contrast="more"]` block written after the dark block used to
 * win on a dark page; now `dark + more` gets its own block whenever its values
 * differ from what the cascade would produce, and stays silent when they
 * don't (density, which changes no color, adds nothing for `dark + compact`).
 *
 * A dimension value with a media feature (MODE_MEDIA_QUERIES) gets the same
 * block a second time inside its `@media`, with the attribute replaced by
 * "this dimension's attribute is absent" (`:not([data-contrast])`), so the OS
 * setting applies until the page sets the attribute, and any explicit value
 * (`data-contrast="standard"` included) wins over it. A block made only of such
 * parts is anchored on `:where(:root)`, which adds no specificity. The model
 * assumes the attributes sit on the same element as the target's own scheme
 * selector (usually `<html>`).
 */
export function modeBlocks(normalized, { dims, render, darkSelector, selector, media = true }) {
  const names = normalized.dimensionNames ?? [normalized.modeDimension];
  const primary = normalized.modeDimension;
  const extra = names.filter((n) => n !== primary && dims.includes(n) && (normalized.dimensions[n]?.values.length ?? 0) > 1);
  if (!extra.length) return [];
  const templateOf = (dim) => selector?.(dim) ?? defaultDimensionSelector(dim);
  const sel = (dim, value) => templateOf(dim).replaceAll('{value}', value);
  // "No explicit value for this dimension": the bare attribute for the default
  // template, otherwise every value's selector in one :not() list (which, like
  // the bare attribute, weighs as one attribute).
  const absent = (dim) =>
    templateOf(dim) === defaultDimensionSelector(dim)
      ? `:not([data-${dim}])`
      : `:not(${normalized.dimensions[dim].values.map((v) => sel(dim, v)).join(', ')})`;

  const defaults = Object.fromEntries(names.map((n) => [n, normalized.dimensions[n].default]));
  const base = normalized.modes.light ? 'light' : normalized.defaultMode;
  const primaryValues = [base, ...(normalized.modes.dark && base !== 'dark' && darkSelector ? ['dark'] : [])];

  const isSeed = (parts) => parts.length === 0 || (parts.length === 1 && parts[0][0] === primary);
  const rank = (s) => (isSeed(s.parts) ? s.parts.length - 10 : s.parts.length);
  let combos = primaryValues.map((p) => ({ [primary]: p }));
  for (const d of extra) combos = combos.flatMap((c) => normalized.dimensions[d].values.map((v) => ({ ...c, [d]: v })));
  const sets = combos
    .map((values) => {
      const parts = [];
      if (values[primary] !== base) parts.push([primary, values[primary]]);
      for (const d of extra) if (values[d] !== defaults[d]) parts.push([d, values[d]]);
      return { values, parts, key: comboKey(names, { ...defaults, ...values }) };
    })
    .filter((s) => normalized.modes[s.key])
    // The two blocks the target writes itself (:root, then dark) come first
    // in the stylesheet, so they come first here; then the rest, by size.
    .sort((a, b) => rank(a) - rank(b));

  const keyOf = (e) => `${e.scope ?? ''}\u0000${e.name}`;
  const emitted = [];
  const blocks = [];
  for (const s of sets) {
    const dark = s.values[primary] === 'dark';
    const entries = render(normalized.modes[s.key], { dark });
    const partKeys = s.parts.map(([d, v]) => `${d}=${v}`);
    if (isSeed(s.parts)) {
      emitted.push({ partKeys, size: s.parts.length, values: new Map(entries.map((e) => [keyOf(e), e.value])) });
      continue;
    }
    const applicable = emitted.filter((b) => b.partKeys.every((k) => partKeys.includes(k)));
    const diff = entries.filter((e) => {
      const k = keyOf(e);
      let best = null;
      for (const b of applicable) if (b.values.has(k) && (!best || b.size >= best.size)) best = b;
      return !best || best.values.get(k) !== e.value;
    });
    emitted.push({ partKeys, size: s.parts.length, values: new Map(diff.map((e) => [keyOf(e), e.value])) });
    if (!diff.length) continue;

    const scopes = [];
    for (const e of diff) {
      const scope = e.scope ?? '';
      let group = scopes.find((g) => g.scope === scope);
      if (!group) scopes.push((group = { scope, lines: [] }));
      group.lines.push(e.line);
    }
    const partSel = ([d, v]) => (d === primary ? darkSelector : sel(d, v));
    const mediaParts = media ? s.parts.filter(([d, v]) => MODE_MEDIA_QUERIES[d]?.[v]) : [];
    const forms = [{ media: null, parts: s.parts.map(partSel) }];
    // Every non-empty subset of the media-capable parts, in a fixed order.
    for (let mask = 1; mask < 1 << mediaParts.length; mask++) {
      const viaMedia = mediaParts.filter((_, i) => mask & (1 << i));
      const parts = s.parts.map((p) => (viaMedia.includes(p) ? absent(p[0]) : partSel(p)));
      if (viaMedia.length === s.parts.length) parts.unshift(':where(:root)');
      forms.push({ media: viaMedia.map(([d, v]) => MODE_MEDIA_QUERIES[d][v]).join(' and '), parts });
    }
    for (const form of forms) {
      const list = compound(form.parts);
      for (const { scope, lines } of scopes) {
        blocks.push({
          combo: s.key,
          size: s.parts.length,
          parts: Object.fromEntries(s.parts),
          media: form.media,
          selector: list.map((x) => x + scope).join(', '),
          lines,
        });
      }
    }
  }
  return blocks;
}

/** The blocks as stylesheet lines, each preceded by a blank line, `indent` before every line. */
export function formatModeBlocks(blocks, indent = '') {
  const out = [];
  for (const b of blocks) {
    out.push('');
    if (b.media) {
      out.push(`${indent}@media ${b.media} {`, `${indent}  ${b.selector} {`);
      for (const l of b.lines) out.push(`${indent}  ${l}`);
      out.push(`${indent}  }`, `${indent}}`);
    } else {
      out.push(`${indent}${b.selector} {`);
      for (const l of b.lines) out.push(`${indent}${l}`);
      out.push(`${indent}}`);
    }
  }
  return out;
}

/**
 * The usage.md section a CSS target appends when it wrote blocks for
 * dimensions beyond `color-scheme`: which attributes to set, on which element,
 * and which media features stand in for them. `scheme` is how this target
 * selects dark (`class="dark"`), shown in the example element. Empty when
 * there are no blocks, so a design system without such dimensions gets the
 * same file as before.
 */
export function modeBlocksUsage(normalized, blocks, { scheme, selector } = {}) {
  if (!blocks.length) return '';
  const primary = normalized.modeDimension;
  const dims = [];
  for (const b of blocks) for (const d of Object.keys(b.parts)) if (d !== primary && !dims.includes(d)) dims.push(d);
  const nonDefault = (d) => normalized.dimensions[d].values.find((v) => v !== normalized.dimensions[d].default);
  const attr = (d, v) => (selector?.(d) ?? defaultDimensionSelector(d)).replaceAll('{value}', v);
  const example = dims.map((d) => attr(d, nonDefault(d))).join('');
  const media = dims.flatMap((d) =>
    normalized.dimensions[d].values.filter((v) => MODE_MEDIA_QUERIES[d]?.[v]).map((v) => `\`${MODE_MEDIA_QUERIES[d][v]}\` applies \`${d}: ${v}\``),
  );
  const mediaDim = dims.find((d) => normalized.dimensions[d].values.some((v) => MODE_MEDIA_QUERIES[d]?.[v]));
  return `
## Other mode dimensions (${dims.join(', ')})

Each value of ${dims.length === 1 ? 'this dimension' : 'these dimensions'} that changes a variable here has its own block, selected by an attribute on the same element as the color scheme${scheme ? ` (${scheme})` : ''}, usually \`<html>\`: \`${example}\` selects ${dims.map((d) => `\`${d}: ${nonDefault(d)}\``).join(' and ')}. A combination the separate blocks would get wrong, such as the dark scheme with a dimension that changes colors, has its own compound block, so every combination gets the design system's own values.
${media.length && blocks.some((b) => b.media) ? `
Without the attribute, the user's system setting applies: ${media.join(', ')}. Any explicit value wins over it, the default one included (\`${attr(mediaDim, normalized.dimensions[mediaDim].default)}\`).
` : ''}`;
}
