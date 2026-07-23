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
 *   inherits-driven — a cascade no-op marker on an *inherited* property whose
 *                     effective value still comes from something we drive (see
 *                     INHERITS_DRIVEN). Real coverage, exactly as PrimeNG's
 *                     `inherited` reason is.
 *   inherit-default — the remaining `null`/`inherit`/`transparent`/`currentcolor`
 *                     no-op markers; setting them would change cascade
 *                     semantics, not theme values.
 *
 * Recipe `part`: 'alpha' | 'opaque' for colors; a composite member name
 * ('fontSize' | 'fontWeight' | 'lineHeight') for `semantic.type.role.*`.
 */

// Shared honest notes (referenced by many entries — keep the wording in one place).
const N_PARAM =
  'Bootstrap state/subtle-color derivation knob (shade/tint/scale %). Transtyle derives those result colors directly (grid -hover/-active cells, tint/outline prominences); the percentage itself has no token meaning — the derived colors reach the target via the CSS-variable path (AL1.4).';
const N_ASSET =
  'embedded SVG asset (icon/glyph) — the IR has no asset/icon vocabulary yet. AL2 growth signal: component icon slots.';
const N_OPACITY =
  'opacity value with no shared meaning: AL2 promoted `semantic.opacity.disabled` (the one both reference targets needed) but this slot is a different concept — a veil strength, a shimmer range, or a glyph-specific alpha. Growth signal only if a second target needs the identical one.';
// Probed against PrimeNG's real inventory in proposal 0004 — the earlier wording
// ("the IR has no component-size vocabulary yet") promised a vocabulary the
// evidence says nobody needs. Of the ten concepts in this bucket, six are
// one-sided (PrimeNG hard-codes what Bootstrap tokenizes: spinner, popover,
// modal ladder, offcanvas) or false friends ($toast-max-width 350px vs
// PrimeNG's fixed `width: 22rem`; $dropdown-min-width is the menu, PrimeNG's
// `dropdown.width` is the trigger), and two more share the concept while
// disagreeing on its architecture. A note that names a growth signal that isn't
// there is the coverage-report version of over-claiming.
const N_BESPOKE =
  'bespoke component geometry with no shared meaning — measured against the second reference target (proposal 0004), this is a slot PrimeNG either hard-codes or models differently, not a gap in the IR. Not a growth signal.';
// The two shapes proposal 0004 separated out of N_BESPOKE, because they are
// genuinely different situations and a single note flattened them.
const N_ARCH_DISAGREE =
  'both reference targets have this concept and model it differently, so no single authored value satisfies both: Bootstrap sizes it in `em` (proportional to local font size, one dimension), PrimeNG in absolute `rem` with independent width/height and an sm/md/lg ladder. The disagreement is the finding (proposal 0004) — same shape as the size ladder AL2 rejected.';
const N_ICON =
  'component icon size. The strongest open catalog-growth signal, and still one-sided: PrimeNG models this systematically (50 `icon.size` slots across 31 families, with a shared value set), Bootstrap has three ad-hoc ones with no common root. Promoting today would export one target’s architecture into the catalog — revisit when a third target arrives with a systematic icon-size concept (proposal 0004).';
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
      // Bootstrap nulls the weight (inherit body 400), which is incoherent with
      // the 1.5rem size it does set: a legend is a fieldset's title. Bound to
      // the title role's weight so size and weight come from the same meaning.
      'legend-font-weight': { sem: 'type.role.title.md', part: 'fontWeight' },
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
      'btn-close-width': { cls: 'unsupported', note: N_ICON + ' (close glyph)' },
      'btn-close-padding-x': { cls: 'unsupported', note: N_BESPOKE + ' ' + N_EM },
      'btn-close-bg': { cls: 'unsupported', note: N_ASSET },
      'btn-close-opacity': { cls: 'unsupported', note: N_OPACITY },
      'btn-close-hover-opacity': { cls: 'unsupported', note: N_OPACITY },
      'btn-close-focus-opacity': { cls: 'unsupported', note: N_OPACITY },
      'btn-close-disabled-opacity': {
        cls: 'unsupported',
        note: 'the same concept as `semantic.opacity.disabled`, but not bindable to it: Bootstrap composes this against the glyph\'s own resting alpha ($btn-close-opacity: .5), so writing the catalog value (0.6) here would make the disabled close button MORE visible than the enabled one. Needs a compositional recipe (catalog factor x the target\'s resting alpha) the cross-walk has no form for yet — a real AL2-style growth signal, unlike the other -opacity rows in this family.',
      },
      'btn-close-white-filter': { cls: 'dropped', note: N_FILTER },
    },
  },

  // ---- forms ---------------------------------------------------------------
  'form-text': { emit: { 'form-text-margin-top': { sem: 'space.1' } } },
  'form-label': {
    emit: {
      'form-label-margin-bottom': { sem: 'space.2' },
      // Bootstrap leaves these `null` (labels inherit body type). The IR's type
      // roles say a label is its own role — and Bootstrap has the exact slots
      // to say so, so this is a binding, not an invention.
      'form-label-font-size': { sem: 'type.role.label.md', part: 'fontSize' },
      'form-label-font-weight': { sem: 'type.role.label.md', part: 'fontWeight' },
    },
  },
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
        note: N_ARCH_DISAGREE + ' (checkbox/radio box)',
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
      'form-switch-width': { cls: 'unsupported', note: N_ARCH_DISAGREE + ' (switch track)' },
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
      'accordion-icon-width': { cls: 'unsupported', note: N_ICON + ' (chevron)' },
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
      // The one slot in this bucket that passed the two-target bar, and the
      // strongest evidence the bar has seen: PrimeNG independently constrains
      // the same element the same way at the same value (`tooltip.root.maxWidth:
      // 12.5rem` = 200px), and it is one of only two `maxWidth` slots in its
      // entire 2759-slot surface. Awaiting the catalog promotion in proposal 0004.
      'tooltip-max-width': {
        cls: 'unsupported',
        note: 'a confirmed catalog-growth candidate, not a bespoke value: PrimeNG constrains the same element the same way at the same measure (tooltip.root.maxWidth 12.5rem = 200px), one of only two maxWidth slots in its whole surface. Promotion to `component.tooltip.max-width` is recommended in proposal 0004; until it lands, Bootstrap keeps its own default.',
      },
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
      'carousel-indicator-width': { cls: 'unsupported', note: N_ARCH_DISAGREE + ' (PrimeNG has indicator width+height too, but 28x8 rounded vs Bootstrap 30x3 hairline — one value would give two differently-wrong carousels)' },
      'carousel-indicator-height': {
        cls: 'unsupported',
        note: N_ARCH_DISAGREE + ' (indicator, height axis)',
      },
      'carousel-indicator-hit-area-height': {
        cls: 'dropped',
        note: N_STRUCT + ' (touch target mechanics)',
      },
      'carousel-indicator-spacer': {
        cls: 'unsupported',
        note: N_BESPOKE + ' (gap between indicators — PrimeNG has no counterpart at all)',
      },
      'carousel-indicator-opacity': { cls: 'unsupported', note: N_OPACITY },
      'carousel-indicator-active-opacity': { cls: 'unsupported', note: N_OPACITY },
      'carousel-caption-width': { cls: 'dropped', note: N_STRUCT },
      'carousel-control-icon-width': { cls: 'unsupported', note: N_ICON + ' (prev/next control)' },
      'carousel-control-prev-icon-bg': { cls: 'unsupported', note: N_ASSET },
      'carousel-control-next-icon-bg': { cls: 'unsupported', note: N_ASSET },
      'carousel-dark-control-icon-filter': { cls: 'dropped', note: N_FILTER },
    },
  },
};

/** Bootstrap's cascade no-op markers — mechanically classified. */
const INHERIT_MARKERS = new Set(['null', 'inherit', 'transparent', 'currentcolor']);

/**
 * The Bootstrap counterpart of PrimeNG's `inherited` reason (AL3,
 * surface-coverage.js): a slot left at a cascade no-op whose EFFECTIVE value
 * still comes from something this exporter drives. PrimeNG counts those as real
 * coverage (`derived`) because that is how PrimeNG is designed to be themed;
 * Bootstrap's `null` markers on inherited CSS properties work identically, and
 * classifying them as `dropped` under-reported the same mechanism on the other
 * target. Splitting them is a correction, not an inflation.
 *
 * Membership is per-name and deliberately conservative — the split is a real
 * judgment (does this property inherit at all, and is the ancestor value one we
 * drive?), so it is not inferred from the marker. Anything not listed here keeps
 * falling through to `inherit-default` (dropped), which is the safe direction:
 * a new upstream `null` variable is never silently claimed as covered.
 *
 * The two rejected shapes, for the record:
 *   - non-inherited properties (box-shadow, background, border-radius, height,
 *     margin, transition, filter): `null` means "no declaration", so nothing
 *     reaches them — those stay dropped.
 *   - inherited-but-structural (white-space, cursor): the value that reaches
 *     them is real, but it is not a theme value.
 */
const INHERITS_DRIVEN = {
  'hr-color': 'the body text color (driven) — the divider is currentColor at $hr-opacity',
  'hr-border-color': 'currentColor via $hr-color, so it follows the driven body color per mode',
  'input-btn-font-family': 'the driven body font stack',
  'form-text-font-style': 'the driven body type',
  'form-text-font-weight': 'the driven body type',
  'form-label-font-style': 'the driven body type',
  'form-label-color': 'the driven body text color',
  'input-disabled-color': 'the driven $input-color (Bootstrap keeps the enabled color when disabled)',
  'form-check-label-color': 'the driven body text color',
  'form-select-disabled-color': 'the driven $form-select-color',
  'nav-link-font-size': 'the driven body type',
  'nav-link-font-weight': 'the driven body type',
  'card-title-color': 'the driven card/body text color',
  'card-subtitle-color': 'the driven card/body text color',
  'card-cap-color': 'the driven card/body text color',
  'card-color': 'the driven body text color',
  'toast-color': 'the driven body text color',
  'pre-color': 'the driven body text color',
  'breadcrumb-font-size': 'the driven body type',
  'form-feedback-tooltip-line-height': 'the driven body line height',
  'tooltip-arrow-color': 'the driven --bs-tooltip-bg (Bootstrap points the arrow at the bubble color)',
  'table-group-separator-color': 'currentColor — the driven table text color',
};

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
  if (INHERIT_MARKERS.has(v.value)) {
    const from = INHERITS_DRIVEN[v.name];
    return from ? { mech: 'inherits-driven', from } : { mech: 'inherit-default' };
  }
  return null;
}
