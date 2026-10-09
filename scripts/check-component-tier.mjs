#!/usr/bin/env node
/**
 * Acceptance check for the component tier (docs/plan/component-tier.md C2):
 * an empty `component.*` tier must still compile, resolving every
 * `COMPONENT_CATALOG` token from its declared semantic default (the same
 * resolve-or-fill guarantee every other catalog slot already has) — and an
 * authored `component.*` token must win over that default, unconditionally.
 * Run: node scripts/check-component-tier.mjs (also: npm run check:component-tier).
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  // not the catalog default, with 'aliased' provenance. `radius.full` is the
  // load-bearing case: it is materialized by DERIVE, so it only resolves
  // because normalize.js defers such aliases past that stage (the AL1.5 wart
  // fix). This is the authoring style ir.md's component-layer sketch uses.
  const acme = await compile({ cwd: 'examples/acme', targets: [], emit: false, loadExporter });
  if (acme.diagnostics.errors.length) errors.push(`acme compile errors: ${acme.diagnostics.errors.map((e) => e.message).join('; ')}`);
  const aMap = acme.normalized.modes.light;
  for (const [token, target] of [['radius', 'radius.full'], ['padding-x', 'space.6'], ['padding-y', 'space.3']]) {
    const got = aMap?.get(`component.button.${token}`);
    const want = aMap?.get(`semantic.${target}`)?.value;
    if (got?.value !== want) errors.push(`acme: component.button.${token} = ${got?.value}, expected the authored alias to ${target} (${want})`);
    if (got?.provenance.kind !== 'aliased') errors.push(`acme: component.button.${token} provenance = "${got?.provenance.kind}", expected "aliased"`);
  }

  // (c2) AL2 layering (proposal 0003): `component.button.*` defaults FROM
  // `component.control.*`, so an unauthored system resolves both to the same
  // value via the control layer — and Acme, which authors only the button
  // layer, must move buttons WITHOUT moving the shared control (the AL1.2
  // contested call, now resolved by the catalog rather than documented away).
  const cMap = cathode.normalized.modes[Object.keys(cathode.normalized.modes)[0]];
  for (const t of ['radius', 'padding-x', 'padding-y']) {
    const btn = cMap?.get(`component.button.${t}`);
    const ctl = cMap?.get(`component.control.${t}`)?.value;
    if (btn?.value !== ctl) errors.push(`cathode: unauthored component.button.${t} = ${btn?.value}, expected to default from control.${t} (${ctl})`);
    if (btn && !String(btn.provenance.rule ?? '').startsWith(`alias(control.${t})`)) errors.push(`cathode: component.button.${t} rule = "${btn.provenance.rule}", expected alias(control.${t})`);
  }
  for (const t of ['radius', 'padding-x', 'padding-y']) {
    const btn = aMap?.get(`component.button.${t}`)?.value;
    const ctl = aMap?.get(`component.control.${t}`)?.value;
    if (btn === ctl) errors.push(`acme: authoring component.button.${t} must not move component.control.${t} — both are ${btn}`);
  }
  // The one AL2 semantic-tier promotion must exist and be numeric.
  const disabled = aMap?.get('semantic.opacity.disabled')?.value;
  if (typeof disabled !== 'number') errors.push(`semantic.opacity.disabled = ${disabled} (${typeof disabled}), expected a number`);

  // (d) The deferral must not swallow real mistakes: an alias to a path that
  // never materializes is still TST1105, just diagnosed after DERIVE.
  const typo = await compile({ cwd: 'packages/core/test-fixtures/component-dangling', targets: [], emit: false, loadExporter });
  const dangling = typo.diagnostics.errors.filter((e) => e.code === 'TST1105');
  if (!dangling.length) errors.push('dangling fixture: an alias to a non-existent slot must still raise TST1105 after the deferred pass');
  const typoRadius = typo.normalized?.modes.light?.get('component.button.radius')?.value;
  if (typoRadius !== undefined) errors.push(`dangling fixture: component.button.radius resolved to ${typoRadius}; a dangling alias must not fall back to the catalog default`);

  // (b) Authored wins: the fixture overrides component.button.radius to "2px".
  const fixture = await compile({ cwd: 'packages/core/test-fixtures/component-tier', targets: [], emit: false, loadExporter });
  if (fixture.diagnostics.errors.length) errors.push(`fixture compile errors: ${fixture.diagnostics.errors.map((e) => e.message).join('; ')}`);
  const fixtureRadius = fixture.normalized.modes.light?.get('component.button.radius')?.value;
  if (fixtureRadius !== '2px') errors.push(`fixture: component.button.radius = ${fixtureRadius}, expected the authored override "2px" (authored must win over the default)`);
  const fixtureRadiusProvenance = fixture.normalized.modes.light?.get('component.button.radius')?.provenance.kind;
  if (fixtureRadiusProvenance !== 'authored') errors.push(`fixture: component.button.radius provenance = "${fixtureRadiusProvenance}", expected "authored"`);

  // (e) A catalog slot with no `defaultFrom` (proposal 0004:
  // `tooltip.max-width`) exists ONLY when authored. Both halves matter: the
  // empty-tier compile must not conjure it — otherwise the exporters would emit
  // a measure nobody chose, on one upstream's authority — and the authored
  // compile must carry it through with `authored` provenance.
  for (const mode of Object.keys(cathode.normalized.modes)) {
    const v = cathode.normalized.modes[mode]?.get('component.tooltip.max-width')?.value;
    if (v !== undefined)
      errors.push(`cathode ${mode}: component.tooltip.max-width must not exist unauthored (a no-defaultFrom slot has no default to give), got ${JSON.stringify(v)}`);
  }
  const authoredTooltip = fixture.normalized.modes.light?.get('component.tooltip.max-width');
  if (authoredTooltip?.value !== '18rem')
    errors.push(`fixture: component.tooltip.max-width = ${authoredTooltip?.value}, expected the authored "18rem"`);
  if (authoredTooltip?.provenance.kind !== 'authored')
    errors.push(`fixture: component.tooltip.max-width provenance = "${authoredTooltip?.provenance.kind}", expected "authored"`);

  // (f) A semantic source that is itself an authored alias to a slot DERIVE
  // fills: `radius.control` bound to `{semantic.radius.full}`. The component
  // loop runs after the scales are derived, so it must see the alias's value
  // and materialize the component slots — not skip them as "no source" while
  // the alias resolves only after DERIVE.
  const aliasDir = mkdtempSync(join(tmpdir(), 'transtyle-component-alias-'));
  try {
    mkdirSync(join(aliasDir, 'tokens'));
    writeFileSync(
      join(aliasDir, 'tokens', 'base.tokens.json'),
      JSON.stringify({
        semantic: {
          color: { primary: { solid: { $type: 'color', $value: '#0d6efd' } } },
          radius: { md: { $type: 'dimension', $value: '6px' }, control: { $value: '{semantic.radius.full}' } },
        },
      }),
    );
    writeFileSync(join(aliasDir, 'transtyle.config.json'), JSON.stringify({ name: 'component-alias', tokens: ['tokens/*.tokens.json'], targets: {} }));
    const aliased = await compile({ cwd: aliasDir, targets: [], emit: false, loadExporter });
    if (aliased.diagnostics.errors.length) errors.push(`radius.control → radius.full: compile errors: ${aliased.diagnostics.errors.map((e) => e.message).join('; ')}`);
    const lMap = aliased.normalized.modes.light;
    for (const slot of ['component.control.radius', 'component.button.radius']) {
      const v = lMap?.get(slot)?.value;
      if (v !== '9999px') errors.push(`radius.control → radius.full: ${slot} = ${v}, expected 9999px (the alias's value, seen by the component loop)`);
    }
  } finally {
    rmSync(aliasDir, { recursive: true, force: true });
  }

  // (g) Tier violations (TST1113): a semantic token aliasing a component token
  // is backwards. A chain semantic -> semantic -> component is reported once,
  // on the token that points the wrong way. component -> semantic and
  // component -> component (button defaulting from control) stay clean.
  const tierDir = mkdtempSync(join(tmpdir(), 'transtyle-tier-violation-'));
  try {
    mkdirSync(join(tierDir, 'tokens'));
    const writeTokens = (tokens) => writeFileSync(join(tierDir, 'tokens', 'base.tokens.json'), JSON.stringify(tokens));
    writeFileSync(join(tierDir, 'transtyle.config.json'), JSON.stringify({ name: 'tier-violation', tokens: ['tokens/*.tokens.json'], targets: {} }));
    const primary = { color: { primary: { solid: { $type: 'color', $value: '#0d6efd' } } } };
    const tierCodes = async () => (await compile({ cwd: tierDir, targets: [], emit: false, loadExporter })).diagnostics.items.filter((i) => i.code === 'TST1113');

    writeTokens({
      semantic: { ...primary, radius: { card: { $type: 'dimension', $value: '{component.button.radius}' }, tile: { $type: 'dimension', $value: '{semantic.radius.card}' } } },
      component: { button: { radius: { $type: 'dimension', $value: '4px' } } },
    });
    const violations = await tierCodes();
    if (violations.length !== 1) errors.push(`tier violation: expected exactly one TST1113 (on semantic.radius.card, not on the chained semantic.radius.tile), got ${violations.map((v) => v.message).join(' | ') || 'none'}`);
    else {
      const [v] = violations;
      if (v.severity !== 'error') errors.push(`tier violation: TST1113 must be an error, got ${v.severity}`);
      if (!v.message.includes('semantic.radius.card') || !v.message.includes('component.button.radius')) errors.push(`tier violation: message must name both tokens, got "${v.message}"`);
      if (!v.hint) errors.push('tier violation: TST1113 carries no hint');
    }

    // Positive control: legitimate layering, no TST1113.
    writeTokens({
      semantic: { ...primary, radius: { md: { $type: 'dimension', $value: '6px' } } },
      component: { control: { radius: { $type: 'dimension', $value: '{semantic.radius.md}' } }, button: { radius: { $type: 'dimension', $value: '{component.control.radius}' } } },
    });
    const clean = await tierCodes();
    if (clean.length) errors.push(`tier control: component -> semantic and component -> component must not raise TST1113, got ${clean.map((v) => v.message).join(' | ')}`);
  } finally {
    rmSync(tierDir, { recursive: true, force: true });
  }

  if (errors.length) {
    console.error(`✖ check-component-tier failed — ${errors.length} issue(s):\n`);
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }
  console.log('✔ check-component-tier: a semantic token aliasing a component one raises TST1113 once, on the direct edge; component -> semantic/component stays clean; empty component.* tier compiles from semantic defaults; authored wins; button layers on control (authoring one does not move the other); an alias into a DERIVE-materialized slot resolves while a truly dangling one still raises TST1105; a no-defaultFrom slot (tooltip.max-width) exists only when authored; a semantic source bound to a derived slot (radius.control → radius.full) feeds the component tier');
}

main();
