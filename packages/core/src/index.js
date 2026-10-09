/**
 * @transtyle/core — public programmatic API (docs/architecture/overview.md:
 * "core is a library first, CLI second").
 *
 * Everything the browser entry (browser.js) exports, plus the disk around it:
 * `compile({ cwd })` reads the project (load.js, its `extends` chain
 * included) → `compileProject()` → `writeResults()`, with the emitted-file
 * manifest and drift detection (manifest.js) around the write, the
 * composition `transtyle build` and `check` run.
 */

import path from 'node:path';
import { loadConfigChain, mergeConfigChain, readTokenFiles, requireTokens, DEFAULT_CONFIG_FILE } from './load.js';
import { writeResults } from './emit.js';
import { MANIFEST_FILE, readManifests, renderManifest, reportDrift, staleFiles } from './manifest.js';
import { compileProject } from './pipeline.js';
import { createDeclarativeExporter } from './declarative.js';
import { readMappingFile } from './declarative-fs.js';
import { loadApca } from './apca.js';
import { validate } from './schema/validate.js';
import { configSchema } from './schema/config.schema.js';
import { Diagnostics } from './diagnostics.js';

export * from './browser.js';
export { loadProject, loadConfig, expandTokenFiles, loadConfigChain, mergeConfigChain, DEFAULT_CONFIG_FILE } from './load.js';
export { writeResults } from './emit.js';
export { createDeclarativeExporter, validateMapping, unknownMappingModes, unknownMappingSlots, mappingSchema } from './declarative.js';
export { readMappingFile, loadDeclarativePackage } from './declarative-fs.js';
export { declaredProfiles, selectProfile } from './profiles.js';
export { parseRange, satisfies } from './semver.js';
export { MANIFEST_FILE, hashContents } from './manifest.js';
export { loadContrast, loadApca } from './apca.js';
// Reads a project from disk (`cwd`), so it stays out of the browser entry.
export { suggestBindings, SUGGEST_THRESHOLDS } from './suggest.js';

/**
 * Run the pipeline on the project in `cwd`. `emit: false` = `transtyle check`
 * (pipeline minus EMIT's writes — same code path by design,
 * docs/architecture/pipeline.md).
 *
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
 * `loadExporter(name)` returns the plugin, or `{ plugin, manifest, package }`
 * so its compatibility is checked (TST1309, TST1310): see `compileProject()`.
 *
 * A target whose `exporter` is a path to a `.json` file (`./ourlib.mapping.json`)
 * is a declarative mapping: compile() reads it from the project directory
 * itself and never calls `loadExporter` for it (declarative.js).
 *
 * `apcaLoader` (optional) is an async function returning `{ lib, version }`,
 * `lib` being the `apca-w3` module: for an integration that bundles it rather
 * than resolving it from the project. Without it, compile() imports `apca-w3`
 * itself (apca.js) when the config selects APCA.
 *
 * The result's `contrast` is the check standard's measure (contrast.js); pass
 * it to `contrastRegressions` so `diff` measures with the same standard.
 *
 * `drift: true` compares each selected target's output directory (under
 * `outRoot` when set) with the `transtyle-manifest.json` its last build wrote,
 * before anything is written, and warns (TST1312) about files changed or
 * removed outside transtyle (src/manifest.js). Off by default: only
 * `transtyle build` and `check` ask for it, so `explain`, `diff` and other API
 * callers never report on whatever output happens to sit next to the project.
 *
 * `configFile` (the CLI's `--config`) picks the config, resolved against
 * `cwd`; it defaults to `transtyle.config.json`. Its directory is the project
 * directory: outputs and file names are relative to it. The config may
 * `extends` a base (docs/specs/configuration.md#inheritance-extends);
 * `configChain` in the result lists the files, root base first, relative to
 * the project directory. `redirect` is for `transtyle diff` (loadConfigChain).
 *
 * Each result is `{ target, files, stale, planned, outDir, exporter, coverage, emitted, reads, customVocabulary? }`:
 * `files` the paths written (relative to the project directory; empty with `emit: false`, with
 * `dryRun`, or when the run has an error), `planned` the same paths with their
 * size in bytes (empty without `emit` or with an error), `outDir` the absolute
 * output directory, `stale` the files the previous manifest lists that this
 * build no longer produces (left in place; empty unless the build is written
 * or dry-run without errors), and `emitted` the exporter's own files as `{ path, contents }`
 * even when nothing is written — `transtyle diff` re-emits both sides in memory
 * from it, and `reads` the catalog slots the exporter looked up (what
 * `consumption()` builds the slot matrix from). A target whose exporter failed
 * to load or is incompatible has only `files`, `stale`, `coverage`, `emitted`
 * and `reads`, all empty. `planned` and `files` end with `report.json` and
 * `transtyle-manifest.json`: the manifest is the disk side's, added here, not
 * by `compileProject()`.
 */
export async function compile({ cwd, configFile = DEFAULT_CONFIG_FILE, redirect, targets, emit = true, loadExporter, knownExporters = [], skipExporters = false, debug = false, outRoot, dryRun = false, apcaLoader, drift = false }) {
  const { chain, projectDir } = await loadConfigChain(cwd, { configFile, redirect });
  const configChain = chain.map((f) => f.name);

  // Config schema validation (audit A8), per file of an `extends` chain and
  // before the merge, so TST1010 names the file the bad key is in.
  // compileProject() validates the merged config again; it passes when every
  // file did.
  const invalid = new Diagnostics();
  for (const file of chain) {
    for (const { path: p, message } of validate(file.config, configSchema)) {
      invalid.error('TST1010', `${file.name}: ${p === '(root)' ? '' : p + ' '}${message}`);
    }
  }
  if (invalid.errors.length > 0) {
    return { config: chain[chain.length - 1].config, configChain, projectDir, diagnostics: invalid, results: [], normalized: null, bindings: null, contrast: null };
  }
  const { config, origins } = mergeConfigChain(chain, projectDir);
  requireTokens(config, chain);
  const files = await readTokenFiles(projectDir, config.tokens);

  // The previous build's manifests, read once compileProject() knows the
  // targets and before any exporter runs, so a build sees its output as it was
  // before overwriting it; with `drift`, TST1312 for what changed (manifest.js).
  let manifests = new Map();
  const checkOutputs = drift || emit
    ? async (names) => {
        manifests = await readManifests(projectDir, config, names, outRoot);
        if (!drift) return [];
        const found = new Diagnostics();
        await reportDrift(manifests, projectDir, found);
        return found.items;
      }
    : undefined;

  // A mapping file next to the config is an exporter too (#82, ADR-0017): read
  // here, so every caller of compile() gets it, and nothing is imported.
  const loadWithMappings = async (spec) => {
    if (!isMappingPath(spec)) return loadExporter(spec);
    const { mapping, error } = readMappingFile(path.resolve(projectDir, spec));
    return createDeclarativeExporter(mapping, { source: spec, error, fallbackName: path.basename(spec).replace(/\.json$/i, '') });
  };

  const run = await compileProject({
    config, files, targets, loadExporter: loadWithMappings, knownExporters, skipExporters, debug, outRoot,
    apcaLoader: apcaLoader ?? (() => loadApca(projectDir)),
    root: path.resolve(projectDir).split(path.sep).join('/'),
    configChain, origins, checkOutputs,
    // Without `emit`, nothing reads report.json: don't build it.
    reports: emit,
  });
  const clean = emit && run.diagnostics.errors.length === 0;
  // A build that stopped on errors after a target emitted still lists an empty
  // `planned` on every target, the ones that never loaded included.
  const stopped = emit && !clean && run.results.some((r) => !r.skipped);
  const toWrite = [];
  const results = [];
  for (const r of run.results) {
    // A target that never loaded has no files; with `emit`, report.json is the last one.
    if (r.skipped) {
      results.push({ target: r.target, files: [], stale: [], coverage: r.coverage, emitted: [], reads: [], ...(stopped ? { planned: [] } : {}) });
      continue;
    }
    const emitted = emit ? r.files.slice(0, -1) : r.files;
    const outDir = path.resolve(projectDir, r.output);
    // The emitted-file manifest goes in with the files it describes, in the
    // same atomic swap, so it never lists a file that did not land.
    const disk = clean ? [...r.files, { path: MANIFEST_FILE, contents: renderManifest(r.target, emitted) }] : r.files;
    const paths = disk.map((f) => path.relative(projectDir, path.join(outDir, f.path)));
    if (clean) toWrite.push({ output: r.output, files: disk });
    results.push({
      target: r.target,
      files: clean && !dryRun ? paths : [],
      stale: clean ? await staleFiles(manifests.get(r.target), emitted, projectDir) : [],
      planned: clean ? disk.map((f, i) => ({ path: paths[i], bytes: Buffer.byteLength(f.contents, 'utf8') })) : [],
      outDir,
      exporter: r.exporter,
      coverage: r.coverage,
      emitted,
      reads: r.reads,
      ...(r.customVocabulary && { customVocabulary: r.customVocabulary }),
    });
  }

  // EMIT commit: all exporters have run. Nothing is written if any error-level
  // diagnostic was raised (including by a later target), and a write failure
  // rolls every output directory back to its previous state (emit.js).
  if (clean && !dryRun && toWrite.length > 0) await writeResults(toWrite, projectDir);

  return { config: run.config, configChain, projectDir, diagnostics: run.diagnostics, results, normalized: run.normalized, bindings: run.bindings, contrast: run.contrast };
}

/** A target's `exporter` that names a mapping file next to the config rather than a package. */
const isMappingPath = (spec) => /\.json$/i.test(spec) && (spec.startsWith('./') || spec.startsWith('../') || path.isAbsolute(spec));
