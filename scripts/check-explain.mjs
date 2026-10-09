#!/usr/bin/env node
/**
 * Golden checks for `explainToken()`, `explainVariable()` and `slotConsumers()`
 * from @transtyle/core (docs/specs/cli.md "Programmatic parity"). Real slots
 * come from examples/acme (authored, aliased, derived); the walk's edge cases
 * (diamond, unresolved input, depth limit, defaulted, alias chains, modes,
 * errors) and the coverage lookups' (via chains, cycles, missing rows, hop
 * limit, errors) run on small hand-built inputs.
 * Run: node scripts/check-explain.mjs (also: npm run check:explain).
 */
import assert from 'node:assert/strict';
import { compile, explainToken, explainVariable, slotConsumers, coverageSlots } from '@transtyle/core';

const loadExporter = async () => ({ name: 'noop', optionsSchema: { type: 'object' }, emit: () => ({ files: [], coverage: [] }) });
const entry = (provenance, value = 1) => ({ type: 'number', value, provenance });
const derived = (inputs) => ({ kind: 'derived', rule: 'r@1', inputs });

// ---------- real design system ----------
const { normalized } = await compile({ cwd: 'examples/acme', targets: [], emit: false, loadExporter });

const aliased = explainToken(normalized, 'primary.solid');
assert.equal(aliased.slot, 'semantic.color.primary.solid', 'bare slot resolves via semantic.color.');
assert.equal(aliased.mode, normalized.defaultMode);
assert.equal(aliased.entry.provenance.kind, 'aliased');
assert.equal(aliased.inputs.length, 1, 'an alias is followed to its target');
assert.equal(aliased.inputs[0].path, aliased.entry.provenance.target);
assert.equal(aliased.inputs[0].entry.value, aliased.entry.value, 'the alias target holds the same value');

// issue #98's own example: component.button.radius → semantic.radius.full → authored radius.md
const radius = explainToken(normalized, 'component.button.radius');
assert.equal(radius.inputs[0].path, 'semantic.radius.full');
assert.equal(radius.inputs[0].entry.provenance.kind, 'derived');
assert.equal(radius.inputs[0].inputs[0].path, 'semantic.radius.md');
assert.equal(radius.inputs[0].inputs[0].entry.provenance.kind, 'authored');

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

// alias chain: followed to the end without counting toward the depth limit
const chain = new Map([
  ['c0', entry({ kind: 'aliased', target: 'c1' })],
  ['c1', entry({ kind: 'aliased', target: 'c2' })],
  ['c2', entry(derived(['l0']))],
  ['l0', map.get('l0')], ['l1', map.get('l1')], ['l2', map.get('l2')], ['l3', map.get('l3')], ['l4', map.get('l4')],
  ['dangling', entry({ kind: 'aliased', target: 'nowhere' })],
]);
const nc = { ...n, modes: { light: chain } };
const c = explainToken(nc, 'c0');
assert.equal(c.inputs[0].path, 'c1');
assert.equal(c.inputs[0].inputs[0].path, 'c2');
const viaAliases = c.inputs[0].inputs[0].inputs[0].inputs[0].inputs[0];
assert.equal(viaAliases.path, 'l2', 'aliases add no depth: c2 gets the same three levels of inputs as a root (l0, l1, l2)');
assert.equal(viaAliases.truncated, true);
assert.deepEqual(explainToken(nc, 'dangling').inputs, [{ path: 'nowhere', unresolved: true }]);

// ---------- coverage lookups (hand-built compile result) ----------
const cov = {
  normalized: { defaultMode: 'light', modeValues: ['light'], modes: { light: new Map([['semantic.radius.md', entry({ kind: 'authored' })], ['semantic.space.1', entry({ kind: 'authored' })]]) } },
  results: [{
    target: 't',
    coverage: [
      { variable: '$radius', slot: 'semantic.radius.md', class: 'native' },
      { variable: '$pair', slot: 'radius + space', slots: ['semantic.radius.md', 'semantic.space.1'], class: 'approximated' },
      { variable: '$a', slot: 'via driven roots', via: ['$b'], class: 'derived' },
      { variable: '$b', slot: 'via driven roots', via: ['$radius', '$gone'], class: 'derived' },
      { variable: '$loop1', slot: 'x', via: ['$loop2'], class: 'derived' },
      { variable: '$loop2', slot: 'x', via: ['$loop1'], class: 'derived' },
      { variable: '$dropped', slot: '—', class: 'dropped', note: 'not a theme value' },
      { variable: '$wild', slot: 'semantic.radius.*', class: 'native' },
      ...Array.from({ length: 8 }, (_, i) => ({ variable: `$h${i}`, slot: 'via', via: [`$h${i + 1}`], class: 'derived' })),
      { variable: '$h8', slot: 'semantic.space.1', class: 'native' },
    ],
  }],
};
assert.deepEqual(coverageSlots(cov.results[0].coverage[0], cov.normalized), ['semantic.radius.md'], 'a slot that is a path counts');
assert.deepEqual(coverageSlots(cov.results[0].coverage[7], cov.normalized), [], 'a wildcard label reads nothing');

const va = explainVariable(cov, 't', 'a');
assert.equal(va.variable, '$a', 'a name without its $ is tried with it');
assert.deepEqual(va.slots, ['semantic.radius.md']);
assert.equal(va.rows[0].via[0].variable, '$b');
assert.deepEqual(va.rows[0].via[0].via.map((v) => v.variable), ['$radius', '$gone']);
assert.deepEqual(va.rows[0].via[0].via[1], { variable: '$gone', missing: true });
assert.deepEqual(explainVariable(cov, 't', '$pair').slots, ['semantic.radius.md', 'semantic.space.1']);
const loop = explainVariable(cov, 't', '$loop1');
assert.deepEqual(loop.rows[0].via[0].via, [{ variable: '$loop1', seen: true }], 'cycles stop');
assert.deepEqual(loop.slots, []);
const dropped = explainVariable(cov, 't', '$dropped');
assert.deepEqual(dropped.slots, []);
assert.equal(dropped.rows[0].note, 'not a theme value');
const hops = explainVariable(cov, 't', '$h0');
assert.deepEqual(hops.slots, [], 'the hop limit stops a long chain');
let deepest = hops.rows[0];
while (deepest.via?.length) deepest = deepest.via[0];
assert.equal(deepest.truncated, true);
assert.doesNotThrow(() => JSON.stringify(va));

const consumers = slotConsumers(cov, 't', 'semantic.radius.md');
assert.deepEqual(consumers.rows, [
  { variable: '$radius', class: 'native', through: [] },
  { variable: '$pair', class: 'approximated', through: [] },
  { variable: '$a', class: 'derived', through: ['$b', '$radius'] },
  { variable: '$b', class: 'derived', through: ['$radius'] },
], 'direct rows first, then chained ones with their shortest chain');
assert.deepEqual(slotConsumers(cov, 't', 'semantic.space.1').rows.map((r) => r.variable), ['$pair', '$h8', '$h2', '$h3', '$h4', '$h5', '$h6', '$h7'], 'six hops at most: $h2 reaches $h8, $h1 and $h0 do not');

assert.throws(() => explainVariable(cov, 'nope', '$a'), (e) => e.code === 'unknown-target' && e.available.join() === 't');
assert.throws(() => slotConsumers(cov, 'nope', 'semantic.radius.md'), (e) => e.code === 'unknown-target');
assert.throws(() => explainVariable(cov, 't', '$radiu'), (e) => e.code === 'unknown-variable' && e.closest[0] === '$radius' && e.closest.length === 5);

// ---------- errors ----------
assert.throws(() => explainToken(n, 'a', { mode: 'sepia' }), (e) => e.code === 'unknown-mode' && e.available.join() === 'light,dark' && /Unknown mode "sepia"/.test(e.message));
assert.throws(() => explainToken(n, 'l9'), (e) => e.code === 'unknown-slot' && e.closest.length === 5 && e.closest.includes('l0') && e.slot === 'l9');

console.log('✔ check-explain: explainToken tree, coverage lookups, edge cases and errors all pass');
