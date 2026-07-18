/**
 * @transtyle/exporter-shadcn — emits a shadcn/ui theme (globals CSS) from the
 * resolved IR. Spec: docs/specs/exporters/shadcn.md. Skeleton supports the
 * tailwind-v4 era profile and the color-scheme mode dimension.
 */

const S = 'semantic.color.';
const P = 'semantic.palette.categorical.';

/**
 * Mapping table (declarative part of the exporter).
 * class: coverage classification when the source slot was authored/aliased;
 * derived provenance downgrades native → derived automatically.
 */
const MAPPING = [
  { css: '--background', slot: `${S}background.base`, cls: 'native' },
  { css: '--foreground', slot: `${S}text.base`, cls: 'native' },
  { css: '--card', slot: `${S}surface.base`, cls: 'native' },
  { css: '--card-foreground', slot: `${S}text.base`, cls: 'native' },
  { css: '--popover', slot: `${S}overlay.base`, cls: 'native' },
  { css: '--popover-foreground', slot: `${S}text.base`, cls: 'native' },
  { css: '--primary', slot: `${S}primary.base`, cls: 'native' },
  { css: '--primary-foreground', slot: `${S}text-on-primary.base`, cls: 'native' },
  // shadcn "secondary"/"accent"/"muted" are subtle surfaces, not brand roles (exercise F1 note)
  { css: '--secondary', slot: `${S}neutral.subtle`, cls: 'native' },
  { css: '--secondary-foreground', slot: `${S}text-on-neutral.subtle`, cls: 'native' },
  { css: '--muted', slot: `${S}neutral.subtle`, cls: 'native' },
  { css: '--muted-foreground', slot: `${S}text-muted.base`, cls: 'native' },
  { css: '--accent', slot: `${S}accent.subtle`, cls: 'native' },
  { css: '--accent-foreground', slot: `${S}text-on-accent.subtle`, cls: 'native' },
  { css: '--destructive', slot: `${S}danger.base`, cls: 'native' },
  { css: '--destructive-foreground', slot: `${S}text-on-danger.base`, cls: 'native' },
  { css: '--border', slot: `${S}border.base`, cls: 'native' },
  // shadcn distinguishes input borders; the IR does not (exercise F4)
  { css: '--input', slot: `${S}border.base`, cls: 'approximated' },
  { css: '--ring', slot: `${S}ring.base`, cls: 'native' },
  { css: '--chart-1', slot: `${P}1`, cls: 'native' },
  { css: '--chart-2', slot: `${P}2`, cls: 'native' },
  { css: '--chart-3', slot: `${P}3`, cls: 'native' },
  { css: '--chart-4', slot: `${P}4`, cls: 'native' },
  { css: '--chart-5', slot: `${P}5`, cls: 'native' },
  // sidebar family: component-tier concern mapped by exporter convention (exercise F6)
  { css: '--sidebar', slot: `${S}surface.base`, cls: 'native', note: 'exporter convention' },
  { css: '--sidebar-foreground', slot: `${S}text.base`, cls: 'native', note: 'exporter convention' },
  { css: '--sidebar-primary', slot: `${S}primary.base`, cls: 'native', note: 'exporter convention' },
  { css: '--sidebar-primary-foreground', slot: `${S}text-on-primary.base`, cls: 'native', note: 'exporter convention' },
  { css: '--sidebar-accent', slot: `${S}accent.subtle`, cls: 'native', note: 'exporter convention' },
  { css: '--sidebar-accent-foreground', slot: `${S}text-on-accent.subtle`, cls: 'native', note: 'exporter convention' },
  { css: '--sidebar-border', slot: `${S}border.base`, cls: 'native', note: 'exporter convention' },
  { css: '--sidebar-ring', slot: `${S}ring.base`, cls: 'native', note: 'exporter convention' },
];

export default {
  name: 'shadcn',

  emit(normalized, ctx) {
    const era = ctx.targetConfig.options?.era ?? 'tailwind-v4';
    if (era !== 'tailwind-v4') {
      throw new Error(`exporter-shadcn skeleton supports era "tailwind-v4" only (got "${era}")`);
    }
    const light = normalized.modes[normalized.defaultMode];
    const dark = normalized.modes.dark;

    const coverage = [];
    const lines = { light: [], dark: [] };

    for (const m of MAPPING) {
      const entry = light.get(m.slot);
      if (!entry?.value) {
        coverage.push({ variable: m.css, slot: m.slot, class: 'unsupported', note: 'slot missing from IR' });
        continue;
      }
      const provKind = entry.provenance.kind;
      const cls = m.cls === 'approximated' ? 'approximated'
        : (provKind === 'derived' ? 'derived' : m.cls);
      coverage.push({ variable: m.css, slot: m.slot, class: cls, provenance: provKind, ...(m.note && { note: m.note }) });

      lines.light.push(cssLine(m.css, ctx.formatColor(entry.value), m.slot, provKind));
      if (dark) {
        const dEntry = dark.get(m.slot);
        if (dEntry?.value) lines.dark.push(cssLine(m.css, ctx.formatColor(dEntry.value), m.slot, dEntry.provenance.kind));
      }
    }

    // Non-color slots
    const radius = light.get('semantic.radius.md');
    const fontSans = light.get('semantic.font.sans');
    const fontMono = light.get('semantic.font.mono');
    if (radius) coverage.push({ variable: '--radius', slot: 'semantic.radius.md', class: 'native', provenance: radius.provenance.kind });
    for (const [v, e, slot] of [['--font-sans', fontSans, 'semantic.font.sans'], ['--font-mono', fontMono, 'semantic.font.mono']]) {
      if (e) coverage.push({ variable: v, slot, class: 'native', provenance: e.provenance.kind });
    }

    const css = renderCss({ lines, radius, fontSans, fontMono, ctx });
    const usage = renderUsage(ctx, coverage);

    return {
      files: [
        { path: 'globals.transtyle.css', contents: css, kind: 'stylesheet' },
        { path: 'usage.md', contents: usage, kind: 'doc' },
      ],
      coverage,
    };
  },
};

function cssLine(name, value, slot, prov) {
  const tag = prov === 'derived' ? ' · derived' : '';
  return `  ${name}: ${value}; /* ${slot.replace('semantic.', '')}${tag} */`;
}

function fontList(value) {
  return value.map((f) => (/[^a-z-]/.test(f) ? `"${f}"` : f)).join(', ');
}

function renderCss({ lines, radius, fontSans, fontMono, ctx }) {
  const rootExtras = radius ? [`  --radius: ${radius.value}; /* radius.md */`] : [];
  const themeVars = [
    '--color-background', '--color-foreground', '--color-card', '--color-card-foreground',
    '--color-popover', '--color-popover-foreground', '--color-primary', '--color-primary-foreground',
    '--color-secondary', '--color-secondary-foreground', '--color-muted', '--color-muted-foreground',
    '--color-accent', '--color-accent-foreground', '--color-destructive', '--color-destructive-foreground',
    '--color-border', '--color-input', '--color-ring',
    '--color-chart-1', '--color-chart-2', '--color-chart-3', '--color-chart-4', '--color-chart-5',
    '--color-sidebar', '--color-sidebar-foreground', '--color-sidebar-primary', '--color-sidebar-primary-foreground',
    '--color-sidebar-accent', '--color-sidebar-accent-foreground', '--color-sidebar-border', '--color-sidebar-ring',
  ].map((v) => `  ${v}: var(${v.replace('--color-', '--')});`);

  const themeExtras = [];
  if (fontSans) themeExtras.push(`  --font-sans: ${fontList(fontSans.value)};`);
  if (fontMono) themeExtras.push(`  --font-mono: ${fontList(fontMono.value)};`);
  if (radius) {
    themeExtras.push('  --radius-sm: calc(var(--radius) - 4px);');
    themeExtras.push('  --radius-md: calc(var(--radius) - 2px);');
    themeExtras.push('  --radius-lg: var(--radius);');
    themeExtras.push('  --radius-xl: calc(var(--radius) + 4px);');
  }

  return [
    '/*',
    ` * GENERATED by transtyle — do not edit; source: ${ctx.projectName} token files`,
    ' * Target: shadcn (era: tailwind-v4) · rules standard@1 (skeleton subset)',
    ' */',
    '',
    ':root {',
    ...rootExtras,
    ...lines.light,
    '}',
    '',
    '.dark {',
    ...lines.dark,
    '}',
    '',
    '@theme inline {',
    ...themeVars,
    ...themeExtras,
    '}',
    '',
  ].join('\n');
}

function renderUsage(ctx, coverage) {
  const counts = {};
  for (const c of coverage) counts[c.class] = (counts[c.class] ?? 0) + 1;
  const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(' · ');
  return `# Using this shadcn theme

Generated from the **${ctx.projectName}** design system by transtyle. Coverage: ${summary}.

## Tailwind v4 project (shadcn "new-york" / CLI ≥ 2.x era)

1. Copy \`globals.transtyle.css\` into your app (e.g. \`app/globals.transtyle.css\`).
2. In your global stylesheet, import it **after** Tailwind:

   \`\`\`css
   @import "tailwindcss";
   @import "./globals.transtyle.css";
   \`\`\`

   (Or replace the \`:root\`/\`.dark\`/\`@theme inline\` blocks that \`npx shadcn init\` created with the ones from this file.)
3. Dark mode: add the \`dark\` class on \`<html>\` (class strategy), as in standard shadcn setups.

## Regenerating

Never edit this file — change the design system tokens and run \`transtyle build shadcn\` again.
See \`report.json\` next to this file for the full coverage/provenance breakdown.
`;
}
