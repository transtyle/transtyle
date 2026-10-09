#!/usr/bin/env node
/**
 * AL3 — the coverage bar: make "ALL tokens mapped" measurable and enforced.
 *
 * For every target with a checked-in surface inventory, every slot of the
 * target's documented theming surface must be ACCOUNTED FOR in the emitted
 * report, and nothing may be silently absent or silently unsupported:
 *
 *   1. Completeness — the report's rows cover every slot in the target's
 *      checked-in surface inventory. Bootstrap reports one row per variable
 *      (657); PrimeNG reports per-family counts whose sums must equal the
 *      inventory's per-family totals (2759 slots across 98 families), so a
 *      dropped slot shows up as an arithmetic mismatch, not a silent gap.
 *      Mantine and Chakra are between the two (graph-shaped surfaces, one
 *      rule for both, GRAPH_TARGETS below): their families (Mantine's theme
 *      object and resolver blocks; Chakra's tokens, semantic tokens, styles
 *      and recipes) are reconciled by arithmetic like PrimeNG's, and every
 *      entry left on the target's default gets its own named row like
 *      Bootstrap's, so the count of those rows must equal the family's
 *      "on <target>'s default" count. A derived family (Chakra's recipes)
 *      has no named rows: its defaults must be exactly the entries that read
 *      a named default, less the ones the exporter sets.
 *   2. Honesty — every `unsupported` or `dropped` row carries a note saying
 *      why. "Zero silent unsupported" is the bar, not "zero unsupported":
 *      a target we cannot fully drive must say so, per principle 3.
 *   3. Both are checked on ALL FOUR examples, with the two real adopted design
 *      systems (Carbon, GOV.UK) as the big-DS proof.
 *
 * READING THE NUMBERS: the two targets' percentages are NOT comparable to each
 * other — the ceiling is set by the target's theming architecture, not by how
 * much work we've done. PrimeNG resolves `{token.path}` refs at runtime, so one
 * semantic binding cascades to many component slots (a multiplier); Bootstrap's
 * Sass path binds per variable, with no multiplier. Measured 2026-07-27:
 * Bootstrap's 77% has ~0 slots reachable without new catalog vocabulary (its
 * 127 undriven are assets, structural options, Bootstrap's own derivation
 * knobs, and geometry proposal 0004 already rejected), while PrimeNG's 59% has
 * 221 — so the LOWER number is the target with headroom and the higher one has
 * converged. Track each target against its own history, never against the
 * other. Full analysis: the "Coverage percentages are not comparable across
 * targets" section of docs/specs/validation-and-coverage.md.
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
const { SURFACE_FAMILY_ROW, surfaceCounts } = await import(join(root, 'packages/ir/src/index.js'));

/**
 * The graph-shaped surfaces: an inventory of entries with `from`, classified
 * by the exporter's src/surface-coverage.js through @transtyle/ir's
 * surfaceStatus()/surfaceRows(). `versionKey` is the inventory field naming
 * the extracted package version.
 */
const GRAPH_TARGETS = [
  { key: 'mantine', label: 'Mantine', pkg: '@mantine/core', versionKey: 'mantineVersion' },
  { key: 'chakra', label: 'Chakra', pkg: '@chakra-ui/react', versionKey: 'chakraVersion' },
];

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

// The same drift guard for the graph-shaped inventories, each extracted from
// the installed package (Mantine's DEFAULT_THEME and defaultCssVariablesResolver,
// Chakra's defaultConfig resolved through defaultSystem).
for (const t of GRAPH_TARGETS) {
  const dir = join(root, `packages/exporter-${t.key}`);
  t.inventory = JSON.parse(readFileSync(join(dir, 'surface-inventory.json'), 'utf8'));
  const { extractSurface } = await import(join(dir, 'tools/extract-surface.mjs'));
  const fresh = await extractSurface();
  if (JSON.stringify(fresh) !== JSON.stringify(t.inventory)) {
    if (fresh[t.versionKey] !== t.inventory[t.versionKey]) {
      errors.push(
        `${t.key} inventory was extracted from ${t.pkg}@${t.inventory[t.versionKey]} but @${fresh[t.versionKey]} is installed`,
      );
    } else {
      const ids = (inv) => new Set(inv.entries.map((e) => e.id));
      const [had, has] = [ids(t.inventory), ids(fresh)];
      for (const id of has) if (!had.has(id)) errors.push(`${t.key}: ${id} exists upstream but not in the inventory`);
      for (const id of had) if (!has.has(id)) errors.push(`${t.key}: the inventory lists ${id}, which no longer exists upstream`);
      if (had.size === has.size && [...had].every((id) => has.has(id))) {
        errors.push(`${t.key} surface-inventory.json drifted from a fresh extraction (same entries, field-level change)`);
      }
    }
    errors.push(
      `→ regenerate: node packages/exporter-${t.key}/tools/extract-surface.mjs --write (and review the diff)`,
    );
  }
  t.ids = new Map(t.inventory.entries.map((e) => [e.id, e]));
  const coverage = await import(join(dir, 'src/surface-coverage.js'));
  t.unmapped = coverage.UNMAPPED;
  t.derived = coverage.DERIVED_FAMILIES ?? [];
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

  // ---- Mantine, Chakra: per-family arithmetic, plus a named row per entry on the target's default ----
  for (const t of GRAPH_TARGETS) reconcileGraph(example, t);
}

function reconcileGraph(example, t) {
  const where = `${example}/${t.key}`;
  const path = join(root, 'examples', example, `dist/${t.key}/report.json`);
  if (!existsSync(path)) {
    errors.push(`${example}: no ${t.key} report.json`);
    return;
  }
  const items = JSON.parse(readFileSync(path, 'utf8')).coverage.items;
  const familyRows = new Map();
  for (const i of items) {
    const m = SURFACE_FAMILY_ROW.exec(i.variable);
    if (m) familyRows.set(m[1], { declared: Number(m[2]), row: i });
  }
  // A named default row is an inventory id classed unsupported or dropped;
  // the exporter's own mapping rows can share a name (Chakra's `breakpoints.sm`)
  // but say what it maps, never a gap.
  const entryRows = items.filter((i) => t.ids.has(i.variable) && ['unsupported', 'dropped'].includes(i.class));
  const namedDefault = new Set(entryRows.map((i) => i.variable));
  const shape = `"<n> set · <n> follow · <n> on ${t.label}'s default"`;
  for (const [family, total] of Object.entries(t.inventory.counts.families)) {
    const got = familyRows.get(family);
    if (!got) {
      errors.push(`${where}: family "${family}" (${total} entries) has no coverage row`);
      continue;
    }
    if (got.declared !== total) {
      errors.push(`${where}: family "${family}" reports ${got.declared} entries, inventory has ${total}`);
      continue;
    }
    const c = surfaceCounts(got.row.slot);
    if (!c || c.target !== t.label) {
      errors.push(`${where}: family "${family}" row does not read ${shape}`);
      continue;
    }
    if (c.set + c.follow + c.kept !== total) {
      errors.push(
        `${where}: family "${family}" counts sum to ${c.set + c.follow + c.kept}, expected ${total} — an entry is unaccounted for`,
      );
    }
    const named = entryRows.filter((i) => t.ids.get(i.variable).block === family).length;
    if (t.derived.includes(family)) {
      // No named rows: an entry is on the default exactly when something it
      // reads has a named default row, unless the exporter sets it.
      const members = t.inventory.entries.filter((e) => e.block === family);
      const hits = members.filter((e) => (e.from ?? []).some((dep) => namedDefault.has(dep))).length;
      if (named) errors.push(`${where}: derived family "${family}" has ${named} named row(s); its defaults are explained by what they read`);
      if (c.kept > hits || c.kept < hits - c.set) {
        errors.push(
          `${where}: family "${family}" has ${c.kept} entries on ${t.label}'s default, but ${hits} read a named default and ${c.set} are set — expected between ${Math.max(0, hits - c.set)} and ${hits}`,
        );
      }
    } else if (named !== c.kept) {
      errors.push(
        `${where}: family "${family}" has ${c.kept} entries on ${t.label}'s default but ${named} named row(s) — each needs its own row`,
      );
    }
  }
  // The examples author everything the exporter maps, so the catch-all
  // "this design system defines nothing for it" is never the real reason here.
  const unnoted = entryRows.filter((i) => !i.note || i.note === t.unmapped.note);
  if (unnoted.length) {
    errors.push(
      `${where}: ${unnoted.length} entry row(s) on ${t.label}'s default with no reason of their own — e.g. ${unnoted[0].variable} (add it to REASONS in packages/exporter-${t.key}/src/surface-coverage.js)`,
    );
  }
  const silent = items.filter((i) => ['unsupported', 'dropped'].includes(i.class) && !i.note);
  if (silent.length) {
    errors.push(`${where}: ${silent.length} ${silent[0].class} row(s) with no note — e.g. ${silent[0].variable}`);
  }
  const totals = items.find((i) => i.variable === `${t.label} surface totals`);
  if (!totals) errors.push(`${where}: no surface totals row`);
  summary.push([example, t.key, t.inventory.counts.total, tally(items), totals?.slot]);
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

// Printed with the numbers, because this is where someone is most likely to
// read them as a ranking. They are not one: the ceiling is architectural.
console.log(
  '\n  Not a ranking — the surfaces have different ceilings. PrimeNG resolves refs at\n' +
    '  runtime (one semantic binding cascades to many slots), Bootstrap binds per variable,\n' +
    '  Mantine computes most of its variables from a small theme object, and Chakra\'s\n' +
    '  recipes read its tokens by name.\n' +
    '  Bootstrap is at its floor (~0 slots reachable without new catalog vocabulary); PrimeNG\n' +
    '  has ~221. Compare each target to its own history, not to another one.',
);

if (errors.length) {
  console.error(`\n✖ check-coverage-bar failed — ${errors.length} issue(s):\n`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(
  `\n✔ coverage bar: every slot of the bootstrap, primeng, mantine and chakra surfaces is accounted for on all ${EXAMPLES.length} examples; no silent unsupported\n`,
);
