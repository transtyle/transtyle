/**
 * @transtyle/core — public programmatic API (docs/architecture/overview.md:
 * "core is a library first, CLI second").
 */

import path from 'node:path';
import { commitOutputs } from './emit.js';
import { loadConfig, loadTokenTrees } from './load.js';
import { validate } from './schema/validate.js';
import { configSchema } from './schema/config.schema.js';
import { expandBindings } from './bindings.js';
import { normalize, resolveDeferredAliases, reportModeCarryOver, reportTierViolations } from './normalize.js';
import { reportDeprecatedReach, withMetadata, withDeprecatedSection } from './metadata.js';
import { derive, reportUnderived } from './derive.js';
import { runChecks } from './checks.js';
import { loadContrast, checkStandard, APCA_PACKAGE } from './contrast.js';
import { Diagnostics } from './diagnostics.js';
import { fillLocations } from './locations.js';
import { nearestName } from './nearest.js';
import { makeUnits } from './units.js';
import { validateTargetModes, targetView, narrowedDimensions, withModesNote } from './target-modes.js';
import { recordingView } from './reads.js';
import { formatColor, formatHslTriplet, formatHex, contrastRatio, mix } from './color.js';
import { checkPluginCompat, PLUGIN_API_VERSIONS } from './compat.js';
import { IR_SPEC } from '@transtyle/ir';
import { completenessStatus, COMPLETENESS_REQUIRE_PREFIX } from './completeness.js';

export { parseColor, formatColor, formatHslTriplet, formatHex, contrastRatio, mix } from './color.js';
export { Diagnostics } from './diagnostics.js';
export { makeUnits, DEFAULT_REM_BASE } from './units.js';
export { diffResolved, contrastRegressions } from './diff.js';
export { loadContrast, loadApca, CONTRAST_STANDARDS, APCA_LEVELS, APCA_BASE_ALGORITHM } from './contrast.js';
export { explainToken, explainVariable, slotConsumers, coverageSlots } from './explain.js';
export { deprecationsReached } from './metadata.js';
export { catalog } from './catalog.js';
export { loadConfig, expandTokenFiles } from './load.js';
export { migrateStyleDictionary, needsStyleDictionaryMigration, STYLE_DICTIONARY_NAMESPACE } from './migrate-style-dictionary.js';
export { consumption } from './reads.js';
export { completenessStatus, completenessLevels, COMPLETENESS_LEVELS, DEFAULT_COMPLETENESS_LEVEL } from './completeness.js';
export { expandBindings, BINDING_PLACEHOLDERS } from './bindings.js';
export { checkPluginCompat, PLUGIN_API_VERSIONS } from './compat.js';
export { suggestBindings, SUGGEST_THRESHOLDS } from './suggest.js';
export { SYNONYMS_VERSION } from './synonyms.js';

/**
 * Run the pipeline. `emit: false` = `transtyle check` (pipeline minus EMIT —
 * same code path by design, docs/architecture/pipeline.md).
 */
/**
 * `skipExporters: true` stops after the shared pipeline stages: no exporter is
 * loaded or run (`explain` only walks provenance, so a broken exporter must not
 * be able to fail it). `debug: true` keeps a crashed exporter's stack on its
 * TST3001/TST3002 diagnostic (the CLI sets it from `--verbose` or TRANSTYLE_DEBUG).
 *
 * `outRoot` (`build --out`): an absolute directory that replaces every target's
 * configured `output`: target `<name>` goes to `<outRoot>/<name>`. It is applied
 * where the output is written *and* in `ctx.siblings` / `ctx.targetConfig.output`,
 * the project-relative paths exporters (Storybook) build their imports from.
 * `dryRun` (`build --dry-run`) runs EMIT up to the staged file list and stops
 * before the commit: nothing is written, `results[].files` is empty and
 * `results[].planned` lists what would have been (same data as a real build).
 *
 * `knownExporters` (AL5) is the caller's list of exporter names it can resolve —
 * the CLI's OFFICIAL_EXPORTERS keys. Core stays exporter-agnostic (it never
 * imports one), but TST1301 can then tell "you typo'd" apart from "that
 * exporter exists, you just haven't configured it", which are opposite fixes.
 *
 * `loadExporter(name)` returns the plugin (`{ name, emit, optionsSchema? }`),
 * or `{ plugin, manifest, package: { name, version } }` when the caller found
 * the exporter's package.json: `manifest` is its `transtyle` key (`null` when
 * it has none), checked against this core's IR spec and plugin API (TST1309,
 * TST1310). A bare plugin means the caller doesn't know the manifest, and
 * nothing is checked.
 *
 * `apcaLoader` (optional) is an async function returning `{ lib, version }`,
 * `lib` being the `apca-w3` module: for an integration that bundles it rather
 * than resolving it from the project. Without it, compile() imports `apca-w3`
 * itself when the config selects APCA.
 *
 * The result's `contrast` is the check standard's measure (contrast.js); pass
 * it to `contrastRegressions` so `diff` measures with the same standard.
 */
export async function compile({ cwd, targets, emit = true, loadExporter, knownExporters = [], skipExporters = false, debug = false, outRoot, dryRun = false, apcaLoader }) {
  const diagnostics = new Diagnostics();
  const { config } = await loadConfig(cwd);

  // Config schema validation (audit A8): a typo'd or mis-typed config key is an
  // error, not a silently-ignored field. Fail before touching tokens — a broken
  // config shape would only produce misleading downstream diagnostics.
  for (const { path: p, message } of validate(config, configSchema)) {
    diagnostics.error('TST1010', `transtyle.config.json: ${p === '(root)' ? '' : p + ' '}${message}`);
  }
  if (diagnostics.errors.length > 0) {
    return { config, diagnostics, results: [], normalized: null, bindings: null, contrast: null };
  }

  // The contrast standard (contrast.js): WCAG 2.1 is built in; APCA comes from
  // the `apca-w3` package the project installs (ADR-0013). A config asking for
  // APCA without it is an error: checking under another standard than the one
  // asked for would report a pass nobody measured.
  let contrast;
  try {
    contrast = await loadContrast(config, cwd, { importer: apcaLoader });
  } catch (e) {
    const which = checkStandard(config) === 'apca' ? 'check.contrast.standard' : 'derivation.contrast';
    diagnostics.error('TST1013', `${which} is "apca", but the ${APCA_PACKAGE} package could not be loaded (${e.message})`, {
      hint: `APCA is an optional peer dependency: npm install --save-dev ${APCA_PACKAGE} in this project, or set ${which} back to a WCAG value.`,
    });
    return { config, diagnostics, results: [], normalized: null, bindings: null, contrast: null };
  }

  // LOAD + NORMALIZE + DERIVE (shared across targets)
  const trees = await loadTokenTrees(cwd, config.tokens, diagnostics);
  // `bindings` rules become one more base layer of plain aliases, after every
  // token file: an authored token or alias already there wins over a rule
  // (bindings.js), so this layer never overrides anything.
  const bindings = expandBindings(trees, config, diagnostics);
  if (bindings && bindings.aliases.length > 0) {
    trees.push({ file: 'transtyle.config.json (bindings)', tree: bindings.tree, modeScope: undefined, bindingRules: bindings.rules });
  }
  const normalized = normalize(trees, config, diagnostics);
  const { underived } = derive(normalized, config, diagnostics, contrast.derive);
  // Authored aliases pointing at slots DERIVE materializes (e.g. a component
  // token aliasing `{semantic.radius.full}`) resolve here — see normalize.js.
  resolveDeferredAliases(normalized, diagnostics);

  // TST1113: a semantic token aliasing a component token (wrong direction).
  // Judged here because only now does every alias, deferred ones included,
  // carry its final provenance.
  reportTierViolations(normalized, diagnostics);

  // TST1122: a catalog slot still reaching a `$deprecated` token. Same reason
  // to wait for this point: only now does every alias, deferred ones
  // included, carry the target its chain is walked through.
  reportDeprecatedReach(normalized, diagnostics);

  // TST1205 (an alias DERIVE read before its target existed, so what it feeds
  // was skipped) is judged here, not in DERIVE: only now is it known whether
  // the alias resolved in the end. A dangling or looping one already has its
  // TST1105/TST1104 and stays silent. See reportUnderived.
  reportUnderived(normalized, underived, diagnostics);

  // TST1204 (cross-mode carry-over) can only be judged once every alias has a
  // value: the slot's own text is identical in both modes when the per-mode
  // value lives on the alias target, which is exactly how the binding-layer
  // adoption pattern works. See reportModeCarryOver.
  reportModeCarryOver(normalized, config, diagnostics);

  // The engine's one non-negotiable input (AL5 — see derive.js for why it moved
  // here). Checked after every alias has had its chance to resolve, and only
  // when nothing upstream already explains the absence: a dangling alias or an
  // unparseable color makes this token missing as a *consequence*, and reporting
  // both sends the user to fix the symptom.
  const primaryMissing = Object.values(normalized.modes).some(
    (m) => m.get('semantic.color.primary.solid')?.value === undefined,
  );
  const upstream = ['TST1002', 'TST1104', 'TST1105', 'TST1106', 'TST1307'].some((c) => diagnostics.has(c));
  if (primaryMissing && !upstream) {
    diagnostics.error(
      'TST1201',
      'semantic.color.primary.solid is not authored — it is the one token the derivation engine cannot invent.',
      {
        // The old text blamed `config derivation.require`, which most configs
        // (including `transtyle init`'s own scaffold) never set. It is an engine
        // invariant, not a consequence of configuration.
        path: 'semantic.color.primary.solid',
        hint: 'Author it as `semantic.color.primary.solid` (your brand color). A bare `semantic.color.primary` is a different path — the role grid anchors on the `.solid` cell.',
      },
    );
  }

  runChecks(normalized, config, diagnostics, contrast.check);

  // derivation.require: listed slots must be authored (or aliased: a binding is
  // a choice too), not derived, defaulted or absent. Color roles require their
  // `.solid` anchor cell (the role grid's authored anchor, was `.base`
  // pre-revision); other requires (e.g. radius.md) are bare paths.
  // `completeness:<level>` expands to that level's items (completeness.js),
  // per-scheme ones included.
  const defaultMap = normalized.modes[normalized.defaultMode];
  for (const req of config.derivation?.require ?? []) {
    if (req.startsWith(COMPLETENESS_REQUIRE_PREFIX)) {
      const level = req.slice(COMPLETENESS_REQUIRE_PREFIX.length);
      for (const item of completenessStatus(normalized, level).todo) {
        diagnostics.error(
          'TST1202',
          `Required token is not authored${item.mode ? ` for ${item.mode}` : ''}: ${item.slot} (${item.state}; required by ${req})`,
          { path: item.slot, hint: `\`transtyle check --completeness ${level}\` lists every item still to author, and why each one matters.` },
        );
      }
      continue;
    }
    const entry = defaultMap.has(`${req}.solid`) ? defaultMap.get(`${req}.solid`) : defaultMap.get(req);
    // A token that is there but resolved to nothing (a dangling alias) already
    // has its own error (TST1105); it counts by its provenance, as before.
    const kind = entry?.provenance.kind;
    if (kind !== 'authored' && kind !== 'aliased') {
      diagnostics.error('TST1202', `Required token is not authored: ${req}${kind ? ` (${kind})` : ''}`, { path: req });
    }
  }

  const units = makeUnits(config);

  // Source locations first (so the suppressed list carries them too), then
  // `check.suppress`: every diagnostic that can
  // exist before the target loop exists now (exporters never emit diagnostics
  // of this kind), so one pass serves every target's report.
  fillLocations(diagnostics.items, normalized.sources);
  diagnostics.applySuppressions(config.check?.suppress);

  const targetNames = skipExporters ? [] : targets?.length ? targets : Object.keys(config.targets ?? {});
  const results = [];
  // Exporter crashes (TST3001/TST3002) and incompatible exporters (TST1309) are
  // recorded per target and must not trip the "never emit with errors present"
  // guards below: they are not pipeline errors, and stopping at the first one
  // would hide every later target. The commit below still writes nothing.
  let crashes = 0;
  const pipelineErrors = () => diagnostics.errors.length - crashes;
  const crash = (code, name, stage, e, hint) => {
    const cause = e instanceof Error ? e : new Error(String(e));
    diagnostics.error(code, `Exporter "${name}" crashed in ${stage}: ${cause.message}`, {
      target: name,
      hint,
      ...(debug && cause.stack ? { stack: cause.stack } : {}),
    });
    crashes++;
  };
  const plans = [];

  // Per-target mode subsets (`targets.<t>.modes`, TST1308) are checked for every
  // requested target before anything is written, so one bad subset emits nothing.
  for (const name of targetNames) {
    const subset = config.targets?.[name]?.modes;
    if (subset) validateTargetModes(name, subset, normalized.dimensions, diagnostics);
  }

  for (const name of targetNames) {
    const targetConfig = config.targets?.[name];
    if (!targetConfig) {
      // AL5: two different mistakes reached the same dead-end message. A typo
      // needs the near name; a correctly-spelled exporter that simply isn't in
      // this config needs to be told to add it. Neither is "check instance
      // names" with the names withheld.
      const configured = Object.keys(config.targets ?? {});
      const near = nearestName(name, configured);
      const known = knownExporters.includes(name);
      diagnostics.error(
        'TST1301',
        `Target "${name}" is not configured in transtyle.config.json`,
        {
          hint: near
            ? `Did you mean "${near}"? Configured targets: ${configured.join(', ') || '(none)'}`
            : known
              ? `"${name}" is a known exporter but this config doesn't use it — add it under "targets" with an "output" directory.`
              : `Configured targets: ${configured.join(', ') || '(none)'}`,
        },
      );
      continue;
    }
    if (pipelineErrors() > 0) break; // never emit with errors present

    // Target instances: the config key is the instance name; `exporter` selects
    // the plugin (defaults to the key), so one exporter can be configured twice
    // with different options (docs/specs/configuration.md#target-instances).
    let exporter;
    let loaded;
    try {
      loaded = await loadExporter(targetConfig.exporter ?? name);
    } catch (e) {
      crash('TST3002', name, 'load', e, 'Install the exporter package in this project, or fix its `exporter` field in transtyle.config.json. Re-run with --verbose (or TRANSTYLE_DEBUG=1) for the stack.');
      results.push({ target: name, files: [], coverage: [], emitted: [], reads: [] });
      continue;
    }
    const withManifest = loaded && typeof loaded.emit !== 'function' && 'plugin' in loaded;
    exporter = withManifest ? loaded.plugin : loaded;

    // Compatibility (issue #14): an exporter built for another IR spec or
    // plugin API is refused before its options schema or emit is trusted.
    if (withManifest && loaded.manifest !== undefined) {
      const incompatible = reportCompat(name, loaded, diagnostics);
      if (incompatible > 0) {
        crashes += incompatible;
        results.push({ target: name, files: [], coverage: [], emitted: [], reads: [] });
        continue;
      }
    }

    // Validate this instance's options against the exporter's own schema (audit
    // A8): unknown or mis-typed options are errors. Exporters without options
    // reject any options object; exporters with options declare `optionsSchema`.
    if (targetConfig.options !== undefined) {
      const schema = exporter.optionsSchema ?? { type: 'object', additionalProperties: false };
      for (const { path: p, message } of validate(targetConfig.options, schema)) {
        diagnostics.error('TST1011', `target "${name}" options: ${p === '(root)' ? '' : p + ' '}${message}`);
      }
    }
    if (pipelineErrors() > 0) break; // don't emit with invalid options

    // RESOLVE + EMIT: exporter returns file descriptions; only core touches the filesystem.
    const rel = (p) => path.relative(cwd, p).split(path.sep).join('/') || '.';
    const outputOf = (n, t) => (outRoot ? rel(path.resolve(outRoot, n)) : t.output ?? `dist/${n}`);
    const ctx = {
      config, units,
      targetConfig: outRoot ? { ...targetConfig, output: outputOf(name, targetConfig) } : targetConfig, formatColor, formatHslTriplet, formatHex, contrastRatio, mix,
      projectName: config.name ?? 'design-system',
      // Sibling-target manifest (docs/specs/exporters/storybook.md#composition):
      // name, exporter, and output dir of every configured target — never their
      // resolutions. Lets composition-capable exporters reference sibling
      // ARTIFACT PATHS, keeping the no-cross-target-coupling invariant.
      siblings: Object.entries(config.targets ?? {}).map(([n, t]) => ({
        name: n, exporter: t.exporter ?? n, output: outputOf(n, t),
      })),
    };
    // Exporters see only the target's declared slice of the matrix (derivation and
    // checks above already ran once on the full one); a deliberate exclusion is
    // not a loss, so it gets no `dropped` coverage row.
    const view = targetConfig.modes ? targetView(normalized, targetConfig.modes) : normalized;
    const narrowed = targetConfig.modes ? narrowedDimensions(normalized, view) : new Set();
    // The exporter gets a recording copy of its view (src/reads.js): `reads`
    // lists the catalog slots it looked up while emitting.
    const recording = recordingView(view);
    let files, coverage, notes, reads;
    try {
      ({ files, coverage, diagnostics: notes = [] } = exporter.emit(recording.view, ctx));
      checkExporterDiagnostics(notes);
      reads = recording.reads();
    } catch (e) {
      // Only the exporter's own code is wrapped: file-system errors below are
      // not exporter bugs and keep failing loudly.
      crash('TST3001', name, 'emit', e, debug
        ? 'This is a bug in the exporter, not in your design system. The stack is above.'
        : 'This is a bug in the exporter, not in your design system. Re-run with --verbose (or TRANSTYLE_DEBUG=1) for the stack.');
      files = [];
      coverage = [];
      notes = [];
      reads = [];
    }
    // Exporter diagnostics (optional `diagnostics` in emit's return value): what
    // a target's own conventions do to a value, which only the exporter knows.
    // The message is prefixed with the instance name, so two instances of one
    // exporter report separately and `report.json` (which lists every
    // diagnostic of the run) says which target each line is about.
    for (const d of notes) {
      const context = { target: name, ...(d.hint !== undefined ? { hint: d.hint } : {}) };
      if (d.severity === 'warning') diagnostics.warn(d.code, `${name}: ${d.message}`, context);
      else diagnostics.info(d.code, `${name}: ${d.message}`, context);
    }
    // Deprecated tokens still feeding this target (#30), listed in its
    // usage.md by core so every exporter, third-party ones included, gets it.
    const viewDefault = view.modes[view.defaultMode];
    files = files.map((f) => (f.path === 'usage.md' ? { ...f, contents: withDeprecatedSection(f.contents, coverage, viewDefault) } : f));
    if (targetConfig.modes) {
      files = files.map((f) => (f.path === 'usage.md' ? { ...f, contents: withModesNote(f.contents, name, view) } : f));
      coverage = coverage.filter((c) => !(c.class === 'dropped' && [...narrowed].some((d) => c.variable === `(mode:${d})`)));
    }

    const outDir = outRoot ? path.resolve(outRoot, name) : path.resolve(cwd, targetConfig.output ?? `dist/${name}`);
    const written = [];
    const planned = [];
    if (emit) {
      // Build manifest + machine-readable report (docs/specs/validation-and-coverage.md).
      // Nothing is written here: every target is collected first and the whole
      // build is committed atomically below (src/emit.js).
      const staged = files.map((f) => ({ path: f.path, contents: f.contents }));
      for (const f of files) written.push(path.relative(cwd, path.join(outDir, f.path)));
      const report = buildReport(name, targetConfig, withMetadata(coverage, viewDefault), reads, diagnostics, [...written]);
      staged.push({ path: 'report.json', contents: JSON.stringify(report, null, 2) + '\n' });
      written.push(path.relative(cwd, path.join(outDir, 'report.json')));
      staged.forEach((f, i) => planned.push({ path: written[i], bytes: Buffer.byteLength(f.contents, 'utf8') }));
      plans.push({ outDir, files: staged });
    }
    // `emitted` carries the file *specs* (path + contents) even when emit is
    // off — `transtyle diff` re-emits both sides in-memory to compute per-target
    // impact without writing anything. `files` stays the written paths.
    // `reads` is what `consumption()` (src/reads.js) builds the slot matrix from.
    results.push({ target: name, files: dryRun ? [] : written, planned, outDir, exporter: targetConfig.exporter ?? name, coverage, emitted: files, reads });
  }

  // EMIT commit: all exporters have run. Nothing is written if any error-level
  // diagnostic was raised (including by a later target), and a write failure
  // rolls every output directory back to its previous state.
  if (plans.length > 0) {
    if (diagnostics.errors.length > 0) {
      for (const r of results) { r.files = []; r.planned = []; }
    } else if (!dryRun) {
      await commitOutputs(plans);
    }
  }

  return { config, diagnostics, results, normalized, bindings, contrast: contrast.check };
}

/**
 * TST1309 for each manifest field that doesn't accept this core, TST1310 when
 * the manifest is missing or leaves a field out. Returns the number of errors.
 */
function reportCompat(name, { manifest, package: pkg }, diagnostics) {
  const pkgName = pkg?.name ?? `the "${name}" exporter`;
  const label = pkg?.name ? `${pkg.name}${pkg.version ? ` ${pkg.version}` : ''}` : 'unknown package';
  const { missing, mismatches } = checkPluginCompat(manifest);
  for (const { field, declared, provided } of mismatches) {
    const quoted = provided.map((v) => `"${v}"`).join(', ');
    if (field === 'irSpec') {
      diagnostics.error('TST1309', `Exporter "${name}" (${label}) is built for IR spec "${declared}"; this @transtyle/core produces ${quoted}`, {
        target: name,
        hint: `Use a release of ${pkgName} built for IR spec ${quoted}, or a @transtyle/core release that produces "${declared}".`,
      });
    } else {
      diagnostics.error('TST1309', `Exporter "${name}" (${label}) requires plugin API "${declared}"; this @transtyle/core implements ${quoted}`, {
        target: name,
        hint: `Use a release of ${pkgName} whose "pluginApi" accepts ${quoted}, or a @transtyle/core release that implements "${declared}".`,
      });
    }
  }
  if (missing.length > 0) {
    const what = manifest == null
      ? 'has no "transtyle" manifest in its package.json'
      : `declares no ${missing.map((f) => `"${f}"`).join(' or ')} in its "transtyle" manifest`;
    diagnostics.warn('TST1310', `Exporter "${name}" (${label}) ${what}, so its compatibility with this @transtyle/core was not checked`, {
      target: name,
      hint: `The exporter's package.json should declare "transtyle": { "irSpec": "${IR_SPEC}", "pluginApi": "${PLUGIN_API_VERSIONS[0].split('.')[0]}", … } (see the "Write an exporter" guide).`,
    });
  }
  return mismatches.length;
}

const EXPORTER_SEVERITIES = ['info', 'warning'];

/**
 * An exporter's `diagnostics` must be `{ severity, code, message, hint? }[]`
 * with severity `info` or `warning`: an exporter cannot stop the build from
 * inside emit (a throw is TST3001). A malformed entry is an exporter bug, so it
 * throws here and is reported as TST3001 like any other contract violation.
 */
export function checkExporterDiagnostics(list) {
  if (!Array.isArray(list)) throw new Error('emit() returned a `diagnostics` field that is not an array');
  list.forEach((d, i) => {
    const at = `emit() returned an invalid diagnostics[${i}]`;
    if (!d || typeof d !== 'object') throw new Error(`${at}: not an object`);
    if (!EXPORTER_SEVERITIES.includes(d.severity)) throw new Error(`${at}: severity must be "info" or "warning", got ${JSON.stringify(d.severity)}`);
    if (typeof d.code !== 'string' || !d.code) throw new Error(`${at}: code must be a non-empty string`);
    if (typeof d.message !== 'string' || !d.message) throw new Error(`${at}: message must be a non-empty string`);
    if (d.hint !== undefined && typeof d.hint !== 'string') throw new Error(`${at}: hint must be a string when present`);
  });
}

function buildReport(target, targetConfig, coverage, reads, diagnostics, files) {
  const counts = {};
  for (const item of coverage) counts[item.class] = (counts[item.class] ?? 0) + 1;
  return {
    $schema: 'https://transtyle.dev/schemas/report/v0.json',
    target,
    options: targetConfig.options ?? {},
    generatedBy: 'transtyle 0.1.0 (walking skeleton)',
    coverage: { counts, items: coverage },
    reads,
    diagnostics: diagnostics.items,
    suppressed: diagnostics.suppressed,
    files,
  };
}
