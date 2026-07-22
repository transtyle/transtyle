/**
 * @transtyle/plugin-kit — the executable specification of the exporter interface.
 *
 * plugins.md is prose and drifts; this suite is the contract that doesn't.
 * `conformance(plugin)` runs a plugin against a canonical fixture design system
 * and asserts it honors the real interface: a single `emit(normalizedIR, ctx) →
 * { files, coverage }` hook that is deterministic, pure (never mutates the IR),
 * and honest (every coverage class is one of the five). Passing it is what
 * "official" means and what community exporters advertise.
 *
 * The interface it checks is the one all shipped exporters actually implement
 * (ADR-0011 reconciliation) — not the richer resolve/doc/declarative-mapping
 * design that plugins.md once aspired to and no exporter used.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compile, formatColor, formatHslTriplet, formatHex, contrastRatio, mix } from '@transtyle/core';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixture');
const COVERAGE_CLASSES = new Set(['native', 'derived', 'approximated', 'dropped', 'unsupported']);

// A derivation-only loader — the fixture config declares no targets, so compile
// resolves the IR without ever calling this, but the signature must be present.
const noopLoader = async () => ({ name: 'noop', optionsSchema: { type: 'object' }, emit: () => ({ files: [], coverage: [] }) });

let _irPromise;
/** Resolve the bundled fixture to a normalized IR (cached across calls). */
export async function fixtureIR() {
  if (!_irPromise) {
    _irPromise = compile({ cwd: FIXTURE, targets: [], emit: false, loadExporter: noopLoader })
      .then((r) => r.normalized);
  }
  return _irPromise;
}

/** Build a TargetContext equivalent to the one core passes exporters at emit time. */
function makeCtx() {
  return {
    config: { name: 'conformance-fixture', targets: {} },
    targetConfig: { output: 'dist', options: {} },
    formatColor, formatHslTriplet, formatHex, contrastRatio, mix,
    projectName: 'conformance-fixture',
    siblings: [],
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

/**
 * @param {object} plugin  the exporter's default export ({ name, emit, optionsSchema? })
 * @param {{ manifest?: object, ir?: object }} [opts]  manifest = the package.json `transtyle` key
 * @returns {Promise<{ pass: boolean, checks: Array<{ name, pass, spec, detail? }> }>}
 */
export async function conformance(plugin, opts = {}) {
  const checks = [];
  const add = (name, pass, spec, detail) => checks.push({ name, pass: !!pass, spec, ...(pass ? {} : { detail }) });
  const done = () => ({ pass: checks.every((c) => c.pass), checks });

  add('interface-shape',
    plugin && typeof plugin.name === 'string' && typeof plugin.emit === 'function',
    'plugins.md#the-exporter-interface',
    'default export must be { name: string, emit: function }');
  if (!plugin || typeof plugin.emit !== 'function') return done();

  const ir = opts.ir ?? await fixtureIR();
  const ctx = makeCtx();
  const before = snapshotIR(ir);

  let out1, threw;
  try { out1 = plugin.emit(ir, ctx); } catch (e) { threw = e; }
  add('emit-runs', !threw, 'plugins.md#the-exporter-interface', threw && `emit() threw: ${threw.message}`);
  if (threw) return done();

  add('emit-returns-files',
    Array.isArray(out1.files) && out1.files.every((f) => f && typeof f.path === 'string' && typeof f.contents === 'string' && typeof f.kind === 'string'),
    'plugins.md#the-exporter-interface',
    'emit must return files: { path, contents, kind }[]');

  add('emit-returns-coverage',
    Array.isArray(out1.coverage) && out1.coverage.every((c) => c && typeof c.variable === 'string' && typeof c.slot === 'string' && typeof c.class === 'string'),
    'validation-and-coverage.md',
    'emit must return coverage: { variable, slot, class }[]');

  add('coverage-classes-valid',
    Array.isArray(out1.coverage) && out1.coverage.every((c) => COVERAGE_CLASSES.has(c.class)),
    'docs/specs/validation-and-coverage.md',
    `every coverage.class must be one of ${[...COVERAGE_CLASSES].join(', ')}`);

  const out2 = plugin.emit(ir, ctx);
  add('deterministic',
    JSON.stringify(out1.files) === JSON.stringify(out2.files),
    'plugins.md ("emit must be deterministic")',
    'two emit() runs on the same IR produced different files');

  add('ir-immutable',
    snapshotIR(ir) === before,
    'plugins.md ("exporters receive an immutable IR snapshot")',
    'emit() mutated the IR it was given');

  if (opts.manifest) {
    const m = opts.manifest;
    add('manifest-valid',
      ['exporter', 'importer'].includes(m.kind) && typeof m.name === 'string' && 'irSpec' in m && 'pluginApi' in m && Array.isArray(m.capabilities),
      'plugins.md#packaging',
      'transtyle manifest needs kind (exporter|importer), name, irSpec, pluginApi, capabilities[]');
  }

  if (plugin.optionsSchema) {
    add('options-schema-shape',
      plugin.optionsSchema.type === 'object',
      'audit A8 / R3',
      'optionsSchema must be a JSON-Schema object ({ type: "object", ... })');
  }

  return done();
}
