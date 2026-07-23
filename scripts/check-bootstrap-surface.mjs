#!/usr/bin/env node
/**
 * AL1.1 guard (docs/plan/bootstrap-component-tier.md): the checked-in
 * Bootstrap surface inventory must exactly match a fresh extraction from the
 * installed bootstrap package — the same regenerate-and-diff discipline as
 * check:fixtures. Fails when the pinned Bootstrap version drifts, when the
 * extractor changes behavior, or when the inventory was hand-edited.
 *
 * Once packages/exporter-bootstrap/src/descriptors.js exists (AL1.2), also
 * asserts the cross-walk is complete: every in-inventory variable is either
 * bound (emit), explicitly classified (drop), or mechanically chained
 * (value references other `$` variables / aliases a global CSS variable) —
 * nothing silent, per the plan's AL3 bar.
 *
 * Run: node scripts/check-bootstrap-surface.mjs   (npm run check:bootstrap-surface)
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = join(root, 'packages', 'exporter-bootstrap');
const { extractSurface } = await import(join(pkgDir, 'tools', 'extract-surface.mjs'));

const errors = [];
const fresh = extractSurface();
const checkedIn = JSON.parse(readFileSync(join(pkgDir, 'surface-inventory.json'), 'utf8'));

// 1. Regenerate-and-diff.
const a = JSON.stringify(checkedIn);
const b = JSON.stringify(fresh);
if (a !== b) {
  if (checkedIn.bootstrapVersion !== fresh.bootstrapVersion) {
    errors.push(`inventory was extracted from bootstrap@${checkedIn.bootstrapVersion} but bootstrap@${fresh.bootstrapVersion} is installed`);
  } else {
    const inNames = new Set(checkedIn.variables.map((v) => v.name));
    const freshNames = new Set(fresh.variables.map((v) => v.name));
    for (const n of freshNames) if (!inNames.has(n)) errors.push(`variable $${n} exists upstream but not in the inventory`);
    for (const n of inNames) if (!freshNames.has(n)) errors.push(`inventory lists $${n} which no longer exists upstream`);
    if (!errors.length) errors.push('inventory content drifted from a fresh extraction (same variable set — field-level change)');
  }
  errors.push('→ regenerate: node packages/exporter-bootstrap/tools/extract-surface.mjs --write (and review the diff)');
}

// 2. Internal honesty: every out-of-inventory entry carries a reason.
for (const v of checkedIn.variables) {
  if (v.scope === 'out' && !v.reason) errors.push(`out-of-inventory $${v.name} has no reason`);
  if (v.scope === 'out' && v.outGroup === 'global-other') errors.push(`$${v.name} fell into the global-other catch-all — classify it properly (family or an OUT_RULES group)`);
}

// 3. Cross-walk completeness (active once AL1.2 lands descriptors.js).
const descPath = join(pkgDir, 'src', 'descriptors.js');
if (existsSync(descPath)) {
  const { DESCRIPTORS, coverageForVariable } = await import(descPath);
  const families = new Set(checkedIn.variables.filter((v) => v.scope === 'component').map((v) => v.family));
  for (const f of families) if (!DESCRIPTORS[f]) errors.push(`family "${f}" (${checkedIn.counts.families[f]} vars) has no descriptor`);
  for (const v of checkedIn.variables) {
    if (v.scope !== 'component') continue;
    const cls = coverageForVariable(v);
    if (!cls) errors.push(`$${v.name} (family ${v.family}) is unclassified — no emit/drop entry and not mechanically chained`);
    else if (cls.emit && cls.drop) errors.push(`$${v.name} is both emitted and dropped — pick one`);
  }
  // No descriptor entry may point at a variable the inventory doesn't know.
  for (const [family, d] of Object.entries(DESCRIPTORS)) {
    for (const name of [...Object.keys(d.emit ?? {}), ...Object.keys(d.drop ?? {})]) {
      const v = checkedIn.variables.find((x) => x.name === name);
      if (!v) errors.push(`descriptor ${family} references $${name} which is not in the inventory`);
      else if (v.scope !== 'component') errors.push(`descriptor ${family} references $${name} which is out-of-inventory (${v.outGroup})`);
      else if (v.family !== family) errors.push(`descriptor ${family} references $${name} which belongs to family ${v.family}`);
    }
  }

  // 4. Every recipe path must resolve in a real compile (typo guard: a bad
  //    `sem: 'space.7'` must fail here, not in AL1.3's emission).
  const { compile } = await import('@transtyle/core');
  const loadExporter = async () => ({ name: 'noop', optionsSchema: { type: 'object' }, emit: () => ({ files: [], coverage: [] }) });
  const acme = await compile({ cwd: join(root, 'examples', 'acme'), targets: [], emit: false, loadExporter });
  const map = acme.normalized.modes.light;
  for (const [family, d] of Object.entries(DESCRIPTORS)) {
    for (const [name, recipe] of Object.entries(d.emit ?? {})) {
      const paths = [];
      if (recipe.sem) paths.push(`semantic.${recipe.sem}`);
      if (recipe.comp) paths.push(`component.${recipe.comp}`);
      if (recipe.trans) paths.push(`semantic.${recipe.trans.duration}`, `semantic.${recipe.trans.easing}`);
      if (!paths.length) errors.push(`descriptor ${family}/$${name}: emit recipe has no sem/comp/trans source`);
      for (const p of paths) if (map.get(p)?.value === undefined) errors.push(`descriptor ${family}/$${name}: recipe path ${p} does not resolve in a real compile`);
    }
  }
}

if (errors.length) {
  console.error(`✘ bootstrap surface check: ${errors.length} problem(s)`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
const n = checkedIn.counts;
console.log(`✔ bootstrap surface check: bootstrap@${checkedIn.bootstrapVersion}, ${n.component} component-scoped of ${n.total} inventoried${existsSync(descPath) ? '; cross-walk complete' : ' (cross-walk pending — AL1.2)'}`);
