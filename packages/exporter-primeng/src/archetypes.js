/**
 * Exporter-private archetype helpers (docs/proposals/0002-component-theming-primeng.md
 * §2.3, §2.8, §4; docs/plan/component-tier.md C5). Per C1's cross-ecosystem
 * study (docs/findings/component-tier-study.md), `field`/`list`/`navigation`/
 * `overlay` are PrimeNG-specific groupings, not convergent vocabulary — they
 * live here, permanently, reading straight from existing catalog cells.
 * Nothing here is a catalog addition; every value below is `get(map, ...)`
 * against a slot that already exists in `semantic.*`.
 *
 * Each helper returns `{ structural, colorScheme }` — verified against real
 * PrimeNG source (`aura/base/index.ts`, fetched 2026-07-21), which itself
 * splits every one of these groups the same way: a mode-invariant object
 * (padding/gap/radius/focusRing-shape) at the top level, and a SEPARATE
 * `colorScheme.{light,dark}.<group>` object for anything color-ish. This
 * isn't a stylistic choice on our end — PrimeNG's own DesignTokens TypeScript
 * types reject color fields on the top-level object and reject dimensional
 * fields on the colorScheme-scoped one, so index.js calls each helper once
 * per mode and assembles both halves into the shape PrimeNG's types require.
 */

const get = (map, path) => map.get(`semantic.${path}`)?.value;

export function field(map) {
  return {
    structural: {
      paddingX: get(map, 'space.4'), paddingY: get(map, 'space.2'),
      borderRadius: get(map, 'radius.field'),
      transitionDuration: get(map, 'duration.fast'),
      sm: { paddingX: get(map, 'space.3'), paddingY: get(map, 'space.1') },
      lg: { paddingX: get(map, 'space.5'), paddingY: get(map, 'space.3') },
    },
    colorScheme: {
      background: get(map, 'color.elevation.0.surface'),
      disabledBackground: get(map, 'color.neutral.tint'),
      filledBackground: get(map, 'color.elevation.1.surface'),
      borderColor: get(map, 'color.neutral.outline'),
      hoverBorderColor: get(map, 'color.neutral.outline-hover'),
      focusBorderColor: get(map, 'color.primary.solid'),
      invalidBorderColor: get(map, 'color.danger.solid'),
      color: get(map, 'color.text.base'),
      disabledColor: get(map, 'color.text.disabled'),
      placeholderColor: get(map, 'color.text.muted'),
      shadow: 'none', // no direct grid cell for a form-field elevation shadow; PrimeNG's own Aura default is flat too
    },
  };
}

export function list(map) {
  return {
    structural: {
      padding: get(map, 'space.1'), gap: get(map, 'space.0'),
      header: { padding: get(map, 'space.2') },
      option: { padding: get(map, 'space.2'), borderRadius: get(map, 'radius.control') },
      optionGroup: { padding: get(map, 'space.2'), fontWeight: String(get(map, 'type.weight.semibold')) },
    },
    colorScheme: {
      option: {
        focusBackground: get(map, 'color.primary.tint'),
        selectedBackground: get(map, 'color.primary.tint-active'),
        selectedFocusBackground: get(map, 'color.primary.tint-active'),
        color: get(map, 'color.text.base'),
        focusColor: get(map, 'color.text.base'),
        selectedColor: get(map, 'color.primary.on-tint'),
        selectedFocusColor: get(map, 'color.primary.on-tint'),
      },
      optionGroup: { background: 'transparent', color: get(map, 'color.text.muted') },
    },
  };
}

export function navigation(map) {
  return {
    structural: {
      list: { padding: get(map, 'space.1'), gap: get(map, 'space.0') },
      item: { padding: get(map, 'space.2'), borderRadius: get(map, 'radius.control'), gap: get(map, 'space.2') },
      submenuLabel: { padding: get(map, 'space.2'), fontWeight: String(get(map, 'type.weight.semibold')) },
    },
    colorScheme: {
      item: {
        focusBackground: get(map, 'color.primary.tint'), activeBackground: get(map, 'color.primary.tint-active'),
        color: get(map, 'color.text.base'), focusColor: get(map, 'color.text.base'), activeColor: get(map, 'color.text.base'),
        icon: { color: get(map, 'color.text.muted'), focusColor: get(map, 'color.text.base') },
      },
      submenuLabel: { background: 'transparent', color: get(map, 'color.text.muted') },
    },
  };
}

/** kind: 'popover' | 'modal' | 'navigation' | 'select' — each picks an elevation level. */
const OVERLAY_LEVEL = { select: 2, popover: 2, modal: 3, navigation: 2 };

export function overlay(map, kind, ctx) {
  const n = OVERLAY_LEVEL[kind] ?? 2;
  const shadow = map.get(`semantic.color.elevation.${n}.shadow`)?.value;
  const shadowStr = shadow ? `${shadow.offsetX} ${shadow.offsetY} ${shadow.blur} ${shadow.spread} ${ctx.formatColor(shadow.color)}` : undefined;
  return {
    // borderRadius/shadow are mode-invariant at this position in PrimeNG's own
    // type (verified: aura/base's top-level `overlay.*` carries no background/color at
    // all) — `shadow` is computed from whichever map is passed; callers pass the light
    // map once for this half, matching PrimeNG's own single (non-mode-varying) shadow.
    // `padding` is NOT part of this object — verified it belongs on each component's
    // own `content.padding` (Popover/Dialog), not on the shared semantic.overlay.* shape.
    structural: {
      ...(kind !== 'navigation' && { borderRadius: get(map, kind === 'modal' ? 'radius.container' : 'radius.field') }),
      shadow: shadowStr,
    },
    padding: kind === 'navigation' || kind === 'select' ? undefined : get(map, kind === 'modal' ? 'space.6' : 'space.3'),
    // navigation has no colorScheme-scoped entry in real PrimeNG (Menu's root reads
    // `content.*` for its own background/color instead) — callers skip this for 'navigation'.
    colorScheme: kind === 'navigation' ? undefined : {
      background: get(map, `color.elevation.${n}.surface`),
      borderColor: get(map, 'color.neutral.outline'),
      color: get(map, 'color.text.base'),
    },
  };
}

/** Card/Panel-style containers (§4: "content needs no helper" — inline, kept as one function for call-site symmetry). */
export function content(map) {
  return {
    structural: { borderRadius: get(map, 'radius.field') },
    colorScheme: {
      background: get(map, 'color.elevation.1.surface'),
      hoverBackground: get(map, 'color.elevation.1.surface'),
      borderColor: get(map, 'color.neutral.outline'),
      color: get(map, 'color.text.base'),
      hoverColor: get(map, 'color.text.base'),
    },
  };
}
