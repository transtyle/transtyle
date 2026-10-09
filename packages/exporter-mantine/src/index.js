/**
 * @transtyle/exporter-mantine — emits a Mantine 9 theme module from the
 * resolved IR: a `createTheme()` object and a `cssVariablesResolver` for
 * `<MantineProvider>`. Spec: docs/specs/exporters/mantine.md.
 *
 * Why a resolver and no override stylesheet: Mantine writes its own CSS
 * variables at runtime, in a `<style>` inside the React tree, under `:root`
 * and `:root[data-mantine-color-scheme="dark"]`. A stylesheet loaded from
 * `<head>` loses that cascade for every variable Mantine writes itself (on
 * specificity, then on source order). The provider's `cssVariablesResolver`
 * result is merged over Mantine's own defaults, so it always wins — it is the
 * supported route, and the only one that holds.
 *
 * Colour model (mapping tables in the spec):
 *   - every role becomes a `virtualColor()` over two 10-step tuples,
 *     `<role>-light` and `<role>-dark`, so one name carries the catalog's
 *     per-mode grid. Index i is the same grid cell in both schemes (TUPLE);
 *     all ten are direct cells, no mix.
 *   - Mantine's components read per-colour variant variables
 *     (`--mantine-color-<role>-filled`, `-light`, `-outline`, …), not tuple
 *     indices. The resolver sets each one per scheme straight from that
 *     scheme's grid, so the variants are exact whatever the tuple position.
 *   - `gray` and `dark` are Mantine's two neutral tuples, read directly by
 *     its stylesheet hundreds of times: `gray` from the light neutral ladder,
 *     `dark` from the dark one.
 * Tuples are hex: Mantine's colour functions (darken, alpha, luminance) parse
 * them in JS and do not read `oklch()`. Everything the resolver writes is CSS,
 * so it keeps the IR's own `oklch()` (and its alpha, e.g. `text.disabled`).
 */

import { COLOR_ROLES, droppedDimensions, fontStack } from '@transtyle/ir';
import { surfaceRows } from './surface-coverage.js';

const S = 'semantic.color.';

/** Mantine tuple index → role grid cell (the same in both schemes). */
const TUPLE = [
  'tint',
  'tint-hover',
  'tint-active',
  'outline',
  'outline-hover',
  'solid',
  'solid-hover',
  'solid-active',
  'text',
  'text-strong',
];
/** Where `solid` sits in TUPLE: Mantine's `primaryShade`, and its own `filled-hover` (shade + 1) is `solid-hover`. */
const PRIMARY_SHADE = TUPLE.indexOf('solid');

/**
 * Per-colour variant variables, per scheme. `cell` is a role grid cell;
 * the three `approximated` ones are false friends documented in the spec.
 */
const VARIANT_VARS = [
  { suffix: 'filled', cell: 'solid', cls: 'native' },
  { suffix: 'filled-hover', cell: 'solid-hover', cls: 'native' },
  { suffix: 'contrast', cell: 'on-solid', cls: 'native' },
  { suffix: 'light', cell: 'tint', cls: 'native' },
  { suffix: 'light-hover', cell: 'tint-hover', cls: 'native' },
  {
    suffix: 'light-color',
    cell: 'on-tint',
    cls: 'approximated',
    note: 'one Mantine variable is the text of the light, subtle and transparent variants alike; on-tint is right on the tint and close to role text on the page',
  },
  {
    suffix: 'outline',
    cell: 'text',
    cls: 'approximated',
    note: "Mantine's outline colour is both the border and the label; the catalog's outline cell is a border colour too light for text, so the role's text colour carries both",
  },
  {
    suffix: 'outline-hover',
    cell: 'tint',
    cls: 'approximated',
    note: "Mantine's outline-hover is the hovered background, not a border — the catalog's outline-hover (a hovered border) is a false friend; the tint is the nearest background",
  },
  { suffix: 'text', cell: 'text', cls: 'native' },
];

/** Page-level variables per scheme: Mantine name → catalog slot (under `semantic.color.`). */
const PAGE_VARS = [
  ['body', 'elevation.0.surface', 'native'],
  ['text', 'text.base', 'native'],
  ['bright', 'text.strong', 'native'],
  ['dimmed', 'text.muted', 'native'],
  ['placeholder', 'text.subtle', 'native'],
  ['anchor', 'link.base', 'native'],
  ['error', 'danger.text', 'native'],
  ['success', 'success.text', 'native'],
  ['default', 'elevation.1.surface', 'native'],
  ['default-hover', 'neutral.tint-hover', 'native'],
  ['default-color', 'text.base', 'native'],
  ['default-border', 'border.base', 'native'],
  ['disabled', 'neutral.tint-active', 'approximated', 'no disabled-surface rung in the catalog; the pressed neutral tint is the nearest muted fill'],
  ['disabled-color', 'text.disabled', 'native'],
  ['disabled-border', 'border.base', 'approximated', 'no disabled-border rung; the page border is used'],
];

/**
 * Mantine's `gray` tuple (light scheme), indexed where Mantine's own page
 * variables read it (default-hover gray-0, default-border gray-4, dimmed
 * gray-6, …), filled from the light neutral ladder.
 */
const GRAY = [
  'neutral.tint',
  'neutral.tint-hover',
  'neutral.tint-active',
  'neutral.outline',
  'border.base',
  'text.subtle',
  'text.muted',
  'neutral.solid-hover',
  'text.base',
  'text.strong',
];

/**
 * Mantine's `dark` tuple (dark scheme), from the dark ladder: index 0 is the
 * text and 7 the page, as Mantine's dark defaults read them. Index 1 is a mix
 * between two rungs, and 8–9 sit below the page, where the grid has nothing.
 */
const DARK = [
  'text.base',
  null, // mix(text.base, text.muted)
  'text.muted',
  'text.subtle',
  'border.base',
  'neutral.tint-hover',
  'elevation.1.surface',
  'elevation.0.surface',
  null, // below the page
  null, // below the page
];

const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'];
const BLACK = { l: 0, c: 0, h: 0, alpha: 1 };

export default {
  name: 'mantine',

  emit(normalized, ctx) {
    const light = normalized.modes.light ?? normalized.modes[normalized.defaultMode];
    const dark = normalized.modes.dark;
    const coverage = [];
    const row = (variable, slot, cls, note) =>
      coverage.push({ variable, slot, class: cls, ...(note ? { note } : {}) });
    const sem = (map, path) => map?.get(`semantic.${path}`)?.value;
    const hex = (color) => ctx.formatHex(color).text;

    const roles = [...COLOR_ROLES, ...normalized.roleArchetypes.keys()].filter((r) =>
      sem(light, `color.${r}.solid`),
    );

    // ---------- colours: one virtual colour per role ----------
    const colors = {};
    const virtuals = [];
    const tupleOf = (map, role) => {
      const values = TUPLE.map((cell) => sem(map, `color.${role}.${cell}`));
      return values.every(Boolean) ? values : null;
    };
    for (const role of roles) {
      const lightTuple = tupleOf(light, role);
      if (!lightTuple) continue;
      const darkTuple = dark && tupleOf(dark, role);
      colors[`${role}-light`] = lightTuple.map(hex);
      if (darkTuple) colors[`${role}-dark`] = darkTuple.map(hex);
      virtuals.push({ name: role, light: `${role}-light`, dark: darkTuple ? `${role}-dark` : `${role}-light` });
      const clamped = [...lightTuple, ...(darkTuple ?? [])].some((c) => ctx.formatHex(c).clamped);
      row(
        `colors.${role}-{light${darkTuple ? ',dark' : ''}}[0-9]`,
        `${S}${role}.*`,
        clamped ? 'approximated' : 'native',
        clamped
          ? 'one or more cells are out of sRGB gamut; Mantine tuples are hex, so they are clipped here (the resolver variables keep oklch())'
          : undefined,
      );
      if (!darkTuple) {
        row(
          `colors.${role} (dark scheme)`,
          '—',
          'dropped',
          'the design system publishes no dark scheme; the virtual colour points at the light tuple in both',
        );
      }
    }

    // gray: the light neutral ladder. dark: the dark ladder.
    const grayValues = GRAY.map((p) => sem(light, `color.${p}`));
    if (grayValues.every(Boolean)) {
      colors.gray = grayValues.map(hex);
      row('colors.gray[0-9]', `${S}neutral.* + text.* + border`, 'native', "Mantine's light neutral tuple, filled from the light neutral ladder at the indices Mantine's own page variables read");
    }
    if (dark) {
      const base = sem(dark, 'color.text.base');
      const muted = sem(dark, 'color.text.muted');
      const page = sem(dark, 'color.elevation.0.surface');
      const darkValues = DARK.map((p, i) => {
        if (p) return sem(dark, `color.${p}`);
        if (i === 1) return base && muted && ctx.mix(base, muted, 0.5);
        return page && ctx.mix(page, BLACK, i === 8 ? 0.2 : 0.4);
      });
      if (darkValues.every(Boolean)) {
        colors.dark = darkValues.map(hex);
        row('colors.dark[0,2-7]', `${S}text.* + border + neutral.tint-hover + elevation.{0,1}.surface`, 'native', "Mantine's dark neutral tuple, filled from the dark ladder at the indices Mantine's own dark defaults read");
        row('colors.dark[1,8,9]', '—', 'approximated', 'no rung between text.base and text.muted (1), and nothing darker than elevation.0 (8, 9): mixed');
      }
    } else {
      row('colors.dark', '—', 'dropped', "no dark scheme published; Mantine's own dark tuple stays");
    }

    // ---------- resolver: per-scheme variables ----------
    const schemeVars = (map, first) => {
      const out = {};
      for (const role of roles) {
        if (!sem(map, `color.${role}.solid`)) continue;
        for (const v of VARIANT_VARS) {
          const value = sem(map, `color.${role}.${v.cell}`);
          if (!value) continue;
          const name = `--mantine-color-${role}-${v.suffix}`;
          out[name] = ctx.formatColor(value);
          if (first) row(name, `${S}${role}.${v.cell}`, v.cls, v.note);
        }
      }
      const onSolid = sem(map, 'color.primary.on-solid');
      if (onSolid) {
        out['--mantine-primary-color-contrast'] = ctx.formatColor(onSolid);
        if (first) row('--mantine-primary-color-contrast', `${S}primary.on-solid`, 'native');
      }
      for (const [name, slot, cls, note] of PAGE_VARS) {
        const value = sem(map, `color.${slot}`);
        if (!value) continue;
        out[`--mantine-color-${name}`] = ctx.formatColor(value);
        if (first) row(`--mantine-color-${name}`, `${S}${slot}`, cls, note);
      }
      // Mantine's light scheme paints its raised surfaces (Card, inputs,
      // popovers, menus) with `--mantine-color-white`, where the dark scheme
      // reads `dark-6` (elevation 1 above). Light only: in dark, white stays
      // the icon colour on filled controls it also is.
      const raised = sem(map, 'color.elevation.1.surface');
      if (first && raised) {
        out['--mantine-color-white'] = ctx.formatColor(raised);
        row(
          '--mantine-color-white (light scheme)',
          `${S}elevation.1.surface`,
          'approximated',
          "Mantine's light scheme uses white both for raised surfaces (cards, inputs, popovers) and for icons on filled controls such as the checkbox tick; the raised surface wins",
        );
      }
      return out;
    };
    const lightVars = schemeVars(light, true);
    const darkVars = dark ? schemeVars(dark, false) : null;

    // ---------- typography ----------
    const theme = {
      primaryColor: 'primary',
      primaryShade: { light: PRIMARY_SHADE, dark: PRIMARY_SHADE },
      autoContrast: true,
    };
    row('primaryColor / primaryShade', `${S}primary.solid`, 'native', `primaryShade ${PRIMARY_SHADE} is the solid cell in both schemes`);

    const sans = sem(light, 'font.sans');
    const mono = sem(light, 'font.mono');
    if (sans) {
      theme.fontFamily = fontStack(sans);
      row('fontFamily', 'semantic.font.sans', 'native');
    }
    if (mono) {
      theme.fontFamilyMonospace = fontStack(mono);
      row('fontFamilyMonospace', 'semantic.font.mono', 'native');
    }

    const HEADINGS = [
      ['h1', 'heading.lg'],
      ['h2', 'heading.md'],
      ['h3', 'heading.sm'],
      ['h4', 'title.lg'],
      ['h5', 'title.md'],
      ['h6', 'title.sm'],
    ];
    const headingSizes = {};
    for (const [h, role] of HEADINGS) {
      const t = sem(light, `type.role.${role}`);
      if (!t?.fontSize) continue;
      headingSizes[h] = {
        fontSize: t.fontSize,
        ...(t.lineHeight !== undefined ? { lineHeight: String(t.lineHeight) } : {}),
        ...(t.fontWeight !== undefined ? { fontWeight: String(t.fontWeight) } : {}),
      };
      row(`headings.sizes.${h}`, `semantic.type.role.${role}`, 'native');
    }
    const headingRole = sem(light, 'type.role.heading.lg');
    const display = sem(light, 'font.display');
    const headingFamily = display ?? headingRole?.fontFamily;
    if (headingFamily || Object.keys(headingSizes).length) {
      theme.headings = {
        ...(headingFamily ? { fontFamily: fontStack(headingFamily) } : {}),
        ...(headingRole?.fontWeight !== undefined ? { fontWeight: String(headingRole.fontWeight) } : {}),
        ...(Object.keys(headingSizes).length ? { sizes: headingSizes } : {}),
      };
      if (headingFamily) row('headings.fontFamily', display ? 'semantic.font.display' : 'semantic.type.role.heading.lg', 'native');
    }
    if (sem(light, 'type.role.display.lg')) {
      row('(display type roles)', 'semantic.type.role.display.*', 'dropped', 'Mantine has six heading levels and no display tier; h1–h6 take heading.* and title.*');
    }

    theme.fontSizes = scale(light, 'type.size', SIZES, row, 'fontSizes');
    const leading = { xs: 'tight', sm: 'tight', md: 'normal', lg: 'loose', xl: 'loose' };
    theme.lineHeights = {};
    for (const size of SIZES) {
      const value = sem(light, `type.leading.${leading[size]}`);
      if (value === undefined) continue;
      theme.lineHeights[size] = String(value);
      row(
        `lineHeights.${size}`,
        `semantic.type.leading.${leading[size]}`,
        size === 'sm' || size === 'lg' ? 'approximated' : 'native',
        size === 'sm' || size === 'lg' ? 'three catalog rungs for five Mantine sizes: this one repeats its neighbour' : undefined,
      );
    }
    theme.fontWeights = {};
    for (const w of ['regular', 'medium', 'bold']) {
      const value = sem(light, `type.weight.${w}`);
      if (value === undefined) continue;
      theme.fontWeights[w] = String(value);
      row(`fontWeights.${w}`, `semantic.type.weight.${w}`, 'native');
    }

    // ---------- scales ----------
    theme.radius = {};
    const radiusSm = sem(light, 'radius.sm');
    const halfSm = radiusSm && scaleDim(radiusSm, 0.5);
    if (halfSm) {
      theme.radius.xs = halfSm;
      row('radius.xs', 'semantic.radius.sm', 'approximated', 'no rung below radius.sm: half of it');
    }
    Object.assign(theme.radius, scale(light, 'radius', ['sm', 'md', 'lg', 'xl'], row, 'radius'));
    const radiusControl = sem(light, 'radius.control');
    if (radiusControl !== undefined) {
      theme.defaultRadius = String(radiusControl);
      row('defaultRadius', 'semantic.radius.control', 'native');
    }

    const SPACING = { xs: 'space.2', sm: 'space.3', md: 'space.4', lg: 'space.5', xl: 'space.8' };
    theme.spacing = {};
    for (const size of SIZES) {
      const value = sem(light, SPACING[size]);
      if (value === undefined) continue;
      theme.spacing[size] = String(value);
      row(
        `spacing.${size}`,
        `semantic.${SPACING[size]}`,
        size === 'xs' ? 'approximated' : 'native',
        size === 'xs' ? "Mantine's xs (10px) sits between space.2 and space.3; the smaller rung is used" : undefined,
      );
    }

    const SHADOWS = { xs: 1, sm: 2, md: 3, lg: 4, xl: 4 };
    theme.shadows = {};
    for (const size of SIZES) {
      const value = sem(light, `color.elevation.${SHADOWS[size]}.shadow`);
      if (!value) continue;
      theme.shadows[size] = shadowCss(value, ctx);
      row(
        `shadows.${size}`,
        `${S}elevation.${SHADOWS[size]}.shadow`,
        size === 'xl' ? 'approximated' : 'native',
        size === 'xl' ? 'four elevation shadows for five Mantine sizes: xl repeats lg' : undefined,
      );
    }

    theme.breakpoints = {};
    for (const size of SIZES) {
      const value = sem(light, `breakpoint.${size}`);
      if (value === undefined) continue;
      const em = toEm(String(value));
      theme.breakpoints[size] = em ?? String(value);
      row(`breakpoints.${size}`, `semantic.breakpoint.${size}`, 'native', em ? 'converted to em, the unit Mantine writes its media queries in' : undefined);
    }
    if (sem(light, 'breakpoint.2xl') !== undefined) {
      row('(breakpoint 2xl)', 'semantic.breakpoint.2xl', 'dropped', 'Mantine has five breakpoints, xs to xl');
    }

    for (const key of ['fontSizes', 'lineHeights', 'fontWeights', 'radius', 'spacing', 'shadows', 'breakpoints']) {
      if (!Object.keys(theme[key]).length) delete theme[key];
    }

    // ---------- component tier (data-only routes: defaultProps and styles) ----------
    const comp = (path) => light.get(`component.${path}`)?.value;
    const components = {};
    const controlHeights = {};
    for (const [mantineSize, rung] of [['xs', 'sm'], ['sm', 'md'], ['md', 'lg']]) {
      const value = sem(light, `size.control.${rung}`);
      if (value !== undefined) controlHeights[mantineSize] = String(value);
    }
    const buttonRoot = {};
    const buttonPadding = comp('button.padding-x');
    if (buttonPadding !== undefined) {
      buttonRoot['--button-padding-x-sm'] = String(buttonPadding);
      row('Button --button-padding-x-sm', 'component.button.padding-x', 'native', "Mantine's default button size is sm; the other sizes keep their own padding");
    }
    for (const [size, value] of Object.entries(controlHeights)) buttonRoot[`--button-height-${size}`] = value;
    const buttonRadius = comp('button.radius');
    if (buttonRadius !== undefined || Object.keys(buttonRoot).length) {
      components.Button = {
        ...(buttonRadius !== undefined ? { defaultProps: { radius: String(buttonRadius) } } : {}),
        ...(Object.keys(buttonRoot).length ? { styles: { root: buttonRoot } } : {}),
      };
      if (buttonRadius !== undefined) row('Button defaultProps.radius', 'component.button.radius', 'native');
    }
    const inputWrapper = {};
    for (const [size, value] of Object.entries(controlHeights)) inputWrapper[`--input-height-${size}`] = value;
    const controlRadius = comp('control.radius');
    if (controlRadius !== undefined || Object.keys(inputWrapper).length) {
      components.Input = {
        ...(controlRadius !== undefined ? { defaultProps: { radius: String(controlRadius) } } : {}),
        ...(Object.keys(inputWrapper).length ? { styles: { wrapper: inputWrapper } } : {}),
      };
      if (controlRadius !== undefined) row('Input defaultProps.radius', 'component.control.radius', 'native');
    }
    if (Object.keys(controlHeights).length) {
      row(
        'Button/Input --{button,input}-height-{xs,sm,md}',
        'semantic.size.control.{sm,md,lg}',
        'native',
        "default size to default size: the catalog's md control is Mantine's sm (its default), sm is xs and lg is md; Mantine's lg and xl keep their own heights",
      );
    }
    if (comp('control.padding-x') !== undefined) {
      row('(control padding)', 'component.control.{padding-x,padding-y}, component.button.padding-y', 'dropped', 'Mantine inputs and buttons are height-driven: input padding is a third of the height and there is no vertical padding variable');
    }
    const container = sem(light, 'radius.container');
    if (container !== undefined) {
      components.Card = { defaultProps: { radius: String(container) } };
      row('Card defaultProps.radius', 'semantic.radius.container', 'native');
    }
    const tooltipMax = comp('tooltip.max-width');
    if (tooltipMax !== undefined) {
      components.Tooltip = { styles: { tooltip: { maxWidth: String(tooltipMax) } } };
      row('Tooltip styles.tooltip.maxWidth', 'component.tooltip.max-width', 'approximated', 'a Mantine tooltip only wraps when it is multiline, so the measure applies to multiline tooltips');
    }
    if (Object.keys(components).length) theme.components = components;

    theme.colors = colors;

    // ---------- what Mantine has no slot for ----------
    row('(focus ring)', `${S}ring`, 'dropped', "Mantine draws every focus outline from --mantine-primary-color-filled (the primary solid), in its stylesheet; there is no ring variable to set");
    row('(z-index ladder)', 'semantic.z.*', 'dropped', "Mantine components take their z-index from getDefaultZIndex() in JS; the --mantine-z-index-* variables are not read by its stylesheet");
    row('(link hover / visited)', `${S}link.{hover,visited}`, 'dropped', 'Mantine has one anchor colour');
    row('(motion, scrim, text.inverse, opacity.disabled)', '—', 'dropped', 'no theme slot: transitions are per-component props and overlays take their colour as a prop');
    row('(border ladder: subtle, strong, field)', `${S}border.{subtle,strong,field}`, 'dropped', "Mantine has one border variable, --mantine-color-default-border; its inputs read gray-4 / dark-4, the tuple steps filled from border.base, so there is no separate field border to set");
    row('(inverse pair)', `${S}inverse.{surface,text}`, 'dropped', "Mantine's stylesheet paints the Tooltip from fixed tuple steps (gray-9 on white in light, gray-2 on black in dark); --tooltip-bg and --tooltip-color are per-instance (the color prop), not theme variables");
    coverage.push(...droppedDimensions(normalized.dimensionNames, ['color-scheme']));

    // AL3: measure what was emitted against Mantine's whole theming surface
    // (surface-inventory.json, extracted from @mantine/core's DEFAULT_THEME and
    // defaultCssVariablesResolver).
    coverage.push(
      ...surfaceRows({
        theme,
        colorNames: [...Object.keys(colors), ...virtuals.map((v) => v.name)],
        blocks: { variables: {}, light: lightVars, dark: darkVars ?? {} },
        hasDark: !!darkVars,
      }),
    );

    const ts = renderTheme(ctx, theme, virtuals, lightVars, darkVars);
    return {
      files: [
        { path: 'theme.transtyle.ts', contents: ts, kind: 'source' },
        { path: 'usage.md', contents: renderUsage(ctx, coverage, !!dark), kind: 'doc' },
      ],
      coverage,
    };
  },
};

// ---------- helpers ----------

function scale(map, prefix, keys, row, label) {
  const out = {};
  for (const k of keys) {
    const value = map.get(`semantic.${prefix}.${k}`)?.value;
    if (value === undefined) continue;
    out[k] = String(value);
    row(`${label}.${k}`, `semantic.${prefix}.${k}`, 'native');
  }
  return out;
}

const DIM = /^(-?\d*\.?\d+)(px|rem|em)$/;

function scaleDim(value, factor) {
  const m = DIM.exec(String(value));
  if (!m) return undefined;
  const n = Math.round(Number(m[1]) * factor * 10000) / 10000;
  return `${n}${m[2]}`;
}

/**
 * Breakpoints go into media queries, where `em` and `rem` both mean the
 * browser's initial font size (16px), never the page's root size. So this is
 * deliberately not `units.remBase`: a design system on a 10px root still gets
 * its 640px breakpoint at 40em.
 */
function toEm(value) {
  const m = DIM.exec(value);
  if (!m) return undefined;
  const n = m[2] === 'px' ? Number(m[1]) / 16 : Number(m[1]);
  return `${Math.round(n * 10000) / 10000}em`;
}

function shadowCss(value, ctx) {
  const layers = Array.isArray(value) ? value : [value];
  return layers
    .map((s) => `${s.inset ? 'inset ' : ''}${s.offsetX} ${s.offsetY} ${s.blur} ${s.spread} ${ctx.formatColor(s.color)}`)
    .join(', ');
}

// ---------- TS serialization ----------

const key = (k) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k));

function serialize(value, indent) {
  const pad = ' '.repeat(indent);
  const padIn = ' '.repeat(indent + 2);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => serialize(v, indent)).join(', ')}]`;
  const entries = Object.entries(value).filter(([, v]) => v !== undefined);
  if (!entries.length) return '{}';
  return `{\n${entries.map(([k, v]) => `${padIn}${key(k)}: ${serialize(v, indent + 2)}`).join(',\n')},\n${pad}}`;
}

function renderTheme(ctx, theme, virtuals, lightVars, darkVars) {
  const { colors, ...rest } = theme;
  const colorLines = [
    ...Object.entries(colors).map(([name, tuple]) => `    ${key(name)}: ${serialize(tuple, 4)},`),
    ...virtuals.map(
      (v) => `    ${key(v.name)}: virtualColor({ name: ${JSON.stringify(v.name)}, light: ${JSON.stringify(v.light)}, dark: ${JSON.stringify(v.dark)} }),`,
    ),
  ];
  const restLines = Object.entries(rest).map(([k, v]) => `  ${key(k)}: ${serialize(v, 2)},`);
  return `// GENERATED by transtyle — do not edit; source: ${ctx.projectName} token files
// Target: Mantine 9 (createTheme + cssVariablesResolver) · rules standard@1
// See usage.md in this directory for the wiring and the coverage report.
import { createTheme, virtualColor, type CSSVariablesResolver } from '@mantine/core';

export const theme = createTheme({
${restLines.join('\n')}
  colors: {
${colorLines.join('\n')}
  },
});

/**
 * Pass to <MantineProvider cssVariablesResolver={…}>: Mantine merges these over
 * the variables it computes from the tuples, per colour scheme.
 */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: ${serialize(lightVars, 2)},
  dark: ${darkVars ? serialize(darkVars, 2) : '{}'},
});
`;
}

function renderUsage(ctx, coverage, hasDark) {
  const counts = {};
  for (const c of coverage) counts[c.class] = (counts[c.class] ?? 0) + 1;
  const summary = Object.entries(counts)
    .map(([k, v]) => `${v} ${k}`)
    .join(' · ');
  return `# Using this Mantine theme

Generated from the **${ctx.projectName}** design system by transtyle: a Mantine 9 \`createTheme()\` object and a \`cssVariablesResolver\`, both in \`theme.transtyle.ts\`. Coverage: ${summary}.

## Setup

\`\`\`tsx
import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';
import { theme, cssVariablesResolver } from './theme.transtyle';

<MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="${hasDark ? 'auto' : 'light'}"${hasDark ? '' : ' forceColorScheme="light"'}>
  <App />
</MantineProvider>
\`\`\`

Every role is a named colour: \`<Button color="danger">\`, \`<Badge color="success" variant="light">\`, \`c="primary"\`. \`primary\` is also the theme's \`primaryColor\`.${hasDark ? '' : '\n\nThis design system publishes no dark scheme, so the provider is forced to light: a dark Mantine page would fall back to Mantine\'s own dark defaults instead of compiled output.'}

## Why there is no override stylesheet

Mantine writes its CSS variables at runtime, in a \`<style>\` it renders inside the React tree, after any stylesheet in \`<head>\`. A \`--mantine-*\` override file would lose that cascade for every variable Mantine writes itself. The \`cssVariablesResolver\` prop is merged over Mantine's own values instead, so the compiled colours always win.

## How the colours map

- Each role is a \`virtualColor()\` over two 10-step tuples, \`<role>-light\` and \`<role>-dark\`. Index *i* is the same grid cell in both schemes: 0–2 tint (rest, hover, active), 3–4 outline, 5–7 solid, 8 text, 9 text-strong. \`primaryShade\` is 5, the solid.
- Components read the per-colour variant variables (\`--mantine-color-<role>-filled\`, \`-light\`, \`-outline\`, …), which the resolver sets per scheme straight from the grid, so every variant shows the compiled colour.
- \`autoContrast\` is on, so filled components take their text from \`--mantine-color-<role>-contrast\`, the role's \`on-solid\`.
- \`gray\` and \`dark\` are Mantine's neutral tuples, filled from the light and dark neutral ladders.

## Regenerating

Never edit this file — change the design system tokens and run \`transtyle build mantine\`. See \`report.json\` for the full coverage/provenance breakdown.
`;
}
