#!/usr/bin/env node
/**
 * Browser entry gate (issue #87): `@transtyle/core/browser` and every official
 * exporter run with no filesystem, no Node built-in and no host global, and
 * compile each example in memory to exactly what `transtyle build` writes.
 *
 *   1. LINK: the module graph from `packages/core/src/browser.js` and from each
 *      `packages/exporter-<name>/src/index.js` is loaded into a fresh V8 context
 *      (`node:vm`, so the realm has only what ECMAScript defines: no `process`,
 *      no `Buffer`, no `require`, no `import.meta.url`), resolving imports the
 *      way a bundler would. A `node:` or built-in specifier, a bare specifier
 *      that is not a `@transtyle/*` workspace (a dependency), or a dynamic
 *      `import()` (a bundler can't follow it) fails the check, naming the file.
 *   2. RUN: inside that context, `compileProject({ config, files, exporters })`
 *      compiles each example from its config and the text of its token files
 *      (read here by `loadProject()`, the disk path's own reader), and every
 *      file of every target, `report.json` included, must be byte-identical to
 *      what `transtyle build` writes for the same example in a temp copy. The
 *      one file only the disk has, each target's `transtyle-manifest.json`,
 *      must list exactly the in-memory files but `report.json`, with their
 *      hashes. The `extends` fixture (packages/core/test-fixtures/config-extends)
 *      goes through the same comparison: `loadProject()` merges its chain, and
 *      a base's token files reach the map as `../base/…`.
 *   3. OBJECTS: the same compile with the token files passed as parsed objects
 *      instead of text gives the same files; only the source locations (`file`,
 *      `line`, `column` on a diagnostic about a token) go, since an object has
 *      no lines to point at.
 *
 * The context is the stand-in for a browser: anything the pipeline needs from
 * a host would throw a ReferenceError here. No bundler is involved (zero new
 * dependencies); what a bundler needs on top, a static import graph and JSON
 * modules with `with { type: 'json' }`, is what step 1 enforces.
 *
 * Run: node scripts/check-browser.mjs (also: npm run check:browser; in check:all).
 * It re-runs itself with --experimental-vm-modules, which `vm.SourceTextModule` needs.
 */
import vm from 'node:vm';
import { spawnSync, execFileSync } from 'node:child_process';
import { builtinModules } from 'node:module';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (typeof vm.SourceTextModule !== 'function') {
  const r = spawnSync(
    process.execPath,
    ['--experimental-vm-modules', '--disable-warning=ExperimentalWarning', fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: 'inherit' },
  );
  process.exit(r.status ?? 1);
}

const { loadProject, MANIFEST_FILE, hashContents } = await import('@transtyle/core');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'packages/cli/src/main.js');
const examples = ['acme', 'cathode', 'govuk', 'carbon'];
const exporterNames = readdirSync(join(root, 'packages'))
  .filter((d) => d.startsWith('exporter-'))
  .map((d) => d.slice('exporter-'.length))
  .sort();

let failures = 0;
function expect(label, cond, detail) {
  if (!cond) { console.error(`✖ ${label}${detail ? ` — ${detail}` : ''}`); failures++; }
  else console.log(`✔ ${label}`);
}

// ---------- 1. LINK ----------

const context = vm.createContext({});
const sandboxJson = vm.runInContext('JSON', context);
const builtins = new Set(builtinModules);
const violations = [];
const modules = new Map(); // absolute path → vm module
const rel = (p) => relative(root, p);

/** `@transtyle/<pkg>[/sub]` → the file its workspace's `exports` maps it to. */
function resolveWorkspace(specifier) {
  const [, pkg, sub] = /^@transtyle\/([^/]+)(\/.*)?$/.exec(specifier) ?? [];
  const dir = join(root, 'packages', pkg ?? '');
  if (!pkg || !existsSync(join(dir, 'package.json'))) return null;
  const { exports } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const target = exports?.[sub ? `.${sub}` : '.'];
  return typeof target === 'string' ? join(dir, target) : null;
}

function moduleFor(file) {
  if (modules.has(file)) return modules.get(file);
  let mod;
  if (file.endsWith('.json')) {
    const parsed = sandboxJson.parse(readFileSync(file, 'utf8'));
    mod = new vm.SyntheticModule(['default'], function () { this.setExport('default', parsed); }, { context, identifier: file });
  } else {
    const source = readFileSync(file, 'utf8');
    // A dynamic import is invisible to a static graph walk and to a bundler's.
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    if (/\bimport\s*\(/.test(code)) violations.push(`${rel(file)}: dynamic import() — a bundler cannot follow it`);
    mod = new vm.SourceTextModule(source, {
      context,
      identifier: file,
      importModuleDynamically: () => { throw new Error(`${rel(file)}: dynamic import() at run time`); },
    });
  }
  modules.set(file, mod);
  return mod;
}

function link(specifier, referencing, extra = {}) {
  const from = referencing.identifier;
  const bare = specifier.replace(/^node:/, '');
  if (specifier.startsWith('node:') || builtins.has(bare)) {
    violations.push(`${rel(from)}: imports the Node built-in "${specifier}"`);
    return new vm.SyntheticModule([], () => {}, { context, identifier: `stub:${specifier}` });
  }
  let file;
  if (specifier.startsWith('.') || specifier.startsWith('/')) file = resolve(dirname(from), specifier);
  else file = resolveWorkspace(specifier);
  if (!file) {
    violations.push(`${rel(from)}: imports "${specifier}", which is not a @transtyle/* workspace (packages/* stay zero-dependency)`);
    return new vm.SyntheticModule([], () => {}, { context, identifier: `stub:${specifier}` });
  }
  const type = (extra.attributes ?? extra.assert ?? {}).type;
  if (file.endsWith('.json') && type !== 'json') {
    violations.push(`${rel(from)}: imports ${specifier} without \`with { type: 'json' }\``);
  }
  return moduleFor(file);
}

// The entry: core's browser API and every official exporter, keyed by its name.
const entrySource = [
  `import { compileProject } from '@transtyle/core/browser';`,
  ...exporterNames.map((n, i) => `import e${i} from '@transtyle/exporter-${n}';`),
  `export { compileProject };`,
  `export const exporters = { ${exporterNames.map((n, i) => `${JSON.stringify(n)}: e${i}`).join(', ')} };`,
].join('\n');
const entry = new vm.SourceTextModule(entrySource, { context, identifier: join(root, 'scripts/check-browser.entry.mjs') });
try {
  await entry.link(link);
} catch (e) {
  // A stubbed import (recorded above) usually surfaces here as a missing export.
  if (violations.length === 0) violations.push(e.message);
}
const graph = [...modules.keys()].filter((f) => !f.endsWith('.json'));
expect(
  `link: ${graph.length} modules (core/browser + ${exporterNames.length} exporters) import no Node built-in, no dependency, nothing dynamic`,
  violations.length === 0,
  `\n    ${violations.join('\n    ')}\n    Exporters and the pipeline never touch a filesystem: import JSON as a module (\`with { type: 'json' }\`), keep fs/path in packages/core/src/load.js or emit.js, which the browser entry leaves out.`,
);
if (violations.length > 0) process.exit(1);
await entry.evaluate();
const { compileProject, exporters } = entry.namespace;

// ---------- 2. RUN and 3. OBJECTS ----------

/** Every file under `dir`, keyed by its POSIX path relative to `base`. */
function readTree(dir, base, out = new Map()) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) readTree(p, base, out);
    else out.set(relative(base, p).split('\\').join('/'), readFileSync(p, 'utf8'));
  }
  return out;
}

const posix = (p) => p.replace(/^\.\//, '').replace(/\/+$/, '');
const inSandbox = (value) => sandboxJson.parse(JSON.stringify(value));

/** `{ 'dist/x/a.css': contents, … }` from compileProject's results, as the disk lays them out. */
function laidOut(run) {
  const out = new Map();
  for (const r of run.results) for (const f of r.files) out.set(`${posix(r.output)}/${f.path}`, f.contents);
  return out;
}

/** report.json without source locations, for the objects comparison. */
function withoutLocations(text) {
  const report = JSON.parse(text);
  for (const list of [report.diagnostics, report.suppressed]) {
    for (const d of list ?? []) { delete d.file; delete d.line; delete d.column; }
  }
  return JSON.stringify(report, null, 2);
}

/**
 * The manifests on disk that don't list exactly the in-memory files of their
 * target (report.json aside) with their hashes, as `<path>: <why>`.
 */
function manifestMismatches(run, manifests) {
  const out = [];
  for (const r of run.results) {
    const key = `${posix(r.output)}/${MANIFEST_FILE}`;
    const text = manifests.get(key);
    if (text === undefined) { out.push(`${key}: not written`); continue; }
    const expected = Object.fromEntries(r.files.filter((f) => f.path !== 'report.json').map((f) => [f.path, hashContents(f.contents)]));
    const listed = JSON.parse(text).files ?? {};
    const keys = new Set([...Object.keys(expected), ...Object.keys(listed)]);
    const wrong = [...keys].filter((k) => expected[k] !== listed[k]);
    if (wrong.length) out.push(`${key}: ${wrong.join(', ')}`);
  }
  return out;
}

// The examples, then the `extends` fixture's two products, each built in a
// temp copy with its relatives (the fixture's base sits next to the products).
const projects = [
  ...examples.map((example) => ({ label: example, src: join(root, 'examples', example), sub: '' })),
  ...['product-a', 'product-b'].map((p) => ({ label: `extends/${p}`, src: join(root, 'packages/core/test-fixtures/config-extends'), sub: p })),
];

for (const { label: example, src, sub } of projects) {
  // What `transtyle build` writes, in a copy so the example's own dist/ is never read or touched.
  const tmp = mkdtempSync(join(tmpdir(), `transtyle-check-browser-${example.replace('/', '-')}-`));
  let disk, config, files, configChain, origins, projectDir;
  const manifests = new Map();
  try {
    cpSync(src, tmp, { recursive: true, filter: (p) => !/[\\/](dist|demo|node_modules)$/.test(p) });
    const dir = join(tmp, sub);
    ({ config, files, configChain, origins, projectDir } = await loadProject(dir));
    execFileSync(process.execPath, [cli, 'build', '--cwd', dir], { stdio: 'pipe' });
    disk = new Map();
    for (const [name, t] of Object.entries(config.targets ?? {})) {
      for (const [k, v] of readTree(join(dir, t.output ?? `dist/${name}`), dir)) {
        if (k.endsWith(`/${MANIFEST_FILE}`)) manifests.set(k, v);
        else disk.set(k, v);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  const chain = configChain.length > 1 ? { configChain: inSandbox(configChain), origins: inSandbox(origins), root: projectDir.split('\\').join('/') } : {};
  const run = await compileProject({ config: inSandbox(config), files: inSandbox(files), exporters, ...chain });
  const errors = run.diagnostics.items.filter((d) => d.severity === 'error');
  expect(`${example}: compiles in the sandbox without errors`, errors.length === 0, errors.map((d) => `${d.code} ${d.message}`).join('; '));
  const memory = laidOut(run);
  const wrongManifests = manifestMismatches(run, manifests);
  expect(
    `${example}: each target's ${MANIFEST_FILE} on disk lists the in-memory files with their hashes`,
    wrongManifests.length === 0 && manifests.size === run.results.length,
    wrongManifests.join('; '),
  );
  const missing = [...disk.keys()].filter((k) => !memory.has(k));
  const extra = [...memory.keys()].filter((k) => !disk.has(k));
  const differ = [...disk.keys()].filter((k) => memory.has(k) && memory.get(k) !== disk.get(k));
  expect(
    `${example}: ${memory.size} files in memory, byte-identical to \`transtyle build\` (report.json included)`,
    missing.length + extra.length + differ.length === 0 && disk.size > 0,
    [
      missing.length && `only on disk: ${missing.join(', ')}`,
      extra.length && `only in memory: ${extra.join(', ')}`,
      differ.length && `contents differ: ${differ.join(', ')}`,
      disk.size === 0 && 'the build wrote nothing',
    ].filter(Boolean).join('; ') + ' — compileProject() and compile() must stay one pipeline (packages/core/src/pipeline.js)',
  );

  const objects = Object.fromEntries(Object.entries(files).map(([k, text]) => [k, JSON.parse(text)]));
  const fromObjects = laidOut(await compileProject({ config: inSandbox(config), files: inSandbox(objects), exporters, ...chain }));
  const objectDiffs = [...memory.keys()].filter((k) => {
    const a = memory.get(k);
    const b = fromObjects.get(k);
    if (b === undefined) return true;
    return k.endsWith('/report.json') ? withoutLocations(a) !== withoutLocations(b) : a !== b;
  });
  expect(
    `${example}: token files passed as objects give the same files (report.json minus source locations)`,
    objectDiffs.length === 0 && fromObjects.size === memory.size,
    objectDiffs.join(', '),
  );
}

// ---------- 4. EDGES: the in-memory glob and paths agree with the disk on what the examples don't exercise ----------
{
  const tmp = mkdtempSync(join(tmpdir(), 'transtyle-check-browser-edges-'));
  const project = join(tmp, 'project');
  const outside = join(tmp, 'outside', 'css'); // an absolute `output`, outside the project
  const write = (p, value) => {
    mkdirSync(dirname(join(project, p)), { recursive: true });
    writeFileSync(join(project, p), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
  };
  const color = (v) => ({ semantic: { color: { primary: { solid: { $type: 'color', $value: v } } } } });
  const config = {
    name: 'edges',
    tokens: [
      './tokens/*.tokens.json', // `./` prefix, `*` segment, and it also matches the overlay below
      { files: 'tokens/dark.tokens.json', mode: { 'color-scheme': 'dark' } },
      'tokens/*/nested.tokens.json', // `*` on a directory segment
    ],
    modes: { 'color-scheme': { values: ['light', 'dark'], default: 'light' } },
    targets: { 'css-variables': { output: outside } },
  };
  const broken = '{\n  "semantic": {\n    "oops": \n  }\n}\n';
  const { compile } = await import('@transtyle/core');
  const loadExporter = async (n) => (await import(`@transtyle/exporter-${n}`)).default;
  const inMemory = async (cfg, extra = {}) =>
    compileProject({ config: inSandbox(cfg), files: inSandbox((await loadProject(project)).files), exporters, ...extra });
  const rootPosix = project.split('\\').join('/');
  const diag = (r) => JSON.stringify(r.diagnostics.items);
  try {
    write('transtyle.config.json', config);
    write('tokens/base.tokens.json', color('#3366ff'));
    write('tokens/dark.tokens.json', color('#6699ff'));
    write('tokens/sub/nested.tokens.json', { option: { size: { one: { $type: 'dimension', $value: '4px' } } } });

    // A clean project: what `compile()` writes against the same project in memory, given the disk's root.
    const disk = await compile({ cwd: project, loadExporter });
    const written = readTree(outside, outside);
    written.delete(MANIFEST_FILE); // the disk side's own record (checked with the examples above)
    const files = (await inMemory(config, { root: rootPosix })).results[0]?.files ?? [];
    expect(
      'edges: `./` and `*` globs (on a file and on a directory), an overlay a glob also matches, an absolute output — same files and report.json as on disk',
      disk.diagnostics.errors.length === 0 && files.length > 1 &&
        diag(disk).includes('option.size.one') && // the file `tokens/*/nested.tokens.json` matched was loaded
        files.length === written.size && files.every((f) => written.get(f.path) === f.contents),
      `${files.length} in memory, ${written.size} on disk; differing: ${files.filter((f) => written.get(f.path) !== f.contents).map((f) => f.path).join(', ')}; ${diag(disk)}`,
    );
    const listed = JSON.parse(files.at(-1)?.contents ?? '{}').files ?? [];
    const rootless = JSON.parse((await inMemory(config)).results[0]?.files.at(-1)?.contents ?? '{}').files ?? [];
    expect(
      'edges: report.json lists an absolute output relative to the root, and keeps it absolute without one',
      listed.length > 0 && listed.every((f) => f.startsWith('../outside/css/')) &&
        rootless.every((f) => f.startsWith(`${outside.split('\\').join('/')}/`)),
      `${JSON.stringify(listed)} / ${JSON.stringify(rootless)}`,
    );

    // A broken one: every LOAD diagnostic reads the same from the map as from the directory.
    const bad = { ...config, tokens: [...config.tokens, 'tokens/missing.tokens.json', 'nowhere/*.tokens.json', 'tokens/sub'] };
    write('transtyle.config.json', bad);
    write('tokens/z.tokens.json', broken);
    const diskBad = await compile({ cwd: project, emit: false, loadExporter });
    const memBad = await inMemory(bad, { root: rootPosix });
    const codes = memBad.diagnostics.items.map((d) => d.code);
    expect(
      'edges: a missing file, a glob matching nothing, a directory named as a file, a parse error — same diagnostics as on disk',
      diag(memBad) === diag(diskBad) && ['TST1001', 'TST1002'].every((c) => codes.includes(c)),
      `memory: ${diag(memBad)}\n    disk:   ${diag(diskBad)}`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (failures > 0) {
  console.error(`\n✖ check-browser: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\n✔ check-browser: core/browser and every exporter run with no Node, and match the disk build byte for byte');
