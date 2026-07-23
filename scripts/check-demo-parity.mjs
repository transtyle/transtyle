#!/usr/bin/env node
/**
 * The demo harness's central claim, mechanized: **every example's demo for a
 * given target is the same application.** Only `dist/` differs.
 *
 * That is what makes the demos a comparison rather than four unrelated pages —
 * put Acme's Bootstrap demo next to Carbon's and every visible difference is
 * attributable to the design system, because the markup, the components, and
 * the interactions are byte-identical. A section quietly added to one example's
 * demo and not the others silently destroys that property, and nothing was
 * watching: this checker exists because exactly that happened while adding a
 * tooltip to Acme (three files drifted before anyone noticed).
 *
 * Rule: for each target, every demo source file must be byte-identical across
 * all four examples, except the declared per-example files below.
 *
 * Run: node scripts/check-demo-parity.mjs   (npm run check:demo-parity)
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Files that legitimately differ per example — keep this list tiny and
 * justified, exactly like check-sync's exceptions.
 */
const PER_EXAMPLE = [
  // The design system's own identity: label, font stylesheet, default mode.
  // Generated per example; it is the one thing a demo is *supposed* to know.
  /(^|\/)ds\.config\.(js|ts)$/,
  // Radix's `<Theme accentColor>` prop only accepts Radix's own preset names,
  // so each example aliases a different one onto our primary ramp (violet for
  // Acme, green for Cathode, blue for GOV.UK, indigo for Carbon). A real
  // per-design-system mapping, not drift.
  /(^|\/)theme-override\.css$/,
];

const SOURCE_EXT = /\.(html|ts|tsx|js|jsx|css|scss|mdx)$/;
// Build output and tool caches are not sources.
const SKIP_DIR = new Set(['node_modules', 'dist', '.angular', 'storybook-static', '.vite']);

const examples = readdirSync(join(root, 'examples'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(root, 'examples', d.name, 'transtyle.config.json')))
  .map((d) => d.name);

function walk(dir, base, out = []) {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (d.isDirectory()) {
      if (!SKIP_DIR.has(d.name)) walk(join(dir, d.name), base, out);
    } else if (SOURCE_EXT.test(d.name)) {
      out.push(relative(base, join(dir, d.name)));
    }
  }
  return out;
}

const errors = [];
const [reference, ...others] = examples;
const refDemoDir = join(root, 'examples', reference, 'demo');
const targets = existsSync(refDemoDir)
  ? readdirSync(refDemoDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [];

let compared = 0;
for (const target of targets) {
  const refDir = join(refDemoDir, target);
  for (const rel of walk(refDir, refDir)) {
    if (PER_EXAMPLE.some((re) => re.test(rel))) continue;
    const refText = readFileSync(join(refDir, rel), 'utf8');
    compared++;
    for (const ex of others) {
      const other = join(root, 'examples', ex, 'demo', target, rel);
      if (!existsSync(other)) {
        errors.push(`${ex}/demo/${target}/${rel} is missing — ${reference} has it, so the demos are no longer the same app`);
        continue;
      }
      if (readFileSync(other, 'utf8') !== refText) {
        errors.push(`${ex}/demo/${target}/${rel} differs from ${reference}'s copy — demo sources must be identical across examples (only dist/ may differ)`);
      }
    }
  }
  // A file present in another example but not the reference is drift too.
  for (const ex of others) {
    const dir = join(root, 'examples', ex, 'demo', target);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    for (const rel of walk(dir, dir)) {
      if (PER_EXAMPLE.some((re) => re.test(rel))) continue;
      if (!existsSync(join(refDir, rel))) {
        errors.push(`${ex}/demo/${target}/${rel} exists but ${reference}'s demo has no such file — add it there too, or remove it`);
      }
    }
  }
}

if (errors.length) {
  console.error(`✘ demo parity: ${errors.length} problem(s)`);
  for (const e of errors) console.error('  - ' + e);
  console.error(`\n  Every example's demo for a target must be the SAME application — that is what`);
  console.error('  makes them a comparison instead of four unrelated pages. Change one, change all four');
  console.error(`  (only ds.config.* and Radix's theme-override.css may legitimately differ).`);
  process.exit(1);
}
console.log(`✔ demo parity: ${compared} demo source files identical across all ${examples.length} examples (${targets.length} targets); only dist/ differs`);
