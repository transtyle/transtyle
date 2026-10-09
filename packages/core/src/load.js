/** LOAD stage: config discovery + token file reading (docs/architecture/pipeline.md#1-load). */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { locateJson, parseErrorLocation } from './locate.js';
import { loadTokensStudio } from './tokens-studio.js';

export async function loadConfig(cwd) {
  const file = path.join(cwd, 'transtyle.config.json');
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    throw new Error(`No transtyle.config.json found in ${cwd}`);
  }
  const config = JSON.parse(raw);
  if (!config.tokens?.length) throw new Error('Config error: "tokens" must list at least one glob.');
  return { config, configPath: file };
}

/** Minimal glob: supports literal paths and single-`*` segments (e.g. "tokens/*.tokens.json"). */
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
 * duplicates. What the codemods walk; `loadTokenTrees` keeps its own per-entry
 * loop because it needs to know which entry matched what.
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
 * Token entries are strings (globs) or objects `{ files, mode?, override? }`:
 * `mode` declares a mode-scoped layer (a pure DTCG file whose values apply to
 * one mode of one dimension); `override` (`true` | `"extend"`) marks a layer
 * that redefines earlier layers on purpose
 * (docs/specs/configuration.md#token-layering). A `{ tokensStudio, themes?,
 * sets? }` entry is a Tokens Studio export, lowered to the same base and
 * mode-scoped layers (tokens-studio.js). `config` gives it the declared modes.
 */
export async function loadTokenTrees(cwd, entries, diagnostics, config = {}) {
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
    for (const g of [].concat(entry.files)) for (const f of await expandGlob(cwd, g)) claimed.add(f);
  }
  for (const entry of entries) {
    if (typeof entry !== 'string' && entry.tokensStudio !== undefined) {
      for (const layer of await loadTokensStudio(cwd, entry, config, diagnostics)) {
        validateTokenTree(layer.tree, layer.file, diagnostics, seenExtensionNamespaces, layer.positions);
        trees.push(layer);
      }
      continue;
    }
    const globs = typeof entry === 'string' ? [entry] : [].concat(entry.files);
    const modeScope = typeof entry === 'string' ? undefined : entry.mode;
    const override = typeof entry === 'string' ? undefined : entry.override;
    for (const g of globs) {
      const matched = await expandGlob(cwd, g);
      // TST1001 still means "matched nothing on disk": a glob whose only
      // matches are overlays did its job.
      const files = modeScope ? matched : matched.filter((f) => !claimed.has(f));
      if (matched.length === 0)
        diagnostics.warn('TST1001', `Token glob matched no files: ${g}`, {
          // AL5: this is usually the whole story behind every error that
          // follows, so it should be the one that tells you where it looked.
          hint: `Resolved relative to ${cwd}. Check the path in "tokens" in transtyle.config.json.`,
        });
      for (const f of files) {
        const rel = path.relative(cwd, f);
        let text;
        try {
          text = await readFile(f, 'utf8');
          const tree = JSON.parse(text);
          const positions = locateJson(text);
          validateTokenTree(tree, rel, diagnostics, seenExtensionNamespaces, positions);
          trees.push({ file: rel, tree, modeScope, positions, ...(override ? { override } : {}) });
        } catch (e) {
          // Relative path (AL5): an absolute one buries the filename that
          // matters at the end of a long, uninformative prefix. The line comes
          // from the "position N" the parser puts in its message (none, when
          // the failure was reading the file rather than parsing it).
          diagnostics.error('TST1002', `Failed to parse ${rel}: ${e.message}`, {
            file: rel,
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
 * the whole `loadTokenTrees()` call so TST1304 fires once per compile.
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
      // DTCG 2025.10 §6.1: an object with both `$value` and child tokens is
      // invalid and tools must report it. The walk below stops at `$value`, so
      // without this the children vanished without a word: the usual case is a
      // leaf turned into a group by half (`border: { $value, subtle: {…} }`).
      if (childKeys.length > 0) {
        diagnostics.error(
          'TST1312',
          `${path_.join('.')}: has a $value and child tokens (${childKeys.slice(0, 3).join(', ')}${childKeys.length > 3 ? ', …' : ''}); a token cannot also be a group, so the children are ignored`,
          {
            ...where(path_),
            hint: 'Move the $value into a child token (often `base`) so the node is a group, or move the children elsewhere.',
          },
        );
      }
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
