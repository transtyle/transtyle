/**
 * @transtyle/exporter-css-variables — the simplest possible backend, kept
 * deliberately boring: it dumps the resolved semantic catalog 1:1 as plain
 * CSS custom properties. Spec: docs/specs/exporters/css-variables.md.
 *
 * Two jobs beyond being useful on its own:
 *  1. Executable specification of the plugin API — an exporter is exactly
 *     this: `emit(normalized, ctx) -> { files, coverage }`, nothing more.
 *  2. Conformance fixture for plugin testing (Phase 2 kit): its output is a
 *     total, framework-free projection of the IR, so any pipeline change
 *     that alters resolution shows up here first.
 *
 * Naming: strip the `semantic.` prefix, dots -> dashes. Color-role and
 * content-hierarchy slots keep their `color.` segment (`--color-primary-solid`,
 * `--color-text-base`); the elevation ladder and scrim drop it, since they
 * read as surfaces, not role colors (`--elevation-1-surface`, `--scrim`).
 * Everything else keeps its own top group: `--radius-md`, `--space-4`,
 * `--type-size-md`, `--z-modal`. Composite `type.role.*` values (DTCG
 * `typography`) expand to longhand sub-properties (`-size`/`-weight`/
 * `-leading`/`-family`); `elevation.N.shadow` (DTCG `shadow`) collapses to one
 * box-shadow-shaped value.
 *
 * Mode encoding: `:root` carries color slots for the light map (mode NAMES,
 * never the default flag — ir.md#modes); the dark map goes under
 * `[data-color-scheme="dark"]` (override via options.darkSelector). Non-color
 * slots (radius/space/type/motion/...) are mode-invariant and emitted once —
 * unless they vary by a *non-primary* mode dimension (T8, e.g. `density`),
 * in which case they get their own selector block (see "Extra mode
 * dimensions" below); this is the one exporter that expresses every
 * configured dimension, not just `color-scheme`.
 */

import { modeBlocks, formatModeBlocks, MODE_MEDIA_QUERIES } from '@transtyle/ir';

export default {
  name: 'css-variables',

  // Validated by core against the target's `options` at load time (audit A8).
  optionsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      prefix: { type: 'string' },
      darkSelector: { type: 'string' },
      dimensionSelectors: { type: 'object', additionalProperties: { type: 'string' } },
      mediaQueries: { type: 'boolean' },
      // Custom semantic tokens (issue #51): emitted like every other slot by
      // default; `omit` leaves them out, and core reports each one `dropped`.
      customTokens: { type: 'string', enum: ['emit', 'omit'] },
    },
  },

  // An open vocabulary: any `semantic.*` token, catalog slot or not, has a
  // place in the output. Core reads this flag for the note on a custom token
  // the output leaves out (docs/architecture/plugins.md).
  openVocabulary: true,

  emit(normalized, ctx) {
    const prefix = ctx.targetConfig.options?.prefix ? `${ctx.targetConfig.options.prefix}-` : '';
    const darkSelector = ctx.targetConfig.options?.darkSelector ?? '[data-color-scheme="dark"]';
    const light = normalized.modes.light ?? normalized.modes[normalized.defaultMode];
    const dark = normalized.modes.dark;
    const omitted = new Set(ctx.targetConfig.options?.customTokens === 'omit' ? ctx.customTokens ?? [] : []);

    const coverage = [];
    const colorLines = { light: [], dark: [] };
    const invariantLines = [];

    const slots = [...light.keys()].filter((k) => k.startsWith('semantic.') && !omitted.has(k)).sort((a, b) => varName(a, prefix).localeCompare(varName(b, prefix)));

    for (const slot of slots) {
      const entry = light.get(slot);
      if (entry?.value === undefined) continue;
      // A composite carrying a color member varies by color-scheme like a
      // color does, wherever it lives in the tree (`semantic.border.focus`).
      const isColor = slot.startsWith('semantic.color.') || entry.type === 'shadow' || entry.type === 'border';
      const rendered = renderEntry(entry, ctx);
      if (!rendered) continue;

      // The token's own $description / $deprecated (#30), on comment lines
      // above its first declaration in the default block only: the dark and
      // extra-dimension blocks re-declare the same variable.
      const notes = noteLines(entry);

      if (isColor) {
        for (const [i, [suffix, value]] of rendered.entries()) {
          const name = varName(slot, prefix) + suffix;
          if (i === 0) colorLines.light.push(...notes);
          colorLines.light.push(cssLine(name, value, entry));
          coverage.push({ variable: name, slot, class: 'native', provenance: entry.provenance.kind });
        }
        const darkEntry = dark?.get(slot);
        if (darkEntry?.value !== undefined) {
          const renderedDark = renderEntry(darkEntry, ctx);
          for (const [suffix, value] of renderedDark) {
            colorLines.dark.push(cssLine(varName(slot, prefix) + suffix, value, darkEntry));
          }
        }
      } else {
        for (const [i, [suffix, value]] of rendered.entries()) {
          const name = varName(slot, prefix) + suffix;
          if (i === 0) invariantLines.push(...notes);
          invariantLines.push(cssLine(name, value, entry));
          coverage.push({ variable: name, slot, class: 'native', provenance: entry.provenance.kind });
        }
      }
    }

    // Extra mode dimensions (T8): every dimension beyond the primary
    // (`color-scheme`, handled above) gets one selector block per non-default
    // value, containing only the variables that differ from the all-defaults
    // combo (`light`) — e.g. `density: compact` only touches `space.*`, so only
    // those variables appear, not a full re-dump. A combination of values
    // (dark + more contrast, dark + another brand) gets its own compound block
    // whenever the cascade of those blocks would not already give it the
    // engine's values (#49, #50); `contrast` and `motion` values also get an
    // `@media` copy so the OS setting applies (MODE_MEDIA_QUERIES), unless
    // `options.mediaQueries` is false. The block planning is shared with the
    // other CSS targets: modeBlocks() in @transtyle/ir.
    const dimNames = normalized.dimensionNames ?? [normalized.modeDimension];
    const extraDims = dimNames.filter((d) => d !== normalized.modeDimension);
    const mediaQueries = ctx.targetConfig.options?.mediaQueries !== false;
    const render = (map, { dark: isDark }) => {
      const out = [];
      for (const slot of [...map.keys()].filter((k) => k.startsWith('semantic.') && !omitted.has(k))) {
        const entry = map.get(slot);
        if (entry?.value === undefined) continue;
        const isColor = slot.startsWith('semantic.color.') || entry.type === 'shadow' || entry.type === 'border';
        // The dark block holds colors only; everything else is the :root value.
        if (isDark && !isColor) continue;
        for (const [suffix, value] of renderEntry(entry, ctx) ?? []) {
          const name = varName(slot, prefix) + suffix;
          out.push({ name, value, line: cssLine(name, value, entry) });
        }
      }
      return out;
    };
    const blocks = modeBlocks(normalized, {
      dims: extraDims,
      render,
      darkSelector: colorLines.dark.length ? darkSelector : undefined,
      selector: (dim) => ctx.targetConfig.options?.dimensionSelectors?.[dim],
      media: mediaQueries,
    });
    const extraDimBlocks = formatModeBlocks(blocks);
    // What usage.md explains beyond the plain attribute blocks.
    const mediaDims = mediaQueries
      ? extraDims
          .map((dim) => ({
            dim,
            fallback: normalized.dimensions[dim].default,
            features: normalized.dimensions[dim].values.filter((v) => MODE_MEDIA_QUERIES[dim]?.[v]).map((v) => [v, MODE_MEDIA_QUERIES[dim][v]]),
          }))
          .filter((m) => m.features.length && blocks.some((b) => b.media))
      : [];
    const comboBlocks = blocks.some((b) => b.size > 1);

    const css = [
      '/*',
      ` * GENERATED by transtyle — do not edit; source: ${ctx.projectName} token files`,
      ' * Target: css-variables (the resolved semantic catalog, 1:1) · rules standard@1',
      ` * Modes: :root = light · ${darkSelector} = dark (mode names, never the default flag)`,
      ' */',
      '',
      ':root {',
      ...invariantLines,
      ...colorLines.light,
      '}',
      ...(colorLines.dark.length ? ['', `${darkSelector} {`, ...colorLines.dark, '}'] : []),
      ...extraDimBlocks,
      '',
    ].join('\n');

    return {
      files: [
        { path: 'variables.transtyle.css', contents: css, kind: 'stylesheet' },
        { path: 'usage.md', contents: renderUsage(ctx, coverage.length, darkSelector, extraDims, colorLines.dark.length > 0, { mediaDims, comboBlocks, hasCustom: (ctx.customTokens ?? []).length > 0 }), kind: 'doc' },
      ],
      coverage,
    };
  },
};

// ---------- naming ----------

function varName(path, prefix) {
  let rest = path.replace(/^semantic\./, '');
  if (rest.startsWith('color.elevation.') || rest === 'color.scrim') {
    rest = rest.replace(/^color\./, '');
  }
  return '--' + prefix + rest.replace(/\./g, '-');
}

// ---------- value rendering: returns [[suffix, cssValueString], ...] ----------

function renderEntry(entry, ctx) {
  const { type, value } = entry;
  if (type === 'color') return [['', ctx.formatColor(value)]];
  if (type === 'dimension' || type === 'duration' || type === 'cubicBezier') return [['', String(value)]];
  if (type === 'number') return [['', String(value)]];
  if (type === 'typography') {
    // AL5: a composite member can be absent — a design system that authors no
    // font family gets a type role with no `fontFamily`, and `String(undefined)`
    // wrote `--type-role-body-md-family: undefined;` into the stylesheet. Emit
    // the longhands that exist; a missing custom property is inert, a malformed
    // one is not.
    return [
      ['-size', value.fontSize],
      ['-weight', value.fontWeight === undefined ? undefined : String(value.fontWeight)],
      ['-leading', value.lineHeight === undefined ? undefined : String(value.lineHeight)],
      ['-family', value.fontFamily === undefined ? undefined : fontList(value.fontFamily)],
    ].filter(([, v]) => v !== undefined);
  }
  if (type === 'shadow') {
    // DTCG allows a stacked shadow as an array of layers; CSS takes the same
    // list comma-separated, first layer on top.
    const layers = Array.isArray(value) ? value : [value];
    return [['', layers.map((s) => `${s.inset ? 'inset ' : ''}${s.offsetX} ${s.offsetY} ${s.blur} ${s.spread} ${ctx.formatColor(s.color)}`).join(', ')]];
  }
  if (type === 'border') {
    // A DTCG strokeStyle may also be an object (dash array + line cap), which
    // the `border` shorthand cannot express: no declaration rather than a
    // malformed one.
    if (typeof value.style !== 'string') return [];
    return [['', `${value.width} ${value.style} ${ctx.formatColor(value.color)}`]];
  }
  if (type === 'transition') {
    return [['', `${value.duration} ${cubicBezier(value.timingFunction)} ${value.delay}`]];
  }
  if (type === 'fontFamily' || Array.isArray(value)) return [['', fontList(value)]];
  return [['', String(value)]];
}

/**
 * A fontFamily as a CSS list, quoting the names that need it. NORMALIZE always
 * hands over the array of names (issue #183); a string, from an IR built by
 * hand, is taken as the CSS list it already is. Same quoting rule as
 * `fontStack()` in @transtyle/ir, inlined so this exporter keeps importing
 * nothing.
 */
const fontName = (f) => {
  if (/^(["']).*\1$/s.test(f) || f.includes('(')) return f; // already quoted, or var(…)
  return /[^a-z-]/.test(f) ? `"${f.replace(/["\\]/g, '\\$&')}"` : f;
};
const fontList = (value) => (Array.isArray(value) ? value.map(fontName).join(', ') : String(value));

/** DTCG writes a cubicBezier as four numbers; the catalog's own easings are already CSS. */
const cubicBezier = (value) => (Array.isArray(value) ? `cubic-bezier(${value.join(', ')})` : String(value));

const cssLine = (name, value, entry) =>
  `  ${name}: ${value}; /* ${entry.provenance.kind !== 'authored' ? entry.provenance.kind + ' · ' : ''}${entry.type} */`;

/**
 * Comment lines for a token's metadata (#30): the first line of its
 * `description`, then `Deprecated: <reason>` when the token itself is
 * deprecated. `*\/` in the text is broken up so it cannot close the comment
 * and leave the rest of the sentence as CSS. Kept inline (the same rules as
 * `entryNotes()` in @transtyle/ir) so this reference exporter stays
 * dependency-free: reading `entry.description` is all a plugin needs.
 */
function noteLines(entry) {
  const first = (s) => String(s).split(/\r\n|\r|\n/).map((l) => l.trim()).find((l) => l !== '') ?? '';
  const notes = [];
  if (typeof entry.description === 'string' && first(entry.description)) notes.push(first(entry.description));
  if (entry.deprecated) notes.push(typeof entry.deprecated === 'string' && first(entry.deprecated) ? `Deprecated: ${first(entry.deprecated)}` : 'Deprecated.');
  return notes.map((n) => `  /* ${n.replace(/\*\//g, '* /')} */`);
}

// ---------- usage ----------

function renderUsage(ctx, count, darkSelector, extraDims, hasDark = true, { mediaDims = [], comboBlocks = false, hasCustom = false } = {}) {
  return `# Using these CSS variables

The complete resolved semantic catalog of **${ctx.projectName}** (${count} custom properties), framework-free. This is transtyle's simplest target — and the reference projection of the IR: every other exporter's output is some mapping of what you see here.

## Install

\`\`\`html
<link rel="stylesheet" href="variables.transtyle.css">
\`\`\`

\`\`\`css
.my-button {
  background: var(--color-primary-solid);
  color: var(--color-primary-on-solid);
  border-radius: var(--radius-md);
}
.my-button:hover { background: var(--color-primary-solid-hover); }
\`\`\`

${hasDark ? `## Dark mode

\`:root\` carries the light values; the dark values live under \`${darkSelector}\`:

\`\`\`js
document.documentElement.setAttribute('data-color-scheme', 'dark');
\`\`\`

(Configure the selector via \`options.darkSelector\`, and prefix all variables via \`options.prefix\`.)
` : `## Dark mode

None: this file was generated without a dark mode, so \`:root\` carries the only values (prefix all variables via \`options.prefix\`).
`}${extraDims?.length ? `
## Other mode dimensions (${extraDims.join(', ')})

This design system also declares ${extraDims.length === 1 ? 'a' : ''} mode dimension${extraDims.length === 1 ? '' : 's'} beyond \`color-scheme\`. Each non-default value that actually changes something gets its own selector block, containing only the variables that differ from the default — set the attribute to activate it:

\`\`\`js
document.documentElement.setAttribute('data-${extraDims[0]}', '<non-default-value>');
\`\`\`

Default selector is \`[data-<dimension>="<value>"]\`; override per dimension via \`options.dimensionSelectors\` (e.g. \`{ "${extraDims[0]}": ".${extraDims[0]}-{value}" }\`, where \`{value}\` is replaced with the mode value).
${comboBlocks ? `
A combination whose values the separate blocks would get wrong (the dark scheme together with another dimension that changes colors, say) has its own compound block, \`${darkSelector}[data-<dimension>="<value>"]\` or two attribute selectors together. Set every attribute on the same element (usually \`<html>\`) for those blocks to apply.
` : ''}${mediaDims.length ? `
${mediaDims.map((m) => `\`${m.dim}\``).join(' and ')} also follow${mediaDims.length === 1 ? 's' : ''} the user's system setting until the page sets the attribute itself: ${mediaDims.flatMap((m) => m.features.map(([v, q]) => `\`${q}\` applies \`${m.dim}: ${v}\``)).join(', ')}. Any explicit value wins over the system setting, the default one included (\`data-${mediaDims[0].dim}="${mediaDims[0].fallback}"\` keeps the default whatever the system says). Turn the media blocks off with \`options.mediaQueries: false\`.
` : ''}` : ''}
## Naming

Strip \`semantic.\`, dots become dashes: \`color.primary.solid\` → \`--color-primary-solid\`. The elevation ladder and \`scrim\` drop the \`color.\` segment (\`--elevation-1-surface\`, \`--scrim\`) since they're surfaces, not role colors. Composite typography roles (\`type.role.*\`) expand to \`-size\`/\`-weight\`/\`-leading\`/\`-family\`; elevation shadows collapse to one box-shadow-shaped value (\`--elevation-1-shadow\`).
${hasCustom ? '\nYour own `semantic.*` tokens outside the catalog follow the same rule (`semantic.color.brand.ink` → `--color-brand-ink`). Set `options.customTokens: "omit"` to leave them out.\n' : ''}
## Regenerating

Never edit this file — change the design system tokens and run \`transtyle build css-variables\`.
See \`report.json\` for provenance per variable (authored vs derived vs defaulted).
`;
}
