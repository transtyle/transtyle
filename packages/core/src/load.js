/**
 * LOAD from disk (docs/architecture/pipeline.md#1-load): read the config and
 * the token files it names into the in-memory project `compileProject()` takes.
 * This module, emit.js, manifest.js and apca.js are the only ones in core that
 * import from Node; the browser entry (browser.js) leaves them out.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_CONFIG_FILE = 'transtyle.config.json';

/**
 * Find the config and follow its `extends` chain to the root
 * (docs/specs/configuration.md#inheritance-extends). `configFile` (the CLI's
 * `--config`) is resolved against `cwd`; without it the config is
 * `transtyle.config.json` in `cwd`, as before. The leaf's directory is the
 * project directory: target outputs, exporter resolution and every file name
 * in diagnostics are relative to it.
 *
 * Returns the chain in merge order, root base first and the leaf last, each
 * file as `{ path, name, dir, config }` with `name` relative to the project
 * directory (so output is the same on every machine). Nothing is validated or
 * merged here: each file is checked against the schema on its own first, so a
 * `TST1010` can name the file it is in (compile() → mergeConfigChain()).
 *
 * A missing or unparseable file, a cycle, or an `extends` that is not a file
 * path throws, naming the chain: like a missing config today, the CLI exits 2.
 *
 * `redirect(absPath)` lets `transtyle diff` read a base that lives outside the
 * snapshot it took of the repository from its current location instead.
 */
export async function loadConfigChain(cwd, { configFile = DEFAULT_CONFIG_FILE, redirect = (p) => p } = {}) {
  const leafPath = path.resolve(cwd, configFile);
  const projectDir = path.dirname(leafPath);
  const nameOf = (p) => toPosix(path.relative(projectDir, p)) || path.basename(p);
  const chain = []; // leaf first while walking
  let current = leafPath;
  for (;;) {
    const trail = () => [...chain.map((f) => f.name), nameOf(current)].join(' → ');
    if (chain.some((f) => f.path === current)) {
      throw new Error(`Config error: "extends" loops back to ${nameOf(current)} (${trail()})`);
    }
    let raw;
    try {
      raw = await readFile(current, 'utf8');
    } catch {
      throw new Error(chain.length === 0
        ? `No ${path.basename(current)} found in ${path.dirname(current)}`
        : `Config error: "extends" points at a file that does not exist: ${nameOf(current)} (${trail()})`);
    }
    let config;
    try {
      config = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Config error: ${nameOf(current)} is not valid JSON: ${e.message}${chain.length ? ` (${trail()})` : ''}`);
    }
    chain.push({ path: current, name: nameOf(current), dir: path.dirname(current), config });
    // A malformed `extends` (not a string) is left to the schema, which names
    // the file; the chain simply stops there.
    const ext = config !== null && typeof config === 'object' ? config.extends : undefined;
    if (typeof ext !== 'string') break;
    if (!/^(\.{1,2}[\\/]|[\\/])/.test(ext) && !path.isAbsolute(ext)) {
      throw new Error(`Config error: ${nameOf(current)}: "extends" must be a file path starting with "./" or "../" (got "${ext}"); package names are not supported yet`);
    }
    current = redirect(path.resolve(path.dirname(current), ext));
  }
  return { chain: chain.reverse(), projectDir, configPath: leafPath };
}

const toPosix = (p) => p.split(path.sep).join('/');

/**
 * The merged config, for callers that only read it (`transtyle migrate`):
 * the chain followed and merged, without the schema validation compile()
 * runs. Token globs in `config.tokens` are relative to `projectDir`, the
 * config's directory. Throws when no file of the chain lists a token layer.
 */
export async function loadConfig(cwd, { configFile = DEFAULT_CONFIG_FILE } = {}) {
  const { chain, projectDir, configPath } = await loadConfigChain(cwd, { configFile });
  const { config } = mergeConfigChain(chain, projectDir);
  if (!config.tokens?.length) throw new Error('Config error: "tokens" must list at least one glob.');
  return { config, configPath, projectDir, configChain: chain.map((f) => f.name) };
}

/**
 * Merge a validated chain (root base first) into one config, the nearer file
 * winning (docs/specs/configuration.md#merge-rules):
 *
 * - `tokens`: concatenated, base layers first (later layers win, so the
 *   product's own layers come last). Each glob is rewritten relative to the
 *   project directory, so it still points where the file that declared it said.
 * - `bindings` and `check.suppress`: concatenated, the nearer file's entries
 *   first (the first matching entry wins in both).
 * - `modes`, `targets`: by key; an entry the nearer file names replaces the
 *   base's whole entry (a dimension's `{ values, default }`, a target instance
 *   with its `options` and `modes`).
 * - `derivation`, `units`, `check` (and `check.contrast`, `check.hygiene`): by
 *   key; a key the nearer file sets replaces the base's value, arrays
 *   (`derivation.require`) included.
 * - `name`: the nearest file that sets one. `$schema` and `extends` are never
 *   inherited.
 *
 * Returns `{ config, origins }`: `origins.tokens[i]` is `{ file, dir, glob }`
 * for each merged token layer (the file that declared it, its directory and the
 * glob as written there), `origins.bindings[i]` / `origins.suppress[i]` are
 * `{ file, index }`, the entry's file and its index in that file.
 */
export function mergeConfigChain(chain, projectDir) {
  const config = {};
  const origins = { tokens: [], bindings: [], suppress: [] };
  for (const file of chain) {
    const c = file.config;
    const rebase = (glob) => toPosix(path.relative(projectDir, path.resolve(file.dir, glob))) || '.';
    for (const [key, value] of Object.entries(c)) {
      if (key === '$schema' || key === 'extends') continue;
      if (key === 'tokens') {
        config.tokens ??= [];
        for (const entry of value) {
          const glob = typeof entry === 'string' ? entry : entry.files ?? entry.tokensStudio;
          origins.tokens.push({ file: file.name, dir: file.dir, glob });
          if (file.dir === projectDir) config.tokens.push(entry);
          else if (typeof entry === 'string') config.tokens.push(rebase(entry));
          else if (entry.tokensStudio !== undefined) config.tokens.push({ ...entry, tokensStudio: rebase(entry.tokensStudio) });
          else config.tokens.push({ ...entry, files: Array.isArray(entry.files) ? entry.files.map(rebase) : rebase(entry.files) });
        }
      } else if (key === 'bindings') {
        config.bindings = [...value, ...(config.bindings ?? [])];
        origins.bindings = [...value.map((_, index) => ({ file: file.name, index })), ...origins.bindings];
      } else if (key === 'check') {
        const prev = config.check ?? {};
        const next = { ...prev, ...value };
        for (const sub of ['contrast', 'hygiene']) {
          if (prev[sub] && value[sub]) next[sub] = { ...prev[sub], ...value[sub] };
        }
        if (value.suppress) {
          next.suppress = [...value.suppress, ...(prev.suppress ?? [])];
          origins.suppress = [...value.suppress.map((_, index) => ({ file: file.name, index })), ...origins.suppress];
        }
        config.check = next;
      } else if (['modes', 'targets', 'derivation', 'units'].includes(key)) {
        config[key] = { ...config[key], ...value };
      } else {
        config[key] = value;
      }
    }
  }
  return { config, origins };
}

/** Minimal glob on disk: literal paths and single-`*` segments (project.js has the in-memory twin). */
async function expandGlob(cwd, pattern) {
  if (pattern.includes('**')) throw new Error(`Skeleton glob does not support "**": ${pattern}`);
  const segs = pattern.split('/');
  let paths = [cwd];
  for (const seg of segs) {
    const next = [];
    for (const p of paths) {
      if (seg.includes('*')) {
        const re = new RegExp('^' + seg.split('*').map(escapeRe).join('.*') + '$');
        let entries = [];
        try { entries = await readdir(p, { withFileTypes: true }); } catch { /* missing dir */ }
        for (const e of entries) if (re.test(e.name)) next.push(path.join(p, e.name));
      } else {
        next.push(path.join(p, seg));
      }
    }
    paths = next;
  }
  return paths.sort(); // deterministic order
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Every token file the config's `tokens` entries match (globs and
 * `{ files, mode?, override? }` objects alike), absolute, sorted, without
 * duplicates. What the codemods walk; compileProject() (project.js) keeps its
 * own per-entry expansion because it needs to know which entry matched what.
 */
export async function expandTokenFiles(cwd, entries) {
  const files = new Set();
  for (const entry of entries) {
    for (const g of typeof entry === 'string' ? [entry] : [].concat(entry.files)) {
      for (const f of await expandGlob(cwd, g)) files.add(f);
    }
  }
  return [...files].sort();
}

/**
 * The project in `cwd` as the in-memory project `compileProject()` takes:
 * `{ config, files, projectDir, configChain, origins }`. `config` is the
 * config (`configFile`, as for loadConfigChain()) with its `extends` chain
 * followed and merged, as loadConfig() does; `files` is the text of every
 * token file `config.tokens` matches, keyed by its POSIX path relative to
 * `projectDir`, the config's directory (a base's files start with `../`).
 * `configChain` and `origins` are what `compileProject()` names the config
 * files and the merged entries with.
 *
 * A missing config, a broken chain or a config without `tokens` throws here.
 * Unlike compile(), it does not check each file of a chain against the schema
 * before merging it; a malformed config, a `**` glob or a file that can't be
 * read are reported by `compileProject()`, in the order and with the codes an
 * in-memory project gets.
 */
export async function loadProject(cwd, { configFile = DEFAULT_CONFIG_FILE, redirect } = {}) {
  const { chain, projectDir } = await loadConfigChain(cwd, { configFile, redirect });
  const { config, origins } = mergeConfigChain(chain, projectDir);
  requireTokens(config, chain);
  const files = await readTokenFiles(projectDir, config.tokens);
  return { config, files, projectDir, configChain: chain.map((f) => f.name), origins };
}

/**
 * The "tokens must list at least one glob" error, naming the chain when there
 * is one: no file of it lists a token layer.
 */
export function requireTokens(config, chain) {
  if (config.tokens?.length) return;
  const names = chain.map((f) => f.name);
  throw new Error(`Config error: "tokens" must list at least one glob${chain.length > 1 ? ` in ${names[names.length - 1]} or a config it extends (${[...names].reverse().join(' → ')})` : '.'}`);
}

/**
 * The text of every file the token entries match under `projectDir`, keyed by
 * its POSIX path relative to it. Missing or unreadable files are left out, so
 * `compileProject()` reports them (TST1002); so are the globs it refuses.
 */
export async function readTokenFiles(projectDir, entries) {
  const files = {};
  const add = async (f) => {
    const key = toPosix(path.relative(projectDir, f));
    if (Object.hasOwn(files, key)) return;
    try {
      files[key] = await readFile(f, 'utf8');
    } catch {
      // Missing or unreadable: left out, so compileProject() reports it (TST1002).
    }
  };
  for (const entry of Array.isArray(entries) ? entries : []) {
    // A Tokens Studio export (tokens-studio.js): a single file, or a folder
    // whose every JSON file goes in (sets may sit in subfolders).
    if (typeof entry?.tokensStudio === 'string') {
      const abs = path.resolve(projectDir, entry.tokensStudio);
      const info = await stat(abs).catch(() => null);
      if (info?.isDirectory()) for (const f of await jsonFilesUnder(abs)) await add(f);
      else if (info) await add(abs);
      continue;
    }
    const globs = typeof entry === 'string' ? [entry] : [].concat(entry?.files ?? []);
    for (const g of globs) {
      if (typeof g !== 'string' || g.includes('**')) continue;
      for (const f of await expandGlob(projectDir, g)) await add(f);
    }
  }
  return files;
}

/** Every `.json` file under `dir`, at any depth, sorted. */
async function jsonFilesUnder(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await jsonFilesUnder(p)));
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out.sort();
}
