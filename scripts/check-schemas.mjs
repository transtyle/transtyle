#!/usr/bin/env node
/**
 * Ground-truth check for the published JSON schemas (audit A7/A8, R3). Four assertions:
 *
 *  1. Drift: the committed website/public/schemas/*.json match a fresh render of
 *     the source-of-truth objects — the published editor schema can't fall out of
 *     sync with the runtime validator (they're the same object; this proves the
 *     checked-in file was regenerated).
 *  2. Every example's transtyle.config.json validates clean against the config
 *     schema — no false positives from the validator on real, shipping configs.
 *  3. Known-bad configs are rejected with the right kind of error — the validator
 *     actually catches unknown keys, bad enums, wrong types, missing required.
 *  4. A real emitted report.json validates against the report schema — the
 *     published report schema matches what core actually writes.
 *
 * Assertion 4 builds the examples itself. It used to read whatever was already
 * in `examples/<name>/dist/`, which is gitignored: on a fresh clone there was
 * nothing to validate (caught, but only by a "build an example first" error at
 * the end), and on a working copy it validated whatever build happened to be
 * lying around — possibly from before the change under test. Building here
 * costs about a second and makes the check answer for the current code, the
 * same way check-fixtures and check-coverage-bar already do.
 *
 * Run: node scripts/check-schemas.mjs (also: npm run check:schemas; part of check:all).
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../packages/core/src/schema/validate.js';
import { configSchema } from '../packages/core/src/schema/config.schema.js';
import { reportSchema } from '../packages/core/src/schema/report.schema.js';
import { OUTPUTS, render } from './gen-schemas.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const errors = [];
const fail = (m) => errors.push(m);

// 1. drift
for (const { rel, doc } of OUTPUTS) {
  if (!existsSync(join(root, rel))) { fail(`${rel} missing — run npm run gen:schemas`); continue; }
  if (read(rel) !== render(doc)) fail(`${rel} is stale — run npm run gen:schemas and commit`);
}

// 2. examples validate clean
const examples = ['acme', 'cathode', 'govuk', 'carbon'];
for (const ex of examples) {
  const cfg = JSON.parse(read(`examples/${ex}/transtyle.config.json`));
  const errs = validate(cfg, configSchema);
  if (errs.length) fail(`examples/${ex}/transtyle.config.json unexpectedly invalid: ${errs.map((e) => `${e.path} ${e.message}`).join('; ')}`);
}

// 3. known-bad configs are rejected (each must produce ≥1 error)
const mustReject = [
  { why: 'unknown top-level key', cfg: { tokens: ['t/*.json'], wat: 1 } },
  { why: 'missing required tokens', cfg: { name: 'x' } },
  { why: 'wrong type for tokens', cfg: { tokens: 'not-an-array' } },
  { why: 'bad check.failOn enum', cfg: { tokens: ['t/*.json'], check: { failOn: 'sometimes' } } },
  { why: 'unknown key inside a target', cfg: { tokens: ['t/*.json'], targets: { shadcn: { outputt: 'x' } } } },
  { why: 'mode dimension missing values', cfg: { tokens: ['t/*.json'], modes: { 'color-scheme': { default: 'light' } } } },
];
for (const { why, cfg } of mustReject) {
  if (validate(cfg, configSchema).length === 0) fail(`config validator FAILED to reject: ${why}`);
}

// 4. EVERY emitted report validates against the report schema. Checking a single
// report used to be enough "in principle" and wasn't: exporter-primeng emitted
// `field` where the schema requires `variable`, and it hid because only the
// shadcn report was validated (found by the P1 conformance kit). Scan them all.
let reportsChecked = 0;
for (const ex of examples) {
  // Fresh, not whatever is on disk — see the header note.
  execSync(`npx transtyle build --cwd examples/${ex}`, { cwd: root, stdio: 'pipe' });
  const distDir = join(root, `examples/${ex}/dist`);
  if (!existsSync(distDir)) continue;
  for (const target of readdirSync(distDir)) {
    const rel = `examples/${ex}/dist/${target}/report.json`;
    if (!existsSync(join(root, rel))) continue;
    reportsChecked++;
    const errs = validate(JSON.parse(read(rel)), reportSchema);
    if (errs.length) fail(`${rel} does not match the published report schema: ${errs.slice(0, 3).map((e) => `${e.path} ${e.message}`).join('; ')}${errs.length > 3 ? ` (+${errs.length - 3} more)` : ''}`);
  }
}
if (reportsChecked === 0) fail('no emitted report.json found — build an example first so report-schema conformance can be checked');

if (errors.length) {
  console.error(`✖ schema check: ${errors.length} problem(s)\n`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✔ schema check: published schemas current; ${examples.length} example configs valid; ${mustReject.length} bad-config cases rejected; ${reportsChecked} emitted reports conform`);
