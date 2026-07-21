/**
 * Per-component builders (docs/plan/component-tier.md C4). Each reads either
 * `mapSeverityGrid` (severity-colored components) or a plain semantic alias
 * (primary-anchored components) or an archetype helper (field/list/navigation/
 * overlay consumers) — zero per-component mapping *logic*, only which cells
 * a component's real shape (verified against source, fetched 2026-07-21) asks
 * for. See docs/worklog/<date>-component-tier-c3-c5.md for what was verified
 * and what this deliberately does not cover yet.
 *
 * A real, corrective finding from verifying source rather than assuming
 * proposal 0002's ~25-35 estimate (§5.2): most components proposal 0002
 * expected to be severity-colored are NOT. Only Button, Tag, Badge, Message,
 * and InlineMessage actually carry the `variant x severity x part` (or flat
 * `severity x part`) shape. Checkbox, RadioButton, ToggleSwitch, SelectButton,
 * ToggleButton, and SplitButton are `field`-shaped (single primary + neutral
 * surfaces, no severity axis). ProgressBar, Slider, Knob, and Rating are
 * primary-anchored only (no severity axis at all — a `value`/`range`/`icon`
 * reads `primary.solid` directly, full stop). Chip has no brand color at all
 * (plain neutral surface). This file reflects that, not the original guess.
 */

import { mapSeverityGrid } from './severity-grid.js';
import { field, list, navigation, overlay, content } from './archetypes.js';

const get = (map, path) => map.get(`semantic.${path}`)?.value;

// ---------- severity-colored components (the generic mapper) ----------

export function buildButton(map, ctx) {
  const g = mapSeverityGrid(map, {
    variants: [
      { name: 'root', parts: { background: 'solid', hoverBackground: 'solid-hover', activeBackground: 'solid-active', borderColor: 'solid', hoverBorderColor: 'solid-hover', activeBorderColor: 'solid-active', color: 'on-solid', hoverColor: 'on-solid', activeColor: 'on-solid', focusRingColor: 'solid' } },
      { name: 'outlined', parts: { hoverBackground: 'tint', activeBackground: 'tint-active', borderColor: 'outline', color: 'text' } },
      { name: 'text', parts: { hoverBackground: 'tint', activeBackground: 'tint-active', color: 'text' } },
    ],
  });
  const colorScheme = { root: {}, outlined: {}, text: {} };
  for (const severity of ['primary', 'secondary', 'success', 'info', 'warn', 'danger', 'contrast']) {
    const root = {
      background: g.get('root', severity, 'background'), hoverBackground: g.get('root', severity, 'hoverBackground'), activeBackground: g.get('root', severity, 'activeBackground'),
      borderColor: g.get('root', severity, 'borderColor'), hoverBorderColor: g.get('root', severity, 'hoverBorderColor'), activeBorderColor: g.get('root', severity, 'activeBorderColor'),
      color: g.get('root', severity, 'color'), hoverColor: g.get('root', severity, 'hoverColor'), activeColor: g.get('root', severity, 'activeColor'),
      focusRing: { color: g.get('root', severity, 'focusRingColor'), shadow: 'none' },
    };
    colorScheme.root[severity] = root;
    colorScheme.outlined[severity] = { hoverBackground: g.get('outlined', severity, 'hoverBackground'), activeBackground: g.get('outlined', severity, 'activeBackground'), borderColor: g.get('outlined', severity, 'borderColor'), color: g.get('outlined', severity, 'color') };
    colorScheme.text[severity] = { hoverBackground: g.get('text', severity, 'hoverBackground'), activeBackground: g.get('text', severity, 'activeBackground'), color: g.get('text', severity, 'color') };
  }
  const f = field(map);
  return {
    tokens: {
      root: { borderRadius: f.borderRadius, paddingX: f.paddingX, paddingY: f.paddingY, gap: get(map, 'space.2'), transitionDuration: f.transitionDuration },
      colorScheme,
      // T7/§2.7: a custom archetype role (e.g. `help`) lands in `extend`, PrimeNG's
      // own documented escape hatch for tokens outside the fixed severity schema.
      ...(ctx.roleArchetypeExtend ? { extend: ctx.roleArchetypeExtend } : {}),
    },
    coverage: g.coverage.map((c) => ({ ...c, field: `button.colorScheme.light.${c.field}` })),
  };
}

export function buildTag(map) {
  const g = mapSeverityGrid(map, { variants: [{ name: 'root', parts: { background: 'tint', color: 'text' } }] });
  const colorScheme = {};
  for (const severity of ['primary', 'secondary', 'success', 'info', 'warn', 'danger', 'contrast']) {
    colorScheme[severity] = { background: g.get('root', severity, 'background'), color: g.get('root', severity, 'color') };
  }
  return { tokens: { colorScheme }, coverage: g.coverage.map((c) => ({ ...c, field: `tag.colorScheme.light.${c.field}` })) };
}

export function buildBadge(map) {
  const g = mapSeverityGrid(map, { variants: [{ name: 'root', parts: { background: 'solid', color: 'on-solid' } }] });
  const colorScheme = {};
  for (const severity of ['primary', 'secondary', 'success', 'info', 'warn', 'danger', 'contrast']) {
    colorScheme[severity] = { background: g.get('root', severity, 'background'), color: g.get('root', severity, 'color') };
  }
  return { tokens: { colorScheme }, coverage: g.coverage.map((c) => ({ ...c, field: `badge.colorScheme.light.${c.field}` })) };
}

/** Message nests severity-major (colorScheme.<severity>.{filled fields, outlined:{}, simple:{}}) — the opposite order from Button. Verified against source, not assumed. */
export function buildMessage(map) {
  // Verified against source: Message has no `primary` severity (info/success/
  // warn/danger/secondary/contrast only) — unlike Button/Tag/Badge, which do.
  const g = mapSeverityGrid(map, {
    severities: ['info', 'success', 'warn', 'danger', 'secondary', 'contrast'],
    variants: [
      { name: 'filled', parts: { background: 'tint', borderColor: 'outline', color: 'text' } },
      { name: 'outlined', parts: { color: 'text', borderColor: 'text' } },
      { name: 'simple', parts: { color: 'text' } },
    ],
  });
  const colorScheme = {};
  for (const severity of ['info', 'success', 'warn', 'danger', 'secondary', 'contrast']) {
    colorScheme[severity] = {
      background: g.get('filled', severity, 'background'), borderColor: g.get('filled', severity, 'borderColor'), color: g.get('filled', severity, 'color'),
      outlined: { color: g.get('outlined', severity, 'color'), borderColor: g.get('outlined', severity, 'borderColor') },
      simple: { color: g.get('simple', severity, 'color') },
    };
  }
  return { tokens: { colorScheme }, coverage: g.coverage.map((c) => ({ ...c, field: `message.colorScheme.light.${c.field}` })) };
}

/** Flat like Tag/Badge (no variant nesting) but uses `danger`-as-`error` naming (real PrimeNG inconsistency, not ours) plus a shadow field, approximated from the role's solid color at fixed low alpha (PrimeNG's own convention: `color-mix(..., transparent 96%)`). */
export function buildInlineMessage(map, ctx) {
  // Same severity set as Message (no `primary`), verified against source.
  const g = mapSeverityGrid(map, {
    severities: ['info', 'success', 'warn', 'danger', 'secondary', 'contrast'],
    variants: [{ name: 'root', parts: { background: 'tint', borderColor: 'outline', color: 'text' } }],
  });
  const colorScheme = {};
  const coverage = [...g.coverage];
  for (const severity of ['info', 'success', 'warn', 'danger', 'secondary', 'contrast']) {
    const solid = severity === 'contrast' ? map.get('semantic.color.neutral.text-strong')?.value : map.get(`semantic.color.${{ info: 'info', success: 'success', warn: 'warning', danger: 'danger', secondary: 'secondary' }[severity] ?? ''}.solid`)?.value;
    colorScheme[severity === 'danger' ? 'error' : severity] = {
      background: g.get('root', severity, 'background'),
      borderColor: g.get('root', severity, 'borderColor'),
      color: g.get('root', severity, 'color'),
      shadow: solid ? `0px 4px 8px 0px ${ctx.formatColor({ ...solid, alpha: 0.04 })}` : undefined,
    };
    if (solid) coverage.push({ field: `inlinemessage.colorScheme.light.${severity}.shadow`, slot: '—', class: 'approximated', note: 'fixed low-alpha tint of the role solid color, matching PrimeNG\'s own color-mix(..., transparent 96%) convention — not a colorimetric shadow derivation' });
  }
  return { tokens: { colorScheme }, coverage: coverage.map((c) => (c.field?.startsWith('inlinemessage') ? c : { ...c, field: `inlinemessage.colorScheme.light.${c.field}` })) };
}

// ---------- primary-anchored components (no severity axis at all — verified, not assumed) ----------

export function buildProgressBar(map) {
  return {
    tokens: { value: { background: get(map, 'color.primary.solid') }, label: { color: get(map, 'color.primary.on-solid') } },
    coverage: [{ field: 'progressbar.value.background', slot: 'semantic.color.primary.solid', class: 'native' }],
  };
}

export function buildRating(map) {
  return {
    tokens: { icon: { color: get(map, 'color.text.muted'), hoverColor: get(map, 'color.primary.solid'), activeColor: get(map, 'color.primary.solid') } },
    coverage: [{ field: 'rating.icon.hoverColor', slot: 'semantic.color.primary.solid', class: 'native' }],
  };
}

// ---------- archetype-consumer components (§4/§5, C5) ----------

export function buildListbox(map) {
  const f = field(map);
  const l = list(map);
  return {
    tokens: {
      root: { background: f.background, disabledBackground: f.disabledBackground, borderColor: f.borderColor, invalidBorderColor: f.invalidBorderColor, color: f.color, disabledColor: f.disabledColor, borderRadius: f.borderRadius, transitionDuration: f.transitionDuration },
      list: { padding: l.padding, gap: l.gap, header: l.header },
      option: l.option,
      optionGroup: l.optionGroup,
    },
    coverage: [
      { field: 'listbox.root.*', slot: 'exporter-private: field()', class: 'derived' },
      { field: 'listbox.option.*', slot: 'exporter-private: list()', class: 'derived' },
    ],
  };
}

export function buildMenu(map, ctx) {
  const n = navigation(map);
  const c = content(map);
  const shadow = map.get('semantic.color.elevation.2.shadow')?.value;
  return {
    tokens: {
      root: { background: c.background, borderColor: c.borderColor, color: c.color, shadow: shadow ? `${shadow.offsetX} ${shadow.offsetY} ${shadow.blur} ${shadow.spread} ${ctx.formatColor(shadow.color)}` : undefined },
      list: n.list,
      item: n.item,
      submenuLabel: n.submenuLabel,
    },
    coverage: [{ field: 'menu.item.*', slot: 'exporter-private: navigation()', class: 'derived' }],
  };
}

export function buildPopover(map, ctx) {
  const o = overlay(map, 'popover', ctx);
  return {
    tokens: { root: { background: o.background, borderColor: o.borderColor, color: o.color, borderRadius: o.borderRadius, shadow: o.shadow }, content: { padding: o.padding } },
    coverage: [{ field: 'popover.root.*', slot: 'exporter-private: overlay(popover)', class: 'derived' }],
  };
}

export function buildDialog(map, ctx) {
  const o = overlay(map, 'modal', ctx);
  return {
    tokens: { root: { background: o.background, borderColor: o.borderColor, color: o.color, borderRadius: o.borderRadius, shadow: o.shadow }, header: { padding: o.padding }, content: { padding: o.padding }, footer: { padding: o.padding } },
    coverage: [{ field: 'dialog.root.*', slot: 'exporter-private: overlay(modal)', class: 'derived' }],
  };
}

/**
 * Structural residue (§5.2 / C5): components with no severity-colored surface
 * and not yet given a real builder above. Honest `unsupported` coverage,
 * matching every other exporter's convention — not silently dropped.
 */
export const STRUCTURAL_RESIDUE = [
  'datatable', 'galleria', 'tree', 'treetable', 'splitter', 'timeline', 'organizationchart',
  'carousel', 'dataview', 'orderlist', 'picklist', 'paginator', 'stepper', 'steps', 'tabs', 'tabview', 'accordion',
];
