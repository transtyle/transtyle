#!/usr/bin/env node
/**
 * Acceptance check for the component tier (docs/plan/component-tier.md C2):
 * an empty `component.*` tier must still compile, resolving every
 * `COMPONENT_CATALOG` token from its declared semantic default (the same
 * resolve-or-fill guarantee every other catalog slot already has) — and an
 * authored `component.*` token must win over that default, unconditionally.
 * Run: node scripts/check-component-tier.mjs (also: npm run check:component-tier).
 */
import { compile } from '@transtyle/core';

// Permissive optionsSchema: this test exercises the engine, not option
// validation (that's scripts/check-schemas.mjs). See check-grid.mjs.
const loadExporter = async () => ({ name: 'noop', optionsSchema: { type: 'object' }, emit: () => ({ files: [], coverage: [] }) });
const errors = [];

async function main() {
  // (a) Empty tier: Cathode authors no component.* tokens at all. (Was Acme
  // until AL1.5 made Acme the authored-wins example — see (c); the guarantee
  // itself is unchanged, just proven on a different unauthored example.)
  const cathode = await compile({ cwd: 'examples/cathode', targets: [], emit: false, loadExporter });
  if (cathode.diagnostics.errors.length) errors.push(`cathode compile errors: ${cathode.diagnostics.errors.map((e) => e.message).join('; ')}`);
  for (const mode of Object.keys(cathode.normalized.modes)) {
    const map = cathode.normalized.modes[mode];
    if (!map) { errors.push(`cathode: mode "${mode}" missing`); continue; }
    const radius = map.get('component.button.radius')?.value;
    const expectedRadius = map.get('semantic.radius.control')?.value;
    if (radius === undefined) errors.push(`cathode ${mode}: component.button.radius did not resolve — empty tier must still compile`);
    else if (radius !== expectedRadius) errors.push(`cathode ${mode}: component.button.radius = ${radius}, expected default from radius.control (${expectedRadius})`);

    const paddingX = map.get('component.button.padding-x')?.value;
    const expectedPaddingX = map.get('semantic.space.4')?.value;
    if (paddingX !== expectedPaddingX) errors.push(`cathode ${mode}: component.button.padding-x = ${paddingX}, expected default from space.4 (${expectedPaddingX})`);

    const paddingY = map.get('component.button.padding-y')?.value;
    const expectedPaddingY = map.get('semantic.space.2')?.value;
    if (paddingY !== expectedPaddingY) errors.push(`cathode ${mode}: component.button.padding-y = ${paddingY}, expected default from space.2 (${expectedPaddingY})`);
  }

  // (c) Authored-by-alias wins (AL1.5): Acme authors component.button.* as
  // aliases into the semantic scales — they must resolve to the alias target,
  // not the catalog default, with 'aliased' provenance.
  const acme = await compile({ cwd: 'examples/acme', targets: [], emit: false, loadExporter });
  if (acme.diagnostics.errors.length) errors.push(`acme compile errors: ${acme.diagnostics.errors.map((e) => e.message).join('; ')}`);
  const aMap = acme.normalized.modes.light;
  for (const [token, target] of [['radius', 'radius.full'], ['padding-x', 'space.6'], ['padding-y', 'space.3']]) {
    const got = aMap?.get(`component.button.${token}`);
    const want = aMap?.get(`semantic.${target}`)?.value;
    if (got?.value !== want) errors.push(`acme: component.button.${token} = ${got?.value}, expected the authored alias to ${target} (${want})`);
    if (got && got.provenance.kind !== 'aliased' && got.provenance.kind !== 'authored') errors.push(`acme: component.button.${token} provenance = "${got.provenance.kind}", expected authored/aliased`);
  }

  // (b) Authored wins: the fixture overrides component.button.radius to "2px".
  const fixture = await compile({ cwd: 'packages/core/test-fixtures/component-tier', targets: [], emit: false, loadExporter });
  if (fixture.diagnostics.errors.length) errors.push(`fixture compile errors: ${fixture.diagnostics.errors.map((e) => e.message).join('; ')}`);
  const fixtureRadius = fixture.normalized.modes.light?.get('component.button.radius')?.value;
  if (fixtureRadius !== '2px') errors.push(`fixture: component.button.radius = ${fixtureRadius}, expected the authored override "2px" (authored must win over the default)`);
  const fixtureRadiusProvenance = fixture.normalized.modes.light?.get('component.button.radius')?.provenance.kind;
  if (fixtureRadiusProvenance !== 'authored') errors.push(`fixture: component.button.radius provenance = "${fixtureRadiusProvenance}", expected "authored"`);

  if (errors.length) {
    console.error(`✖ check-component-tier failed — ${errors.length} issue(s):\n`);
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }
  console.log('✔ check-component-tier: empty component.* tier compiles from semantic defaults; an authored component.* token wins over its default');
}

main();
