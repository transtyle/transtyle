/** LOAD stage: config discovery + token file reading (docs/architecture/pipeline.md#1-load). */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

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
 * Token entries are strings (globs) or objects `{ files, mode }` — the latter
 * declares a mode-scoped layer: a pure DTCG file whose values apply to one
 * mode of one dimension (docs/specs/configuration.md#token-layering).
 */
export async function loadTokenTrees(cwd, entries, diagnostics) {
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
    if (typeof entry === 'string') continue;
    for (const g of [].concat(entry.files)) for (const f of await expandGlob(cwd, g)) claimed.add(f);
  }
  for (const entry of entries) {
    const globs = typeof entry === 'string' ? [entry] : [].concat(entry.files);
    const modeScope = typeof entry === 'string' ? undefined : entry.mode;
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
        try {
          const tree = JSON.parse(await readFile(f, 'utf8'));
          const rel = path.relative(cwd, f);
          validateTokenTree(tree, rel, diagnostics, seenExtensionNamespaces);
          trees.push({ file: rel, tree, modeScope });
        } catch (e) {
          // Relative path (AL5): an absolute one buries the filename that
          // matters at the end of a long, uninformative prefix.
          diagnostics.error('TST1002', `Failed to parse ${path.relative(cwd, f)}: ${e.message}`);
        }
      }
    }
  }
  return trees;
}

// ---------- structural DTCG validation (T10, docs/specs/validation-and-coverage.md) ----------

/** The DTCG $type set this IR understands (docs/architecture/ir.md#foundation-dtcg-superset). */
const DTCG_TYPES = new Set([
  'color', 'dimension', 'fontFamily', 'fontWeight', 'duration', 'cubicBezier', 'number',
  'typography', 'shadow', 'border', 'gradient', 'transition', 'strokeStyle',
]);
/** The three-tier token model (docs/architecture/ir.md#the-three-tier-token-model). */
const TIERS = new Set(['option', 'semantic', 'component']);
/** Transtyle's own reserved `$extensions` namespaces (proposal 0001 §4.4) — anything else is foreign. */
const KNOWN_EXTENSION_NAMESPACES = new Set(['transtyle.modes', 'transtyle.role', 'transtyle.state-mechanism']);

/**
 * The path of the first Style Dictionary v3 leaf in a tree that has no `$value`
 * anywhere, else null. A leaf is an object with a `value` key that is a
 * primitive or array (a composite object value counts only with a sibling
 * `type`/`comment`/`attributes`, so a group that merely has a child called
 * `value` is not mistaken for a token).
 */
function findStyleDictionaryLeaf(tree) {
  let legacy = null;
  let hasDtcg = false;
  const walk = (node, path_) => {
    if (hasDtcg || node === null || typeof node !== 'object' || Array.isArray(node)) return;
    if ('$value' in node) { hasDtcg = true; return; }
    if ('value' in node) {
      const v = node.value;
      const plainObject = v !== null && typeof v === 'object' && !Array.isArray(v);
      const sdSibling = ['type', 'comment', 'attributes'].some((k) => k in node);
      if (!plainObject || sdSibling) {
        legacy ??= path_;
        return;
      }
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
export function validateTokenTree(tree, file, diagnostics, seenNamespaces = new Set()) {
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
        hint: 'Rename "value" → "$value", "type" → "$type" and "comment" → "$description", strip ".value" from "{a.b.c.value}" references, and put the tokens under option/semantic/component. `transtyle migrate --from style-dictionary` is planned to do this for you (docs/specs/cli.md).',
      },
    );
    return;
  }
  for (const key of Object.keys(tree)) {
    if (key.startsWith('$')) continue;
    if (!TIERS.has(key)) {
      diagnostics.warn('TST1305', `${file}: top-level group "${key}" is not option/semantic/component`);
    }
  }
  const walk = (node, path_) => {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return;
    const localType = node.$type;
    if (node.$extensions && typeof node.$extensions === 'object') {
      for (const ns of Object.keys(node.$extensions)) {
        if (!KNOWN_EXTENSION_NAMESPACES.has(ns) && !seenNamespaces.has(ns)) {
          seenNamespaces.add(ns);
          diagnostics.info('TST1304', `${file}: foreign $extensions namespace "${ns}" carried through untouched (not a transtyle namespace)`);
        }
      }
    }
    const hasValue = '$value' in node;
    const childKeys = Object.keys(node).filter((k) => !k.startsWith('$'));
    if (!hasValue && childKeys.length === 0 && localType !== undefined) {
      diagnostics.error('TST1302', `${path_.join('.')}: declares $type "${localType}" but has neither $value nor child tokens`);
      return;
    }
    if (hasValue) {
      if (localType !== undefined && !DTCG_TYPES.has(localType)) {
        diagnostics.warn('TST1306', `${path_.join('.')}: unknown $type "${localType}" — carried through opaque (no type-specific parsing or derivation)`);
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
