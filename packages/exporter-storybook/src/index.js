/**
 * @transtyle/exporter-storybook — themes Storybook's chrome (ThemeVars) and
 * composes sibling targets into the preview. Spec: docs/specs/exporters/storybook.md.
 *
 * The meta-target: most of a design system is inexpressible in chrome theming
 * and flows through preview composition instead — `options.previewTargets`
 * lists sibling target INSTANCE names; core's ctx.siblings manifest supplies
 * their artifact locations (never their resolutions — the no-cross-target-
 * coupling invariant, plugins.md).
 *
 * Colors are emitted as hex: Storybook's theming pipeline (polished) does not
 * parse oklch() — the per-target output-syntax choice ir.md provides for.
 */

import { droppedDimensions } from '@transtyle/ir';

const S = 'semantic.color.';

/** Per-exporter composition knowledge: main stylesheet + mode encoding. */
const SIBLING_PROFILES = {
  shadcn: {
    stylesheet: 'globals.transtyle.css',
    encoding: '`.dark` class on <html>',
    decorator: (p) => `root.classList.toggle('dark', scheme === 'dark');`,
    // the canvas wears the DS canvas (F18) — mode-following via the sibling's own variables
    canvas: ["document.body.style.background = 'var(--background)';", "document.body.style.color = 'var(--foreground)';"],
  },
  daisyui: {
    stylesheet: 'daisyui.transtyle.css',
    encoding: 'data-theme attribute',
    decorator: (p) => `root.setAttribute('data-theme', \`${p}-\${scheme}\`);`,
  },
  bootstrap: {
    stylesheet: 'bootstrap-theme.css',
    encoding: 'data-bs-theme attribute',
    decorator: () => `root.setAttribute('data-bs-theme', scheme);`,
  },
};

export default {
  name: 'storybook',

  // Validated by core against the target's `options` at load time (audit A8).
  optionsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      previewTargets: { type: 'array', items: { type: 'string' } },
      remBase: { type: 'number' },
      brand: {
        type: 'object',
        additionalProperties: false,
        properties: { title: { type: 'string' }, url: { type: 'string' }, image: { type: 'string' } },
      },
    },
  },

  emit(normalized, ctx) {
    const modes = normalized.modeValues.filter((m) => normalized.modes[m]);
    const native = normalized.defaultMode;
    const remBase = ctx.targetConfig.options?.remBase ?? 16;
    const coverage = [];

    const variants = modes.map((mode) => buildThemeVars(normalized, mode, ctx, remBase, coverage));
    // Mode dimensions this exporter doesn't express (T8, ir.md#modes) — a
    // no-op unless the compile actually declares one, e.g. `density`.
    coverage.push(...droppedDimensions(normalized.dimensionNames, ['color-scheme']));

    const files = [
      { path: 'theme.transtyle.ts', contents: renderTheme(variants, ctx), kind: 'config' },
      { path: 'manager.transtyle.ts', contents: renderManager(native, ctx), kind: 'config' },
      { path: 'preview.transtyle.ts', contents: renderPreview(normalized, ctx, coverage), kind: 'config' },
      { path: 'usage.md', contents: renderUsage(ctx, coverage), kind: 'doc' },
    ];
    return { files, coverage };
  },
};

// ---------- ThemeVars construction ----------

function buildThemeVars(normalized, mode, ctx, remBase, coverage) {
  const map = normalized.modes[mode];
  const first = coverage.length === 0; // record coverage once (identical across modes)

  const val = (p) => map.get(S + p)?.value;
  const hx = (p) => {
    const v = val(p);
    return v ? ctx.formatHex(v).text : undefined;
  };
  const cov = (variable, slot, cls, note) => {
    if (!first) return;
    const provKind = map.get(slot.startsWith('semantic') ? slot : S + slot)?.provenance.kind;
    const klass = cls ?? (provKind === 'derived' ? 'derived' : 'native');
    coverage.push({ variable, slot: slot.startsWith('semantic') ? slot : S + slot, class: klass, ...(provKind && { provenance: provKind }), ...(note && { note }) });
  };
  const px = (radiusKey) => {
    const e = map.get(`semantic.radius.${radiusKey}`);
    if (!e) return undefined;
    const m = /^([\d.]+)(rem|px)$/.exec(String(e.value));
    if (!m) return undefined;
    return Math.round(parseFloat(m[1]) * (m[2] === 'rem' ? remBase : 1));
  };
  const fontList = (k) => {
    const e = map.get(`semantic.font.${k}`);
    return e ? e.value.map((f) => (/[^a-z-]/.test(f) ? `"${f}"` : f)).join(', ') : undefined;
  };

  cov('colorPrimary', 'primary.solid');
  cov('colorSecondary', 'accent.solid', undefined, "SB's actual highlight color (F14)");
  cov('appBg', 'elevation.1.surface');
  cov('appContentBg', 'elevation.0.surface');
  cov('appPreviewBg', 'elevation.0.surface', undefined, 'the canvas is the DS canvas, not chrome (F18)');
  cov('appBorderColor', 'border');
  cov('appBorderRadius', 'semantic.radius.md', 'approximated', `rem → px via remBase ${remBase} (F16)`);
  cov('fontBase', 'semantic.font.sans');
  cov('fontCode', 'semantic.font.mono');
  cov('textColor', 'text.base');
  cov('textInverseColor', 'text.inverse', 'native', 'engine-owned cross-mode read (F15)');
  cov('textMutedColor', 'text.muted');
  cov('barBg', 'elevation.1.surface');
  cov('barTextColor', 'text.muted');
  cov('barHoverColor', 'primary.solid-hover');
  cov('barSelectedColor', 'ring', undefined, 'ring ← primary (F3); lightened in dark for visibility');
  cov('buttonBg', 'neutral.tint');
  cov('buttonBorder', 'border');
  cov('booleanBg', 'neutral.tint');
  cov('booleanSelectedBg', 'elevation.2.surface');
  cov('inputBg', 'elevation.0.surface');
  cov('inputBorder', 'border');
  cov('inputTextColor', 'text.base');
  cov('inputBorderRadius', 'semantic.radius.sm', 'approximated', `rem → px via remBase ${remBase} (F16)`);
  if (first) {
    coverage.push({ variable: 'brandTitle', slot: '—', class: 'approximated', note: 'config `name`, not a token (F17); brandUrl/brandImage via options.brand' });
    coverage.push({ variable: '(chrome-inexpressible tokens)', slot: 'semantic.*', class: 'dropped', note: 'delivered through preview composition instead — see preview.transtyle.ts (dropped (chrome), validation-and-coverage.md)' });
  }

  const brand = ctx.targetConfig.options?.brand ?? {};
  return {
    mode,
    vars: {
      base: mode,
      colorPrimary: hx('primary.solid'),
      colorSecondary: hx('accent.solid'),
      appBg: hx('elevation.1.surface'),
      appContentBg: hx('elevation.0.surface'),
      appPreviewBg: hx('elevation.0.surface'),
      appBorderColor: hx('border'),
      appBorderRadius: px('md'),
      fontBase: fontList('sans'),
      fontCode: fontList('mono'),
      textColor: hx('text.base'),
      textInverseColor: hx('text.inverse') ?? hx('text.base'),
      textMutedColor: hx('text.muted'),
      barBg: hx('elevation.1.surface'),
      barTextColor: hx('text.muted'),
      barHoverColor: hx('primary.solid-hover'),
      barSelectedColor: hx('ring'),
      buttonBg: hx('neutral.tint'),
      buttonBorder: hx('border'),
      booleanBg: hx('neutral.tint'),
      booleanSelectedBg: hx('elevation.2.surface'),
      inputBg: hx('elevation.0.surface'),
      inputBorder: hx('border'),
      inputTextColor: hx('text.base'),
      inputBorderRadius: px('sm'),
      brandTitle: brand.title ?? ctx.projectName,
      ...(brand.url && { brandUrl: brand.url }),
      ...(brand.image && { brandImage: brand.image }),
    },
  };
}

// ---------- rendering ----------

const header = (ctx) => [
  '// GENERATED by transtyle — do not edit; source: ' + ctx.projectName + ' token files',
  '// Target: storybook (>=8 <10) · rules standard@1',
].join('\n');

function renderTheme(variants, ctx) {
  const lines = [
    header(ctx),
    '// Colors are hex, not OKLCH: Storybook\'s theming pipeline (polished) does not parse oklch().',
    '',
    "import { create } from 'storybook/theming';",
    '',
  ];
  for (const { mode, vars } of variants) {
    lines.push(`export const ${mode} = create({`);
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) continue;
      lines.push(`  ${k}: ${typeof v === 'number' ? v : `'${v}'`},`);
    }
    lines.push('});', '');
  }
  return lines.join('\n');
}

function renderManager(native, ctx) {
  return [
    header(ctx),
    '// Additive fragment: import from your own .storybook/manager.ts — we never',
    '// overwrite user config files. Chrome is themed with the design system\'s',
    `// NATIVE mode (\`${native}\` — the mode polarity rule): manager theming is`,
    '// static per boot, so the chrome wears the DS\'s default face. Both variants',
    '// live in theme.transtyle.ts for users who wire their own switch.',
    '',
    "import { addons } from 'storybook/manager-api';",
    `import { ${native} } from './theme.transtyle';`,
    '',
    `addons.setConfig({ theme: ${native} });`,
    '',
  ].join('\n');
}

function renderPreview(normalized, ctx, coverage) {
  const native = normalized.defaultMode;
  const modes = normalized.modeValues;
  const previewTargets = ctx.targetConfig.options?.previewTargets ?? [];
  const myOutput = ctx.targetConfig.output ?? 'dist/storybook';

  const importLines = [];
  const decoratorLines = [];
  for (const name of previewTargets) {
    const sibling = ctx.siblings.find((s) => s.name === name);
    const profile = sibling && SIBLING_PROFILES[sibling.exporter];
    if (!profile) {
      coverage.push({ variable: `previewTargets.${name}`, slot: '—', class: 'unsupported', note: 'unknown sibling target or exporter without a composition profile' });
      continue;
    }
    importLines.push(`import '${relPath(myOutput, sibling.output)}/${profile.stylesheet}';  // sibling: ${name} · mode encoding: ${profile.encoding}`);
    decoratorLines.push(`    ${profile.decorator(ctx.projectName)}  // ${name}`);
    if (profile.canvas && !decoratorLines.some((l) => l.includes('document.body.style'))) {
      decoratorLines.push(...profile.canvas.map((l) => `    ${l}  // canvas = DS canvas (F18), via ${name}'s variables`));
    }
    coverage.push({ variable: `previewTargets.${name}`, slot: '—', class: 'native', note: `composition by artifact path (${sibling.output}/${profile.stylesheet})` });
  }

  const bg = (mode) => {
    const v = normalized.modes[mode]?.get(`${S}elevation.0.surface`)?.value;
    return v ? ctx.formatHex(v).text : undefined;
  };
  coverage.push({ variable: 'globalTypes.colorScheme', slot: 'modes.color-scheme', class: 'native', note: 'mode dimension → SB global toolbar' });
  coverage.push({ variable: 'backgrounds.options', slot: `${S}elevation.0.surface`, class: 'native' });
  coverage.push({ variable: 'backgrounds.grid.cellSize', slot: '—', class: 'approximated', note: 'space.4 → px (defaulted scale); cellAmount/opacity are exporter defaults' });

  return [
    header(ctx),
    '// Additive fragment: spread into your own .storybook/preview.ts.',
    '// Sibling imports + the mode decorator are assembled from the build manifest',
    '// (artifact path + declared mode encoding) via ctx.siblings — exporters never',
    '// read each other\'s resolutions.',
    '',
    ...importLines,
    "import { " + modes.join(', ') + " } from './theme.transtyle';",
    '',
    'export const globalTypes = {',
    '  colorScheme: {',
    "    description: 'Design-system color scheme',",
    '    toolbar: {',
    "      title: 'Scheme',",
    "      icon: 'mirror',",
    '      items: [',
    ...modes.map((m) => `        { value: '${m}', title: '${m[0].toUpperCase()}${m.slice(1)}' },`),
    '      ],',
    '      dynamicTitle: true,',
    '    },',
    '  },',
    '};',
    '',
    `export const initialGlobals = { colorScheme: '${native}' };  // the DS's native mode`,
    '',
    '// One decorator drives every sibling\'s mode encoding',
    'export const decorators = [',
    '  (Story: any, context: any) => {',
    `    const scheme = context.globals.colorScheme ?? '${native}';`,
    '    const root = document.documentElement;',
    ...decoratorLines,
    '    return Story();',
    '  },',
    '];',
    '',
    'export const parameters = {',
    '  docs: {',
    `    theme: ${native},  // docs pages follow the DS native mode (chrome-static in SB, F18)`,
    '  },',
    '  backgrounds: {',
    '    options: {',
    ...modes.map((m) => `      ${m}: { name: '${ctx.projectName} ${m}', value: '${bg(m)}' },`),
    '    },',
    '    grid: { cellSize: 16, cellAmount: 4, opacity: 0.35 },',
    '  },',
    '};',
    '',
  ].join('\n');
}

/** POSIX relative path between two project-relative dirs (no node:path — exporters stay platform-pure). */
function relPath(from, to) {
  const f = from.split('/').filter(Boolean);
  const t = to.split('/').filter(Boolean);
  let i = 0;
  while (i < f.length && i < t.length && f[i] === t[i]) i++;
  return [...f.slice(i).map(() => '..'), ...t.slice(i)].join('/') || '.';
}

function renderUsage(ctx, coverage) {
  const counts = {};
  for (const c of coverage) counts[c.class] = (counts[c.class] ?? 0) + 1;
  const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(' · ');
  const previewTargets = ctx.targetConfig.options?.previewTargets ?? [];
  return `# Using this Storybook theme

Generated from the **${ctx.projectName}** design system by transtyle (Storybook >=8 <10). Coverage: ${summary}.

All files are **additive fragments** — import them from your own \`.storybook/\` config; we never overwrite user files.

## Wire the chrome theme

\`\`\`ts
// .storybook/manager.ts
import '../path/to/dist/storybook/manager.transtyle';
\`\`\`

(or import \`{ light, dark }\` from \`theme.transtyle\` and call \`addons.setConfig\` yourself).

## Wire the preview

\`\`\`ts
// .storybook/preview.ts
export * from '../path/to/dist/storybook/preview.transtyle';
\`\`\`

This imports the sibling targets' stylesheets (${previewTargets.join(', ') || 'none configured'}), adds a **Scheme** toolbar bound to the design system's \`color-scheme\` modes, and sets DS canvases as Storybook backgrounds. Configure siblings via \`options.previewTargets\` in \`transtyle.config.json\`.

## Regenerating

Never edit these files — change the design system tokens and run \`transtyle build storybook\`.
See \`report.json\` for the full coverage/provenance breakdown.
`;
}
