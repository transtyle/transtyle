/**
 * @transtyle/core — public programmatic API (docs/architecture/overview.md:
 * "core is a library first, CLI second").
 */

import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadConfig, loadTokenTrees } from './load.js';
import { validate } from './schema/validate.js';
import { configSchema } from './schema/config.schema.js';
import { normalize, resolveDeferredAliases } from './normalize.js';
import { derive } from './derive.js';
import { runChecks } from './checks.js';
import { Diagnostics } from './diagnostics.js';
import { formatColor, formatHslTriplet, formatHex, contrastRatio, mix } from './color.js';

export { formatColor, formatHslTriplet, formatHex, contrastRatio, mix } from './color.js';
export { Diagnostics } from './diagnostics.js';
export { diffResolved, contrastRegressions } from './diff.js';

/**
 * Run the pipeline. `emit: false` = `transtyle check` (pipeline minus EMIT —
 * same code path by design, docs/architecture/pipeline.md).
 */
export async function compile({ cwd, targets, emit = true, loadExporter }) {
  const diagnostics = new Diagnostics();
  const { config } = await loadConfig(cwd);

  // Config schema validation (audit A8): a typo'd or mis-typed config key is an
  // error, not a silently-ignored field. Fail before touching tokens — a broken
  // config shape would only produce misleading downstream diagnostics.
  for (const { path: p, message } of validate(config, configSchema)) {
    diagnostics.error('TST1010', `transtyle.config.json: ${p} ${message}`);
  }
  if (diagnostics.errors.length > 0) {
    return { config, diagnostics, results: [], normalized: null };
  }

  // LOAD + NORMALIZE + DERIVE (shared across targets)
  const trees = await loadTokenTrees(cwd, config.tokens, diagnostics);
  const normalized = normalize(trees, config, diagnostics);
  derive(normalized, config, diagnostics);
  // Authored aliases pointing at slots DERIVE materializes (e.g. a component
  // token aliasing `{semantic.radius.full}`) resolve here — see normalize.js.
  resolveDeferredAliases(normalized, diagnostics);
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

  const targetNames = targets?.length ? targets : Object.keys(config.targets ?? {});
  const results = [];

  for (const name of targetNames) {
    const targetConfig = config.targets?.[name];
    if (!targetConfig) {
      diagnostics.error('TST1301', `Target "${name}" is not configured in transtyle.config.json`);
      continue;
    }
    if (diagnostics.errors.length > 0) break; // never emit with errors present

    // Target instances: the config key is the instance name; `exporter` selects
    // the plugin (defaults to the key), so one exporter can be configured twice
    // with different options (docs/specs/configuration.md#target-instances).
    const exporter = await loadExporter(targetConfig.exporter ?? name);

    // Validate this instance's options against the exporter's own schema (audit
    // A8): unknown or mis-typed options are errors. Exporters without options
    // reject any options object; exporters with options declare `optionsSchema`.
    if (targetConfig.options !== undefined) {
      const schema = exporter.optionsSchema ?? { type: 'object', additionalProperties: false };
      for (const { path: p, message } of validate(targetConfig.options, schema)) {
        diagnostics.error('TST1011', `target "${name}" options: ${p === '(root)' ? '' : p + ' '}${message}`);
      }
    }
    if (diagnostics.errors.length > 0) break; // don't emit with invalid options

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
    const { files, coverage } = exporter.emit(normalized, ctx);

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
