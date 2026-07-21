/**
 * @transtyle/exporter-daisyui — emits daisyUI v5 theme blocks
 * (`@plugin "daisyui/theme" { … }`, Tailwind 4 era, OKLCH-native).
 *
 * Notable vs shadcn: daisyUI's `secondary`/`accent` are true BRAND roles —
 * they map from our brand slots directly, not from subtle surfaces. Same
 * words, different meanings per ecosystem; the mapping tables encode it
 * (docs/language.md "false friends").
 */

import { droppedDimensions } from '@transtyle/ir';

const S = 'semantic.color.';

/** slot → daisyUI variable; content = paired foreground slot. */
const COLOR_MAPPING = [
  { css: '--color-base-100', slot: `${S}elevation.0.surface`, cls: 'native' },
  { css: '--color-base-200', slot: `${S}elevation.1.surface`, cls: 'native' },
  // base-300 is the third step of a background ramp; border is the closest tone we have
  { css: '--color-base-300', slot: `${S}border`, cls: 'approximated', note: 'bg-ramp step ← border tone' },
  { css: '--color-base-content', slot: `${S}text.base`, cls: 'native' },
  { css: '--color-primary', slot: `${S}primary.solid`, cls: 'native' },
  { css: '--color-primary-content', slot: `${S}primary.on-solid`, cls: 'native' },
  { css: '--color-secondary', slot: `${S}secondary.solid`, cls: 'native', note: 'true brand secondary (unlike shadcn)' },
  { css: '--color-secondary-content', slot: `${S}secondary.on-solid`, cls: 'native' },
  { css: '--color-accent', slot: `${S}accent.solid`, cls: 'native' },
  { css: '--color-accent-content', slot: `${S}accent.on-solid`, cls: 'native' },
  { css: '--color-neutral', slot: `${S}neutral.solid`, cls: 'native' },
  { css: '--color-neutral-content', slot: `${S}neutral.on-solid`, cls: 'native' },
  { css: '--color-info', slot: `${S}info.solid`, cls: 'native' },
  { css: '--color-info-content', slot: `${S}info.on-solid`, cls: 'native' },
  { css: '--color-success', slot: `${S}success.solid`, cls: 'native' },
  { css: '--color-success-content', slot: `${S}success.on-solid`, cls: 'native' },
  { css: '--color-warning', slot: `${S}warning.solid`, cls: 'native' },
  { css: '--color-warning-content', slot: `${S}warning.on-solid`, cls: 'native' },
  { css: '--color-error', slot: `${S}danger.solid`, cls: 'native', note: 'name translation: danger → error' },
  { css: '--color-error-content', slot: `${S}danger.on-solid`, cls: 'native' },
];

export default {
  name: 'daisyui',

  emit(normalized, ctx) {
    const era = ctx.targetConfig.options?.era ?? 'v5';
    if (era !== 'v5') throw new Error(`exporter-daisyui skeleton supports era "v5" only (got "${era}")`);

    // Mode polarity rule: bind mode names, never the default flag.
    const light = normalized.modes.light ?? normalized.modes[normalized.defaultMode];
    const dark = normalized.modes.dark;

    const coverage = [];
    const radius = light.get('semantic.radius.md');
    const blocks = [];

    const themeBlock = (map, mode, flags) => {
      const lines = [
        `@plugin "daisyui/theme" {`,
        `  name: "${ctx.projectName}-${mode}";`,
        ...flags,
        `  color-scheme: ${mode};`,
      ];
      for (const m of COLOR_MAPPING) {
        const entry = map.get(m.slot);
        if (!entry?.value) {
          if (mode === 'light') coverage.push({ variable: m.css, slot: m.slot, class: 'unsupported', note: 'slot missing from IR' });
          continue;
        }
        if (mode === 'light') {
          const provKind = entry.provenance.kind;
          const cls = m.cls === 'approximated' ? 'approximated' : (provKind === 'derived' ? 'derived' : m.cls);
          coverage.push({ variable: m.css, slot: m.slot, class: cls, provenance: provKind, ...(m.note && { note: m.note }) });
        }
        lines.push(`  ${m.css}: ${ctx.formatColor(entry.value)}; /* ${m.slot.replace('semantic.', '')} */`);
      }
      // Custom archetyped roles (T7): daisyUI has an open color set — any
      // `--color-<name>` custom property becomes a usable utility color.
      for (const name of normalized.roleArchetypes.keys()) {
        const solid = map.get(`${S}${name}.solid`);
        if (!solid?.value) continue;
        const onSolid = map.get(`${S}${name}.on-solid`);
        if (mode === 'light') {
          coverage.push({ variable: `--color-${name}`, slot: `${S}${name}.solid`, class: 'native', note: 'custom role archetype (open role set)' });
        }
        lines.push(`  --color-${name}: ${ctx.formatColor(solid.value)}; /* ${name}.solid */`);
        if (onSolid?.value) {
          if (mode === 'light') coverage.push({ variable: `--color-${name}-content`, slot: `${S}${name}.on-solid`, class: 'native' });
          lines.push(`  --color-${name}-content: ${ctx.formatColor(onSolid.value)}; /* ${name}.on-solid */`);
        }
      }
      if (radius) {
        // daisyUI splits radius by component family; one authored radius feeds all three
        lines.push(`  --radius-selector: ${radius.value};`);
        lines.push(`  --radius-field: ${radius.value};`);
        lines.push(`  --radius-box: ${radius.value};`);
      }
      lines.push('}');
      return lines.join('\n');
    };

    blocks.push(themeBlock(light, 'light', ['  default: true;', '  prefersdark: false;']));
    if (dark) blocks.push(themeBlock(dark, 'dark', ['  prefersdark: true;']));

    if (radius) {
      coverage.push({ variable: '--radius-{selector,field,box}', slot: 'semantic.radius.md', class: 'approximated', provenance: radius.provenance.kind, note: 'one radius feeds three component families' });
    }
    coverage.push({ variable: '--depth / --noise / --size-*', slot: '—', class: 'dropped', note: 'daisyUI stylistic effects with no token semantics; theme uses daisyUI defaults' });
    // Mode dimensions this exporter doesn't express (T8, ir.md#modes) — a
    // no-op unless the compile actually declares one, e.g. `density`.
    coverage.push(...droppedDimensions(normalized.dimensionNames, ['color-scheme']));

    const css = [
      '/*',
      ` * GENERATED by transtyle — do not edit; source: ${ctx.projectName} token files`,
      ' * Target: daisyUI (era: v5, Tailwind 4) · rules standard@1 (skeleton subset)',
      ' */',
      '',
      ...blocks,
      '',
    ].join('\n');

    return {
      files: [
        { path: 'daisyui.transtyle.css', contents: css, kind: 'stylesheet' },
        { path: 'usage.md', contents: renderUsage(ctx, coverage), kind: 'doc' },
      ],
      coverage,
    };
  },
};

function renderUsage(ctx, coverage) {
  const counts = {};
  for (const c of coverage) counts[c.class] = (counts[c.class] ?? 0) + 1;
  const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(' · ');
  return `# Using this daisyUI theme

Generated from the **${ctx.projectName}** design system by transtyle (daisyUI v5, Tailwind 4). Coverage: ${summary}.

## Install

In your global CSS, after Tailwind and the daisyUI plugin:

\`\`\`css
@import "tailwindcss";
@plugin "daisyui" {
  themes: ${ctx.projectName}-light --default, ${ctx.projectName}-dark --prefersdark;
}
@import "./daisyui.transtyle.css";
\`\`\`

The light theme is the default; the dark theme activates via \`prefers-color-scheme\` (or set \`data-theme="${ctx.projectName}-dark"\` manually — standard daisyUI behavior).

## Notes

- daisyUI's \`secondary\`/\`accent\` are mapped from your **brand** secondary/accent — in shadcn the same words mean subtle surfaces. Same design system, correct meaning in each ecosystem.
- \`--color-base-300\` is approximated from your border tone (daisyUI wants a third background-ramp step the IR doesn't define; see report.json).
- Regenerate with \`transtyle build daisyui\`; never edit this file.
`;
}
