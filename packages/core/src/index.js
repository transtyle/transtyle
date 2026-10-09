/**
 * @transtyle/core — public programmatic API (docs/architecture/overview.md:
 * "core is a library first, CLI second").
 */

import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadConfig, loadTokenTrees } from './load.js';
import { validate } from './schema/validate.js';
import { configSchema } from './schema/config.schema.js';
import { normalize, resolveDeferredAliases, reportModeCarryOver } from './normalize.js';
import { derive, reportUnderived } from './derive.js';
import { runChecks } from './checks.js';
import { Diagnostics } from './diagnostics.js';
import { nearestName } from './nearest.js';
import { formatColor, formatHslTriplet, formatHex, contrastRatio, mix } from './color.js';

export { formatColor, formatHslTriplet, formatHex, contrastRatio, mix } from './color.js';
export { Diagnostics } from './diagnostics.js';
export { diffResolved, contrastRegressions } from './diff.js';
export { explainToken } from './explain.js';

/**
 * Run the pipeline. `emit: false` = `transtyle check` (pipeline minus EMIT —
 * same code path by design, docs/architecture/pipeline.md).
 */
/**
 * `skipExporters: true` stops after the shared pipeline stages: no exporter is
 * loaded or run (`explain` only walks provenance, so a broken exporter must not
 * be able to fail it). `debug: true` keeps a crashed exporter's stack on its
 * TST3001/TST3002 diagnostic (the CLI sets it from TRANSTYLE_DEBUG).
 *
 * `knownExporters` (AL5) is the caller's list of exporter names it can resolve —
 * the CLI's OFFICIAL_EXPORTERS keys. Core stays exporter-agnostic (it never
 * imports one), but TST1301 can then tell "you typo'd" apart from "that
 * exporter exists, you just haven't configured it", which are opposite fixes.
 */
export async function compile({ cwd, targets, emit = true, loadExporter, knownExporters = [], skipExporters = false, debug = false }) {
  const diagnostics = new Diagnostics();
  const { config } = await loadConfig(cwd);

  // Config schema validation (audit A8): a typo'd or mis-typed config key is an
  // error, not a silently-ignored field. Fail before touching tokens — a broken
  // config shape would only produce misleading downstream diagnostics.
  for (const { path: p, message } of validate(config, configSchema)) {
    diagnostics.error('TST1010', `transtyle.config.json: ${p === '(root)' ? '' : p + ' '}${message}`);
  }
  if (diagnostics.errors.length > 0) {
    return { config, diagnostics, results: [], normalized: null };
  }

  // LOAD + NORMALIZE + DERIVE (shared across targets)
  const trees = await loadTokenTrees(cwd, config.tokens, diagnostics);
  const normalized = normalize(trees, config, diagnostics);
  const { underived } = derive(normalized, config, diagnostics);
  // Authored aliases pointing at slots DERIVE materializes (e.g. a component
  // token aliasing `{semantic.radius.full}`) resolve here — see normalize.js.
  resolveDeferredAliases(normalized, diagnostics);

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
        hint: 'Author it as `semantic.color.primary.solid` (your brand color). A bare `semantic.color.primary` is a different path — the role grid anchors on the `.solid` cell.',
      },
    );
  }

  runChecks(normalized, config, diagnostics);

  // derivation.require: listed slots must be authored, not derived. Color
  // roles require their `.solid` anchor cell (the role grid's authored anchor,
  // was `.base` pre-revision); other requires (e.g. radius.md) are bare paths.
  for (const req of config.derivation?.require ?? []) {
    const kind = normalized.modes[normalized.defaultMode].get(`${req}.solid`)?.provenance.kind
      ?? normalized.modes[normalized.defaultMode].get(req)?.provenance.kind;
    if (kind === 'derived' || kind === undefined) {
      diagnostics.error('TST1202', `Required token is not authored: ${req}`);
    }
  }

  const targetNames = skipExporters ? [] : targets?.length ? targets : Object.keys(config.targets ?? {});
  const results = [];
  // Exporter crashes (TST3001/TST3002) are recorded per target and must not
  // trip the "never emit with errors present" guards below: a throwing exporter
  // is not a pipeline error, and stopping at it would hide every later target.
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
    try {
      exporter = await loadExporter(targetConfig.exporter ?? name);
    } catch (e) {
      crash('TST3002', name, 'load', e, 'Install the exporter package in this project, or fix its `exporter` field in transtyle.config.json. Set TRANSTYLE_DEBUG=1 for the stack.');
      results.push({ target: name, files: [], coverage: [], emitted: [] });
      continue;
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
    const ctx = {
      config, targetConfig, formatColor, formatHslTriplet, formatHex, contrastRatio, mix,
      projectName: config.name ?? 'design-system',
      // Sibling-target manifest (docs/specs/exporters/storybook.md#composition):
      // name, exporter, and output dir of every configured target — never their
      // resolutions. Lets composition-capable exporters reference sibling
      // ARTIFACT PATHS, keeping the no-cross-target-coupling invariant.
      siblings: Object.entries(config.targets ?? {}).map(([n, t]) => ({
        name: n, exporter: t.exporter ?? n, output: t.output ?? `dist/${n}`,
      })),
    };
    let files, coverage;
    try {
      ({ files, coverage } = exporter.emit(normalized, ctx));
    } catch (e) {
      // Only the exporter's own code is wrapped: file-system errors below are
      // not exporter bugs and keep failing loudly.
      crash('TST3001', name, 'emit', e, debug
        ? 'This is a bug in the exporter, not in your design system. The stack is above.'
        : 'This is a bug in the exporter, not in your design system. Re-run with TRANSTYLE_DEBUG=1 for the stack.');
      files = [];
      coverage = [];
    }

    const outDir = path.resolve(cwd, targetConfig.output ?? `dist/${name}`);
    const written = [];
    if (emit) {
      await mkdir(outDir, { recursive: true });
      for (const f of files) {
        await writeFile(path.join(outDir, f.path), f.contents, 'utf8');
        written.push(path.relative(cwd, path.join(outDir, f.path)));
      }
      // Build manifest + machine-readable report (docs/specs/validation-and-coverage.md)
      const report = buildReport(name, targetConfig, coverage, diagnostics, written);
      await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
      written.push(path.relative(cwd, path.join(outDir, 'report.json')));
    }
    // `emitted` carries the file *specs* (path + contents) even when emit is
    // off — `transtyle diff` re-emits both sides in-memory to compute per-target
    // impact without writing anything. `files` stays the written paths.
    results.push({ target: name, files: written, coverage, emitted: files });
  }

  return { config, diagnostics, results, normalized };
}

function buildReport(target, targetConfig, coverage, diagnostics, files) {
  const counts = {};
  for (const item of coverage) counts[item.class] = (counts[item.class] ?? 0) + 1;
  return {
    $schema: 'https://transtyle.dev/schemas/report/v0.json',
    target,
    options: targetConfig.options ?? {},
    generatedBy: 'transtyle 0.1.0 (walking skeleton)',
    coverage: { counts, items: coverage },
    diagnostics: diagnostics.items,
    files,
  };
}
