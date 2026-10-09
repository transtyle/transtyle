/**
 * @transtyle/exporter-mui — emits a Material UI v9 theme from the resolved IR:
 * a `ThemeOptions` object in CSS-variables mode, and the `createTheme()` call
 * to pass to `<ThemeProvider>`. Spec: docs/specs/exporters/mui.md.
 *
 * Four rules shape it (mapping tables in the spec):
 *   - CSS-variables mode, always. MUI's per-component palette tokens
 *     (`palette.Alert.*`, `palette.TableCell.*`) and its per-scheme
 *     `overlays` only exist under `colorSchemes` with `cssVariables` on, and
 *     a scheme switch then swaps variables instead of rebuilding the theme.
 *     Schemes are emitted by mode name (`[data-color-scheme="dark"]`), never
 *     from the config's default flag (the css-variables polarity rule).
 *   - Colours as hex. `createTheme` throws on `oklch()`: it derives a
 *     `*Channel` variable from every palette colour and parses only hex,
 *     `rgb()`, `hsl()` and `color()`. Translucent values keep their alpha as
 *     `#rrggbbaa`, and a gamut clamp is reported like Radix and ECharts do.
 *   - One palette key per role. MUI's own six keep their names (`danger` is
 *     `error`); `accent`, `neutral` and archetype roles are extra keys, which
 *     MUI turns into variables at runtime and the module declares for
 *     TypeScript. The grid cells MUI has no shade for live under
 *     `palette.<key>.transtyle`, and Button's theme variants read them, so an
 *     outlined or text button wears the grid's outline and text cells.
 *   - The component tier writes a style override only when the design system
 *     authored something in its chain, as in the Chakra exporter: MUI's
 *     components already take `shape.borderRadius` and their own per-variant
 *     paddings, and a defaulted tier would only replace them.
 *
 * Everything emitted is data: no function, no `theme =>` callback, so the
 * options merge under any other `createTheme(options, yours)` argument.
 */

import { COLOR_ROLES, GRID_CELLS, droppedDimensions } from '@transtyle/ir';

const S = 'semantic.color.';
const GAMUT_NOTE = 'sRGB gamut clamp during oklch → hex (MUI parses only sRGB colour syntaxes)';

/** Catalog role → MUI palette key. Every other role keeps its name. */
const RENAMED = { danger: 'error' };
/** Palette keys MUI ships; any other role is an extra key the module declares. */
const MUI_KEYS = ['primary', 'secondary', 'error', 'warning', 'info', 'success'];

/**
 * MUI `PaletteColor` key → grid cell. `dark` and `light` are false friends:
 * shades of `main`, not colour schemes.
 */
const PALETTE_COLOR = [
  { key: 'main', cell: 'solid', cls: 'native' },
  {
    key: 'dark',
    cell: 'solid-hover',
    cls: 'native',
    note: "false friend: MUI's dark is a shade, not the dark scheme; a contained button paints it on hover, which is the grid's solid-hover",
  },
  {
    key: 'light',
    cell: 'outline',
    cls: 'approximated',
    note: "false friend: MUI's light is a shade, not the light scheme; in 9.x only the outlined Alert reads it, as its border, which is the grid's outline wash",
  },
  { key: 'contrastText', cell: 'on-solid', cls: 'native' },
];

/** Grid cells emitted under `palette.<key>.transtyle`, each one a CSS variable Button's theme variants read. */
const EXTRA_CELLS = ['text', 'tint', 'outline', 'outline-hover'];
const USED_CELLS = new Set([...PALETTE_COLOR.map((p) => p.cell), ...EXTRA_CELLS]);
const UNMAPPED_CELLS = GRID_CELLS.filter((c) => !USED_CELLS.has(c));

/** MUI Alert severity → catalog role. */
const STATUSES = [
  ['error', 'danger'],
  ['warning', 'warning'],
  ['info', 'info'],
  ['success', 'success'],
];
/** `palette.Alert.<severity><Suffix>` → grid cell. */
const ALERT_KEYS = [
  ['Color', 'on-tint', 'the standard and outlined Alert text, on the tint'],
  ['StandardBg', 'tint'],
  ['IconColor', 'solid'],
  ['FilledBg', 'solid'],
  ['FilledColor', 'on-solid'],
];

/**
 * MUI elevation index (Paper `elevation`, 0–24) → catalog elevation level, by
 * the steps MUI's own components use: Card 1, AppBar 4, Snackbar 6,
 * Menu and Popover 8, Drawer 16, Dialog 24. The catalog puts every floating
 * layer (popover, menu, dialog) on level 3.
 */
const surfaceLevel = (n) => (n <= 1 ? 1 : n <= 4 ? 2 : 3);
/** The same index → shadow level: the four catalog shadows spread over 1–24. */
const shadowLevel = (n) => (n <= 1 ? 1 : n <= 4 ? 2 : n <= 12 ? 3 : 4);

/** MUI typography variant → catalog type role, by rank (MUI's ladder is its own). */
const TYPE_VARIANTS = [
  ['h1', 'display.lg'],
  ['h2', 'display.md'],
  ['h3', 'display.sm'],
  ['h4', 'heading.lg'],
  ['h5', 'heading.md'],
  ['h6', 'heading.sm'],
  ['subtitle1', 'title.sm'],
  ['subtitle2', 'label.lg'],
  ['body1', 'body.md'],
  ['body2', 'body.sm'],
  ['button', 'label.md'],
  ['caption', 'body.sm'],
  ['overline', 'label.sm'],
];
const FONT_WEIGHTS = [
  ['fontWeightRegular', 'regular'],
  ['fontWeightMedium', 'medium'],
  ['fontWeightBold', 'bold'],
];
/** MUI duration name → catalog rung: seven names over the catalog's five rungs. */
const DURATIONS = [
  ['shortest', 'fast'],
  ['shorter', 'fast'],
  ['short', 'normal'],
  ['standard', 'normal'],
  ['complex', 'slow'],
  ['enteringScreen', 'normal'],
  ['leavingScreen', 'fast'],
];
const EASINGS = [
  ['easeInOut', 'standard', 'native'],
  ['easeOut', 'enter', 'native'],
  ['easeIn', 'exit', 'native'],
  ['sharp', 'emphasized', 'approximated', "false friend: MUI's sharp is the curve of elements that may return at any time; the catalog's emphasized is the nearest named curve"],
];
const Z = [
  ['appBar', 'sticky'],
  ['drawer', 'overlay'],
  ['modal', 'modal'],
  ['snackbar', 'toast'],
  ['tooltip', 'tooltip'],
];
const BREAKPOINTS = ['sm', 'md', 'lg', 'xl'];

export default {
  name: 'mui',

  emit(normalized, ctx) {
    const light = normalized.modes.light ?? normalized.modes[normalized.defaultMode];
    const dark = normalized.modes.dark;
    const schemes = dark ? [['light', light], ['dark', dark]] : [['light', light]];
    const coverage = [];
    const row = (variable, slot, cls, note) =>
      coverage.push({ variable, slot, class: cls, ...(note ? { note } : {}) });
    const sem = (map, path) => map?.get(`semantic.${path}`)?.value;

    const clamped = new Set(); // slots whose hex was clamped into sRGB in any scheme
    const hex = (map, path) => {
      const value = sem(map, `color.${path}`);
      if (!value) return undefined;
      const out = toHex(value, ctx);
      if (out.clamped) clamped.add(`${S}${path}`);
      return out.text;
    };

    // One palette object per scheme; every colour below is written into each.
    const palettes = Object.fromEntries(schemes.map(([name]) => [name, {}]));
    /** Write `path` (a dotted path inside the palette) from a colour slot in every scheme; true when written. */
    const paint = (path, slot) => {
      let wrote = false;
      for (const [name, map] of schemes) {
        const v = hex(map, slot);
        if (v === undefined) continue;
        set(palettes[name], path, v);
        wrote = true;
      }
      return wrote;
    };
    const muiVar = (path) => `var(--mui-palette-${path.replaceAll('.', '-')})`;

    // ---------- roles: one palette key each ----------
    const roles = [...COLOR_ROLES, ...normalized.roleArchetypes.keys()].filter((r) => sem(light, `color.${r}.solid`));
    const extraKeys = [];
    const buttonVariants = [];
    for (const role of roles) {
      const key = RENAMED[role] ?? role;
      if (!MUI_KEYS.includes(key)) extraKeys.push(key);
      for (const p of PALETTE_COLOR) {
        if (paint(`${key}.${p.key}`, `${role}.${p.cell}`)) row(`palette.${key}.${p.key}`, `${S}${role}.${p.cell}`, p.cls, p.note);
      }
      const cells = EXTRA_CELLS.filter((cell) => paint(`${key}.transtyle.${cell}`, `${role}.${cell}`));
      const v = (cell) => (cells.includes(cell) ? muiVar(`${key}.transtyle.${cell}`) : undefined);

      // Button's built-in rule per colour reads `main` for text and outlined
      // buttons and alpha(main) for the outlined border and the hover washes.
      // A theme variant with the same `color` comes later and wins, pointing
      // those variables at the grid's own cells.
      const style = {
        '--variant-textColor': v('text'),
        '--variant-outlinedColor': v('text'),
        '--variant-outlinedBorder': v('outline'),
      };
      const hover = {
        '--variant-textBg': v('tint'),
        '--variant-outlinedBg': v('tint'),
        '--variant-outlinedBorder': v('outline-hover'),
      };
      const defined = (o) => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined));
      if (Object.keys(defined(style)).length || Object.keys(defined(hover)).length) {
        buttonVariants.push({
          props: { color: key },
          style: { ...defined(style), ...(Object.keys(defined(hover)).length ? { '@media (hover: hover)': { '&:hover': defined(hover) } } : {}) },
        });
      }
      if (v('text')) row(`palette.${key}.transtyle.text (Button text and outlined colour)`, `${S}${role}.text`, 'native', "MUI paints text and outlined buttons with main; the grid's text cell is the AA-safe one");
      if (v('outline')) row(`palette.${key}.transtyle.outline (outlined Button border)`, `${S}${role}.outline`, 'native', "replaces MUI's alpha(main, 0.5)");
      if (v('outline-hover')) row(`palette.${key}.transtyle.outline-hover (outlined Button hover border)`, `${S}${role}.outline-hover`, 'native');
      if (v('tint')) {
        row(`palette.${key}.transtyle.tint (text and outlined Button hover)`, `${S}${role}.tint`, 'approximated', "MUI washes text and outlined buttons with alpha(main, hoverOpacity) on hover; the grid's tint is the nearest wash");
      }
      const unmapped = UNMAPPED_CELLS.filter((cell) => sem(light, `color.${role}.${cell}`) && !(cell === 'on-tint' && STATUSES.some(([, r]) => r === role)));
      if (unmapped.length) {
        row(
          `palette.${key} (state cells)`,
          `${S}${role}.{${unmapped.join(',')}}`,
          'dropped',
          'MUI has no slot for them: a pressed button shows a ripple, selection reads action.selected, and there is no strong text rung',
        );
      }
    }

    // ---------- Alert: the four severities read their roles ----------
    for (const [severity, role] of STATUSES) {
      for (const [suffix, cell, note] of ALERT_KEYS) {
        if (paint(`Alert.${severity}${suffix}`, `${role}.${cell}`)) row(`palette.Alert.${severity}${suffix}`, `${S}${role}.${cell}`, 'native', note);
      }
    }

    // ---------- page colours ----------
    for (const [path, slot, cls, note] of [
      ['background.default', 'elevation.0.surface', 'native'],
      ['background.paper', 'elevation.1.surface', 'native', 'every Paper (Card, Menu, Dialog, Alert) starts from it; the overlays below lift it per elevation'],
      ['text.primary', 'text.base', 'native'],
      ['text.secondary', 'text.muted', 'native'],
      ['text.disabled', 'text.disabled', 'native'],
      ['action.disabled', 'text.disabled', 'native', 'the text of a disabled button'],
      ['divider', 'border', 'native'],
      ['TableCell.border', 'border', 'native', "replaces MUI's lightened divider"],
      ['action.hover', 'neutral.tint-hover', 'approximated', "MUI's is a 4% black or white veil over any surface; the neutral hover wash is opaque"],
      ['action.selected', 'neutral.tint-selected', 'approximated', "MUI's is an 8% veil; the neutral selected wash is opaque"],
      ['ring', 'ring', 'native', 'an extra palette key: the focus ring below reads it'],
      ['transtyle.scrim', 'scrim', 'native', 'an extra palette key: the Dialog backdrop reads it'],
    ]) {
      if (paint(path, slot)) row(`palette.${path}`, `${S}${slot}`, cls, note);
    }
    const hasRing = !!sem(light, 'color.ring');
    const hasScrim = !!sem(light, 'color.scrim');
    if (!dark) {
      row('(dark scheme)', '—', 'dropped', 'the design system publishes no dark scheme: colorSchemes carries light only');
    }

    // ---------- elevation: overlays per scheme, shadows through palette variables ----------
    const overlays = {};
    for (const [name, map] of schemes) {
      const surfaces = [1, 2, 3].map((n) => hex(map, `elevation.${n}.surface`));
      if (surfaces.every((s) => s !== undefined)) {
        overlays[name] = Array.from({ length: 25 }, (_, n) => {
          const s = surfaces[surfaceLevel(n) - 1];
          return `linear-gradient(${s}, ${s})`;
        });
      }
    }
    if (overlays.light) {
      row('overlays[0–1]', `${S}elevation.1.surface`, 'native', 'Paper paints var(--Paper-overlay) over background.paper; a flat gradient of the surface gives the exact level in both schemes');
      row('overlays[2–4]', `${S}elevation.2.surface`, 'approximated', 'by rank: MUI raises AppBar to 4');
      row('overlays[5–24]', `${S}elevation.3.surface`, 'approximated', 'by rank: Snackbar 6, Menu and Popover 8, Drawer 16 and Dialog 24 are all floating layers, which the catalog puts on level 3');
    }
    row('(elevation surfaces 4–5)', `${S}elevation.{4,5}.surface`, 'dropped', "MUI's floating components all sit on level 3; nothing reads a deeper surface");

    const shadowLevels = [1, 2, 3, 4].filter((n) => sem(light, `color.elevation.${n}.shadow`));
    let shadows;
    if (shadowLevels.length === 4) {
      for (const [name, map] of schemes) {
        for (const n of shadowLevels) {
          set(palettes[name], `transtyle.shadow-${n}`, shadowCss(sem(map, `color.elevation.${n}.shadow`), ctx));
        }
      }
      shadows = ['none', ...Array.from({ length: 24 }, (_, i) => muiVar(`transtyle.shadow-${shadowLevel(i + 1)}`))];
      for (const n of shadowLevels) {
        const range = { 1: '1', 2: '2–4', 3: '5–12', 4: '13–24' }[n];
        row(`shadows[${range}]`, `${S}elevation.${n}.shadow`, 'approximated', `by rank: four elevation shadows over MUI's 24; the value is a palette variable (palette.transtyle.shadow-${n}), so it follows the scheme`);
      }
    }

    // ---------- typography ----------
    const typography = {};
    const sans = sem(light, 'font.sans');
    if (sans) {
      typography.fontFamily = fontStack(sans);
      row('typography.fontFamily', 'semantic.font.sans', 'native');
    }
    for (const [mui, rung] of FONT_WEIGHTS) {
      const v = sem(light, `type.weight.${rung}`);
      if (v === undefined) continue;
      typography[mui] = Number(v);
      row(`typography.${mui}`, `semantic.type.weight.${rung}`, 'native');
    }
    for (const [variant, role] of TYPE_VARIANTS) {
      const t = sem(light, `type.role.${role}`);
      if (!t || typeof t !== 'object') continue;
      typography[variant] = {
        ...(t.fontFamily !== undefined ? { fontFamily: fontStack(t.fontFamily) } : {}),
        ...(t.fontSize !== undefined ? { fontSize: String(t.fontSize) } : {}),
        ...(t.fontWeight !== undefined ? { fontWeight: Number(t.fontWeight) } : {}),
        ...(t.lineHeight !== undefined ? { lineHeight: typeof t.lineHeight === 'number' ? t.lineHeight : String(t.lineHeight) } : {}),
        ...(t.letterSpacing !== undefined ? { letterSpacing: String(t.letterSpacing) } : {}),
      };
      row(
        `typography.${variant}`,
        `semantic.type.role.${role}`,
        variant === 'body1' ? 'native' : 'approximated',
        variant === 'body1' ? undefined : "by rank: MUI's thirteen variants over the catalog's type roles (spec table)",
      );
    }
    if (sem(light, 'font.mono')) row('(monospace face)', 'semantic.font.mono', 'dropped', 'MUI has no monospace font slot');

    // ---------- scales ----------
    const shape = {};
    const controlRadius = sem(light, 'radius.control');
    if (controlRadius !== undefined) {
      shape.borderRadius = String(controlRadius);
      row('shape.borderRadius', 'semantic.radius.control', 'native', 'MUI rounds buttons, inputs, chips and every Paper with it; Paper takes radius.container below');
    }

    let spacing;
    const unit = sem(light, 'space.2');
    if (unit !== undefined) {
      spacing = String(unit);
      const linear = [1, 3, 4, 8].every((k) => {
        const a = ctx.units?.toPx(String(sem(light, `space.${k}`) ?? ''));
        const b = ctx.units?.toPx(String(unit));
        return a === undefined || b === undefined || Math.abs(a - (b * k) / 2) < 0.01;
      });
      row(
        'spacing (theme.spacing(1))',
        'semantic.space.2',
        linear ? 'native' : 'approximated',
        linear ? 'theme.spacing(n) is n × space.2, which is space.(2n) on a linear scale' : 'the scale is not linear: theme.spacing(n) is n × space.2, so only the steps that are multiples of it match',
      );
    }

    let breakpoints;
    const bpValues = BREAKPOINTS.map((k) => toPx(sem(light, `breakpoint.${k}`), ctx));
    if (bpValues.every((v) => v !== undefined)) {
      breakpoints = { values: { xs: 0, ...Object.fromEntries(BREAKPOINTS.map((k, i) => [k, bpValues[i]])) } };
      row('breakpoints.values.{sm,md,lg,xl}', 'semantic.breakpoint.{sm,md,lg,xl}', 'native', 'in px, as MUI reads them');
      if (sem(light, 'breakpoint.xs') !== undefined) {
        row('(breakpoint xs)', 'semantic.breakpoint.xs', 'dropped', "false friend: MUI's xs is the mobile-first base and stays 0");
      }
      if (sem(light, 'breakpoint.2xl') !== undefined) {
        row('(breakpoint 2xl)', 'semantic.breakpoint.2xl', 'dropped', "MUI's ladder ends at xl; a sixth key needs BreakpointOverrides in app code");
      }
    }

    const transitions = {};
    for (const [mui, rung] of DURATIONS) {
      const ms = toMs(sem(light, `duration.${rung}`));
      if (ms === undefined) continue;
      (transitions.duration ??= {})[mui] = ms;
      row(`transitions.duration.${mui}`, `semantic.duration.${rung}`, 'approximated', "by rank: MUI's seven names over the catalog's rungs, in milliseconds");
    }
    for (const [mui, rung, cls, note] of EASINGS) {
      const v = sem(light, `easing.${rung}`);
      if (v === undefined) continue;
      (transitions.easing ??= {})[mui] = String(v);
      row(`transitions.easing.${mui}`, `semantic.easing.${rung}`, cls, note);
    }

    const zIndex = {};
    for (const [mui, rung] of Z) {
      const v = sem(light, `z.${rung}`);
      if (v === undefined) continue;
      zIndex[mui] = Number(v);
      row(`zIndex.${mui}`, `semantic.z.${rung}`, 'native');
    }

    // ---------- components ----------
    const components = {};
    const override = (path, value) => set(components, path, value);
    if (buttonVariants.length) components.MuiButton = { variants: buttonVariants };

    if (hasRing) row('focusVisible.outlineColor', `${S}ring`, 'native', "turns on MUI's opt-in keyboard focus ring for every focusable component, in the design system's ring colour");

    const containerRadius = sem(light, 'radius.container');
    if (containerRadius !== undefined) {
      override('MuiPaper.styleOverrides.rounded.borderRadius', String(containerRadius));
      row('components.MuiPaper.styleOverrides.rounded.borderRadius', 'semantic.radius.container', 'native', 'Card, Menu, Popover, Dialog and Alert are all Paper');
    }
    if (hasScrim) {
      override('MuiDialog.styleOverrides.backdrop.backgroundColor', muiVar('transtyle.scrim'));
      row('components.MuiDialog.styleOverrides.backdrop.backgroundColor', `${S}scrim`, 'native', "replaces MUI's rgba(0, 0, 0, 0.5); Menu and Popover backdrops stay invisible");
    }
    const disabled = sem(light, 'opacity.disabled');
    if (disabled !== undefined) {
      for (const [name] of schemes) set(palettes[name], 'action.disabledOpacity', Number(disabled));
      row('palette.action.disabledOpacity', 'semantic.opacity.disabled', 'native');
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
    const val = (path) => String(comp(path).value);
    let tierEmitted = false;
    if (authored('button.radius')) {
      override('MuiButton.styleOverrides.root.borderRadius', val('button.radius'));
      row('components.MuiButton.styleOverrides.root.borderRadius', 'component.button.radius', 'native');
      tierEmitted = true;
    }
    if ((authored('button.padding-x') || authored('button.padding-y')) && comp('button.padding-x') && comp('button.padding-y')) {
      const [px, py] = [val('button.padding-x'), val('button.padding-y')];
      components.MuiButton ??= {};
      (components.MuiButton.variants ??= []).push(
        { props: { variant: 'contained', size: 'medium' }, style: { padding: `${py} ${px}` } },
        { props: { variant: 'outlined', size: 'medium' }, style: { padding: `calc(${py} - 1px) calc(${px} - 1px)` } },
      );
      row(
        'components.MuiButton contained and outlined medium padding',
        'component.button.{padding-x,padding-y}',
        'approximated',
        "MUI pads each variant and size: the medium contained and outlined buttons take the tier (outlined minus its 1px border); text buttons and the small and large sizes keep MUI's",
      );
      tierEmitted = true;
    }
    if (authored('control.radius')) {
      override('MuiOutlinedInput.styleOverrides.root.borderRadius', val('control.radius'));
      row('components.MuiOutlinedInput.styleOverrides.root.borderRadius', 'component.control.radius', 'native');
      tierEmitted = true;
    }
    if ((authored('control.padding-x') || authored('control.padding-y')) && comp('control.padding-x') && comp('control.padding-y')) {
      const [px, py] = [val('control.padding-x'), val('control.padding-y')];
      override('MuiOutlinedInput.styleOverrides.input.padding', `${py} ${px}`);
      // The outlined label is placed with hard-coded transforms that assume
      // MUI's own 16.5px × 14px padding; move it with the padding.
      set(components, 'MuiInputLabel.variants', [
        { props: { variant: 'outlined' }, style: { transform: `translate(${px}, calc(${py} - 0.5px)) scale(1)` } },
        { props: { variant: 'outlined', shrink: true }, style: { transform: `translate(${px}, -9px) scale(0.75)` } },
      ]);
      row(
        'components.MuiOutlinedInput.styleOverrides.input.padding (+ MuiInputLabel outlined transforms)',
        'component.control.{padding-x,padding-y}',
        'approximated',
        "one padding for every size (MUI's small input takes it too); the outlined label's resting and shrunk positions follow it",
      );
      tierEmitted = true;
    }
    if (!tierEmitted) {
      row('(component tier)', 'component.{button,control}.*', 'native', "nothing authored: MUI's components already take shape.borderRadius (radius.control) and keep their own per-variant paddings");
    }
    const tooltipMax = comp('tooltip.max-width');
    if (tooltipMax) {
      override('MuiTooltip.styleOverrides.tooltip.maxWidth', String(tooltipMax.value));
      row('components.MuiTooltip.styleOverrides.tooltip.maxWidth', 'component.tooltip.max-width', 'native', "MUI's own ceiling is 300px");
    }
    if (CONTROL_SIZES.some((s) => sem(light, `size.control.${s}`) !== undefined)) {
      row('(control heights)', 'semantic.size.control.{sm,md,lg}', 'dropped', "MUI's buttons and inputs are padding-driven: no size sets a height");
    }

    // ---------- what MUI has no slot for ----------
    row('(link colours)', `${S}link.{base,hover,visited}`, 'dropped', "MUI's Link reads palette[color].main: links follow the colour they are given (color=\"primary\" by default)");
    row('(text rungs)', `${S}text.{strong,subtle,inverse}`, 'dropped', 'MUI has three text rungs: primary, secondary and disabled');
    row('(categorical palette)', 'semantic.palette.categorical.*', 'dropped', "no chart slot in MUI's theme");
    row('(border widths)', 'semantic.border-width.*', 'dropped', "MUI's components write 1px borders literally");
    coverage.push({
      variable: 'colorSchemes.*.opacity.{inputPlaceholder,inputUnderline,switchTrackDisabled,switchTrack}',
      slot: '—',
      class: 'unsupported',
      note: "per-component opacities with no catalog slot (a placeholder's alpha, a switch track's): semantic.opacity.disabled is the only one the catalog has; MUI's defaults stay",
      meaning: 'opacity.component',
    });
    // A clamp in any scheme makes that variable's row approximated, on the row
    // itself (#171), never on an aggregate one.
    for (const r of coverage) {
      if (clamped.has(r.slot) && r.class !== 'dropped') {
        r.class = 'approximated';
        r.note = r.note ? `${r.note}; ${GAMUT_NOTE}` : GAMUT_NOTE;
      }
    }
    coverage.push(...droppedDimensions(normalized.dimensionNames, ['color-scheme']));

    // ---------- assemble ----------
    const colorSchemes = {};
    for (const [name] of schemes) {
      colorSchemes[name] = { palette: palettes[name], ...(overlays[name] ? { overlays: overlays[name] } : {}) };
    }
    const options = {
      cssVariables: { colorSchemeSelector: '[data-color-scheme="%s"]' },
      colorSchemes,
      ...(hasRing ? { focusVisible: { outlineColor: muiVar('ring') } } : {}),
      ...(Object.keys(shape).length ? { shape } : {}),
      ...(spacing !== undefined ? { spacing } : {}),
      ...(breakpoints ? { breakpoints } : {}),
      ...(Object.keys(typography).length ? { typography } : {}),
      ...(shadows ? { shadows } : {}),
      ...(Object.keys(transitions).length ? { transitions } : {}),
      ...(Object.keys(zIndex).length ? { zIndex } : {}),
      ...(Object.keys(components).length ? { components } : {}),
    };

    return {
      files: [
        { path: 'theme.transtyle.ts', contents: renderTheme(ctx, options, extraKeys, { hasRing, extras: hasScrim || !!shadows }), kind: 'source' },
        { path: 'usage.md', contents: renderUsage(ctx, coverage, !!dark, extraKeys), kind: 'doc' },
      ],
      coverage,
    };
  },
};

const CONTROL_SIZES = ['sm', 'md', 'lg'];

// ---------- helpers ----------

/** Set `value` at a dotted path, creating the objects on the way. */
function set(root, path, value) {
  let node = root;
  const keys = path.split('.');
  for (const k of keys.slice(0, -1)) node = node[k] ??= {};
  node[keys.at(-1)] = value;
}

/** `#rrggbb`, or `#rrggbbaa` when the colour is translucent (MUI parses both). */
function toHex(value, ctx) {
  const { text, clamped } = ctx.formatHex(value);
  const alpha = value.alpha ?? 1;
  if (alpha >= 1) return { text, clamped };
  return { text: `${text}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`, clamped };
}

const fontStack = (value) =>
  Array.isArray(value) ? value.map((f) => (/[^a-z-]/.test(f) ? `"${f}"` : f)).join(', ') : String(value);

function shadowCss(value, ctx) {
  const layers = Array.isArray(value) ? value : [value];
  return layers
    .map((s) => `${s.inset ? 'inset ' : ''}${s.offsetX} ${s.offsetY} ${s.blur} ${s.spread} ${toHex(s.color, ctx).text}`)
    .join(', ');
}

function toPx(value, ctx) {
  if (value === undefined) return undefined;
  const s = String(value);
  // A ctx without `units` (a hand-built test context) keeps the 16px base.
  const px = ctx.units ? ctx.units.toPx(s) : /^([\d.]+)(px|rem)$/.test(s) ? parseFloat(s) * (s.endsWith('rem') ? 16 : 1) : undefined;
  return px === undefined || Number.isNaN(px) ? undefined : Math.round(px);
}

function toMs(value) {
  if (value === undefined) return undefined;
  const m = /^(-?[\d.]+)(ms|s)$/.exec(String(value).trim());
  if (!m) return undefined;
  return Math.round(parseFloat(m[1]) * (m[2] === 's' ? 1000 : 1));
}

// ---------- TS serialization ----------

const key = (k) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k));

function serialize(value, indent) {
  const pad = ' '.repeat(indent);
  const padIn = ' '.repeat(indent + 2);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v !== 'object')) {
      // 25 overlays or shadows: one per line, so a reader can count them.
      return `[\n${value.map((v) => `${padIn}${JSON.stringify(v)}`).join(',\n')},\n${pad}]`;
    }
    return `[\n${value.map((v) => `${padIn}${serialize(v, indent + 2)}`).join(',\n')},\n${pad}]`;
  }
  const entries = Object.entries(value).filter(([, v]) => v !== undefined);
  if (!entries.length) return '{}';
  return `{\n${entries.map(([k, v]) => `${padIn}${key(k)}: ${serialize(v, indent + 2)}`).join(',\n')},\n${pad}}`;
}

function renderTheme(ctx, options, extraKeys, { hasRing, extras }) {
  const colorKeys = extraKeys.map((k) => `    ${key(k)}: Palette['primary'];`).join('\n');
  const colorOptionKeys = extraKeys.map((k) => `    ${key(k)}?: PaletteOptions['primary'];`).join('\n');
  const overrides = extraKeys.map((k) => `    ${key(k)}: true;`).join('\n');
  const paletteExtras = [hasRing ? '    ring: string;' : '', extras ? '    transtyle: Record<string, string>;' : ''].filter(Boolean).join('\n');
  const paletteOptionExtras = [hasRing ? '    ring?: string;' : '', extras ? '    transtyle?: Record<string, string>;' : ''].filter(Boolean).join('\n');
  const colorOverrides = extraKeys.length
    ? `
declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
${overrides}
  }
}

declare module '@mui/material/Chip' {
  interface ChipPropsColorOverrides {
${overrides}
  }
}
`
    : '';
  return `// GENERATED by transtyle — do not edit; source: ${ctx.projectName} token files
// Target: Material UI v9 (createTheme, CSS-variables mode) · rules standard@1
// See usage.md in this directory for the wiring and the coverage report.
import { createTheme } from '@mui/material/styles';
import type { ThemeOptions } from '@mui/material/styles';

// The palette keys this theme adds (roles MUI has no name for, the focus ring,
// and the grid cells under \`transtyle\`), declared for TypeScript.
declare module '@mui/material/styles' {
  interface Palette {
${[colorKeys, paletteExtras].filter(Boolean).join('\n')}
  }
  interface PaletteOptions {
${[colorOptionKeys, paletteOptionExtras].filter(Boolean).join('\n')}
  }
  interface PaletteColor {
    transtyle?: Record<string, string>;
  }
  interface SimplePaletteColorOptions {
    transtyle?: Record<string, string>;
  }
}
${colorOverrides}
/** Plain data: pass it to createTheme() with your own options after it to extend them. */
export const themeOptions = ${serialize(options, 0)} satisfies ThemeOptions;

/** Pass to <ThemeProvider theme={theme}>. */
export const theme = createTheme(themeOptions);
`;
}

function renderUsage(ctx, coverage, hasDark, extraKeys) {
  const counts = {};
  for (const c of coverage) counts[c.class] = (counts[c.class] ?? 0) + 1;
  const summary = Object.entries(counts)
    .map(([k, v]) => `${v} ${k}`)
    .join(' · ');
  const names = extraKeys.map((k) => `\`${k}\``);
  const extra = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : (names[0] ?? '');
  return `# Using this Material UI theme

Generated from the **${ctx.projectName}** design system by transtyle: a Material UI v9 \`ThemeOptions\` object in CSS-variables mode (\`themeOptions\`) and the \`createTheme()\` call (\`theme\`), both in \`theme.transtyle.ts\`. Coverage: ${summary}.

## Setup

\`\`\`tsx
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from './theme.transtyle';

<ThemeProvider theme={theme}>
  <CssBaseline />
  <App />
</ThemeProvider>
\`\`\`

To add your own options, merge them in the same call: \`createTheme(themeOptions, yourOptions)\` with the exported \`themeOptions\`. Keep MUI's default variable prefix (\`--mui-\`): the Button variants, the shadows, the focus ring and the dialog backdrop read the palette through it.

Every role is a palette key: \`<Button color="primary">\`, \`<Chip color="success">\`, and \`danger\` is MUI's \`error\` (\`<Alert severity="error">\`).${extra ? ` ${extra} ${extraKeys.length === 1 ? 'is an extra key' : 'are extra keys'}, declared for TypeScript in the module itself: \`<Button color="${extraKeys[0]}">\` type-checks as is.` : ''}

${hasDark ? 'Both colour schemes are CSS variables under `[data-color-scheme="light"]` and `[data-color-scheme="dark"]`. Switch with MUI\'s own `useColorScheme()` (`setMode(\'dark\')`), or start in dark with `<ThemeProvider theme={theme} defaultMode="dark">`.' : 'This design system publishes no dark scheme, so the theme carries `colorSchemes.light` only.'}

## How the colours map

- Each role is a palette key: \`main\` (solid), \`dark\` (solid-hover), \`light\` (outline) and \`contrastText\` (on-solid). \`dark\` and \`light\` are false friends: shades of \`main\`, not colour schemes.
- The grid's \`text\`, \`tint\`, \`outline\` and \`outline-hover\` cells are under \`palette.<role>.transtyle\`, and Button's theme variants read them: text and outlined buttons wear the role's text colour and outline instead of \`main\` and \`alpha(main, 0.5)\`.
- The four Alert severities read their roles' tint, on-tint, solid and on-solid.
- \`background.default\` and \`background.paper\` are elevation levels 0 and 1; \`overlays\` lift each Paper elevation onto levels 1 to 3, so a dark Card or Dialog shows the design system's surface, not MUI's white veil.
- The design system's focus ring turns on MUI's \`focusVisible\` ring for every focusable component.

## Regenerating

Never edit this file — change the design system tokens and run \`transtyle build mui\`. See \`report.json\` for the full coverage/provenance breakdown.
`;
}
