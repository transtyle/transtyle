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

// ---------- #54: a Style Dictionary v3 file is named, not silently empty ----------
// `value`/`type` without `$` loads as a DTCG tree with zero tokens, which used
// to end in a TST1305 warning per group and `TST1201 primary.solid is not
// authored`, never naming the dialect. LOAD now reports TST1307 once per file
// and the compile stops blaming the missing primary.
{
  const fixture = join(root, 'packages/core/test-fixtures/style-dictionary-legacy');
  const r = run(['check', '--cwd', fixture, '--json']);
  let codes;
  try { codes = JSON.parse(r.stdout).diagnostics.map((d) => d.code); } catch { codes = [`unparseable: ${r.out}`]; }
  expect('style dictionary legacy: exits 1', r.code === 1, `exit ${r.code}`);
  expect('style dictionary legacy: reports TST1307 once', codes.filter((c) => c === 'TST1307').length === 1, codes.join(', '));
  expect('style dictionary legacy: no TST1201 / TST1305 noise', !codes.includes('TST1201') && !codes.includes('TST1305'), codes.join(', '));
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

// ---------- #57: explicit override layers ----------
// `{ files, override: true | "extend" }` marks a layer that redefines earlier
// layers on purpose: no TST1103 for its redefinitions, TST1116 when `true`
// defines a token nothing earlier defines, and `explain` names the file it
// overrides. The unmarked variant is the control: it still warns once per token.
{
  const base = join(root, 'packages/core/test-fixtures/override-layers');
  const codesOf = (cwd) => {
    const r = run(['check', '--cwd', cwd, '--json']);
    try { return JSON.parse(r.stdout).diagnostics.map((d) => d.code); } catch { return [`unparseable: ${r.out}`]; }
  };
  const marked = codesOf(base);
  expect('override layer: redefinitions raise no TST1103 or TST1116', !marked.includes('TST1103') && !marked.includes('TST1116'), marked.join(', '));
  const unmarked = codesOf(join(base, 'unmarked'));
  expect('unmarked duplicate layer still warns TST1103 once per token', unmarked.filter((c) => c === 'TST1103').length === 2, unmarked.join(', '));
  const typo = codesOf(join(base, 'typo'));
  expect('override: true defining a new token warns TST1116', typo.filter((c) => c === 'TST1116').length === 1, typo.join(', '));
  const extend = codesOf(join(base, 'extend'));
  expect('override: "extend" may add tokens without TST1116', !extend.includes('TST1116'), extend.join(', '));
  const first = codesOf(join(base, 'first'));
  expect('override on the first layer reports one TST1116 for the layer', first.filter((c) => c === 'TST1116').length === 1, first.join(', '));
  const ex = run(['explain', 'semantic.color.text.base', '--cwd', base]);
  expect('explain names the file an override layer overrides', /overrides tokens\/base\.tokens\.json/.test(ex.out), ex.out);

  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-57-'));
  try {
    cpSync(join(base, 'tokens'), join(dir, 'tokens'), { recursive: true });
    const config = JSON.parse(readFileSync(join(base, 'transtyle.config.json'), 'utf8'));
    for (const [label, entry] of [['a bare { files }', { files: 'tokens/product.tokens.json' }], ['an unknown override value', { files: 'tokens/product.tokens.json', override: 'yes' }]]) {
      writeFileSync(join(dir, 'transtyle.config.json'), JSON.stringify({ ...config, tokens: ['tokens/base.tokens.json', entry] }));
      const r = run(['check', '--cwd', dir]);
      expect(`config schema rejects ${label}`, r.out.includes('TST1010'), r.out);
    }
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

// ---------- #91: TST2102 / TST2103, colors that can't be told apart ----------
// The Miniflux shape (four distinct tokens that all hold #efefef in dark) warns
// once, naming the four roles; two roles bound to one token (Cathode's
// crt-amber) are a stated intent and stay quiet; an authored categorical
// entry a hair from its neighbor warns; the clean scaffold is the control.
{
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-91-'));
  const tp = join(dir, 'tokens/brand.tokens.json');
  const cp = join(dir, 'transtyle.config.json');
  const diagnostics = () => {
    const r = run(['check', '--cwd', dir, '--json']);
    try { return JSON.parse(r.stdout).diagnostics; } catch { return [{ code: `unparseable: ${r.out}`, message: '' }]; }
  };
  const codes = () => diagnostics().map((d) => d.code);
  try {
    run(['init', 'tst2102-ds', '--cwd', dir]);
    const scaffold = readFileSync(tp, 'utf8');
    const config = readFileSync(cp, 'utf8');
    let c = codes();
    expect('TST2102/3 control: the clean scaffold reports neither', !c.includes('TST2102') && !c.includes('TST2103'), c.join(', '));

    const withTree = (edit) => {
      const tree = JSON.parse(scaffold);
      edit(tree);
      writeFileSync(tp, JSON.stringify(tree, null, 2));
    };
    const alerts = { error: 'danger', success: 'success', warning: 'warning', info: 'info' };
    const bindStatus = (tree) => {
      tree.option.color.alert = { $type: 'color', error: { $value: 'oklch(0.55 0.2 25)' }, success: { $value: 'oklch(0.6 0.15 150)' }, warning: { $value: 'oklch(0.8 0.15 85)' }, info: { $value: 'oklch(0.6 0.12 230)' } };
      for (const [token, role] of Object.entries(alerts)) tree.semantic.color[role] = { solid: { $value: `{option.color.alert.${token}}` } };
    };

    // Miniflux: distinct tokens, all the same color in dark only.
    withTree(bindStatus);
    writeFileSync(join(dir, 'tokens/dark.tokens.json'), JSON.stringify({
      option: { color: { alert: { $type: 'color', error: { $value: '#efefef' }, success: { $value: '#efefef' }, warning: { $value: '#efefef' }, info: { $value: '#efefef' } } } },
    }));
    const cfg = JSON.parse(config);
    cfg.tokens = ['tokens/brand.tokens.json', { files: 'tokens/dark.tokens.json', mode: { 'color-scheme': 'dark' } }];
    writeFileSync(cp, JSON.stringify(cfg));
    let d = diagnostics().filter((x) => x.code === 'TST2103');
    expect('TST2103 Miniflux shape: exactly one warning', d.length === 1, JSON.stringify(d));
    expect('TST2103 Miniflux shape: names all four roles, in dark mode', d.length === 1 && ['success', 'warning', 'danger', 'info'].every((r) => d[0].message.includes(r)) && d[0].message.includes('dark') && d[0].message.includes('same color'), d[0]?.message);
    expect('TST2103 Miniflux shape: the hint says the source is where to fix it', d.length === 1 && /authored or bound/.test(d[0].hint ?? ''), d[0]?.hint);

    // Cathode: two roles bound to one token, identical on purpose.
    rmSync(join(dir, 'tokens/dark.tokens.json'));
    writeFileSync(cp, config);
    withTree((tree) => {
      bindStatus(tree);
      tree.semantic.color.warning = { solid: { $value: '{option.color.alert.warning}' } };
      tree.semantic.color['crt-amber'] = { solid: { $value: '{option.color.alert.warning}' }, $extensions: { 'transtyle.role': { archetype: 'status' } } };
    });
    c = codes();
    expect('TST2103 shared alias: two roles bound to one token do not warn', !c.includes('TST2103'), c.join(', '));
    withTree((tree) => {
      bindStatus(tree);
      tree.option.color.alert.copy = { $value: 'oklch(0.8 0.15 85)' };
      tree.semantic.color['crt-amber'] = { solid: { $value: '{option.color.alert.copy}' }, $extensions: { 'transtyle.role': { archetype: 'status' } } };
    });
    c = codes();
    expect('TST2103 equal colors in two tokens (not one shared alias) do warn', c.includes('TST2103'), c.join(', '));

    // Authored categorical entry a hair from its neighbor.
    withTree((tree) => {
      tree.semantic.palette = { categorical: { $type: 'color', 1: { $value: 'oklch(0.6 0.15 255)' }, 2: { $value: 'oklch(0.61 0.15 257)' } } };
    });
    d = diagnostics().filter((x) => x.code === 'TST2102');
    expect('TST2102 authored palette: one warning per mode naming both entries', d.length === 2 && d.every((x) => x.message.includes('palette.categorical.1') && x.message.includes('palette.categorical.2')) && d.some((x) => x.message.includes('light')) && d.some((x) => x.message.includes('dark')),
      JSON.stringify(d));
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

// ---------- #62: option-token hygiene (TST1114 unused, TST1115 same value) ----------
// Two option tokens nobody references and two used ones that are the same gray
// (one written as hex, one as a near-equal OKLCH). Info by default: exit 0 and
// failOn: warning does not trip. `hygiene` promotes them to warnings, and
// `off` silences them. The clean scaffold is the control: it stays silent.
{
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-hygiene-'));
  const tp = join(dir, 'tokens/brand.tokens.json');
  const cp = join(dir, 'transtyle.config.json');
  const hygiene = () => {
    const r = run(['check', '--cwd', dir, '--json']);
    let j = null;
    try { j = JSON.parse(r.stdout); } catch { /* reported below */ }
    return { r, j, byCode: (c) => (j?.diagnostics ?? []).filter((d) => d.code === c) };
  };
  try {
    run(['init', 'hygiene-ds', '--cwd', dir]);
    let h = hygiene();
    expect('hygiene control: the clean scaffold reports neither code', h.j && h.byCode('TST1114').length === 0 && h.byCode('TST1115').length === 0, h.r.out);

    const tokens = JSON.parse(readFileSync(tp, 'utf8'));
    Object.assign(tokens.option.color, {
      'gray-a': { $value: '#333333' },
      'gray-b': { $value: 'oklch(0.3210925090680371 0 0)' },
      orphan1: { $value: 'oklch(0.7 0.1 30)' },
      orphan2: { $value: 'oklch(0.6 0.1 140)' },
    });
    tokens.semantic.color.text.base.$value = '{option.color.gray-a}';
    tokens.semantic.color.text.muted.$value = '{option.color.gray-b}';
    writeFileSync(tp, JSON.stringify(tokens, null, 2));

    h = hygiene();
    const [unused] = h.byCode('TST1114');
    const [dup] = h.byCode('TST1115');
    expect('hygiene: exit 0 by default (info)', h.r.code === 0, `exit ${h.r.code}: ${h.r.out}`);
    expect('hygiene: TST1114 once, severity info, count in the message', h.byCode('TST1114').length === 1 && unused.severity === 'info' && unused.message.startsWith('2 option tokens are never referenced'), JSON.stringify(unused));
    expect('hygiene: TST1114 --json lists both paths', JSON.stringify(unused?.paths) === JSON.stringify(['option.color.orphan1', 'option.color.orphan2']), JSON.stringify(unused));
    expect('hygiene: TST1115 once, severity info, names the first path and the count', h.byCode('TST1115').length === 1 && dup.severity === 'info' && dup.message.startsWith('option.color.gray-a and 1 other option token resolve'), JSON.stringify(dup));
    expect('hygiene: TST1115 --json lists the group (hex and near-equal oklch)', JSON.stringify(dup?.paths) === JSON.stringify(['option.color.gray-a', 'option.color.gray-b']), JSON.stringify(dup));

    const cfg = JSON.parse(readFileSync(cp, 'utf8'));
    cfg.check = { ...(cfg.check ?? {}), failOn: 'warning' };
    writeFileSync(cp, JSON.stringify(cfg, null, 2));
    h = hygiene();
    expect('hygiene: failOn warning alone still exits 0 (info)', h.r.code === 0, `exit ${h.r.code}: ${h.r.out}`);

    cfg.check.hygiene = { unusedOption: 'warning', duplicateOption: 'warning' };
    writeFileSync(cp, JSON.stringify(cfg, null, 2));
    h = hygiene();
    expect('hygiene: promoted to warning, both severities follow', h.byCode('TST1114')[0]?.severity === 'warning' && h.byCode('TST1115')[0]?.severity === 'warning', h.r.out);
    expect('hygiene: failOn warning + hygiene warning exits 1', h.r.code === 1, `exit ${h.r.code}`);

    cfg.check.hygiene = { unusedOption: 'off', duplicateOption: 'off' };
    writeFileSync(cp, JSON.stringify(cfg, null, 2));
    h = hygiene();
    expect('hygiene: off silences both', h.byCode('TST1114').length === 0 && h.byCode('TST1115').length === 0 && h.r.code === 0, h.r.out);

    cfg.check.hygiene = { unusedOption: 'loud' };
    writeFileSync(cp, JSON.stringify(cfg, null, 2));
    h = hygiene();
    expect('hygiene: an unknown level is a config error (TST1010)', h.byCode('TST1010').length === 1, h.r.out);
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
    // Atomic EMIT (#90): every exporter still runs, so every crash is reported
    // in one go, but a build with an error writes nothing at all.
    expect('crash: a build with a crash writes no output (atomic EMIT)', !existsSync(join(dir, 'dist')), r.out);
    expect('crash: the target after it still ran (its load failure is reported too)', r.out.includes('TST3002'), r.out);

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
