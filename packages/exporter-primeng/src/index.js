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
 *
 * Verified directly by compiling the emitted preset against PrimeNG's own
 * DesignTokens TypeScript types (docs/worklog/2026-07-21-component-tier-c3-c5.md):
 * every color-ish group in real PrimeNG splits into a mode-invariant top-level
 * object (padding/gap/radius/shadow-shape) and a SEPARATE `colorScheme.{light,
 * dark}.<group>` object — never a single flat object with both. This file
 * builds both per-mode maps and assembles that split throughout.
 */

import { droppedDimensions } from '@transtyle/ir';
import { projectRamp } from './ramp.js';
import { field, list, navigation, overlay, content } from './archetypes.js';
import { coverageRows, INVENTORY } from './surface-coverage.js';
import {
  buildButton,
  buildTag,
  buildBadge,
  buildMessage,
  buildInlineMessage,
  buildProgressBar,
  buildRating,
  buildListbox,
  buildMenu,
  buildPopover,
  buildDialog,
} from './descriptors.js';

const get = (map, path) => map.get(`semantic.${path}`)?.value;

export default {
  name: 'primeng',

  emit(normalized, ctx) {
    const light = normalized.modes.light ?? normalized.modes[normalized.defaultMode];
    const dark = normalized.modes.dark ?? light;
    const coverage = [];

    // A custom archetype role (T7) lands in `extend` per component, per
    // PrimeNG's own documented escape hatch (proposal 0002 §2.7) — proven
    // here on Button only (the one place the sketch specified). `extend` is
    // unconstrained by PrimeNG's own types, so no mode-split is required here.
    const archetypeRoles = [...normalized.roleArchetypes.keys()];
    const roleArchetypeExtend = archetypeRoles.length
      ? Object.fromEntries(
          archetypeRoles.map((r) => [
            r,
            {
              color: get(light, `color.${r}.solid`),
              contrastColor: get(light, `color.${r}.on-solid`),
              hoverColor: get(light, `color.${r}.solid-hover`),
            },
          ]),
        )
      : undefined;

    // primary.{50..950}: PrimeNG's own type has this as a single, mode-invariant
    // ramp (verified: appears once in aura/base, never under colorScheme) — we
    // derive it from the light map only, an honest, documented simplification
    // (our own per-mode grid legitimately shifts these values slightly by mode,
    // but PrimeNG's architecture has no slot to express that at this position).
    const primaryRamp = projectRamp(light, 'primary', ctx);
    coverage.push(
      ...primaryRamp.coverage.map((c) => ({
        variable: `semantic.primary.${c.step}`,
        slot: c.slot,
        class: c.class,
      })),
    );

    // surface.{0,50..950}: mode-scoped in real PrimeNG (verified: aura/base
    // defines a DIFFERENT ramp — slate family light, zinc family dark — under
    // colorScheme.light/dark.surface) — computed per mode, unlike primary above.
    const surfaceRampLight = projectRamp(light, 'neutral', ctx, { includeZero: true });
    const surfaceRampDark = projectRamp(dark, 'neutral', ctx, { includeZero: true });
    coverage.push(
      ...surfaceRampLight.coverage.map((c) => ({
        variable: `semantic.colorScheme.light.surface.${c.step}`,
        slot: c.slot,
        class: c.class,
      })),
    );

    const fLight = field(light),
      fDark = field(dark);
    const lLight = list(light),
      lDark = list(dark);
    const nLight = navigation(light),
      nDark = navigation(dark);
    const cLight = content(light),
      cDark = content(dark);
    const oSelectLight = overlay(light, 'select', ctx),
      oSelectDark = overlay(dark, 'select', ctx);
    const oPopoverLight = overlay(light, 'popover', ctx),
      oPopoverDark = overlay(dark, 'popover', ctx);
    const oModalLight = overlay(light, 'modal', ctx),
      oModalDark = overlay(dark, 'modal', ctx);
    const oNavLight = overlay(light, 'navigation', ctx);
    coverage.push({
      variable: 'semantic.formField.{paddingX,paddingY,borderRadius}',
      slot: 'component.control.{padding-x,padding-y,radius}',
      class: 'native',
      note: 'AL2-promoted shared control geometry (proposal 0003)',
    });
    coverage.push({
      variable: 'semantic.formField.* (rest)',
      slot: 'exporter-private: field()',
      class: 'derived',
    });
    coverage.push({
      variable: 'semantic.disabledOpacity',
      slot: 'semantic.opacity.disabled',
      class: 'native',
      note: 'AL2 promotion — was a hardcoded PrimeNG constant',
    });
    coverage.push({
      variable: 'components.button.root.{borderRadius,paddingX,paddingY}',
      slot: 'component.button.{radius,padding-x,padding-y}',
      class: 'native',
      note: 'AL2 parity: the button layer, which defaults from component.control.*',
    });
    coverage.push({
      variable: 'semantic.list.*',
      slot: 'exporter-private: list()',
      class: 'derived',
    });
    coverage.push({
      variable: 'semantic.navigation.*',
      slot: 'exporter-private: navigation()',
      class: 'derived',
    });
    coverage.push({
      variable: 'semantic.overlay.*',
      slot: 'semantic.color.elevation.N.{surface,shadow} + radius.*',
      class: 'native',
    });
    coverage.push({
      variable: 'semantic.content.*',
      slot: 'semantic.color.elevation.1.surface + border + text.base',
      class: 'native',
    });
    coverage.push({
      variable: 'semantic.colorScheme.*.mask.background',
      slot: 'semantic.color.scrim',
      class: 'native',
      note: 'scrim carries its own alpha — the veil strength needs no separate slot (proposal 0003, overlay pass)',
    });
    coverage.push({
      variable: 'semantic.mask.transitionDuration',
      slot: 'semantic.duration.normal',
      class: 'approximated',
      note: "PrimeNG's own convention is 0.3s; the nearest motion-scale rung is used so the veil fade is authorable (was hardcoded)",
    });

    const semantic = {
      transitionDuration: get(light, 'duration.fast'),
      disabledOpacity: String(get(light, 'opacity.disabled')), // AL2: promoted to the catalog once Bootstrap independently needed it (was a hardcoded 0.6 here)
      iconSize: '1rem',
      // width/style/offset are PrimeNG conventions we deliberately don't have a composite
      // for yet (proposal 0002 gap #8) — `color` reuses PrimeNG's own alias mechanism
      // (`{primary.color}`) rather than a resolved value, exactly like Rating/ProgressBar.
      focusRing: {
        width: '1px',
        style: 'solid',
        color: '{primary.color}',
        offset: '2px',
        shadow: 'none',
      },
      primary: primaryRamp.ramp,
      formField: fLight.structural,
      list: lLight.structural,
      navigation: nLight.structural,
      content: cLight.structural,
      overlay: {
        select: oSelectLight.structural,
        popover: oPopoverLight.structural,
        modal: oModalLight.structural,
        navigation: oNavLight.structural,
      },
      // Overlay pass (proposal 0003): was a hardcoded '0.3s'. The motion scale
      // already expresses this — no promotion needed, just stop hardcoding.
      // `mask.background` reads `color.scrim` (alpha included) below.
      mask: { transitionDuration: get(light, 'duration.normal') },
      colorScheme: {
        light: {
          surface: surfaceRampLight.ramp,
          primary: {
            color: get(light, 'color.primary.solid'),
            contrastColor: get(light, 'color.primary.on-solid'),
            hoverColor: get(light, 'color.primary.solid-hover'),
            activeColor: get(light, 'color.primary.solid-active'),
          },
          highlight: {
            background: get(light, 'color.primary.tint'),
            focusBackground: get(light, 'color.primary.tint-hover'),
            color: get(light, 'color.primary.on-tint'),
            focusColor: get(light, 'color.primary.on-tint'),
          },
          mask: { background: get(light, 'color.scrim'), color: get(light, 'color.neutral.tint') },
          formField: fLight.colorScheme,
          text: {
            color: get(light, 'color.text.base'),
            hoverColor: get(light, 'color.text.base'),
            mutedColor: get(light, 'color.text.muted'),
            hoverMutedColor: get(light, 'color.text.muted'),
          },
          content: cLight.colorScheme,
          overlay: {
            select: oSelectLight.colorScheme,
            popover: oPopoverLight.colorScheme,
            modal: oModalLight.colorScheme,
          },
          list: { option: lLight.colorScheme.option, optionGroup: lLight.colorScheme.optionGroup },
          navigation: nLight.colorScheme,
        },
        dark: {
          surface: surfaceRampDark.ramp,
          primary: {
            color: get(dark, 'color.primary.solid'),
            contrastColor: get(dark, 'color.primary.on-solid'),
            hoverColor: get(dark, 'color.primary.solid-hover'),
            activeColor: get(dark, 'color.primary.solid-active'),
          },
          highlight: {
            background: get(dark, 'color.primary.tint'),
            focusBackground: get(dark, 'color.primary.tint-hover'),
            color: get(dark, 'color.primary.on-tint'),
            focusColor: get(dark, 'color.primary.on-tint'),
          },
          mask: { background: get(dark, 'color.scrim'), color: get(dark, 'color.neutral.tint') },
          formField: fDark.colorScheme,
          text: {
            color: get(dark, 'color.text.base'),
            hoverColor: get(dark, 'color.text.base'),
            mutedColor: get(dark, 'color.text.muted'),
            hoverMutedColor: get(dark, 'color.text.muted'),
          },
          content: cDark.colorScheme,
          overlay: {
            select: oSelectDark.colorScheme,
            popover: oPopoverDark.colorScheme,
            modal: oModalDark.colorScheme,
          },
          list: { option: lDark.colorScheme.option, optionGroup: lDark.colorScheme.optionGroup },
          navigation: nDark.colorScheme,
        },
      },
    };

    const button = buildButton(light, dark, { ...ctx, roleArchetypeExtend });
    const tag = buildTag(light, dark);
    const badge = buildBadge(light, dark);
    const message = buildMessage(light, dark);
    const inlinemessage = buildInlineMessage(light, dark, ctx);
    const progressbar = buildProgressBar();
    const rating = buildRating();
    const listbox = buildListbox(light, dark);
    const menu = buildMenu(light, dark, ctx);
    const popover = buildPopover(light, dark, ctx);
    const dialog = buildDialog(light, dark, ctx);
    coverage.push(
      ...button.coverage,
      ...tag.coverage,
      ...badge.coverage,
      ...message.coverage,
      ...inlinemessage.coverage,
      ...progressbar.coverage,
      ...rating.coverage,
      ...listbox.coverage,
      ...menu.coverage,
      ...popover.coverage,
      ...dialog.coverage,
    );

    coverage.push(...droppedDimensions(normalized.dimensionNames, ['color-scheme']));

    const components = {
      button: button.tokens,
      tag: tag.tokens,
      badge: badge.tokens,
      message: message.tokens,
      inlinemessage: inlinemessage.tokens,
      progressbar: progressbar.tokens,
      rating: rating.tokens,
      listbox: listbox.tokens,
      menu: menu.tokens,
      popover: popover.tokens,
      dialog: dialog.tokens,
    };

    // AL3: measure this preset against PrimeNG's real theming surface
    // (surface-inventory.json, extracted from the Aura preset). Replaces the
    // hand-maintained STRUCTURAL_RESIDUE guess with per-family counts of what
    // is driven, what follows our theme through PrimeNG's own token
    // references, and what keeps Aura's default — every slot accounted for.
    coverage.push(...coverageRows(INVENTORY, { semantic, components }));

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
  return (
    v &&
    typeof v === 'object' &&
    typeof v.l === 'number' &&
    typeof v.c === 'number' &&
    typeof v.h === 'number'
  );
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
    const key = (k) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k));
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
  return (
    String(name)
      .replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^[A-Z]/, (c) => c.toLowerCase()) || 'transtyle'
  );
}

function renderUsage(ctx, coverage) {
  const counts = {};
  for (const c of coverage) counts[c.class] = (counts[c.class] ?? 0) + 1;
  const summary = Object.entries(counts)
    .map(([k, v]) => `${v} ${k}`)
    .join(' · ');
  return `# Using this PrimeNG preset

Generated from the **${ctx.projectName}** design system by transtyle: a \`definePreset(Aura, { semantic, components })\` override — anything not listed here is inherited from PrimeNG's own Aura preset untouched. Coverage: ${summary}.

## Setup

\`\`\`ts
// app.config.ts
import { providePrimeNG } from 'primeng/config';
import preset from './preset.transtyle';

providePrimeNG({ theme: { preset, options: { darkModeSelector: '.dark', cssLayer: false } } });
\`\`\`

## What's covered in this pass

Full \`variant x severity x state\` color grid: **Button**. Flat \`severity x part\`: **Tag**, **Badge**, **Message**, **InlineMessage**. Primary-anchored only (no severity axis in real PrimeNG — verified against source, not assumed): **ProgressBar**, **Rating**. Archetype-helper consumers (\`formField\`/\`list\`/\`navigation\`/\`overlay\`, exporter-private per the C1 cross-ecosystem study — see docs/findings/component-tier-study.md): **Listbox**, **Menu**, **Popover**, **Dialog**.

Structural components with no severity-colored surface (DataTable, Galleria, Tree, Splitter, Timeline, ...) are left on Aura's own defaults for now — see \`report.json\` for the full list, each marked \`unsupported\`.

## Regenerating

Never edit this file — change the design system tokens and run \`transtyle build primeng\`. See \`report.json\` for the full coverage/provenance breakdown.
`;
}
