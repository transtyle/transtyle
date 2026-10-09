/**
 * LOAD without a filesystem (docs/architecture/pipeline.md#1-load).
 *
 * A project is its config plus a map of token file paths to their contents:
 * `{ 'tokens/option.tokens.json': '<JSON text>' | <parsed object>, … }`. This
 * module expands `config.tokens` against the map's keys, parses, validates and
 * returns the layers NORMALIZE merges. It imports nothing from Node, so the same
 * code serves the disk path (load.js reads the files `config.tokens` matches into
 * such a map) and a browser, a playground or a test that has no disk at all.
 * Every diagnostic names a file by its key, so both worlds report the same paths.
 *
 * Paths are POSIX (`/`), relative to the project root. Globs keep the skeleton's
 * grammar: literal segments and single-`*` segments, never `**`.
 */

import { locateJson, parseErrorLocation } from './locate.js';
import { readTokensStudio } from './tokens-studio.js';

/**
 * `a/./b/../c` → `a/c`, `./x/` → `x`, `../x` stays. An absolute path keeps its
 * leading `/`. The project root itself is the empty string.
 */
export function normalizePath(p) {
  const absolute = p.startsWith('/');
  const out = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (out.length > 0 && out.at(-1) !== '..') out.pop();
      else if (!absolute) out.push('..');
      continue;
    }
    out.push(seg);
  }
  return (absolute ? '/' : '') + out.join('/');
}

/** `path.relative()` for two normalized POSIX paths, both absolute or both relative. */
function relativePath(from, to) {
  const a = from.split('/').filter(Boolean);
  const b = to.split('/').filter(Boolean);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return [...a.slice(i).map(() => '..'), ...b.slice(i)].join('/');
}

const isAbsolute = (p) => p.startsWith('/') || /^[A-Za-z]:\//.test(p);

/**
 * Where an emitted file sits relative to the project root, as `report.json`
 * lists it: `output` (as configured: `dist/x`, `./dist/x/`, `../out`) joined
 * with the exporter's file path. An absolute `output` is made relative to
 * `root` when the caller gave one (the disk path does), and kept absolute
 * otherwise.
 */
export function projectPath(output, file, root) {
  const joined = normalizePath(`${output}/${file}`);
  if (!isAbsolute(joined) || !root) return joined;
  return relativePath(normalizePath(root), joined);
}

/** The token files as a `Map` of normalized path → contents (a plain object or a `Map` is accepted). */
export function toFileMap(files = {}) {
  const entries = files instanceof Map ? [...files] : Object.entries(files);
  return new Map(entries.map(([p, contents]) => [normalizePath(p), contents]));
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * What sits directly under directory `dir` (`''` = root) of the virtual tree:
 * the files when `last` (the glob's final segment), else the directories.
 */
function childrenOf(keys, dir, last) {
  const names = new Set();
  const prefix = dir === '' ? '' : dir + '/';
  for (const k of keys) {
    if (!k.startsWith(prefix) || k.startsWith('/') !== dir.startsWith('/')) continue;
    const rest = k.slice(prefix.length).split('/');
    if (rest.length === 1 !== last) continue;
    if (rest[0] !== '' && rest[0] !== '..') names.add(rest[0]);
  }
  return [...names];
}

/**
 * Minimal glob over the map's keys: literal paths and single-`*` segments (e.g.
 * "tokens/*.tokens.json"). A `*` matches directories in the middle of a pattern
 * and files at its end. A literal path is returned whether or not it exists:
 * reading it is what reports it missing (TST1002), as on disk. Sorted, so the
 * layer order never depends on the order the map was built in.
 */
export function expandGlob(keys, pattern) {
  if (pattern.includes('**')) throw new Error(`Skeleton glob does not support "**": ${pattern}`);
  const segs = pattern.split('/');
  let paths = [''];
  for (const [i, seg] of segs.entries()) {
    const next = [];
    for (const p of paths) {
      if (seg.includes('*')) {
        const re = new RegExp('^' + seg.split('*').map(escapeRe).join('.*') + '$');
        for (const name of childrenOf(keys, p, i === segs.length - 1)) if (re.test(name)) next.push(p === '' ? name : `${p}/${name}`);
      } else {
        next.push(normalizePath(p === '' ? seg : `${p}/${seg}`));
      }
    }
    paths = next;
  }
  return paths.sort(); // deterministic order
}

/**
 * Token entries are strings (globs) or objects `{ files, mode?, override? }`:
 * `mode` declares a mode-scoped layer (a pure DTCG file whose values apply to
 * one mode of one dimension); `override` (`true` | `"extend"`) marks a layer
 * that redefines earlier layers on purpose
 * (docs/specs/configuration.md#token-layering). A `{ tokensStudio, themes?,
 * sets? }` entry is a Tokens Studio export, lowered to the same base and
 * mode-scoped layers (tokens-studio.js). `config` gives it the declared modes.
 *
 * A file's contents may be JSON text (parsed here, with source locations for
 * every diagnostic, and TST1002 when it does not parse) or an already-parsed
 * object (used as is: diagnostics then carry the file but no line or column).
 * `root` only words TST1001's hint. `origins` (an `extends` chain, one per
 * entry: `{ file, dir, glob }` from `mergeConfigChain()`) makes it name the
 * file that declared the entry and the glob as written there, not the merged one.
 */
export function readTokenTrees(files, entries, diagnostics, root, config = {}, origins = []) {
  const keys = [...files.keys()];
  const trees = [];
  const seenExtensionNamespaces = new Set(); // compile-wide, so TST1304 fires once per namespace, not once per file
  // A file a mode-scoped entry matches is that mode's overlay, never also a
  // base layer, whatever the order of the entries: `["tokens/*.tokens.json",
  // { files: "tokens/dark.tokens.json", mode: … }]` loads dark.tokens.json
  // once, as the overlay (docs/specs/configuration.md#token-layering). Merged
  // as a base layer too, its dark values overwrote the light ones and every
  // token in it raised TST1103. So the overlays' files are collected first.
  const claimed = new Set();
  for (const entry of entries) {
    if (typeof entry === 'string' || !entry.mode) continue;
    for (const g of [].concat(entry.files)) for (const f of expandGlob(keys, g)) claimed.add(f);
  }
  for (const [index, entry] of entries.entries()) {
    if (typeof entry !== 'string' && entry.tokensStudio !== undefined) {
      for (const layer of readTokensStudio(files, entry, config, diagnostics, root)) {
        validateTokenTree(layer.tree, layer.file, diagnostics, seenExtensionNamespaces, layer.positions);
        trees.push(layer);
      }
      continue;
    }
    const globs = typeof entry === 'string' ? [entry] : [].concat(entry.files);
    const modeScope = typeof entry === 'string' ? undefined : entry.mode;
    const override = typeof entry === 'string' ? undefined : entry.override;
    // The file that declared this layer (an `extends` base, or the project's
    // own config) and the glob as written there: the hint must send the user
    // to the line they wrote, not to the rewritten path.
    const origin = origins[index];
    const authoredGlobs = origin ? [].concat(origin.glob) : globs;
    for (const [gi, g] of globs.entries()) {
      const matched = expandGlob(keys, g);
      // TST1001 still means "matched no file": a glob whose only matches are
      // overlays did its job.
      const matchedFiles = modeScope ? matched : matched.filter((f) => !claimed.has(f));
      if (matched.length === 0)
        diagnostics.warn('TST1001', `Token glob matched no files: ${authoredGlobs[gi] ?? g}`, {
          // AL5: this is usually the whole story behind every error that
          // follows, so it should be the one that tells you where it looked.
          hint: origin
            ? `Resolved relative to ${origin.dir}. Check the path in "tokens" in ${origin.file}.`
            : root
              ? `Resolved relative to ${root}. Check the path in "tokens" in transtyle.config.json.`
              : 'Resolved against the paths of the token files passed in. Check the path in "tokens" in transtyle.config.json.',
        });
      for (const file of matchedFiles) {
        let text;
        try {
          const contents = files.get(file);
          let tree;
          let positions;
          if (contents === undefined) {
            throw new Error('no token file at this path');
          } else if (typeof contents === 'string') {
            text = contents;
            tree = JSON.parse(text);
            positions = locateJson(text);
          } else if (contents !== null && typeof contents === 'object' && !Array.isArray(contents)) {
            tree = contents;
            positions = new Map();
          } else {
            throw new Error('contents must be JSON text or an object');
          }
          validateTokenTree(tree, file, diagnostics, seenExtensionNamespaces, positions);
          trees.push({ file, tree, modeScope, positions, ...(override ? { override } : {}) });
        } catch (e) {
          // Relative path (AL5): an absolute one buries the filename that
          // matters at the end of a long, uninformative prefix. The line comes
          // from the "position N" the parser puts in its message (none, when
          // the failure was reading the file rather than parsing it).
          diagnostics.error('TST1002', `Failed to parse ${file}: ${e.message}`, {
            file,
            ...(text !== undefined ? parseErrorLocation(text, e.message) : null),
          });
        }
      }
    }
  }
  return trees;
}

// ---------- structural DTCG validation (T10, docs/specs/validation-and-coverage.md) ----------

/** The DTCG $type set this IR understands (docs/architecture/ir.md#foundation-dtcg-superset). */
export const DTCG_TYPES = new Set([
  'color', 'dimension', 'fontFamily', 'fontWeight', 'duration', 'cubicBezier', 'number',
  'typography', 'shadow', 'border', 'gradient', 'transition', 'strokeStyle',
]);
/** The three-tier token model (docs/architecture/ir.md#the-three-tier-token-model). */
export const TIERS = new Set(['option', 'semantic', 'component']);
/** Transtyle's own reserved `$extensions` namespaces (proposal 0001 §4.4) — anything else is foreign. */
const KNOWN_EXTENSION_NAMESPACES = new Set(['transtyle.modes', 'transtyle.role', 'transtyle.state-mechanism']);

/**
 * Is `node` a Style Dictionary v3 token (leaf)? An object with a `value` key
 * that is a primitive or array; a composite object value counts only with a
 * sibling `type`/`comment`/`attributes`, so a group that merely has a child
 * called `value` is not mistaken for a token. Shared with the
 * `migrate --from style-dictionary` codemod, so detection and migration
 * agree on what a legacy token is.
 */
export function isStyleDictionaryLeaf(node) {
  if (node === null || typeof node !== 'object' || Array.isArray(node) || !('value' in node)) return false;
  const v = node.value;
  const plainObject = v !== null && typeof v === 'object' && !Array.isArray(v);
  return !plainObject || ['type', 'comment', 'attributes'].some((k) => k in node);
}

/**
 * The path of the first Style Dictionary v3 leaf in a tree that has no `$value`
 * anywhere, else null.
 */
function findStyleDictionaryLeaf(tree) {
  let legacy = null;
  let hasDtcg = false;
  const walk = (node, path_) => {
    if (hasDtcg || node === null || typeof node !== 'object' || Array.isArray(node)) return;
    if ('$value' in node) { hasDtcg = true; return; }
    if (isStyleDictionaryLeaf(node)) {
      legacy ??= path_;
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (!key.startsWith('$')) walk(child, [...path_, key]);
    }
  };
  walk(tree, []);
  return hasDtcg ? null : legacy;
}

/**
 * Catches authoring mistakes `collectTokens()`'s permissive walk would
 * otherwise silently swallow: a top-level group outside the three tiers, a
 * node that clearly meant to be a token but has no `$value`, an unrecognized
 * `$type` (still carried, just opaque to derivation), and foreign
 * `$extensions` namespaces (carried through untouched, surfaced once).
 * Runs per loaded file, before merging — `seenNamespaces` is shared across
 * the whole `readTokenTrees()` call so TST1304 fires once per compile.
 */
export function validateTokenTree(tree, file, diagnostics, seenNamespaces = new Set(), positions = new Map()) {
  // Where a key sits in `file`: `file`, `line`, `column` and the token `path`
  // the diagnostic is about, ready to spread into its context.
  const where = (keys) => {
    const dotted = keys.join('.');
    const pos = positions.get(dotted);
    return { file, ...(dotted ? { path: dotted } : {}), ...(pos ?? {}) };
  };
  // A Style Dictionary v3 file (`value`/`type` without `$`) has no `$value`
  // anywhere, so every check below would see an empty tree and the user would
  // get TST1305/TST1201 noise that never names the real cause. Say it once and
  // stop (issue #54).
  const legacyAt = findStyleDictionaryLeaf(tree);
  if (legacyAt) {
    diagnostics.error(
      'TST1307',
      `${file}: looks like a Style Dictionary (v3) token file — tokens use "value"/"type" without the "$" prefix (first one: ${legacyAt.join('.') || '(root)'}), so none of them is a DTCG token`,
      {
        ...where(legacyAt),
        hint: 'Run `transtyle migrate --from style-dictionary` (it prints the diff; `--write` applies it), or by hand: rename "value" → "$value", "type" → "$type" and "comment" → "$description", strip ".value" from "{a.b.c.value}" references, and put the tokens under option/semantic/component.',
      },
    );
    return;
  }
  for (const key of Object.keys(tree)) {
    if (key.startsWith('$')) continue;
    if (!TIERS.has(key)) {
      diagnostics.warn('TST1305', `${file}: top-level group "${key}" is not option/semantic/component`, where([key]));
    }
  }
  const walk = (node, path_) => {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return;
    const localType = node.$type;
    if (node.$extensions && typeof node.$extensions === 'object') {
      for (const ns of Object.keys(node.$extensions)) {
        if (!KNOWN_EXTENSION_NAMESPACES.has(ns) && !seenNamespaces.has(ns)) {
          seenNamespaces.add(ns);
          diagnostics.info('TST1304', `${file}: foreign $extensions namespace "${ns}" carried through untouched (not a transtyle namespace)`, where(path_));
        }
      }
    }
    // TST1311 (#30): token and group metadata of the wrong type. It is ignored
    // (the token still compiles), but a typo'd `"$deprecated": "yes"` is fine
    // while `"$deprecated": 1` silently deprecating nothing is not.
    const what = path_.length ? path_.join('.') : '(root)';
    if ('$description' in node && typeof node.$description !== 'string') {
      diagnostics.warn('TST1311', `${what}: $description must be a string, got ${jsonType(node.$description)} — ignored`, {
        ...where(path_),
        hint: 'Write the description as a string, or remove the key.',
      });
    }
    if ('$deprecated' in node && typeof node.$deprecated !== 'boolean' && typeof node.$deprecated !== 'string') {
      diagnostics.warn('TST1311', `${what}: $deprecated must be true, false or a string, got ${jsonType(node.$deprecated)} — ignored`, {
        ...where(path_),
        hint: 'Use true, or a string saying why and what to use instead (DTCG 2025.10). false opts a token out of its group\'s deprecation.',
      });
    }
    const hasValue = '$value' in node;
    const childKeys = Object.keys(node).filter((k) => !k.startsWith('$'));
    if (!hasValue && childKeys.length === 0 && localType !== undefined) {
      diagnostics.error('TST1302', `${path_.join('.')}: declares $type "${localType}" but has neither $value nor child tokens`, where(path_));
      return;
    }
    if (hasValue) {
      if (localType !== undefined && !DTCG_TYPES.has(localType)) {
        diagnostics.warn('TST1306', `${path_.join('.')}: unknown $type "${localType}" — carried through opaque (no type-specific parsing or derivation)`, where(path_));
      }
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$')) continue;
      walk(child, [...path_, key]);
    }
  };
  walk(tree, []);
}

/** A JSON value's kind for a message: "null", "an array", "a number"… */
const jsonType = (v) => (v === null ? 'null' : Array.isArray(v) ? 'an array' : typeof v === 'object' ? 'an object' : `a ${typeof v}`);
