/**
 * A tiny, zero-dependency validator for the JSON Schema *subset* Transtyle's
 * own schemas use (docs/specs/configuration.md, audit A7/A8). We do NOT ship a
 * full JSON Schema engine (ajv) — core has zero external dependencies by policy
 * (VISION non-goal / package.json). Instead, the config and report schemas are
 * written in that subset (see config.schema.js / report.schema.js), this walker
 * validates against them, and `scripts/gen-schemas.mjs` publishes the very same
 * objects as real draft-2020-12 files for editors and the website. One source of
 * truth, two consumers — `scripts/check-schemas.mjs` asserts they never diverge.
 *
 * Supported keywords: type, enum, const, required, properties,
 * additionalProperties (boolean | schema), items, minItems, anyOf. That is
 * exactly what our schemas need and no more — extend deliberately.
 */

const typeOf = (v) =>
  v === null ? 'null'
  : Array.isArray(v) ? 'array'
  : typeof v === 'object' ? 'object'
  : typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number')
  : typeof v; // 'string' | 'boolean'

/** integer also satisfies number; everything else is exact. */
function typeMatches(value, type) {
  const actual = typeOf(value);
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => t === actual || (t === 'number' && actual === 'integer'));
}

/**
 * Validate `value` against `schema`. Returns an array of { path, message }
 * (empty = valid). `path` is a dotted JSON path from the document root.
 */
export function validate(value, schema, path = '') {
  const errors = [];
  const push = (p, message) => errors.push({ path: p || '(root)', message });

  if (schema.const !== undefined && value !== schema.const) {
    push(path, `must equal ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.some((e) => e === value)) {
    push(path, `must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}`);
    return errors; // an out-of-enum value fails nothing else usefully
  }
  if (schema.type && !typeMatches(value, schema.type)) {
    push(path, `must be ${Array.isArray(schema.type) ? schema.type.join(' or ') : schema.type}, got ${typeOf(value)}`);
    return errors; // wrong type → downstream keyword checks are noise
  }

  if (schema.anyOf) {
    const branchErrors = schema.anyOf.map((s) => validate(value, s, path));
    if (!branchErrors.some((e) => e.length === 0)) {
      push(path, `does not match any allowed shape`);
    }
  }

  if (typeOf(value) === 'object' && (schema.properties || schema.required || 'additionalProperties' in schema)) {
    for (const key of schema.required ?? []) {
      if (!(key in value)) push(path, `missing required property "${key}"`);
    }
    const props = schema.properties ?? {};
    const addl = schema.additionalProperties;
    for (const [key, v] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if (props[key]) {
        errors.push(...validate(v, props[key], childPath));
      } else if (addl === false) {
        push(childPath, `unknown property "${key}"`);
      } else if (addl && typeof addl === 'object') {
        errors.push(...validate(v, addl, childPath));
      }
    }
  }

  if (typeOf(value) === 'array') {
    if (schema.minItems != null && value.length < schema.minItems) {
      push(path, `must have at least ${schema.minItems} item${schema.minItems === 1 ? '' : 's'}`);
    }
    if (schema.items) {
      value.forEach((item, i) => errors.push(...validate(item, schema.items, `${path}[${i}]`)));
    }
  }

  return errors;
}
