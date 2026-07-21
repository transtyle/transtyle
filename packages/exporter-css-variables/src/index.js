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

export default {
  name: 'css-variables',

  emit(normalized, ctx) {
    const prefix = ctx.targetConfig.options?.prefix ? `${ctx.targetConfig.options.prefix}-` : '';
    const darkSelector = ctx.targetConfig.options?.darkSelector ?? '[data-color-scheme="dark"]';
    const light = normalized.modes.light ?? normalized.modes[normalized.defaultMode];
    const dark = normalized.modes.dark;

    const coverage = [];
    const colorLines = { light: [], dark: [] };
    const invariantLines = [];

    const slots = [...light.keys()].filter((k) => k.startsWith('semantic.')).sort((a, b) => varName(a, prefix).localeCompare(varName(b, prefix)));

    for (const slot of slots) {
      const entry = light.get(slot);
      if (entry?.value === undefined) continue;
      const isColor = slot.startsWith('semantic.color.');
      const rendered = renderEntry(entry, ctx);
      if (!rendered) continue;

      if (isColor) {
        for (const [suffix, value] of rendered) {
          const name = varName(slot, prefix) + suffix;
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
        for (const [suffix, value] of rendered) {
          const name = varName(slot, prefix) + suffix;
          invariantLines.push(cssLine(name, value, entry));
          coverage.push({ variable: name, slot, class: 'native', provenance: entry.provenance.kind });
        }
      }
    }

    // Extra mode dimensions (T8): every dimension beyond the primary
    // (`color-scheme`, handled above) gets one selector block per non-default
    // value, containing only the slots that actually differ from the
    // all-defaults combo (`light`) — e.g. `density: compact` only touches
    // `space.*`, so only those variables appear, not a full re-dump.
    const dimNames = normalized.dimensionNames ?? [normalized.modeDimension];
    const extraDimBlocks = [];
    for (const dimName of dimNames) {
      if (dimName === normalized.modeDimension) continue;
      const dimDef = normalized.dimensions[dimName];
      for (const value of dimDef.values) {
        if (value === dimDef.default) continue;
        const comboValues = Object.fromEntries(dimNames.map((d) => [d, normalized.dimensions[d].default]));
        comboValues[dimName] = value;
        const comboMap = normalized.modes[dimNames.map((d) => comboValues[d]).join('+')];
        if (!comboMap) continue;
        const lines = [];
        for (const slot of [...comboMap.keys()].filter((k) => k.startsWith('semantic.'))) {
          const comboEntry = comboMap.get(slot);
          if (comboEntry?.value === undefined) continue;
          const baseEntry = light.get(slot);
          const rendered = renderEntry(comboEntry, ctx);
          if (!rendered) continue;
          const baseRendered = baseEntry ? renderEntry(baseEntry, ctx) : null;
          if (baseRendered && JSON.stringify(baseRendered) === JSON.stringify(rendered)) continue; // unchanged under this dimension
          for (const [suffix, val] of rendered) lines.push(cssLine(varName(slot, prefix) + suffix, val, comboEntry));
        }
        if (lines.length) {
          const template = ctx.targetConfig.options?.dimensionSelectors?.[dimName] ?? `[data-${dimName}="{value}"]`;
          extraDimBlocks.push('', `${template.replace('{value}', value)} {`, ...lines, '}');
        }
      }
    }

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
        { path: 'usage.md', contents: renderUsage(ctx, coverage.length, darkSelector, dimNames.filter((d) => d !== normalized.modeDimension)), kind: 'doc' },
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
    return [
      ['-size', value.fontSize],
      ['-weight', String(value.fontWeight)],
      ['-leading', String(value.lineHeight)],
      ['-family', Array.isArray(value.fontFamily) ? fontList(value.fontFamily) : String(value.fontFamily)],
    ];
  }
  if (type === 'shadow') {
    return [['', `${value.offsetX} ${value.offsetY} ${value.blur} ${value.spread} ${ctx.formatColor(value.color)}`]];
  }
  if (Array.isArray(value)) return [['', fontList(value)]];
  return [['', String(value)]];
}

const fontList = (value) => value.map((f) => (/[^a-z-]/.test(f) ? `"${f}"` : f)).join(', ');

const cssLine = (name, value, entry) =>
  `  ${name}: ${value}; /* ${entry.provenance.kind !== 'authored' ? entry.provenance.kind + ' · ' : ''}${entry.type} */`;

// ---------- usage ----------

function renderUsage(ctx, count, darkSelector, extraDims) {
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

## Dark mode

\`:root\` carries the light values; the dark values live under \`${darkSelector}\`:

\`\`\`js
document.documentElement.setAttribute('data-color-scheme', 'dark');
\`\`\`

(Configure the selector via \`options.darkSelector\`, and prefix all variables via \`options.prefix\`.)
${extraDims?.length ? `
## Other mode dimensions (${extraDims.join(', ')})

This design system also declares ${extraDims.length === 1 ? 'a' : ''} mode dimension${extraDims.length === 1 ? '' : 's'} beyond \`color-scheme\`. Each non-default value that actually changes something gets its own selector block, containing only the variables that differ from the default — set the attribute to activate it:

\`\`\`js
document.documentElement.setAttribute('data-${extraDims[0]}', '<non-default-value>');
\`\`\`

Default selector is \`[data-<dimension>="<value>"]\`; override per dimension via \`options.dimensionSelectors\` (e.g. \`{ "${extraDims[0]}": ".${extraDims[0]}-{value}" }\`, where \`{value}\` is replaced with the mode value).
` : ''}
## Naming

Strip \`semantic.\`, dots become dashes: \`color.primary.solid\` → \`--color-primary-solid\`. The elevation ladder and \`scrim\` drop the \`color.\` segment (\`--elevation-1-surface\`, \`--scrim\`) since they're surfaces, not role colors. Composite typography roles (\`type.role.*\`) expand to \`-size\`/\`-weight\`/\`-leading\`/\`-family\`; elevation shadows collapse to one box-shadow-shaped value (\`--elevation-1-shadow\`).

## Regenerating

Never edit this file — change the design system tokens and run \`transtyle build css-variables\`.
See \`report.json\` for provenance per variable (authored vs derived vs defaulted).
`;
}
