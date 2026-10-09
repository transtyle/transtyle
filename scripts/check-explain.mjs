#!/usr/bin/env node
/**
 * Golden checks for `explainToken()` from @transtyle/core (docs/specs/cli.md
 * "Programmatic parity"). Real slots come from examples/acme (authored, aliased,
 * derived); the walk's edge cases (diamond, unresolved input, depth limit,
 * defaulted, modes, errors) run on a small hand-built `normalized`.
 * Run: node scripts/check-explain.mjs (also: npm run check:explain).
 */
import assert from 'node:assert/strict';
import { compile, explainToken } from '@transtyle/core';

const loadExporter = async () => ({ name: 'noop', optionsSchema: { type: 'object' }, emit: () => ({ files: [], coverage: [] }) });
const entry = (provenance, value = 1) => ({ type: 'number', value, provenance });
const derived = (inputs) => ({ kind: 'derived', rule: 'r@1', inputs });

// ---------- real design system ----------
const { normalized } = await compile({ cwd: 'examples/acme', targets: [], emit: false, loadExporter });

const aliased = explainToken(normalized, 'primary.solid');
assert.equal(aliased.slot, 'semantic.color.primary.solid', 'bare slot resolves via semantic.color.');
assert.equal(aliased.mode, normalized.defaultMode);
assert.equal(aliased.entry.provenance.kind, 'aliased');
assert.deepEqual(aliased.inputs, []);

const tint = explainToken(normalized, 'primary.tint-hover');
assert.equal(tint.entry.provenance.kind, 'derived');
assert.equal(tint.entry.type, 'color');
assert.equal(tint.inputs.length, tint.entry.provenance.inputs.length);
assert.equal(tint.inputs[0].path, 'semantic.color.primary.solid');
assert.equal(tint.inputs[0].entry.provenance.kind, 'aliased');
assert.doesNotThrow(() => JSON.stringify(tint), 'the tree is JSON-serialisable');

const authored = [...normalized.modes[normalized.defaultMode].entries()].find(([, e]) => e.provenance.kind === 'authored');
assert.ok(authored, 'acme has an authored slot');
assert.equal(explainToken(normalized, authored[0]).entry.provenance.kind, 'authored');

// non-default mode
const otherMode = normalized.modeValues.find((m) => m !== normalized.defaultMode);
assert.ok(otherMode, 'acme has a second mode');
assert.equal(explainToken(normalized, 'primary.solid', { mode: otherMode }).mode, otherMode);

// ---------- hand-built walk ----------
const map = new Map([
  ['a', entry(derived(['b', 'c', 'gone']))],
  ['b', entry(derived(['d']))],
  ['c', entry(derived(['d']))], // diamond: d reached through b and c
  ['d', entry({ kind: 'defaulted', rule: null, inputs: [] })],
  ['semantic.color.x', entry({ kind: 'authored' })],
  ['l0', entry(derived(['l1']))], ['l1', entry(derived(['l2']))], ['l2', entry(derived(['l3']))],
  ['l3', entry(derived(['l4']))], ['l4', entry({ kind: 'authored' })],
]);
const n = { defaultMode: 'light', modeValues: ['light', 'dark'], modes: { light: map, dark: new Map([['only-dark', entry({ kind: 'authored' })]]) } };

const t = explainToken(n, 'a');
assert.deepEqual(t.inputs.map((i) => i.path), ['b', 'c', 'gone']);
assert.equal(t.inputs[0].inputs[0].path, 'd', 'defaulted leaf inside the walk');
assert.equal(t.inputs[0].inputs[0].entry.provenance.kind, 'defaulted');
assert.deepEqual(t.inputs[1].inputs, [{ path: 'd', entry: map.get('d'), seen: true }], 'diamond: second visit is marked seen');
assert.deepEqual(t.inputs[2], { path: 'gone', unresolved: true });

assert.equal(explainToken(n, 'x').slot, 'semantic.color.x', 'semantic.color. prefix fallback');

// depth limit: l0 -> l1 -> l2 -> l3 shown, l3's own inputs cut
const deep = explainToken(n, 'l0');
const l3 = deep.inputs[0].inputs[0].inputs[0];
assert.equal(l3.path, 'l3');
assert.equal(l3.truncated, true);
assert.deepEqual(l3.inputs, []);
assert.equal(deep.truncated, undefined);

assert.equal(explainToken(n, 'only-dark', { mode: 'dark' }).slot, 'only-dark');

// ---------- errors ----------
assert.throws(() => explainToken(n, 'a', { mode: 'sepia' }), (e) => e.code === 'unknown-mode' && e.available.join() === 'light,dark' && /Unknown mode "sepia"/.test(e.message));
assert.throws(() => explainToken(n, 'l9'), (e) => e.code === 'unknown-slot' && e.closest.length === 5 && e.closest.includes('l0') && e.slot === 'l9');

console.log('✔ check-explain: explainToken tree, edge cases and errors all pass');
