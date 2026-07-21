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

const loadExporter = async () => ({ name: 'noop', emit: () => ({ files: [], coverage: [] }) });
const errors = [];

async function main() {
  // (a) Empty tier: Acme authors no component.* tokens at all.
  const acme = await compile({ cwd: 'examples/acme', targets: [], emit: false, loadExporter });
  if (acme.diagnostics.errors.length) errors.push(`acme compile errors: ${acme.diagnostics.errors.map((e) => e.message).join('; ')}`);
  for (const mode of ['light', 'dark']) {
    const map = acme.normalized.modes[mode];
    if (!map) { errors.push(`acme: mode "${mode}" missing`); continue; }
    const radius = map.get('component.button.radius')?.value;
    const expectedRadius = map.get('semantic.radius.control')?.value;
    if (radius === undefined) errors.push(`acme ${mode}: component.button.radius did not resolve — empty tier must still compile`);
    else if (radius !== expectedRadius) errors.push(`acme ${mode}: component.button.radius = ${radius}, expected default from radius.control (${expectedRadius})`);

    const paddingX = map.get('component.button.padding-x')?.value;
    const expectedPaddingX = map.get('semantic.space.4')?.value;
    if (paddingX !== expectedPaddingX) errors.push(`acme ${mode}: component.button.padding-x = ${paddingX}, expected default from space.4 (${expectedPaddingX})`);

    const paddingY = map.get('component.button.padding-y')?.value;
    const expectedPaddingY = map.get('semantic.space.2')?.value;
    if (paddingY !== expectedPaddingY) errors.push(`acme ${mode}: component.button.padding-y = ${paddingY}, expected default from space.2 (${expectedPaddingY})`);
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
