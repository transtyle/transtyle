#!/usr/bin/env node
/**
 * AL3 — the coverage bar: make "ALL tokens mapped" measurable and enforced.
 *
 * For the two component-heavy targets, every slot of the target's documented
 * theming surface must be ACCOUNTED FOR in the emitted report, and nothing may
 * be silently absent or silently unsupported:
 *
 *   1. Completeness — the report's rows cover every slot in the target's
 *      checked-in surface inventory. Bootstrap reports one row per variable
 *      (657); PrimeNG reports per-family counts whose sums must equal the
 *      inventory's per-family totals (2759 slots across 98 families), so a
 *      dropped slot shows up as an arithmetic mismatch, not a silent gap.
 *   2. Honesty — every `unsupported` or `dropped` row carries a note saying
 *      why. "Zero silent unsupported" is the bar, not "zero unsupported":
 *      a target we cannot fully drive must say so, per principle 3.
 *   3. Both are checked on ALL FOUR examples, with the two real adopted design
 *      systems (Carbon, GOV.UK) as the big-DS proof.
 *
 * Run: node scripts/check-coverage-bar.mjs (also: npm run check:coverage-bar).
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLES = ['acme', 'cathode', 'govuk', 'carbon'];
const errors = [];
const summary = [];

const bsInventory = JSON.parse(
  readFileSync(join(root, 'packages/exporter-bootstrap/surface-inventory.json'), 'utf8'),
);
const pnInventory = JSON.parse(
  readFileSync(join(root, 'packages/exporter-primeng/surface-inventory.json'), 'utf8'),
);

// Drift guard for the PrimeNG inventory (Bootstrap's lives in
// check-bootstrap-surface.mjs): the checked-in denominator must match a fresh
// extraction from the installed Aura preset, or the bar measures a stale surface.
{
  const { extractSurface } = await import(
    join(root, 'packages/exporter-primeng/tools/extract-surface.mjs')
  );
  const fresh = await extractSurface();
  if (JSON.stringify(fresh) !== JSON.stringify(pnInventory)) {
    errors.push(
      fresh.themesVersion !== pnInventory.themesVersion
        ? `primeng inventory was extracted from @primeuix/themes@${pnInventory.themesVersion} but @${fresh.themesVersion} is installed`
        : 'primeng surface-inventory.json drifted from a fresh extraction',
      '→ regenerate: node packages/exporter-primeng/tools/extract-surface.mjs --write (and review the diff)',
    );
  }
}

for (const example of EXAMPLES) {
  execSync(`npx transtyle build --cwd examples/${example}`, { cwd: root, stdio: 'pipe' });

  // ---- Bootstrap: one row per in-inventory variable ----
  const bsPath = join(root, 'examples', example, 'dist/bootstrap/report.json');
  if (!existsSync(bsPath)) {
    errors.push(`${example}: no bootstrap report.json`);
  } else {
    const items = JSON.parse(readFileSync(bsPath, 'utf8')).coverage.items;
    const reported = new Set(items.map((i) => i.variable));
    const missing = bsInventory.variables
      .filter((v) => v.scope === 'component' && !reported.has(`$${v.name}`))
      .map((v) => v.name);
    if (missing.length) {
      errors.push(
        `${example}/bootstrap: ${missing.length} inventoried variable(s) have no coverage row, e.g. $${missing.slice(0, 3).join(', $')}`,
      );
    }
    const silent = items.filter((i) => ['unsupported', 'dropped'].includes(i.class) && !i.note);
    if (silent.length) {
      errors.push(
        `${example}/bootstrap: ${silent.length} ${silent[0].class} row(s) with no note — e.g. ${silent[0].variable}`,
      );
    }
    const counts = tally(items);
    summary.push([example, 'bootstrap', bsInventory.counts.component, counts]);
  }

  // ---- PrimeNG: per-family counts must reconcile to the inventory ----
  const pnPath = join(root, 'examples', example, 'dist/primeng/report.json');
  if (!existsSync(pnPath)) {
    errors.push(`${example}: no primeng report.json`);
  } else {
    const items = JSON.parse(readFileSync(pnPath, 'utf8')).coverage.items;
    const familyRows = new Map();
    for (const i of items) {
      const m = /^([a-z]+)\.\* \((\d+) slots\)$/.exec(i.variable);
      if (m) familyRows.set(m[1], { declared: Number(m[2]), row: i });
    }
    for (const [family, total] of Object.entries(pnInventory.counts.families)) {
      const got = familyRows.get(family);
      if (!got)
        errors.push(`${example}/primeng: family "${family}" (${total} slots) has no coverage row`);
      else if (got.declared !== total) {
        errors.push(
          `${example}/primeng: family "${family}" reports ${got.declared} slots, inventory has ${total}`,
        );
      } else {
        const parts = [...String(got.row.slot).matchAll(/(\d+)\s+(driven|inherited|on)/g)].map(
          (x) => Number(x[1]),
        );
        const sum = parts.reduce((a, b) => a + b, 0);
        if (parts.length === 3 && sum !== total) {
          errors.push(
            `${example}/primeng: family "${family}" counts sum to ${sum}, expected ${total} — a slot is unaccounted for`,
          );
        }
      }
    }
    const silent = items.filter((i) => ['unsupported', 'dropped'].includes(i.class) && !i.note);
    if (silent.length) {
      errors.push(
        `${example}/primeng: ${silent.length} ${silent[0].class} row(s) with no note — e.g. ${silent[0].variable}`,
      );
    }
    const totals = items.find((i) => i.variable === 'PrimeNG surface totals');
    if (!totals) errors.push(`${example}/primeng: no surface totals row`);
    summary.push([example, 'primeng', pnInventory.counts.total, tally(items), totals?.slot]);
  }
}

function tally(items) {
  const c = {};
  for (const i of items) c[i.class] = (c[i.class] ?? 0) + 1;
  return c;
}

console.log('\nAL3 coverage bar — measured against each target’s checked-in surface inventory\n');
for (const [example, target, surfaceSize, counts, note] of summary) {
  const cls = Object.entries(counts)
    .map(([k, v]) => `${v} ${k}`)
    .join(' · ');
  console.log(
    `  ${example.padEnd(8)} ${target.padEnd(10)} surface ${String(surfaceSize).padStart(5)} slots  →  ${cls}`,
  );
  if (note) console.log(`  ${''.padEnd(19)} ${note}`);
}

if (errors.length) {
  console.error(`\n✖ check-coverage-bar failed — ${errors.length} issue(s):\n`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(
  `\n✔ coverage bar: every slot of both targets’ documented surfaces is accounted for on all ${EXAMPLES.length} examples; no silent unsupported\n`,
);
