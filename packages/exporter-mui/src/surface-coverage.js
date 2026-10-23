/**
 * AL3 for Material UI: classify every entry of MUI's theming surface
 * (surface-inventory.json, extracted from `createTheme()` by
 * tools/extract-surface.mjs) against the ThemeOptions this exporter emits.
 * The exporter turns it into report.json rows; scripts/check-coverage-bar.mjs
 * reconciles those rows against the inventory, so the two read the same
 * classification.
 *
 * MUI's surface is a graph like Mantine's: `createTheme()` computes most of
 * its CSS variables from a few theme leaves (`--mui-palette-primary-mainChannel`
 * from `primary.main`, `--mui-font-h1` from `typography.h1`), and its
 * per-component palette tokens either point at another palette variable
 * (`--mui-palette-AppBar-defaultBg` is `var(--mui-palette-grey-100)`) or are
 * written out from one (`--mui-palette-Slider-primaryTrack`, lightened from
 * `primary.main`). So an entry is one of three things (the walk is
 * @transtyle/ir's, shared with Mantine and Chakra):
 *
 *   set     — the emitted options write it: its `path` is a leaf of them.
 *   follows — not written, but everything it is computed from is set or
 *             follows, so MUI derives it from this theme.
 *   default — something it is computed from stays MUI's, so it keeps MUI's
 *             value. Every one is reported on its own row with the reason
 *             (REASONS below).
 */

// A JSON module, not a file read: exporters never touch a filesystem, so the
// exporter also runs in a browser bundle (@transtyle/core/browser).
import inventory from '../surface-inventory.json' with { type: 'json' };
import { surfaceRows as rowsFor, surfaceStatus } from '@transtyle/ir';

/** The checked-in inventory. */
export function INVENTORY() {
  return inventory;
}

/**
 * The reason for an entry with none of its own. The four examples author
 * everything the exporter maps, so check:coverage-bar refuses this note
 * there: an entry new in a MUI upgrade still has to get a real reason.
 */
export const UNMAPPED = {
  cls: 'unsupported',
  note: "this design system defines nothing the exporter maps to this entry, so MUI's value stays",
};

/** For a design system with no dark scheme, the dark block is not emitted at all. */
const NO_DARK = {
  cls: 'dropped',
  note: 'the design system publishes no dark scheme, so colorSchemes carries light only and MUI writes no dark block',
};

const config = (note) => ({ cls: 'unsupported', meaning: 'target.config', note });
const veil = (note) => ({ cls: 'unsupported', meaning: 'opacity.component', note });

/**
 * Why an entry keeps MUI's value: `[pattern, reason]`, first match wins,
 * matched against the inventory id. `cls` is `unsupported` (MUI has the slot,
 * the catalog has no concept for it) or `dropped` (the catalog has it, this
 * exporter does not write it there); `slot` names the catalog side when there
 * is one; `meaning` is the report's catalog-signal key
 * (docs/findings/catalog-meanings.json) for an `unsupported` one. A function
 * receives the id's match.
 */
export const REASONS = [
  // ---- palette ----
  [
    /^(light|dark)\.--mui-palette-grey-/,
    {
      cls: 'unsupported',
      meaning: 'color.named-palette',
      note: "MUI's grey ramp, kept: it would need the neutral ramp projected onto MUI's fourteen steps per scheme, the shared projection of #39, still open",
    },
  ],
  [
    /^(light|dark)\.--mui-palette-common-black$/,
    { cls: 'unsupported', meaning: 'color.named-palette', note: "MUI's own black, kept: no component colours with it once the scheme's text and surfaces are set" },
  ],
  [
    /^(light|dark)\.--mui-palette-common-white$/,
    {
      cls: 'unsupported',
      meaning: 'color.named-palette',
      note: "MUI's own white, kept: it is the text of MUI's tooltips and slider value labels, which keep MUI's grey background (see Tooltip-bg)",
    },
  ],
  [
    /^(light|dark)\.--mui-palette-common-background$/,
    { cls: 'unsupported', meaning: 'color.named-palette', note: "MUI's pure black or white page constant, which no component reads: the page takes background.default" },
  ],
  [
    /^(light|dark)\.--mui-palette-common-onBackground$/,
    {
      cls: 'dropped',
      slot: 'semantic.color.border.field',
      note: "MUI composes the outlined input's border, the input underline, the switch track and ButtonGroup's dividers from this black or white at a fixed alpha (alpha(onBackground, 0.23)), so neither the design system's field border nor its base border (set on divider) reaches them",
    },
  ],
  [
    /^(light|dark)\.--mui-palette-action-active$/,
    {
      cls: 'dropped',
      slot: 'semantic.color.text.{base,muted}',
      note: "the colour of active icons (an icon button, a list icon): the catalog binds icon colours to the text ladder (proposal 0005), but this exporter does not write it yet, so MUI's stays",
    },
  ],
  [
    /^dark\.--mui-palette-text-icon$/,
    {
      cls: 'dropped',
      slot: 'semantic.color.text.{base,muted}',
      note: "the dark scheme's icon colour: the catalog binds icon colours to the text ladder (proposal 0005), but this exporter does not write it yet, so MUI's stays",
    },
  ],
  [
    /^(light|dark)\.--mui-palette-Tooltip-bg$/,
    {
      cls: 'dropped',
      slot: 'semantic.color.inverse.surface',
      note: "the tooltip's background, MUI's grey 700 at 92% in both schemes: palette.Tooltip.bg could take the inverse surface, but this exporter does not write it yet, and the tooltip's text is common.white, shared with other components",
    },
  ],
  [
    /^(light|dark)\.--mui-palette-action-(hover|selected|focus|activated)Opacity$/,
    (m) =>
      veil(`the strength of MUI's ${m[2]} veil, which its components compose over any colour (alpha(colour, ${m[2]}Opacity)); the catalog's state washes are colours per role, not one strength`),
  ],
  [
    /^(light|dark)\.--mui-palette-action-(focus|disabledBackground)$/,
    (m) =>
      veil(
        m[2] === 'focus'
          ? 'the focus veil, translucent black or white over any surface; the catalog has no focus wash (the focus ring is set on focusVisible)'
          : "the background of a disabled contained button, a translucent veil over any surface; the catalog's disabled state is an opacity, set on action.disabledOpacity",
      ),
  ],
  [
    /^(light|dark)\.--mui-palette-FilledInput-(bg|hoverBg|disabledBg)$/,
    veil("the filled text field's background veils, translucent black or white over any surface; the catalog has no input surface, and its washes are per role and opaque"),
  ],
  [
    /^(light|dark)\.--mui-palette-Input-autofillWebkitBoxShadow$/,
    config("the inset shadow MUI paints over the browser's autofill highlight (none in light, a blue in dark): a browser workaround, not a design value"),
  ],
  [
    /^(light|dark)\.--mui-opacity-(inputPlaceholder|inputUnderline|switchTrackDisabled|switchTrack)$/,
    (m) =>
      veil(
        `a per-component opacity (${{ inputPlaceholder: "a placeholder's", inputUnderline: "an input underline's", switchTrackDisabled: "a disabled switch track's", switchTrack: "a switch track's" }[m[2]]} alpha): semantic.opacity.disabled is the only opacity the catalog has; MUI's stays`,
      ),
  ],
  [
    /^theme\.colorSchemes\.(light|dark)\.palette\.(contrastThreshold|tonalOffset)$/,
    (m) =>
      config(
        m[2] === 'contrastThreshold'
          ? "the contrast ratio MUI picks a palette colour's contrastText by; every role's contrastText is set from its on-solid, so it only decides MUI's own colours"
          : "how far MUI moves a palette colour's light and dark shades from main; every role's shades are set from the grid, so it only decides MUI's own colours",
      ),
  ],

  // ---- typography ----
  [
    /^theme\.typography\.fontWeightLight$/,
    { cls: 'unsupported', meaning: 'scale.extra-rung', note: "the catalog's weights are regular, medium, semibold and bold; MUI's light (300, its own h1 and h2) stays" },
  ],
  [
    /^theme\.typography\.(fontSize|htmlFontSize)$/,
    config("the base of MUI's pxToRem, which its own variants are sized with; this theme writes every variant's size itself"),
  ],
  [
    /^theme\.typography\.(button|overline)\.textTransform$/,
    (m) => ({ cls: 'unsupported', meaning: 'type.text-transform', note: `MUI's ${m[1]} is uppercase: the catalog's type roles carry no letter case, so MUI's stays` }),
  ],
  [/^theme\.typography\.inherit\./, config("the inherit variant: CSS keywords that make a component take its parent's type, not a design value")],

  // ---- scales ----
  [
    /^variables\.--mui-zIndex-(mobileStepper|fab|speedDial)$/,
    { cls: 'unsupported', meaning: 'scale.extra-rung', note: "the catalog's z ladder has no layer for a mobile stepper, a floating action button or a speed dial; MUI's stay" },
  ],

  // ---- focus ring and motion ----
  // The ring's width and offset are catalog slots since #167 (`semantic.ring.{width,offset}`),
  // written when authored: unauthored, they are explained by `mapped` below, naming the slot.
  [
    /^theme\.focusVisible\.outlineStyle$/,
    {
      cls: 'unsupported',
      meaning: 'focus.ring-style',
      note: "the ring's style: every outline-family target draws it solid, so the catalog has no slot for it (proposal 0002, row 8); MUI's solid stays",
    },
  ],
  [/^theme\.motion\.reducedMotion$/, config('whether MUI turns its transitions off under prefers-reduced-motion (never, system, always): a behaviour switch, not a design value')],
];

/** An entry on MUI's default only because something it is computed from is. */
const derivedReason = (deps, reasonOf) => {
  const first = reasonOf(deps[0]);
  return {
    cls: first?.cls ?? 'unsupported',
    ...(first?.meaning ? { meaning: first.meaning } : {}),
    note: `computed from ${deps.join(', ')}, which ${deps.length === 1 ? 'keeps' : 'keep'} MUI's value (see ${deps.length === 1 ? 'that row' : 'those rows'})`,
  };
};

const leaf = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/**
 * Classify the inventory against the emitted options. `mapped` is the
 * exporter's `Map<option path, catalog slot>` of every leaf it writes from a
 * catalog slot, recorded whether or not this design system defines the slot,
 * so an entry left on MUI's default for want of it names the slot.
 */
export function classifySurface(inv, options, mapped = new Map(), hasDark = true) {
  const isSet = (entry) => !!entry.path && leaf(options, entry.path) !== undefined;
  const status = surfaceStatus(inv.entries, isSet);
  const byId = new Map(inv.entries.map((e) => [e.id, e]));

  const rule = (entry) => {
    for (const [pattern, reason] of REASONS) {
      const m = pattern.exec(entry.id);
      if (m) return typeof reason === 'function' ? reason(m) : reason;
    }
    return null;
  };
  const isDark = (entry) => entry.block === 'dark' || !!entry.path?.startsWith('colorSchemes.dark.');
  const reasons = new Map();
  const reasonOf = (id) => {
    if (reasons.has(id)) return reasons.get(id);
    reasons.set(id, UNMAPPED); // cycle guard
    const entry = byId.get(id);
    const deps = (entry?.from ?? []).filter((d) => status.get(d) === 'default');
    let r = rule(entry);
    if (!r && !hasDark && isDark(entry)) {
      // No dark block at all: a dark entry is explained by that, unless the
      // exporter would not write it anyway and it reads one whose reason is
      // MUI's own (the grey ramp), as in the light block.
      const explained = mapped.has(entry.path) ? [] : deps.filter((d) => reasonOf(d) !== NO_DARK);
      r = explained.length ? derivedReason(explained, reasonOf) : NO_DARK;
    }
    if (!r && entry.path && mapped.has(entry.path)) {
      const slot = mapped.get(entry.path);
      r = { cls: 'unsupported', slot, note: `set whenever the design system defines ${slot}; this one does not, so MUI's value stays` };
    }
    // An entry with a reason of its own is explained by it; one that only
    // reads defaults is explained by them.
    r ??= deps.length ? derivedReason(deps, reasonOf) : UNMAPPED;
    reasons.set(id, r);
    return r;
  };
  return inv.entries.map((entry) => {
    const s = status.get(entry.id);
    return { entry, status: s, reason: s === 'default' ? reasonOf(entry.id) : null };
  });
}

/** report.json rows for the emitted options. */
export function surfaceRows(options, mapped, hasDark, inv = INVENTORY()) {
  return rowsFor({
    classified: classifySurface(inv, options, mapped, hasDark),
    families: Object.keys(inv.counts.families),
    target: 'MUI',
    source: `@mui/material ${inv.muiVersion}`,
  });
}
