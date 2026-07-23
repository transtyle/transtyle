/**
 * AL1.3/AL1.4 (docs/plan/bootstrap-component-tier.md): component-tier
 * emission for both paths, driven entirely by the AL1.2 cross-walk
 * (descriptors.js) over the AL1.1 inventory (surface-inventory.json).
 * Zero per-variable logic here — resolution walks the descriptor data.
 *
 * The coverage walk is the AL3 bar made real: every in-inventory variable
 * produces exactly one report row — bound, explicitly classified, or
 * mechanically chained — replacing the old single blanket line
 * "component tier reserved for v2".
 */
import { readFileSync } from 'node:fs';
import { DESCRIPTORS, coverageForVariable } from './descriptors.js';

const INVENTORY = JSON.parse(
  readFileSync(new URL('../surface-inventory.json', import.meta.url), 'utf8'),
);

const MECH = {
  chained: {
    class: 'derived',
    slot: 'via driven roots',
    note: "follows Bootstrap's own !default chain from roots this exporter drives (refs recorded in surface-inventory.json)",
  },
  'follows-global': {
    class: 'derived',
    slot: 'via global --bs-* vars',
    note: 'aliases a global custom property the semantic tier drives',
  },
  'inherits-driven': {
    class: 'derived',
    slot: 'via the cascade',
    // `from` is appended per variable — see the coverage walk below.
    note: 'left at Bootstrap\'s cascade no-op so the value reaches it by inheritance from',
  },
  'inherit-default': {
    class: 'dropped',
    slot: '—',
    note: 'Bootstrap cascade no-op marker (null/inherit/transparent/currentcolor) left untouched — overriding would change inheritance behavior, not theme values',
  },
};

/**
 * Resolve every emit recipe against the light map. Returns
 * [{ v, recipe, value, cls, slot, note }] in inventory (source) order.
 * Dimensions/motion are mode-invariant in Bootstrap's variable layer, so the
 * light map is authoritative for the Sass path; AL1.4's per-mode color work
 * reads the grid directly, not this.
 */
export function resolveEmits(light, ctx) {
  const out = [];
  for (const v of INVENTORY.variables) {
    if (v.scope !== 'component') continue;
    const recipe = DESCRIPTORS[v.family]?.emit?.[v.name];
    if (!recipe) continue;
    let value,
      slot,
      cls,
      note = recipe.note;
    const provCls = (entry) =>
      ['authored', 'aliased'].includes(entry.provenance.kind) ? 'native' : 'derived';
    // AL5: a recipe's source can legitimately be absent. `semantic.radius.*`
    // only exists once something authors `radius.md`, so a perfectly valid
    // minimal design system (brand color + text + surface) made this function
    // throw a bare `Cannot read properties of undefined (reading 'value')` with
    // no code, no slot name, and no hint — the worst failure in the sweep,
    // because the user did nothing wrong. `check:bootstrap-surface` never saw
    // it: it validates recipe paths against Acme, which authors everything.
    // An absent source is reported as an honest coverage row instead.
    const sourcePath = recipe.comp
      ? `component.${recipe.comp}`
      : recipe.sem
        ? `semantic.${recipe.sem}`
        : recipe.trans
          ? `semantic.${recipe.trans.duration}`
          : null;
    if (sourcePath && light.get(sourcePath)?.value === undefined) {
      out.push({
        v,
        recipe,
        value: undefined,
        cls: 'dropped',
        slot: '—',
        note: `nothing to bind: this design system has no ${sourcePath}. The binding exists, its source does not — author that slot (or the scale it derives from) and this variable starts being driven.`,
      });
      continue;
    }
    if (recipe.comp) {
      const entry = light.get(`component.${recipe.comp}`);
      value = entry.value;
      slot = `component.${recipe.comp}`;
      cls = recipe.cls ?? provCls(entry);
    } else if (recipe.sem) {
      const entry = light.get(`semantic.${recipe.sem}`);
      // `part` splits a color into the two halves Bootstrap wants separately
      // (a backdrop is `$..-bg` + `$..-opacity`, never one rgba). The alpha is
      // already carried by the IR color — see the overlay pass in proposal 0003.
      value =
        recipe.part === 'alpha'
          ? (entry.value.alpha ?? 1)
          : recipe.part === 'opaque'
            ? ctx.formatHex({ ...entry.value, alpha: 1 }).text
            : recipe.part
              ? // A `semantic.type.role.*` composite: Bootstrap splits the role
                // across separate $..-font-size / $..-font-weight variables, so
                // each reads one member of the same composite.
                entry.value[recipe.part]
              : entry.value;
      slot = `semantic.${recipe.sem}${recipe.part ? ` (${recipe.part})` : ''}`;
      cls = recipe.cls ?? provCls(entry);
    } else if (recipe.trans) {
      const dur = light.get(`semantic.${recipe.trans.duration}`).value;
      const ease = light.get(`semantic.${recipe.trans.easing}`).value;
      const props = v.value.split(',').map((seg) => seg.trim().split(/\s+/)[0]);
      value = props.map((p) => `${p} ${dur} ${ease}`).join(', ');
      slot = `semantic.${recipe.trans.duration} + ${recipe.trans.easing}`;
      cls = 'approximated';
      note = note ?? `timing from the motion scale; property list kept from Bootstrap's default`;
    }
    out.push({ v, recipe, value: String(value), cls, slot, note });
  }
  return out;
}

/**
 * The Sass-path component section + the full per-variable coverage walk.
 * Returns { lines, coverage }.
 */
export function componentVariables(light, ctx) {
  const emits = resolveEmits(light, ctx);
  const coverage = [];
  const lines = [
    '// ------------------------------------------------ component tier (AL1.3)',
    '// Bound by meaning per packages/exporter-bootstrap/src/descriptors.js;',
    "// everything not listed here follows Bootstrap's own !default chains from",
    '// the driven roots above (per-variable classification in report.json).',
  ];

  const byFamily = new Map();
  for (const e of emits) {
    if (e.value === undefined) continue; // unbindable (source absent) — coverage row only
    if (!byFamily.has(e.v.family)) byFamily.set(e.v.family, []);
    byFamily.get(e.v.family).push(e);
  }
  for (const family of [...byFamily.keys()].sort()) {
    lines.push(`// ${family}`);
    for (const e of byFamily.get(family)) {
      lines.push(
        `$${e.v.name}: ${e.value};  // ${e.slot}${e.cls === 'approximated' ? ' (approximated)' : ''}`,
      );
    }
  }

  // Coverage: one row per in-inventory variable — the AL3 completeness bar.
  for (const v of INVENTORY.variables) {
    if (v.scope !== 'component') continue;
    const c = coverageForVariable(v);
    const emit = emits.find((e) => e.v.name === v.name);
    if (emit) {
      coverage.push({
        variable: `$${v.name}`,
        slot: emit.slot,
        class: emit.cls,
        ...(emit.note && { note: emit.note }),
      });
    } else if (c.drop) {
      coverage.push({ variable: `$${v.name}`, slot: '—', class: c.drop.cls, note: c.drop.note });
    } else {
      const m = MECH[c.mech];
      coverage.push({
        variable: `$${v.name}`,
        slot: m.slot,
        class: m.class,
        note: c.from ? `${m.note} ${c.from}` : m.note,
      });
    }
  }
  return { lines, coverage };
}

/** Families with structural CSS-var counterparts → the selector Bootstrap sets them on (verified against the 5.3.8 partials). */
const FAMILY_SELECTOR = {
  accordion: '.accordion',
  alert: '.alert',
  badge: '.badge',
  breadcrumb: '.breadcrumb',
  btn: '.btn',
  carousel: '.carousel',
  dropdown: '.dropdown-menu',
  'form-check': '.form-check',
  'form-range': '.form-range',
  'input-group': '.input-group',
  'list-group': '.list-group',
  modal: '.modal',
  nav: '.nav',
  'nav-link': '.nav',
  navbar: '.navbar',
  pagination: '.pagination',
  popover: '.popover',
  progress: '.progress, .progress-stacked',
  spinner: '.spinner-border, .spinner-grow',
  table: '.table',
  toast: '.toast',
  tooltip: '.tooltip',
};

/**
 * Where a specific CSS var is declared on a different selector than its
 * family's root (verified against the partials): Bootstrap's nav-underline
 * vars live on .nav-underline, and $navbar-nav-link-padding-x is interpolated
 * into --bs-nav-link-padding-x on .navbar-nav.
 */
const CSSVAR_SELECTOR = {
  'nav:nav-underline-gap': '.nav-underline',
  'nav:nav-underline-border-width': '.nav-underline',
  'navbar:nav-link-padding-x': '.navbar-nav',
};

/**
 * CSS-path-only extras: $btn-padding-* are chained from the shared
 * $input-btn-* root on the Sass path, but stock-CSS users get the baked
 * defaults — these entries make the component.button.* tokens reach the
 * CSS path directly.
 */
const CSS_EXTRAS = [
  { selector: '.btn', cssVar: 'btn-padding-y', comp: 'button.padding-y' },
  { selector: '.btn', cssVar: 'btn-padding-x', comp: 'button.padding-x' },
];

/**
 * CSS-path structural component blocks (AL1.4): every bound variable that has
 * a direct --bs-* counterpart, emitted selector-scoped so it overrides the
 * value Bootstrap's build baked into the component rule. Returns { lines, coverage }.
 * Where Bootstrap re-declares the same var responsively (--bs-modal-margin),
 * the base declaration wins and the responsive re-set stays Sass-path-only.
 */
export function componentCssBlocks(light, ctx) {
  const emits = resolveEmits(light, ctx).filter(
    (e) => e.value !== undefined && e.v.cssVars.length > 0 && FAMILY_SELECTOR[e.v.family],
  );
  const bySelector = new Map();
  const seen = new Set();
  const push = (sel, cssVar, value, slot) => {
    if (seen.has(`${sel} ${cssVar}`)) return;
    seen.add(`${sel} ${cssVar}`);
    if (!bySelector.has(sel)) bySelector.set(sel, []);
    bySelector.get(sel).push(`  --bs-${cssVar}: ${value};  /* ${slot} */`);
  };
  for (const x of CSS_EXTRAS) {
    const v = light.get(`component.${x.comp}`)?.value; // may be absent — see resolveEmits
    if (v !== undefined) push(x.selector, x.cssVar, v, `component.${x.comp}`);
  }
  for (const e of emits) {
    for (const cssVar of e.v.cssVars) {
      push(
        CSSVAR_SELECTOR[`${e.v.family}:${cssVar}`] ?? FAMILY_SELECTOR[e.v.family],
        cssVar,
        e.value,
        e.slot,
      );
    }
  }
  const lines = [];
  for (const sel of [...bySelector.keys()].sort()) {
    lines.push(`${sel} {`, ...bySelector.get(sel), '}', '');
  }
  const coverage = emits.length
    ? [
        {
          variable: `--bs-* component structure (${seen.size} slots, CSS path)`,
          slot: 'see the per-$variable rows',
          class: 'derived',
          note: 'selector-scoped overrides of the values Bootstrap baked into component rules — reaches part of what F13 said the token tier alone could not',
        },
      ]
    : [];
  return { lines, coverage };
}

/**
 * CSS-path button variant state colors (AL1.4): the N_PARAM promise from the
 * cross-walk — Bootstrap's shade/tint knobs are dropped on the Sass path
 * because the grid's state cells ARE the derived results; here they reach
 * stock-CSS users per variant. `roles` = the exporter's ROLES list; `cell`
 * reads `semantic.color.<role>.<cell>` hexes for one mode.
 */
export function buttonVariantBlocks(roles, cell, rgbTriplet, { darkPrefix = '' } = {}) {
  const lines = [];
  for (const role of roles) {
    const solid = cell(role, 'solid'),
      on = cell(role, 'on-solid');
    const hover = cell(role, 'solid-hover'),
      active = cell(role, 'solid-active');
    if (!solid || !on || !hover || !active) continue;
    lines.push(`${darkPrefix}.btn-${role} {`);
    lines.push(
      `  --bs-btn-color: ${on};  --bs-btn-bg: ${solid};  --bs-btn-border-color: ${solid};`,
    );
    lines.push(
      `  --bs-btn-hover-color: ${on};  --bs-btn-hover-bg: ${hover};  --bs-btn-hover-border-color: ${hover};`,
    );
    lines.push(
      `  --bs-btn-active-color: ${on};  --bs-btn-active-bg: ${active};  --bs-btn-active-border-color: ${active};`,
    );
    lines.push(
      `  --bs-btn-disabled-color: ${on};  --bs-btn-disabled-bg: ${solid};  --bs-btn-disabled-border-color: ${solid};`,
    );
    lines.push(`  --bs-btn-focus-shadow-rgb: ${rgbTriplet(solid)};`);
    lines.push('}');
    // Outline variant: Bootstrap's own semantics (text+border = the role color,
    // fill on hover) — exporter convention: solid/on-solid cells, not the grid's
    // outline cell, which is calibrated for subtle borders, not button text.
    lines.push(`${darkPrefix}.btn-outline-${role} {`);
    lines.push(`  --bs-btn-color: ${solid};  --bs-btn-border-color: ${solid};`);
    lines.push(
      `  --bs-btn-hover-color: ${on};  --bs-btn-hover-bg: ${solid};  --bs-btn-hover-border-color: ${solid};`,
    );
    lines.push(
      `  --bs-btn-active-color: ${on};  --bs-btn-active-bg: ${active};  --bs-btn-active-border-color: ${active};`,
    );
    lines.push(`  --bs-btn-disabled-color: ${solid};  --bs-btn-disabled-border-color: ${solid};`);
    lines.push(`  --bs-btn-focus-shadow-rgb: ${rgbTriplet(solid)};`);
    lines.push('}');
  }
  return lines;
}
