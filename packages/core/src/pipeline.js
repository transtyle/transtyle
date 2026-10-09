/**
 * The pipeline without a filesystem: `compileProject()` runs LOAD (from an
 * in-memory project, project.js) → NORMALIZE → DERIVE → RESOLVE → EMIT → REPORT
 * and returns every target's files, `report.json` included, without writing
 * anything (docs/architecture/pipeline.md). Nothing here imports from Node:
 * `compile()` (index.js) is this plus load.js before it and emit.js after it,
 * and the browser entry (browser.js) is this alone.
 */

import { validate } from './schema/validate.js';
import { configSchema } from './schema/config.schema.js';
import { expandBindings } from './bindings.js';
import { normalize, resolveDeferredAliases, reportModeCarryOver, reportTierViolations } from './normalize.js';
import { reportDeprecatedReach, withDeprecatedSection } from './metadata.js';
import { derive, reportUnderived } from './derive.js';
import { runChecks } from './checks.js';
import { contrastFor, checkStandard, needsApca, APCA_PACKAGE } from './contrast.js';
import { checkFalseFriends } from './adoption.js';
import { Diagnostics } from './diagnostics.js';
import { fillLocations } from './locations.js';
import { nearestName } from './nearest.js';
import { makeUnits } from './units.js';
import { validateTargetModes, targetView, narrowedDimensions, withModesNote } from './target-modes.js';
import { recordingView } from './reads.js';
import { customTokens, accountCustomTokens, withCustomVocabularyNote } from './custom.js';
import { coverageSlots } from './explain.js';
import { buildReport } from './report.js';
import { formatColor, formatHslTriplet, formatHex, contrastRatio, mix } from './color.js';
import { checkPluginCompat, PLUGIN_API_VERSIONS } from './compat.js';
import { validateMapping, unknownMappingModes, unknownMappingSlots } from './declarative.js';
import { declaredProfiles, selectProfile } from './profiles.js';
import { IR_SPEC } from '@transtyle/ir';
import { completenessStatus, COMPLETENESS_REQUIRE_PREFIX } from './completeness.js';
import { readTokenTrees, toFileMap, projectPath } from './project.js';

/**
 * Compile a project held in memory.
 *
 * - `config`: the parsed `transtyle.config.json`, or the merged config of an
 *   `extends` chain (`mergeConfigChain()` on the main entry): `extends` itself
 *   is a file path, so it is followed on disk (`loadProject()`, `compile()`),
 *   and a config that still has one is refused.
 * - `files`: the token files, `{ 'tokens/option.tokens.json': <JSON text or object>, … }`
 *   (or a `Map`), keyed by their path relative to the project root. `config.tokens`
 *   is expanded against these keys exactly as against a directory. Text gets
 *   source locations on its diagnostics; an object is used as is, without them.
 * - `exporters`: `{ name: exporter }`, the exporters this run may use (the
 *   default export of each `@transtyle/exporter-*` package). Its keys are also
 *   the known names TST1301 suggests. Or pass `loadExporter(name)` (async) and
 *   `knownExporters`, as `compile()` does. Either gives the plugin
 *   (`{ name, emit, optionsSchema? }`), or `{ plugin, manifest, package: { name,
 *   version } }` when the caller found the exporter's package.json: `manifest`
 *   is its `transtyle` key (`null` when it has none), checked against this
 *   core's IR spec and plugin API (TST1309, TST1310). A bare plugin means the
 *   caller doesn't know the manifest, and nothing is checked.
 * - `apcaLoader`: an async function returning `{ lib, version }` (`lib` the
 *   `apca-w3` module), called only when the config selects APCA. Without it,
 *   such a config gets TST1013. `compile()` passes one that loads the package
 *   from the project.
 * - `targets`, `skipExporters`, `debug`, `outRoot`: as for `compile()`. `outRoot`
 *   (absolute, or relative to the project) replaces every target's `output` with
 *   `<outRoot>/<name>`, which is what the exporters and `report.json` see too.
 * - `root`: optional, the absolute directory the project stands for. It only
 *   words TST1001's hint and turns an absolute `output` into a project-relative
 *   path in `report.json`; the disk path passes its project directory.
 * - `configChain`: the config file names, root base first, as `report.json`
 *   lists them (default `['transtyle.config.json']`). The last one names the
 *   config in diagnostics. With more than one, `origins` (`mergeConfigChain()`'s)
 *   lets TST1001, `bindings` and `check.suppress` messages name the file and
 *   the entry the user wrote rather than the merged one.
 * - `checkOutputs`: optional, an async function called once, after the shared
 *   checks and before the first exporter runs, with the names of the targets
 *   this run is for; it returns diagnostics (`{ severity, code, message, …context }`)
 *   to add there, so `check.suppress` applies to them and every `report.json`
 *   lists them. `compile()` passes one that compares each output directory
 *   with the manifest its last build wrote (TST1312, manifest.js).
 * - `reports`: `false` leaves `report.json` out of every target's files, for a
 *   caller that will not read it: `compile()` with `emit: false` (`check`,
 *   `explain`, `diff`). Serialising eleven reports is a fifth of a
 *   10,000-token compile (check:perf).
 *
 * Returns `{ config, diagnostics, normalized, bindings, contrast, results }`
 * (`contrast`: the check standard's measure, for `contrastRegressions`), with one
 * result per target that ran: `{ target, exporter, output, files, coverage, reads, customVocabulary? }`
 * (`reads`: the catalog slots the exporter looked up, src/reads.js;
 * `customVocabulary`: the custom-vocabulary summary, custom.js, when the design
 * system has custom `semantic.*` tokens).
 * `output` is the target's output directory as configured (or under `outRoot`); `files` is everything that
 * goes in it, `{ path, contents }` relative to it, in emission order, with
 * `report.json` always last (unless `reports: false`). A target whose exporter
 * could not be loaded (TST3002) or is incompatible (TST1309) never ran: it has
 * no files and `skipped: true`. Nothing is filtered on errors: the caller decides
 * whether a run with errors is written (`compile()` writes none).
 */
export async function compileProject({
  config,
  files = {},
  exporters,
  loadExporter,
  knownExporters = Object.keys(exporters ?? {}),
  targets,
  skipExporters = false,
  debug = false,
  outRoot,
  apcaLoader,
  root,
  configChain = ['transtyle.config.json'],
  origins,
  checkOutputs,
  reports: withReports = true,
}) {
  if (typeof config?.extends === 'string') {
    throw new Error(`Config error: compileProject() takes a merged config, and this one still "extends" ${config.extends}: load it with loadProject() or merge the chain with mergeConfigChain() first`);
  }
  if (!config?.tokens?.length) throw new Error('Config error: "tokens" must list at least one glob.');
  const diagnostics = new Diagnostics();
  const leafName = configChain[configChain.length - 1];
  const chained = configChain.length > 1 && origins !== undefined;

  // Config schema validation (audit A8): a typo'd or mis-typed config key is an
  // error, not a silently-ignored field. Fail before touching tokens — a broken
  // config shape would only produce misleading downstream diagnostics.
  for (const { path: p, message } of validate(config, configSchema)) {
    diagnostics.error('TST1010', `${leafName}: ${p === '(root)' ? '' : p + ' '}${message}`);
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
    let apca = null;
    if (needsApca(config)) {
      if (!apcaLoader) throw new Error('no apcaLoader was passed to compileProject()');
      apca = await apcaLoader();
    }
    contrast = contrastFor(config, apca);
  } catch (e) {
    const which = checkStandard(config) === 'apca' ? 'check.contrast.standard' : 'derivation.contrast';
    diagnostics.error('TST1013', `${which} is "apca", but the ${APCA_PACKAGE} package could not be loaded (${e.message})`, {
      hint: `APCA is an optional peer dependency: npm install --save-dev ${APCA_PACKAGE} in this project, or set ${which} back to a WCAG value.`,
    });
    return { config, diagnostics, results: [], normalized: null, bindings: null, contrast: null };
  }

  // LOAD + NORMALIZE + DERIVE (shared across targets)
  const trees = readTokenTrees(toFileMap(files), config.tokens, diagnostics, root, config, chained ? origins.tokens : []);
  // `bindings` rules become one more base layer of plain aliases, after every
  // token file: an authored token or alias already there wins over a rule
  // (bindings.js), so this layer never overrides anything.
  const bindings = expandBindings(trees, config, diagnostics, chained ? ruleLabels(origins.bindings, leafName, 'bindings') : undefined);
  if (bindings && bindings.aliases.length > 0) {
    trees.push({ file: `${leafName} (bindings)`, tree: bindings.tree, modeScope: undefined, bindingRules: bindings.rules });
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
  // TST1124: a binding that reads a slot's word with another ecosystem's meaning.
  checkFalseFriends(normalized, diagnostics);

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

  const load = loadExporter ?? (async (name) => {
    if (exporters && Object.hasOwn(exporters, name)) return exporters[name];
    throw new Error(`no exporter named "${name}" was passed in \`exporters\``);
  });
  const targetNames = skipExporters ? [] : targets?.length ? targets : Object.keys(config.targets ?? {});

  // What the caller checks outside the pipeline before anything is emitted
  // (compile(): drift, TST1312). Added here, before `check.suppress` is applied
  // after the loop, so it can be silenced, and even when an error stops the
  // build below.
  for (const { severity, code, message, ...context } of (await checkOutputs?.(targetNames)) ?? []) {
    if (severity === 'error') diagnostics.error(code, message, context);
    else if (severity === 'warning') diagnostics.warn(code, message, context);
    else diagnostics.info(code, message, context);
  }

  const results = [];
  const reports = [];
  // Exporter crashes (TST3001/TST3002) and incompatible exporters (TST1309) are
  // recorded per target and must not trip the "never emit with errors present"
  // guards below: they are not pipeline errors, and stopping at the first one
  // would hide every later target. The caller still writes nothing.
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

  // Per-target mode subsets (`targets.<t>.modes`, TST1308) are checked for every
  // requested target before anything is emitted, so one bad subset emits nothing.
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
        `Target "${name}" is not configured in ${leafName}${configChain.length > 1 ? ' or a config it extends' : ''}`,
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

    // `outRoot` (`build --out`) moves every target, for the exporters too:
    // Storybook builds its imports from its own and its siblings' outputs.
    const outputOf = (n, t) => (outRoot ? projectPath(outRoot, n, root) || '.' : t.output ?? `dist/${n}`);
    const output = outputOf(name, targetConfig);
    const exporterName = targetConfig.exporter ?? name;

    // Target instances: the config key is the instance name; `exporter` selects
    // the plugin (defaults to the key), so one exporter can be configured twice
    // with different options (docs/specs/configuration.md#target-instances).
    let exporter;
    let loaded;
    try {
      loaded = await load(exporterName);
    } catch (e) {
      crash('TST3002', name, 'load', e, `Install the exporter package in this project, or fix its \`exporter\` field in ${leafName}. Re-run with --verbose (or TRANSTYLE_DEBUG=1) for the stack.`);
      results.push({ target: name, exporter: exporterName, output, files: [], coverage: [], reads: [], skipped: true });
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
        results.push({ target: name, exporter: exporterName, output, files: [], coverage: [], reads: [], skipped: true });
        continue;
      }
    }

    // A declarative exporter (#82) is a mapping, checked like config is: a
    // malformed table (TST1014) or a row naming no slot this IR or the catalog
    // knows (TST1015) is refused before its emit runs.
    if (exporter?.declarative) {
      const invalid = reportMapping(name, exporter.declarative, normalized, diagnostics);
      if (invalid > 0) {
        crashes += invalid;
        results.push({ target: name, exporter: exporterName, output, files: [], coverage: [], reads: [], skipped: true });
        continue;
      }
    }

    // Version profiles (#83, ADR-0006): a requested framework version selects
    // the manifest range covering it; one outside every range is TST1313.
    const requested = targetConfig.version ?? null;
    const declared = withManifest ? declaredProfiles(loaded.manifest, name) : null;
    if (requested !== null) {
      const label = withManifest && loaded.package?.name ? `${loaded.package.name}${loaded.package.version ? ` ${loaded.package.version}` : ''}` : `the "${exporterName}" exporter`;
      const outside = declared && selectProfile(declared.ranges, requested) === null;
      if (!declared) {
        diagnostics.error('TST1313', `Target "${name}" asks for version ${requested}, but ${label} declares no version ranges in its "transtyle" manifest`, {
          target: name,
          hint: `Remove "version" from targets.${name}, or use an exporter whose manifest lists the framework versions it supports ("targets": { "<framework>": [">=1 <2"] }).`,
        });
      } else if (outside) {
        diagnostics.error('TST1313', `Target "${name}" asks for ${declared.framework} ${requested}, outside every range ${label} supports: ${declared.ranges.join(', ')}`, {
          target: name,
          hint: `Pick a version in ${declared.ranges.map((r) => `"${r}"`).join(' or ')} for targets.${name}.version, or use a release of the exporter that supports ${declared.framework} ${requested}.`,
        });
      }
      if (!declared || outside) {
        crashes++;
        results.push({ target: name, exporter: exporterName, output, files: [], coverage: [], reads: [], skipped: true });
        continue;
      }
    }
    const profile = declared ? selectProfile(declared.ranges, requested) : null;

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

    // Exporters see only the target's declared slice of the matrix (derivation and
    // checks above already ran once on the full one); a deliberate exclusion is
    // not a loss, so it gets no `dropped` coverage row.
    const view = targetConfig.modes ? targetView(normalized, targetConfig.modes) : normalized;
    const narrowed = targetConfig.modes ? narrowedDimensions(normalized, view) : new Set();

    // RESOLVE + EMIT: exporter returns file descriptions; it never touches a filesystem.
    const ctx = {
      config, units,
      targetConfig: outRoot ? { ...targetConfig, output } : targetConfig, formatColor, formatHslTriplet, formatHex, contrastRatio, mix,
      projectName: config.name ?? 'design-system',
      // The framework version this target asked for (`targets.<t>.version`,
      // null when unset) and the manifest range core selected for it (the
      // newest one when no version is asked for; null when the exporter
      // declares none). An exporter keys its profile tables on the range.
      targetVersion: requested,
      targetProfile: profile,
      // Sibling-target manifest (docs/specs/exporters/storybook.md#composition):
      // name, exporter, and output dir of every configured target — never their
      // resolutions. Lets composition-capable exporters reference sibling
      // ARTIFACT PATHS, keeping the no-cross-target-coupling invariant.
      siblings: Object.entries(config.targets ?? {}).map(([n, t]) => ({
        name: n, exporter: t.exporter ?? n, output: outputOf(n, t),
      })),
      // The design system's own `semantic.*` vocabulary (issue #51), for the
      // exporters that can carry it (`openVocabulary`); the rest ignore it and
      // core accounts for every token after emit.
      customTokens: customTokens(view),
    };
    // The exporter gets a recording copy of its view (src/reads.js): `reads`
    // lists the catalog slots it looked up while emitting.
    const recording = recordingView(view);
    let files, coverage, notes, reads;
    let crashed = false;
    try {
      ({ files, coverage, diagnostics: notes = [] } = exporter.emit(recording.view, ctx));
      checkExporterDiagnostics(notes);
      reads = recording.reads();
    } catch (e) {
      crash('TST3001', name, 'emit', e, debug
        ? 'This is a bug in the exporter, not in your design system. The stack is above.'
        : 'This is a bug in the exporter, not in your design system. Re-run with --verbose (or TRANSTYLE_DEBUG=1) for the stack.');
      files = [];
      coverage = [];
      notes = [];
      reads = [];
      crashed = true;
    }
    // Exporter diagnostics (optional `diagnostics` in emit's return value): what
    // a target's own conventions do to a value, which only the exporter knows.
    // The message is prefixed with the instance name, so two instances of one
    // exporter report separately and `report.json` (which lists every
    // diagnostic of the run, built after this loop) says which target each
    // line is about.
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

    // Custom vocabulary (issue #51): every custom semantic token is emitted,
    // reaches the target through a binding, or gets a `dropped` row. Not for a
    // crashed exporter, whose report lists no coverage at all.
    let customVocabulary;
    if (!crashed && Array.isArray(coverage)) {
      const custom = accountCustomTokens(view, coverage, (row) => coverageSlots(row, view), {
        open: exporter.openVocabulary === true,
        omitted: targetConfig.options?.customTokens === 'omit',
      });
      if (custom.summary.total > 0) {
        customVocabulary = custom.summary;
        coverage = [...coverage, ...custom.rows];
        files = files.map((f) => (f.path === 'usage.md' ? { ...f, contents: withCustomVocabularyNote(f.contents, custom.summary, custom.unreached) } : f));
      }
    }

    // Its report.json is added after the loop, once every exporter has had its say.
    const result = { target: name, exporter: exporterName, output, files: [...files], coverage, reads, ...(customVocabulary && { customVocabulary }) };
    results.push(result);
    if (withReports) reports.push({ result, targetConfig, view, version: requested === null ? null : { requested, profile } });
  }

  // Source locations first (so the suppressed list carries them too), then
  // `check.suppress`, once, now that every stage that produces diagnostics has
  // run, exporters included: an exporter's own diagnostic (shadcn's TST2104)
  // can be suppressed like any other, and every target's report agrees.
  fillLocations(diagnostics.items, normalized.sources);
  diagnostics.applySuppressions(config.check?.suppress, chained ? ruleLabels(origins.suppress, leafName, 'check.suppress') : undefined);

  // REPORT: the build manifest and machine-readable report per target
  // (docs/specs/validation-and-coverage.md). Built here rather than in the
  // loop, which serialised each report with the diagnostics raised so far: a
  // warning from a later target's exporter was missing from every earlier
  // target's report.json (issue #186).
  for (const { result, targetConfig, view, version } of reports) {
    const listed = result.files.map((f) => projectPath(result.output, f.path, root));
    const report = buildReport({
      target: result.target, config: configChain, options: targetConfig.options, version, coverage: result.coverage, reads: result.reads,
      normalized: view, customVocabulary: result.customVocabulary,
      diagnostics: diagnostics.items, suppressed: diagnostics.suppressed, files: listed,
    });
    result.files.push({ path: 'report.json', contents: JSON.stringify(report, null, 2) + '\n' });
  }

  return { config, diagnostics, results, normalized, bindings, contrast: contrast.check };
}

/**
 * Labels for the merged `bindings` / `check.suppress` entries of an `extends`
 * chain: the index in the file the entry is written in, and that file when it
 * is not the project's own config (`bindings[0] in ../base/transtyle.config.json`).
 */
function ruleLabels(origins, leafName, key) {
  return origins.map(({ file, index }) => `${key}[${index}]${file === leafName ? '' : ` in ${file}`}`);
}

/**
 * TST1014 for a mapping that can't be read or doesn't validate (one per
 * problem, with the row's path), TST1015 for each row whose slot neither the
 * catalog nor this IR has. Returns the number of errors.
 */
function reportMapping(name, { mapping, source, error }, normalized, diagnostics) {
  const where = `Mapping ${source} (target "${name}")`;
  const hint = 'See the declarative mapping format in the "Write an exporter" guide, or validate the file against https://transtyle.dev/schemas/mapping/v0.json.';
  if (error) {
    diagnostics.error('TST1014', `${where}: ${error}`, { target: name, hint });
    return 1;
  }
  const problems = validateMapping(mapping);
  if (problems.length === 0) problems.push(...unknownMappingModes(mapping, normalized));
  for (const { path: p, message } of problems) {
    diagnostics.error('TST1014', `${where}: ${p === '(root)' ? '' : p + ' '}${message}`, { target: name, hint });
  }
  if (problems.length) return problems.length;
  const unknown = unknownMappingSlots(mapping, normalized);
  for (const { path: p, slot, near } of unknown) {
    diagnostics.error('TST1015', `${where}: ${p} "${slot}" is not a slot of the catalog or of this design system`, {
      target: name,
      hint: near ? `Did you mean "${near}"? \`transtyle catalog\` lists every catalog slot.` : '`transtyle catalog` lists every catalog slot; a custom role or component token must be authored to be mapped.',
    });
  }
  return unknown.length;
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
