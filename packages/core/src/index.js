/**
 * @transtyle/core — public programmatic API (docs/architecture/overview.md:
 * "core is a library first, CLI second").
 */

import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadConfig, loadTokenTrees } from './load.js';
import { normalize } from './normalize.js';
import { derive } from './derive.js';
import { runChecks } from './checks.js';
import { Diagnostics } from './diagnostics.js';
import { formatColor, formatHslTriplet, contrastRatio } from './color.js';

export { formatColor, formatHslTriplet, contrastRatio } from './color.js';
export { Diagnostics } from './diagnostics.js';

/**
 * Run the pipeline. `emit: false` = `transtyle check` (pipeline minus EMIT —
 * same code path by design, docs/architecture/pipeline.md).
 */
export async function compile({ cwd, targets, emit = true, loadExporter }) {
  const diagnostics = new Diagnostics();
  const { config } = await loadConfig(cwd);

  // LOAD + NORMALIZE + DERIVE (shared across targets)
  const trees = await loadTokenTrees(cwd, config.tokens, diagnostics);
  const normalized = normalize(trees, config, diagnostics);
  derive(normalized, config, diagnostics);
  runChecks(normalized, config, diagnostics);

  // derivation.require: listed slots must be authored, not derived
  for (const req of config.derivation?.require ?? []) {
    const kind = normalized.modes[normalized.defaultMode].get(`${req}.base`)?.provenance.kind
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
    // RESOLVE + EMIT: exporter returns file descriptions; only core touches the filesystem.
    const ctx = {
      config, targetConfig, formatColor, formatHslTriplet, contrastRatio,
      projectName: config.name ?? 'design-system',
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
    results.push({ target: name, files: written, coverage });
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
