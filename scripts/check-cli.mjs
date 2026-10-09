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
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync, cpSync, readdirSync } from 'node:fs';
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
  expect('init: dark overlay created', existsSync(join(dir, 'tokens/brand.dark.tokens.json')));

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

// ---------- #54: transtyle migrate --from style-dictionary ----------
// The codemod half: a dry run changes nothing, --write rewrites to DTCG, the
// result passes check and builds, and a second run is a no-op.
{
  const fixture = join(root, 'packages/core/test-fixtures/style-dictionary-migrate');
  const tmp = mkdtempSync(join(tmpdir(), 'transtyle-check-migrate-'));
  const tmp2 = mkdtempSync(join(tmpdir(), 'transtyle-check-migrate-'));
  try {
    cpSync(fixture, tmp, { recursive: true });
    cpSync(fixture, tmp2, { recursive: true });
    const read = (d) => readdirSync(join(d, 'tokens')).map((f) => readFileSync(join(d, 'tokens', f), 'utf8')).join('\n---\n');
    const before = read(tmp);

    let r = run(['check', '--cwd', tmp]);
    expect('migrate: the unmigrated fixture reports TST1307 (exit 1)', r.code === 1 && r.out.includes('TST1307'), `exit ${r.code}: ${r.out}`);

    r = run(['migrate', '--from', 'style-dictionary', '--cwd', tmp]);
    expect('migrate: dry run exits 0', r.code === 0, r.out);
    expect('migrate: dry run prints the diff on stdout', r.stdout.includes('+++ tokens/base.json') && r.stdout.includes('+ ') && r.stdout.includes('"$value"') && r.stdout.includes('- '), r.stdout);
    expect('migrate: dry run says nothing was written', r.out.includes('nothing was written'));
    expect('migrate: dry run leaves the files byte-identical', read(tmp) === before);
    expect('migrate: dry run names the tier placement', r.out.includes('under "option"'), r.out);

    r = run(['migrate', '--from', 'style-dictionary', '--write', '--cwd', tmp]);
    expect('migrate --write: exit 0', r.code === 0, r.out);
    const migrated = JSON.parse(readFileSync(join(tmp, 'tokens/base.json'), 'utf8'));
    const primary = migrated.option?.color?.brand?.primary;
    expect('migrate --write: value/type/comment become $value/$type/$description', primary?.$value === '#0d6efd' && primary?.$type === 'color' && primary?.$description === 'Brand blue', JSON.stringify(primary));
    expect('migrate --write: attributes move under $extensions["style-dictionary"]', primary?.$extensions?.['style-dictionary']?.attributes?.category === 'color', JSON.stringify(primary));
    expect('migrate --write: ".value" is stripped from references, under the new tier', migrated.option?.color?.brand?.secondary?.$value === '{option.color.brand.primary}', JSON.stringify(migrated.option?.color?.brand?.secondary));
    expect('migrate --write: SD types are renamed (fontFamilies → fontFamily), missing ones inferred (size → dimension)', migrated.option?.font?.family?.base?.$type === 'fontFamily' && migrated.option?.size?.radius?.md?.$type === 'dimension');
    expect('migrate --write: the DTCG file is left alone', readFileSync(join(tmp, 'tokens/semantic.json'), 'utf8') === readFileSync(join(fixture, 'tokens/semantic.json'), 'utf8'));

    r = run(['check', '--cwd', tmp]);
    expect('migrate --write: the result passes check (exit 0, no TST1307)', r.code === 0 && !r.out.includes('TST1307'), r.out);
    r = run(['build', '--cwd', tmp]);
    expect('migrate --write: the result builds (exit 0)', r.code === 0 && existsSync(join(tmp, 'dist/css-variables/variables.transtyle.css')), r.out);

    const written = read(tmp);
    r = run(['migrate', '--from', 'style-dictionary', '--write', '--cwd', tmp]);
    expect('migrate: a second run is a no-op (exit 0, byte-identical)', r.code === 0 && read(tmp) === written && r.out.includes('Nothing to migrate'), r.out);

    run(['migrate', '--from', 'style-dictionary', '--write', '--cwd', tmp2]);
    expect('migrate: deterministic (two projects migrate to the same bytes)', read(tmp2) === written);

    r = run(['migrate', '--cwd', tmp]);
    expect('migrate: without --from is a usage error (exit 2)', r.code === 2 && r.out.includes('--from'), `exit ${r.code}: ${r.out}`);
    r = run(['migrate', '--from', 'tokens-studio', '--cwd', tmp]);
    expect('migrate: an unknown source is a usage error naming the valid ones (exit 2)', r.code === 2 && r.out.includes('style-dictionary'), `exit ${r.code}: ${r.out}`);
    r = run(['check', '--write', '--cwd', tmp]);
    expect('migrate: --write on another command is a usage error (exit 2)', r.code === 2 && r.out.includes('migrate'), `exit ${r.code}: ${r.out}`);
    r = run(['migrate', '--from', 'style-dictionary', '--cwd', join(tmp, 'nope')]);
    expect('migrate: no config is a usage error (exit 2)', r.code === 2, `exit ${r.code}: ${r.out}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    rmSync(tmp2, { recursive: true, force: true });
  }
}

// The transform rules, without the CLI (core's migrateStyleDictionary is a pure function).
{
  const { migrateStyleDictionary, needsStyleDictionaryMigration } = await import('@transtyle/core');
  const m = (tree) => migrateStyleDictionary(tree);
  const j = (v) => JSON.stringify(v);

  let { tree, notes } = m({ color: { a: { value: '#fff', comment: 'c', name: 'color-a' } } });
  expect('transform: renames value, comment, and moves other keys to $extensions', j(tree.option.color.a) === j({ $type: 'color', $value: '#fff', $description: 'c', $extensions: { 'style-dictionary': { name: 'color-a' } } }), j(tree));

  ({ tree } = m({ size: { value: { a: { value: '1px' } } } }));
  expect('transform: a group with a child called "value" stays a group', tree.option.size.value.a.$value === '1px' && !('$value' in tree.option.size), j(tree));

  ({ tree } = m({ semantic: { color: { x: { value: '{semantic.color.y.value}' }, y: { value: '#000', type: 'color' } } } }));
  expect('transform: a tier group stays where it is, and references into a tier are not prefixed', !('option' in tree) && tree.semantic.color.x.$value === '{semantic.color.y}', j(tree));

  ({ tree } = m({ shadow: { s: { value: { x: '0', color: '{color.a.value}' }, type: 'boxShadow' } }, color: { a: { value: '#000' } } }));
  expect('transform: references inside composite values are rewritten, boxShadow → shadow', tree.option.shadow.s.$value.color === '{option.color.a}' && tree.option.shadow.s.$type === 'shadow', j(tree));

  ({ tree, notes } = m({ x: { a: { value: '1', type: 'weird' } } }));
  expect('transform: an unknown type is kept and flagged', tree.option.x.a.$type === 'weird' && notes.some((n) => n.includes('"weird"')), j(notes));

  ({ tree } = m({ b: { z: { value: '1' } }, a: { y: { value: '2' } } }));
  expect('transform: key order is preserved', j(Object.keys(tree.option)) === j(['b', 'a']) && j(Object.keys(tree.option.b)) === j(['z']));

  expect('transform: needsStyleDictionaryMigration is false for DTCG, for mixed files and for the output', !needsStyleDictionaryMigration({ option: { a: { $value: '1' } } }) && !needsStyleDictionaryMigration({ a: { value: '1' }, b: { $value: '2' } }) && !needsStyleDictionaryMigration(m({ a: { value: '1' } }).tree));
  expect('transform: migrating twice changes nothing (the output is not legacy)', (() => { const once = m({ color: { a: { value: '#fff' } } }).tree; return !needsStyleDictionaryMigration(once); })());
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
        .replace('"oklch(0.21 0.01 255)"', '"{semantic.color.primary.solid}"')],
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

// ---------- #25: explain a DTCG object-form color ----------
// The value line shows OKLCH; the authored line shows what was written, since
// an object in another color space no longer reads back from the value.
{
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-explain-color-'));
  try {
    run(['init', 'explain-color-ds', '--cwd', dir]);
    const tp = join(dir, 'tokens/brand.tokens.json');
    const tree = JSON.parse(readFileSync(tp, 'utf8'));
    tree.semantic.color.danger = { solid: { $type: 'color', $value: { colorSpace: 'display-p3', components: [0.85, 0.1, 0.12] } } };
    writeFileSync(tp, JSON.stringify(tree, null, 2));
    const r = run(['explain', 'danger.solid', '--cwd', dir]);
    expect('explain object color: exit 0', r.code === 0, r.out);
    expect('explain object color: value in OKLCH', r.out.includes('semantic.color.danger.solid = oklch('), r.out);
    expect('explain object color: shows the authored object', r.out.includes('└─ authored as {"colorSpace":"display-p3","components":[0.85,0.1,0.12]}'), r.out);
    const plain = run(['explain', 'primary.solid', '--cwd', dir]);
    expect('explain string color: the authored line stays bare', !plain.out.includes('authored as'), plain.out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- #65: catalog, the semantic contract as data ----------
// Needs no project: run from an empty directory, with no config anywhere up
// the tree that could be read by accident. Same bytes on every run (the
// catalog is a probe compile of the engine, not of a project).
{
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-catalog-'));
  const runHere = (args) => {
    const r = spawnSync('node', [cli, ...args], { cwd: dir, encoding: 'utf8' });
    return { code: r.status ?? 1, out: (r.stdout ?? '') + (r.stderr ?? ''), stdout: r.stdout ?? '' };
  };
  try {
    const { catalog } = await import('../packages/core/src/index.js');
    const expected = catalog();
    let r = runHere(['catalog', '--json']);
    expect('catalog --json: exit 0 outside a project', r.code === 0, r.out);
    let parsed;
    try { parsed = JSON.parse(r.stdout); } catch { parsed = null; }
    expect('catalog --json: prints parseable JSON on stdout', parsed !== null, r.out.slice(0, 300));
    expect('catalog --json: lists exactly the slots core\'s catalog() returns',
      parsed?.slots?.length === expected.slots.length && parsed.slots.every((s, i) => s.path === expected.slots[i].path),
      `${parsed?.slots?.length} vs ${expected.slots.length}`);
    expect('catalog --json: every slot carries path, tier, group, type, kind, rule, inputs, requires',
      parsed?.slots?.every((s) => ['path', 'tier', 'group', 'type', 'kind', 'rule', 'inputs', 'requires'].every((k) => k in s)));
    expect('catalog --json: byte-identical on a second run', runHere(['catalog', '--json']).stdout === r.stdout);

    r = runHere(['catalog']);
    expect('catalog: exit 0', r.code === 0, r.out);
    const groups = [...new Set(expected.slots.map((s) => `${s.tier} · ${s.group}`))];
    const missing = groups.filter((g) => !r.stdout.includes(`\n${g} (`));
    expect('catalog: prints a heading for every group', missing.length === 0, `missing: ${missing.join(', ')}`);

    r = runHere(['catalog', 'primary']);
    expect('catalog: a positional argument is a usage error (exit 2)', r.code === 2, r.out);
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
    writeFileSync(tp, readFileSync(tp, 'utf8').replace('oklch(0.21 0.01 255)', 'oklch(0.75 0.01 255)'));
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

// ---------- #93: small authoring checks (TST1120, TST1121, TST2104) ----------
// One edit per case on the init scaffold, with two shadcn instances (one per
// era) added so TST2104 can fire. Each edit raises its code once with a hint;
// the controls (the clean scaffold, radius.md 0, one in-order space rung, an
// out-of-gamut option token no slot reads) raise none of the three.
{
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-93-'));
  const tp = join(dir, 'tokens/brand.tokens.json');
  const cp = join(dir, 'transtyle.config.json');
  const CODES = ['TST1120', 'TST1121', 'TST2104'];
  try {
    run(['init', 'authoring-ds', '--cwd', dir]);
    const cfg = JSON.parse(readFileSync(cp, 'utf8'));
    cfg.targets.shadcn = { output: 'dist/shadcn' };
    cfg.targets['shadcn-v3'] = { exporter: 'shadcn', output: 'dist/shadcn-v3', options: { era: 'tailwind-v3' } };
    writeFileSync(cp, JSON.stringify(cfg, null, 2));
    const scaffold = JSON.parse(readFileSync(tp, 'utf8'));
    const withEdit = (edit) => {
      const tree = structuredClone(scaffold);
      edit(tree);
      writeFileSync(tp, JSON.stringify(tree, null, 2));
      const r = run(['check', '--cwd', dir, '--json']);
      let j = null;
      try { j = JSON.parse(r.stdout); } catch { /* reported below */ }
      const ours = (j?.diagnostics ?? []).filter((d) => CODES.includes(d.code));
      return { r, j, ours, byCode: (c) => ours.filter((d) => d.code === c) };
    };

    let h = withEdit(() => {});
    expect('authoring control: the clean scaffold reports none of TST1120/1121/2104', h.j && h.ours.length === 0, JSON.stringify(h.ours) || h.r.out);

    h = withEdit((t) => { t.option.color.brand['500'].$value = 'oklch(0.7 0.3 145)'; });
    let [d] = h.byCode('TST1120');
    expect('TST1120: an out-of-sRGB brand colour is reported once, as info', h.byCode('TST1120').length === 1 && d.severity === 'info' && h.r.code === 0, JSON.stringify(h.ours));
    expect('TST1120: names the source token, the slot and the hex fallback', d?.message === 'option.color.brand.500 = oklch(0.7 0.3 145) is outside sRGB (used by semantic.color.primary.solid)' && d.hint?.includes('#00c800') && d.hex === '#00c800', JSON.stringify(d));

    h = withEdit((t) => { t.option.color.brand['900'] = { $value: 'oklch(0.7 0.3 145)' }; });
    expect('TST1120 control: an out-of-gamut option token no slot reads stays silent', h.byCode('TST1120').length === 0, JSON.stringify(h.ours));

    h = withEdit((t) => { t.semantic.radius.md.$value = '0.125rem'; });
    const radius = h.byCode('TST2104');
    expect('TST2104: radius.md 0.125rem is reported once per shadcn instance', radius.length === 2 && radius.every((x) => x.severity === 'info' && x.hint?.includes('0.25rem')), JSON.stringify(h.ours));
    expect('TST2104: each message names its instance and its era\'s variables', radius.some((x) => x.target === 'shadcn' && x.message.startsWith('shadcn: --radius-sm and --radius-md resolve to 0 or less with radius.md = 0.125rem (2px)'))
      && radius.some((x) => x.target === 'shadcn-v3' && x.message.startsWith('shadcn-v3: borderRadius.sm and borderRadius.md')), JSON.stringify(radius));
    const b = run(['build', '--cwd', dir]);
    const built = (() => { try { return JSON.parse(readFileSync(join(dir, 'dist/shadcn/report.json'), 'utf8')); } catch { return null; } })();
    expect('TST2104: build exits 0 and report.json carries it', b.code === 0 && built?.diagnostics.some((x) => x.code === 'TST2104' && x.target === 'shadcn'), b.out);

    h = withEdit((t) => { t.semantic.radius.md.$value = '0rem'; });
    expect('TST2104 control: radius.md 0rem (a square design) stays silent', h.byCode('TST2104').length === 0, JSON.stringify(h.ours));

    h = withEdit((t) => { t.semantic.space = { $type: 'dimension', 1: { $value: '0.5rem' }, 2: { $value: '1rem' }, 3: { $value: '1.5rem' }, 4: { $value: '2rem' } }; });
    [d] = h.byCode('TST1121');
    expect('TST1121: an 8px space.1..4 next to the 4px defaults is one warning', h.byCode('TST1121').length === 1 && d.severity === 'warning', JSON.stringify(h.ours));
    expect('TST1121: names the inverted pair', d?.message === 'space is out of order: space.4 = 2rem (authored) > space.5 = 1.25rem (catalog default)' && d.hint?.includes('space.5'), JSON.stringify(d));

    h = withEdit((t) => { t.semantic.space = { $type: 'dimension', sm: { $value: '0.5rem' }, md: { $value: '1rem' }, lg: { $value: '2rem' } }; });
    [d] = h.byCode('TST1121');
    expect('TST1121: a scale under its own names is reported as renamed', h.byCode('TST1121').length === 1 && d.message.startsWith('space has authored tokens (space.lg, space.md, space.sm) but none of the catalog\'s rungs'), JSON.stringify(h.ours));

    h = withEdit((t) => { t.semantic.space = { $type: 'dimension', 4: { $value: '1rem' } }; });
    expect('TST1121 control: one rung tuned in order stays silent', h.byCode('TST1121').length === 0, JSON.stringify(h.ours));

    // The exporter diagnostics channel rejects what an exporter may not say:
    // an error from emit is a contract violation, reported as TST3001.
    writeFileSync(join(dir, 'loud.mjs'), `export default {
  name: 'loud',
  emit: () => ({ files: [], coverage: [], diagnostics: [{ severity: 'error', code: 'X0001', message: 'stop' }] }),
};
`);
    writeFileSync(cp, JSON.stringify({ ...cfg, targets: { ...cfg.targets, loud: { exporter: './loud.mjs', output: 'dist/loud' } } }, null, 2));
    h = withEdit(() => {});
    const loud = (h.j?.diagnostics ?? []).filter((x) => x.code === 'TST3001');
    expect('exporter diagnostics: an error-severity entry is a TST3001 naming the target', h.r.code === 1 && loud.length === 1 && loud[0].message.includes('"loud"') && loud[0].message.includes('severity must be "info" or "warning"'), JSON.stringify(loud) || h.r.out);
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
    expect('check --json: a crashed or unloadable target reads nothing (reads: [])',
      !!json && ['boom', 'gone'].every((n) => json.targets.some((t) => t.target === n && Array.isArray(t.reads) && t.reads.length === 0)), r.out);
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

// ---------- check --matrix: which targets read each slot (#95) ----------
{
  const acme = join(root, 'examples/acme');
  const parse = (out) => { try { return JSON.parse(out); } catch { return null; } };
  const readers = (m, slot) => Object.keys(m?.slots?.[slot] ?? {}).sort().join(', ');

  let r = run(['check', '--matrix', '--cwd', acme]);
  expect('check --matrix: exit 0 on Acme', r.code === 0, `exit ${r.code}: ${r.out.slice(-400)}`);
  const line = r.stdout.split('\n').find((l) => l.trim().startsWith('categorical.1 ')) ?? '';
  expect('check --matrix: prints the palette section to stdout', r.stdout.includes('\nsemantic.palette\n'), r.stdout.slice(0, 400));
  expect('check --matrix: categorical.1 is read by 4 instances, daisyUI not among them',
    /\b4\/\d+\b/.test(line) && ['shadcn', 'echarts', 'css-variables'].every((t) => line.includes(t)) && !line.includes('daisyui'), line);

  r = run(['check', '--matrix', '--json', '--cwd', acme]);
  const json = parse(r.stdout);
  const m = json?.matrix;
  expect('check --matrix --json: one JSON object, report keys kept, matrix added',
    !!json && Array.isArray(json.diagnostics) && Array.isArray(json.targets) && Array.isArray(m?.targets), r.stdout.slice(0, 400));
  expect('check --matrix --json: palette.categorical.1 → shadcn, shadcn-v3, echarts, css-variables',
    readers(m, 'semantic.palette.categorical.1') === 'css-variables, echarts, shadcn, shadcn-v3', readers(m, 'semantic.palette.categorical.1'));
  expect('check --matrix --json: elevation.3.surface → shadcn, shadcn-v3, echarts, css-variables, primeng, mui',
    readers(m, 'semantic.color.elevation.3.surface') === 'css-variables, echarts, mui, primeng, shadcn, shadcn-v3', readers(m, 'semantic.color.elevation.3.surface'));
  expect('check --matrix --json: a named reader carries its class and variables',
    m?.slots?.['semantic.color.elevation.0.surface']?.shadcn?.class === 'native' && m.slots['semantic.color.elevation.0.surface'].shadcn.variables.includes('--background'),
    JSON.stringify(m?.slots?.['semantic.color.elevation.0.surface']?.shadcn));
  expect('check --matrix --json: catalog slots only (no option.*), every slot listed',
    !!m && !Object.keys(m.slots).some((k) => k.startsWith('option.')) && Object.keys(m.slots).length > 200, `${Object.keys(m?.slots ?? {}).length} slots`);

  // #160: core records the reads; --matrix only adds the matrix built from them.
  const plain = parse(run(['check', '--json', '--cwd', acme]).stdout);
  expect('check --matrix: the per-target report is the same with and without --matrix',
    !!plain && JSON.stringify(plain.targets) === JSON.stringify(json?.targets));
  const shadcnReads = plain?.targets?.find((t) => t.target === 'shadcn')?.reads ?? [];
  expect('check --json: each target carries its reads, sorted, catalog slots only',
    shadcnReads.includes('semantic.color.elevation.3.surface') &&
      shadcnReads.every((s) => /^(semantic|component)\./.test(s)) &&
      JSON.stringify(shadcnReads) === JSON.stringify([...shadcnReads].sort()), JSON.stringify(shadcnReads));
  expect('check --matrix --json: every cell comes from that target\'s reads (and every read has a cell)',
    !!m && !!plain && plain.targets.every((t) =>
      JSON.stringify(t.reads) === JSON.stringify(Object.keys(m.slots).filter((s) => m.slots[s][t.target]))),
    'matrix and reads disagree');

  // The same reads land in each target's report.json (a build in a scratch copy).
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-reads-'));
  try {
    cpSync(acme, dir, { recursive: true, filter: (src) => !/[\\/](dist|demo|node_modules)$/.test(src) });
    const b = run(['build', 'shadcn', 'primeng', '--cwd', dir]);
    const report = (t) => parse(existsSync(join(dir, 'dist', t, 'report.json')) ? readFileSync(join(dir, 'dist', t, 'report.json'), 'utf8') : '');
    expect('build: report.json carries the target\'s reads, as check --json lists them',
      b.code === 0 && ['shadcn', 'primeng'].every((t) =>
        JSON.stringify(report(t)?.reads) === JSON.stringify(plain?.targets?.find((x) => x.target === t)?.reads)),
      `exit ${b.code}: ${b.out.slice(-300)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  r = run(['build', '--matrix', '--cwd', acme]);
  expect('build --matrix: refused as a usage error (exit 2)', r.code === 2, `exit ${r.code}`);

  // The recording view an exporter gets is the IR it would get without it:
  // same keys and entry values, mode aliases still one object, and listing
  // keys is not a read (packages/core/src/reads.js).
  const { recordingView } = await import('../packages/core/src/reads.js');
  const shared = new Map([['semantic.radius.md', { type: 'dimension', value: '4px' }], ['option.blue.500', { type: 'color', value: '#00f' }]]);
  const { view, reads } = recordingView({ defaultMode: 'light', modes: { light: shared, 'mode:light': shared } });
  const keys = [...view.modes.light.keys()];
  expect('recording: same keys, same size, aliases kept as one map',
    JSON.stringify(keys) === JSON.stringify([...shared.keys()]) && view.modes.light.size === 2 && view.modes.light === view.modes['mode:light'],
    JSON.stringify(keys));
  expect('recording: listing keys reads nothing', reads().length === 0, JSON.stringify(reads()));
  const values = [...view.modes.light.values()].map((e) => e.value);
  expect('recording: entries opened while iterating keep their values and count as reads (catalog slots only)',
    JSON.stringify(values) === JSON.stringify(['4px', '#00f']) && JSON.stringify(reads()) === '["semantic.radius.md"]', JSON.stringify(reads()));
  view.modes.light.get('semantic.color.accent.solid');
  expect('recording: a lookup of a slot the design system lacks is not a read', JSON.stringify(reads()) === '["semantic.radius.md"]', JSON.stringify(reads()));
}

// ---------- explain --target / --variable: slot ↔ target variable (#98) ----------
{
  const acme = join(root, 'examples/acme');
  const parse = (out) => { try { return JSON.parse(out); } catch { return null; } };
  const explain = (...a) => run(['explain', ...a, '--cwd', acme]);

  // Goldens: the whole stdout, so the layout is pinned too.
  let r = explain('--variable', '$form-select-border-radius', '--target', 'bootstrap');
  expect('explain --variable: a chained Bootstrap variable follows $input-border-radius to its slot (golden)', r.code === 0 && r.stdout === [
    'bootstrap:',
    '  $form-select-border-radius  derived  via $input-border-radius',
    '    $input-border-radius  derived  → component.control.radius',
    '',
    'component.control.radius = 0.5rem',
    ' └─ derived by rule alias(radius.control)@standard@1',
    '    inputs: semantic.radius.control = 0.5rem',
    '     └─ derived by rule alias(radius.md)@standard@1',
    '        inputs: semantic.radius.md = 0.5rem',
    '         └─ authored',
    '',
  ].join('\n'), r.out);

  r = explain('component.button.radius', '--target', 'bootstrap');
  expect('explain <slot> --target: the tree follows the alias to the authored radius.md, then lists the consumers (golden)', r.code === 0 && r.stdout === [
    'component.button.radius = 9999px',
    ' └─ aliased → semantic.radius.full',
    '     └─ derived by rule radius-scale(full)@standard@1',
    '        inputs: semantic.radius.md = 0.5rem',
    '         └─ authored',
    '',
    'consumed by bootstrap:',
    '  $btn-border-radius             native',
    '  $navbar-toggler-border-radius  derived  via $btn-border-radius',
    '',
  ].join('\n'), r.out);

  r = explain('--variable', '$btn-border-radius', '--target', 'bootstrap');
  expect('explain --variable $btn-border-radius: → component.button.radius, tree reaches the authored semantic.radius.md',
    r.code === 0 && r.stdout.startsWith('bootstrap:\n  $btn-border-radius  native  → component.button.radius\n') && r.stdout.includes('inputs: semantic.radius.md = 0.5rem\n         └─ authored'), r.out);
  r = explain('--variable', 'btn-border-radius', '--target', 'bootstrap');
  expect('explain --variable: a Bootstrap name works without its $', r.code === 0 && r.stdout.includes('$btn-border-radius  native  → component.button.radius'), r.out);
  r = explain('--variable', '$btn-border-radius-sm', '--target', 'bootstrap');
  expect('explain --variable: a var(--bs-*) alias follows the Sass variable behind it', r.code === 0 && r.stdout.includes('$btn-border-radius-sm  derived  via $border-radius-sm') && r.stdout.includes('$border-radius-sm  derived  → semantic.radius.sm'), r.out);
  r = explain('--variable', '$btn-transition', '--target', 'bootstrap');
  expect('explain --variable: a row reading two slots shows both trees', r.code === 0 && r.stdout.includes('→ semantic.duration.fast, semantic.easing.standard') && r.stdout.includes('\nsemantic.easing.standard = '), r.out);
  r = explain('--variable', 'components.button.root.borderRadius', '--target', 'primeng');
  expect('explain --variable: a nested PrimeNG preset path resolves to component.button.radius', r.code === 0 && r.stdout.startsWith('primeng:\n  components.button.root.borderRadius  native  → component.button.radius\n\ncomponent.button.radius = 9999px\n'), r.out);
  r = explain('--variable', '$form-check-radio-border-radius', '--target', 'bootstrap');
  expect('explain --variable: a dropped variable prints its class and note (exit 0)', r.code === 0 && r.stdout.includes('$form-check-radio-border-radius  dropped\n    structural/behavioral option') && !r.stdout.includes(' = '), r.out);
  r = explain('--variable', '$btn-boder-radius', '--target', 'bootstrap');
  expect('explain --variable: an unknown variable exits 2 with the nearest names', r.code === 2 && r.out.includes('Unknown bootstrap variable: $btn-boder-radius') && r.out.includes('  $btn-border-radius\n'), r.out);

  r = explain('btn-border-radius', '--target', 'bootstrap');
  expect('explain <name> --target: a name that is not a slot is looked up as a variable', r.code === 0 && r.stdout.startsWith('bootstrap:\n  $btn-border-radius  native'), r.out);
  r = explain('primary.solid', '--target', 'shadcn');
  expect('explain <slot> --target: a catalog slot always wins', r.code === 0 && r.stdout.startsWith('semantic.color.primary.solid = ') && r.stdout.includes('consumed by shadcn:\n  --primary'), r.out);
  r = explain('semantic.color.elevation.3.surface', '--target', 'primeng');
  expect('explain <slot> --target: a slot read with no row naming it says so', r.code === 0 && r.stdout.endsWith('consumed by primeng: read as an input, no coverage row names it\n'), r.out);
  r = explain('semantic.palette.categorical.1', '--target', 'daisyui');
  expect('explain <slot> --target: a slot the target never reads says so', r.code === 0 && r.stdout.endsWith('consumed by daisyui: not read\n'), r.out);

  r = explain('--variable', '$btn-border-radius');
  expect('explain --variable without --target: usage error (exit 2)', r.code === 2, `exit ${r.code}`);
  r = explain('primary.solid', '--target', 'bootstrp');
  expect('explain --target: an unconfigured target exits 2 with the TST1301 suggestion', r.code === 2 && r.out.includes('Did you mean "bootstrap"?'), r.out);
  r = explain('--variable', '$btn-border-radius', '--target', 'bootstrap', '--mode', 'sepia');
  expect('explain --variable: an unknown mode exits 2', r.code === 2 && r.out.includes('Unknown mode "sepia"'), r.out);
  r = run(['check', '--target', 'bootstrap', '--cwd', acme]);
  expect('--target outside explain: usage error (exit 2)', r.code === 2 && r.out.includes('--target is a `transtyle explain` option'), r.out);

  r = explain('--variable', '$form-select-border-radius', '--target', 'bootstrap', '--json');
  const v = parse(r.stdout);
  expect('explain --variable --json: rows, the via chain, the slots reached and their trees',
    r.code === 0 && v?.variable === '$form-select-border-radius' && v.rows[0].via[0].variable === '$input-border-radius'
      && v.slots.join() === 'component.control.radius' && v.trees[0].slot === 'component.control.radius' && v.mode === 'light', r.stdout.slice(0, 400));
  const again = explain('--variable', '$form-select-border-radius', '--target', 'bootstrap', '--json');
  expect('explain --json: deterministic (two runs, same bytes)', again.stdout === r.stdout);
  r = explain('component.control.radius', '--target', 'bootstrap', '--json');
  const f = parse(r.stdout);
  expect('explain <slot> --target --json: the tree plus the target\'s consumers, chained ones with their path',
    r.code === 0 && f?.slot === 'component.control.radius' && f.target?.name === 'bootstrap' && f.target.read === true
      && f.target.consumers.some((c) => c.variable === '$form-select-border-radius' && c.through.join() === '$input-border-radius'), r.stdout.slice(0, 400));
  r = explain('primary.solid', '--json');
  expect('explain <slot> --json without --target: the explainToken() tree', r.code === 0 && parse(r.stdout)?.slot === 'semantic.color.primary.solid' && !('target' in parse(r.stdout)), r.stdout.slice(0, 200));
}

// ---------- #59: binding pattern rules ----------
// The same design system bound by 6 rules and by the plain alias file those
// rules expand to must build byte-identical output; the committed plain file is
// itself the golden of `bindings --expand`.
{
  const rulesFx = join(root, 'packages/core/test-fixtures/bindings-rules');
  const explicitFx = join(root, 'packages/core/test-fixtures/bindings-explicit');
  const tmp = mkdtempSync(join(tmpdir(), 'transtyle-check-bindings-'));
  try {
    let r = run(['bindings', '--expand', '--cwd', rulesFx]);
    expect('bindings --expand: exit 0', r.code === 0, r.out);
    expect('bindings --expand: matches the committed plain file', r.stdout === readFileSync(join(explicitFx, 'tokens/bindings.tokens.json'), 'utf8'), 'regenerate it: transtyle bindings --expand --cwd packages/core/test-fixtures/bindings-rules');
    expect('bindings --expand: the authored cell wins over its rule', !r.stdout.includes('"danger": {\n      "solid"'), r.stdout);
    expect('bindings --expand: a role without the target token is skipped silently', !r.stdout.includes('option.color.info.700'), r.stdout);
    expect('bindings --expand: reports what was skipped on stderr', /skipped 1 already authored/.test(r.out) && /target missing/.test(r.out), r.out);

    r = run(['bindings', '--cwd', rulesFx]);
    expect('bindings without --expand: usage error (exit 2)', r.code === 2, `exit ${r.code}`);
    r = run(['bindings', '--expand', '--cwd', explicitFx]);
    expect('bindings --expand: no rules is a usage error (exit 2)', r.code === 2, `exit ${r.code}`);

    for (const [name, fx] of [['rules', rulesFx], ['explicit', explicitFx]]) {
      cpSync(fx, join(tmp, name), { recursive: true });
    }
    // the explicit fixture reaches into the rules fixture's token files
    const explicitCfg = JSON.parse(readFileSync(join(tmp, 'explicit/transtyle.config.json'), 'utf8'));
    explicitCfg.tokens = explicitCfg.tokens.map((t) => t.replace('../bindings-rules/', '../rules/'));
    writeFileSync(join(tmp, 'explicit/transtyle.config.json'), JSON.stringify(explicitCfg));
    for (const name of ['rules', 'explicit']) {
      r = run(['build', '--cwd', join(tmp, name)]);
      expect(`bindings fixture (${name}): builds`, r.code === 0, r.out);
    }
    const readAll = (dir) => {
      const out = new Map();
      for (const t of ['css-variables', 'bootstrap', 'shadcn']) {
        for (const f of readdirSync(join(dir, 'dist', t))) {
          if (f === 'report.json') continue; // lists the same files; compared via the others
          out.set(`${t}/${f}`, readFileSync(join(dir, 'dist', t, f), 'utf8'));
        }
      }
      return out;
    };
    const a = readAll(join(tmp, 'rules'));
    const b = readAll(join(tmp, 'explicit'));
    expect('bindings: rules and the plain alias file emit the same files', [...a.keys()].join() === [...b.keys()].join() && a.size > 3, [...a.keys()].join());
    const differing = [...a.keys()].filter((k) => a.get(k) !== b.get(k));
    expect('bindings: rules and the plain alias file emit byte-identical output', differing.length === 0, `differs: ${differing.join(', ')}`);

    r = run(['explain', 'primary.tint', '--cwd', rulesFx]);
    expect('explain: names the rule behind a bound slot', r.code === 0 && r.out.includes('aliased → option.color.primary.50  (from rule bindings[2]: semantic.color.{role}.tint)'), r.out);
    r = run(['explain', 'danger.solid', '--cwd', rulesFx]);
    expect('explain: an authored cell shows no rule', r.code === 0 && r.out.includes('authored') && !r.out.includes('from rule'), r.out);

    // error cases, on a copy of the rules fixture with one rule swapped in
    const bad = (label, rule, code, extra = {}) => {
      const dir = join(tmp, `bad-${label}`);
      cpSync(rulesFx, dir, { recursive: true });
      const cfg = JSON.parse(readFileSync(join(dir, 'transtyle.config.json'), 'utf8'));
      cfg.bindings = [...(extra.before ?? []), rule];
      writeFileSync(join(dir, 'transtyle.config.json'), JSON.stringify(cfg));
      const res = run(['check', '--cwd', dir, '--json']);
      expect(`bindings ${label}: ${code}`, res.out.includes(code), res.out);
      return { dir, res };
    };
    let x = bad('unknown placeholder', { slot: 'semantic.color.{colour}.solid', from: '{option.color.white}' }, 'TST1117');
    expect('bindings unknown placeholder: fails (exit 1)', x.res.code === 1, `exit ${x.res.code}`);
    bad('from placeholder missing in slot', { slot: 'semantic.color.primary.solid', from: '{option.color.{role}.600}' }, 'TST1117');
    bad('from is not an alias', { slot: 'semantic.color.{role}.solid', from: 'oklch(0.5 0.1 255)' }, 'TST1117');
    bad('roles without {role}', { slot: 'semantic.color.primary.solid', from: '{option.color.primary.600}', roles: ['primary'] }, 'TST1117');
    bad('unknown role', { slot: 'semantic.color.{role}.solid', from: '{option.color.{role}.600}', roles: ['primray'] }, 'TST1117');
    x = bad('required target missing', { slot: 'semantic.color.{role}.solid-hover', from: '{option.color.{role}.700}', required: true }, 'TST1118');
    expect('bindings required target missing: fails (exit 1)', x.res.code === 1, `exit ${x.res.code}`);
    x = bad('rule conflict', { slot: 'semantic.color.{role}.tint', from: '{option.color.white}' }, 'TST1119', { before: [{ slot: 'semantic.color.{role}.solid', from: '{option.color.{role}.600}' }, { slot: 'semantic.color.{role}.tint', from: '{option.color.{role}.50}' }] });
    expect('bindings rule conflict: only a note (exit 0)', x.res.code === 0, `exit ${x.res.code}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ---------- #60: bind --suggest ----------
// Each example that keeps a bindings file is copied with that file removed from
// its config, and the suggestion must give its bindings back: every in-scope
// binding recovered (one deliberate exception), nothing else proposed (no false
// friend, no binding of a slot the example leaves to derivation). Acme binds
// its slots in place, so nothing is left to propose. The fixture's regular
// vocabulary must come back as three pattern rules that expand to exactly the
// alias file, and its two brand names must be contested, not written.
{
  const tmp = mkdtempSync(join(tmpdir(), 'transtyle-check-bind-'));
  const flat = (tree, prefix = []) => Object.entries(tree).flatMap(([k, v]) => k.startsWith('$') ? []
    : v && typeof v === 'object' && '$value' in v ? [[[...prefix, k].join('.'), v.$value]] : flat(v, [...prefix, k]));
  const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };
  // In scope: role solids but neutral, text rungs, elevation 0/1, border, ring, links, fonts. radius.md is a literal, not a binding.
  const inScope = (slot) => !/^semantic\.color\.neutral\./.test(slot) && !slot.startsWith('semantic.radius.') && !/^semantic\.color\.[^.]+-[^.]+\.solid$/.test(slot);
  const examples = {
    // Cathode binds font.sans to its mono stack on purpose (the CRT look): no
    // sans-serif token exists to suggest, so that one is the expected miss.
    cathode: { miss: ['semantic.font.sans'] },
    govuk: { miss: [] },
    carbon: { miss: [] },
  };
  const recall = [];
  try {
    for (const [name, { miss }] of Object.entries(examples)) {
      const dir = join(tmp, name);
      cpSync(join(root, 'examples', name), dir, { recursive: true, filter: (src) => !/\/(demo|dist|node_modules)(\/|$)/.test(src) });
      const cfg = JSON.parse(readFileSync(join(dir, 'transtyle.config.json'), 'utf8'));
      const bindingsFile = cfg.tokens.find((t) => typeof t === 'string' && t.endsWith('transtyle.bindings.tokens.json'));
      cfg.tokens = cfg.tokens.filter((t) => t !== bindingsFile);
      writeFileSync(join(dir, 'transtyle.config.json'), JSON.stringify(cfg));
      const authored = new Map(flat(JSON.parse(readFileSync(join(dir, bindingsFile), 'utf8'))).filter(([slot]) => inScope(slot)));

      const r = run(['bind', '--suggest', '--json', '--cwd', dir]);
      const report = parse(r.stdout);
      expect(`bind --suggest (${name}, bindings removed): exit 0 with a JSON report`, r.code === 0 && !!report, r.out);
      if (!report) continue;
      const proposed = new Map(report.slots.filter((x) => x.status === 'proposed').map((x) => [x.slot, x]));
      const recovered = [...authored].filter(([slot, from]) => proposed.get(slot) && `{${proposed.get(slot).from}}` === from).map(([slot]) => slot);
      const missed = [...authored.keys()].filter((slot) => !recovered.includes(slot));
      const extra = [...proposed.keys()].filter((slot) => !authored.has(slot) || `{${proposed.get(slot).from}}` !== authored.get(slot));
      recall.push(`${name} ${recovered.length}/${authored.size}`);
      expect(`bind --suggest (${name}): recovers every in-scope binding${miss.length ? ` but ${miss.join(', ')}` : ''}`, missed.join() === miss.join(), `missed: ${missed.join(', ')}`);
      expect(`bind --suggest (${name}): proposes nothing the example doesn't bind`, extra.length === 0, extra.map((slot) => `${slot} ← ${proposed.get(slot).from}`).join(', '));
      expect(`bind --suggest (${name}): nothing contested`, !report.slots.some((x) => x.status === 'contested'), JSON.stringify(report.slots.filter((x) => x.status === 'contested')));

      const again = run(['bind', '--suggest', '--json', '--cwd', dir]);
      expect(`bind --suggest (${name}): byte-identical on a second run`, again.stdout === r.stdout);
      const file = run(['bind', '--suggest', '--cwd', dir]);
      const tokens = parse(file.stdout);
      expect(`bind --suggest (${name}): stdout is a token file with an annotated alias per proposal`,
        !!tokens && tokens.$schema?.includes('/schemas/tokens/') && flat(tokens).length === proposed.size
        && flat(tokens).every(([slot, from]) => `{${proposed.get(slot)?.from}}` === from), file.stdout.slice(0, 400));

      if (name === 'cathode') {
        const c = (slot) => proposed.get(`semantic.color.${slot}`)?.confidence;
        expect('bind --suggest (cathode): primary on value alone is low (one mode decides it)', c('primary.solid') === 'low', c('primary.solid'));
        expect('bind --suggest (cathode): warning and danger on value alone, never high', c('warning.solid') === 'medium' && c('danger.solid') === 'medium', `${c('warning.solid')} ${c('danger.solid')}`);
        expect('bind --suggest (cathode): the reasons say why (hue against the anchor)', /hue \d+° \| \d+° off the danger anchor \(25\)/.test(proposed.get('semantic.color.danger.solid')?.reasons.join(';') ?? ''), proposed.get('semantic.color.danger.solid')?.reasons.join(';'));
        // The suggested file, added back in place of the authored one, builds.
        writeFileSync(join(dir, 'tokens/bindings.suggested.tokens.json'), file.stdout);
        cfg.tokens.push('tokens/bindings.suggested.tokens.json');
        writeFileSync(join(dir, 'transtyle.config.json'), JSON.stringify(cfg));
        const built = run(['check', '--cwd', dir]);
        expect('bind --suggest (cathode): the suggested file checks clean in place of the authored one', built.code === 0, built.out);
      }
      if (name === 'carbon') {
        expect('bind --suggest (carbon): "text-primary" is a text rung, not the brand', proposed.get('semantic.color.primary.solid')?.from === 'semantic.color.carbon.button-primary' && proposed.get('semantic.color.text.base')?.from === 'semantic.color.carbon.text-primary');
      }
      if (name === 'govuk') {
        const left = ['secondary', 'accent', 'warning', 'info'].filter((role) => report.slots.find((x) => x.slot === `semantic.color.${role}.solid`)?.status !== 'none');
        expect('bind --suggest (govuk): the roles GOV.UK leaves to derivation stay derived', left.length === 0, left.join(', '));
      }
    }
    console.log(`  bind --suggest recall (in-scope bindings recovered): ${recall.join(', ')}`);

    // Acme authors its catalog slots in place: they are bound, nothing is proposed.
    let r = run(['bind', '--suggest', '--json', '--cwd', join(root, 'examples/acme')]);
    let report = parse(r.stdout);
    expect('bind --suggest (acme): exit 0, nothing proposed above low', r.code === 0 && !!report && !report.slots.some((x) => x.status === 'proposed' && x.confidence !== 'low'), r.out.slice(0, 400));
    expect('bind --suggest (acme): its authored slots are reported as bound', report?.slots.find((x) => x.slot === 'semantic.color.primary.solid')?.status === 'bound');

    // The fixture: pattern rules, contested slot.
    const fx = join(root, 'packages/core/test-fixtures/bind-suggest');
    r = run(['bind', '--suggest', '--cwd', fx]);
    const aliases = flat(parse(r.stdout) ?? {});
    expect('bind --suggest (fixture): contested primary is reported, not written', !aliases.some(([slot]) => slot === 'semantic.color.primary.solid')
      && /Contested, not written \(1\)/.test(r.out) && /Contested, not written: semantic\.color\.primary\.solid \(semantic\.color\.ui\.action or semantic\.color\.ui\.brand\)/.test(r.stdout), r.out);
    r = run(['bind', '--suggest', '--rules', '--cwd', fx]);
    const rules = parse(r.stdout)?.bindings ?? [];
    expect('bind --suggest --rules (fixture): the regular vocabulary becomes {role}, {rung} and {level} rules',
      rules.length === 4 && rules.some((x) => x.slot === 'semantic.color.{role}.solid' && x.from === '{semantic.color.ui.{role}}' && x.roles?.join() === 'success,danger')
      && rules.some((x) => x.slot === 'semantic.color.text.{rung}') && rules.some((x) => x.slot === 'semantic.color.elevation.{level}.surface'), r.stdout);
    const ruled = join(tmp, 'fixture-rules');
    cpSync(fx, ruled, { recursive: true });
    const cfg = JSON.parse(readFileSync(join(ruled, 'transtyle.config.json'), 'utf8'));
    cfg.bindings = rules;
    writeFileSync(join(ruled, 'transtyle.config.json'), JSON.stringify(cfg));
    r = run(['bindings', '--expand', '--cwd', ruled]);
    const expanded = flat(parse(r.stdout) ?? {});
    const key = (list) => list.map(([slot, from]) => `${slot}=${from}`).sort().join('\n');
    expect('bind --suggest --rules (fixture): the rules expand to exactly the alias file', r.code === 0 && aliases.length === 7 && key(expanded) === key(aliases), `${key(expanded)}\n---\n${key(aliases)}`);

    r = run(['bind', '--cwd', fx]);
    expect('bind without --suggest: usage error (exit 2)', r.code === 2, `exit ${r.code}`);
    r = run(['bind', '--suggest', 'extra', '--cwd', fx]);
    expect('bind --suggest with an argument: usage error (exit 2)', r.code === 2, `exit ${r.code}`);
    r = run(['bind', '--suggest', '--rules', '--json', '--cwd', fx]);
    expect('bind --suggest --rules --json: usage error (exit 2)', r.code === 2, `exit ${r.code}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ---------- #99: init's answers — flags, presets, layouts, prompts ----------
// Every answer has a flag, validated before anything is written; without a
// terminal nothing is asked; the same answers give the same bytes; every
// preset × layout × schemes builds clean on all eleven targets; the prompts
// (driven here by scripted streams, as a terminal would) re-ask a wrong answer
// and give up cleanly when input ends.
{
  const { promptAnswers, scaffold, INIT_DEFAULTS } = await import(join(root, 'packages/cli/src/init.js'));
  const ALL = ['shadcn', 'echarts', 'daisyui', 'bootstrap', 'storybook', 'css-variables', 'radix', 'primeng', 'mantine', 'chakra', 'mui'];
  const fresh = (label) => mkdtempSync(join(tmpdir(), `transtyle-check-99-${label}-`));
  const report = (cwd) => {
    const r = run(['check', '--cwd', cwd, '--json']);
    try { return JSON.parse(r.stdout); } catch { return { diagnostics: [{ code: `unparseable: ${r.out}`, severity: 'error', message: '' }], targets: [] }; }
  };
  const loud = (j) => j.diagnostics.filter((d) => d.severity !== 'info').map((d) => `${d.code} ${d.message}`);
  const dirs = [];
  try {
    // The issue's acceptance command.
    let dir = fresh('accept'); dirs.push(dir);
    let r = run(['init', '--cwd', dir, '--brand', '#e8590c', '--schemes', 'light,dark', '--targets', 'shadcn,bootstrap', '--preset', 'recommended']);
    expect('init flags: the acceptance command exits 0', r.code === 0, r.out);
    expect('init flags: the closing check runs and shows the on-solid swatch', /check: 0 errors, 0 warnings/.test(r.out) && /primary\.solid #e8590c, on-solid #[0-9a-f]{6}: \d+\.\d:1/.test(r.out), r.out);
    let j = report(dir);
    expect('init flags: acceptance project has no error or warning', loud(j).length === 0, loud(j).join('\n'));
    expect('init flags: --targets configures exactly those targets', JSON.stringify(j.targets.map((t) => t.target)) === '["shadcn","bootstrap"]', JSON.stringify(j.targets.map((t) => t.target)));
    const cfg = JSON.parse(readFileSync(join(dir, 'transtyle.config.json'), 'utf8'));
    expect('init: token files are listed by name, the dark one as a mode-scoped overlay', JSON.stringify(cfg.tokens) === JSON.stringify(['tokens/brand.tokens.json', { files: 'tokens/brand.dark.tokens.json', mode: { 'color-scheme': 'dark' } }]), JSON.stringify(cfg.tokens));
    const tokens = JSON.parse(readFileSync(join(dir, 'tokens/brand.tokens.json'), 'utf8'));
    expect('init: the brand is written as typed', tokens.option.color.brand['500'].$value === '#e8590c', JSON.stringify(tokens.option.color.brand));
    expect('init: neutrals take the brand hue', tokens.semantic.color.text.base.$value === 'oklch(0.21 0.01 42)', tokens.semantic.color.text.base.$value);
    expect('init: every token file carries the $schema line', ['brand', 'brand.dark'].every((f) => JSON.parse(readFileSync(join(dir, `tokens/${f}.tokens.json`), 'utf8')).$schema === 'https://transtyle.dev/schemas/tokens/v0.json'));

    // Determinism: same answers, same bytes, whatever order the targets were typed in.
    const twin = fresh('twin'); dirs.push(twin);
    run(['init', '--cwd', twin, '--brand', '#e8590c', '--schemes', 'light,dark', '--targets', 'bootstrap,shadcn', '--preset', 'recommended']);
    const same = ['transtyle.config.json', 'tokens/brand.tokens.json', 'tokens/brand.dark.tokens.json']
      .every((f) => readFileSync(join(dir, f), 'utf8').replace(/"name": "[^"]*"/, '') === readFileSync(join(twin, f), 'utf8').replace(/"name": "[^"]*"/, ''));
    expect('init: same answers give byte-identical files (target order ignored)', same);

    // Every preset × layout × schemes, all eleven targets, no error, no warning, each file loaded once.
    for (const preset of ['recommended', 'minimal']) {
      for (const layout of ['single', 'layered']) {
        for (const schemes of ['light,dark', 'light']) {
          dir = fresh(`${preset}-${layout}`); dirs.push(dir);
          r = run(['init', '--cwd', dir, '--brand', '#e8590c', '--preset', preset, '--layout', layout, '--schemes', schemes, '--targets', ALL.join(',')]);
          j = report(dir);
          const label = `init --preset ${preset} --layout ${layout} --schemes ${schemes}`;
          expect(`${label}: builds on all eleven targets with no error or warning`, r.code === 0 && j.targets.length === 11 && loud(j).length === 0, `${r.out}\n${loud(j).join('\n')}`);
          expect(`${label}: no file loaded twice (no TST1103)`, !j.diagnostics.some((d) => d.code === 'TST1103'));
        }
      }
    }

    // The neutral ladder in the hue of very different brands: no contrast warning
    // on a neutral pair. (A violet brand's derived secondary can still warn:
    // that comes from derivation, not from what init writes.)
    for (const brand of ['#e8590c', '#ffe066', '#0a0a0a', '#00ff00', '#7c3aed']) {
      dir = fresh('brand'); dirs.push(dir);
      run(['init', '--cwd', dir, '--yes', '--brand', brand, '--targets', 'css-variables']);
      const neutral = report(dir).diagnostics.filter((d) => d.code === 'TST2101' && /(text|elevation|border)\./.test(d.message));
      expect(`init --brand ${brand}: no neutral pair below AA in either mode`, neutral.length === 0, neutral.map((d) => d.message).join('\n'));
    }

    // A ratio just under a threshold never prints as the threshold: the violet
    // brand's derived secondary measures just under 4.5 and must not read "4.5:1 (< 4.5:1)".
    dir = fresh('under-threshold'); dirs.push(dir);
    run(['init', '--cwd', dir, '--yes', '--brand', '#7c3aed', '--targets', 'css-variables']);
    const under = report(dir).diagnostics.filter((d) => d.code === 'TST2101');
    const printed = (m) => { const x = /is (\d+(?:\.\d+)?):1 .*\(< (\d+(?:\.\d+)?):1/.exec(m); return x && [Number(x[1]), Number(x[2])]; };
    expect('TST2101: a printed ratio is always below the printed threshold (rounded down, never "4.5:1 (< 4.5:1)")',
      under.length > 0 && under.every((d) => { const p = printed(d.message); return p && p[0] < p[1]; }), under.map((d) => d.message).join('\n'));

    // Bad answers: exit 2 with the valid values, and nothing written.
    for (const [label, args, says] of [
      ['an unknown target', ['--targets', 'shadcn,nope'], 'Valid targets:'],
      ['a color that does not parse', ['--brand', 'notacolor'], 'is not a color'],
      ['a translucent brand', ['--brand', 'transparent'], 'opaque'],
      ['an unknown preset', ['--preset', 'nope'], 'Valid: recommended, minimal'],
      ['a dark-only scheme set', ['--schemes', 'dark'], 'Valid: light,dark or light'],
      ['an unknown layout', ['--layout', 'nope'], 'Valid: single, layered'],
      ['a flag with no value', ['--brand'], 'needs a value'],
    ]) {
      dir = fresh('bad'); dirs.push(dir);
      r = run(['init', '--cwd', dir, ...args]);
      expect(`init refuses ${label} (exit 2, says why, writes nothing)`, r.code === 2 && r.out.includes(says) && !existsSync(join(dir, 'transtyle.config.json')) && !existsSync(join(dir, 'tokens')), `exit ${r.code}: ${r.out}`);
    }
    r = run(['build', '--brand', '#e8590c', '--cwd', dirs[0]]);
    expect('an init flag on another command is a usage error', r.code === 2 && r.out.includes('only applies to init'), `exit ${r.code}: ${r.out}`);
    dir = fresh('taken'); dirs.push(dir);
    run(['init', '--cwd', dir, '--layout', 'layered']);
    rmSync(join(dir, 'transtyle.config.json'));
    r = run(['init', '--cwd', dir]);
    expect('init refuses to overwrite an existing token file (exit 2, no config written)', r.code === 2 && r.out.includes('tokens/brand.tokens.json') && !existsSync(join(dir, 'transtyle.config.json')), `exit ${r.code}: ${r.out}`);

    // No terminal: nothing asked, stdin never read, defaults written.
    dir = fresh('notty'); dirs.push(dir);
    const piped = spawnSync('node', [cli, 'init', '--cwd', dir], { encoding: 'utf8', input: '#00ff00\n2\n', timeout: 20000 });
    expect('init without a terminal asks nothing and ignores stdin', piped.status === 0 && !/Brand color/.test(piped.stderr) && readFileSync(join(dir, 'tokens/brand.tokens.json'), 'utf8').includes(INIT_DEFAULTS.brand), `exit ${piped.status}: ${piped.stderr}`);

    // The layered layout: your names, the overlay, the bindings; the slot resolves through them.
    dir = fresh('layered'); dirs.push(dir);
    run(['init', '--cwd', dir, '--layout', 'layered']);
    r = run(['explain', 'text.base', '--cwd', dir, '--mode', 'dark']);
    expect('init --layout layered: catalog slots bind to your names, dark from the overlay', /= oklch\(0\.97 0\.004 255\)/.test(r.out) && r.out.includes('aliased → semantic.color.ui.ink'), r.out);

    // The prompts, driven by scripted input as a terminal would: a wrong
    // answer is explained and asked again, numbers pick from the lists, Enter
    // takes the default, flags already given are not asked.
    const { PassThrough } = await import('node:stream');
    const ask = async (script, given = {}) => {
      const input = new PassThrough();
      const output = new PassThrough();
      let shown = '';
      output.on('data', (c) => { shown += c; });
      input.end(script);
      try { return { answers: await promptAnswers(given, ALL, { input, output }), shown }; } catch (e) { return { error: e, shown }; }
    };
    let p = await ask('#zz\n#e8590c\n2\nnope\n1,bootstrap\n\n2\n');
    expect('prompts: re-ask a color that does not parse', (p.shown.match(/Brand color/g) ?? []).length === 2 && p.shown.includes('"#zz" is not a color'), p.shown);
    expect('prompts: re-ask an unknown target, listing the valid ones', (p.shown.match(/Targets \[/g) ?? []).length === 2 && p.shown.includes('Unknown target: nope'), p.shown);
    expect('prompts: numbers, names and Enter give the expected answers', JSON.stringify(p.answers) === JSON.stringify({ brand: '#e8590c', schemes: ['light'], targets: ['shadcn', 'bootstrap'], preset: 'recommended', layout: 'layered' }), JSON.stringify(p.answers ?? p.error?.message));
    p = await ask('\n\n', { brand: '#7c3aed', schemes: ['light', 'dark'], targets: ['radix'] });
    expect('prompts: a flag skips its question', !p.shown.includes('Brand color') && !p.shown.includes('Targets') && JSON.stringify(p.answers) === JSON.stringify({ brand: '#7c3aed', schemes: ['light', 'dark'], targets: ['radix'], preset: 'recommended', layout: 'single' }), `${p.shown}\n${JSON.stringify(p.answers)}`);
    p = await ask('#e8590c\n');
    expect('prompts: input that ends early rejects as input-ended', p.error?.code === 'input-ended', p.error?.message ?? JSON.stringify(p.answers));
    // What the prompts answered compiles like the flags do.
    p = await ask('#e8590c\n\n1,4\n\n\n');
    expect('prompts and flags write the same files for the same answers',
      JSON.stringify(scaffold({ name: 'x', ...p.answers })) === JSON.stringify(scaffold({ name: 'x', brand: '#e8590c', schemes: ['light', 'dark'], targets: ['shadcn', 'bootstrap'], preset: 'recommended', layout: 'single' })));
  } finally {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  }
}

// ---------- #7: source locations and check.suppress ----------
// A diagnostic about an authored token names its file, line and column (the
// key's opening quote); one about a derived value has none. `check.suppress`
// silences a warning or info with a required reason, lists it under
// `suppressed`, never touches an error, and says so when an entry is stale.
{
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-7-'));
  const tp = join(dir, 'tokens/brand.tokens.json');
  const cp = join(dir, 'transtyle.config.json');
  const check = (...extra) => run(['check', '--cwd', dir, '--json', ...extra]);
  const parse = (r) => { try { return JSON.parse(r.stdout); } catch { return { diagnostics: [], suppressed: [], unparseable: r.out }; } };
  const setConfig = (edit) => { const c = JSON.parse(config); edit(c); writeFileSync(cp, JSON.stringify(c, null, 2)); };
  let config;
  try {
    run(['init', 'loc-ds', '--cwd', dir]);
    const scaffold = readFileSync(tp, 'utf8');
    config = readFileSync(cp, 'utf8');

    // Locations: dangling alias, with the printed form.
    const dangling = scaffold.replace('{option.color.brand.500}', '{option.color.brand.999}');
    writeFileSync(tp, dangling);
    let r = check();
    let d = parse(r).diagnostics.find((x) => x.code === 'TST1105');
    expect('locations: TST1105 carries path, file, line and column', !!d && d.path === 'semantic.color.primary.solid' && d.file === 'tokens/brand.tokens.json' && Number.isInteger(d.line) && Number.isInteger(d.column), JSON.stringify(d));
    // `solid` is the only key of that name inside semantic.color.primary
    const solidLine = dangling.split('\n').findIndex((l, i, ls) => /"solid"/.test(l) && ls.slice(0, i).some((p) => /"primary"/.test(p))) + 1;
    expect('locations: TST1105 points at the real line of the offending key', !!d && d.line === solidLine && dangling.split('\n')[d.line - 1].slice(d.column - 1).startsWith('"solid"'), JSON.stringify(d));
    expect('locations: the terminal form is code file:line:col message', r.out.includes(`TST1105 tokens/brand.tokens.json:${d?.line}:${d?.column} Dangling alias`), r.out);

    // A diagnostic about an authored anchor is located (one about a derived slot, e.g. a contrast ratio, has no source line).
    writeFileSync(tp, scaffold);
    const derived = parse(check()).diagnostics.filter((x) => x.code === 'TST1204');
    expect('locations: TST1204 (an authored anchor) is located', derived.length > 0 && derived.every((x) => x.file === 'tokens/brand.tokens.json' && x.line > 0), JSON.stringify(derived));

    // A syntax error names the line the parser stopped at.
    // init lists its token files one by one, so the extra file is added to the config
    setConfig((c) => { c.tokens.push('tokens/zz.tokens.json'); });
    writeFileSync(join(dir, 'tokens/zz.tokens.json'), '{\n  "a": 1,\n  "b" }\n');
    r = check();
    d = parse(r).diagnostics.find((x) => x.code === 'TST1002');
    expect('locations: TST1002 names the file and the line the parser stopped at', !!d && d.file === 'tokens/zz.tokens.json' && d.line === 3, JSON.stringify(d));
    rmSync(join(dir, 'tokens/zz.tokens.json'));
    setConfig(() => {});

    // A duplicate across two base layers points at the later definition.
    writeFileSync(join(dir, 'tokens/zz.tokens.json'), JSON.stringify({ option: { color: { brand: { 500: { $type: 'color', $value: '#123456' } } } } }, null, 2));
    setConfig((c) => { c.tokens.splice(1, 0, 'tokens/zz.tokens.json'); });
    d = parse(check()).diagnostics.find((x) => x.code === 'TST1103');
    expect('locations: TST1103 points at the later definition', !!d && d.path === 'option.color.brand.500' && d.file === 'tokens/zz.tokens.json' && d.line > 0, JSON.stringify(d));
    rmSync(join(dir, 'tokens/zz.tokens.json'));
    setConfig(() => {});

    // Suppressions. A TST1305 warning (top-level group outside the tiers) is the subject.
    const withStray = JSON.parse(scaffold);
    withStray.stray = { thing: { $type: 'color', $value: '#abcdef' } };
    writeFileSync(tp, JSON.stringify(withStray, null, 2));
    let out = parse(check());
    expect('suppress control: TST1305 warns and `suppressed` is [] when nothing is configured', out.diagnostics.some((x) => x.code === 'TST1305') && Array.isArray(out.suppressed) && out.suppressed.length === 0, JSON.stringify(out.suppressed));

    setConfig((c) => { c.check.failOn = 'warning'; });
    expect('suppress control: failOn warning fails on it (exit 1)', check().code === 1);

    const reason = 'stray is a scratch group that only holds an experiment';
    setConfig((c) => { c.check.failOn = 'warning'; c.check.suppress = [{ code: 'TST1305', path: 'stray', reason }]; });
    r = check();
    out = parse(r);
    expect('suppress: the warning leaves diagnostics', !out.diagnostics.some((x) => x.code === 'TST1305'), JSON.stringify(out.diagnostics));
    expect('suppress: it is listed under suppressed with its reason, location and path', out.suppressed.length === 1 && out.suppressed[0].code === 'TST1305' && out.suppressed[0].reason === reason && out.suppressed[0].path === 'stray' && out.suppressed[0].file === 'tokens/brand.tokens.json' && out.suppressed[0].line > 0, JSON.stringify(out.suppressed));
    expect('suppress: failOn warning no longer fails (exit 0)', r.code === 0, `exit ${r.code}: ${r.out}`);
    const human = run(['check', '--cwd', dir]);
    expect('suppress: one summary line, and no printed TST1305', /1 diagnostic suppressed by check\.suppress/.test(human.out) && !/TST1305/.test(human.out), human.out);

    // The code alone (no path) matches every diagnostic of that code; a wrong path matches nothing.
    setConfig((c) => { c.check.failOn = 'warning'; c.check.suppress = [{ code: 'TST1305', reason }]; });
    out = parse(check());
    expect('suppress: an entry without path matches every diagnostic of its code', out.suppressed.length === 1 && !out.diagnostics.some((x) => x.code === 'TST1305'), JSON.stringify(out));
    setConfig((c) => { c.check.failOn = 'warning'; c.check.suppress = [{ code: 'TST1305', path: 'other', reason }]; });
    r = check();
    out = parse(r);
    expect('suppress: a path that matches nothing keeps the warning and adds TST1012 (info)', out.diagnostics.some((x) => x.code === 'TST1305') && out.diagnostics.some((x) => x.code === 'TST1012' && x.severity === 'info' && x.message.includes('matched no diagnostic')), JSON.stringify(out.diagnostics));

    // Prefix: `group.*` matches children and not the group itself.
    const withChildren = JSON.parse(scaffold);
    withChildren.semantic.shape = { $type: 'color', a: { $value: 'nonsense-1' }, b: { $value: 'nonsense-2' } };
    writeFileSync(tp, JSON.stringify(withChildren, null, 2));

    // Errors are never suppressible: the error stays, fails, and TST1012 says why.
    setConfig((c) => { c.check.suppress = [{ code: 'TST1106', path: 'semantic.shape.*', reason }]; });
    r = check();
    out = parse(r);
    expect('suppress: an error is not silenced, still fails (exit 1)', r.code === 1 && out.diagnostics.filter((x) => x.code === 'TST1106').length === 2 && out.suppressed.length === 0, r.out);
    expect('suppress: matching only an error produces the TST1012 note', out.diagnostics.some((x) => x.code === 'TST1012' && x.message.includes('cannot be suppressed')), JSON.stringify(out.diagnostics));
    writeFileSync(tp, JSON.stringify(withStray, null, 2));

    // Prefix on a warning: the group `stray` is the path of TST1305 itself, so `stray.*` does not match it.
    setConfig((c) => { c.check.suppress = [{ code: 'TST1305', path: 'stray.*', reason }]; });
    out = parse(check());
    expect('suppress: `group.*` matches below the group, not the group itself', out.diagnostics.some((x) => x.code === 'TST1305') && out.suppressed.length === 0, JSON.stringify(out));

    // reason: missing, empty and blank each fail config load with TST1010 naming the entry; so does an unknown key.
    for (const [label, entry] of [
      ['a missing reason', { code: 'TST1305' }],
      ['an empty reason', { code: 'TST1305', reason: '' }],
      ['a blank reason', { code: 'TST1305', reason: '   ' }],
      ['an unknown key', { code: 'TST1305', reason, target: 'css-variables' }],
    ]) {
      setConfig((c) => { c.check.suppress = [entry]; });
      r = check();
      expect(`suppress: ${label} fails config load with TST1010 naming the entry`, r.code === 1 && /TST1010 .*check\.suppress\[0\]/.test(r.out), r.out);
    }

    // The report: every report.json has `suppressed`, in order and always present.
    setConfig((c) => { c.check.suppress = [{ code: 'TST1305', path: 'stray', reason }]; });
    r = run(['build', '--cwd', dir]);
    const report = JSON.parse(readFileSync(join(dir, 'dist/css-variables/report.json'), 'utf8'));
    expect('report.json: carries the suppressed list with its reason', r.code === 0 && report.suppressed.length === 1 && report.suppressed[0].reason === reason && !report.diagnostics.some((x) => x.code === 'TST1305'), r.out);
    writeFileSync(tp, scaffold);
    setConfig(() => {});
    run(['build', '--cwd', dir]);
    const clean = JSON.parse(readFileSync(join(dir, 'dist/css-variables/report.json'), 'utf8'));
    expect('report.json: `suppressed` is [] when nothing is suppressed', Array.isArray(clean.suppressed) && clean.suppressed.length === 0);
    r = run(['check', '--cwd', dir]);
    expect('suppress: no summary line when nothing was suppressed', !/suppressed by check\.suppress/.test(r.out), r.out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- #5: --out, --dry-run, --quiet, --verbose, NO_COLOR ----------
{
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-flags-'));
  const outer = mkdtempSync(join(tmpdir(), 'transtyle-check-flags-out-'));
  try {
    run(['init', 'flags-ds', '--cwd', dir, '--targets', 'shadcn,storybook']);
    const cp = join(dir, 'transtyle.config.json');
    const cfg = JSON.parse(readFileSync(cp, 'utf8'));
    cfg.targets.storybook = { ...cfg.targets.storybook, options: { previewTargets: ['shadcn'] } };
    cfg.targets.shadcn.output = 'src/theme'; // a configured output --out must replace
    writeFileSync(cp, JSON.stringify(cfg, null, 2));
    const runIn = (args, env = {}) => {
      const r = spawnSync('node', [cli, ...args, '--cwd', dir], { encoding: 'utf8', env: { ...process.env, TRANSTYLE_DEBUG: '', ...env } });
      return { code: r.status ?? 1, out: (r.stdout ?? '') + (r.stderr ?? ''), stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
    };
    const ESC = String.fromCharCode(27);

    // --dry-run: the build's output, minus the writing.
    let r = runIn(['build', '--dry-run']);
    expect('--dry-run: exit 0', r.code === 0, r.out);
    expect('--dry-run: lists the files it would write, report.json included', r.out.includes('would write src/theme/globals.transtyle.css') && r.out.includes('would write dist/storybook/report.json'), r.out);
    expect('--dry-run: says nothing was written', r.out.includes('dry run complete, nothing written'), r.out);
    expect('--dry-run: writes nothing (no output directory, no staging leftovers)', !existsSync(join(dir, 'src')) && !existsSync(join(dir, 'dist')), r.out);
    r = runIn(['build', '--dry-run', 'nope']);
    expect('--dry-run: still fails like build on an unknown target (exit 1)', r.code === 1 && r.out.includes('TST1301'), `exit ${r.code}: ${r.out}`);

    // --out: <dir>/<target name> for every target, siblings redirected too.
    r = runIn(['build', '--out', join(outer, 'themes')]);
    expect('--out: exit 0', r.code === 0, r.out);
    expect('--out: every target lands in <dir>/<target name>, with its report.json',
      existsSync(join(outer, 'themes/shadcn/globals.transtyle.css')) && existsSync(join(outer, 'themes/shadcn/report.json')) && existsSync(join(outer, 'themes/storybook/preview.transtyle.ts')), r.out);
    expect('--out: nothing is written to the configured output', !existsSync(join(dir, 'src')) && !existsSync(join(dir, 'dist')), r.out);
    const preview = readFileSync(join(outer, 'themes/storybook/preview.transtyle.ts'), 'utf8');
    expect('--out: the Storybook import points at the redirected sibling', /import '\.\.\/shadcn\/globals\.transtyle\.css'/.test(preview), preview);
    r = runIn(['build', '--out', 'rel-out', '--dry-run']);
    expect('--out + --dry-run: lists the redirected paths (relative to the shell, not --cwd)', r.out.includes('rel-out') || r.out.includes('/rel-out'), r.out);
    r = runIn(['build', '--out']);
    expect('--out: a missing value exits 2', r.code === 2 && r.out.includes('--out needs a directory'), r.out);
    r = runIn(['build', '--out', '--quiet']);
    expect('--out: a following flag is not a value (exit 2)', r.code === 2, r.out);
    for (const flag of ['--dry-run', '--out']) {
      r = runIn(['check', flag, ...(flag === '--out' ? [join(outer, 'x')] : [])]);
      expect(`${flag}: refused on check (exit 2)`, r.code === 2 && r.out.includes('applies to `transtyle build`'), r.out);
    }

    // --quiet / --verbose.
    r = runIn(['build', '--quiet', '--out', join(outer, 'q')]);
    expect('--quiet: a successful build prints nothing on stderr', r.code === 0 && r.stderr === '', JSON.stringify(r.stderr));
    expect('--quiet: it still builds', existsSync(join(outer, 'q/shadcn/report.json')));
    r = runIn(['check', '--quiet', '--json']);
    let json; try { json = JSON.parse(r.stdout); } catch { json = null; }
    expect('--quiet: check --json still prints the whole report on stdout', r.code === 0 && !!json && json.targets.length === 2 && r.stderr === '', r.out);
    r = runIn(['build', '--quiet', '--verbose']);
    expect('--quiet with --verbose is contradictory (exit 2)', r.code === 2, r.out);
    r = runIn(['explain', 'primary.solid', '--quiet']);
    expect('--quiet: refused on explain (exit 2)', r.code === 2 && r.out.includes('applies to'), r.out);

    const bad = JSON.parse(readFileSync(cp, 'utf8'));
    bad.check = { failOn: 'warning' };
    bad.targets.boom = { exporter: './no-such-exporter.mjs', output: 'dist/boom' };
    writeFileSync(cp, JSON.stringify(bad, null, 2));
    r = runIn(['build', '--quiet']);
    expect('--quiet: a failing build still prints its errors and the failure line', r.code === 1 && r.stderr.includes('TST3002') && r.stderr.includes('failed (fail-on: warning)'), r.out);
    expect('--quiet: but not the coverage lines', !r.stderr.includes('% native'), r.out);
    writeFileSync(cp, JSON.stringify(cfg, null, 2));

    r = runIn(['build', '--verbose', '--out', join(outer, 'v')]);
    expect('--verbose: shows the exporter, the output directory and file sizes', r.code === 0 && /exporter shadcn, options \{\}, output .*v\/shadcn/.test(r.stderr) && /globals\.transtyle\.css\s+\(\d+ bytes\)/.test(r.stderr), r.out);
    r = runIn(['build', '--out', join(outer, 'v2')]);
    expect('default output has no sizes', !/\(\d+ bytes\)/.test(r.stderr), r.out);

    // TRANSTYLE_DEBUG=1 is --verbose: the stack of a crashed exporter comes with either.
    writeFileSync(join(dir, 'boom.mjs'), 'export default { name: "boom", emit() { throw new TypeError("kaboom"); } };\n');
    const boom = JSON.parse(readFileSync(cp, 'utf8'));
    boom.targets = { boom: { exporter: './boom.mjs', output: 'dist/boom' } };
    writeFileSync(cp, JSON.stringify(boom, null, 2));
    r = runIn(['build', '--verbose']);
    expect('--verbose prints the stack of a crashed exporter', /TypeError[\s\S]*boom\.mjs/.test(r.out) && r.code === 1, r.out);
    r = runIn(['build']);
    expect('the crash hint names --verbose', r.out.includes('--verbose'), r.out);

    // NO_COLOR: the CLI never colors; the contract is pinned, with and without the variable.
    for (const env of [{}, { NO_COLOR: '1' }]) {
      const label = env.NO_COLOR ? 'with NO_COLOR' : 'without NO_COLOR';
      for (const args of [['build', '--dry-run'], ['check'], ['catalog'], ['explain', 'primary.solid']]) {
        writeFileSync(cp, JSON.stringify(cfg, null, 2));
        const o = runIn(args, env);
        expect(`no ANSI escape in \`${args.join(' ')}\` ${label}`, !o.out.includes(ESC), JSON.stringify(o.out.slice(0, 200)));
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(outer, { recursive: true, force: true });
  }
}

// ---------- #14: an exporter built for another IR spec or plugin API ----------
// A third-party exporter installed in the project's node_modules, like a real
// one: the CLI loader finds its package.json and core checks the manifest.
{
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-14-'));
  try {
    run(['init', 'compat-ds', '--cwd', dir]);
    const pkgDir = join(dir, 'node_modules', 'acme-exporter');
    mkdirSync(join(pkgDir, 'src'), { recursive: true });
    writeFileSync(join(pkgDir, 'src', 'index.js'), `export default {
  name: 'acme',
  emit: () => ({ files: [{ path: 'acme.css', contents: ':root {}\\n', kind: 'stylesheet' }], coverage: [] }),
};
`);
    const writeManifest = (transtyle) => writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({
      name: 'acme-exporter', version: '2.1.0', type: 'module', exports: { '.': './src/index.js' },
      ...(transtyle ? { transtyle: { kind: 'exporter', name: 'acme', capabilities: ['build'], ...transtyle } } : {}),
    }, null, 2));
    const cp = join(dir, 'transtyle.config.json');
    const cfg = JSON.parse(readFileSync(cp, 'utf8'));
    cfg.targets = {
      acme: { exporter: 'acme-exporter', output: 'dist/acme' },
      'css-variables': { output: 'dist/css-variables' },
      'acme-again': { exporter: 'acme-exporter', output: 'dist/acme-again' },
    };
    writeFileSync(cp, JSON.stringify(cfg, null, 2));

    writeManifest({ irSpec: 'v1', pluginApi: '0' });
    let r = run(['build', '--cwd', dir]);
    expect('#14 irSpec mismatch: exit 1', r.code === 1, `exit ${r.code}: ${r.out}`);
    expect('#14 irSpec mismatch: TST1309 names the package, its version and both IR specs',
      r.out.includes('TST1309 Exporter "acme" (acme-exporter 2.1.0) is built for IR spec "v1"; this @transtyle/core produces "v0-draft"'), r.out);
    expect('#14 irSpec mismatch: the hint says what to change', r.out.includes('Use a release of acme-exporter built for IR spec "v0-draft"'), r.out);
    expect('#14 irSpec mismatch: nothing is written for any target', !existsSync(join(dir, 'dist')), r.out);
    expect('#14 irSpec mismatch: later targets are still checked (one run reports every incompatible exporter)', r.out.includes('TST1309 Exporter "acme-again"'), r.out);

    writeManifest({ irSpec: 'v0-draft', pluginApi: '^1' });
    r = run(['build', '--cwd', dir]);
    expect('#14 pluginApi mismatch: TST1309 with the range and the implemented version',
      r.code === 1 && r.out.includes('requires plugin API "^1"; this @transtyle/core implements "0.0.0"'), r.out);

    writeManifest({ irSpec: 'v1', pluginApi: '1' });
    r = run(['check', '--json', '--cwd', dir]);
    const json = (() => { try { return JSON.parse(r.stdout); } catch { return null; } })();
    expect('#14 both wrong: two TST1309 per target in one run', !!json && json.diagnostics.filter((d) => d.code === 'TST1309' && d.message.startsWith('Exporter "acme"')).length === 2, r.out);

    writeManifest({ irSpec: 'v0-draft', pluginApi: '>=0 <2' });
    r = run(['build', '--cwd', dir]);
    expect('#14 a range that admits this core builds clean', r.code === 0 && !r.out.includes('TST1309') && !r.out.includes('TST1310'), `exit ${r.code}: ${r.out}`);
    expect('#14 compatible exporter: its files are written', existsSync(join(dir, 'dist/acme/acme.css')), r.out);

    writeManifest(null);
    r = run(['build', '--cwd', dir]);
    expect('#14 no manifest: builds with a TST1310 warning', r.code === 0 && r.out.includes('TST1310 Exporter "acme" (acme-exporter 2.1.0) has no "transtyle" manifest'), `exit ${r.code}: ${r.out}`);
    expect('#14 the official exporter raises nothing', !/TST13(09|10) Exporter "css-variables"/.test(r.out), r.out);

    writeManifest({ irSpec: 'v1', pluginApi: '0' });
    r = run(['check', '--matrix', '--cwd', dir]);
    expect('#14 check --matrix: the recording loader keeps the manifest (TST1309)', r.code === 1 && r.out.includes('TST1309'), `exit ${r.code}: ${r.out}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- #67: authoring completeness levels ----------
// `check --completeness <level>` lists what to author next, in order, without
// changing the exit code; build and check print one `authored n/m <level>`
// line; `derivation.require: ["completeness:<level>"]` is the policy knob, and
// `require` now refuses defaulted slots too (it used to let them through).
{
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-67-'));
  const examples = join(root, 'examples');
  const writeConfig = (extra = {}) => writeFileSync(join(dir, 'transtyle.config.json'), JSON.stringify({
    name: 'one-token',
    tokens: ['tokens/brand.tokens.json'],
    modes: { 'color-scheme': { values: ['light', 'dark'], default: 'light' } },
    derivation: { rules: 'standard@1', ...extra.derivation },
    targets: { 'css-variables': { output: 'dist/css-variables' } },
    ...(extra.check ? { check: extra.check } : {}),
  }));
  const todoOf = (cwd, level) => {
    const r = run(['check', '--cwd', cwd, '--json', '--completeness', level]);
    try { return { code: r.code, ...JSON.parse(r.stdout).completeness }; } catch { return { code: r.code, todo: [], out: r.out }; }
  };
  const keys = (todo) => todo.map((t) => `${t.slot}${t.mode ? ` (${t.mode})` : ''} ${t.state}`);
  try {
    mkdirSync(join(dir, 'tokens'));
    writeFileSync(join(dir, 'tokens/brand.tokens.json'), JSON.stringify({ semantic: { color: { primary: { solid: { $type: 'color', $value: '#e8590c' } } } } }));
    writeConfig();

    // The acceptance order: brand, neutrals, dark neutrals, radius, fonts.
    const NEUTRALS = ['elevation.0.surface defaulted', 'elevation.1.surface derived', 'text.base defaulted', 'text.muted derived', 'border missing'];
    const want = [
      ...NEUTRALS.map((n) => `semantic.color.${n}`),
      ...NEUTRALS.map((n) => `semantic.color.${n.replace(' ', ' (color-scheme=dark) ')}`),
      'semantic.radius.md missing', 'semantic.font.sans missing', 'semantic.font.mono missing',
    ];
    let c = todoOf(dir, 'recommended');
    expect('completeness: check --completeness exits 0 with a to-do (the exit code is unchanged)', c.code === 0, c.out);
    expect('completeness: one-token recommended to-do in the documented order', JSON.stringify(keys(c.todo)) === JSON.stringify(want), keys(c.todo).join('\n'));
    expect('completeness: one-token counts 1/14 recommended', c.authored === 1 && c.total === 14, `${c.authored}/${c.total}`);
    let r = run(['check', '--cwd', dir, '--completeness', 'recommended']);
    expect('completeness: the human to-do goes to stdout, numbered', /^ +1\. semantic\.color\.elevation\.0\.surface {2}defaulted by default-canvas$/m.test(r.stdout), r.stdout);
    expect('completeness: the per-scheme items name their mode', r.stdout.includes('semantic.color.text.base (color-scheme=dark)  defaulted by default-text'), r.stdout);
    r = run(['check', '--cwd', dir]);
    expect('completeness: check prints one summary line, with a pointer to the to-do', (r.out.match(/^authored 1\/14 recommended {2}· transtyle check --completeness recommended/gm) ?? []).length === 1, r.out);
    expect('completeness: plain check prints no to-do', !r.stdout.includes('To author next'), r.stdout);
    r = run(['check', '--cwd', dir, '--quiet']);
    expect('completeness: --quiet drops the summary line', !/^authored /m.test(r.out), r.out);
    r = run(['build', '--cwd', dir]);
    expect('completeness: build prints the summary line before the coverage bars', /authored 1\/14 recommended[^\n]*\n\ncss-variables /.test(r.out), r.out);
    r = run(['build', '--cwd', dir, '--completeness', 'complete']);
    expect('completeness: --completeness is refused on build (exit 2)', r.code === 2, r.out);
    r = run(['check', '--cwd', dir, '--completeness', 'everything']);
    expect('completeness: an unknown level is a usage error (exit 2)', r.code === 2 && r.out.includes('minimal, recommended, complete'), r.out);

    // check.completeness picks the default level; --completeness overrides it.
    writeConfig({ check: { completeness: 'minimal' } });
    r = run(['check', '--cwd', dir]);
    expect('completeness: check.completeness sets the summary line\'s level', /^authored 1\/1 minimal$/m.test(r.out), r.out);
    c = todoOf(dir, 'complete');
    expect('completeness: --completeness overrides check.completeness', c.level === 'complete' && c.total === 24, `${c.level} ${c.total}`);

    // derivation.require: a level expands to its items, each a TST1202.
    writeConfig({ derivation: { require: ['completeness:recommended'] } });
    let j = JSON.parse(run(['check', '--cwd', dir, '--json']).stdout);
    const t1202 = j.diagnostics.filter((d) => d.code === 'TST1202');
    expect('require completeness:recommended: one TST1202 per unauthored item (13)', t1202.length === 13, t1202.map((d) => d.message).join('\n'));
    expect('require completeness:recommended: the per-scheme items say which scheme', t1202.some((d) => d.message.startsWith('Required token is not authored for color-scheme=dark: semantic.color.border')), t1202.map((d) => d.message).join('\n'));
    // The defaulted bug: a defaulted slot passed `require` before.
    writeConfig({ derivation: { require: ['semantic.space.4', 'semantic.color.elevation.0.surface', 'semantic.color.primary'] } });
    j = JSON.parse(run(['check', '--cwd', dir, '--json']).stdout);
    const req = j.diagnostics.filter((d) => d.code === 'TST1202').map((d) => d.message);
    expect('require: a defaulted slot now fails TST1202', req.includes('Required token is not authored: semantic.space.4 (defaulted)') && req.includes('Required token is not authored: semantic.color.elevation.0.surface (defaulted)'), req.join('\n'));
    expect('require: an authored role still passes', !req.some((m) => m.includes('semantic.color.primary')), req.join('\n'));
    writeConfig({ derivation: { require: ['completeness:everything'] } });
    r = run(['check', '--cwd', dir]);
    expect('require: an unknown completeness level is a config error (TST1010)', r.code === 1 && /TST1010 [^\n]*derivation\.require\[0\]/.test(r.out), r.out);

    // The examples: Acme's golden `complete` list, govuk's single gap.
    c = todoOf(join(examples, 'acme'), 'complete');
    expect('completeness: Acme complete lists exactly what it leaves to derivation', JSON.stringify(keys(c.todo)) === JSON.stringify([
      'semantic.color.secondary.solid derived', 'semantic.color.success.solid derived', 'semantic.color.warning.solid derived',
      'semantic.color.danger.solid derived', 'semantic.color.info.solid derived', 'semantic.color.ring derived',
      'semantic.color.scrim derived', 'semantic.type.* defaulted', 'component.control.* derived',
    ]), keys(c.todo).join('\n'));
    expect('completeness: a family counts its authored members', c.todo.find((t) => t.slot === 'semantic.type.*')?.members > 0, JSON.stringify(c.todo.at(-2)));
    c = todoOf(join(examples, 'govuk'), 'recommended');
    expect('completeness: govuk recommended lists only font.mono, no per-scheme item', JSON.stringify(keys(c.todo)) === '["semantic.font.mono missing"]', keys(c.todo).join('\n'));

    // A bound neutral with its own dark value on the alias target is authored
    // for dark; one whose dark value is the light one is carried over.
    writeFileSync(join(dir, 'tokens/brand.tokens.json'), JSON.stringify({
      option: { $type: 'color', ink: { $value: '#111111', $extensions: { 'transtyle.modes': { 'color-scheme': { dark: '#eeeeee' } } } }, line: { $value: '#dddddd' } },
      semantic: { color: { $type: 'color', primary: { solid: { $value: '#e8590c' } }, text: { base: { $value: '{option.ink}' } }, border: { $value: '{option.line}' } } },
    }));
    writeConfig();
    c = todoOf(dir, 'recommended');
    const dark = (slot) => c.todo.find((t) => t.slot === slot && t.mode === 'color-scheme=dark')?.state ?? 'authored';
    expect('completeness: an alias whose target has a dark value is authored for dark', dark('semantic.color.text.base') === 'authored', keys(c.todo).join('\n'));
    expect('completeness: an alias whose target has none is carried over', dark('semantic.color.border') === 'carried-over', keys(c.todo).join('\n'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- #30: $description and $deprecated reach the outputs ----------
// The scaffold, with a described radius, a hostile description on the brand
// colour (a `*/` and a second line must not escape the comment in CSS or
// Sass), a slot bound to a deprecated option token, a deprecated group with
// one token opted out, a deprecated slot of its own, and a deprecated option
// nothing binds (silent). Then the same project with malformed metadata.
{
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-30-'));
  const tp = join(dir, 'tokens/brand.tokens.json');
  const cp = join(dir, 'transtyle.config.json');
  const json = (r) => { try { return JSON.parse(r.stdout); } catch { return { diagnostics: [] }; } };
  try {
    run(['init', 'meta-ds', '--cwd', dir]);
    run(['add', 'shadcn', '--cwd', dir]);
    run(['add', 'daisyui', '--cwd', dir]);
    run(['add', 'bootstrap', '--cwd', dir]);
    const scaffold = readFileSync(tp, 'utf8');
    const t = JSON.parse(scaffold);
    t.semantic.radius.md.$description = 'Corner radius for interactive controls only.';
    t.semantic.color.primary.solid.$description = 'Brand blue */ .evil-escape { color: red } /* tail\nsecond-line-escape';
    t.option.color.legacy = { $value: 'oklch(0.55 0.2 25)', $deprecated: 'Use option.color.brand.500 instead.' };
    t.option.color.old = { $deprecated: true, a: { $value: 'oklch(0.6 0.15 200)' }, b: { $value: 'oklch(0.75 0.15 85)', $deprecated: false } };
    t.option.color.unused = { $value: 'oklch(0.5 0.1 100)', $deprecated: 'Nothing binds me.' };
    t.semantic.color.danger = { solid: { $value: '{option.color.legacy}' } };
    t.semantic.color.info = { solid: { $value: '{option.color.old.a}' } };
    t.semantic.color.warning = { solid: { $value: '{option.color.old.b}' } };
    t.semantic.color.secondary = { solid: { $value: '{option.color.brand.500}', $deprecated: 'Use primary.' } };
    writeFileSync(tp, JSON.stringify(t, null, 2));

    let r = run(['build', '--cwd', dir]);
    expect('#30 build: exit 0 (deprecations warn, failOn stays "error")', r.code === 0, r.out);
    const css = readFileSync(join(dir, 'dist/css-variables/variables.transtyle.css'), 'utf8');
    expect('#30 css-variables: description on its own comment line above --radius-md',
      /\/\* Corner radius for interactive controls only\. \*\/\n\s*--radius-md:/.test(css), css.slice(0, 2000));
    expect('#30 css-variables: own deprecation above --color-secondary-solid',
      /\/\* Deprecated: Use primary\. \*\/\n\s*--color-secondary-solid:/.test(css));
    const outside = (text, re) => text.replace(re, '');
    for (const [file, re] of [
      ['dist/css-variables/variables.transtyle.css', /\/\*[\s\S]*?\*\//g],
      ['dist/shadcn/globals.transtyle.css', /\/\*[\s\S]*?\*\//g],
      ['dist/daisyui/daisyui.transtyle.css', /\/\*[\s\S]*?\*\//g],
      ['dist/bootstrap/_variables.transtyle.scss', /\/\/[^\n]*|\/\*[\s\S]*?\*\//g],
    ]) {
      const text = readFileSync(join(dir, file), 'utf8');
      expect(`#30 ${file}: the brand description is written`, text.includes('Brand blue'));
      const code = outside(text, re);
      expect(`#30 ${file}: "*/" and the second line stay inside the comment`,
        !code.includes('evil-escape') && !text.includes('second-line-escape'), code.split('\n').filter((l) => /evil|second-line/.test(l)).join(' | '));
    }
    try {
      const { compileString } = await import('sass');
      const scss = readFileSync(join(dir, 'dist/bootstrap/_variables.transtyle.scss'), 'utf8');
      const out = compileString(`${scss}\n.probe { color: $primary; }`, { logger: { warn: () => {} } }).css;
      expect('#30 bootstrap Sass: compiles with the hostile description, nothing leaks into CSS', !out.includes('evil-escape') && out.includes('.probe'));
    } catch (e) {
      expect('#30 bootstrap Sass: compiles with the hostile description', false, e.message.split('\n')[0]);
    }

    const report = JSON.parse(readFileSync(join(dir, 'dist/css-variables/report.json'), 'utf8'));
    const item = (v) => report.coverage.items.find((i) => i.variable === v) ?? {};
    expect('#30 report.json: item carries the slot description', item('--radius-md').description === 'Corner radius for interactive controls only.');
    expect('#30 report.json: item reached through a deprecated token carries reason and token',
      item('--color-danger-solid').deprecated === 'Use option.color.brand.500 instead.' && item('--color-danger-solid').deprecatedBy === 'option.color.legacy',
      JSON.stringify(item('--color-danger-solid')));
    expect('#30 report.json: group deprecation is `true`', item('--color-info-solid').deprecated === true && item('--color-info-solid').deprecatedBy === 'option.color.old.a');
    expect('#30 report.json: `$deprecated: false` opts out of the group', !('deprecated' in item('--color-warning-solid')));
    expect('#30 report.json: plain items gain no metadata keys', !('description' in item('--space-4')) && !('deprecated' in item('--space-4')));

    for (const target of ['css-variables', 'shadcn', 'bootstrap']) {
      const usage = readFileSync(join(dir, `dist/${target}/usage.md`), 'utf8');
      expect(`#30 ${target} usage.md: lists the deprecated token feeding it`,
        usage.includes('## Deprecated tokens') && usage.includes('`option.color.legacy`') && usage.includes('Use option.color.brand.500 instead.'), usage.slice(-800));
      expect(`#30 ${target} usage.md: a deprecated token nothing binds is not listed`, !usage.includes('option.color.unused'));
    }

    r = run(['check', '--cwd', dir, '--json']);
    const w = json(r).diagnostics.filter((d) => d.code === 'TST1122');
    const at = (p) => w.filter((d) => d.path === p);
    expect('#30 TST1122: a slot bound to a deprecated token warns once, reason as hint',
      at('semantic.color.danger.solid').length === 1 && at('semantic.color.danger.solid')[0].severity === 'warning'
        && at('semantic.color.danger.solid')[0].hint.includes('Use option.color.brand.500 instead.'), JSON.stringify(w));
    expect('#30 TST1122: a token in a deprecated group is deprecated', at('semantic.color.info.solid').length === 1);
    expect('#30 TST1122: `$deprecated: false` in that group is not', at('semantic.color.warning.solid').length === 0);
    expect('#30 TST1122: a deprecated slot of its own warns', at('semantic.color.secondary.solid').some((d) => d.message.includes('is deprecated')));
    expect('#30 TST1122: a deprecated option nothing binds is silent', !w.some((d) => d.message.includes('option.color.unused')));
    expect('#30 TST1122: derived slots are not reported again', !w.some((d) => /solid-hover|tint/.test(d.path)));

    r = run(['explain', 'radius.md', '--cwd', dir]);
    expect('#30 explain: prints the description under the value line',
      /semantic\.radius\.md = .*\n  description: Corner radius for interactive controls only\./.test(r.out), r.out);
    r = run(['explain', 'danger.solid', '--cwd', dir]);
    expect('#30 explain: names a deprecated token down the alias chain', r.out.includes('via deprecated option.color.legacy: Use option.color.brand.500 instead.'), r.out);

    const config = JSON.parse(readFileSync(cp, 'utf8'));
    writeFileSync(cp, JSON.stringify({ ...config, check: { ...config.check, failOn: 'warning' } }, null, 2));
    r = run(['check', '--cwd', dir]);
    expect('#30 failOn "warning": a deprecated binding fails the build (exit 1)', r.code === 1, `exit ${r.code}`);
    writeFileSync(cp, JSON.stringify(config, null, 2));

    // Malformed metadata: TST1311, the field ignored, the build still clean.
    const bad = JSON.parse(scaffold);
    bad.semantic.radius.md.$description = 42;
    bad.semantic.radius.md.$deprecated = 1;
    writeFileSync(tp, JSON.stringify(bad, null, 2));
    r = run(['check', '--cwd', dir, '--json']);
    const m = json(r).diagnostics.filter((d) => d.code === 'TST1311');
    expect('#30 TST1311: a non-string $description and a numeric $deprecated each warn, with a location',
      m.length === 2 && m.every((d) => d.severity === 'warning' && d.path === 'semantic.radius.md' && d.line > 0), JSON.stringify(m));
    expect('#30 TST1311: the malformed fields are ignored (no TST1122)', !json(r).diagnostics.some((d) => d.code === 'TST1122'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- #56: `extends` and `--config` ----------
// One base (tokens, modes, a bindings rule, derivation, units, check) and two
// products that extend it with different target sets. Each product builds
// exactly its own targets from the shared tokens, a product's own token layer
// is bound by the base's rule, file names are relative to the product, and
// the chain is named in report.json, check --json and explain. Built in a
// temporary copy, so the fixture never gets a dist/.
{
  const fixture = join(root, 'packages/core/test-fixtures/config-extends');
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-56-'));
  const at = (...p) => join(dir, ...p);
  const json = (r) => { try { return JSON.parse(r.stdout); } catch { return { unparseable: r.out }; } };
  const chain = ['../base/transtyle.config.json', 'transtyle.config.json'];
  const sameChain = (c) => JSON.stringify(c) === JSON.stringify(chain);
  try {
    cpSync(fixture, dir, { recursive: true });
    const baseConfig = readFileSync(at('base/transtyle.config.json'), 'utf8');

    let r = run(['build', '--cwd', at('product-a')]);
    expect('extends: product-a builds clean (exit 0)', r.code === 0, r.out);
    expect('extends: product-a emits exactly its own targets', readdirSync(at('product-a/dist')).sort().join() === 'css-variables,shadcn', readdirSync(at('product-a/dist')).join());
    r = run(['build', '--cwd', at('product-b')]);
    expect('extends: product-b builds clean (exit 0)', r.code === 0, r.out);
    expect('extends: product-b emits exactly its own targets', readdirSync(at('product-b/dist')).sort().join() === 'bootstrap,css-variables', readdirSync(at('product-b/dist')).join());
    expect('extends: nothing is written next to the base', !existsSync(at('base/dist')));

    // The shared slots are byte-identical: the products differ only in their
    // names and in the danger role, which product-b's own layer authors.
    const css = (p) => readFileSync(at(p, 'dist/css-variables/variables.transtyle.css'), 'utf8').split('\n').filter((l) => !/danger|source:/.test(l));
    const [a, b] = [css('product-a'), css('product-b')];
    expect('extends: the slots both products share are byte-identical', a.length > 100 && a.join('\n') === b.join('\n'), a.filter((l, i) => l !== b[i]).slice(0, 3).join(' | '));

    // targets.<t>.modes narrows a dimension the product inherits.
    const bs = readdirSync(at('product-b/dist/bootstrap')).filter((f) => f.endsWith('.scss') || f.endsWith('.css')).map((f) => readFileSync(at('product-b/dist/bootstrap', f), 'utf8')).join('\n');
    expect('extends: targets.<t>.modes narrows an inherited dimension (no dark block)', bs.length > 0 && !bs.includes('data-bs-theme="dark"'));

    // The chain, in merge order, relative to the product.
    const report = JSON.parse(readFileSync(at('product-a/dist/shadcn/report.json'), 'utf8'));
    expect('extends: report.json names the config chain', sameChain(report.config), JSON.stringify(report.config));
    r = run(['check', '--cwd', at('product-b'), '--json']);
    const out = json(r);
    expect('extends: check --json names the config chain', sameChain(out.config), JSON.stringify(out.config));
    expect('extends: check.suppress in the product applies (TST1204 on its own token)', out.suppressed?.length === 1 && out.suppressed[0].code === 'TST1204', JSON.stringify(out.suppressed));
    r = run(['build', '--cwd', at('base')]);
    expect('extends: a config without extends keeps a one-file chain', r.code === 0, r.out);

    r = run(['explain', 'semantic.color.danger.solid', '--cwd', at('product-b')]);
    expect('extends: explain names the chain on stderr', r.out.includes('config: transtyle.config.json ← ../base/transtyle.config.json') && !r.stdout.includes('config:'), r.out);
    expect('extends: a base\'s binding rule binds the product\'s token, labelled with its file', r.stdout.includes('from rule bindings[0] in ../base/transtyle.config.json'), r.stdout);
    r = run(['explain', 'semantic.color.primary.solid', '--cwd', at('product-a')]);
    expect('extends: a single-product explain shows the base value', /= oklch\(0\.55 0\.18 255\)/.test(r.stdout), r.stdout);

    // Diagnostics name the file a problem is in.
    writeFileSync(at('product-b/tokens/campaign.tokens.json'), '{ "option": ');
    r = run(['check', '--cwd', at('product-b'), '--json']);
    expect('extends: a product token file is named relative to the product', json(r).diagnostics?.some((d) => d.code === 'TST1002' && d.file === 'tokens/campaign.tokens.json'), r.out);
    cpSync(join(fixture, 'product-b/tokens'), at('product-b/tokens'), { recursive: true });
    writeFileSync(at('base/tokens/dark.tokens.json'), '{ "semantic": ');
    r = run(['check', '--cwd', at('product-a'), '--json']);
    expect('extends: a base token file is named relative to the product', json(r).diagnostics?.some((d) => d.code === 'TST1002' && d.file === '../base/tokens/dark.tokens.json'), r.out);
    cpSync(join(fixture, 'base/tokens'), at('base/tokens'), { recursive: true });
    writeFileSync(at('base/transtyle.config.json'), baseConfig.replace('"units"', '"unitz"'));
    r = run(['check', '--cwd', at('product-a')]);
    expect('extends: an unknown key in the base is TST1010 naming the base file', r.code === 1 && /TST1010 \.\.\/base\/transtyle\.config\.json: .*unitz/.test(r.out), r.out);
    writeFileSync(at('base/transtyle.config.json'), baseConfig.replace('"tokens/*.tokens.json"', '"tokenz/*.tokens.json"'));
    r = run(['check', '--cwd', at('product-a')]);
    expect('extends: TST1001 shows the glob as written and the file that declares it', /TST1001 Token glob matched no files: tokenz\/\*\.tokens\.json/.test(r.out) && r.out.includes('in ../base/transtyle.config.json'), r.out);
    writeFileSync(at('base/transtyle.config.json'), baseConfig);

    // A broken chain is a usage error (exit 2) that names it.
    const leaf = readFileSync(at('product-a/transtyle.config.json'), 'utf8');
    writeFileSync(at('product-a/transtyle.config.json'), leaf.replace('../base/', '../nowhere/'));
    r = run(['check', '--cwd', at('product-a')]);
    expect('extends: a missing base exits 2 naming the chain', r.code === 2 && r.out.includes('transtyle.config.json → ../nowhere/transtyle.config.json'), r.out);
    writeFileSync(at('product-a/transtyle.config.json'), leaf);
    writeFileSync(at('base/transtyle.config.json'), baseConfig.replace('"name"', '"extends": "../product-a/transtyle.config.json",\n  "name"'));
    r = run(['check', '--cwd', at('product-a')]);
    expect('extends: a two-file cycle exits 2 naming the chain', r.code === 2 && r.out.includes('loops back') && r.out.includes('transtyle.config.json → ../base/transtyle.config.json → transtyle.config.json'), r.out);
    writeFileSync(at('base/transtyle.config.json'), baseConfig);
    writeFileSync(at('product-a/transtyle.config.json'), leaf.replace('../base/transtyle.config.json', 'shared-ds'));
    r = run(['check', '--cwd', at('product-a')]);
    expect('extends: a bare name is refused (package specifiers are not supported yet)', r.code === 2 && r.out.includes('must be a file path'), r.out);
    writeFileSync(at('product-a/transtyle.config.json'), leaf);
    writeFileSync(at('base/transtyle.config.json'), baseConfig.replace(/"tokens": \[[^\]]*\],/, ''));
    writeFileSync(at('product-x.json'), JSON.stringify({ extends: './base/transtyle.config.json', targets: {} }));
    r = run(['check', '--cwd', dir, '--config', 'product-x.json']);
    expect('extends: no token layer anywhere in the chain exits 2', r.code === 2 && r.out.includes('"tokens" must list at least one glob'), r.out);
    writeFileSync(at('base/transtyle.config.json'), baseConfig);

    // A target a base declares: built into the product's own folder, and
    // `add` refuses it, leaving the base untouched.
    writeFileSync(at('base/transtyle.config.json'), baseConfig.replace('"check"', '"targets": { "echarts": { "output": "dist/echarts" } },\n  "check"'));
    const withTarget = readFileSync(at('base/transtyle.config.json'), 'utf8');
    r = run(['build', 'echarts', '--cwd', at('product-a')]);
    expect('extends: a base\'s target output resolves against the product', r.code === 0 && existsSync(at('product-a/dist/echarts/report.json')) && !existsSync(at('base/dist')), r.out);
    r = run(['add', 'echarts', '--cwd', at('product-a')]);
    expect('add: refuses a target inherited from the base, naming it', r.code === 2 && r.out.includes('inherited from ../base/transtyle.config.json'), r.out);
    r = run(['add', 'radix', '--cwd', at('product-a')]);
    const added = JSON.parse(readFileSync(at('product-a/transtyle.config.json'), 'utf8'));
    expect('add: writes into the product config only, never flattening the chain', r.code === 0 && added.targets.radix && !('tokens' in added) && added.extends === '../base/transtyle.config.json', JSON.stringify(added));
    expect('add: leaves the base file byte-identical', readFileSync(at('base/transtyle.config.json'), 'utf8') === withTarget);
    writeFileSync(at('base/transtyle.config.json'), baseConfig);
    writeFileSync(at('product-a/transtyle.config.json'), leaf);

    // Override layers (#57) compose: a product redefines a base token on purpose.
    writeFileSync(at('product-a/rebrand.tokens.json'), JSON.stringify({ option: { color: { $type: 'color', primary: { 600: { $value: 'oklch(0.6 0.2 300)' } } } } }));
    writeFileSync(at('product-a/rebrand.json'), JSON.stringify({ extends: './transtyle.config.json', tokens: [{ files: 'rebrand.tokens.json', override: true }] }));
    r = run(['check', '--cwd', at('product-a'), '--config', 'rebrand.json', '--json']);
    expect('extends + override layer: redefining a base token raises no TST1103', r.code === 0 && !json(r).diagnostics?.some((d) => d.code === 'TST1103'), r.out);
    expect('extends + override layer: three files in the chain', JSON.stringify(json(r).config) === JSON.stringify(['../base/transtyle.config.json', 'transtyle.config.json', 'rebrand.json']), JSON.stringify(json(r).config));
    r = run(['explain', 'semantic.color.primary.solid', '--cwd', at('product-a'), '--config', 'rebrand.json']);
    expect('extends + override layer: the product\'s value wins', /= oklch\(0\.6 0\.2 300\)/.test(r.stdout), r.out);

    // --config with another file name, from the product or from above it.
    cpSync(at('product-a/transtyle.config.json'), at('product-a/web.transtyle.json'));
    rmSync(at('product-a/dist'), { recursive: true, force: true });
    r = run(['build', '--cwd', at('product-a'), '--config', 'web.transtyle.json']);
    expect('--config: build reads the named file', r.code === 0 && existsSync(at('product-a/dist/shadcn/report.json')), r.out);
    const named = JSON.parse(readFileSync(at('product-a/dist/shadcn/report.json'), 'utf8')).config;
    expect('--config: report.json names the file it read', JSON.stringify(named) === JSON.stringify([chain[0], 'web.transtyle.json']), JSON.stringify(named));
    rmSync(at('product-a/dist'), { recursive: true, force: true });
    r = run(['build', 'css-variables', '--cwd', dir, '--config', 'product-a/web.transtyle.json']);
    expect('--config: outputs resolve against the config\'s directory, not --cwd', r.code === 0 && existsSync(at('product-a/dist/css-variables/report.json')) && !existsSync(at('dist')), r.out);
    r = run(['check', '--cwd', dir, '--config', 'product-a/web.transtyle.json']);
    expect('--config: check', r.code === 0, r.out);
    r = run(['explain', 'primary.solid', '--cwd', dir, '--config', 'product-a/web.transtyle.json']);
    expect('--config: explain', r.code === 0 && r.out.includes('config: web.transtyle.json ← ../base/transtyle.config.json'), r.out);
    r = run(['add', 'radix', '--cwd', dir, '--config', 'product-a/web.transtyle.json']);
    expect('--config: add writes the named file', r.code === 0 && 'radix' in JSON.parse(readFileSync(at('product-a/web.transtyle.json'), 'utf8')).targets && !('radix' in JSON.parse(readFileSync(at('product-a/transtyle.config.json'), 'utf8')).targets), r.out);
    r = run(['check', '--cwd', at('product-a'), '--config', 'missing.json']);
    expect('--config: a missing file exits 2 naming it', r.code === 2 && r.out.includes('No missing.json found'), r.out);
    r = run(['migrate', '--from', 'style-dictionary', '--cwd', dir, '--config', 'product-a/web.transtyle.json']);
    expect('--config: migrate walks every token file the chain reads, a base\'s included', r.code === 0 && r.out.includes('../base/tokens/base.tokens.json'), r.out);
    r = run(['bind', '--suggest', '--cwd', dir, '--config', 'product-a/web.transtyle.json']);
    expect('--config: bind --suggest reads the chain', r.code === 0 && json(r).$schema !== undefined, r.out.slice(0, 400));
    r = run(['init', 'named-ds', '--cwd', dir, '--config', 'ds/brand.transtyle.json', '--yes']);
    expect('--config: init writes the named file with tokens/ next to it', r.code === 0 && existsSync(at('ds/brand.transtyle.json')) && existsSync(at('ds/tokens/brand.tokens.json')) && !existsSync(at('ds/transtyle.config.json')), r.out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- BL-15 (#92): the contrast standard, WCAG 2.1 or APCA ----------
// Cathode is the dark-native example: AA-clean under WCAG, and the case APCA
// exists for. Each run copies it, changes only the config, and reads
// `check --json` (one target, so the run stays quick).
{
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-apca-'));
  try {
    cpSync(join(root, 'examples/cathode'), dir, { recursive: true, filter: (src) => !/[/\\](dist|demo|node_modules)([/\\]|$)/.test(src.slice(root.length)) });
    const cp = join(dir, 'transtyle.config.json');
    const original = readFileSync(cp, 'utf8');
    const setConfig = (edit) => { const c = JSON.parse(original); edit(c); writeFileSync(cp, JSON.stringify(c, null, 2)); };
    const check = () => {
      const r = run(['check', 'css-variables', '--cwd', dir, '--json']);
      let j = null;
      try { j = JSON.parse(r.stdout); } catch {}
      return { ...r, j, warnings: (j?.diagnostics ?? []).filter((d) => d.code === 'TST2101').map((d) => d.message) };
    };
    const has = (w, text) => w.some((m) => m.includes(text));

    let r = check();
    expect('contrast: Cathode stays clean under wcag21-aa', r.code === 0 && r.warnings.length === 0, r.warnings.join('\n'));
    expect('check --json: names the standard it measured against', r.j?.contrast?.standard === 'wcag21-aa' && r.j.contrast.algorithm === 'WCAG 2.1 contrast ratio', JSON.stringify(r.j?.contrast));

    setConfig((c) => { c.check.contrast.standard = 'apca'; });
    r = check();
    expect('apca: check --json names APCA with its base algorithm version', r.j?.contrast?.standard === 'apca' && /^APCA 0\.0\.98G-4g \(apca-w3 0\.1\.\d+\)$/.test(r.j.contrast.algorithm), JSON.stringify(r.j?.contrast));
    expect('apca: Cathode\'s dark muted text is Lc -43 and -42.7, as apca-w3 measures the emitted hex (#50a252 on #040904 / #081209)',
      has(r.warnings, 'text.muted vs elevation.0.surface is Lc -43 in dark mode (< Lc 60 apca)') && has(r.warnings, 'text.muted vs elevation.1.surface is Lc -42.7 in dark mode (< Lc 60 apca)'), r.warnings.join('\n'));
    expect('apca: on-colors are picked under APCA too, so none of them warns', r.warnings.length === 2, r.warnings.join('\n'));
    r = run(['explain', 'success.on-solid', '--cwd', dir]);
    expect('apca: success.on-solid flips to white on #319751, picked by contrast-pick(apca)', r.code === 0 && r.out.includes('semantic.color.success.on-solid = oklch(1 0 0)') && r.out.includes('contrast-pick(apca)'), r.out);

    // The pair the two standards disagree on: near-black on success.solid is
    // 5.3:1 (passes WCAG AA) and Lc 39.6 (fails APCA's Lc 60).
    setConfig((c) => { c.check.contrast.standard = 'apca'; c.derivation.contrast = 'wcag21'; });
    r = check();
    expect('apca + WCAG picks: the WCAG-picked success.on-solid fails APCA (Lc 39.6)', has(r.warnings, 'success.on-solid vs success.solid is Lc 39.6 in dark mode (< Lc 60 apca)'), r.warnings.join('\n'));

    setConfig((c) => { c.check.contrast.standard = 'wcag21-aaa'; });
    r = check();
    expect('wcag21-aaa: applies to on-colors too (it used to be 4.5:1 for them whatever the standard)', has(r.warnings, 'success.on-solid vs success.solid is 5.3:1 in dark mode (< 7:1 wcag21-aaa)'), r.warnings.join('\n'));

    // An authored on-color is measured like a derived one (it never was).
    writeFileSync(join(dir, 'tokens/on-solid.tokens.json'), JSON.stringify({ semantic: { color: { primary: { 'on-solid': { $type: 'color', $value: '#3f8f40' } } } } }));
    for (const standard of ['wcag21-aa', 'apca']) {
      setConfig((c) => { c.tokens.push('tokens/on-solid.tokens.json'); c.check.contrast.standard = standard; });
      r = check();
      expect(`${standard}: an authored on-solid that fails is warned`, r.warnings.some((m) => m.startsWith('primary.on-solid vs primary.solid')), r.warnings.join('\n') || r.out);
    }

    setConfig((c) => { c.derivation.contrast = 'apca-ish'; });
    r = check();
    expect('derivation.contrast: an unknown value is a config error (TST1010)', r.code === 1 && /TST1010 .*derivation\.contrast/.test(r.out), r.out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // apca-w3 is an optional peer: without it, an apca config is an error, not a
  // silent WCAG check. (In this repo it is installed, so the loader is swapped.)
  const { compile, contrastRegressions } = await import('../packages/core/src/index.js');
  const missing = async () => { throw new Error('Cannot find package \'apca-w3\''); };
  const tmp = mkdtempSync(join(tmpdir(), 'transtyle-check-apca-missing-'));
  try {
    cpSync(join(root, 'examples/cathode/tokens'), join(tmp, 'tokens'), { recursive: true });
    const c = JSON.parse(readFileSync(join(root, 'examples/cathode/transtyle.config.json'), 'utf8'));
    c.check.contrast.standard = 'apca';
    writeFileSync(join(tmp, 'transtyle.config.json'), JSON.stringify(c));
    const res = await compile({ cwd: tmp, targets: [], emit: false, skipExporters: true, apcaLoader: missing });
    const e = res.diagnostics.items.find((d) => d.code === 'TST1013');
    expect('apca without apca-w3: TST1013 error naming the package and the fix', e?.severity === 'error' && e.message.includes('check.contrast.standard') && e.hint.includes('npm install --save-dev apca-w3'), JSON.stringify(res.diagnostics.items));
    const ok = await compile({ cwd: tmp, targets: [], emit: false, skipExporters: true });
    let threw = false;
    try { contrastRegressions(ok.normalized, ok.normalized, ok.config); } catch { threw = true; }
    expect('contrastRegressions: refuses an apca config without the compile\'s contrast', threw);
    expect('contrastRegressions: measures in Lc with the compile\'s contrast', Array.isArray(contrastRegressions(ok.normalized, ok.normalized, ok.config, ok.contrast)) && ok.contrast.unit === 'Lc');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ---------- #61: the adoption report and false-friend bindings (TST1124) ----------
// `check` prints the project's own semantic vocabulary after the diagnostics
// and `check --json` carries it as `adoption`. Bound follows the alias chain,
// a custom role is listed apart, and an unbound token gets hints: the slots
// set to the same value, or the slot whose name it shadows. The examples are
// the golden cases (GOV.UK has one unbound token, Cathode none, Acme no
// custom vocabulary at all); two small fixtures cover the rest.
{
  const checkJson = (cwd) => {
    const r = run(['check', 'css-variables', '--cwd', cwd, '--json']);
    let j = null;
    try { j = JSON.parse(r.stdout); } catch { /* reported by the caller */ }
    return { r, j };
  };
  const govuk = checkJson(join(root, 'examples/govuk'));
  const a = govuk.j?.adoption;
  expect('adoption: govuk --json counts 14 custom tokens, 13 bound', a?.custom === 14 && a?.bound === 13, JSON.stringify(a));
  expect('adoption: govuk lists govuk.focus-text as the one unbound token', a?.unbound.length === 1 && a.unbound[0].path === 'semantic.color.govuk.focus-text', JSON.stringify(a?.unbound));
  const [hint] = a?.unbound[0]?.hints ?? [];
  expect('adoption: govuk.focus-text is hinted to text.base, same value, bound via govuk.text',
    hint?.slot === 'semantic.color.text.base' && hint.match === 'value' && hint.deltaE === 0 && hint.binding === 'bound' && hint.via === 'semantic.color.govuk.text', JSON.stringify(hint));
  const quiet = run(['check', 'css-variables', '--cwd', join(root, 'examples/govuk'), '--quiet']);
  expect('adoption: --quiet prints no adoption block', quiet.code === 0 && !quiet.out.includes('adoption  '), quiet.out);
  expect('adoption: govuk prints the block with the hint', govuk.r.out.includes('adoption  14 custom tokens, 13 bound, 1 unbound') && govuk.r.out.includes('↳ same value as text.base (bound via govuk.text)'), govuk.r.out);

  const cathode = checkJson(join(root, 'examples/cathode'));
  expect('adoption: cathode has 7 custom tokens, all bound, and the crt-amber role',
    cathode.j?.adoption?.custom === 7 && cathode.j.adoption.unbound.length === 0 && cathode.j.adoption.roles.map((x) => x.role).join() === 'crt-amber', JSON.stringify(cathode.j?.adoption));
  expect('adoption: cathode prints "7 custom tokens, all bound; 1 custom role (crt-amber)"', cathode.r.out.includes('adoption  7 custom tokens, all bound; 1 custom role (crt-amber)'), cathode.r.out);

  const acme = checkJson(join(root, 'examples/acme'));
  expect('adoption: acme has no custom vocabulary and prints no block', acme.j?.adoption?.custom === 0 && !acme.r.out.includes('\nadoption  '), acme.r.out);

  for (const [name, res] of [['acme', acme], ['cathode', cathode], ['govuk', govuk], ['carbon', checkJson(join(root, 'examples/carbon'))]]) {
    expect(`false friends: ${name} raises no TST1124`, res.j && !res.j.diagnostics.some((d) => d.code === 'TST1124'), JSON.stringify(res.j?.diagnostics.filter((d) => d.code === 'TST1124')));
  }

  // A custom token at a slot's name with its middle part left out
  // (`semantic.color.surface` for `elevation.0.surface`) is named, whatever
  // its colour: a dark #101114 page is nowhere near the default white canvas.
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-adoption-'));
  try {
    writeFileSync(join(dir, 'transtyle.config.json'), JSON.stringify({
      tokens: ['tokens/ds.tokens.json'],
      modes: { 'color-scheme': { values: ['light'], default: 'light' } },
      targets: { 'css-variables': { output: 'dist/css-variables' } },
    }));
    const tokens = (semantic) => JSON.stringify({ semantic: { color: { $type: 'color', primary: { solid: { $value: '#3b5bdb' } }, text: { base: { $value: '#e9ecef' } }, ...semantic } } });
    const write = (semantic) => {
      mkdirSync(join(dir, 'tokens'), { recursive: true });
      writeFileSync(join(dir, 'tokens/ds.tokens.json'), tokens(semantic));
    };
    write({ surface: { $value: '#101114' } });
    let res = checkJson(dir);
    const surface = res.j?.adoption?.unbound;
    expect('adoption: semantic.color.surface is unbound with a "did you mean elevation.0.surface" hint',
      surface?.length === 1 && surface[0].path === 'semantic.color.surface' && surface[0].hints[0]?.match === 'name' && surface[0].hints[0].slot === 'semantic.color.elevation.0.surface', JSON.stringify(surface));
    expect('adoption: the name hint is printed', res.r.out.includes('↳ did you mean to author elevation.0.surface (or 5 other slots ending in .surface)?'), res.r.out);

    // Bound through another custom token: slot → my.a → my.b binds both.
    write({ elevation: { 0: { surface: { $value: '{semantic.color.my.a}' } } }, my: { a: { $value: '{semantic.color.my.b}' }, b: { $value: '#ffffff' } } });
    res = checkJson(dir);
    expect('adoption: a token reached through another custom token is bound', res.j?.adoption?.custom === 2 && res.j.adoption.bound === 2, JSON.stringify(res.j?.adoption));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // False friends: the scaffold's blue brand with secondary.solid (or
  // accent.solid) bound to a token named for the slot. Only shadcn's meaning,
  // a near-white gray, is noted; Bootstrap's $secondary gray, a real second
  // brand colour and a gray whose name isn't the slot's word stay silent.
  const ff = mkdtempSync(join(tmpdir(), 'transtyle-check-false-friend-'));
  try {
    run(['init', 'ff-ds', '--cwd', ff, '--yes']);
    const tp = join(ff, 'tokens/brand.tokens.json');
    const scaffold = readFileSync(tp, 'utf8');
    const bindTo = (role, name, value) => {
      const t = JSON.parse(scaffold);
      t.option.color[name] = { $value: value };
      t.semantic.color[role] = { solid: { $value: `{option.color.${name}}` } };
      writeFileSync(tp, JSON.stringify(t, null, 2));
      const res = checkJson(ff);
      return { res, notes: (res.j?.diagnostics ?? []).filter((d) => d.code === 'TST1124') };
    };
    let { res, notes } = bindTo('secondary', 'secondary', 'oklch(0.97 0 0)');
    expect('false friend: secondary bound to shadcn\'s gray gets one TST1124 info, exit 0',
      res.r.code === 0 && notes.length === 1 && notes[0].severity === 'info' && notes[0].path === 'semantic.color.secondary.solid' && notes[0].message.startsWith('secondary.solid is bound to option.color.secondary, ΔE 0.020 from neutral.tint'), JSON.stringify(notes) + res.r.out);
    expect('false friend: the note points at the binding in the token file', notes[0]?.file === 'tokens/brand.tokens.json' && notes[0].line > 0, JSON.stringify(notes[0]));
    for (const [label, role, name, value] of [
      ['Bootstrap\'s $secondary gray', 'secondary', 'secondary', '#6c757d'],
      ['a real second brand colour', 'secondary', 'secondary', '#e8590c'],
      ['shadcn\'s gray under a name without the word', 'secondary', 'gray-100', 'oklch(0.97 0 0)'],
      ['a real accent colour', 'accent', 'accent', '#e8590c'],
    ]) {
      ({ notes } = bindTo(role, name, value));
      expect(`false friend: ${label} stays silent`, notes.length === 0, JSON.stringify(notes));
    }
    ({ notes } = bindTo('accent', 'accent', 'oklch(0.97 0 0)'));
    expect('false friend: accent bound to shadcn\'s gray wash gets TST1124', notes.length === 1 && notes[0].message.startsWith('accent.solid is bound to option.color.accent'), JSON.stringify(notes));
  } finally {
    rmSync(ff, { recursive: true, force: true });
  }
}

// ---------- emitted-file manifest and drift (TST1312, issue #10) ----------
{
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-drift-'));
  const out = (p) => join(dir, 'dist/css-variables', p);
  const drifts = (r) => (r.out.match(/TST1312/g) ?? []).length;
  const setFailOn = (failOn) => {
    const cfgPath = join(dir, 'transtyle.config.json');
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    if (failOn) cfg.check = { ...cfg.check, failOn };
    else if (cfg.check) delete cfg.check.failOn;
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
  };
  try {
    let r = run(['check', '--cwd', join(root, 'packages/core/test-fixtures/dtcg-validation')]);
    expect('drift: a project never built reports nothing', drifts(r) === 0, r.out);

    // A git repository, so `diff` below has a HEAD to compare with (dist/ committed, as a team that commits its themes would).
    const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
    git('init', '-q');
    git('config', 'user.email', 't@t.test');
    git('config', 'user.name', 'test');
    run(['init', 'drift-ds', '--cwd', dir]);
    r = run(['build', '--cwd', dir]);
    git('add', '-A');
    git('commit', '-q', '-m', 'initial');
    expect('drift: build writes the manifest and lists it', r.code === 0 && existsSync(out('transtyle-manifest.json')) && r.out.includes('↳ dist/css-variables/transtyle-manifest.json'), r.out);
    const manifest = JSON.parse(readFileSync(out('transtyle-manifest.json'), 'utf8'));
    const css = 'variables.transtyle.css';
    expect('drift: the manifest hashes the exporter\'s files, not report.json or itself', manifest.target === 'css-variables' && manifest.algorithm === 'sha256' && css in manifest.files && !('report.json' in manifest.files) && !('transtyle-manifest.json' in manifest.files), JSON.stringify(manifest));
    r = run(['check', '--cwd', dir]);
    expect('drift: check right after a build is clean', r.code === 0 && drifts(r) === 0, r.out);

    // A line ending conversion is not an edit.
    const original = readFileSync(out(css), 'utf8');
    writeFileSync(out(css), original.replace(/\n/g, '\r\n'));
    r = run(['check', '--cwd', dir]);
    expect('drift: an output converted to CRLF is not reported', r.code === 0 && drifts(r) === 0, r.out);

    // Hand edit: one warning naming the file and the instance; failOn decides the exit.
    writeFileSync(out(css), original + '/* hand edit */\n');
    r = run(['check', '--cwd', dir]);
    expect('drift: a hand-edited output warns once, naming the file and the target', r.code === 0 && drifts(r) === 1 && r.out.includes(`⚠ TST1312 css-variables: dist/css-variables/${css} was changed outside transtyle since the last build`) && r.out.includes('transtyle build css-variables'), r.out);
    r = run(['check', '--cwd', dir, '--json']);
    expect('drift: check --json carries it as a warning', (() => { try { return JSON.parse(r.stdout).diagnostics.some((d) => d.code === 'TST1312' && d.severity === 'warning' && d.target === 'css-variables'); } catch { return false; } })(), r.stdout);
    setFailOn('warning');
    r = run(['check', '--cwd', dir]);
    expect('drift: fails the check under failOn: "warning" (exit 1)', r.code === 1 && drifts(r) === 1, r.out);
    setFailOn(null);
    r = run(['explain', 'primary.solid', '--cwd', dir]);
    expect('drift: explain never reports it', r.code === 0 && drifts(r) === 0, r.out);
    r = run(['diff', '--cwd', dir]);
    expect('drift: diff never reports it', r.code === 0 && r.out.includes('No semantic changes') && drifts(r) === 0, r.out);

    // Build: warns once more (the edit is lost now), overwrites, and the next check is clean.
    r = run(['build', '--cwd', dir]);
    expect('drift: build warns, then overwrites the edited file', r.code === 0 && drifts(r) === 1 && readFileSync(out(css), 'utf8') === original, r.out);
    expect('drift: the build\'s report.json records the warning', JSON.parse(readFileSync(out('report.json'), 'utf8')).diagnostics.some((d) => d.code === 'TST1312'));
    r = run(['check', '--cwd', dir]);
    expect('drift: check after the rebuild is clean', r.code === 0 && drifts(r) === 0, r.out);

    // A listed file that is gone.
    rmSync(out('usage.md'));
    r = run(['check', '--cwd', dir]);
    expect('drift: a deleted output is reported missing', drifts(r) === 1 && r.out.includes('dist/css-variables/usage.md is listed in transtyle-manifest.json but missing'), r.out);
    run(['build', '--cwd', dir]);

    // A manifest that can't be trusted is reported, not silently ignored.
    writeFileSync(out('transtyle-manifest.json'), '{');
    r = run(['check', '--cwd', dir]);
    expect('drift: an unreadable manifest warns, naming it', drifts(r) === 1 && r.out.includes('dist/css-variables/transtyle-manifest.json is not valid JSON'), r.out);
    // No manifest at all (output from a build before manifests existed): silent.
    rmSync(out('transtyle-manifest.json'));
    writeFileSync(out(css), original + '/* edited before manifests existed */\n');
    r = run(['check', '--cwd', dir]);
    expect('drift: output without a manifest reports nothing', r.code === 0 && drifts(r) === 0, r.out);
    run(['build', '--cwd', dir]);

    // A filtered build rewrites only its own target's manifest.
    run(['add', 'shadcn', '--cwd', dir]);
    run(['build', '--cwd', dir]);
    const cssManifest = readFileSync(out('transtyle-manifest.json'), 'utf8');
    // A blank line at the end: still a valid manifest, but no build would write it.
    writeFileSync(out('transtyle-manifest.json'), cssManifest + '\n');
    const touched = readFileSync(out('transtyle-manifest.json'), 'utf8');
    r = run(['build', 'shadcn', '--cwd', dir]);
    expect('drift: build shadcn leaves css-variables\' manifest alone', r.code === 0 && readFileSync(out('transtyle-manifest.json'), 'utf8') === touched && existsSync(join(dir, 'dist/shadcn/transtyle-manifest.json')), r.out);
    run(['build', '--cwd', dir]);

    // Stale: a file the last build wrote that this one does not produce stays, listed once.
    const old = readFileSync(out(css), 'utf8');
    writeFileSync(out('old.transtyle.css'), old);
    const m = JSON.parse(readFileSync(out('transtyle-manifest.json'), 'utf8'));
    m.files['old.transtyle.css'] = m.files[css];
    writeFileSync(out('transtyle-manifest.json'), JSON.stringify(m, null, 2) + '\n');
    r = run(['build', '--cwd', dir]);
    expect('drift: a file this build no longer produces is listed stale and left in place', r.code === 0 && drifts(r) === 0 && r.out.includes('· stale: dist/css-variables/old.transtyle.css') && existsSync(out('old.transtyle.css')), r.out);
    expect('drift: the new manifest no longer lists the stale file', !('old.transtyle.css' in JSON.parse(readFileSync(out('transtyle-manifest.json'), 'utf8')).files));
    r = run(['build', '--cwd', dir]);
    expect('drift: a stale file is listed once, by the build that stopped producing it', r.code === 0 && !r.out.includes('stale:'), r.out);

    // --dry-run: the manifest is in the list of what would be written; drift is still reported, nothing changes.
    writeFileSync(out(css), original + '/* hand edit */\n');
    const beforeDry = readFileSync(out('transtyle-manifest.json'), 'utf8');
    r = run(['build', '--dry-run', '--cwd', dir]);
    expect('drift: build --dry-run reports drift, lists the manifest, writes nothing', r.code === 0 && drifts(r) === 1 && r.out.includes('would write dist/css-variables/transtyle-manifest.json') && readFileSync(out(css), 'utf8').endsWith('/* hand edit */\n') && readFileSync(out('transtyle-manifest.json'), 'utf8') === beforeDry, r.out);
    run(['build', '--cwd', dir]);

    // --out: the manifest moves with the output, and drift is checked there.
    const outer = mkdtempSync(join(tmpdir(), 'transtyle-check-drift-out-'));
    try {
      r = run(['build', '--out', outer, '--cwd', dir]);
      expect('drift: build --out writes the manifest under <dir>/<target>', r.code === 0 && existsSync(join(outer, 'css-variables/transtyle-manifest.json')), r.out);
      writeFileSync(join(outer, 'css-variables', css), original + '/* edited in the --out copy */\n');
      r = run(['build', '--out', outer, '--cwd', dir]);
      expect('drift: build --out checks the manifest in that directory', r.code === 0 && drifts(r) === 1 && r.out.includes(`css-variables/${css} was changed outside transtyle`), r.out);
      r = run(['check', '--cwd', dir]);
      expect('drift: the configured output is unaffected by an edit under --out', r.code === 0 && drifts(r) === 0, r.out);
    } finally {
      rmSync(outer, { recursive: true, force: true });
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- #56: the merge rules, one key at a time ----------
{
  const { mergeConfigChain } = await import('../packages/core/src/load.js');
  const file = (name, dir, config) => ({ name, dir, config });
  const { config: m, origins } = mergeConfigChain([
    file('../base/t.json', '/r/base', {
      $schema: 'x', name: 'base', tokens: ['tokens/*.json', { files: ['dark/a.json', 'dark/b.json'], mode: { s: 'dark' } }],
      modes: { s: { values: ['light', 'dark'], default: 'light' }, d: { values: ['c', 'r'], default: 'c' } },
      bindings: [{ slot: 'a', from: '{b}' }],
      derivation: { rules: 'standard@1', autoDark: true, require: ['x', 'y'] },
      units: { remBase: '10px' },
      targets: { shadcn: { output: 'out/s', options: { era: 'tailwind-v3' } }, echarts: {} },
      check: { failOn: 'warning', hygiene: { unusedOption: 'warning', duplicateOption: 'off' }, suppress: [{ code: 'TST1305', reason: 'base' }] },
    }),
    file('t.json', '/r/app', {
      extends: '../base/t.json', tokens: ['own.json'],
      modes: { s: { values: ['light'] } },
      bindings: [{ slot: 'c', from: '{d}' }],
      derivation: { require: ['z'] },
      targets: { shadcn: { output: 'dist/s' } },
      check: { hygiene: { unusedOption: 'info' }, suppress: [{ code: 'TST1204', reason: 'app' }] },
    }),
  ], '/r/app');
  const eq = (label, got, want) => expect(`merge: ${label}`, JSON.stringify(got) === JSON.stringify(want), JSON.stringify(got));
  eq('$schema and extends are never inherited', ['$schema' in m, 'extends' in m], [false, false]);
  eq('name: the base\'s when the product sets none', m.name, 'base');
  eq('tokens: base layers first, rewritten relative to the product', m.tokens, ['../base/tokens/*.json', { files: ['../base/dark/a.json', '../base/dark/b.json'], mode: { s: 'dark' } }, 'own.json']);
  eq('tokens: each layer remembers its file and glob as written', origins.tokens.map((o) => `${o.file}:${o.glob}`), ['../base/t.json:tokens/*.json', '../base/t.json:dark/a.json,dark/b.json', 't.json:own.json']);
  eq('modes: a dimension the product names replaces the base\'s whole entry', m.modes, { s: { values: ['light'] }, d: { values: ['c', 'r'], default: 'c' } });
  eq('bindings: the product\'s rules first (the first rule wins)', m.bindings.map((b) => b.slot), ['c', 'a']);
  eq('derivation: by key, require replaced not concatenated', m.derivation, { rules: 'standard@1', autoDark: true, require: ['z'] });
  eq('units: inherited', m.units, { remBase: '10px' });
  eq('targets: by instance, a redefined instance replaces the whole object', m.targets, { shadcn: { output: 'dist/s' }, echarts: {} });
  eq('check: by key, hygiene by key, suppress concatenated product first', m.check, { failOn: 'warning', hygiene: { unusedOption: 'info', duplicateOption: 'off' }, suppress: [{ code: 'TST1204', reason: 'app' }, { code: 'TST1305', reason: 'base' }] });
  eq('origins: suppress entries keep their file and index', origins.suppress, [{ file: 't.json', index: 0 }, { file: '../base/t.json', index: 0 }]);
}

// ---------- #56: diff sees a change made only in the base ----------
{
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-56-diff-'));
  const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
  try {
    cpSync(join(root, 'packages/core/test-fixtures/config-extends'), dir, { recursive: true });
    git('init', '-q');
    git('config', 'user.email', 't@t.test');
    git('config', 'user.name', 'test');
    git('add', '-A');
    git('commit', '-q', '-m', 'initial');
    let r = run(['diff', '--cwd', join(dir, 'product-a')]);
    expect('extends diff: no changes vs HEAD (exit 0)', r.code === 0, r.out);
    const tp = join(dir, 'base/tokens/base.tokens.json');
    writeFileSync(tp, readFileSync(tp, 'utf8').replace('oklch(0.55 0.18 255)', 'oklch(0.55 0.19 25)'));
    r = run(['diff', '--cwd', join(dir, 'product-a')]);
    expect('extends diff: an uncommitted base change shows in the product (exit 1)', r.code === 1 && r.out.includes('primary.solid'), r.out);
    r = run(['diff', '--cwd', dir, '--config', 'product-b/transtyle.config.json', '--json']);
    expect('extends diff: with --config too', r.code === 1 && (() => { try { return JSON.parse(r.stdout).hasChanges === true; } catch { return false; } })(), r.out);

    // A base outside the repository has no state at the ref: it is read as it
    // is now on both sides, and the diff says so.
    rmSync(join(dir, '.git'), { recursive: true, force: true });
    const pa = join(dir, 'product-a');
    spawnSync('git', ['init', '-q'], { cwd: pa });
    spawnSync('git', ['-c', 'user.email=t@t.test', '-c', 'user.name=test', 'commit', '-q', '--allow-empty', '-m', 'empty'], { cwd: pa });
    spawnSync('git', ['add', '-A'], { cwd: pa });
    spawnSync('git', ['-c', 'user.email=t@t.test', '-c', 'user.name=test', 'commit', '-q', '-m', 'product'], { cwd: pa });
    r = run(['diff', '--cwd', pa]);
    expect('extends diff: a base outside the repository is read as it is now, and said so', r.code === 0 && r.out.includes('ℹ ../base/transtyle.config.json is outside the git repository'), r.out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (failures) {
  console.error(`\n✖ check-cli: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\n✔ check-cli: init (flags, presets, prompts)/add/build/explain (--target, --variable)/diff/check --matrix/--completeness/bind --suggest/--out/--dry-run/--quiet/--verbose/drift + extends + --config golden path, WCAG and APCA contrast standards, and error cases all pass');
