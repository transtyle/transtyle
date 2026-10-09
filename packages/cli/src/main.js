#!/usr/bin/env node
/**
 * transtyle CLI (docs/specs/cli.md). Commands: build, check, explain, bindings, bind, diff, catalog, init, add, migrate.
 * Human logs → stderr; exit codes: 0 ok, 1 diagnostics ≥ fail-on, 2 usage error.
 */

import path from 'node:path';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import process from 'node:process';
import { compile, catalog, completenessStatus, COMPLETENESS_LEVELS, DEFAULT_COMPLETENESS_LEVEL, consumption, diffResolved, contrastRegressions, explainToken, explainVariable, suggestBindings, slotConsumers, deprecationsReached, formatColor, formatHex, loadApca } from '@transtyle/core';
import { renderMatrix } from './matrix.js';
import { cmdMigrate } from './migrate.js';
import { INIT_DEFAULTS, INIT_VALUE_FLAGS, TOKENS_SCHEMA, validateFlags, promptAnswers, scaffold, swatch, authorNext, targetEntry } from './init.js';

const OFFICIAL_EXPORTERS = {
  shadcn: '@transtyle/exporter-shadcn',
  echarts: '@transtyle/exporter-echarts',
  daisyui: '@transtyle/exporter-daisyui',
  bootstrap: '@transtyle/exporter-bootstrap',
  storybook: '@transtyle/exporter-storybook',
  'css-variables': '@transtyle/exporter-css-variables',
  radix: '@transtyle/exporter-radix',
  primeng: '@transtyle/exporter-primeng',
  mantine: '@transtyle/exporter-mantine',
  chakra: '@transtyle/exporter-chakra',
  mui: '@transtyle/exporter-mui',
};

/**
 * Build a loader that resolves exporter packages **from the user's project
 * first**, then from the CLI's own install.
 *
 * A bare `import(pkg)` resolves relative to this file, which works for the
 * official exporters (they ship alongside the CLI) but makes third-party ones
 * unloadable whenever the CLI isn't inside the project's own node_modules — a
 * global install, a monorepo checkout, a hoisted binary. Project-first also lets
 * a project deliberately pin its own fork of an official exporter.
 *
 * The loader hands core `{ plugin, manifest, package }` so it can check the
 * exporter's declared `irSpec` and `pluginApi` (issue #14). Exporters map only
 * `"."` in their `exports`, so `<pkg>/package.json` can't be resolved: the
 * manifest is found by walking up from the resolved entry file.
 */
function makeLoadExporter(cwd) {
  const requireFromProject = createRequire(path.join(cwd, 'noop.js'));
  return async function loadExporter(name) {
    const pkg = OFFICIAL_EXPORTERS[name] ?? name;
    const tried = [];
    for (const [where, resolve] of [
      [`from the project (${cwd})`, () => requireFromProject.resolve(pkg)],
      ['from the transtyle install', () => fileURLToPath(import.meta.resolve(pkg))],
    ]) {
      let entry;
      try {
        entry = resolve();
        const plugin = (await import(pathToFileURL(entry).href)).default;
        return withManifest(plugin, entry, pkg);
      } catch (e) {
        tried.push(`${where}: ${e.code ?? e.message}`);
      }
    }
    throw new Error(
      `Cannot load exporter for target "${name}" (package "${pkg}"):\n  - ${tried.join('\n  - ')}\n` +
      `  Third-party exporters must be installed in this project: npm install ${pkg}`);
  };
}

/**
 * The package.json above an exporter's entry file, when it is the package that
 * was asked for: `{ plugin, manifest, package }`. A relative path or a file
 * outside a package of that name returns the bare plugin (nothing to check).
 */
function withManifest(plugin, entry, specifier) {
  if (specifier.startsWith('.') || path.isAbsolute(specifier)) return plugin;
  const parts = specifier.split('/');
  const pkgName = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  for (let dir = path.dirname(entry); ; dir = path.dirname(dir)) {
    const file = path.join(dir, 'package.json');
    if (existsSync(file)) {
      let json;
      try { json = JSON.parse(readFileSync(file, 'utf8')); } catch { json = null; }
      if (json?.name === pkgName) {
        return { plugin, manifest: json.transtyle ?? null, package: { name: json.name, version: json.version } };
      }
    }
    if (path.dirname(dir) === dir) return plugin;
  }
}

function parseArgs(argv) {
  const args = { command: undefined, targets: [], cwd: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--cwd') args.cwd = path.resolve(argv[++i] ?? '.');
    else if (a === '--mode') args.mode = argv[++i];
    else if (a === '--target') args.target = argv[++i];
    else if (a === '--variable') args.variable = argv[++i];
    else if (a === '--out') {
      const v = argv[++i];
      if (v === undefined || v === '' || v.startsWith('--')) { console.error('✖ --out needs a directory'); process.exit(2); }
      args.out = path.resolve(v);
    }
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--quiet') args.quiet = true;
    else if (a === '--verbose') args.verbose = true;
    else if (a === '--json') args.json = true;
    else if (a === '--matrix') args.matrix = true;
    else if (a === '--expand') args.expand = true;
    else if (a === '--from') args.from = argv[++i];
    else if (a === '--write') args.write = true;
    else if (a === '--suggest') args.suggest = true;
    else if (a === '--rules') args.rules = true;
    else if (a === '--completeness') {
      const v = argv[++i];
      if (!COMPLETENESS_LEVELS.includes(v)) {
        console.error(`Flag --completeness needs a level: ${COMPLETENESS_LEVELS.join(', ')}${v === undefined ? '' : ` (got: ${v})`}`);
        process.exit(2);
      }
      args.completeness = v;
    }
    else if (a.startsWith('--') && INIT_VALUE_FLAGS.includes(a.slice(2))) {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) { console.error(`Flag ${a} needs a value`); process.exit(2); }
      (args.init ??= {})[a.slice(2)] = v;
    } else if (a === '--yes' || a === '-y') args.yes = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a.startsWith('--')) { console.error(`Unknown flag: ${a}`); process.exit(2); }
    else if (!args.command) args.command = a;
    else args.targets.push(a);
  }
  return args;
}

const HELP = `transtyle — design system compiler

Usage:
  transtyle build [target...]     compile configured targets (default: all)
                                  [--out <dir>] [--dry-run]
  transtyle check [target...]     run the pipeline without writing files
  transtyle explain <slot>        show a resolved slot's value, provenance, and rule inputs
  transtyle explain --variable <name> --target <t>
                                  from a target variable to the slot(s) it reads, then their provenance
  transtyle bindings --expand     print the config's bindings rules expanded into a plain alias token file
  transtyle bind --suggest        propose bindings from your token names and colors to unbound catalog slots
  transtyle diff [ref]            semantic diff of the resolved graph vs a git ref (default: HEAD), with per-target impact
  transtyle catalog               list every catalog slot: type, derivation rule, inputs (no project needed)
  transtyle init [name]           scaffold transtyle.config.json + token files (asks on a terminal)
  transtyle add <target>          add a target to transtyle.config.json
  transtyle migrate --from style-dictionary [--write]
                                  rewrite Style Dictionary v3 token files (value/type) to DTCG ($value/$type); a diff unless --write
Options:
  --cwd <dir>                     project directory (with transtyle.config.json)
  --mode <name>                   mode to resolve for (explain only; default: the DS's default mode)
  --target <t>                    explain only: a target instance; lists the variables consuming the slot
  --variable <name>               explain only (with --target): the target variable to look up
  --expand                        bindings only: required, prints the expansion to stdout
  --suggest                       bind only: required, prints the proposals as an alias token file to stdout
  --rules                         bind only: print them as "bindings" rules for transtyle.config.json instead
  --from <source>                 migrate only: what to migrate from (style-dictionary)
  --write                         migrate only: apply the rewrite (default: print the diff, change nothing)
  --out <dir>                     build only: write target <name> to <dir>/<name> instead of its configured output
  --dry-run                       build only: run the whole build, list the files it would write, write nothing
  --quiet                         build/check only: print only errors and the diagnostics that fail the run
  --verbose                       build/check only: add exporter, output directory, file sizes; stack on a fatal error
                                  (also TRANSTYLE_DEBUG=1). The CLI never colors its output; NO_COLOR is honored (init's color chip)
  --json                          check/diff/catalog/explain/bind only: print a machine-readable report to stdout
  --matrix                        check only: print which targets read each catalog slot (with --json: a "matrix" key)
  --completeness <level>          check only: list what to author next for minimal, recommended or complete
                                  (default level: check.completeness, else recommended)
init options (each skips its question; without a terminal, unset ones take the default):
  --brand <color>                 brand color, any CSS color (default: oklch(0.55 0.18 255))
  --schemes <light,dark|light>    color schemes (default: light,dark)
  --targets <t1,t2,...>           targets to configure (default: css-variables)
  --preset <recommended|minimal>  recommended: brand, neutrals with dark values, radius, fonts;
                                  minimal: the brand color only (default: recommended)
  --layout <single|layered>       one token file, or your names + bindings (default: single)
  --yes, -y                       ask nothing: take the default for every unset option
`;

/** TRANSTYLE_DEBUG=1 is `--verbose`: one switch for the stack of a crashed exporter and the extra detail. */
let VERBOSE = !!process.env.TRANSTYLE_DEBUG && process.env.TRANSTYLE_DEBUG !== '0';
let QUIET = false;

const ICONS = { error: '✖', warning: '⚠', info: 'ℹ' };

/**
 * One diagnostic, rendered. The `hint` (AL5) goes on its own indented line
 * rather than inside the message: what is wrong and what to change are
 * different sentences, and running them together is how the old one-liners
 * ended up saying neither well.
 */
function printDiagnostic(d) {
  // `file:line:col`, the form terminals and editors make clickable, when the
  // diagnostic is about something authored in a token file (core's locations).
  const at = d.file === undefined ? '' : ` ${d.file}${d.line === undefined ? '' : `:${d.line}${d.column === undefined ? '' : `:${d.column}`}`}`;
  console.error(`${ICONS[d.severity] ?? '·'} ${d.code}${at} ${d.message}`);
  if (d.stack) console.error(d.stack.split('\n').map((l) => `    ${l}`).join('\n'));
  if (d.hint) console.error(`  ↳ ${d.hint}`);
}

/** Every diagnostic, then one line saying how many `check.suppress` silenced (none, no line). */
function printDiagnostics(diagnostics) {
  for (const d of diagnostics.items) printDiagnostic(d);
  const n = diagnostics.suppressed.length;
  if (n > 0) console.error(`${ICONS.info} ${n} diagnostic${n === 1 ? '' : 's'} suppressed by check.suppress (listed in report.json)`);
}
const COMMANDS = ['build', 'check', 'explain', 'bindings', 'bind', 'diff', 'catalog', 'init', 'add', 'migrate'];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.command) { console.error(HELP); process.exit(args.help ? 0 : 2); }
  if (!COMMANDS.includes(args.command)) {
    console.error(`Unknown command: ${args.command}\n${HELP}`);
    process.exit(2);
  }

  if ((args.init || args.yes) && args.command !== 'init') {
    const flag = args.yes ? '--yes' : `--${Object.keys(args.init)[0]}`;
    console.error(`✖ ${flag} only applies to init`);
    process.exit(2);
  }

  if (args.command !== 'explain' && (args.target !== undefined || args.variable !== undefined)) {
    console.error(`✖ ${args.target !== undefined ? '--target' : '--variable'} is a \`transtyle explain\` option`);
    process.exit(2);
  }
  const only = (flag, set, cmds) => {
    if (set && !cmds.includes(args.command)) { console.error(`✖ ${flag} applies to ${cmds.map((c) => `\`transtyle ${c}\``).join(' and ')}`); process.exit(2); }
  };
  only('--out', args.out !== undefined, ['build']);
  only('--dry-run', args.dryRun, ['build']);
  only('--quiet', args.quiet, ['build', 'check']);
  only('--verbose', args.verbose, ['build', 'check']);
  only('--completeness', args.completeness, ['check']);
  if (args.quiet && args.verbose) { console.error('✖ --quiet and --verbose contradict each other'); process.exit(2); }
  if (args.verbose) VERBOSE = true;
  QUIET = !!args.quiet;
  if (args.command !== 'migrate' && (args.from !== undefined || args.write)) {
    console.error(`✖ ${args.from !== undefined ? '--from' : '--write'} is a \`transtyle migrate\` option`);
    process.exit(2);
  }
  if (args.command === 'migrate') return cmdMigrate(args);
  if (args.command === 'explain') return cmdExplain(args);
  if (args.command === 'bindings') return cmdBindings(args);
  if (args.command === 'bind') return cmdBind(args);
  if (args.command === 'diff') return cmdDiff(args);
  if (args.command === 'catalog') return cmdCatalog(args);
  if (args.command === 'init') return cmdInit(args);
  if (args.command === 'add') return cmdAdd(args);
  return cmdBuildOrCheck(args);
}

// ---------- build / check ----------

async function cmdBuildOrCheck(args) {
  const emit = args.command === 'build';
  if (emit && args.matrix) { console.error('✖ --matrix is a `transtyle check` option'); process.exit(2); }
  let result;
  try {
    result = await compile({ cwd: args.cwd, targets: args.targets, emit, outRoot: args.out, dryRun: args.dryRun, loadExporter: makeLoadExporter(args.cwd), knownExporters: Object.keys(OFFICIAL_EXPORTERS), debug: VERBOSE });
  } catch (e) {
    console.error(`✖ ${e.message}`);
    if (VERBOSE && e.stack) console.error(e.stack.split('\n').slice(1).join('\n'));
    process.exit(2);
  }

  const { diagnostics, results, config } = result;
  const failOn = config.check?.failOn ?? 'error';

  // --quiet keeps what explains a failure: errors, and warnings when
  // `check.failOn: warning` makes them failing. The suppressed-count line is progress.
  if (QUIET) {
    for (const d of diagnostics.items) if (d.severity === 'error' || (failOn === 'warning' && d.severity === 'warning')) printDiagnostic(d);
  } else printDiagnostics(diagnostics);

  // Authoring completeness (core's completeness levels): one line for the
  // whole design system, before the per-target bars, since it doesn't depend
  // on the target. Never changes the exit code (`derivation.require:
  // ["completeness:<level>"]` is the policy knob).
  const level = args.completeness ?? config.check?.completeness ?? DEFAULT_COMPLETENESS_LEVEL;
  const completeness = result.normalized ? completenessStatus(result.normalized, level) : null;
  // Progress, so --quiet drops it; the to-do --completeness asks for is data and stays.
  if (completeness && !QUIET) {
    const next = completeness.todo.length && !args.completeness ? `  · transtyle check --completeness ${level} lists what to author next` : '';
    console.error(`\nauthored ${completeness.authored}/${completeness.total} ${level}${next}`);
  }

  for (const r of results) {
    const counts = {};
    for (const c of r.coverage) counts[c.class] = (counts[c.class] ?? 0) + 1;
    const total = r.coverage.length || 1;
    const pct = (k) => (counts[k] ? `${Math.round((counts[k] / total) * 100)}% ${k}` : null);
    const bar = ['native', 'derived', 'approximated', 'dropped', 'unsupported'].map(pct).filter(Boolean).join(' · ');
    if (QUIET) continue;
    console.error(`\n${r.target}  ${bar}${VERBOSE ? `  (${r.coverage.length} rows${Object.entries(counts).map(([k, n]) => `, ${n} ${k}`).join('')})` : ''}`);
    if (VERBOSE && r.exporter) console.error(`  exporter ${r.exporter}, options ${JSON.stringify(config.targets?.[r.target]?.options ?? {})}, output ${r.outDir}`);
    if (emit) {
      const verb = args.dryRun ? 'would write ' : '';
      for (const f of args.dryRun ? r.planned : r.files.map((p) => ({ path: p, bytes: r.planned.find((x) => x.path === p)?.bytes }))) {
        console.error(`  ↳ ${verb}${f.path}${VERBOSE && f.bytes !== undefined ? `  (${f.bytes} bytes)` : ''}`);
      }
    }
  }

  // Human logs → stderr (above); requested data → stdout (docs/specs/cli.md
  // "Behavioral contracts"). `check --json` is the only current consumer.
  // --matrix: who reads each slot, from the reads core recorded during emit.
  const matrix = args.matrix && result.normalized ? consumption(result) : null;
  if (!emit && args.json) {
    console.log(JSON.stringify({
      // The standard every TST2101 above was measured against (null when the
      // config failed to load, so nothing was measured).
      contrast: result.contrast ? { standard: result.contrast.standard, algorithm: result.contrast.algorithm } : null,
      diagnostics: diagnostics.items,
      suppressed: diagnostics.suppressed,
      targets: results.map((r) => ({ target: r.target, coverage: r.coverage, reads: r.reads })),
      ...(matrix ? { matrix } : {}),
      ...(completeness ? { completeness: completenessJson(completeness) } : {}),
    }, null, 2));
  } else {
    if (matrix) console.log(renderMatrix(matrix));
    if (completeness && args.completeness) console.log(renderCompleteness(completeness));
  }

  if (diagnostics.shouldFail(failOn)) {
    console.error(`\n✖ failed (fail-on: ${failOn})`);
    // exitCode, not process.exit(): `check --json` writes tens of KB to a pipe,
    // and process.exit() would cut that write short (same as `diff`).
    process.exitCode = 1;
    return;
  }
  if (!QUIET) console.error(args.dryRun ? '\n✔ dry run complete, nothing written' : emit ? '\n✔ build complete' : '\n✔ check passed');
}

/** `check --json`'s `completeness` key (docs/specs/cli.md): the level, the counts and the to-do, in order. */
function completenessJson({ level, authored, total, todo }) {
  return { level, authored, total, todo };
}

/**
 * `check --completeness <level>`: the items still to author, numbered in the
 * order they pay off, each with its state and why it matters. Requested data,
 * so stdout, like --matrix.
 */
function renderCompleteness({ level, authored, total, todo }) {
  if (!todo.length) return `Completeness ${level}: ${authored}/${total} authored, nothing left to author at this level.`;
  const lines = [`Completeness ${level}: ${authored}/${total} authored. To author next:`];
  const width = String(todo.length).length;
  todo.forEach((item, i) => {
    const where = item.mode ? ` (${item.mode})` : '';
    const how = item.state === 'carried-over'
      ? 'carried over from the default scheme'
      : item.members !== undefined
        ? `${item.state}, ${item.authoredMembers}/${item.members} authored`
        : item.rule ? `${item.state} by ${item.rule}` : item.state;
    lines.push(`  ${String(i + 1).padStart(width)}. ${item.slot}${where}  ${how}`);
    lines.push(`  ${' '.repeat(width)}  ${item.reason}`);
  });
  return lines.join('\n');
}

// ---------- bindings ----------

/**
 * `bindings --expand`: the config's pattern rules as the plain alias token file
 * they expand to (stdout, pipeable into `tokens/*.json`), so a team can freeze
 * them. What was skipped and why goes to stderr, one line per rule.
 */
async function cmdBindings(args) {
  if (!args.expand) { console.error('Usage: transtyle bindings --expand [--cwd <dir>]'); process.exit(2); }
  let result;
  try {
    result = await compile({ cwd: args.cwd, targets: [], emit: false, skipExporters: true, loadExporter: makeLoadExporter(args.cwd) });
  } catch (e) {
    console.error(`✖ ${e.message}`);
    process.exit(2);
  }
  const { diagnostics, bindings } = result;
  for (const d of diagnostics.items) printDiagnostic(d);
  // Only the errors that make the expansion itself wrong stop it; the rest of
  // the design system may still be incomplete while its bindings are being written.
  if (diagnostics.errors.some((d) => ['TST1010', 'TST1117', 'TST1118'].includes(d.code))) { process.exitCode = 1; return; }
  if (!bindings) { console.error('✖ transtyle.config.json has no "bindings" rules to expand.'); process.exit(2); }

  const byRule = new Map();
  for (const s of bindings.skipped) {
    const entry = byRule.get(s.rule) ?? { authored: 0, rule: 0, 'missing-target': 0 };
    entry[s.reason]++;
    byRule.set(s.rule, entry);
  }
  for (const [rule, n] of byRule) {
    const parts = [['authored', 'already authored'], ['rule', 'bound by an earlier rule'], ['missing-target', 'target missing']]
      .filter(([k]) => n[k] > 0).map(([k, why]) => `${n[k]} ${why}`);
    console.error(`  ${rule}: skipped ${parts.join(', ')}`);
  }
  console.error(`${bindings.aliases.length} alias(es) from ${new Set(bindings.aliases.map((a) => a.rule)).size} rule(s)`);
  console.log(JSON.stringify(bindings.tree, null, 2));
}

// ---------- bind --suggest ----------

/**
 * `bind --suggest`: core's suggestBindings(), printed. Requested data goes to
 * stdout (the alias token file, the `bindings` rules with --rules, or the whole
 * report with --json); the table a human reads goes to stderr. Nothing is
 * written: adding the file to `tokens`, or the rules to the config, is the
 * review (docs/specs/cli.md).
 */
async function cmdBind(args) {
  const usage = 'Usage: transtyle bind --suggest [--rules | --json] [--cwd <dir>]';
  if (!args.suggest) { console.error(usage); process.exit(2); }
  if (args.targets.length) { console.error(`✖ transtyle bind takes no arguments (got: ${args.targets.join(' ')})\n  ${usage}`); process.exit(2); }
  if (args.rules && args.json) { console.error(`✖ --rules and --json are two different outputs; pick one\n  ${usage}`); process.exit(2); }
  let result;
  try {
    result = await suggestBindings({ cwd: args.cwd });
  } catch (e) {
    console.error(`✖ ${e.message}`);
    process.exit(2);
  }
  const { diagnostics, report } = result;
  if (!report) {
    for (const d of diagnostics.errors) printDiagnostic(d);
    process.exitCode = 1;
    return;
  }

  const by = (status) => report.slots.filter((s) => s.status === status);
  const proposed = by('proposed');
  const contested = by('contested');
  console.error(`bind --suggest: ${report.synonyms}, rule pack ${report.rulePack}, modes ${report.modes.join(' | ')}`);
  if (proposed.length) {
    console.error(`\nProposed (${proposed.length}):`);
    const w = Math.max(...proposed.map((s) => s.slot.length));
    const f = Math.max(...proposed.map((s) => s.from.length));
    for (const s of proposed) console.error(`  ${s.slot.padEnd(w)}  ← ${s.from.padEnd(f)}  ${s.confidence.padEnd(6)}  ${s.reasons.join('; ')}`);
  }
  if (contested.length) {
    console.error(`\nContested, not written (${contested.length}): bind these yourself`);
    for (const s of contested) {
      console.error(`  ${s.slot}`);
      for (const c of s.candidates) console.error(`    ${c.token}  ${c.confidence}  ${c.reasons.join('; ')}`);
    }
  }
  const none = by('none');
  if (none.length) console.error(`\nNothing proposed (${none.length}): ${none.map((s) => `${s.slot.replace(/^semantic\.(color\.)?/, '')} (${s.fallback})`).join(', ')}`);
  const bound = by('bound');
  if (bound.length) console.error(`Already bound (${bound.length}): ${bound.map((s) => s.slot.replace(/^semantic\.(color\.)?/, '')).join(', ')}`);

  if (args.json) console.log(JSON.stringify(report, null, 2));
  else if (args.rules) console.log(JSON.stringify({ bindings: report.rules }, null, 2));
  else console.log(JSON.stringify({ $schema: TOKENS_SCHEMA, ...report.tokens }, null, 2));
}

// ---------- explain ----------

const EXPLAIN_USAGE = 'Usage: transtyle explain <slot> [--target <t>] [--mode <name>] [--json]\n       transtyle explain --variable <name> --target <t> [--mode <name>] [--json]';

/**
 * `explain`: a slot's provenance tree (explainToken), and with `--target` the
 * target side of it (issue #98): which of the target's variables consume the
 * slot, or, with `--variable` (or a bare name that is not a slot), from a
 * variable to the slots it reads (explainVariable). The target is compiled
 * without writing (`emit: false`); core records its reads (`reads` on the
 * target result, what `check --matrix` is built from), so a slot the target
 * reads but no coverage row names still says so.
 */
async function cmdExplain(args) {
  const [arg, extra] = args.targets;
  const usage = (msg) => { console.error(`${msg ? `✖ ${msg}\n` : ''}${EXPLAIN_USAGE}`); process.exit(2); };
  if (extra !== undefined) usage(`one slot at a time (got ${args.targets.join(', ')})`);
  if (args.variable !== undefined && arg !== undefined) usage('give a slot or --variable, not both');
  if (args.variable !== undefined && !args.target) usage('--variable needs --target <t>');
  if ((args.target !== undefined && !args.target) || args.variable === '') usage();
  if (!arg && args.variable === undefined) usage();

  let result;
  try {
    result = await compile({
      cwd: args.cwd,
      targets: args.target ? [args.target] : [],
      emit: false,
      skipExporters: !args.target,
      loadExporter: makeLoadExporter(args.cwd),
      knownExporters: Object.keys(OFFICIAL_EXPORTERS),
      debug: VERBOSE,
    });
  } catch (e) {
    console.error(`✖ ${e.message}`);
    process.exit(2);
  }
  const { normalized, diagnostics } = result;
  printDiagnostics(diagnostics);
  if (!normalized) { process.exitCode = 1; return; }
  if (args.target && !result.results.some((r) => r.target === args.target)) {
    // TST1301 above says why (typo or not configured) and names the configured targets.
    console.error(`✖ Cannot explain against target "${args.target}": it did not compile`);
    process.exit(2);
  }

  if (args.mode !== undefined && !normalized.modes[args.mode]) {
    console.error(`✖ Unknown mode "${args.mode}" (available: ${normalized.modeValues.join(', ')})`);
    process.exit(2);
  }

  const explainSlot = (slot) => {
    try {
      return explainToken(normalized, slot, { mode: args.mode });
    } catch (e) {
      if (e.code === 'unknown-mode') { console.error(`✖ ${e.message}`); process.exit(2); }
      if (e.code === 'unknown-slot') return e;
      throw e;
    }
  };
  const lookupVariable = (name) => {
    try {
      return explainVariable(result, args.target, name);
    } catch (e) {
      if (e.code === 'unknown-variable') return e;
      throw e;
    }
  };

  // A slot argument is a slot first; a bare name that is not one is tried as
  // a variable of the target, so `semantic.primary.50` (PrimeNG) and
  // `primary.solid` (the catalog) never collide: the catalog wins.
  if (args.variable === undefined) {
    const tree = explainSlot(arg);
    if (!(tree instanceof Error)) return printSlotExplain(tree, args, result);
    const asVariable = args.target ? lookupVariable(arg) : null;
    if (!asVariable || asVariable instanceof Error) {
      console.error(`✖ ${tree.message}\n\nClosest matches:\n${tree.closest.map((k) => `  ${k}`).join('\n')}`);
      if (asVariable) console.error(`\nClosest ${args.target} variables:\n${asVariable.closest.map((k) => `  ${k}`).join('\n')}`);
      process.exit(2);
    }
    return printVariableExplain(asVariable, args, explainSlot, normalized);
  }

  const found = lookupVariable(args.variable);
  if (found instanceof Error) {
    console.error(`✖ ${found.message}\n\nClosest matches:\n${found.closest.map((k) => `  ${k}`).join('\n')}`);
    process.exit(2);
  }
  return printVariableExplain(found, args, explainSlot, normalized);
}

/** `explain <slot>`, with the consuming variables of `--target` when given. */
function printSlotExplain(tree, args, result) {
  let target;
  if (args.target) {
    const { rows } = slotConsumers(result, args.target, tree.slot);
    const reads = result.results.find((r) => r.target === args.target)?.reads ?? [];
    target = { name: args.target, read: reads.includes(tree.slot), consumers: rows };
  }
  if (args.json) {
    console.log(JSON.stringify({ ...tree, ...(target ? { target } : {}) }, null, 2));
    return;
  }
  printSlotHeader(tree, result.normalized);
  printExplain(tree.entry, tree.inputs, 0);
  if (!target) return;
  console.log('');
  if (!target.consumers.length) {
    console.log(`consumed by ${target.name}: ${target.read ? 'read as an input, no coverage row names it' : 'not read'}`);
    return;
  }
  console.log(`consumed by ${target.name}:`);
  const width = Math.max(...target.consumers.map((c) => c.variable.length));
  for (const c of target.consumers) {
    console.log(`  ${c.variable.padEnd(width)}  ${c.class}${c.through.length ? `  via ${c.through.join(' → ')}` : ''}`);
  }
}

/** `explain --variable`: the variable's rows (and the rows it follows), then each slot's tree. */
function printVariableExplain(found, args, explainSlot, normalized) {
  const trees = found.slots.map((slot) => explainSlot(slot)).filter((t) => !(t instanceof Error));
  if (args.json) {
    console.log(JSON.stringify({ ...found, mode: args.mode ?? normalized.defaultMode, trees }, null, 2));
    return;
  }
  const printRow = (node, indent) => {
    if (node.missing) { console.log(`${indent}${node.variable}  (no coverage row names it)`); return; }
    if (node.seen) { console.log(`${indent}${node.variable}  (see above)`); return; }
    const reads = node.slots.length ? `  → ${node.slots.join(', ')}` : '';
    const via = node.via?.length ? `  via ${node.via.map((v) => v.variable).filter((v, i, a) => a.indexOf(v) === i).join(', ')}` : '';
    console.log(`${indent}${node.variable}  ${node.class}${reads}${via}`);
    if (!node.slots.length && !node.via?.length) console.log(`${indent}  ${node.note ?? node.slot}`);
    if (node.truncated) console.log(`${indent}  … (chain cut after the hop limit)`);
    for (const v of node.via ?? []) printRow(v, `${indent}  `);
  };
  console.log(`${found.target}:`);
  for (const row of found.rows) printRow(row, '  ');
  for (const tree of trees) {
    console.log('');
    printSlotHeader(tree, normalized);
    printExplain(tree.entry, tree.inputs, 0);
  }
}

/**
 * The value line of an explained slot, then its own `$description` and
 * `$deprecated` (#30), then any deprecated token further down its alias chain
 * (the TST1122 walk): the slot itself may be fine while what it is bound to is
 * on its way out.
 */
function printSlotHeader(tree, normalized) {
  console.log(`${tree.slot} = ${formatEntryValue(tree.entry)}`);
  printMeta(tree.entry, '');
  for (const { token, reason } of deprecationsReached(normalized.modes[tree.mode], tree.slot)) {
    if (token !== tree.slot) console.log(`  via deprecated ${token}${reason ? `: ${oneLine(reason)}` : ''}`);
  }
}

const oneLine = (s) => String(s).split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean).join(' ');

/** A token's own `$description` and `$deprecated` (#30), under its value line. */
function printMeta(entry, indent) {
  if (typeof entry.description === 'string' && entry.description.trim()) console.log(`${indent}  description: ${oneLine(entry.description)}`);
  if (entry.deprecated) console.log(`${indent}  deprecated${typeof entry.deprecated === 'string' ? `: ${oneLine(entry.deprecated)}` : ''}`);
}

// Round a contrast value toward zero to one decimal so a pair just under a
// threshold never prints as the threshold itself (4.47 must not read "4.5:1",
// Lc -59.96 must not read "Lc -60"). A ratio, or APCA's signed Lc.
function contrastText(row, n) {
  const v = Math.trunc(n * 10) / 10 || 0;
  return row.unit === 'Lc' ? `Lc ${v}` : `${v}:1`;
}

function formatEntryValue(entry) {
  const { type, value } = entry;
  if (type === 'color') {
    try {
      return `${formatColor(value)}  [${formatHex(value).text}]`;
    } catch {
      return formatColor(value);
    }
  }
  if (type === 'typography') {
    return `{ family: ${value.fontFamily}, size: ${value.fontSize}, weight: ${value.fontWeight}, leading: ${value.lineHeight} }`;
  }
  if (type === 'shadow') {
    return (Array.isArray(value) ? value : [value])
      .map((s) => `${s.inset ? 'inset ' : ''}${s.offsetX} ${s.offsetY} ${s.blur} ${s.spread} / ${formatColor(s.color)}`)
      .join(', ');
  }
  if (type === 'border') {
    const style = typeof value.style === 'string' ? value.style : JSON.stringify(value.style);
    return `${value.width} ${style} / ${formatColor(value.color)}`;
  }
  if (type === 'transition') {
    const easing = Array.isArray(value.timingFunction) ? `cubic-bezier(${value.timingFunction.join(', ')})` : value.timingFunction;
    return `${value.duration} ${easing} ${value.delay}`;
  }
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

const COMPOSITE_TYPES = new Set(['shadow', 'typography', 'border', 'transition']);
const isOklch = (v) => v !== null && typeof v === 'object' && ['l', 'c', 'h'].every((k) => typeof v[k] === 'number');

/**
 * An authored composite's members, one per line, each with the alias it came
 * through (`color = oklch(…)  ← {semantic.color.scrim}`). A stacked shadow
 * numbers its layers (`1.color`), the same paths diagnostics use.
 */
function printMembers(entry, indent) {
  if (!COMPOSITE_TYPES.has(entry.type) || entry.value === null || typeof entry.value !== 'object') return;
  const layered = Array.isArray(entry.value);
  const aliases = entry.provenance.members ?? {};
  (layered ? entry.value : [entry.value]).forEach((layer, i) => {
    for (const [name, v] of Object.entries(layer)) {
      const key = layered ? `${i}.${name}` : name;
      const shown = isOklch(v) ? formatEntryValue({ type: 'color', value: v }) : Array.isArray(v) ? v.join(', ') : String(v);
      console.log(`${indent}    ${key} = ${shown}${aliases[key] ? `  ← {${aliases[key]}}` : ''}`);
    }
  });
}

/** Print one node of an `explainToken()` tree: its provenance line, then its rule inputs. */
function printExplain(entry, inputs, depth) {
  const indent = '  '.repeat(depth);
  const prov = entry.provenance;
  const overrides = () => {
    if (prov.overrides?.length) console.log(`${indent}    overrides ${prov.overrides.join(', ')}  (from ${prov.layer})`);
  };
  // A token loaded from a Tokens Studio export names the set file and the
  // path the designers know it by.
  const source = () => {
    const s = prov.source;
    if (s) console.log(`${indent}    from ${s.file}${s.line ? `:${s.line}:${s.column}` : ''} (Tokens Studio set "${s.set}", ${s.path})`);
  };
  if (prov.kind === 'authored') {
    // A DTCG color object compiles to OKLCH: show what was written, since the value line no longer does.
    const raw = entry.rawValue;
    const asObject = entry.type === 'color' && !prov.expression && raw !== null && typeof raw === 'object' && !Array.isArray(raw);
    console.log(`${indent} └─ authored${asObject ? ` as ${JSON.stringify(raw)}` : ''}${prov.expression ? `  ← ${prov.expression}` : ''}`);
    source();
    overrides();
    printMembers(entry, indent);
    return;
  }
  if (prov.kind === 'aliased') {
    console.log(`${indent} └─ aliased → ${prov.target}${prov.rule ? `  (from rule ${prov.rule})` : ''}`);
    source();
    overrides();
    // The alias target (explainToken's one input here) holds the same value:
    // only its own provenance is shown, one level in.
    const [target] = inputs;
    if (target?.unresolved) console.log(`${indent}     (unresolved)`);
    else if (target?.seen) console.log(`${indent}     (see above)`);
    else if (target) printExplain(target.entry, target.inputs, depth + 2);
    return;
  }
  // derived or defaulted
  console.log(`${indent} └─ ${prov.kind} by rule ${prov.rule ?? '(catalog default)'}`);
  for (const input of inputs) {
    // An input read from another mode (`text.inverse`, `swap-neutrals`) names it.
    const path = input.mode ? `${input.path} (${input.mode})` : input.path;
    if (input.unresolved) {
      console.log(`${indent}    inputs: ${path} (unresolved)`);
    } else if (input.seen) {
      console.log(`${indent}    inputs: ${path} = ${formatEntryValue(input.entry)} (see above)`);
    } else {
      console.log(`${indent}    inputs: ${path} = ${formatEntryValue(input.entry)}`);
      printMeta(input.entry, `${indent}    `);
      printExplain(input.entry, input.inputs, depth + 2);
    }
  }
}

// ---------- diff ----------

/**
 * Semantic diff of the working tree against a git ref (default HEAD), plus
 * per-target impact. Resolves both sides with emit:false and diffs the resolved
 * graph (diffResolved) and the in-memory emitted files (docs/specs/diff.md).
 * Exit 0 = no changes; exit 1 = changes found (so it composes in CI, like `git
 * diff --exit-code`); exit 2 = usage/environment error.
 */
async function cmdDiff(args) {
  const ref = args.targets[0] ?? 'HEAD';

  // "after" = the working tree as it is now.
  let after;
  try {
    after = await compile({ cwd: args.cwd, targets: [], emit: false, loadExporter: makeLoadExporter(args.cwd) });
  } catch (e) { console.error(`✖ ${e.message}`); process.exit(2); }

  // "before" = the project at `ref`, materialized into a temp dir via git archive.
  let repoRoot;
  try {
    repoRoot = execSync('git rev-parse --show-toplevel', { cwd: args.cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch { console.error('✖ transtyle diff requires a git repository'); process.exit(2); }
  try {
    execSync(`git rev-parse --verify --quiet ${ref}^{commit}`, { cwd: repoRoot, stdio: 'ignore' });
  } catch { console.error(`✖ Unknown git ref: ${ref}`); process.exit(2); }

  // The project's path relative to the repo root, straight from git — avoids the
  // macOS /var → /private/var symlink mismatch that path.relative(toplevel, cwd)
  // would produce (toplevel is realpath'd, cwd may be the symlink).
  const prefix = execSync('git rev-parse --show-prefix', { cwd: args.cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().replace(/\/$/, '');
  const tmp = mkdtempSync(path.join(tmpdir(), 'transtyle-diff-'));
  let before;
  try {
    execSync(`git archive ${ref} ${prefix} | tar -x -C "${tmp}"`, { cwd: repoRoot, stdio: ['ignore', 'ignore', 'pipe'] });
    const beforeCwd = path.join(tmp, prefix);
    if (!existsSync(path.join(beforeCwd, 'transtyle.config.json'))) {
      console.error(`ℹ No transtyle project at ${ref} — nothing to diff against.`);
      rmSync(tmp, { recursive: true, force: true });
      process.exit(0);
    }
    // The checkout has no node_modules: resolve apca-w3 (when the config at
    // that ref selects APCA) from the project, like the exporters.
    before = await compile({ cwd: beforeCwd, targets: [], emit: false, loadExporter: makeLoadExporter(args.cwd), apcaLoader: () => loadApca(args.cwd) });
  } catch (e) {
    rmSync(tmp, { recursive: true, force: true });
    console.error(`✖ Could not resolve the project at ${ref}: ${e.message}`);
    process.exit(2);
  }
  rmSync(tmp, { recursive: true, force: true });

  const diff = diffResolved(before.normalized, after.normalized);
  const impact = diffTargets(before.results, after.results);
  const a11y = contrastRegressions(before.normalized, after.normalized, after.config, after.contrast);

  if (args.json) {
    console.log(JSON.stringify(serializeDiff(ref, diff, impact, a11y), null, 2));
  } else {
    printDiff(ref, diff, impact, a11y);
  }
  // Set exitCode rather than process.exit(): the JSON report can be tens of KB,
  // and process.exit() truncates an async stdout write to a pipe mid-flush.
  process.exitCode = diff.hasChanges ? 1 : 0;
}

/** Per-target impact: re-emit both sides (already done by compile) and diff file contents. */
function diffTargets(beforeResults, afterResults) {
  const byName = (rs) => new Map(rs.map((r) => [r.target, r]));
  const b = byName(beforeResults), a = byName(afterResults);
  const names = [...new Set([...b.keys(), ...a.keys()])].sort();
  const rows = [];
  for (const name of names) {
    const br = b.get(name), ar = a.get(name);
    if (!br) { rows.push({ target: name, status: 'new-target' }); continue; }
    if (!ar) { rows.push({ target: name, status: 'removed-target' }); continue; }
    const bf = new Map((br.emitted ?? []).map((f) => [f.path, f.contents]));
    const af = new Map((ar.emitted ?? []).map((f) => [f.path, f.contents]));
    let changedLines = 0; const samples = [];
    for (const [p, ac] of af) {
      if (p.endsWith('usage.md')) continue; // generated docs, not the theme itself
      const bc = bf.get(p);
      if (bc === ac) continue;
      const d = lineChanges(bc ?? '', ac);
      changedLines += d.length;
      for (const line of d) if (samples.length < 8) samples.push(`${p}: ${line}`);
    }
    rows.push({ target: name, status: 'changed', changedLines, samples });
  }
  return rows;
}

/** Meaningful (non-comment, non-blank) lines in `after` absent verbatim from `before`. */
function lineChanges(before, after) {
  const beforeLines = new Set(before.split('\n').map((l) => l.trim()));
  const out = [];
  for (const raw of after.split('\n')) {
    const l = raw.trim();
    if (!l || l.startsWith('*') || l.startsWith('//') || l.startsWith('/*')) continue;
    if (!beforeLines.has(l)) out.push(l);
  }
  return out;
}

function serializeDiff(ref, diff, impact, a11y = []) {
  return {
    ref,
    hasChanges: diff.hasChanges,
    contrastRegressions: a11y.map((r) => ({
      mode: r.mode, pair: `${r.fg} on ${r.bg}`, status: r.status,
      before: Number(r.before.toFixed(2)), after: Number(r.after.toFixed(2)), threshold: r.threshold,
      unit: r.unit, standard: r.standard,
    })),
    semantic: diff.modes.map((m) => ({
      mode: m.mode,
      added: m.added,
      removed: m.removed,
      changed: m.changed.map((c) => ({
        slot: c.slot,
        before: formatEntryValue(c.before),
        after: formatEntryValue(c.after),
        provenance: c.provChanged ? `${c.before.provenance.kind} → ${c.after.provenance.kind}` : c.after.provenance.kind,
      })),
    })),
    impact: impact.map((r) => ({ target: r.target, status: r.status, changedLines: r.changedLines ?? 0 })),
  };
}

function printDiff(ref, diff, impact, a11y = []) {
  if (!diff.hasChanges) {
    console.error(`No semantic changes vs ${ref} — compiled themes are identical.`);
    return;
  }
  console.error(`Semantic diff vs ${ref}:\n`);
  for (const m of diff.modes) {
    if (!m.added.length && !m.removed.length && !m.changed.length) continue;
    console.error(`[${m.mode}]`);
    for (const s of m.added) console.error(`  + ${s}`);
    for (const s of m.removed) console.error(`  - ${s}`);
    for (const c of m.changed) {
      const prov = c.provChanged ? `  (${c.before.provenance.kind} → ${c.after.provenance.kind})` : '';
      console.error(`  ~ ${c.slot}  ${formatEntryValue(c.before)} → ${formatEntryValue(c.after)}${prov}`);
    }
    console.error('');
  }
  console.error('Per-target impact:');
  for (const r of impact) {
    if (r.status === 'new-target') { console.error(`  ${r.target}: new target (not present at ${ref})`); continue; }
    if (r.status === 'removed-target') { console.error(`  ${r.target}: removed since ${ref}`); continue; }
    if (!r.changedLines) { console.error(`  ${r.target}: no output change`); continue; }
    console.error(`  ${r.target}: ${r.changedLines} line${r.changedLines === 1 ? '' : 's'} changed`);
    for (const s of r.samples) console.error(`      ${s}`);
  }

  // Last, so it stays on screen: this change's accessibility cost.
  if (a11y.length) {
    const regressed = a11y.filter((r) => r.status === 'regressed');
    console.error(`\n⚠ Contrast ${regressed.length ? 'regressions' : 'changes'}:`);
    for (const r of a11y) {
      const verb = r.status === 'regressed' ? 'now FAILS' : 'still fails';
      console.error(`  ${r.status === 'regressed' ? '✖' : '⚠'} ${r.fg} on ${r.bg} (${r.mode}): ${contrastText(r, r.before)} → ${contrastText(r, r.after)} — ${verb} ${r.unit === 'Lc' ? `Lc ${r.threshold}` : `${r.threshold}:1`}`);
    }
    if (regressed.length) {
      console.error(`\n  ${regressed.length} pair${regressed.length === 1 ? '' : 's'} passed before this change and fail${regressed.length === 1 ? 's' : ''} after it.`);
    }
  }
}

// ---------- catalog ----------

/**
 * The semantic contract as data (core's catalog(), docs/specs/cli.md). Needs
 * no project: the catalog belongs to the IR spec and the rule pack, so it
 * reads no config and ignores --cwd. Requested data, so stdout either way.
 */
function cmdCatalog(args) {
  if (args.targets.length) {
    console.error(`✖ transtyle catalog takes no arguments (got: ${args.targets.join(' ')})\n  Usage: transtyle catalog [--json]`);
    process.exit(2);
  }
  const cat = catalog();
  if (args.json) {
    console.log(JSON.stringify(cat, null, 2));
    return;
  }
  const { counts } = cat;
  console.log(`Transtyle catalog — IR spec ${cat.irSpec}, rule pack ${cat.rulePack}`);
  console.log(`${counts.slots} slots: ${counts.semantic} semantic, ${counts.component} component (${counts.derived} derived, ${counts.defaulted} defaulted, ${counts.authoredOnly} authored only)`);
  const groups = new Map();
  for (const s of cat.slots) {
    const key = `${s.tier} · ${s.group}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  for (const [key, slots] of groups) {
    console.log(`\n${key} (${slots.length})`);
    const width = Math.max(...slots.map((s) => s.path.length));
    const typeWidth = Math.max(...slots.map((s) => s.type.length));
    for (const s of slots) {
      const how = s.kind === 'authored-only' ? 'author it' : `${s.kind} by ${s.rule}`;
      const needs = s.requires.length ? `  (needs ${s.requires.join(', ')})` : '';
      console.log(`  ${s.path.padEnd(width)}  ${s.type.padEnd(typeWidth)}  ${how}${needs}`);
    }
  }
}

// ---------- init ----------

/**
 * Flags first (validated before any question or write), then the questions
 * no flag answered, on a terminal only: without one, `init` never waits on
 * stdin, so scripts and CI get the defaults. Then the files, then a check of
 * what was written (docs/specs/cli.md, "init").
 */
async function cmdInit(args) {
  const known = Object.keys(OFFICIAL_EXPORTERS);
  const configPath = path.join(args.cwd, 'transtyle.config.json');
  if (existsSync(configPath)) {
    console.error(`✖ transtyle.config.json already exists at ${configPath}`);
    process.exit(2);
  }
  const { given, errors } = validateFlags(args.init ?? {}, known);
  if (errors.length) {
    for (const e of errors) console.error(`✖ ${e}`);
    process.exit(2);
  }

  const interactive = !args.yes && Boolean(process.stdin.isTTY && process.stderr.isTTY);
  const color = Boolean(process.stderr.isTTY) && !process.env.NO_COLOR;
  let answers = { ...INIT_DEFAULTS, ...given };
  if (interactive) {
    try {
      answers = { ...INIT_DEFAULTS, ...(await promptAnswers(given, known, { input: process.stdin, output: process.stderr, color })) };
    } catch (e) {
      if (e.code !== 'input-ended') throw e;
      console.error(`\n✖ init cancelled: ${e.message}; nothing was written.`);
      process.exit(2);
    }
  }

  const name = args.targets[0] ?? path.basename(args.cwd) ?? 'design-system';
  const files = scaffold({ name, ...answers });
  const taken = files.filter((f) => existsSync(path.join(args.cwd, f.path))).map((f) => f.path);
  if (taken.length) {
    console.error(`✖ ${taken.join(', ')} already exist${taken.length === 1 ? 's' : ''} in ${args.cwd}; nothing was written.`);
    process.exit(2);
  }
  for (const f of files) {
    mkdirSync(path.dirname(path.join(args.cwd, f.path)), { recursive: true });
    writeFileSync(path.join(args.cwd, f.path), f.contents);
  }
  console.error(`✔ created ${files.map((f) => f.path).join(', ')} in ${args.cwd}`);
  console.error(`  preset ${answers.preset}, layout ${answers.layout}, schemes ${answers.schemes.join(' + ')}, targets ${answers.targets.join(', ')}\n`);

  // The closing check: the same pipeline as `transtyle check`, on what was
  // just written. Its findings are reported, not fatal: the files are the user's now.
  let result;
  try {
    result = await compile({ cwd: args.cwd, targets: [], emit: false, loadExporter: makeLoadExporter(args.cwd), knownExporters: known, debug: VERBOSE });
  } catch (e) {
    console.error(`✖ ${e.message}`);
    process.exitCode = 1;
    return;
  }
  const { diagnostics, normalized } = result;
  for (const d of diagnostics.items) printDiagnostic(d);
  const count = (s) => diagnostics.items.filter((d) => d.severity === s).length;
  const [nErr, nWarn, nInfo] = ['error', 'warning', 'info'].map(count);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  console.error(`${nErr ? '✖' : '✔'} check: ${plural(nErr, 'error')}, ${plural(nWarn, 'warning')}, ${plural(nInfo, 'note')}`);
  if (nErr) process.exitCode = 1;

  const mode = normalized?.modes[normalized.defaultMode];
  const solid = mode?.get('semantic.color.primary.solid')?.value;
  const onSolid = mode?.get('semantic.color.primary.on-solid')?.value;
  if (solid && onSolid) console.error(`\n  ${swatch(solid, onSolid, color)}`);

  const darkFile = files.find((f) => f.path.includes('.dark.'))?.path;
  console.error(`
Next steps:
  1. Replace the TODO placeholders in tokens/brand.tokens.json with your own values${darkFile ? ` (their dark values are in ${darkFile})` : ''}.
  2. npx transtyle build
  3. npx transtyle add <target>   (${known.join(', ')})
Worth authoring next (each derives until you do):
${authorNext(answers.preset).map((l) => `  - ${l}`).join('\n')}
  npx transtyle check --completeness ${answers.preset === 'minimal' ? 'recommended' : 'complete'} lists them in order, with what is still missing.`);
}

// ---------- add ----------

async function cmdAdd(args) {
  const target = args.targets[0];
  if (!target) { console.error('Usage: transtyle add <target>'); process.exit(2); }
  if (!(target in OFFICIAL_EXPORTERS)) {
    console.error(`✖ Unknown target: ${target}\nValid targets: ${Object.keys(OFFICIAL_EXPORTERS).join(', ')}`);
    process.exit(2);
  }
  const configPath = path.join(args.cwd, 'transtyle.config.json');
  if (!existsSync(configPath)) {
    console.error(`✖ No transtyle.config.json in ${args.cwd} — run "transtyle init" first`);
    process.exit(2);
  }
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  config.targets ??= {};
  if (config.targets[target]) {
    console.error(`✖ Target "${target}" is already configured`);
    process.exit(2);
  }
  config.targets[target] = targetEntry(target);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.error(`✔ added target "${target}" → dist/${target}\n\nBuild it: npx transtyle build ${target}`);
}

main();
