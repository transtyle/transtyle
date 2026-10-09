/**
 * Plugin compatibility: does an exporter's `transtyle` manifest declare the IR
 * spec and plugin API this core provides? (docs/architecture/versioning.md,
 * issue #14, ADR-0011 §2 "range-checking unimplemented".)
 *
 * Each declared field is matched against what core provides:
 * - when core's value is a version (`0.0.0`) and the declared one is a semver
 *   range (`0`, `^0`, `>=0 <2`, `0 || 1`), the version must satisfy the range;
 * - otherwise both are markers compared exactly. The IR spec is one today:
 *   `v0-draft` carries no version number until the freeze, so an exporter
 *   declares `"irSpec": "v0-draft"` and nothing else matches it.
 *
 * Pure: no I/O. `compile()` reports the result (TST1309/TST1310) and
 * `@transtyle/plugin-kit`'s `manifest-compatible` check runs the same function.
 */

import { IR_SPEC } from '@transtyle/ir';
import { parseRange, parseVersion, satisfies } from './semver.js';

/**
 * The plugin API versions this core implements. A list, so that a deprecation
 * window can serve two adjacent majors at once (versioning.md). `0.0.0` is the
 * pre-freeze line: the interface plugins.md documents, `optionsSchema` and the
 * `diagnostics` channel included.
 */
export const PLUGIN_API_VERSIONS = Object.freeze(['0.0.0']);

/** Does a declared manifest value accept what core provides? */
export function declaredMatches(declared, provided) {
  if (parseVersion(provided) && parseRange(declared)) return satisfies(provided, declared);
  return declared === provided;
}

/**
 * Check a `transtyle` manifest against this core.
 * Returns `{ missing, mismatches }`: `missing` lists the fields that could not
 * be checked (`irSpec`, `pluginApi`; both when there is no manifest at all),
 * `mismatches` holds `{ field, declared, provided }` for each field that is
 * declared but doesn't accept what core provides (`provided` is a list).
 */
export function checkPluginCompat(manifest, { irSpec = IR_SPEC, pluginApis = PLUGIN_API_VERSIONS } = {}) {
  const fields = [
    ['irSpec', [irSpec]],
    ['pluginApi', [...pluginApis]],
  ];
  const missing = [];
  const mismatches = [];
  const m = manifest && typeof manifest === 'object' ? manifest : {};
  for (const [field, provided] of fields) {
    const declared = m[field];
    if (typeof declared !== 'string' || declared.trim() === '') missing.push(field);
    else if (!provided.some((p) => declaredMatches(declared, p))) mismatches.push({ field, declared, provided });
  }
  return { missing, mismatches };
}
