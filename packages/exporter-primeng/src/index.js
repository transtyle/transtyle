/**
 * @transtyle/exporter-primeng — emits a PrimeNG `definePreset(Aura, overrides)`
 * TypeScript module from the resolved IR. Spec: docs/proposals/0002-component-
 * theming-primeng.md; plan: docs/plan/component-tier.md C3-C5.
 *
 * NOT registered in the CLI yet (docs/plan/component-tier.md process note 3;
 * C6 does that). This is real, tested code — just not on the officially
 * supported surface until the five-surface sync rule applies to it.
 *
 * Strategy (proposal 0002 §5): override Aura, don't author a preset from
 * zero — anything not emitted here is filled by Aura's own default at
 * runtime. `semantic.*` here holds the global tier + the four archetype
 * groups (§2.3/§2.8/C1: exporter-private, not a catalog addition — see
 * archetypes.js). `components.*` holds the per-component color/structural
 * overrides — built by descriptors.js, which itself calls the one generic
 * `mapSeverityGrid` (severity-grid.js) for every severity-colored component.
 */

import { droppedDimensions } from '@transtyle/ir';
import { projectRamp } from './ramp.js';
import { field, list, navigation, overlay, content } from './archetypes.js';
import {
  buildButton, buildTag, buildBadge, buildMessage, buildInlineMessage,
  buildProgressBar, buildRating, buildListbox, buildMenu, buildPopover, buildDialog,
  STRUCTURAL_RESIDUE,
} from './descriptors.js';

const get = (map, path) => map.get(`semantic.${path}`)?.value;

export default {
  name: 'primeng',

  emit(normalized, ctx) {
    const map = normalized.modes.light ?? normalized.modes[normalized.defaultMode];
    const coverage = [];

    // A custom archetype role (T7) lands in `extend` per component, per
    // PrimeNG's own documented escape hatch (proposal 0002 §2.7) — proven
    // here on Button only (the one place the sketch specified).
    const archetypeRoles = [...normalized.roleArchetypes.keys()];
    const roleArchetypeExtend = archetypeRoles.length
      ? Object.fromEntries(archetypeRoles.map((r) => [r, {
          color: get(map, `color.${r}.solid`),
          contrastColor: get(map, `color.${r}.on-solid`),
          hoverColor: get(map, `color.${r}.solid-hover`),
        }]))
      : undefined;

    const primaryRamp = projectRamp(map, 'primary', ctx);
    const surfaceRamp = projectRamp(map, 'neutral', ctx, { includeZero: true });
    coverage.push(...primaryRamp.coverage.map((c) => ({ field: `semantic.primary.${c.step}`, slot: c.slot, class: c.class })));
    coverage.push(...surfaceRamp.coverage.map((c) => ({ field: `semantic.surface.${c.step}`, slot: c.slot, class: c.class })));

    const f = field(map);
    const l = list(map);
    const n = navigation(map);
    coverage.push({ field: 'semantic.formField.*', slot: 'exporter-private: field()', class: 'derived' });
    coverage.push({ field: 'semantic.list.*', slot: 'exporter-private: list()', class: 'derived' });
    coverage.push({ field: 'semantic.navigation.*', slot: 'exporter-private: navigation()', class: 'derived' });

    const semantic = {
      transitionDuration: get(map, 'duration.fast'),
      disabledOpacity: '0.6', // PrimeNG's own convention constant — no Transtyle equivalent to derive from
      iconSize: '1rem',
      focusRing: { width: '1px', style: 'solid', color: get(map, 'color.ring'), offset: '2px', shadow: 'none' },
      primary: {
        color: get(map, 'color.primary.solid'), contrastColor: get(map, 'color.primary.on-solid'),
        hoverColor: get(map, 'color.primary.solid-hover'), activeColor: get(map, 'color.primary.solid-active'),
        ...primaryRamp.ramp,
      },
      surface: surfaceRamp.ramp,
      highlight: { background: get(map, 'color.primary.tint'), focusBackground: get(map, 'color.primary.tint-hover'), color: get(map, 'color.primary.on-tint'), focusColor: get(map, 'color.primary.on-tint') },
      mask: { background: get(map, 'color.scrim'), color: get(map, 'color.neutral.tint') },
      formField: f,
      list: l,
      navigation: n,
      overlay: {
        select: overlay(map, 'select', ctx),
        popover: overlay(map, 'popover', ctx),
        modal: overlay(map, 'modal', ctx),
        navigation: overlay(map, 'navigation', ctx),
      },
      content: content(map),
    };
    coverage.push({ field: 'semantic.overlay.*', slot: 'semantic.color.elevation.N.{surface,shadow} + radius.*', class: 'native' });
    coverage.push({ field: 'semantic.content.*', slot: 'semantic.color.elevation.1.surface + border + text.base', class: 'native' });
    coverage.push({ field: 'semantic.mask.background', slot: 'semantic.color.scrim', class: 'native' });

    const button = buildButton(map, { ...ctx, roleArchetypeExtend });
    const tag = buildTag(map);
    const badge = buildBadge(map);
    const message = buildMessage(map);
    const inlinemessage = buildInlineMessage(map, ctx);
    const progressbar = buildProgressBar(map);
    const rating = buildRating(map);
    const listbox = buildListbox(map);
    const menu = buildMenu(map, ctx);
    const popover = buildPopover(map, ctx);
    const dialog = buildDialog(map, ctx);
    coverage.push(
      ...button.coverage, ...tag.coverage, ...badge.coverage, ...message.coverage, ...inlinemessage.coverage,
      ...progressbar.coverage, ...rating.coverage, ...listbox.coverage, ...menu.coverage, ...popover.coverage, ...dialog.coverage,
    );

    for (const name of STRUCTURAL_RESIDUE) {
      coverage.push({ field: `components.${name}`, slot: '—', class: 'unsupported', note: 'structural component with no severity-colored surface and no builder yet — inherits Aura\'s own default untouched (definePreset deep-merge)' });
    }
    coverage.push(...droppedDimensions(normalized.dimensionNames, ['color-scheme']));

    const components = {
      button: button.tokens, tag: tag.tokens, badge: badge.tokens, message: message.tokens, inlinemessage: inlinemessage.tokens,
      progressbar: progressbar.tokens, rating: rating.tokens, listbox: listbox.tokens, menu: menu.tokens, popover: popover.tokens, dialog: dialog.tokens,
    };

    const ts = renderPreset(ctx, semantic, components);
    return {
      files: [
        { path: 'preset.transtyle.ts', contents: ts, kind: 'source' },
        { path: 'usage.md', contents: renderUsage(ctx, coverage), kind: 'doc' },
      ],
      coverage,
    };
  },
};

// ---------- TS serialization ----------

function isColor(v) {
  return v && typeof v === 'object' && typeof v.l === 'number' && typeof v.c === 'number' && typeof v.h === 'number';
}

function serialize(value, ctx, indent = 2) {
  const pad = ' '.repeat(indent);
  const padIn = ' '.repeat(indent + 4);
  if (value === undefined) return undefined;
  if (isColor(value)) return JSON.stringify(ctx.formatColor(value));
  if (typeof value === 'string' || typeof value === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => serialize(v, ctx, indent)).join(', ')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([k, v]) => [k, serialize(v, ctx, indent + 4)])
      .filter(([, v]) => v !== undefined);
    if (!entries.length) return '{}';
    const key = (k) => (/^[0-9]/.test(k) ? JSON.stringify(k) : k);
    return `{\n${entries.map(([k, v]) => `${padIn}${key(k)}: ${v}`).join(',\n')}\n${pad}}`;
  }
  return undefined;
}

function renderPreset(ctx, semantic, components) {
  return `// GENERATED by transtyle — do not edit; source: ${ctx.projectName} token files
// Target: PrimeNG (definePreset over Aura) · rules standard@1
// See docs/proposals/0002-component-theming-primeng.md and usage.md (coverage) in this directory.
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

const ${camel(ctx.projectName)}Preset = definePreset(Aura, {
  semantic: ${serialize(semantic, ctx)},
  components: ${serialize(components, ctx)},
});

export default ${camel(ctx.projectName)}Preset;
`;
}

function camel(name) {
  return String(name).replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^[A-Z]/, (c) => c.toLowerCase()) || 'transtyle';
}

function renderUsage(ctx, coverage) {
  const counts = {};
  for (const c of coverage) counts[c.class] = (counts[c.class] ?? 0) + 1;
  const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(' · ');
  return `# Using this PrimeNG preset

Generated from the **${ctx.projectName}** design system by transtyle: a \`definePreset(Aura, { semantic, components })\` override — anything not listed here is inherited from PrimeNG's own Aura preset untouched. Coverage: ${summary}.

## Setup

\`\`\`ts
// app.config.ts
import { providePrimeNG } from 'primeng/config';
import preset from './preset.transtyle';

providePrimeNG({ theme: { preset } });
\`\`\`

## What's covered in this pass

Full \`variant x severity x state\` color grid: **Button**. Flat \`severity x part\`: **Tag**, **Badge**, **Message**, **InlineMessage**. Primary-anchored only (no severity axis in real PrimeNG — verified against source, not assumed): **ProgressBar**, **Rating**. Archetype-helper consumers (\`formField\`/\`list\`/\`navigation\`/\`overlay\`, exporter-private per the C1 cross-ecosystem study — see docs/findings/component-tier-study.md): **Listbox**, **Menu**, **Popover**, **Dialog**.

Structural components with no severity-colored surface (DataTable, Galleria, Tree, Splitter, Timeline, ...) are left on Aura's own defaults for now — see \`report.json\` for the full list, each marked \`unsupported\`.

## Regenerating

Never edit this file — change the design system tokens and run \`transtyle build primeng\` (once C6 registers it; for now, this exporter is invoked directly, not via the CLI). See \`report.json\` for the full coverage/provenance breakdown.
`;
}
