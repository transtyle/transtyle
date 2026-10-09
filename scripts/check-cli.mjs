#!/usr/bin/env node
/**
 * Golden-file test for the CLI's project-scaffolding commands
 * (docs/plan/catalog-revision.md T6). Runs init -> add -> build -> explain
 * in a throwaway temp directory and asserts exit codes + key output
 * substrings. Not a full test suite — a smoke test that the happy path and
 * the documented error cases (existing config, unknown target, duplicate
 * target, unknown slot) behave as specced.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'packages/cli/src/main.js');
const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-cli-'));

let failures = 0;
function run(args) {
  const r = spawnSync('node', [cli, ...args], { encoding: 'utf8' });
  return { code: r.status ?? 1, out: (r.stdout ?? '') + (r.stderr ?? ''), stdout: r.stdout ?? '' };
}
function expect(label, cond, detail) {
  if (!cond) { console.error(`✖ ${label}${detail ? ` — ${detail}` : ''}`); failures++; }
  else console.log(`✔ ${label}`);
}

try {
  let r = run(['init', 'checkcli-ds', '--cwd', dir]);
  expect('init: exit 0', r.code === 0, `exit ${r.code}: ${r.out}`);
  expect('init: config created', existsSync(join(dir, 'transtyle.config.json')));
  expect('init: tokens created', existsSync(join(dir, 'tokens/brand.tokens.json')));

  r = run(['init', '--cwd', dir]);
  expect('init: refuses when config exists (exit 2)', r.code === 2, `exit ${r.code}`);

  r = run(['build', '--cwd', dir]);
  expect('build: scaffold builds clean (exit 0)', r.code === 0, r.out);
  expect('build: css-variables emitted', r.out.includes('dist/css-variables'));

  r = run(['add', 'shadcn', '--cwd', dir]);
  expect('add shadcn: exit 0', r.code === 0, r.out);

  r = run(['add', 'not-a-real-target', '--cwd', dir]);
  expect('add: unknown target refused (exit 2)', r.code === 2);
  expect('add: unknown target lists valid ones', r.out.includes('Valid targets:'));

  r = run(['add', 'shadcn', '--cwd', dir]);
  expect('add: duplicate target refused (exit 2)', r.code === 2);

  r = run(['build', 'shadcn', '--cwd', dir]);
  expect('build shadcn: exit 0', r.code === 0, r.out);
  expect('build shadcn: artifact written', existsSync(join(dir, 'dist/shadcn/globals.transtyle.css')));

  r = run(['explain', 'primary.solid', '--cwd', dir]);
  expect('explain: exit 0', r.code === 0, r.out);
  expect('explain: shows the resolved value', r.out.includes('semantic.color.primary.solid = oklch'));
  expect('explain: shows provenance', r.out.includes('aliased →'));

  r = run(['explain', 'primary.doesnotexist', '--cwd', dir]);
  expect('explain: unknown slot refused (exit 2)', r.code === 2);
  expect('explain: unknown slot suggests alternatives', r.out.includes('Closest matches:'));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// ---------- T10: DTCG validation diagnostics, --json ----------
{
  const fixture = join(root, 'packages/core/test-fixtures/dtcg-validation');
  const r = run(['check', '--cwd', fixture, '--json']);
  expect('check --json: fails on the fixture\'s deliberate errors (exit 1)', r.code === 1, `exit ${r.code}`);
  for (const code of ['TST1305', 'TST1302', 'TST1306', 'TST1304', 'TST1105']) {
    expect(`check --json: reports ${code}`, r.out.includes(`"${code}"`), r.out);
  }
  expect('check --json: prints a parseable JSON report', (() => {
    try { return Array.isArray(JSON.parse(r.stdout).diagnostics); } catch { return false; }
  })());
}

// ---------- #121: a glob that also matches a mode-scoped overlay ----------
// `["tokens/*.tokens.json", { files: "tokens/dark.tokens.json", mode: dark }]`,
// the layout `init` plus authoring-tokens.md lead to, loaded dark.tokens.json
// twice: once as the overlay and once as a base layer, so every token in it
// raised TST1103 and its dark values replaced the light ones (light text on a
// light surface at 1.1:1). The overlay claims its file whatever the order of
// the entries, so both orders are graded; `overlay-first/` reads the same
// token files from `../tokens/`.
{
  const base = join(root, 'packages/core/test-fixtures/glob-plus-overlay');
  const light = 'oklch(0.2 0.01 255)';
  const dark = 'oklch(0.95 0.005 255)';
  const value = (cwd, mode) => {
    const r = run(['explain', 'semantic.color.text.base', '--cwd', cwd, ...(mode ? ['--mode', mode] : [])]);
    return r.out.match(/^semantic\.color\.text\.base = (oklch\([^)]*\))/m)?.[1] ?? `unreadable: ${r.out}`;
  };
  for (const [label, cwd] of [['glob first', base], ['overlay first', join(base, 'overlay-first')]]) {
    const r = run(['check', '--cwd', cwd, '--json']);
    let codes;
    try { codes = JSON.parse(r.stdout).diagnostics.map((d) => d.code); } catch { codes = [`unparseable: ${r.out}`]; }
    expect(`glob + overlay (${label}): the overlay is not also a base layer (no TST1103)`, !codes.includes('TST1103'),
      `${codes.join(', ')} — packages/core/src/load.js must skip files a mode-scoped entry claims`);
    let got = value(cwd);
    expect(`glob + overlay (${label}): light text.base keeps the base value`, got === light, `got ${got}, expected ${light}`);
    got = value(cwd, 'dark');
    expect(`glob + overlay (${label}): dark text.base is the overlay's`, got === dark, `got ${got}, expected ${dark}`);
  }

  // TST1001 keeps meaning "matched nothing on disk": a plain glob whose only
  // match is the overlay's file did match something, so it does not warn.
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-121-'));
  try {
    cpSync(join(base, 'tokens'), join(dir, 'tokens'), { recursive: true });
    const config = JSON.parse(readFileSync(join(base, 'transtyle.config.json'), 'utf8'));
    config.tokens = ['tokens/base.tokens.json', 'tokens/dark*.tokens.json', config.tokens[1]];
    writeFileSync(join(dir, 'transtyle.config.json'), JSON.stringify(config));
    const r = run(['check', '--cwd', dir, '--json']);
    let codes;
    try { codes = JSON.parse(r.stdout).diagnostics.map((d) => d.code); } catch { codes = [`unparseable: ${r.out}`]; }
    expect('glob + overlay: a glob matching only the overlay\'s file is not TST1001', !codes.includes('TST1001') && !codes.includes('TST1103'), codes.join(', '));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- TST1204 is not a consequence of a broken primary ----------
// A role whose `.solid` never resolved has no light value to carry into dark,
// so the carry-over note must not appear next to the error that explains it.
// The clean scaffold is the control: it does report TST1204 (primary has no
// dark value), so its absence below is the fix, not a note that stopped firing.
{
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-1204-'));
  const tp = join(dir, 'tokens/brand.tokens.json');
  const codes = () => {
    const r = run(['check', '--cwd', dir, '--json']);
    try { return JSON.parse(r.stdout).diagnostics.map((d) => d.code); } catch { return [`unparseable: ${r.out}`]; }
  };
  try {
    run(['init', 'tst1204-ds', '--cwd', dir]);
    const scaffold = readFileSync(tp, 'utf8');
    let c = codes();
    expect('TST1204 control: the clean scaffold reports the carry-over', c.includes('TST1204'), c.join(', '));

    const broken = {
      'dangling alias (TST1105)': ['TST1105', scaffold.replace('{option.color.brand.500}', '{option.color.brand.999}')],
      'alias cycle (TST1104)': ['TST1104', scaffold
        .replace('{option.color.brand.500}', '{semantic.color.text.base}')
        .replace('"oklch(0.2 0.01 255)"', '"{semantic.color.primary.solid}"')],
      'unparseable color (TST1106)': ['TST1106', scaffold.replace('"{option.color.brand.500}"', '"not-a-color"')],
    };
    for (const [label, [cause, tokens]] of Object.entries(broken)) {
      expect(`TST1204 fixture edit applies: ${label}`, tokens !== scaffold);
      writeFileSync(tp, tokens);
      c = codes();
      expect(`primary.solid ${label}: reports ${cause}`, c.includes(cause), c.join(', '));
      expect(`primary.solid ${label}: no TST1204 carry-over note`, !c.includes('TST1204'), c.join(', '));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- #26: explain an authored composite ----------
{
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-explain-'));
  try {
    run(['init', 'explain-ds', '--cwd', dir]);
    const tp = join(dir, 'tokens/brand.tokens.json');
    const tree = JSON.parse(readFileSync(tp, 'utf8'));
    tree.semantic.color.elevation = {
      2: {
        shadow: {
          $type: 'shadow',
          $value: [
            { color: '{semantic.color.scrim}', offsetX: '0px', offsetY: '1px', blur: '2px', spread: '0px' },
            { color: '#00000033', offsetX: '0px', offsetY: '4px', blur: '12px', spread: '-2px', inset: true },
          ],
        },
      },
    };
    writeFileSync(tp, JSON.stringify(tree, null, 2));
    const r = run(['explain', 'elevation.2.shadow', '--cwd', dir]);
    expect('explain composite: exit 0', r.code === 0, r.out);
    expect('explain composite: renders every layer with a parsed color', /= 0px 1px 2px 0px \/ oklch\([\d.]+ [\d.]+ [\d.]+ \/ [\d.]+\), inset 0px 4px 12px -2px \/ oklch\(/.test(r.out), r.out);
    expect('explain composite: lists members with their alias target', r.out.includes('0.color = oklch(') && r.out.includes('← {semantic.color.scrim}'), r.out);
    expect('explain composite: lists literal members', r.out.includes('1.inset = true'), r.out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- P6: diff against a git ref ----------
{
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-diff-'));
  const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
  const runIn = (args) => {
    const r = spawnSync('node', [cli, ...args, '--cwd', dir], { encoding: 'utf8' });
    return { code: r.status ?? 1, out: (r.stdout ?? '') + (r.stderr ?? ''), stdout: r.stdout ?? '' };
  };
  try {
    git('init', '-q');
    git('config', 'user.email', 't@t.test');
    git('config', 'user.name', 'test');
    runIn(['init', 'diff-ds']);
    git('add', '-A');
    git('commit', '-q', '-m', 'initial');

    let r = runIn(['diff']);
    expect('diff: no changes vs HEAD (exit 0)', r.code === 0, `exit ${r.code}: ${r.out}`);
    expect('diff: reports identical', r.out.includes('No semantic changes'));

    // Change the authored brand color, uncommitted.
    const tp = join(dir, 'tokens/brand.tokens.json');
    writeFileSync(tp, readFileSync(tp, 'utf8').replace('oklch(0.55 0.18 255)', 'oklch(0.55 0.19 25)'));

    r = runIn(['diff']);
    expect('diff: detects a change (exit 1)', r.code === 1, `exit ${r.code}`);
    expect('diff: names the changed slot', r.out.includes('primary.solid'));
    expect('diff: shows per-target impact', r.out.includes('Per-target impact:'));

    r = runIn(['diff', '--json']);
    expect('diff --json: parseable with hasChanges true', (() => {
      try { return JSON.parse(r.stdout).hasChanges === true; } catch { return false; }
    })(), r.out);

    r = runIn(['diff', 'no-such-ref']);
    expect('diff: unknown ref refused (exit 2)', r.code === 2, `exit ${r.code}`);

    // Contrast regression: a brand-colour change must NOT flag one (no false
    // positives), while lightening body text until it fails AA must.
    expect('diff: brand-only change flags no contrast regression', !r.out.includes('Contrast regressions'));
    writeFileSync(tp, readFileSync(tp, 'utf8').replace('oklch(0.2 0.01 255)', 'oklch(0.75 0.01 255)'));
    r = runIn(['diff']);
    expect('diff: flags a contrast regression', r.out.includes('Contrast regressions') && r.out.includes('now FAILS'), r.out.slice(-400));
    r = runIn(['diff', '--json']);
    expect('diff --json: reports regressed pairs', (() => {
      try {
        const cr = JSON.parse(r.stdout).contrastRegressions;
        return Array.isArray(cr) && cr.length > 0 && cr.every((x) => x.status === 'regressed' && x.before > x.after);
      } catch { return false; }
    })());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- #28: an exporter that throws names its target ----------
{
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-crash-'));
  try {
    run(['init', 'crash-ds', '--cwd', dir]);
    // A local exporter loaded through the `exporter` field, like a third-party plugin.
    writeFileSync(join(dir, 'boom.mjs'), `export default {
  name: 'boom',
  emit() { throw new TypeError("Cannot read properties of undefined (reading 'c')"); },
};
`);
    const cp = join(dir, 'transtyle.config.json');
    const cfg = JSON.parse(readFileSync(cp, 'utf8'));
    cfg.targets = {
      'css-variables': { output: 'dist/css-variables' },
      boom: { exporter: './boom.mjs', output: 'dist/boom' },
      gone: { exporter: './no-such-exporter.mjs', output: 'dist/gone' },
      after: { exporter: 'css-variables', output: 'dist/after' },
    };
    writeFileSync(cp, JSON.stringify(cfg, null, 2));
    const runCrash = (args, env = {}) => {
      const r = spawnSync('node', [cli, ...args, '--cwd', dir], { encoding: 'utf8', env: { ...process.env, TRANSTYLE_DEBUG: '', ...env } });
      return { code: r.status ?? 1, out: (r.stdout ?? '') + (r.stderr ?? ''), stdout: r.stdout ?? '' };
    };

    let r = runCrash(['build']);
    expect('crash: exit 1, not 2', r.code === 1, `exit ${r.code}: ${r.out}`);
    expect('crash: names the target and the stage', r.out.includes('TST3001 Exporter "boom" crashed in emit: Cannot read properties of undefined'), r.out);
    expect('crash: hint points at TRANSTYLE_DEBUG', r.out.includes('TRANSTYLE_DEBUG=1'), r.out);
    expect('crash: no stack by default', !r.out.includes('at Object.emit') && !r.out.includes('boom.mjs:'), r.out);
    expect('load failure: names the target (TST3002)', r.out.includes('TST3002 Exporter "gone" crashed in load'), r.out);
    expect('crash: the target before it is built', existsSync(join(dir, 'dist/css-variables/report.json')));
    expect('crash: the target after it is built too', existsSync(join(dir, 'dist/after/report.json')), r.out);
    const report = JSON.parse(readFileSync(join(dir, 'dist/boom/report.json'), 'utf8'));
    expect('crash: report.json lists no files', report.files.length === 0, JSON.stringify(report.files));
    expect('crash: report.json lists the TST3001 diagnostic', report.diagnostics.some((d) => d.code === 'TST3001' && d.target === 'boom'), JSON.stringify(report.diagnostics));
    expect('crash: report.json coverage is empty', report.coverage.items.length === 0);

    r = runCrash(['build'], { TRANSTYLE_DEBUG: '1' });
    expect('crash: TRANSTYLE_DEBUG=1 prints the stack', /TypeError[\s\S]*boom\.mjs/.test(r.out), r.out);

    r = runCrash(['check', '--json']);
    const json = (() => { try { return JSON.parse(r.stdout); } catch { return null; } })();
    expect('check --json: lists the crash as a diagnostic', !!json && json.diagnostics.some((d) => d.code === 'TST3001' && d.message.includes('"boom"')), r.out);
    expect('check --json: the crashed target is listed, with empty coverage', !!json && json.targets.some((t) => t.target === 'boom' && t.coverage.length === 0), r.out);
    expect('check: exit 1', r.code === 1, `exit ${r.code}`);

    r = runCrash(['explain', 'primary.solid']);
    expect('explain: runs no exporter (exit 0, no crash)', r.code === 0 && !r.out.includes('TST300'), `exit ${r.code}: ${r.out}`);

    const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
    git('init', '-q');
    git('config', 'user.email', 't@t.test');
    git('config', 'user.name', 'test');
    git('add', '-A');
    git('commit', '-q', '-m', 'initial');
    r = runCrash(['diff']);
    expect('diff: a crashed target is not a usage error (exit 0, nothing changed)', r.code === 0, `exit ${r.code}: ${r.out}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (failures) {
  console.error(`\n✖ check-cli: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\n✔ check-cli: init/add/build/explain/diff golden path and error cases all pass');
