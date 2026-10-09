/**
 * @transtyle/exporter-chakra — emits a Chakra UI v3 system config from the
 * resolved IR: a `defineConfig()` object, and the `createSystem()` call that
 * merges it over Chakra's default theme. Spec: docs/specs/exporters/chakra.md.
 *
 * Why this target is mostly a rename: Chakra v3 themes colour through eight
 * semantic keys per palette (`solid`, `contrast`, `fg`, `subtle`, `muted`,
 * `emphasized`, `border`, `focusRing`, read as `colorPalette.<key>`), each with a
 * `_light` and a `_dark` value, and its recipes read those keys rather than
 * the numbered ramps. That is a projection of the role grid (PALETTE_KEYS
 * below), so every role becomes a Chakra palette and `colorPalette="danger"`
 * is the design system's danger in both schemes.
 *
 * Three rules shape the rest (mapping tables in the spec):
 *   - Partial config. `createSystem(defaultConfig, config)` deep-merges, so the
 *     module carries overrides and additions only; whatever the catalog has no
 *     meaning for stays Chakra's.
 *   - Route Chakra's defaults at roles, never rebind hue names. The default
 *     palette (`html { colorPalette: gray }`) becomes `neutral`, and the Alert's
 *     `status` variant reads `info`/`warning`/`success`/`danger`. Chakra's own
 *     `gray`, `red`, `blue`… stay what their names say.
 *   - The component tier writes a recipe value only when the design system
 *     authored something in its chain. Chakra's recipes already read the
 *     semantic routes (`l2` for control radius, `spacing.4` for button
 *     padding), so an unauthored tier would only overwrite Chakra's own
 *     per-size proportions with catalog defaults.
 */

import { COLOR_ROLES, droppedDimensions, fontStack } from '@transtyle/ir';
import { surfaceRows } from './surface-coverage.js';

const S = 'semantic.color.';

/**
 * Chakra palette key → role grid cell (`ring` is the design system's one
 * focus ring, not a grid cell). The two false friends are `muted` and
 * `emphasized`: tint depths in Chakra, not "muted text" or "emphasis".
 */
const PALETTE_KEYS = [
  { key: 'solid', cell: 'solid', cls: 'native' },
  { key: 'contrast', cell: 'on-solid', cls: 'native' },
  { key: 'fg', cell: 'text', cls: 'native' },
  { key: 'subtle', cell: 'tint', cls: 'native' },
  {
    key: 'muted',
    cell: 'tint-hover',
    cls: 'native',
    note: "false friend: Chakra's muted is a tint depth (the hover of subtle and ghost, a soft border), not muted text",
  },
  {
    key: 'emphasized',
    cell: 'tint-active',
    cls: 'native',
    note: "false friend: Chakra's emphasized is the deepest tint (selection, completed steps), not emphasis",
  },
  { key: 'border', cell: 'outline', cls: 'native' },
  {
    key: 'focusRing',
    slot: `${S}ring`,
    cls: 'approximated',
    note: "Chakra wants one focus ring per palette; the design system has one ring, so every palette gets it",
  },
];

/** Grid cells Chakra has no key for: it derives its hovers itself. */
const UNMAPPED_CELLS = ['solid-hover', 'solid-active', 'solid-selected', 'tint-selected', 'outline-hover', 'text-hover', 'text-active', 'on-tint', 'text-strong'];

/** Chakra's global semantic colours → catalog slot (under `semantic.color.`). */
const GLOBAL_COLORS = [
  ['bg', 'DEFAULT', 'elevation.0.surface', 'native'],
  ['bg', 'panel', 'elevation.1.surface', 'native'],
  ['bg', 'subtle', 'neutral.tint', 'approximated', "Chakra's bg.subtle is its gray 50; the neutral tint is the lightest neutral wash"],
  ['bg', 'muted', 'neutral.tint-hover', 'approximated', "Chakra's bg.muted is its gray 100, one step deeper"],
  ['bg', 'emphasized', 'neutral.tint-active', 'approximated', "Chakra's bg.emphasized is its gray 200, the deepest of the three"],
  ['bg', 'inverted', 'text.strong', 'approximated', "no inverted surface in the catalog; Chakra's is near-black in light (tooltips), as text.strong is"],
  ['fg', 'DEFAULT', 'text.base', 'native'],
  ['fg', 'muted', 'text.muted', 'native'],
  ['fg', 'subtle', 'text.subtle', 'native'],
  ['fg', 'inverted', 'text.inverse', 'native'],
  ['border', 'DEFAULT', 'border', 'native'],
  ['border', 'subtle', 'neutral.tint', 'approximated', "Chakra's border.subtle matches its bg.subtle; the neutral tint is the same rung"],
  ['border', 'muted', 'neutral.tint-hover', 'approximated', "Chakra's border.muted matches its bg.muted"],
  ['border', 'emphasized', 'neutral.outline', 'approximated', "Chakra's border.emphasized is its gray 300; the neutral outline is the catalog's stronger border"],
  ['border', 'inverted', 'text.strong', 'approximated', "no inverted border in the catalog; text.strong is the near-black rung"],
];

/** Chakra status name → catalog role. `error` is `danger`: the only rename. */
const STATUSES = [
  ['error', 'danger'],
  ['warning', 'warning'],
  ['success', 'success'],
  ['info', 'info'],
];

const SCALES = {
  fontSizes: ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'],
  radii: ['none', 'sm', 'md', 'lg', 'xl', 'full'],
};
const FONT_WEIGHTS = [
  ['normal', 'regular'],
  ['medium', 'medium'],
  ['semibold', 'semibold'],
  ['bold', 'bold'],
];
/** Catalog leading rung → Chakra line height, by rank (Chakra has five). */
const LINE_HEIGHTS = [
  ['short', 'tight'],
  ['moderate', 'normal'],
  ['tall', 'loose'],
];
const LETTER_SPACINGS = [
  ['tight', 'tight'],
  ['normal', 'normal'],
  ['wide', 'wide'],
];
const DURATIONS = [
  ['fastest', 'instant', 'approximated', "Chakra's fastest is 50ms; the catalog's instant is the shortest rung"],
  ['fast', 'fast', 'native'],
  ['moderate', 'normal', 'native'],
  ['slow', 'slow', 'native'],
  ['slower', 'slower', 'native'],
];
const EASINGS = [
  ['ease-in-out', 'standard'],
  ['ease-out', 'enter'],
  ['ease-in', 'exit'],
  ['emphasized', 'emphasized'],
  ['spring', 'spring'],
];
const Z = ['hide', 'base', 'dropdown', 'sticky', 'banner', 'overlay', 'modal', 'popover', 'toast', 'tooltip'];
const BREAKPOINTS = ['sm', 'md', 'lg', 'xl', '2xl'];
/** Chakra shadow size → elevation level, by rank. */
const SHADOWS = [
  ['sm', 1],
  ['md', 2],
  ['lg', 3],
  ['xl', 4],
];
/** Control size rung, the same names on both sides. */
const CONTROL_SIZES = ['sm', 'md', 'lg'];

export default {
  name: 'chakra',

  emit(normalized, ctx) {
    const light = normalized.modes.light ?? normalized.modes[normalized.defaultMode];
    const dark = normalized.modes.dark;
    const coverage = [];
    const row = (variable, slot, cls, note) =>
      coverage.push({ variable, slot, class: cls, ...(note ? { note } : {}) });
    const sem = (map, path) => map?.get(`semantic.${path}`)?.value;
    // Inventory id → the catalog slot this exporter writes it from, recorded
    // whether or not this design system defines the slot, so an entry left on
    // Chakra's default for want of it says which slot (surface-coverage.js).
    const mapped = new Map();
    const maps = (id, slot) => mapped.set(id, slot);

    /** A semantic token value: `{ _light, _dark }` when the design system has both schemes. */
    const colorToken = (path) => {
      const l = sem(light, `color.${path}`);
      if (!l) return undefined;
      const d = dark && sem(dark, `color.${path}`);
      return { value: d ? { _light: ctx.formatColor(l), _dark: ctx.formatColor(d) } : ctx.formatColor(l) };
    };
    const ringToken = colorToken('ring');

    const roles = [...COLOR_ROLES, ...normalized.roleArchetypes.keys()].filter((r) => sem(light, `color.${r}.solid`));

    // ---------- colours: one Chakra palette per role ----------
    const colors = {};
    for (const role of roles) {
      const palette = {};
      for (const p of PALETTE_KEYS) {
        const token = p.slot ? ringToken : colorToken(`${role}.${p.cell}`);
        if (!token) continue;
        palette[p.key] = token;
        row(`colors.${role}.${p.key}`, p.slot ?? `${S}${role}.${p.cell}`, p.cls, p.note);
      }
      colors[role] = palette;
      row(
        `colors.${role} (state cells)`,
        `${S}${role}.{${UNMAPPED_CELLS.join(',')}}`,
        'dropped',
        'Chakra has no palette key for them: its recipes derive hover and active as solid/90 and muted, pair subtle with fg, and have no strong text rung',
      );
    }
    if (!dark) {
      row('(dark scheme)', '—', 'dropped', 'the design system publishes no dark scheme: every semantic token carries one value for both');
    }

    for (const [group, key, slot, cls, note] of GLOBAL_COLORS) {
      maps(`semanticTokens.colors.${group}${key === 'DEFAULT' ? '' : `.${key}`}`, `${S}${slot}`);
      const token = colorToken(slot);
      if (!token) continue;
      colors[group] ??= {};
      colors[group][key] = token;
      row(`colors.${group}${key === 'DEFAULT' ? '' : `.${key}`}`, `${S}${slot}`, cls, note);
    }
    for (const [status, role] of STATUSES) {
      for (const [group, cell, note] of [
        ['bg', 'tint'],
        ['fg', 'text'],
        ['border', 'solid', status === 'error' ? 'also the border of an invalid field' : undefined],
      ]) {
        maps(`semanticTokens.colors.${group}.${status}`, `${S}${role}.${cell}`);
        const token = colorToken(`${role}.${cell}`);
        if (!token) continue;
        colors[group] ??= {};
        colors[group][status] = token;
        row(`colors.${group}.${status}`, `${S}${role}.${cell}`, 'native', note);
      }
    }

    const scrim = colorToken('scrim');
    if (scrim) {
      colors.scrim = scrim;
      row('colors.scrim (dialog and drawer backdrops)', `${S}scrim`, 'native', "replaces Chakra's blackAlpha.500 on both backdrops");
    }

    // ---------- tokens ----------
    const tokens = {};
    const put = (category, key, value) => {
      tokens[category] ??= {};
      tokens[category][key] = { value };
    };

    const sans = sem(light, 'font.sans');
    const display = sem(light, 'font.display');
    const mono = sem(light, 'font.mono');
    const serif = sem(light, 'font.serif');
    maps('tokens.fonts.body', 'semantic.font.sans');
    maps('tokens.fonts.heading', 'semantic.font.{display,sans}');
    maps('tokens.fonts.mono', 'semantic.font.mono');
    if (sans) {
      put('fonts', 'body', fontStack(sans));
      row('fonts.body', 'semantic.font.sans', 'native');
    }
    if (display ?? sans) {
      put('fonts', 'heading', fontStack(display ?? sans));
      row('fonts.heading', display ? 'semantic.font.display' : 'semantic.font.sans', 'native', display ? undefined : 'no display face authored: headings take the sans');
    }
    if (mono) {
      put('fonts', 'mono', fontStack(mono));
      row('fonts.mono', 'semantic.font.mono', 'native');
    }
    if (serif) {
      put('fonts', 'serif', fontStack(serif));
      row('fonts.serif', 'semantic.font.serif', 'native', 'an extra key: Chakra has no serif face of its own');
    }

    for (const k of SCALES.fontSizes) {
      maps(`tokens.fontSizes.${k}`, `semantic.type.size.${k}`);
      const v = sem(light, `type.size.${k}`);
      if (v === undefined) continue;
      put('fontSizes', k, String(v));
      row(`fontSizes.${k}`, `semantic.type.size.${k}`, 'native');
    }
    for (const [chakra, rung] of FONT_WEIGHTS) {
      maps(`tokens.fontWeights.${chakra}`, `semantic.type.weight.${rung}`);
      const v = sem(light, `type.weight.${rung}`);
      if (v === undefined) continue;
      put('fontWeights', chakra, String(v));
      row(`fontWeights.${chakra}`, `semantic.type.weight.${rung}`, 'native');
    }
    for (const [chakra, rung] of LINE_HEIGHTS) {
      maps(`tokens.lineHeights.${chakra}`, `semantic.type.leading.${rung}`);
      const v = sem(light, `type.leading.${rung}`);
      if (v === undefined) continue;
      put('lineHeights', chakra, v);
      row(`lineHeights.${chakra}`, `semantic.type.leading.${rung}`, 'approximated', "by rank: three catalog rungs for Chakra's five; Chakra's text styles carry their own line heights, so leading does not reach them");
    }
    for (const [chakra, rung] of LETTER_SPACINGS) {
      maps(`tokens.letterSpacings.${chakra}`, `semantic.type.tracking.${rung}`);
      const v = sem(light, `type.tracking.${rung}`);
      if (v === undefined) continue;
      put('letterSpacings', chakra, String(v));
      row(`letterSpacings.${chakra}`, `semantic.type.tracking.${rung}`, 'native', chakra === 'normal' ? 'an extra key: Chakra has no normal rung' : undefined);
    }

    for (const k of SCALES.radii) {
      maps(`tokens.radii.${k}`, `semantic.radius.${k}`);
      const v = sem(light, `radius.${k}`);
      if (v === undefined) continue;
      put('radii', k, String(v));
      row(`radii.${k}`, `semantic.radius.${k}`, 'native');
    }

    const spaceKeys = [...light.keys()]
      .map((k) => /^semantic\.space\.(\d+)$/.exec(k)?.[1])
      .filter((k) => k !== undefined)
      .sort((a, b) => Number(a) - Number(b));
    for (const k of spaceKeys) {
      put('spacing', k, String(sem(light, `space.${k}`)));
      row(`spacing.${k}`, `semantic.space.${k}`, 'native');
    }

    for (const [chakra, rung, cls, note] of DURATIONS) {
      maps(`tokens.durations.${chakra}`, `semantic.duration.${rung}`);
      const v = sem(light, `duration.${rung}`);
      if (v === undefined) continue;
      put('durations', chakra, String(v));
      row(`durations.${chakra}`, `semantic.duration.${rung}`, cls, note);
    }
    for (const [chakra, rung] of EASINGS) {
      maps(`tokens.easings.${chakra}`, `semantic.easing.${rung}`);
      const v = sem(light, `easing.${rung}`);
      if (v === undefined) continue;
      put('easings', chakra, String(v));
      row(`easings.${chakra}`, `semantic.easing.${rung}`, 'native', ['emphasized', 'spring'].includes(chakra) ? 'an extra key' : undefined);
    }
    for (const k of Z) {
      maps(`tokens.zIndex.${k}`, `semantic.z.${k}`);
      const v = sem(light, `z.${k}`);
      if (v === undefined) continue;
      put('zIndex', k, v);
      row(`zIndex.${k}`, `semantic.z.${k}`, 'native');
    }

    const breakpoints = {};
    for (const k of BREAKPOINTS) {
      maps(`breakpoints.${k}`, `semantic.breakpoint.${k}`);
      const v = sem(light, `breakpoint.${k}`);
      if (v === undefined) continue;
      breakpoints[k] = String(v);
      row(`breakpoints.${k}`, `semantic.breakpoint.${k}`, 'native');
    }
    if (sem(light, 'breakpoint.xs') !== undefined) {
      row('(breakpoint xs)', 'semantic.breakpoint.xs', 'dropped', "Chakra's smallest breakpoint is base (0), then sm");
    }

    // ---------- semantic radii and shadows ----------
    const semanticTokens = { colors };
    const radii = {};
    for (const [key, slot, cls, note] of [
      ['l1', 'radius.sm', 'approximated', 'l1 rounds inner items (menu and listbox items, checkmarks, tags); the small radius is the nearest rung'],
      ['l2', 'radius.control', 'approximated', 'l2 rounds controls (buttons, inputs, selects) and also badges, tooltips and toasts'],
      ['l3', 'radius.container', 'native', 'l3 rounds containers (cards, dialogs, popovers, drawers, alerts)'],
    ]) {
      maps(`semanticTokens.radii.${key}`, `semantic.${slot}`);
      const v = sem(light, slot);
      if (v === undefined) continue;
      radii[key] = { value: String(v) };
      row(`radii.${key} (semantic)`, `semantic.${slot}`, cls, note);
    }
    if (Object.keys(radii).length) semanticTokens.radii = radii;

    const shadows = {};
    for (const [key, level] of SHADOWS) {
      maps(`semanticTokens.shadows.${key}`, `${S}elevation.${level}.shadow`);
      const l = sem(light, `color.elevation.${level}.shadow`);
      if (!l) continue;
      const d = dark && sem(dark, `color.elevation.${level}.shadow`);
      shadows[key] = { value: d ? { _light: shadowCss(l, ctx), _dark: shadowCss(d, ctx) } : shadowCss(l, ctx) };
      row(`shadows.${key}`, `${S}elevation.${level}.shadow`, 'approximated', "by rank: four elevation shadows for Chakra's sm to xl; xs, 2xl and inset stay Chakra's");
    }
    if (Object.keys(shadows).length) semanticTokens.shadows = shadows;

    // ---------- text styles: one per type role ----------
    const textStyles = {};
    const roleKeys = [...light.keys()].filter((k) => k.startsWith('semantic.type.role.')).sort();
    for (const key of roleKeys) {
      const t = light.get(key).value;
      if (!t || typeof t !== 'object') continue;
      const name = key.slice('semantic.type.role.'.length);
      textStyles[name] = {
        value: {
          ...(t.fontFamily !== undefined ? { fontFamily: fontStack(t.fontFamily) } : {}),
          ...(t.fontSize !== undefined ? { fontSize: String(t.fontSize) } : {}),
          ...(t.fontWeight !== undefined ? { fontWeight: String(t.fontWeight) } : {}),
          ...(t.lineHeight !== undefined ? { lineHeight: String(t.lineHeight) } : {}),
          ...(t.letterSpacing !== undefined ? { letterSpacing: String(t.letterSpacing) } : {}),
        },
      };
    }
    if (Object.keys(textStyles).length) {
      row('textStyles.<role>.<size>', 'semantic.type.role.*', 'native', `${Object.keys(textStyles).length} named text styles (textStyle="heading.lg"); Chakra's own size-named styles stay`);
    }

    // ---------- layer styles ----------
    const layerStyles = {};
    const disabled = sem(light, 'opacity.disabled');
    if (disabled !== undefined) {
      layerStyles.disabled = { value: { opacity: String(disabled) } };
      row('layerStyles.disabled.opacity', 'semantic.opacity.disabled', 'native', 'every Chakra control reads the disabled layer style');
    }
    row('(disabled text colour)', `${S}text.disabled`, 'dropped', "Chakra dims disabled controls with the disabled layer style's opacity, not with a colour");

    // ---------- recipes: routing and the component tier ----------
    const recipes = {};
    const slotRecipes = {};
    const set = (root, path, value) => {
      let node = root;
      const keys = path.split('.');
      for (const k of keys.slice(0, -1)) node = node[k] ??= {};
      node[keys.at(-1)] = value;
    };

    // Route Chakra's own defaults at roles.
    const globalCss = { html: { colorPalette: 'neutral' } };
    row('globalCss.html.colorPalette', `${S}neutral.*`, 'native', "Chakra's default palette (gray) becomes the neutral role, so components without a colorPalette wear the design system's neutral grid");
    for (const [status, role] of [...STATUSES, ['neutral', 'neutral']]) {
      set(slotRecipes, `alert.variants.status.${status}.root.colorPalette`, role);
    }
    row('Alert status → colorPalette', `${S}{info,warning,success,danger,neutral}.*`, 'native', "Chakra hard-codes blue, orange, green, red and gray; the statuses now read the roles of the same meaning");
    set(recipes, 'checkmark.base._invalid.colorPalette', 'danger');
    set(recipes, 'radiomark.base._invalid.colorPalette', 'danger');
    set(recipes, 'radiomark.base._invalid.borderColor', 'border.error');
    row('Checkbox and Radio _invalid → colorPalette', `${S}danger.*`, 'native', 'Chakra hard-codes red on invalid checkmarks and radio marks');
    if (scrim) {
      set(slotRecipes, 'dialog.base.backdrop.bg', 'scrim');
      set(slotRecipes, 'drawer.base.backdrop.bg', 'scrim');
    }

    // Control heights: semantic tier, emitted like every other scale.
    for (const size of CONTROL_SIZES) {
      const v = sem(light, `size.control.${size}`);
      if (v === undefined) continue;
      set(recipes, `button.variants.size.${size}.h`, String(v));
      set(recipes, `button.variants.size.${size}.minW`, String(v));
      set(recipes, `input.variants.size.${size}.--input-height`, String(v));
    }
    if (CONTROL_SIZES.some((s) => sem(light, `size.control.${s}`) !== undefined)) {
      row('Button and Input size sm/md/lg height', 'semantic.size.control.{sm,md,lg}', 'native', "same rung names; Chakra's 2xs, xs, xl and 2xl keep their own heights");
    }

    // Component tier: only what the design system authored somewhere in the chain.
    const comp = (path) => light.get(`component.${path}`);
    const authored = (path) => {
      const entry = comp(path);
      if (!entry) return false;
      const kind = entry.provenance?.kind;
      if (kind === 'authored' || kind === 'aliased') return true;
      const via = /^alias\((control\.[\w-]+)\)/.exec(entry.provenance?.rule ?? '')?.[1];
      return via ? authored(via) : false;
    };
    const tier = [
      ['button.radius', ['button.base.borderRadius'], 'native'],
      ['button.padding-x', ['button.variants.size.md.px'], 'approximated', "Chakra pads each size separately and the tier has one value: it lands on the default size, md"],
      ['control.radius', ['input.base.borderRadius', 'textarea.base.borderRadius'], 'native'],
      ['control.padding-x', ['input.variants.size.md.px', 'textarea.variants.size.md.px'], 'approximated', 'one value for the default size, md, as for buttons'],
    ];
    let tierEmitted = false;
    for (const [path, targets, cls, note] of tier) {
      if (!authored(path)) continue;
      const v = String(comp(path).value);
      for (const t of targets) set(recipes, t, v);
      row(`recipes.${targets.join(' + recipes.')}`, `component.${path}`, cls, note);
      tierEmitted = true;
    }
    if (!tierEmitted) {
      row('(component tier)', 'component.{button,control}.*', 'native', "nothing authored: Chakra's recipes already read l2 (radius.control) and the spacing scale, so its own per-size proportions stay");
    }
    if (comp('control.padding-y') || comp('button.padding-y')) {
      row('(vertical padding)', 'component.{control,button}.padding-y', 'dropped', 'Chakra buttons and inputs are height-driven: their size variants set h and px, never py');
    }
    const tooltipMax = comp('tooltip.max-width');
    if (tooltipMax) {
      set(slotRecipes, 'tooltip.base.content.maxW', String(tooltipMax.value));
      row('slotRecipes.tooltip.base.content.maxW', 'component.tooltip.max-width', 'native', "Chakra's own ceiling is sizes.xs (20rem)");
    }

    // A slot recipe override must name its slots (Chakra's type requires it);
    // they come from Chakra's own anatomy, so the list is never copied here.
    // Arrays merge index by index, so the same list merges onto itself.
    for (const name of Object.keys(slotRecipes)) slotRecipes[name] = { slots: new Raw(`${name}Anatomy.keys()`), ...slotRecipes[name] };

    // ---------- what Chakra has no slot for ----------
    row('(link colours)', `${S}link.{base,hover,visited}`, 'dropped', "Chakra's Link reads colorPalette.fg: links follow the palette they sit in (colorPalette=\"primary\" for brand links)");
    row('(categorical palette)', 'semantic.palette.categorical.*', 'dropped', "no chart slot in Chakra's theme");
    row('(border widths)', 'semantic.border-width.*', 'dropped', "Chakra's recipes write borderWidth: 1px literally; its borders tokens are shorthands");
    row('(elevation surfaces 2–5)', `${S}elevation.{2,3,4,5}.surface`, 'dropped', 'Chakra has two surfaces, bg and bg.panel');
    coverage.push(...droppedDimensions(normalized.dimensionNames, ['color-scheme']));

    const theme = {
      ...(Object.keys(breakpoints).length ? { breakpoints } : {}),
      tokens,
      semanticTokens,
      ...(Object.keys(textStyles).length ? { textStyles } : {}),
      ...(Object.keys(layerStyles).length ? { layerStyles } : {}),
      recipes,
      slotRecipes,
    };

    // AL3: measure what was emitted against Chakra's whole theming surface
    // (surface-inventory.json, extracted from @chakra-ui/react's defaultConfig).
    coverage.push(...surfaceRows({ globalCss, theme }, mapped));

    return {
      files: [
        { path: 'theme.transtyle.ts', contents: renderConfig(ctx, { globalCss, theme }, Object.keys(slotRecipes)), kind: 'source' },
        { path: 'usage.md', contents: renderUsage(ctx, coverage, !!dark), kind: 'doc' },
      ],
      coverage,
    };
  },
};

// ---------- helpers ----------

function shadowCss(value, ctx) {
  const layers = Array.isArray(value) ? value : [value];
  return layers
    .map((s) => `${s.inset ? 'inset ' : ''}${s.offsetX} ${s.offsetY} ${s.blur} ${s.spread} ${ctx.formatColor(s.color)}`)
    .join(', ');
}

// ---------- TS serialization ----------

/** A TypeScript expression written as is, not as a JSON value. */
class Raw {
  constructor(code) {
    this.code = code;
  }
}

const key = (k) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k));

function serialize(value, indent) {
  const pad = ' '.repeat(indent);
  const padIn = ' '.repeat(indent + 2);
  if (value instanceof Raw) return value.code;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => serialize(v, indent)).join(', ')}]`;
  const entries = Object.entries(value).filter(([, v]) => v !== undefined);
  if (!entries.length) return '{}';
  // A token leaf (`{ value: … }`) stays on one line: the file is read by people
  // comparing values, and three lines per token would bury them.
  if (entries.length === 1 && entries[0][0] === 'value' && (typeof entries[0][1] !== 'object' || Object.keys(entries[0][1]).length <= 2)) {
    const inner = entries[0][1];
    const v = typeof inner === 'object'
      ? `{ ${Object.entries(inner).map(([k, x]) => `${key(k)}: ${JSON.stringify(x)}`).join(', ')} }`
      : JSON.stringify(inner);
    return `{ value: ${v} }`;
  }
  return `{\n${entries.map(([k, v]) => `${padIn}${key(k)}: ${serialize(v, indent + 2)}`).join(',\n')},\n${pad}}`;
}

function renderConfig(ctx, config, anatomies) {
  const anatomyImport = anatomies.length
    ? `import { ${anatomies.sort().map((n) => `${n}Anatomy`).join(', ')} } from '@chakra-ui/react/anatomy';\n`
    : '';
  return `// GENERATED by transtyle — do not edit; source: ${ctx.projectName} token files
// Target: Chakra UI v3 (createSystem config) · rules standard@1
// See usage.md in this directory for the wiring and the coverage report.
import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';
${anatomyImport}
/** Overrides and additions only: createSystem() merges them over Chakra's default theme. */
export const config = defineConfig(${serialize(config, 0)});

/** Pass to <ChakraProvider value={system}>. */
export const system = createSystem(defaultConfig, config);
`;
}

function renderUsage(ctx, coverage, hasDark) {
  const counts = {};
  for (const c of coverage) counts[c.class] = (counts[c.class] ?? 0) + 1;
  const summary = Object.entries(counts)
    .map(([k, v]) => `${v} ${k}`)
    .join(' · ');
  return `# Using this Chakra UI theme

Generated from the **${ctx.projectName}** design system by transtyle: a Chakra UI v3 \`defineConfig()\` object, and the \`createSystem()\` call that merges it over Chakra's default theme, both in \`theme.transtyle.ts\`. Coverage: ${summary}.

## Setup

\`\`\`tsx
import { ChakraProvider } from '@chakra-ui/react';
import { system } from './theme.transtyle';

<ChakraProvider value={system}>
  <App />
</ChakraProvider>
\`\`\`

To add your own overrides, merge them in the same call: \`createSystem(defaultConfig, config, yourConfig)\` with the exported \`config\`.

Every role is a colour palette: \`<Button colorPalette="primary">\`, \`<Badge colorPalette="success">\`, \`<Alert.Root status="error">\` (which reads \`danger\`). Components without a \`colorPalette\` wear the \`neutral\` role. For TypeScript autocompletion of the role names, run \`npx @chakra-ui/cli typegen ./theme.transtyle.ts\`; it builds without that step too.

${hasDark ? "The colour scheme follows Chakra's own conditions: a `.dark` class on `<html>` (or on any ancestor) switches every role to its dark values. `next-themes` or a class toggle both work." : 'This design system publishes no dark scheme, so every semantic token carries one value: the page stays light whatever class `<html>` carries.'}

## How the colours map

- Each role is a palette with Chakra's eight keys: \`solid\`, \`contrast\` (on-solid), \`fg\` (text), \`subtle\` (tint), \`muted\` (tint-hover), \`emphasized\` (tint-active), \`border\` (outline) and \`focusRing\` (the design system's one ring).
- \`muted\` and \`emphasized\` are false friends: in Chakra they are tint depths, not muted text or emphasis.
- Chakra derives its own hovers (\`solid/90\`, \`muted\`), so the grid's hover, active and selected cells have no key; \`report.json\` lists them as dropped.
- \`bg\`, \`fg\` and \`border\` come from the elevation ladder, the text rungs and the border; \`bg.error\`, \`fg.error\` and \`border.error\` (and warning, success, info) from the status roles.
- Chakra's hue palettes (\`gray\`, \`red\`, \`blue\`…) are untouched: \`colorPalette="red"\` is still red.

## Regenerating

Never edit this file — change the design system tokens and run \`transtyle build chakra\`. See \`report.json\` for the full coverage/provenance breakdown.
`;
}
