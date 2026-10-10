/**
 * @transtyle/plugin-kit — the executable specification of the exporter interface.
 *
 * plugins.md is prose and drifts; this suite is the contract that doesn't.
 * `conformance(plugin)` runs a plugin against a set of fixture design systems
 * and asserts it honors the real interface: a single `emit(normalizedIR, ctx) →
 * { files, coverage, diagnostics? }` hook that is deterministic, pure (never mutates the IR),
 * and honest (every coverage class is one of the five, no coverage claim for a
 * slot that has no value, no mode dimension ignored in silence, no JavaScript
 * value leaked into a file). Passing it is what "official" means and what
 * community exporters advertise.
 *
 * The interface it checks is the one all shipped exporters actually implement
 * (ADR-0011 reconciliation) — not the richer resolve/doc/declarative-mapping
 * design that plugins.md once aspired to and no exporter used.
 *
 * Why several fixtures (#96): one full, light/dark design system hides every
 * bug that only a sparse or differently-shaped one shows. A one-token system
 * crashed Bootstrap (#23), object-form dimensions leaked `[object Object]`
 * into four targets (#24), an authored shadow wrote `NaN` (#26): all under a
 * green kit, because its only fixture had none of those shapes.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compile, checkExporterDiagnostics, checkPluginCompat, parseRange, customTokens, makeUnits, formatColor, formatHslTriplet, formatHex, contrastRatio, mix } from '@transtyle/core';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const COVERAGE_CLASSES = new Set(['native', 'derived', 'approximated', 'dropped', 'unsupported']);

/**
 * The fixture design systems, in the order `conformance()` runs them. Each is a
 * plain DTCG project under `fixtures/<name>/` (a `transtyle.config.json` and
 * `tokens/`), compiled by the real loader, so a plugin author can open it.
 * `spec` is the rule the fixture exists to enforce.
 */
export const FIXTURES = Object.freeze([
  {
    name: 'canonical',
    exercises: 'a brand color, light and dark, elevation, text, border, fonts; radius, a duration and an easing in DTCG structured form',
    spec: 'plugins.md#the-exporter-interface',
  },
  {
    name: 'one-token',
    exercises: 'only `semantic.color.primary.solid`, the one token the engine cannot invent; everything else is derived or absent',
    spec: 'validation-and-coverage.md#coverage-report (a missing slot is a row, not a crash)',
  },
  {
    name: 'three-token',
    exercises: 'brand, page background and text, with dark values; no radius, spacing or fonts',
    spec: 'validation-and-coverage.md#coverage-report (absence is not coverage)',
  },
  {
    name: 'two-dimension',
    exercises: '`color-scheme` × `density`, with `space.4` authored differently under `density: compact`',
    spec: 'ir.md#modes, validation-and-coverage.md#coverage-report (`dropped` for a mode the target cannot express)',
    // Values authored only under `density: compact`, as written and in px: one
    // of them in a file, or a `(mode:density)` dropped row, accounts for it.
    marks: { density: ['0.8125rem', '13px'] },
  },
  {
    name: 'single-mode',
    exercises: '`color-scheme` with `light` only: no `dark` map exists',
    spec: 'ir.md#modes',
  },
  {
    name: 'component-tier',
    exercises: 'authored `component.control.radius`, `component.button.radius` (an alias to a derived slot), `component.button.padding-x`, `component.tooltip.max-width`',
    spec: 'ir.md#the-three-tier-token-model',
  },
  {
    name: 'custom-role',
    exercises: 'a custom `promo` role joining the grid through `$extensions.transtyle.role` (archetype `brand`)',
    spec: 'ir.md#color-the-role-grid',
  },
  {
    name: 'custom-vocabulary',
    exercises: 'custom `semantic.*` tokens outside the catalog: a color the brand binds to `primary.solid`, an unbound color, a dimension and a shadow',
    spec: 'validation-and-coverage.md#custom-vocabulary (an open-vocabulary exporter carries every one or says why)',
  },
  {
    name: 'composites',
    exercises: 'authored shadow (per-mode, stacked with `inset`, aliased), border, transition and typography composites',
    spec: 'ir.md#values-and-canonicalization',
  },
  {
    name: 'object-form',
    exercises: 'colors (srgb with a hex, oklch, display-p3 outside sRGB), dimension, duration, cubicBezier, fontWeight and typography members in DTCG structured form, and a fontFamily array, under two dimensions',
    spec: 'ir.md#values-and-canonicalization (structured forms compile byte-identical to the string form, a fontFamily array to the one-string CSS list)',
    // Same design system authored with CSS strings: the plugin must not be
    // able to tell them apart.
    twin: 'object-form-twin',
  },
]);
const FIXTURE_NAMES = FIXTURES.map((f) => f.name);

/**
 * JavaScript values that leaked into a file. `undefined`/`null`/`NaN` as a
 * whole word on the value side of a declaration (after `:`, `=` or `=>`), so a
 * comment mentioning "undefined" is not one; and the two that hide inside a
 * value, where that rule cannot see them: `oklch(NaN NaN NaN)` (a color
 * function fed a string) and `[object Object]` (an object stringified whole).
 * Neither ever appears in legitimate output or prose. `check:minimal-ds` uses
 * the same two patterns.
 */
export const LEAK = /(:|=>?)\s*(undefined|null|NaN)\b/;
export const LEAK_INSIDE = /\bNaN\b|\[object Object\]/;
const leaks = (line) => LEAK.test(line) || LEAK_INSIDE.test(line);

// A derivation-only loader — fixture configs declare no targets, so compile
// resolves the IR without ever calling this, but the signature must be present.
const noopLoader = async () => ({ name: 'noop', optionsSchema: { type: 'object' }, emit: () => ({ files: [], coverage: [] }) });

const cache = new Map();
/** Compile a fixture (or a fixture's twin) once: `{ ir, config }`. */
function loadFixture(name) {
  const known = FIXTURE_NAMES.includes(name) || FIXTURES.some((f) => f.twin === name);
  if (!known) return Promise.reject(new Error(`Unknown plugin-kit fixture "${name}" (available: ${FIXTURE_NAMES.join(', ')})`));
  if (!cache.has(name)) {
    cache.set(name, compile({ cwd: join(FIXTURES_DIR, name), targets: [], emit: false, loadExporter: noopLoader }).then((r) => {
      if (r.diagnostics.errors.length) {
        throw new Error(`plugin-kit fixture "${name}" does not compile: ${r.diagnostics.errors.map((d) => `${d.code} ${d.message}`).join('; ')}`);
      }
      return { ir: r.normalized, config: r.config };
    }));
  }
  return cache.get(name);
}

/** Resolve a bundled fixture to a normalized IR (cached across calls). Defaults to `canonical`. */
export async function fixtureIR(name = 'canonical') {
  return (await loadFixture(name)).ir;
}

/** Build a TargetContext equivalent to the one core passes exporters at emit time. */
function makeCtx(config, ir, options = {}) {
  return {
    config,
    targetConfig: { output: 'dist', options },
    units: makeUnits(config),
    formatColor, formatHslTriplet, formatHex, contrastRatio, mix,
    projectName: config.name ?? 'design-system',
    siblings: [],
    customTokens: customTokens(ir),
    targetVersion: null,
    targetProfile: null,
  };
}

/** Values-and-provenance snapshot of the IR, for the mutation check + equality. */
function snapshotIR(ir) {
  const out = {};
  for (const [mode, map] of Object.entries(ir.modes)) {
    out[mode] = {};
    for (const [slot, entry] of map) out[mode][slot] = { value: entry.value, kind: entry.provenance?.kind };
  }
  return JSON.stringify(out);
}

/** Which fixtures a `fixtures` option selects. */
function selectFixtures(fixtures = 'all') {
  if (fixtures === 'all') return FIXTURES;
  const names = typeof fixtures === 'string' ? [fixtures] : fixtures;
  if (!Array.isArray(names)) throw new TypeError('conformance(): `fixtures` is "all", a fixture name, or an array of names');
  const unknown = names.filter((n) => !FIXTURE_NAMES.includes(n));
  if (unknown.length) throw new Error(`Unknown plugin-kit fixture(s): ${unknown.join(', ')} (available: ${FIXTURE_NAMES.join(', ')})`);
  return FIXTURES.filter((f) => names.includes(f.name));
}

const list = (items, max = 3) => items.slice(0, max).join('; ') + (items.length > max ? `; … ${items.length - max} more` : '');

/**
 * @param {object} plugin  the exporter's default export ({ name, emit, optionsSchema? })
 * @param {{ manifest?: object, fixtures?: 'all' | string | string[], ir?: object }} [opts]
 *   manifest = the package.json `transtyle` key; fixtures = which bundled
 *   fixtures to run (default every one; `'canonical'` is the opt-out to the
 *   original single fixture); ir = your own normalized IR, run instead of the
 *   fixtures (reported as fixture `custom`)
 * @returns {Promise<{ pass: boolean, checks: Array<{ name, pass, spec, fixture?, detail? }> }>}
 */
export async function conformance(plugin, opts = {}) {
  const checks = [];
  const add = (name, pass, spec, detail, fixture) =>
    checks.push({ name, pass: !!pass, spec, ...(fixture ? { fixture } : {}), ...(pass ? {} : { detail }) });
  const done = () => ({ pass: checks.every((c) => c.pass), checks });

  add('interface-shape',
    plugin && typeof plugin.name === 'string' && typeof plugin.emit === 'function',
    'plugins.md#the-exporter-interface',
    'default export must be { name: string, emit: function }');
  if (!plugin || typeof plugin.emit !== 'function') return done();

  if (opts.manifest) {
    const m = opts.manifest;
    add('manifest-valid',
      ['exporter', 'importer'].includes(m.kind) && typeof m.name === 'string' && 'irSpec' in m && 'pluginApi' in m && Array.isArray(m.capabilities),
      'plugins.md#packaging',
      'transtyle manifest needs kind (exporter|importer), name, irSpec, pluginApi, capabilities[]');
    // The check core runs at load time (TST1309): a wrong marker fails the
    // author's CI here before any user's build refuses the exporter.
    const { missing, mismatches } = checkPluginCompat(m);
    add('manifest-compatible',
      missing.length === 0 && mismatches.length === 0,
      'versioning.md, plugins.md#packaging',
      [
        ...mismatches.map(({ field, declared, provided }) => `${field} "${declared}" does not accept ${provided.map((v) => `"${v}"`).join(', ')}, what this @transtyle/core provides`),
        ...missing.map((field) => `${field} is missing or not a string`),
      ].join('; '));
    // Version profiles (ADR-0006): core matches a target's requested version
    // against these ranges, so one it can't parse (an era name, a prerelease)
    // would never match and every `version` would fail with TST1313.
    const targets = m.targets;
    const badRanges = targets === undefined ? []
      : !targets || typeof targets !== 'object' || Array.isArray(targets) ? ['targets must be an object of { <framework>: [<range>, …] }']
        : Object.entries(targets).flatMap(([fw, ranges]) => (Array.isArray(ranges) && ranges.length > 0
          ? ranges.filter((r) => parseRange(r) === null).map((r) => `${fw}: ${JSON.stringify(r)} is not a version range`)
          : [`${fw}: must be a non-empty array of version ranges`]));
    add('manifest-targets-ranges',
      badRanges.length === 0,
      'versioning.md#target-framework-versions-adr-0006',
      `${list(badRanges)} (ranges use node-semver syntax without prerelease tags: "*", ">=5.3 <6", "^4", "1 - 2", "3 || 4")`);
  }

  if (plugin.optionsSchema) {
    add('options-schema-shape',
      plugin.optionsSchema.type === 'object',
      'audit A8 / R3',
      'optionsSchema must be a JSON-Schema object ({ type: "object", ... })');
  }

  // `openVocabulary: true` says the target has a place for any `semantic.*`
  // token, so a design system's custom tokens are written, not dropped; it
  // comes with the `customTokens: "emit" | "omit"` option (issue #51).
  if (plugin.openVocabulary !== undefined) {
    const option = plugin.optionsSchema?.properties?.customTokens;
    add('open-vocabulary-shape',
      plugin.openVocabulary === false
        || (plugin.openVocabulary === true && Array.isArray(option?.enum) && option.enum.includes('emit') && option.enum.includes('omit')),
      'plugins.md#open-vocabulary-targets',
      'openVocabulary must be a boolean; an exporter that sets it to true declares a `customTokens` option with the values "emit" and "omit"');
  }

  if (opts.ir) {
    runFixture(plugin, { ir: opts.ir, config: { name: 'conformance-fixture', targets: {} } }, { name: 'custom' }, null, add);
    return done();
  }
  for (const fixture of selectFixtures(opts.fixtures)) {
    const twin = fixture.twin ? await loadFixture(fixture.twin) : null;
    runFixture(plugin, await loadFixture(fixture.name), fixture, twin, add);
  }
  return done();
}

/** Every per-IR check, against one fixture. */
function runFixture(plugin, { ir, config }, fixture, twin, addCheck) {
  const add = (name, pass, spec, detail) => addCheck(name, pass, spec, detail, fixture.name);
  const ctx = makeCtx(config, ir);
  const before = snapshotIR(ir);

  let out1, threw;
  try { out1 = plugin.emit(ir, ctx); } catch (e) { threw = e; }
  add('emit-runs', !threw, 'plugins.md#the-exporter-interface', threw && `emit() threw: ${threw.message}`);
  if (threw) return;

  const filesOk = Array.isArray(out1?.files) && out1.files.every((f) => f && typeof f.path === 'string' && typeof f.contents === 'string' && typeof f.kind === 'string');
  add('emit-returns-files', filesOk,
    'plugins.md#the-exporter-interface',
    'emit must return files: { path, contents, kind }[]');

  const coverageOk = Array.isArray(out1?.coverage) && out1.coverage.every((c) => c && typeof c.variable === 'string' && typeof c.slot === 'string' && typeof c.class === 'string');
  add('emit-returns-coverage', coverageOk,
    'validation-and-coverage.md',
    'emit must return coverage: { variable, slot, class }[]');

  add('coverage-classes-valid',
    Array.isArray(out1?.coverage) && out1.coverage.every((c) => COVERAGE_CLASSES.has(c?.class)),
    'docs/specs/validation-and-coverage.md',
    `every coverage.class must be one of ${[...COVERAGE_CLASSES].join(', ')}`);

  // Optional: `diagnostics` ({ severity: info|warning, code, message, hint? }[])
  // for what a target's own conventions do to a value. Core rejects a malformed
  // list as TST3001, so the harness fails it here first.
  if (out1?.diagnostics !== undefined) {
    let bad;
    try { checkExporterDiagnostics(out1.diagnostics); } catch (e) { bad = e.message; }
    add('emit-diagnostics-valid', !bad, 'plugins.md#the-exporter-interface', bad);
  }

  let out2;
  try { out2 = plugin.emit(ir, ctx); } catch (e) { out2 = { files: `threw: ${e.message}` }; }
  add('deterministic',
    JSON.stringify(out1?.files) === JSON.stringify(out2?.files)
      && JSON.stringify(out1?.diagnostics) === JSON.stringify(out2?.diagnostics),
    'plugins.md ("emit must be deterministic")',
    'two emit() runs on the same IR produced different files or diagnostics');

  add('ir-immutable',
    snapshotIR(ir) === before,
    'plugins.md ("exporters receive an immutable IR snapshot")',
    'emit() mutated the IR it was given');

  if (!filesOk || !coverageOk) return;
  const { files, coverage } = out1;

  const empty = files.filter((f) => !f.contents.trim()).map((f) => f.path);
  add('files-non-empty', !empty.length,
    'plugins.md#the-exporter-interface',
    `emitted empty file(s): ${list(empty)}`);

  const leaked = files.flatMap((f) =>
    f.contents.split('\n').flatMap((line, i) => (leaks(line) ? [`${f.path}:${i + 1} ${line.trim()}`] : [])));
  add('no-leaked-values', !leaked.length,
    'plugins.md ("no JavaScript value in output")',
    `a JavaScript value (undefined, null, NaN, [object Object]) leaked into output: ${list(leaked)}`);

  // Only rows whose `slot` is one complete IR path are checkable: many carry a
  // summary label instead (`semantic.color.primary.*`, a target's own
  // namespace). Those are skipped rather than guessed at.
  const map = ir.modes[ir.defaultMode];
  const unresolved = coverage
    .filter((c) => ['native', 'derived'].includes(c.class) && /^(semantic|component|option)\.[\w.-]+$/.test(c.slot) && map?.get(c.slot)?.value === undefined)
    .map((c) => `${c.variable} <- ${c.slot} (${c.class})`);
  add('coverage-honest', !unresolved.length,
    'validation-and-coverage.md#coverage-report ("absence is not coverage")',
    `coverage rows claim a slot that does not resolve: ${list(unresolved)}`);

  // The optional structured fields a reverse lookup reads (`transtyle explain
  // --variable`): `slots` must name paths of the IR the exporter was given,
  // and `via` other rows' variables. A label (`slot`) stays free prose.
  const strings = (v) => v === undefined || (Array.isArray(v) && v.every((x) => typeof x === 'string'));
  add('coverage-fields-shape',
    coverage.every((c) => strings(c.slots) && strings(c.via)),
    'docs/specs/validation-and-coverage.md#structured-fields-slots-and-via',
    'coverage slots and via must be string arrays when present');
  const irKeys = new Set();
  for (const m of Object.values(ir.modes)) if (m instanceof Map) for (const k of m.keys()) irKeys.add(k);
  const unknownSlots = [...new Set(coverage.flatMap((c) => (Array.isArray(c.slots) ? c.slots : [])).filter((s) => !irKeys.has(s)))];
  add('coverage-slots-exist', !unknownSlots.length,
    'docs/specs/validation-and-coverage.md#structured-fields-slots-and-via',
    `coverage slots name paths that are not in the IR: ${list(unknownSlots)}`);

  // Custom vocabulary (issue #51): an open-vocabulary exporter names every
  // custom token in a row, native when it writes it or with the reason it
  // can't; with `customTokens: "omit"` none of them is written. A closed-set
  // exporter has nothing to do (core accounts for the tokens after emit).
  if (plugin.openVocabulary === true && ctx.customTokens.length > 0) {
    const named = new Set(coverage.flatMap((c) => (Array.isArray(c.slots) ? c.slots : [c.slot])));
    const silent = ctx.customTokens.filter((t) => !named.has(t));
    add('custom-vocabulary-carried', !silent.length,
      'docs/specs/validation-and-coverage.md#custom-vocabulary',
      `open-vocabulary exporter says nothing about custom token(s): ${list(silent)}`);
    let omitted;
    try { omitted = plugin.emit(ir, makeCtx(config, ir, { customTokens: 'omit' })).coverage; } catch (e) { omitted = null; }
    const written = (omitted ?? [])
      .filter((c) => ['native', 'derived', 'approximated'].includes(c.class))
      .flatMap((c) => (Array.isArray(c.slots) ? c.slots : [c.slot]))
      .filter((s) => ctx.customTokens.includes(s));
    add('custom-vocabulary-omit', Array.isArray(omitted) && !written.length,
      'docs/specs/validation-and-coverage.md#custom-vocabulary',
      omitted ? `customTokens: "omit" still writes: ${list([...new Set(written)])}` : 'emit() threw with customTokens: "omit"');
  }

  if (fixture.marks) {
    const silent = Object.entries(fixture.marks)
      .filter(([dim]) => ir.dimensionNames?.includes(dim))
      .filter(([dim, marks]) =>
        !coverage.some((c) => c.class === 'dropped' && c.variable === `(mode:${dim})`)
        && !files.some((f) => marks.some((m) => f.contents.includes(m))))
      .map(([dim, marks]) => `${dim} (neither its value ${marks.join(' / ')} in a file nor a \`(mode:${dim})\` dropped row)`);
    add('mode-dimensions-accounted', !silent.length,
      'validation-and-coverage.md#coverage-report (`dropped` for a mode the target cannot express)',
      `mode dimension ignored in silence: ${list(silent)}`);
  }

  if (twin) {
    let twinFiles;
    try { twinFiles = plugin.emit(twin.ir, makeCtx(twin.config, twin.ir)).files; } catch (e) { twinFiles = []; }
    const differ = files
      .filter((f) => twinFiles?.find?.((g) => g.path === f.path)?.contents !== f.contents)
      .map((f) => f.path);
    add('structured-values-as-strings', !differ.length,
      'ir.md#values-and-canonicalization',
      `output differs from the same design system authored with CSS strings: ${list(differ)}`);
  }
}
