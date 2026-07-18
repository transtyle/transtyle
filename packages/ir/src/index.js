/**
 * @transtyle/ir — IR constants and token-tree helpers.
 * Walking-skeleton implementation of docs/architecture/ir.md (IR spec v0 draft).
 */

export const IR_SPEC = 'v0-draft';

/** Semantic color roles (each a scale: base, hover, active, subtle, contrast). */
export const COLOR_ROLES = [
  'primary', 'secondary', 'accent',
  'success', 'warning', 'danger', 'info', 'neutral',
];

/** Surface slots (F2: overlay = floating layers; scrim = dimming veil). */
export const SURFACES = ['background', 'surface', 'surface-raised', 'overlay', 'scrim'];

/** Provenance kinds. */
export const PROVENANCE = {
  AUTHORED: 'authored',
  ALIASED: 'aliased',
  DERIVED: 'derived',
  DEFAULTED: 'defaulted',
};

/** Coverage classes (docs/specs/validation-and-coverage.md). */
export const COVERAGE = ['native', 'derived', 'approximated', 'dropped', 'unsupported'];

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

/** Deep-merge token trees (later wins; conflicts reported via onConflict(path)). */
export function mergeTrees(trees, onConflict = () => {}) {
  const merged = {};
  const mergeInto = (dst, src, path) => {
    for (const [key, val] of Object.entries(src)) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && !('$value' in val)) {
        if (!(key in dst)) dst[key] = {};
        else if ('$value' in dst[key]) { onConflict([...path, key].join('.')); dst[key] = {}; }
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
