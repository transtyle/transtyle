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
  for (const entry of entries) {
    const globs = typeof entry === 'string' ? [entry] : [].concat(entry.files);
    const modeScope = typeof entry === 'string' ? undefined : entry.mode;
    for (const g of globs) {
      const files = await expandGlob(cwd, g);
      if (files.length === 0) diagnostics.warn('TST1001', `Token glob matched no files: ${g}`);
      for (const f of files) {
        try {
          const tree = JSON.parse(await readFile(f, 'utf8'));
          const rel = path.relative(cwd, f);
          validateTokenTree(tree, rel, diagnostics, seenExtensionNamespaces);
          trees.push({ file: rel, tree, modeScope });
        } catch (e) {
          diagnostics.error('TST1002', `Failed to parse ${f}: ${e.message}`);
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
 * Catches authoring mistakes `collectTokens()`'s permissive walk would
 * otherwise silently swallow: a top-level group outside the three tiers, a
 * node that clearly meant to be a token but has no `$value`, an unrecognized
 * `$type` (still carried, just opaque to derivation), and foreign
 * `$extensions` namespaces (carried through untouched, surfaced once).
 * Runs per loaded file, before merging — `seenNamespaces` is shared across
 * the whole `loadTokenTrees()` call so TST1304 fires once per compile.
 */
export function validateTokenTree(tree, file, diagnostics, seenNamespaces = new Set()) {
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
