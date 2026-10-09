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
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, cpSync, readdirSync } from 'node:fs';
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

  const plain = parse(run(['check', '--json', '--cwd', acme]).stdout);
  expect('check --matrix: recording reads changes no coverage row',
    !!plain && JSON.stringify(plain.targets) === JSON.stringify(json?.targets));

  r = run(['build', '--matrix', '--cwd', acme]);
  expect('build --matrix: refused as a usage error (exit 2)', r.code === 2, `exit ${r.code}`);
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

if (failures) {
  console.error(`\n✖ check-cli: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\n✔ check-cli: init (flags, presets, prompts)/add/build/explain (--target, --variable)/diff/check --matrix/--out/--dry-run/--quiet/--verbose golden path and error cases all pass');
