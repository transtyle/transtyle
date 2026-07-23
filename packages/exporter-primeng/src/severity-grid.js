/**
 * The generic severity-grid mapper (docs/proposals/0002-component-theming-primeng.md
 * §2.4, §5.2; docs/plan/component-tier.md C3/C4). One function, applied against
 * a per-component *shape* descriptor — not a per-component value table.
 *
 * PrimeNG's `variant x severity x state x part` grid is isomorphic to the
 * catalog's `prominence x role x state x cell` role grid (verified against
 * Button's source, proposal 0002 §2.4). This function resolves that grid's
 * values; it deliberately does NOT decide how a component nests them, because
 * C4 verified (against real source, not assumption) that PrimeNG itself
 * nests inconsistently: Button is `colorScheme.<variant>.<severity>.<part>`
 * (variant-major), but Message is `colorScheme.<severity>.<variant>.<part>`
 * (severity-major, e.g. `colorScheme.info.outlined.color`). Forcing one tree
 * shape here would misrepresent real PrimeNG output — instead this returns a
 * flat, addressable set of resolved values; each component's own builder
 * (descriptors.js) reads from it and nests however that component really does.
 *
 * `contrast` is not a real Transtyle role (proposal 0002 gap #3) — it always
 * reads the same two fixed cells regardless of which grid cell a part asks
 * for: background/border-ish parts get `neutral.text-strong` (the near-black/
 * near-white extreme), color-ish parts get `elevation.0.surface` (the page
 * background) — both already correct per-mode with no special-casing needed
 * beyond this one mapping.
 */

const SEVERITY_ROLE = {
  primary: 'primary',
  secondary: 'secondary',
  success: 'success',
  info: 'info',
  warn: 'warning',
  danger: 'danger',
};
export const SEVERITIES = [...Object.keys(SEVERITY_ROLE), 'contrast'];
const BG_CELLS = new Set([
  'solid',
  'solid-hover',
  'solid-active',
  'tint',
  'tint-hover',
  'tint-active',
  'outline',
  'outline-hover',
]);

function resolveCell(map, severity, cellSuffix) {
  if (severity === 'contrast') {
    const path = BG_CELLS.has(cellSuffix)
      ? 'semantic.color.neutral.text-strong'
      : 'semantic.color.elevation.0.surface';
    return { value: map.get(path)?.value, slot: path };
  }
  const role = SEVERITY_ROLE[severity];
  if (!role) return { value: undefined };
  const slot = `semantic.color.${role}.${cellSuffix}`;
  return { value: map.get(slot)?.value, slot };
}

/**
 * @param map the normalized per-mode token map
 * @param variants [{ name: string, parts: { fieldName: gridCellSuffix } }] — one
 *   entry per PrimeNG variant this component exposes (`root`, `outlined`, `text`,
 *   `filled`, `simple`, ... — whatever the real source names them).
 * @param severities which PrimeNG severity keys to resolve (default: all 7)
 * @returns { get(variantName, severity, field), coverage } — `get` returns the
 *   resolved value or `undefined`; the caller nests results into its own tree.
 */
export function mapSeverityGrid(map, { variants, severities = SEVERITIES }) {
  const coverage = [];
  const resolved = new Map(); // "variant|severity|field" -> value

  for (const variant of variants) {
    for (const severity of severities) {
      for (const [field, cellSuffix] of Object.entries(variant.parts)) {
        const { value, slot } = resolveCell(map, severity, cellSuffix);
        if (value === undefined) continue;
        resolved.set(`${variant.name}|${severity}|${field}`, value);
        coverage.push({ variable: `${variant.name}.${severity}.${field}`, slot, class: 'native' });
      }
    }
  }

  return {
    get: (variantName, severity, field) => resolved.get(`${variantName}|${severity}|${field}`),
    coverage,
  };
}
