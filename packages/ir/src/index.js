/**
 * @transtyle/ir — IR constants and token-tree helpers.
 * Walking-skeleton implementation of docs/architecture/ir.md (IR spec v0 draft).
 */

export const IR_SPEC = 'v0-draft';

/**
 * Semantic color roles. Each carries the full role grid (docs/architecture/ir.md
 * #color-the-role-grid, proposal 0001): prominence (solid/tint/outline/text) x
 * interaction state (rest/hover/active/selected) + on-colors.
 */
export const COLOR_ROLES = [
  'primary',
  'secondary',
  'accent',
  'success',
  'warning',
  'danger',
  'info',
  'neutral',
];

/** Valid values for `$extensions.transtyle.role.archetype` (docs/architecture/ir.md §archetypes). */
export const ROLE_ARCHETYPES = ['brand', 'status', 'neutral'];

/** Grid cell suffixes appended to `semantic.color.<role>.`, in derivation order. */
export const GRID_CELLS = [
  'solid',
  'solid-hover',
  'solid-active',
  'solid-selected',
  'tint',
  'tint-hover',
  'tint-active',
  'tint-selected',
  'outline',
  'outline-hover',
  'on-solid',
  'on-tint',
  'text',
  'text-hover',
  'text-active',
  'text-strong',
];

/** Content hierarchy rungs under `semantic.color.text.<rung>` (docs/architecture/ir.md). */
export const TEXT_RUNGS = ['strong', 'base', 'muted', 'subtle', 'disabled', 'inverse'];

/** Elevation ladder: surfaces at levels 0-5, shadows at levels 1-4 (F2: scrim stays separate). */
export const ELEVATION_LEVELS = [0, 1, 2, 3, 4, 5];
export const SHADOW_LEVELS = [1, 2, 3, 4];

/** z-index ladder — key order is the contract; values are catalog defaults unless authored. */
export const Z_LADDER = [
  'hide',
  'base',
  'dropdown',
  'sticky',
  'banner',
  'overlay',
  'modal',
  'popover',
  'toast',
  'tooltip',
];

/** Provenance kinds. */
export const PROVENANCE = {
  AUTHORED: 'authored',
  ALIASED: 'aliased',
  DERIVED: 'derived',
  DEFAULTED: 'defaulted',
};

/** Coverage classes (docs/specs/validation-and-coverage.md). */
export const COVERAGE = ['native', 'derived', 'approximated', 'dropped', 'unsupported'];

/**
 * One `dropped` coverage entry per configured mode dimension an exporter
 * doesn't express (docs/architecture/ir.md#modes: "Exporters declare which
 * mode dimensions they can express; inexpressible dimensions surface in the
 * coverage report"). No-op (empty array) when the compile only has the
 * dimensions the exporter already expresses — e.g. a color-scheme-only
 * compile never gets a spurious "density dropped" line.
 */
export function droppedDimensions(dimensionNames, expressed) {
  return (dimensionNames ?? [])
    .filter((d) => !expressed.includes(d))
    .map((d) => ({
      variable: `(mode:${d})`,
      slot: '—',
      class: 'dropped',
      note: `${d} mode dimension not expressed by this target`,
    }));
}

/**
 * Component tier (docs/plan/component-tier.md C2; docs/specs/component-layer.md;
 * generalized by AL2 — docs/proposals/0003-component-catalog-generalization.md).
 * Per component, per token: `defaultFrom` is a bare `semantic.*` path the token
 * aliases when unauthored, or `component:<path>` to default from another
 * component slot. Either way an empty `component.*` tier still compiles,
 * exactly like every other resolve-or-fill slot in the catalog.
 *
 * `control` is the shared **interactive-control** geometry — the one component
 * grouping both reference component-heavy targets converge on *architecturally*,
 * not just nominally: Bootstrap chains `$btn-padding-*` from the shared
 * `$input-btn-padding-*` root, and PrimeNG's Button reads the same `formField`
 * object its inputs do. Buttons then layer on top (authoring `control.*` moves
 * both; authoring `button.*` moves only buttons) — the two-level model both
 * upstreams already implement. Order matters: entries may only `component:`
 * -default from an EARLIER entry in this object.
 *
 * `defaultFrom` is optional. A slot without one exists **only when authored** —
 * appropriate when the meaning is real and shared but no semantic rung expresses
 * it, so inventing a default would mean picking one target's number. That is the
 * case for `tooltip.max-width` below.
 *
 * Deliberately NOT here (evidence passes, see the proposals): the sm/lg size
 * ladder (both targets have one, but they disagree on which rungs — the
 * disagreement is the finding), nav/list/table item padding (correspondence is
 * nominal, not architectural), and — after the 0004 geometry probe — component
 * sizing generally: of ten geometry concepts Bootstrap tokenizes, six are
 * one-sided or false friends and two more disagree architecturally. Exporters
 * derive all of those privately today.
 */
export const COMPONENT_CATALOG = {
  control: {
    radius: { type: 'dimension', defaultFrom: 'radius.control' },
    'padding-x': { type: 'dimension', defaultFrom: 'space.4' },
    'padding-y': { type: 'dimension', defaultFrom: 'space.2' },
  },
  button: {
    radius: { type: 'dimension', defaultFrom: 'component:control.radius' },
    'padding-x': { type: 'dimension', defaultFrom: 'component:control.padding-x' },
    'padding-y': { type: 'dimension', defaultFrom: 'component:control.padding-y' },
  },
  /**
   * The overlay measure (proposal 0004). Promoted on the strongest evidence the
   * two-target bar has seen: Bootstrap (`$tooltip-max-width: 200px`) and PrimeNG
   * (`tooltip.root.maxWidth: 12.5rem` — *the same 200px*) independently constrain
   * the same element the same way at the same measure, and PrimeNG carries only
   * two `maxWidth` slots in its entire 2759-slot surface. Two libraries agreeing
   * that this specific element is the one needing a width ceiling, rather than
   * two libraries incidentally having numbers.
   *
   * The decision underneath is typographic — a tooltip is a short line of text
   * and ~200px is roughly a readable measure — which is a design-system opinion,
   * exactly what belongs in a design-system vocabulary.
   *
   * No `defaultFrom`: the IR has no "readable measure" rung, and synthesizing one
   * from either target's number would be inventing catalog vocabulary on one
   * upstream's authority. Unauthored, both exporters keep their own default.
   */
  tooltip: {
    'max-width': { type: 'dimension' },
  },
};

/** Reserved mode dimension names (docs/architecture/ir.md §reserved-mode-dimensions) — names only, every dimension stays optional. */
export const RESERVED_MODE_DIMENSIONS = [
  'color-scheme',
  'density',
  'contrast',
  'motion',
  'platform',
];

/**
 * Combine one value per mode dimension into the compound key used to address
 * a compiled mode combo (docs/plan/catalog-revision.md T8) — `["color-scheme",
 * "density"], {"color-scheme":"dark","density":"compact"}` -> `"dark+compact"`.
 * Order is `dimNames`, not object insertion, so both directions of the
 * key<->values mapping are deterministic across the compile.
 */
export function comboKey(dimNames, values) {
  return dimNames.map((d) => values[d]).join('+');
}

/**
 * The full cross-product of every configured mode dimension's values, in
 * dimension-declaration order. `dimEntries` is `Object.entries(config.modes)`.
 * Returns `[{ key, values: {dimName: value} }, ...]`.
 */
export function expandModeMatrix(dimEntries) {
  const dimNames = dimEntries.map(([name]) => name);
  let combos = [{}];
  for (const [name, def] of dimEntries) {
    const next = [];
    for (const combo of combos) for (const v of def.values) next.push({ ...combo, [name]: v });
    combos = next;
  }
  return combos.map((values) => ({ key: comboKey(dimNames, values), values }));
}

const ALIAS_RE = /^\{([^}]+)\}$/;

/** If `value` is a DTCG alias like "{option.color.blue.600}", return the path; else null. */
export function aliasTarget(value) {
  if (typeof value !== 'string') return null;
  const m = ALIAS_RE.exec(value.trim());
  return m ? m[1] : null;
}

/**
 * Collect tokens from a merged DTCG(-superset) tree.
 * Returns Map<path, { type, value, modeValues: {dimension: {modeName: value}} }>.
 * Handles group-level $type inheritance and the transtyle.modes extension.
 */
export function collectTokens(tree) {
  const out = new Map();
  const walk = (node, path, inheritedType) => {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return;
    const type = node.$type ?? inheritedType;
    if ('$value' in node) {
      const modeValues = node.$extensions?.['transtyle.modes'] ?? {};
      out.set(path.join('.'), { type, value: node.$value, modeValues });
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$')) continue;
      walk(child, [...path, key], type);
    }
  };
  walk(tree, [], undefined);
  return out;
}

/**
 * Custom color roles opting into the full grid via `$extensions.transtyle.role`
 * on a `semantic.color.<name>` group (docs/architecture/ir.md §archetypes,
 * plan task T7) — e.g. `{ "solid": {...}, "$extensions": { "transtyle.role":
 * { "archetype": "status" } } }`. Built-in roles are excluded (they don't need
 * the extension). Returns Map<roleName, archetype>.
 */
export function collectRoleArchetypes(tree, diagnostics) {
  const out = new Map();
  const colorRoot = tree?.semantic?.color;
  if (!colorRoot || typeof colorRoot !== 'object') return out;
  for (const [name, node] of Object.entries(colorRoot)) {
    if (name.startsWith('$') || COLOR_ROLES.includes(name)) continue;
    const archetype = node?.$extensions?.['transtyle.role']?.archetype;
    if (!archetype) continue;
    if (!ROLE_ARCHETYPES.includes(archetype)) {
      diagnostics?.warn(
        'TST1111',
        `semantic.color.${name}: unknown role archetype "${archetype}" (expected one of ${ROLE_ARCHETYPES.join(', ')}) — role still joins the grid`,
      );
    }
    out.set(name, archetype);
  }
  return out;
}

/** Deep-merge token trees (later wins; conflicts reported via onConflict(path)). */
export function mergeTrees(trees, onConflict = () => {}) {
  const merged = {};
  const mergeInto = (dst, src, path) => {
    for (const [key, val] of Object.entries(src)) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && !('$value' in val)) {
        if (!(key in dst)) dst[key] = {};
        else if ('$value' in dst[key]) {
          onConflict([...path, key].join('.'));
          dst[key] = {};
        }
        mergeInto(dst[key], val, [...path, key]);
      } else {
        if (key in dst && !key.startsWith('$')) onConflict([...path, key].join('.'));
        dst[key] = val;
      }
    }
  };
  for (const t of trees) mergeInto(merged, t, []);
  return merged;
}
