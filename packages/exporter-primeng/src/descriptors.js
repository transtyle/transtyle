/**
 * Per-component builders (docs/plan/component-tier.md C4). Each reads either
 * `mapSeverityGrid` (severity-colored components) or a plain semantic alias
 * (primary-anchored components) or an archetype helper (field/list/navigation/
 * overlay consumers) — zero per-component mapping *logic*, only which cells
 * a component's real shape (verified against source, fetched 2026-07-21) asks
 * for. See docs/worklog/2026-07-21-component-tier-c3-c5.md for what was
 * verified and what this deliberately does not cover yet.
 *
 * Every builder takes `(light, dark, ctx)` — two per-mode token maps — and
 * returns `{ tokens, coverage }` with `tokens.colorScheme = { light, dark }`
 * wherever the real PrimeNG type requires that split (verified: it's not
 * optional — PrimeNG's own DesignTokens types reject an unwrapped colorScheme
 * object, confirmed by compiling the emitted preset against them directly).
 *
 * A real, corrective finding from verifying source rather than assuming
 * proposal 0002's ~25-35 estimate (§5.2): most components proposal 0002
 * expected to be severity-colored are NOT. Only Button, Tag, Badge, Message,
 * and InlineMessage actually carry the `variant x severity x part` (or flat
 * `severity x part`) shape. Checkbox, RadioButton, ToggleSwitch, SelectButton,
 * ToggleButton, and SplitButton are `field`-shaped (single primary + neutral
 * surfaces, no severity axis). ProgressBar, Slider, Knob, and Rating are
 * primary-anchored only — and, verified against source, carry NO colorScheme
 * block at all; their real Aura default literally writes token-reference
 * strings like `'{primary.color}'`/`'{text.muted.color}'` rather than
 * resolving a color, and PrimeNG's own alias engine resolves those per the
 * active mode — so this file reuses that exact convention for them (a
 * resolved literal would be mode-wrong: there's no per-mode slot to put it
 * in). Chip has no brand color at all (plain neutral surface, not covered
 * in this pass).
 */

import { mapSeverityGrid } from './severity-grid.js';
import { field, list, navigation, overlay, content } from './archetypes.js';

const get = (map, path) => map.get(`semantic.${path}`)?.value;

// ---------- severity-colored components (the generic mapper, called once per mode) ----------

function buildButtonColorScheme(map) {
  const g = mapSeverityGrid(map, {
    variants: [
      { name: 'root', parts: { background: 'solid', hoverBackground: 'solid-hover', activeBackground: 'solid-active', borderColor: 'solid', hoverBorderColor: 'solid-hover', activeBorderColor: 'solid-active', color: 'on-solid', hoverColor: 'on-solid', activeColor: 'on-solid', focusRingColor: 'solid' } },
      { name: 'outlined', parts: { hoverBackground: 'tint', activeBackground: 'tint-active', borderColor: 'outline', color: 'text' } },
      { name: 'text', parts: { hoverBackground: 'tint', activeBackground: 'tint-active', color: 'text' } },
    ],
  });
  const scheme = { root: {}, outlined: {}, text: {} };
  for (const severity of ['primary', 'secondary', 'success', 'info', 'warn', 'danger', 'contrast']) {
    scheme.root[severity] = {
      background: g.get('root', severity, 'background'), hoverBackground: g.get('root', severity, 'hoverBackground'), activeBackground: g.get('root', severity, 'activeBackground'),
      borderColor: g.get('root', severity, 'borderColor'), hoverBorderColor: g.get('root', severity, 'hoverBorderColor'), activeBorderColor: g.get('root', severity, 'activeBorderColor'),
      color: g.get('root', severity, 'color'), hoverColor: g.get('root', severity, 'hoverColor'), activeColor: g.get('root', severity, 'activeColor'),
      focusRing: { color: g.get('root', severity, 'focusRingColor'), shadow: 'none' },
    };
    scheme.outlined[severity] = { hoverBackground: g.get('outlined', severity, 'hoverBackground'), activeBackground: g.get('outlined', severity, 'activeBackground'), borderColor: g.get('outlined', severity, 'borderColor'), color: g.get('outlined', severity, 'color') };
    scheme.text[severity] = { hoverBackground: g.get('text', severity, 'hoverBackground'), activeBackground: g.get('text', severity, 'activeBackground'), color: g.get('text', severity, 'color') };
  }
  return { scheme, coverage: g.coverage.map((c) => ({ ...c, field: `button.colorScheme.${c.field}` })) };
}

export function buildButton(light, dark, ctx) {
  const l = buildButtonColorScheme(light);
  const d = buildButtonColorScheme(dark);
  const f = field(light).structural;
  return {
    tokens: {
      root: { borderRadius: f.borderRadius, paddingX: f.paddingX, paddingY: f.paddingY, gap: get(light, 'space.2'), transitionDuration: f.transitionDuration },
      colorScheme: { light: l.scheme, dark: d.scheme },
      ...(ctx.roleArchetypeExtend ? { extend: ctx.roleArchetypeExtend } : {}),
    },
    coverage: l.coverage,
  };
}

function buildFlatSeverity(map, { variants, severities, path }) {
  const g = mapSeverityGrid(map, { variants, severities });
  const scheme = {};
  for (const severity of severities) {
    scheme[severity] = {};
    for (const field of Object.keys(variants[0].parts)) scheme[severity][field] = g.get(variants[0].name, severity, field);
  }
  return { scheme, coverage: g.coverage.map((c) => ({ ...c, field: `${path}.colorScheme.${c.field}` })) };
}

export function buildTag(light, dark) {
  const opts = { variants: [{ name: 'root', parts: { background: 'tint', color: 'text' } }], severities: ['primary', 'secondary', 'success', 'info', 'warn', 'danger', 'contrast'], path: 'tag' };
  const l = buildFlatSeverity(light, opts);
  const d = buildFlatSeverity(dark, opts);
  return { tokens: { colorScheme: { light: l.scheme, dark: d.scheme } }, coverage: l.coverage };
}

export function buildBadge(light, dark) {
  const opts = { variants: [{ name: 'root', parts: { background: 'solid', color: 'on-solid' } }], severities: ['primary', 'secondary', 'success', 'info', 'warn', 'danger', 'contrast'], path: 'badge' };
  const l = buildFlatSeverity(light, opts);
  const d = buildFlatSeverity(dark, opts);
  return { tokens: { colorScheme: { light: l.scheme, dark: d.scheme } }, coverage: l.coverage };
}

/** Message nests severity-major (colorScheme.<mode>.<severity>.{filled fields, outlined:{}, simple:{}}) — the opposite variant/severity order from Button. Verified against source, not assumed. No `primary` severity (info/success/warn/danger/secondary/contrast only) — a real PrimeNG inconsistency with Button/Tag/Badge, not ours. */
function buildMessageColorScheme(map) {
  const g = mapSeverityGrid(map, {
    severities: ['info', 'success', 'warn', 'danger', 'secondary', 'contrast'],
    variants: [
      { name: 'filled', parts: { background: 'tint', borderColor: 'outline', color: 'text' } },
      { name: 'outlined', parts: { color: 'text', borderColor: 'text' } },
      { name: 'simple', parts: { color: 'text' } },
    ],
  });
  const scheme = {};
  for (const severity of ['info', 'success', 'warn', 'danger', 'secondary', 'contrast']) {
    const key = severity === 'danger' ? 'error' : severity; // real PrimeNG naming inconsistency (verified against source), not ours
    scheme[key] = {
      background: g.get('filled', severity, 'background'), borderColor: g.get('filled', severity, 'borderColor'), color: g.get('filled', severity, 'color'),
      outlined: { color: g.get('outlined', severity, 'color'), borderColor: g.get('outlined', severity, 'borderColor') },
      simple: { color: g.get('simple', severity, 'color') },
    };
  }
  return { scheme, coverage: g.coverage.map((c) => ({ ...c, field: `message.colorScheme.${c.field}` })) };
}

export function buildMessage(light, dark) {
  const l = buildMessageColorScheme(light);
  const d = buildMessageColorScheme(dark);
  return { tokens: { colorScheme: { light: l.scheme, dark: d.scheme } }, coverage: l.coverage };
}

/** Flat like Tag/Badge but uses `danger`-as-`error` naming (real PrimeNG inconsistency) plus a `shadow` field, approximated from the role's solid color at fixed low alpha (PrimeNG's own convention: `color-mix(..., transparent 96%)`). */
function buildInlineMessageColorScheme(map, ctx) {
  const g = mapSeverityGrid(map, {
    severities: ['info', 'success', 'warn', 'danger', 'secondary', 'contrast'],
    variants: [{ name: 'root', parts: { background: 'tint', borderColor: 'outline', color: 'text' } }],
  });
  const scheme = {};
  const coverage = [...g.coverage];
  const roleFor = { info: 'info', success: 'success', warn: 'warning', danger: 'danger', secondary: 'secondary' };
  for (const severity of ['info', 'success', 'warn', 'danger', 'secondary', 'contrast']) {
    const solid = severity === 'contrast' ? map.get('semantic.color.neutral.text-strong')?.value : map.get(`semantic.color.${roleFor[severity]}.solid`)?.value;
    const key = severity === 'danger' ? 'error' : severity;
    scheme[key] = {
      background: g.get('root', severity, 'background'), borderColor: g.get('root', severity, 'borderColor'), color: g.get('root', severity, 'color'),
      shadow: solid ? `0px 4px 8px 0px ${ctx.formatColor({ ...solid, alpha: 0.04 })}` : undefined,
    };
    if (solid) coverage.push({ field: `inlinemessage.colorScheme.${severity}.shadow`, slot: '—', class: 'approximated', note: 'fixed low-alpha tint of the role solid color, matching PrimeNG\'s own color-mix(..., transparent 96%) convention — not a colorimetric shadow derivation' });
  }
  return { scheme, coverage: coverage.map((c) => (c.field?.startsWith('inlinemessage') ? c : { ...c, field: `inlinemessage.colorScheme.${c.field}` })) };
}

export function buildInlineMessage(light, dark, ctx) {
  const l = buildInlineMessageColorScheme(light, ctx);
  const d = buildInlineMessageColorScheme(dark, ctx);
  return { tokens: { colorScheme: { light: l.scheme, dark: d.scheme } }, coverage: l.coverage };
}

// ---------- primary-anchored components: verified to have NO colorScheme block in real
// PrimeNG at all — their own Aura default writes a bare token-reference string, which
// PrimeNG's own alias engine resolves per the active mode. We reuse those exact strings
// rather than resolving a literal (a literal would be mode-wrong: there is no per-mode
// slot to put a second value in). Not mode-dependent, so a single build suffices. ----------

export function buildProgressBar() {
  return {
    tokens: { value: { background: '{primary.color}' }, label: { color: '{primary.contrastColor}' } },
    coverage: [{ field: 'progressbar.value.background', slot: 'semantic.primary.color (alias)', class: 'native' }],
  };
}

export function buildRating() {
  return {
    tokens: { icon: { color: '{text.mutedColor}', hoverColor: '{primary.color}', activeColor: '{primary.color}' } },
    coverage: [{ field: 'rating.icon.hoverColor', slot: 'semantic.primary.color (alias)', class: 'native' }],
  };
}

// ---------- archetype-consumer components (§4/§5, C5) ----------

export function buildListbox(light, dark) {
  const fl = field(light), fd = field(dark);
  const ll = list(light), ld = list(dark);
  return {
    tokens: {
      root: { borderRadius: fl.structural.borderRadius, transitionDuration: fl.structural.transitionDuration },
      colorScheme: {
        light: { root: { background: fl.colorScheme.background, disabledBackground: fl.colorScheme.disabledBackground, borderColor: fl.colorScheme.borderColor, invalidBorderColor: fl.colorScheme.invalidBorderColor, color: fl.colorScheme.color, disabledColor: fl.colorScheme.disabledColor }, option: ll.colorScheme.option },
        dark: { root: { background: fd.colorScheme.background, disabledBackground: fd.colorScheme.disabledBackground, borderColor: fd.colorScheme.borderColor, invalidBorderColor: fd.colorScheme.invalidBorderColor, color: fd.colorScheme.color, disabledColor: fd.colorScheme.disabledColor }, option: ld.colorScheme.option },
      },
      list: { padding: ll.structural.padding, gap: ll.structural.gap, header: ll.structural.header },
      option: ll.structural.option,
      optionGroup: ll.structural.optionGroup,
    },
    coverage: [
      { field: 'listbox.root.*', slot: 'exporter-private: field()', class: 'derived' },
      { field: 'listbox.option.*', slot: 'exporter-private: list()', class: 'derived' },
    ],
  };
}

export function buildMenu(light, dark, ctx) {
  const nl = navigation(light), nd = navigation(dark);
  const cl = content(light), cd = content(dark);
  const shadow = light.get('semantic.color.elevation.2.shadow')?.value;
  return {
    tokens: {
      root: { borderRadius: cl.structural.borderRadius, shadow: shadow ? `${shadow.offsetX} ${shadow.offsetY} ${shadow.blur} ${shadow.spread} ${ctx.formatColor(shadow.color)}` : undefined },
      colorScheme: {
        // Menu's own component-level `item` type is narrower than the shared
        // semantic.navigation.item group (verified against source: no active*
        // fields at the component level — only focus, since Menu has no active state).
        light: { root: { background: cl.colorScheme.background, borderColor: cl.colorScheme.borderColor, color: cl.colorScheme.color }, item: { focusBackground: nl.colorScheme.item.focusBackground, color: nl.colorScheme.item.color, focusColor: nl.colorScheme.item.focusColor, icon: nl.colorScheme.item.icon }, submenuLabel: nl.colorScheme.submenuLabel },
        dark: { root: { background: cd.colorScheme.background, borderColor: cd.colorScheme.borderColor, color: cd.colorScheme.color }, item: { focusBackground: nd.colorScheme.item.focusBackground, color: nd.colorScheme.item.color, focusColor: nd.colorScheme.item.focusColor, icon: nd.colorScheme.item.icon }, submenuLabel: nd.colorScheme.submenuLabel },
      },
      list: nl.structural.list,
      item: nl.structural.item,
      submenuLabel: nl.structural.submenuLabel,
    },
    coverage: [{ field: 'menu.item.*', slot: 'exporter-private: navigation()', class: 'derived' }],
  };
}

export function buildPopover(light, dark, ctx) {
  const ol = overlay(light, 'popover', ctx), od = overlay(dark, 'popover', ctx);
  return {
    tokens: {
      root: { ...ol.structural },
      colorScheme: { light: { root: ol.colorScheme }, dark: { root: od.colorScheme } },
      content: { padding: ol.padding },
    },
    coverage: [{ field: 'popover.root.*', slot: 'exporter-private: overlay(popover)', class: 'derived' }],
  };
}

export function buildDialog(light, dark, ctx) {
  const ol = overlay(light, 'modal', ctx), od = overlay(dark, 'modal', ctx);
  return {
    tokens: {
      root: { ...ol.structural },
      colorScheme: { light: { root: ol.colorScheme }, dark: { root: od.colorScheme } },
      header: { padding: ol.padding },
      content: { padding: ol.padding },
      footer: { padding: ol.padding },
    },
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
