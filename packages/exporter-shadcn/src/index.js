/**
 * @transtyle/exporter-shadcn — emits a shadcn/ui theme from the resolved IR.
 * Spec: docs/specs/exporters/shadcn.md. Two era profiles (ADR-0006 mapping
 * profiles): "tailwind-v4" (OKLCH + @theme inline) and "tailwind-v3"
 * (HSL channel triplets + tailwind.config snippet). Selected via target
 * options.era in transtyle.config.json — never via CLI flags.
 */

import { droppedDimensions } from '@transtyle/ir';

const S = 'semantic.color.';
const P = 'semantic.palette.categorical.';

/** Declarative mapping table, shared by both era profiles. Grid cells per
 * docs/architecture/ir.md#color-the-role-grid: solid = principal fill,
 * tint = wash, on-* = the paired foreground. */
const MAPPING = [
  { css: '--background', slot: `${S}elevation.0.surface`, cls: 'native' },
  { css: '--foreground', slot: `${S}text.base`, cls: 'native' },
  { css: '--card', slot: `${S}elevation.1.surface`, cls: 'native' },
  { css: '--card-foreground', slot: `${S}text.base`, cls: 'native' },
  { css: '--popover', slot: `${S}elevation.3.surface`, cls: 'native' },
  { css: '--popover-foreground', slot: `${S}text.base`, cls: 'native' },
  { css: '--primary', slot: `${S}primary.solid`, cls: 'native' },
  { css: '--primary-foreground', slot: `${S}primary.on-solid`, cls: 'native' },
  // shadcn "secondary"/"accent"/"muted" are subtle surfaces, not brand roles (exercise F1 note)
  { css: '--secondary', slot: `${S}neutral.tint`, cls: 'native' },
  { css: '--secondary-foreground', slot: `${S}neutral.on-tint`, cls: 'native' },
  { css: '--muted', slot: `${S}neutral.tint`, cls: 'native' },
  { css: '--muted-foreground', slot: `${S}text.muted`, cls: 'native' },
  { css: '--accent', slot: `${S}accent.tint`, cls: 'native' },
  { css: '--accent-foreground', slot: `${S}accent.on-tint`, cls: 'native' },
  { css: '--destructive', slot: `${S}danger.solid`, cls: 'native' },
  { css: '--destructive-foreground', slot: `${S}danger.on-solid`, cls: 'native' },
  { css: '--border', slot: `${S}border`, cls: 'native' },
  // shadcn distinguishes input borders; the IR does not (exercise F4)
  { css: '--input', slot: `${S}border`, cls: 'approximated' },
  { css: '--ring', slot: `${S}ring`, cls: 'native' },
  { css: '--chart-1', slot: `${P}1`, cls: 'native' },
  { css: '--chart-2', slot: `${P}2`, cls: 'native' },
  { css: '--chart-3', slot: `${P}3`, cls: 'native' },
  { css: '--chart-4', slot: `${P}4`, cls: 'native' },
  { css: '--chart-5', slot: `${P}5`, cls: 'native' },
  // sidebar family: component-tier concern mapped by exporter convention (exercise F6)
  { css: '--sidebar', slot: `${S}elevation.1.surface`, cls: 'native', note: 'exporter convention' },
  { css: '--sidebar-foreground', slot: `${S}text.base`, cls: 'native', note: 'exporter convention' },
  { css: '--sidebar-primary', slot: `${S}primary.solid`, cls: 'native', note: 'exporter convention' },
  { css: '--sidebar-primary-foreground', slot: `${S}primary.on-solid`, cls: 'native', note: 'exporter convention' },
  { css: '--sidebar-accent', slot: `${S}accent.tint`, cls: 'native', note: 'exporter convention' },
  { css: '--sidebar-accent-foreground', slot: `${S}accent.on-tint`, cls: 'native', note: 'exporter convention' },
  { css: '--sidebar-border', slot: `${S}border`, cls: 'native', note: 'exporter convention' },
  { css: '--sidebar-ring', slot: `${S}ring`, cls: 'native', note: 'exporter convention' },
];

const ERAS = ['tailwind-v4', 'tailwind-v3'];

export default {
  name: 'shadcn',

  // Validated by core against the target's `options` at load time (audit A8).
  optionsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: { era: { type: 'string', enum: ['tailwind-v3', 'tailwind-v4'] } },
  },

  emit(normalized, ctx) {
    const era = ctx.targetConfig.options?.era ?? 'tailwind-v4';
    if (!ERAS.includes(era)) {
      throw new Error(`exporter-shadcn: unknown era "${era}" (supported: ${ERAS.join(', ')})`);
    }
    // Mode polarity: shadcn's structure is fixed (:root = light, .dark = dark).
    // Bind mode NAMES, never the DS's default flag — a dark-native design
    // system still compiles to shadcn's light-first layout (ir.md#modes).
    const light = normalized.modes.light ?? normalized.modes[normalized.defaultMode];
    const dark = normalized.modes.dark;

    // RESOLVE: shared, era-independent
    const coverage = [];
    const vars = [];
    for (const m of MAPPING) {
      const lightEntry = light.get(m.slot);
      if (!lightEntry?.value) {
        coverage.push({ variable: m.css, slot: m.slot, class: 'unsupported', note: 'slot missing from IR' });
        continue;
      }
      const darkEntry = dark?.get(m.slot);
      const provKind = lightEntry.provenance.kind;
      let cls = m.cls === 'approximated' ? 'approximated' : (provKind === 'derived' ? 'derived' : m.cls);
      let note = m.note;
      if (era === 'tailwind-v3') {
        // oklch → HSL may clamp out-of-sRGB-gamut colors
        const clamped = ctx.formatHslTriplet(lightEntry.value).clamped
          || (darkEntry?.value && ctx.formatHslTriplet(darkEntry.value).clamped);
        if (clamped) { cls = 'approximated'; note = 'sRGB gamut clamp (HSL era)'; }
      }
      coverage.push({ variable: m.css, slot: m.slot, class: cls, provenance: provKind, ...(note && { note }) });
      vars.push({ ...m, lightEntry, darkEntry });
    }

    const radius = light.get('semantic.radius.md');
    const fontSans = light.get('semantic.font.sans');
    const fontMono = light.get('semantic.font.mono');
    if (radius) coverage.push({ variable: '--radius', slot: 'semantic.radius.md', class: 'native', provenance: radius.provenance.kind });
    for (const [v, e, slot] of [['--font-sans', fontSans, 'semantic.font.sans'], ['--font-mono', fontMono, 'semantic.font.mono']]) {
      if (e) coverage.push({ variable: v, slot, class: 'native', provenance: e.provenance.kind });
    }
    // Mode dimensions this exporter doesn't express (T8, ir.md#modes) — a
    // no-op unless the compile actually declares one, e.g. `density`.
    coverage.push(...droppedDimensions(normalized.dimensionNames, ['color-scheme']));

    // EMIT: era profile decides artifacts
    const shared = { vars, radius, fontSans, fontMono, ctx };
    const files = era === 'tailwind-v4' ? emitV4(shared) : emitV3(shared);
    files.push({ path: 'usage.md', contents: renderUsage(ctx, coverage, era), kind: 'doc' });
    return { files, coverage };
  },
};

// ---------- shared helpers ----------

const header = (ctx, era) => [
  '/*',
  ` * GENERATED by transtyle — do not edit; source: ${ctx.projectName} token files`,
  ` * Target: shadcn (era: ${era}) · rules standard@1 (skeleton subset)`,
  ' */',
  '',
].join('\n');

const cssLine = (name, value, slot, prov) =>
  `  ${name}: ${value}; /* ${slot.replace('semantic.', '')}${prov === 'derived' ? ' · derived' : ''} */`;

const fontList = (value) => value.map((f) => (/[^a-z-]/.test(f) ? `"${f}"` : f)).join(', ');

function colorBlocks(vars, fmt) {
  const lines = { light: [], dark: [] };
  for (const v of vars) {
    lines.light.push(cssLine(v.css, fmt(v.lightEntry.value), v.slot, v.lightEntry.provenance.kind));
    if (v.darkEntry?.value) lines.dark.push(cssLine(v.css, fmt(v.darkEntry.value), v.slot, v.darkEntry.provenance.kind));
  }
  return lines;
}

// ---------- tailwind-v4 profile ----------

function emitV4({ vars, radius, fontSans, fontMono, ctx }) {
  const lines = colorBlocks(vars, (c) => ctx.formatColor(c));
  const themeVars = vars.map((v) => `  --color${v.css.slice(1)}: var(${v.css});`);
  const extras = [];
  if (fontSans) extras.push(`  --font-sans: ${fontList(fontSans.value)};`);
  if (fontMono) extras.push(`  --font-mono: ${fontList(fontMono.value)};`);
  if (radius) {
    extras.push('  --radius-sm: calc(var(--radius) - 4px);');
    extras.push('  --radius-md: calc(var(--radius) - 2px);');
    extras.push('  --radius-lg: var(--radius);');
    extras.push('  --radius-xl: calc(var(--radius) + 4px);');
  }
  const css = [
    header(ctx, 'tailwind-v4'),
    ':root {',
    ...(radius ? [`  --radius: ${radius.value}; /* radius.md */`] : []),
    ...lines.light,
    '}',
    '',
    '.dark {',
    ...lines.dark,
    '}',
    '',
    '@theme inline {',
    ...themeVars,
    ...extras,
    '}',
    '',
  ].join('\n');
  return [{ path: 'globals.transtyle.css', contents: css, kind: 'stylesheet' }];
}

// ---------- tailwind-v3 profile ----------

function emitV3({ vars, radius, fontSans, fontMono, ctx }) {
  const lines = colorBlocks(vars, (c) => ctx.formatHslTriplet(c).text);
  const css = [
    header(ctx, 'tailwind-v3'),
    '@layer base {',
    '  :root {',
    ...(radius ? [`    --radius: ${radius.value}; /* radius.md */`] : []),
    ...lines.light.map((l) => '  ' + l),
    '  }',
    '',
    '  .dark {',
    ...lines.dark.map((l) => '  ' + l),
    '  }',
    '}',
    '',
  ].join('\n');

  const wrap = (name) => `"hsl(var(${name}))"`;
  const roleObj = (base, fg) => `{ DEFAULT: ${wrap(base)}, foreground: ${wrap(fg)} }`;
  const config = [
    '/*',
    ` * GENERATED by transtyle — do not edit; source: ${ctx.projectName} token files`,
    ' * Merge into your tailwind.config theme:',
    ' *   const transtyle = require("./tailwind.theme.transtyle.cjs");',
    ' *   module.exports = { theme: { extend: transtyle } };',
    ' */',
    'module.exports = {',
    '  colors: {',
    `    border: ${wrap('--border')},`,
    `    input: ${wrap('--input')},`,
    `    ring: ${wrap('--ring')},`,
    `    background: ${wrap('--background')},`,
    `    foreground: ${wrap('--foreground')},`,
    `    primary: ${roleObj('--primary', '--primary-foreground')},`,
    `    secondary: ${roleObj('--secondary', '--secondary-foreground')},`,
    `    destructive: ${roleObj('--destructive', '--destructive-foreground')},`,
    `    muted: ${roleObj('--muted', '--muted-foreground')},`,
    `    accent: ${roleObj('--accent', '--accent-foreground')},`,
    `    popover: ${roleObj('--popover', '--popover-foreground')},`,
    `    card: ${roleObj('--card', '--card-foreground')},`,
    `    chart: { "1": ${wrap('--chart-1')}, "2": ${wrap('--chart-2')}, "3": ${wrap('--chart-3')}, "4": ${wrap('--chart-4')}, "5": ${wrap('--chart-5')} },`,
    '  },',
    '  borderRadius: {',
    '    lg: "var(--radius)",',
    '    md: "calc(var(--radius) - 2px)",',
    '    sm: "calc(var(--radius) - 4px)",',
    '  },',
    ...(fontSans || fontMono ? [
      '  fontFamily: {',
      ...(fontSans ? [`    sans: ${JSON.stringify(fontSans.value)},`] : []),
      ...(fontMono ? [`    mono: ${JSON.stringify(fontMono.value)},`] : []),
      '  },',
    ] : []),
    '};',
    '',
  ].join('\n');

  return [
    { path: 'globals.transtyle.css', contents: css, kind: 'stylesheet' },
    { path: 'tailwind.theme.transtyle.cjs', contents: config, kind: 'config' },
  ];
}

// ---------- usage ----------

function renderUsage(ctx, coverage, era) {
  const counts = {};
  for (const c of coverage) counts[c.class] = (counts[c.class] ?? 0) + 1;
  const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(' · ');
  const eraSteps = era === 'tailwind-v4'
    ? `## Tailwind v4 project (shadcn CLI ≥ 2.x era)

1. Copy \`globals.transtyle.css\` into your app (e.g. \`app/globals.transtyle.css\`).
2. In your global stylesheet, import it **after** Tailwind:

   \`\`\`css
   @import "tailwindcss";
   @import "./globals.transtyle.css";
   \`\`\`

   (Or replace the \`:root\`/\`.dark\`/\`@theme inline\` blocks that \`npx shadcn init\` created.)
3. Dark mode: add the \`dark\` class on \`<html>\` (class strategy), as in standard shadcn setups.`
    : `## Tailwind v3 project (shadcn "old" era, hsl(var(--x)) convention)

1. Copy \`globals.transtyle.css\` into your app and import it in your global CSS
   (it replaces the \`@layer base\` variable blocks from \`npx shadcn-ui init\`).
2. Merge \`tailwind.theme.transtyle.cjs\` into your \`tailwind.config\`:

   \`\`\`js
   const transtyle = require("./tailwind.theme.transtyle.cjs");
   module.exports = { darkMode: ["class"], theme: { extend: transtyle } };
   \`\`\`
3. Dark mode: class strategy (\`darkMode: ["class"]\`), toggle \`dark\` on \`<html>\`.`;

  return `# Using this shadcn theme

Generated from the **${ctx.projectName}** design system by transtyle (era: **${era}**). Coverage: ${summary}.

${eraSteps}

## Regenerating

Never edit these files — change the design system tokens and run \`transtyle build\` again.
See \`report.json\` next to this file for the full coverage/provenance breakdown.
`;
}
