/**
 * Exporter-private archetype helpers (docs/proposals/0002-component-theming-primeng.md
 * §2.3, §2.8, §4; docs/plan/component-tier.md C5). Per C1's cross-ecosystem
 * study (docs/findings/component-tier-study.md), `field`/`list`/`navigation`/
 * `overlay` are PrimeNG-specific groupings, not convergent vocabulary — they
 * live here, permanently, reading straight from existing catalog cells.
 * Nothing here is a catalog addition; every value below is `get(map, ...)`
 * against a slot that already exists in `semantic.*`.
 *
 * Shapes verified against real PrimeNG source (fetched 2026-07-21):
 * checkbox/radiobutton/toggleswitch/listbox/selectbutton `index.ts` (formField
 * consumers), listbox `index.ts` (`list.*`), menu `index.ts` (`navigation.*`),
 * popover/dialog `index.ts` (`overlay.*`).
 */

const get = (map, path) => map.get(`semantic.${path}`)?.value;

export function field(map) {
  return {
    paddingX: get(map, 'space.4'),
    paddingY: get(map, 'space.2'),
    borderRadius: get(map, 'radius.field'),
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
    transitionDuration: get(map, 'duration.fast'),
    sm: { paddingX: get(map, 'space.3'), paddingY: get(map, 'space.1') },
    lg: { paddingX: get(map, 'space.5'), paddingY: get(map, 'space.3') },
  };
}

export function list(map) {
  return {
    padding: get(map, 'space.1'),
    gap: get(map, 'space.0'),
    header: { padding: get(map, 'space.2') },
    option: {
      padding: get(map, 'space.2'),
      borderRadius: get(map, 'radius.control'),
      focusBackground: get(map, 'color.primary.tint'),
      selectedBackground: get(map, 'color.primary.tint-active'),
      selectedFocusBackground: get(map, 'color.primary.tint-active'),
      color: get(map, 'color.text.base'),
      focusColor: get(map, 'color.text.base'),
      selectedColor: get(map, 'color.primary.on-tint'),
      selectedFocusColor: get(map, 'color.primary.on-tint'),
    },
    optionGroup: {
      background: 'transparent',
      color: get(map, 'color.text.muted'),
      fontWeight: get(map, 'type.weight.semibold'),
      padding: get(map, 'space.2'),
    },
  };
}

export function navigation(map) {
  return {
    list: { padding: get(map, 'space.1'), gap: get(map, 'space.0') },
    item: {
      focusBackground: get(map, 'color.primary.tint'),
      color: get(map, 'color.text.base'),
      focusColor: get(map, 'color.text.base'),
      padding: get(map, 'space.2'),
      borderRadius: get(map, 'radius.control'),
      gap: get(map, 'space.2'),
      icon: { color: get(map, 'color.text.muted'), focusColor: get(map, 'color.text.base') },
    },
    submenuLabel: {
      padding: get(map, 'space.2'),
      fontWeight: get(map, 'type.weight.semibold'),
      background: 'transparent',
      color: get(map, 'color.text.muted'),
    },
  };
}

/** kind: 'popover' | 'modal' | 'navigation' | 'select' — each picks an elevation level. */
const OVERLAY_LEVEL = { select: 2, popover: 2, modal: 3, navigation: 2 };

export function overlay(map, kind, ctx) {
  const n = OVERLAY_LEVEL[kind] ?? 2;
  const shadow = map.get(`semantic.color.elevation.${n}.shadow`)?.value;
  return {
    background: get(map, `color.elevation.${n}.surface`),
    borderColor: get(map, 'color.neutral.outline'),
    color: get(map, 'color.text.base'),
    borderRadius: get(map, kind === 'modal' ? 'radius.container' : 'radius.field'),
    padding: get(map, kind === 'modal' ? 'space.6' : 'space.3'),
    shadow: shadow ? `${shadow.offsetX} ${shadow.offsetY} ${shadow.blur} ${shadow.spread} ${ctx.formatColor(shadow.color)}` : undefined,
  };
}

/** Card/Panel-style containers (§4: "content needs no helper" — inline, kept as one function for call-site symmetry). */
export function content(map) {
  return {
    background: get(map, 'color.elevation.1.surface'),
    borderColor: get(map, 'color.neutral.outline'),
    color: get(map, 'color.text.base'),
  };
}
