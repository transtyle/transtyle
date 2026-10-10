/**
 * `transtyle migrate --from style-dictionary` (docs/specs/cli.md, issue #54):
 * a pure codemod from a parsed Style Dictionary v3 token tree to a DTCG one.
 * No I/O, no randomness: the same tree gives the same tree and the same notes,
 * with the keys in the order the file had them.
 */

import { DTCG_TYPES, TIERS, isStyleDictionaryLeaf } from './project.js';

/**
 * Style Dictionary `type` / category names → DTCG `$type`. Anything else is
 * kept as written (and flagged when DTCG does not know it either).
 */
const TYPE_RENAMES = {
  size: 'dimension',
  sizing: 'dimension',
  spacing: 'dimension',
  dimension: 'dimension',
  fontFamilies: 'fontFamily',
  fontFamily: 'fontFamily',
  fontWeights: 'fontWeight',
  fontWeight: 'fontWeight',
  boxShadow: 'shadow',
  color: 'color',
};

/** The `$extensions` namespace the build metadata is carried under. */
export const STYLE_DICTIONARY_NAMESPACE = 'style-dictionary';

/**
 * Does the tree still need migrating? True when it has a Style Dictionary leaf
 * and no `$value` anywhere (the same test as TST1307), so a migrated file, a
 * DTCG file and a mixed file all answer false and a second run is a no-op.
 */
export function needsStyleDictionaryMigration(tree) {
  let legacy = false;
  let dtcg = false;
  const walk = (node) => {
    if (dtcg || node === null || typeof node !== 'object' || Array.isArray(node)) return;
    if ('$value' in node) { dtcg = true; return; }
    if (isStyleDictionaryLeaf(node)) { legacy = true; return; }
    for (const [k, child] of Object.entries(node)) if (!k.startsWith('$')) walk(child);
  };
  walk(tree);
  return legacy && !dtcg;
}

/**
 * Migrate one parsed Style Dictionary v3 tree.
 *
 * - leaves: `value`→`$value`, `type`→`$type` (renamed to the DTCG type; inferred
 *   from the top-level group when missing), `comment`→`$description`, every other
 *   key (`attributes`, `name`, `filePath`, `isSource`, `original`, `path`, …)
 *   carried under `$extensions["style-dictionary"]`;
 * - references: a trailing `.value` is stripped (`{a.b.c.value}` → `{a.b.c}`),
 *   in any string of a value, composites included;
 * - tiers: a top-level group that is not `option`/`semantic`/`component` moves
 *   under `option` (Style Dictionary has no tiers), and references to it follow.
 *
 * @returns {{ tree: object, notes: string[], tokens: number }} `notes` are
 *   human sentences for what a person should look at; `tokens` counts leaves.
 */
export function migrateStyleDictionary(tree) {
  const notes = [];
  let tokens = 0;
  const unknownTypes = new Set();
  const inferred = new Set();

  const rewriteRefs = (v) => {
    if (typeof v === 'string') {
      return v.replace(/\{([^{}]+)\}/g, (_, ref) => {
        const bare = ref.replace(/\.value$/, '');
        return `{${TIERS.has(bare.split('.')[0]) ? bare : `option.${bare}`}}`;
      });
    }
    if (Array.isArray(v)) return v.map(rewriteRefs);
    if (v !== null && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rewriteRefs(x)]));
    }
    return v;
  };

  const leaf = (node, category) => {
    tokens++;
    const out = {};
    const meta = {};
    let hasType = false;
    for (const [key, val] of Object.entries(node)) {
      if (key === 'value') out.$value = rewriteRefs(val);
      else if (key === 'comment') out.$description = val;
      else if (key === 'type') {
        hasType = true;
        const renamed = typeof val === 'string' ? (TYPE_RENAMES[val] ?? val) : val;
        if (typeof renamed !== 'string' || !DTCG_TYPES.has(renamed)) unknownTypes.add(String(val));
        out.$type = renamed;
      } else meta[key] = val;
    }
    if (!hasType && TYPE_RENAMES[category]) {
      out.$type = TYPE_RENAMES[category];
      inferred.add(`${category} → ${out.$type}`);
      // `$type` leads the token, as in hand-written DTCG.
      return finish({ $type: out.$type, ...out }, meta);
    }
    return finish(out, meta);
  };

  const finish = (out, meta) => {
    if (Object.keys(meta).length > 0) out.$extensions = { [STYLE_DICTIONARY_NAMESPACE]: meta };
    return out;
  };

  const walk = (node, category) => {
    if (isStyleDictionaryLeaf(node)) return leaf(node, category);
    const out = {};
    for (const [key, child] of Object.entries(node)) {
      if (key === 'comment' && typeof child === 'string') out.$description = child;
      else if (child !== null && typeof child === 'object' && !Array.isArray(child) && !key.startsWith('$')) out[key] = walk(child, category);
      else out[key] = child;
    }
    return out;
  };

  const result = {};
  const moved = [];
  for (const [key, child] of Object.entries(tree)) {
    const isGroup = child !== null && typeof child === 'object' && !Array.isArray(child);
    if (key.startsWith('$') || !isGroup) result[key] = child;
    else if (key === 'option') result.option = { ...result.option, ...walk(child, key) };
    else if (TIERS.has(key)) result[key] = walk(child, key);
    else {
      // `option` takes the place of the first group moved into it.
      result.option ??= {};
      result.option[key] = walk(child, key);
      moved.push(key);
    }
  }

  if (moved.length > 0) {
    notes.push(`moved ${moved.map((k) => `"${k}"`).join(', ')} under "option" (Style Dictionary has no tiers); bind the semantic tokens yourself, at least semantic.color.primary.solid`);
  }
  for (const i of [...inferred].sort()) notes.push(`tokens without a "type" got $type from their top-level group (${i})`);
  for (const t of [...unknownTypes].sort()) notes.push(`type "${t}" is not a DTCG type; kept as $type (it raises TST1306 on check)`);
  return { tree: result, notes, tokens };
}
