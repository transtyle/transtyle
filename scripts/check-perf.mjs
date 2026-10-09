#!/usr/bin/env node
/**
 * The compiler's budget at scale (issue #97): a 10,000-token design system with
 * four mode combinations and two 10,000-link alias chains compiles with every
 * official exporter, without an error, in time and in memory.
 *
 * Why this exists: every example has tens of tokens, so nothing in check:all
 * ever compiled a large design system, and the benchmark's first runs found two
 * defects at once. An alias chain of ~4,500 links overflowed the stack: the
 * resolver recursed once per link, and `transtyle check` printed
 * `Maximum call stack size exceeded`, exit 2, no code, no token. With that
 * fixed, the out-of-gamut check walked each chain again from every token on
 * it, so the 10,000-link chain took 50 s. Both are invisible at example size.
 *
 * Two halves:
 *   1. **Deterministic**: the large project compiles with zero errors, every
 *      target emits, and both chain heads resolve in every mode combination to
 *      the value at the chain's end. That half fails the same way on any
 *      machine.
 *   2. **Budget**: median compile time (5 runs after a warm-up) under
 *      BUDGET_MS, at most MAX_RATIO times the same project at 1,000 tokens and
 *      1,000-link chains, and peak RSS under MAX_RSS_MB. The ratio is what
 *      catches a quadratic stage on any machine: linear growth keeps it near
 *      10, the 50 s regression put it in the thousands. The absolute ceiling
 *      catches what the ratio cannot, a slowdown that hits both sizes alike.
 *
 * Both budgets are an order of magnitude above a normal run, so a busy runner
 * does not fail them and only a regression of that size does. They are timing,
 * though, which is why this check is **not in check:all** (a laptop on battery
 * must not turn the everyday suite red): CI runs it as its own step in
 * .github/workflows/ci.yml, and `npm run check:perf` runs it locally. When it
 * fails, `npm run bench` shows which stage or exporter moved.
 *
 * Validated by reverting each fix: with the recursive resolver the deterministic
 * half fails on the stack overflow; with aliasRoot() unmemoized the 10k case
 * misses BUDGET_MS and MAX_RATIO.
 *
 * Run: node scripts/check-perf.mjs   (npm run check:perf)
 */
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { root, localExporter } from './lib/compile-examples.mjs';
import { writeLargeDesignSystem, TARGETS } from './lib/large-ds.mjs';

/** Median compile of the large case. Local (Apple M4 Pro, under load): 0.4–1.7 s. */
const BUDGET_MS = 10_000;
/** Large case over the 1,000-token case. Linear: ~10. */
const MAX_RATIO = 40;
/** Peak resident memory of this process. Local, under load: 0.4–0.7 GB. */
const MAX_RSS_MB = 1024;
const RUNS = 5;

const LARGE = { tokens: 10000, layers: 20, combos: 4, chain: 10000, roles: 0 };
const SMALL = { tokens: 1000, layers: 20, combos: 4, chain: 1000, roles: 0 };
const CHAIN_ENDS = {
  'semantic.chain.authored.l0': 'option.color.hue-1.500',
  'semantic.chain.derived.l0': 'semantic.color.primary.solid-hover',
};

const { compile } = await import(pathToFileURL(join(root, 'packages/core/src/index.js')).href);
const failures = [];
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/**
 * Compile `spec` RUNS times after a warm-up; the last result and the median
 * time. A warm-up already over budget stops there (`once`): a quadratic stage
 * can take minutes per compile, and one is enough to fail.
 */
async function measure(spec) {
  const dir = writeLargeDesignSystem(spec);
  try {
    let result;
    const times = [];
    for (let i = 0; i <= RUNS; i++) {
      const t = performance.now();
      result = await compile({ cwd: dir, emit: false, loadExporter: localExporter });
      const ms = performance.now() - t;
      if (i === 0 && ms > BUDGET_MS) return { result, ms, once: true };
      if (i > 0) times.push(ms);
    }
    return { result, ms: median(times) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const label = (s) => `${fmt(s.tokens)} tokens, ${s.combos} mode combos, ${fmt(s.chain)}-link chains`;
let large;
let small;
try {
  small = await measure(SMALL);
  large = await measure(LARGE);
} catch (e) {
  console.error(`✖ perf check: compile() threw ${e.name}: ${e.message}`);
  if (e instanceof RangeError) {
    console.error('  A stack overflow at scale is a recursion per token or per alias link: the frames below name the function.');
    console.error('  Walk it in a loop, as resolveEntry() in packages/core/src/normalize.js does.');
    console.error(e.stack.split('\n').slice(1, 6).join('\n'));
  }
  process.exit(1);
}

// 1. Deterministic.
const { result } = large;
for (const d of result.diagnostics.errors) failures.push(`${d.code} ${d.message} — the synthetic project must compile clean (scripts/lib/large-ds.mjs)`);
for (const target of TARGETS) {
  const r = result.results.find((x) => x.target === target);
  if (!r?.emitted?.length) failures.push(`${target}: emitted nothing for ${label(LARGE)} — see the TST3001 diagnostic or run \`npm run bench\``);
}
const combos = result.normalized?.allCombos ?? [];
if (combos.length !== LARGE.combos) failures.push(`expected ${LARGE.combos} mode combinations, got ${combos.length}`);
for (const key of combos) {
  const map = result.normalized.modes[key];
  for (const [head, end] of Object.entries(CHAIN_ENDS)) {
    const got = map.get(head);
    const want = map.get(end)?.value;
    if (got?.provenance?.kind !== 'aliased' || want === undefined || JSON.stringify(got.value) !== JSON.stringify(want)) {
      failures.push(`${head} (${key}): ${fmt(LARGE.chain)} links should resolve to ${end}'s value, got ${JSON.stringify(got?.value)} (${got?.provenance?.kind ?? 'missing'}) — resolveEntry()/resolvePending() in packages/core/src/normalize.js`);
    }
  }
}

// 2. Budget.
const ratio = large.ms / small.ms;
const rssMB = process.resourceUsage().maxRSS / 1024;
const fix = 'run `npm run bench` to see which stage or exporter moved, then `node --cpu-prof scripts/check-perf.mjs` for the function';
if (large.ms > BUDGET_MS) failures.push(`${label(LARGE)}: ${large.once ? 'one compile' : 'median compile'} ${fmt(large.ms)} ms, budget ${fmt(BUDGET_MS)} ms — ${fix}`);
if (ratio > MAX_RATIO) failures.push(`${label(LARGE)} took ${ratio.toFixed(1)}× the ${fmt(SMALL.tokens)}-token case (${fmt(large.ms)} vs ${fmt(small.ms)} ms), budget ${MAX_RATIO}×: something grows faster than linearly — ${fix}`);
if (rssMB > MAX_RSS_MB) failures.push(`peak RSS ${fmt(rssMB)} MB, budget ${MAX_RSS_MB} MB — run \`npm run bench\` for each case's peak`);

if (failures.length) {
  console.error(`✖ perf check: ${failures.length} problem${failures.length > 1 ? 's' : ''}`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `✔ perf check: ${label(LARGE)}, ${TARGETS.length} targets, 0 errors, both chains resolved in all ${combos.length} combos; ` +
    `median compile ${fmt(large.ms)} ms (budget ${fmt(BUDGET_MS)}), ${ratio.toFixed(1)}× the ${fmt(SMALL.tokens)}-token case (budget ${MAX_RATIO}×), ` +
    `peak RSS ${fmt(rssMB)} MB (budget ${MAX_RSS_MB})`,
);
