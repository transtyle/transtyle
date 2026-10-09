/**
 * The token-file schema — what an editor needs to autocomplete the catalog in a
 * `*.tokens.json` file. Unlike the config and report schemas it is not used at
 * runtime (token trees are validated structurally by load.js); it is generated
 * from the catalog and published by scripts/gen-schemas.mjs →
 * website/public/schemas/tokens/v0.json. scripts/check-schemas.mjs proves the
 * published file is current and that every example's token files validate.
 *
 * The catalog is not hand-listed here. `catalogSlots()` asks the compiler: it
 * compiles a minimal in-memory design system (the few slots DERIVE cannot
 * invent) and reads back every slot it materializes, plus the slots that are
 * authored-only by definition (IR constants). A slot added to DERIVE or to the
 * IR therefore shows up in the schema on the next `npm run gen:schemas`.
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
import { COLOR_ROLES, GRID_CELLS, TEXT_RUNGS, COMPONENT_CATALOG, ROLE_ARCHETYPES } from '@transtyle/ir';
import { Diagnostics } from '../diagnostics.js';
import { normalize } from '../normalize.js';
import { derive } from '../derive.js';

/** The DTCG `$type` values the loader understands (load.js DTCG_TYPES). */
const DTCG_TYPES = [
  'color', 'dimension', 'fontFamily', 'fontWeight', 'duration', 'cubicBezier', 'number',
  'typography', 'shadow', 'border', 'gradient', 'transition', 'strokeStyle',
];

/** Groups under which users add their own tokens: never closed. */
const OPEN_GROUPS = new Set(['semantic', 'semantic.color', 'semantic.font', 'component']);

const MINIMAL_ANCHORS = {
  semantic: {
    color: {
      primary: { solid: { $type: 'color', $value: '#0d6efd' } },
      elevation: { 0: { surface: { $type: 'color', $value: '#ffffff' } } },
    },
    radius: { md: { $type: 'dimension', $value: '0.375rem' } },
    font: {
      sans: { $type: 'fontFamily', $value: ['sans-serif'] },
      mono: { $type: 'fontFamily', $value: ['monospace'] },
      display: { $type: 'fontFamily', $value: ['sans-serif'] },
    },
  },
};

/** Every slot path of the built-in catalog, sorted. */
export function catalogSlots() {
  const diagnostics = new Diagnostics();
  const config = { modes: { 'color-scheme': { values: ['light'], default: 'light' } }, derivation: { rules: 'standard@1' } };
  const normalized = normalize([{ file: 'catalog', tree: MINIMAL_ANCHORS }], config, diagnostics);
  derive(normalized, config, diagnostics);
  const slots = new Set(
    [...normalized.modes[normalized.defaultMode].keys()].filter((k) => /^(semantic|component)\./.test(k)),
  );
  for (const role of COLOR_ROLES) for (const cell of GRID_CELLS) slots.add(`semantic.color.${role}.${cell}`);
  for (const rung of TEXT_RUNGS) slots.add(`semantic.color.text.${rung}`);
  slots.add('semantic.color.border');
  for (const [group, members] of Object.entries(COMPONENT_CATALOG)) {
    for (const member of Object.keys(members)) slots.add(`component.${group}.${member}`);
  }
  return [...slots].sort();
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
