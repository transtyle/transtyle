/**
 * The token-file schema — what an editor needs to autocomplete the catalog in a
 * `*.tokens.json` file. Unlike the config and report schemas it is not used at
 * runtime (token trees are validated structurally by load.js); it is generated
 * from the catalog and published by scripts/gen-schemas.mjs →
 * website/public/schemas/tokens/v0.json. scripts/check-schemas.mjs proves the
 * published file is current and that every example's token files validate.
 *
 * The catalog is not hand-listed here: `catalogSlots()` reads core's
 * `catalog()` (catalog.js), a probe compile of the engine that also lists the
 * authored-only anchors. A slot added to DERIVE therefore shows up in the
 * schema on the next `npm run gen:schemas`.
 *
 * Shape: DTCG-structural (`$value`, `$type`, `$description`, `$deprecated`,
 * `$extensions`), with one object schema per catalog group. Groups where users
 * legitimately add their own tokens (`semantic`, `semantic.color`,
 * `semantic.font`, `component`, and everything outside the catalog) stay open;
 * every other catalog group is closed, so a misspelled slot under it
 * (`primary.solidd`) or a value on a group (`semantic.color.primary` with a
 * `$value`: a different slot from `.solid`) is flagged. A misspelled *role*
 * under `semantic.color` is indistinguishable from a custom role and cannot be.
 */
import { ROLE_ARCHETYPES } from '@transtyle/ir';
import { catalog } from '../catalog.js';

/** The DTCG `$type` values the loader understands (load.js DTCG_TYPES). */
const DTCG_TYPES = [
  'color', 'dimension', 'fontFamily', 'fontWeight', 'duration', 'cubicBezier', 'number',
  'typography', 'shadow', 'border', 'gradient', 'transition', 'strokeStyle',
];

/** Groups under which users add their own tokens: never closed. */
const OPEN_GROUPS = new Set(['semantic', 'semantic.color', 'semantic.font', 'component']);

/** Every slot path of the built-in catalog, in code-unit order (the published file's order). */
export function catalogSlots() {
  return catalog().slots.map((s) => s.path).sort();
}

/** Nested trie of slot paths: { children: Map, slot: boolean }. */
function trie(slots) {
  const root = { children: new Map(), slot: false };
  for (const slot of slots) {
    let node = root;
    for (const part of slot.split('.')) {
      if (!node.children.has(part)) node.children.set(part, { children: new Map(), slot: false });
      node = node.children.get(part);
    }
    node.slot = true;
  }
  return root;
}

const NODE = { $ref: '#/$defs/node' };

/** The schema of one catalog group (closed unless users extend it). */
function groupSchema(node, path) {
  const properties = { ...BASE_KEYS };
  for (const [name, child] of node.children) {
    const childPath = path ? `${path}.${name}` : name;
    properties[name] = child.children.size > 0 ? groupSchema(child, childPath) : NODE;
  }
  if (OPEN_GROUPS.has(path)) return { type: 'object', properties, additionalProperties: NODE };
  return { type: 'object', properties, additionalProperties: false };
}

const BASE_KEYS = {
  $type: { type: 'string', enum: DTCG_TYPES },
  $description: { type: 'string' },
  $deprecated: { type: ['boolean', 'string'] },
  $extensions: { $ref: '#/$defs/extensions' },
};

/** The token-file schema object, built from the catalog. */
export function tokenSchema() {
  const slots = catalogSlots();
  const root = trie(slots);
  const aliases = slots.map((s) => `{${s}}`);
  const top = groupSchema(root, '');
  const properties = { ...top.properties, $schema: { type: 'string' } };
  // The root is open on purpose: `option` and any project-specific top-level
  // group are allowed (TST1305 judges unknown top-level groups at build time).
  properties.option = NODE;
  return {
    type: 'object',
    properties,
    additionalProperties: NODE,
    $defs: {
      alias: { enum: aliases },
      // A `$value` is anything DTCG allows (colour string, number, array,
      // composite object) or a catalog alias. The enum branch is what editors
      // offer as completions; the open branch keeps every other value valid.
      value: { anyOf: [{ $ref: '#/$defs/alias' }, {}] },
      extensions: {
        type: 'object',
        properties: {
          'transtyle.modes': { type: 'object' },
          'transtyle.role': {
            type: 'object',
            properties: { archetype: { type: 'string', enum: ROLE_ARCHETYPES } },
            additionalProperties: false,
          },
          'transtyle.state-mechanism': {},
        },
        additionalProperties: true,
      },
      node: {
        type: 'object',
        properties: { ...BASE_KEYS, $value: { $ref: '#/$defs/value' } },
        additionalProperties: NODE,
      },
    },
  };
}

/** Metadata added only to the *published* file (gen-schemas.mjs). */
export const tokenSchemaMeta = {
  $id: 'https://transtyle.dev/schemas/tokens/v0.json',
  title: 'Transtyle token file (*.tokens.json)',
  description:
    'Schema for a DTCG token file Transtyle reads. Completes the built-in catalog paths (semantic.*, component.*) and the alias strings that point at them; custom tokens stay valid. See https://transtyle.dev/docs/configuration/.',
};
