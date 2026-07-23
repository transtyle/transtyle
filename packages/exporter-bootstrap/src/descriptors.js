/**
 * AL1.2 (docs/plan/bootstrap-component-tier.md): the binding cross-walk —
 * which meaning each in-inventory Bootstrap variable reads. Data only; the
 * emission semantics are AL1.3's. Completeness is enforced by
 * scripts/check-bootstrap-surface.mjs: every in-inventory variable must be
 * bound here (emit), explicitly classified (drop), or mechanically covered
 * (chained / aliases-global / Bootstrap `null`-family marker).
 *
 * Recipe forms in `emit`:
 *   { comp: 'button.padding-x' }            — component-tier slot (COMPONENT_CATALOG)
 *   { sem: 'space.2' }                      — exporter-private semantic binding
 *   { sem: ..., cls: 'approximated', note } — inexact binding, honestly classed
 *   { trans: { duration, easing } }         — transition shorthand recipe:
 *     AL1.3 keeps Bootstrap's default property list and substitutes timing —
 *     always classed `approximated` (one duration/easing for a compound value).
 *
 * `drop` entries: { cls: 'dropped' | 'unsupported', note } per
 * validation-and-coverage.md's class directions — `dropped` = has no token
 * meaning / deliberately not driven; `unsupported` = a real themable slot the
 * IR has no vocabulary for yet (catalog-growth data, by construction).
 *
 * Mechanical classes (computed in coverageForVariable, not listed per name):
 *   chained         — the value references other `$` variables; Bootstrap's own
 *                     `!default` expression chains it from roots we do drive
 *                     (the plan's "bind the root decision" rule).
 *   follows-global  — aliases a global var(--bs-*) custom property, which the
 *                     semantic tier drives today.
 *   inherit-default — Bootstrap's `null`/`inherit`/`transparent`/`currentcolor`
 *                     no-op markers; setting them would change cascade
 *                     semantics, not theme values.
 */

// Shared honest notes (referenced by many entries — keep the wording in one place).
const N_PARAM =
  'Bootstrap state/subtle-color derivation knob (shade/tint/scale %). Transtyle derives those result colors directly (grid -hover/-active cells, tint/outline prominences); the percentage itself has no token meaning — the derived colors reach the target via the CSS-variable path (AL1.4).';
const N_ASSET =
  'embedded SVG asset (icon/glyph) — the IR has no asset/icon vocabulary yet. AL2 growth signal: component icon slots.';
const N_OPACITY =
  'opacity value with no shared meaning: AL2 promoted `semantic.opacity.disabled` (the one both reference targets needed) but this slot is a different concept — a veil strength, a shimmer range, or a glyph-specific alpha. Growth signal only if a second target needs the identical one.';
const N_BESPOKE =
  'bespoke component geometry/sizing with no scale meaning — the IR has no component-size vocabulary yet. AL2 growth signal: component sizing.';
const N_STRUCT =
  'structural/behavioral option (layout, cursor, transform, ordering, animation mechanics), not a theme value.';
const N_FILTER = 'CSS filter trick — presentation mechanics, not a token meaning.';
const N_EM =
  'em-relative in Bootstrap (proportional to local font size); bound to the nearest rem rung — proportional intent is approximated, not preserved.';

const T_FAST = { trans: { duration: 'duration.fast', easing: 'easing.standard' } };

export const DESCRIPTORS = {
  // ---- content-ish micro components -------------------------------------
  caret: {
    drop: { 'caret-width': { cls: 'dropped', note: N_STRUCT + ' (caret glyph geometry)' } },
  },
  hr: { drop: { 'hr-opacity': { cls: 'unsupported', note: N_OPACITY } } },
  legend: {
    emit: {
      'legend-margin-bottom': { sem: 'space.2' },
      'legend-font-size': {
        sem: 'type.size.xl',
        cls: 'approximated',
        note: '1.5rem vs the 1.563rem scale rung — nearest meaning',
      },
    },
  },
  mark: { emit: { 'mark-padding': { sem: 'space.1', cls: 'approximated', note: N_EM } } },
  kbd: {
    emit: {
      'kbd-padding-y': {
        sem: 'space.1',
        cls: 'approximated',
        note: '.1875rem — sub-rung; nearest meaning',
      },
      'kbd-padding-x': {
        sem: 'space.1',
        cls: 'approximated',
        note: '.375rem — between rungs; nearest meaning',
      },
    },
  },
  pre: {},
  code: {},
  dt: {},
  figure: {},
  blockquote: {},
  thumbnail: { emit: { 'thumbnail-padding': { sem: 'space.1' } } },
  placeholder: {
    drop: {
      'placeholder-opacity-max': { cls: 'unsupported', note: N_OPACITY },
      'placeholder-opacity-min': { cls: 'unsupported', note: N_OPACITY },
    },
  },

  // ---- table --------------------------------------------------------------
  table: {
    emit: {
      'table-cell-padding-y': { sem: 'space.2' },
      'table-cell-padding-x': { sem: 'space.2' },
      'table-cell-padding-y-sm': { sem: 'space.1' },
      'table-cell-padding-x-sm': { sem: 'space.1' },
    },
    drop: {
      'table-cell-vertical-align': { cls: 'dropped', note: N_STRUCT },
      'table-th-font-weight': {
        cls: 'dropped',
        note: 'Bootstrap null marker with no non-null meaning to bind',
      },
      'table-striped-bg-factor': { cls: 'dropped', note: N_PARAM },
      'table-active-bg-factor': { cls: 'dropped', note: N_PARAM },
      'table-hover-bg-factor': { cls: 'dropped', note: N_PARAM },
      'table-border-factor': { cls: 'dropped', note: N_PARAM },
      'table-bg-scale': { cls: 'dropped', note: N_PARAM },
      'table-striped-order': { cls: 'dropped', note: N_STRUCT },
      'table-striped-columns-order': { cls: 'dropped', note: N_STRUCT },
    },
  },

  // ---- buttons + the shared input-btn root --------------------------------
  input: {
    emit: {
      // AL2 RESOLVED the AL1.2 contested call: Bootstrap's shared root now
      // binds to the promoted `component.control.*` slots — the shared
      // interactive-control geometry — and `$btn-padding-*` below binds to
      // `component.button.*`, which defaults from control. That reproduces
      // Bootstrap's own two-level model exactly ($btn-padding-y defaults to
      // $input-btn-padding-y), so authoring `control.*` moves buttons and
      // fields together while authoring `button.*` moves only buttons.
      'input-btn-padding-y': { comp: 'control.padding-y' },
      'input-btn-padding-x': { comp: 'control.padding-x' },
      // The sm/lg ladder stays exporter-private: both targets have one, but
      // they disagree on the rungs (PrimeNG sm-x = space.3, Bootstrap = space.2),
      // so there is no convergent value to promote — proposal 0003 §deferred.
      'input-btn-padding-y-sm': { sem: 'space.1' },
      'input-btn-padding-x-sm': { sem: 'space.2' },
      'input-btn-padding-y-lg': { sem: 'space.2' },
      'input-btn-padding-x-lg': { sem: 'space.4' },
      'input-border-radius': { comp: 'control.radius' },
      'input-transition': T_FAST,
    },
  },
  btn: {
    emit: {
      // Review finding (2026-07-23): $btn-border-radius defaults to the global
      // var(--bs-border-radius) — without an explicit binding, an authored
      // component.button.radius (the catalog's flagship slot) would be
      // silently ignored on Bootstrap. Bound; unauthored builds emit the
      // resolved default (≡ what the chain produced) — explicit, not drifted.
      'btn-border-radius': { comp: 'button.radius' },
      // AL2: Bootstrap chains these from the shared $input-btn-* root by
      // default; binding them explicitly to the button layer is what makes
      // per-component authoring reach buttons without moving form fields.
      'btn-padding-x': { comp: 'button.padding-x' },
      'btn-padding-y': { comp: 'button.padding-y' },
      'btn-disabled-opacity': {
        sem: 'opacity.disabled',
        cls: 'approximated',
        note: "Bootstrap's own default is .65; the promoted catalog slot is the shared disabled-state opacity (AL2)",
      },
      'btn-transition': T_FAST,
    },
    drop: {
      'btn-hover-bg-shade-amount': { cls: 'dropped', note: N_PARAM },
      'btn-hover-bg-tint-amount': { cls: 'dropped', note: N_PARAM },
      'btn-hover-border-shade-amount': { cls: 'dropped', note: N_PARAM },
      'btn-hover-border-tint-amount': { cls: 'dropped', note: N_PARAM },
      'btn-active-bg-shade-amount': { cls: 'dropped', note: N_PARAM },
      'btn-active-bg-tint-amount': { cls: 'dropped', note: N_PARAM },
      'btn-active-border-shade-amount': { cls: 'dropped', note: N_PARAM },
      'btn-active-border-tint-amount': { cls: 'dropped', note: N_PARAM },
    },
  },
  'btn-close': {
    drop: {
      'btn-close-width': { cls: 'unsupported', note: N_BESPOKE },
      'btn-close-padding-x': { cls: 'unsupported', note: N_BESPOKE + ' ' + N_EM },
      'btn-close-bg': { cls: 'unsupported', note: N_ASSET },
      'btn-close-opacity': { cls: 'unsupported', note: N_OPACITY },
      'btn-close-hover-opacity': { cls: 'unsupported', note: N_OPACITY },
      'btn-close-focus-opacity': { cls: 'unsupported', note: N_OPACITY },
      'btn-close-disabled-opacity': { cls: 'unsupported', note: N_OPACITY },
      'btn-close-white-filter': { cls: 'dropped', note: N_FILTER },
    },
  },

  // ---- forms ---------------------------------------------------------------
  'form-text': { emit: { 'form-text-margin-top': { sem: 'space.1' } } },
  'form-label': { emit: { 'form-label-margin-bottom': { sem: 'space.2' } } },
  'form-color': { drop: { 'form-color-width': { cls: 'unsupported', note: N_BESPOKE } } },
  'form-check': {
    emit: {
      'form-check-margin-bottom': {
        sem: 'space.1',
        cls: 'approximated',
        note: '.125rem — sub-rung; nearest meaning',
      },
      'form-check-input-border-radius': { sem: 'radius.sm', cls: 'approximated', note: N_EM },
      'form-check-inline-margin-end': { sem: 'space.4' },
      'form-check-input-disabled-opacity': {
        sem: 'opacity.disabled',
        cls: 'approximated',
        note: "Bootstrap's own default is .5; unified onto the shared disabled-state opacity (AL2)",
      },
    },
    drop: {
      'form-check-input-width': {
        cls: 'unsupported',
        note: N_BESPOKE + ' (checkbox glyph size, em-relative)',
      },
      'form-check-input-active-filter': { cls: 'dropped', note: N_FILTER },
      'form-check-radio-border-radius': {
        cls: 'dropped',
        note: N_STRUCT + ' (50% is the radio shape identity, not a radius token)',
      },
      'form-check-input-checked-bg-image': { cls: 'unsupported', note: N_ASSET },
      'form-check-radio-checked-bg-image': { cls: 'unsupported', note: N_ASSET },
      'form-check-input-indeterminate-bg-image': { cls: 'unsupported', note: N_ASSET },
    },
  },
  'form-switch': {
    emit: { 'form-switch-transition': T_FAST },
    drop: {
      'form-switch-width': { cls: 'unsupported', note: N_BESPOKE + ' (track width, em-relative)' },
      'form-switch-bg-image': { cls: 'unsupported', note: N_ASSET },
      'form-switch-focus-bg-image': { cls: 'unsupported', note: N_ASSET },
      'form-switch-checked-bg-image': { cls: 'unsupported', note: N_ASSET },
      'form-switch-checked-bg-position': { cls: 'dropped', note: N_STRUCT },
    },
  },
  'form-select': {
    drop: {
      'form-select-bg-size': { cls: 'dropped', note: N_STRUCT + ' (indicator geometry)' },
      'form-select-indicator': { cls: 'unsupported', note: N_ASSET },
    },
  },
  'form-range': {
    emit: {
      'form-range-track-height': { sem: 'space.2' },
      'form-range-track-border-radius': {
        sem: 'radius.full',
        cls: 'approximated',
        note: 'Bootstrap says 1rem; the intent (pill track) maps to radius.full',
      },
      'form-range-thumb-border-radius': {
        sem: 'radius.full',
        cls: 'approximated',
        note: 'pill/circular thumb intent',
      },
      'form-range-thumb-transition': T_FAST,
    },
    drop: {
      'form-range-track-width': { cls: 'dropped', note: N_STRUCT },
      'form-range-track-cursor': { cls: 'dropped', note: N_STRUCT },
      'form-range-thumb-width': { cls: 'unsupported', note: N_BESPOKE + ' (thumb size)' },
      'form-range-thumb-border': { cls: 'dropped', note: N_STRUCT },
    },
  },
  'form-floating': {
    emit: {
      'form-floating-line-height': { sem: 'type.leading.tight' },
      'form-floating-padding-y': { sem: 'space.4' },
      'form-floating-transition': {
        trans: { duration: 'duration.fast', easing: 'easing.standard' },
      },
    },
    drop: {
      'form-floating-input-padding-t': {
        cls: 'dropped',
        note: N_STRUCT + ' (float-label mechanics: padding split is coupled to the transform math)',
      },
      'form-floating-input-padding-b': {
        cls: 'dropped',
        note: N_STRUCT + ' (float-label mechanics)',
      },
      'form-floating-label-height': { cls: 'dropped', note: N_STRUCT + ' (float-label mechanics)' },
      'form-floating-label-opacity': { cls: 'unsupported', note: N_OPACITY },
      'form-floating-label-transform': { cls: 'dropped', note: N_STRUCT },
    },
  },
  'form-feedback': {
    drop: {
      'form-feedback-icon-valid': { cls: 'unsupported', note: N_ASSET },
      'form-feedback-icon-invalid': { cls: 'unsupported', note: N_ASSET },
    },
  },
  'form-valid': {},
  'form-invalid': {},
  'form-validation': {},
  'form-file': {},
  'input-group': {},

  // ---- navigation -----------------------------------------------------------
  'nav-link': {
    emit: {
      'nav-link-padding-y': { sem: 'space.2' },
      'nav-link-padding-x': { sem: 'space.4' },
      'nav-link-transition': T_FAST,
    },
  },
  nav: {
    emit: {
      'nav-underline-gap': { sem: 'space.4' },
      'nav-underline-border-width': {
        sem: 'border-width.medium',
        cls: 'approximated',
        note: 'medium rung (2px) ≡ Bootstrap’s .125rem at a 16px root; unit semantics differ (px vs rem-relative)',
      },
    },
  },
  navbar: {
    emit: {
      'navbar-nav-link-padding-x': { sem: 'space.2' },
      'navbar-brand-margin-end': { sem: 'space.4' },
      'navbar-toggler-padding-y': { sem: 'space.1' },
      'navbar-toggler-padding-x': { sem: 'space.3' },
      'navbar-toggler-transition': T_FAST,
    },
    drop: {
      'navbar-light-toggler-icon-bg': { cls: 'unsupported', note: N_ASSET },
      'navbar-dark-toggler-icon-bg': { cls: 'unsupported', note: N_ASSET },
    },
  },
  breadcrumb: {
    emit: {
      'breadcrumb-padding-y': { sem: 'space.0' },
      'breadcrumb-padding-x': { sem: 'space.0' },
      'breadcrumb-item-padding-x': { sem: 'space.2' },
      'breadcrumb-margin-bottom': { sem: 'space.4' },
    },
    drop: { 'breadcrumb-divider': { cls: 'dropped', note: N_STRUCT + ' (divider glyph)' } },
  },
  pagination: {
    emit: {
      'pagination-padding-y': {
        sem: 'space.2',
        cls: 'approximated',
        note: '.375rem — between rungs; matches the button/field padding intent',
      },
      'pagination-padding-x': { sem: 'space.3' },
      'pagination-padding-y-sm': { sem: 'space.1' },
      'pagination-padding-x-sm': { sem: 'space.2' },
      'pagination-padding-y-lg': { sem: 'space.3' },
      'pagination-padding-x-lg': { sem: 'space.6' },
      'pagination-transition': T_FAST,
    },
    drop: {
      'pagination-focus-outline': {
        cls: 'dropped',
        note: N_STRUCT + ' (focus handled by focus-ring, driven semantically)',
      },
    },
  },

  // ---- surfaces / overlays ---------------------------------------------------
  card: {},
  accordion: {
    emit: {
      'accordion-padding-y': { sem: 'space.4' },
      'accordion-padding-x': { sem: 'space.5' },
      'accordion-icon-transition': {
        trans: { duration: 'duration.normal', easing: 'easing.standard' },
      },
    },
    drop: {
      'accordion-icon-width': { cls: 'unsupported', note: N_BESPOKE + ' (chevron size)' },
      'accordion-icon-transform': { cls: 'dropped', note: N_STRUCT },
      'accordion-button-icon': { cls: 'unsupported', note: N_ASSET },
      'accordion-button-active-icon': { cls: 'unsupported', note: N_ASSET },
    },
  },
  dropdown: {
    emit: {
      'dropdown-padding-x': { sem: 'space.0' },
      'dropdown-padding-y': { sem: 'space.2' },
      'dropdown-spacer': {
        sem: 'space.1',
        cls: 'approximated',
        note: '.125rem — sub-rung; nearest meaning',
      },
    },
    drop: { 'dropdown-min-width': { cls: 'unsupported', note: N_BESPOKE } },
  },
  modal: {
    emit: {
      'modal-footer-margin-between': { sem: 'space.2' },
      'modal-dialog-margin': { sem: 'space.2' },
      'modal-dialog-margin-y-sm-up': {
        sem: 'space.6',
        cls: 'approximated',
        note: '1.75rem — between rungs; nearest meaning',
      },
      'modal-transition': { trans: { duration: 'duration.normal', easing: 'easing.enter' } },
      // Overlay pass (proposal 0003): Bootstrap splits the veil into a colour
      // and an opacity; the IR's `scrim` already carries BOTH (its value has an
      // alpha channel), so this needs no new vocabulary — just the two halves
      // read out separately. `$offcanvas-backdrop-*` chains from these, so the
      // offcanvas veil follows for free. Was `unsupported` on the claim that
      // "scrim covers the color, not the alpha" — that claim was wrong.
      'modal-backdrop-bg': { sem: 'color.scrim', part: 'opaque' },
      'modal-backdrop-opacity': { sem: 'color.scrim', part: 'alpha' },
    },
    drop: {
      'modal-sm': { cls: 'unsupported', note: N_BESPOKE + ' (dialog width steps)' },
      'modal-md': { cls: 'unsupported', note: N_BESPOKE + ' (dialog width steps)' },
      'modal-lg': { cls: 'unsupported', note: N_BESPOKE + ' (dialog width steps)' },
      'modal-xl': { cls: 'unsupported', note: N_BESPOKE + ' (dialog width steps)' },
      'modal-fade-transform': { cls: 'dropped', note: N_STRUCT },
      'modal-show-transform': { cls: 'dropped', note: N_STRUCT },
      'modal-scale-transform': { cls: 'dropped', note: N_STRUCT },
    },
  },
  offcanvas: {
    emit: {
      'offcanvas-transition-duration': {
        sem: 'duration.normal',
        cls: 'approximated',
        note: '.3s vs 250ms — nearest rung',
      },
    },
    drop: {
      'offcanvas-horizontal-width': { cls: 'unsupported', note: N_BESPOKE + ' (panel width)' },
      'offcanvas-vertical-height': { cls: 'unsupported', note: N_BESPOKE + ' (panel height)' },
    },
  },
  tooltip: {
    drop: {
      'tooltip-max-width': { cls: 'unsupported', note: N_BESPOKE },
      'tooltip-opacity': { cls: 'unsupported', note: N_OPACITY },
      'tooltip-arrow-width': { cls: 'dropped', note: N_STRUCT + ' (arrow geometry)' },
      'tooltip-arrow-height': { cls: 'dropped', note: N_STRUCT + ' (arrow geometry)' },
    },
  },
  popover: {
    emit: { 'popover-header-padding-y': { sem: 'space.2' } },
    drop: {
      'popover-max-width': { cls: 'unsupported', note: N_BESPOKE },
      'popover-arrow-width': { cls: 'dropped', note: N_STRUCT + ' (arrow geometry)' },
      'popover-arrow-height': { cls: 'dropped', note: N_STRUCT + ' (arrow geometry)' },
    },
  },
  toast: {
    emit: {
      'toast-padding-x': { sem: 'space.3' },
      'toast-padding-y': { sem: 'space.2' },
      'toast-font-size': {
        sem: 'type.size.sm',
        cls: 'approximated',
        note: '.875rem vs the 0.8rem scale rung — nearest meaning',
      },
    },
    drop: { 'toast-max-width': { cls: 'unsupported', note: N_BESPOKE } },
  },

  // ---- feedback / status -------------------------------------------------------
  alert: {
    emit: { 'alert-margin-bottom': { sem: 'space.4' } },
    drop: {
      'alert-bg-scale': { cls: 'dropped', note: N_PARAM },
      'alert-border-scale': { cls: 'dropped', note: N_PARAM },
      'alert-color-scale': { cls: 'dropped', note: N_PARAM },
    },
  },
  'list-group': {
    drop: {
      'list-group-item-bg-scale': { cls: 'dropped', note: N_PARAM },
      'list-group-item-color-scale': { cls: 'dropped', note: N_PARAM },
    },
  },
  badge: {
    emit: {
      'badge-font-size': { sem: 'type.size.xs', cls: 'approximated', note: N_EM },
      'badge-padding-y': { sem: 'space.1', cls: 'approximated', note: N_EM },
      'badge-padding-x': { sem: 'space.2', cls: 'approximated', note: N_EM },
    },
  },
  progress: {
    emit: {
      'progress-height': { sem: 'space.4' },
      'progress-bar-transition': {
        trans: { duration: 'duration.slower', easing: 'easing.standard' },
      },
    },
    drop: {
      'progress-bar-animation-timing': {
        cls: 'dropped',
        note: N_STRUCT + ' (stripe animation mechanics)',
      },
    },
  },
  spinner: {
    emit: {
      'spinner-animation-speed': {
        sem: 'duration.slower',
        cls: 'approximated',
        note: '.75s rotation period vs 600ms — nearest rung',
      },
    },
    drop: {
      'spinner-width': { cls: 'unsupported', note: N_BESPOKE },
      'spinner-width-sm': { cls: 'unsupported', note: N_BESPOKE },
      'spinner-border-width': {
        cls: 'unsupported',
        note: N_BESPOKE + ' (em-relative ring thickness)',
      },
      'spinner-border-width-sm': {
        cls: 'unsupported',
        note: N_BESPOKE + ' (em-relative ring thickness)',
      },
      'spinner-vertical-align': { cls: 'dropped', note: N_STRUCT },
    },
  },
  carousel: {
    emit: {
      'carousel-caption-padding-y': { sem: 'space.5' },
      'carousel-caption-spacer': { sem: 'space.5' },
      'carousel-control-transition': T_FAST,
      'carousel-indicator-transition': {
        trans: { duration: 'duration.slower', easing: 'easing.standard' },
      },
      'carousel-transition-duration': { sem: 'duration.slower' },
    },
    drop: {
      'carousel-control-width': { cls: 'dropped', note: N_STRUCT },
      'carousel-control-opacity': { cls: 'unsupported', note: N_OPACITY },
      'carousel-control-hover-opacity': { cls: 'unsupported', note: N_OPACITY },
      'carousel-indicator-width': { cls: 'unsupported', note: N_BESPOKE + ' (indicator geometry)' },
      'carousel-indicator-height': {
        cls: 'unsupported',
        note: N_BESPOKE + ' (indicator geometry)',
      },
      'carousel-indicator-hit-area-height': {
        cls: 'dropped',
        note: N_STRUCT + ' (touch target mechanics)',
      },
      'carousel-indicator-spacer': {
        cls: 'unsupported',
        note: N_BESPOKE + ' (indicator geometry)',
      },
      'carousel-indicator-opacity': { cls: 'unsupported', note: N_OPACITY },
      'carousel-indicator-active-opacity': { cls: 'unsupported', note: N_OPACITY },
      'carousel-caption-width': { cls: 'dropped', note: N_STRUCT },
      'carousel-control-icon-width': { cls: 'unsupported', note: N_BESPOKE + ' (icon size)' },
      'carousel-control-prev-icon-bg': { cls: 'unsupported', note: N_ASSET },
      'carousel-control-next-icon-bg': { cls: 'unsupported', note: N_ASSET },
      'carousel-dark-control-icon-filter': { cls: 'dropped', note: N_FILTER },
    },
  },
};

/** Bootstrap's cascade no-op markers — mechanically classified. */
const INHERIT_MARKERS = new Set(['null', 'inherit', 'transparent', 'currentcolor']);

/**
 * Classify one inventory variable (scope === 'component').
 * Returns { emit } | { drop } | { mech: 'chained'|'follows-global'|'inherit-default' } | null.
 * null = unclassified — check-bootstrap-surface.mjs fails the build on it.
 */
export function coverageForVariable(v) {
  const d = DESCRIPTORS[v.family] ?? {};
  const emit = d.emit?.[v.name];
  const drop = d.drop?.[v.name];
  if (emit && drop) return { emit, drop };
  if (emit) return { emit };
  if (drop) return { drop };
  if (v.refs.length > 0) return { mech: 'chained' };
  if (v.aliasesGlobalCssVar) return { mech: 'follows-global' };
  if (INHERIT_MARKERS.has(v.value)) return { mech: 'inherit-default' };
  return null;
}
