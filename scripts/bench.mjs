#!/usr/bin/env node
/**
 * The compiler at scale: wall time per stage and per exporter, and peak memory,
 * on synthetic design systems from 1,000 to 100,000 tokens (issue #97).
 *
 * Why this exists: every example has tens of tokens, enterprise systems have
 * thousands, and nothing measured the difference, so a regression from 200 ms
 * to 20 s would have shipped unnoticed. Its first runs found two defects that
 * no example could reach: an alias chain of ~4,500 links overflowed the stack
 * (`Maximum call stack size exceeded`, no code, no token named), and once that
 * was fixed, the out-of-gamut check walked every chain from every token, so a
 * 10,000-link chain took 50 s instead of half a second.
 *
 * Each case is a project from lib/large-ds.mjs (deterministic, written to a temp
 * directory, never to the repository), measured in its own child process so
 * peak RSS is that case's own. Per case: one warm-up compile, then `--runs`
 * measured ones (default 5), and the median is printed.
 *
 *   - **compile**: `compile({ emit: false })` with every official exporter,
 *     loaded from its workspace source; what `transtyle check` does.
 *   - **exporters**: each exporter's `emit()`, timed inside that same compile.
 *   - **stages**: LOAD (config, token files, bindings), NORMALIZE, DERIVE,
 *     ALIASES (deferred aliases and the reports that need them), CHECKS. Core
 *     has no stage hooks, so these come from a second run that calls the
 *     stage functions in compile()'s order. What they and the exporters do
 *     not cover is the **other** column: compile() minus both, today mostly
 *     the recording of each exporter's reads (src/reads.js) and the reports.
 *     If compile() gains a stage, it shows up there.
 *
 * Timings depend on the machine and on what else it is doing, so no number
 * here is a promise: `check:perf` (scripts/check-perf.mjs) is the guard, with
 * budgets wide enough for CI runners. Record a run you quote in
 * docs/findings/performance.md with its machine, Node version and date.
 *
 * Run: npm run bench                     (the whole matrix, ~1 min)
 *      npm run bench -- --runs 10        (more runs per case)
 *      npm run bench -- --case '{"tokens":20000,"layers":5,"combos":2,"chain":10,"roles":0}'
 */
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { root, localExporter } from './lib/compile-examples.mjs';
import { writeLargeDesignSystem, TARGETS } from './lib/large-ds.mjs';

const core = (file) => import(pathToFileURL(join(root, 'packages/core/src', file)).href);

/** The issue's matrix, plus a deep chain and many roles (DERIVE scales with roles, not tokens). */
const CASES = [
  { tokens: 1000, layers: 3, combos: 1, chain: 10, roles: 0 },
  { tokens: 1000, layers: 20, combos: 4, chain: 10, roles: 0 },
  { tokens: 10000, layers: 3, combos: 1, chain: 10, roles: 0 },
  { tokens: 10000, layers: 20, combos: 4, chain: 10, roles: 0 },
  { tokens: 10000, layers: 100, combos: 4, chain: 10, roles: 0 },
  { tokens: 10000, layers: 20, combos: 4, chain: 10000, roles: 0 },
  { tokens: 10000, layers: 20, combos: 4, chain: 10, roles: 500 },
  { tokens: 50000, layers: 20, combos: 4, chain: 10, roles: 0 },
  { tokens: 100000, layers: 20, combos: 4, chain: 10, roles: 0 },
];

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const runs = Number(flag('--runs') ?? 5);
if (!Number.isInteger(runs) || runs < 1) {
  console.error(`✖ --runs must be a positive integer, got ${flag('--runs')}`);
  process.exit(2);
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** One compile with every exporter's emit() timed. */
async function timedCompile(compile, cwd) {
  const emits = {};
  const loadExporter = async (name) => {
    const exporter = await localExporter(name);
    return {
      ...exporter,
      emit(view, ctx) {
        const t = performance.now();
        try {
          return exporter.emit(view, ctx);
        } finally {
          emits[name] = performance.now() - t;
        }
      },
    };
  };
  const t = performance.now();
  const result = await compile({ cwd, emit: false, loadExporter });
  const total = performance.now() - t;
  const errors = result.diagnostics.errors;
  if (errors.length) {
    throw new Error(`the synthetic project does not compile:\n${errors.slice(0, 5).map((d) => `    ${d.code} ${d.message}`).join('\n')}`);
  }
  return { total, emits };
}

/** The shared stages, called in compile()'s order (see the header). */
async function timedStages(cwd) {
  const [{ Diagnostics }, load, { expandBindings }, norm, der, { runChecks }, { fillLocations }] = await Promise.all(
    ['diagnostics.js', 'load.js', 'bindings.js', 'normalize.js', 'derive.js', 'checks.js', 'locations.js'].map(core),
  );
  const out = {};
  let t = performance.now();
  const lap = (name) => {
    const now = performance.now();
    out[name] = now - t;
    t = now;
  };
  const diagnostics = new Diagnostics();
  const { config } = await load.loadConfig(cwd);
  const trees = await load.loadTokenTrees(cwd, config.tokens, diagnostics);
  const bindings = expandBindings(trees, config, diagnostics);
  if (bindings && bindings.aliases.length > 0) {
    trees.push({ file: 'transtyle.config.json (bindings)', tree: bindings.tree, modeScope: undefined, bindingRules: bindings.rules });
  }
  lap('load');
  const normalized = norm.normalize(trees, config, diagnostics);
  lap('normalize');
  const { underived } = der.derive(normalized, config, diagnostics);
  lap('derive');
  norm.resolveDeferredAliases(normalized, diagnostics);
  norm.reportTierViolations(normalized, diagnostics);
  der.reportUnderived(normalized, underived, diagnostics);
  norm.reportModeCarryOver(normalized, config, diagnostics);
  lap('aliases');
  runChecks(normalized, config, diagnostics);
  fillLocations(diagnostics.items, normalized.sources);
  diagnostics.applySuppressions(config.check?.suppress);
  lap('checks');
  return out;
}

/** Child side: measure one case, print one JSON line. */
async function measureCase(spec) {
  const { compile } = await core('index.js');
  const dir = writeLargeDesignSystem(spec);
  try {
    await timedCompile(compile, dir); // warm-up: module loading, JIT
    await timedStages(dir);
    const totals = [];
    const emits = {};
    const stages = {};
    for (let i = 0; i < runs; i++) {
      const r = await timedCompile(compile, dir);
      totals.push(r.total);
      for (const [k, v] of Object.entries(r.emits)) (emits[k] ??= []).push(v);
      for (const [k, v] of Object.entries(await timedStages(dir))) (stages[k] ??= []).push(v);
    }
    const med = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, median(v)]));
    return { spec, compile: median(totals), emits: med(emits), stages: med(stages), rssMB: process.resourceUsage().maxRSS / 1024 };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const caseFlag = flag('--case');
if (caseFlag && args.includes('--child')) {
  console.log(JSON.stringify(await measureCase(JSON.parse(caseFlag))));
  process.exit(0);
}

const specs = caseFlag ? [JSON.parse(caseFlag)] : CASES;
const self = fileURLToPath(import.meta.url);
const results = [];
for (const spec of specs) {
  const label = `${spec.tokens} tokens, ${spec.layers} layers, ${spec.combos} combo${spec.combos > 1 ? 's' : ''}, chain ${spec.chain}${spec.roles ? `, ${spec.roles} roles` : ''}`;
  process.stderr.write(`  ${label} …\n`);
  const child = spawnSync(process.execPath, [self, '--child', '--case', JSON.stringify(spec), '--runs', String(runs)], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (child.status !== 0) {
    console.error(`✖ ${label}: exit ${child.status}\n${child.stderr}`);
    process.exit(1);
  }
  results.push(JSON.parse(child.stdout.trim().split('\n').at(-1)));
}

const ms = (n) => (n < 10 ? n.toFixed(1) : Math.round(n).toLocaleString('en-US'));
const k = (n) => (n >= 1000 ? `${n / 1000}k` : String(n));
const caseCell = ({ spec }) => `${k(spec.tokens)} / ${spec.layers} / ${spec.combos} / ${k(spec.chain)}${spec.roles ? ` / ${spec.roles} roles` : ''}`;
const STAGES = ['load', 'normalize', 'derive', 'aliases', 'checks'];

console.log(`\nNode ${process.version}, ${process.platform}-${process.arch}; median of ${runs} run${runs > 1 ? 's' : ''} after one warm-up, in ms. Case: tokens / layers / mode combos / alias chain.\n`);
console.log(`| Case | compile, ${TARGETS.length} targets | ${STAGES.map((s) => s.toUpperCase()).join(' | ')} | exporters | other | peak RSS |`);
console.log(`| --- | ---: | ${STAGES.map(() => '---:').join(' | ')} | ---: | ---: | ---: |`);
for (const r of results) {
  const exporters = Object.values(r.emits).reduce((a, b) => a + b, 0);
  const other = r.compile - exporters - STAGES.reduce((a, s) => a + r.stages[s], 0);
  console.log(`| ${caseCell(r)} | ${ms(r.compile)} | ${STAGES.map((s) => ms(r.stages[s])).join(' | ')} | ${ms(exporters)} | ${ms(Math.max(0, other))} | ${Math.round(r.rssMB)} MB |`);
}
console.log(`\n| Case | ${TARGETS.join(' | ')} |`);
console.log(`| --- | ${TARGETS.map(() => '---:').join(' | ')} |`);
for (const r of results) console.log(`| ${caseCell(r)} | ${TARGETS.map((t) => ms(r.emits[t] ?? NaN)).join(' | ')} |`);
