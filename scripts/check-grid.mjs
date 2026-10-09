#!/usr/bin/env node
/**
 * Acceptance check for the role-grid catalog revision
 * (docs/plan/catalog-revision.md T2). Compiles the Acme example directly
 * through @transtyle/core (no exporter needed) and asserts:
 *  (a) every documented grid/ladder/content slot exists in both modes;
 *  (b) a frozen set of spot-check hex values, hand-verified against the
 *      Phase 0 Bootstrap fixture, match exactly — proving the promoted
 *      exporter conventions (tint/outline/on-tint) reproduce the shipped
 *      fixture byte-for-byte, and that the migration changed vocabulary,
 *      not values, everywhere except the documented elevation-ladder
 *      refinement (see docs/worklog for the overlay/popover level change).
 *  (c) role archetypes (T7): Cathode's `crt-amber` custom role (declared via
 *      `$extensions.transtyle.role`) gets the full grid derived, exactly like
 *      a built-in role — checked by compiling Cathode too.
 *  (d) a role whose `.solid` is an authored alias to a slot DERIVE fills
 *      (another role's `.solid` or a derived cell) gets its full grid too,
 *      whatever the order of the roles; one bound to a slot derived after the
 *      role grids raises TST1205, and a dangling one only TST1105. Each case
 *      compiles a small temporary design system in-process.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile } from '@transtyle/core';
import { formatHex } from '@transtyle/core';

// A derivation-only stand-in for any exporter — permissive optionsSchema so it
// accepts whatever options the example configs carry (this test exercises the
// engine, not option validation; that's scripts/check-schemas.mjs's job).
const loadExporter = async () => ({ name: 'noop', optionsSchema: { type: 'object' }, emit: () => ({ files: [], coverage: [] }) });

const REQUIRED_SLOTS = [
  // role grid, spot-checked on primary (every role gets the same cell set)
  'semantic.color.primary.solid', 'semantic.color.primary.solid-hover', 'semantic.color.primary.solid-active',
  'semantic.color.primary.solid-selected', 'semantic.color.primary.tint', 'semantic.color.primary.tint-hover',
  'semantic.color.primary.tint-active', 'semantic.color.primary.tint-selected', 'semantic.color.primary.outline',
  'semantic.color.primary.outline-hover', 'semantic.color.primary.on-solid', 'semantic.color.primary.on-tint',
  'semantic.color.primary.text', 'semantic.color.primary.text-hover', 'semantic.color.primary.text-active',
  'semantic.color.primary.text-strong',
  // elevation ladder
  'semantic.color.elevation.0.surface', 'semantic.color.elevation.1.surface', 'semantic.color.elevation.2.surface',
  'semantic.color.elevation.3.surface', 'semantic.color.elevation.4.surface', 'semantic.color.elevation.5.surface',
  'semantic.color.elevation.1.shadow', 'semantic.color.elevation.2.shadow', 'semantic.color.elevation.3.shadow', 'semantic.color.elevation.4.shadow',
  'semantic.color.scrim',
  // content hierarchy
  'semantic.color.text.strong', 'semantic.color.text.base', 'semantic.color.text.muted',
  'semantic.color.text.subtle', 'semantic.color.text.disabled', 'semantic.color.text.inverse',
  'semantic.color.link.base', 'semantic.color.link.hover', 'semantic.color.link.visited',
  'semantic.color.border', 'semantic.color.ring',
  // scales
  'semantic.radius.control', 'semantic.radius.field', 'semantic.radius.container',
  'semantic.space.0', 'semantic.space.24', 'semantic.size.control.md', 'semantic.border-width.thin',
  'semantic.breakpoint.xs', 'semantic.z.modal', 'semantic.type.size.md', 'semantic.type.weight.regular',
  'semantic.type.leading.normal', 'semantic.type.tracking.normal', 'semantic.type.role.body.md',
  'semantic.duration.normal', 'semantic.easing.standard',
];

// Frozen spot values — hand-verified against examples/acme/expected/bootstrap/* this session.
const FROZEN_HEX = {
  'semantic.color.primary.tint': '#e7effa', // = old <role>.subtle
  'semantic.color.primary.outline': '#b7d2f4', // = F10 fixture border-subtle
  'semantic.color.primary.on-tint': '#005bb6', // = old text-on-<role>.subtle / -text-emphasis
  'semantic.color.neutral.tint': '#edeff1', // = old Bootstrap $light
  'semantic.color.neutral.text-strong': '#171b20', // = old Bootstrap $dark / neutral.contrast
};

// (d) A two-mode design system with only the engine's required anchor, a
// surface and text.base authored, plus the role bindings under test.
async function compileBound(roles) {
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-grid-alias-'));
  try {
    mkdirSync(join(dir, 'tokens'));
    const color = {
      primary: { solid: { $type: 'color', $value: '#0d6efd' } },
      surface: { $type: 'color', $value: '#ffffff' },
      text: { base: { $type: 'color', $value: '#212529' } },
      ...roles,
    };
    writeFileSync(join(dir, 'tokens', 'base.tokens.json'), JSON.stringify({ semantic: { color } }, null, 2));
    writeFileSync(
      join(dir, 'transtyle.config.json'),
      JSON.stringify({ name: 'grid-alias', tokens: ['tokens/*.tokens.json'], modes: { 'color-scheme': { values: ['light', 'dark'], default: 'light' } }, targets: {} }, null, 2),
    );
    return await compile({ cwd: dir, targets: [], emit: false, loadExporter });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const bind = (target) => ({ solid: { $value: `{semantic.color.${target}}` } });

async function main() {
  const { normalized, diagnostics } = await compile({ cwd: 'examples/acme', targets: [], emit: false, loadExporter });
  const errors = [];
  if (diagnostics.errors.length) errors.push(`compile errors: ${diagnostics.errors.map((e) => e.message).join('; ')}`);

  for (const mode of ['light', 'dark']) {
    const map = normalized.modes[mode];
    if (!map) { errors.push(`mode "${mode}" missing`); continue; }
    for (const slot of REQUIRED_SLOTS) {
      if (map.get(slot)?.value === undefined) errors.push(`${mode}: missing slot ${slot}`);
    }
  }

  const light = normalized.modes.light;
  for (const [slot, expected] of Object.entries(FROZEN_HEX)) {
    const entry = light.get(slot);
    if (!entry?.value) { errors.push(`frozen check: ${slot} missing`); continue; }
    const got = formatHex(entry.value).text;
    if (got !== expected) errors.push(`frozen check: ${slot} expected ${expected}, got ${got}`);
  }

  // (c) role archetypes (T7) — Cathode's crt-amber joins the grid like a built-in role.
  const cathode = await compile({ cwd: 'examples/cathode', targets: [], emit: false, loadExporter });
  if (cathode.diagnostics.errors.length) errors.push(`cathode compile errors: ${cathode.diagnostics.errors.map((e) => e.message).join('; ')}`);
  if (!cathode.normalized.roleArchetypes.has('crt-amber')) {
    errors.push('cathode: expected semantic.color.crt-amber to carry a role archetype extension');
  }
  const ARCHETYPE_CELLS = ['solid', 'solid-hover', 'solid-active', 'tint', 'tint-hover', 'outline', 'outline-hover', 'on-solid', 'on-tint', 'text', 'text-strong'];
  for (const mode of ['light', 'dark']) {
    const map = cathode.normalized.modes[mode];
    if (!map) { errors.push(`cathode: mode "${mode}" missing`); continue; }
    for (const cell of ARCHETYPE_CELLS) {
      if (map.get(`semantic.color.crt-amber.${cell}`)?.value === undefined) {
        errors.push(`cathode ${mode}: missing archetyped-role slot semantic.color.crt-amber.${cell}`);
      }
    }
  }

  // (d) A `.solid` bound to a derived slot — later in role order, earlier in
  // role order, a derived cell, and on an archetyped role (which must not read
  // as "no authored .solid", TST1203).
  const BOUND = [
    ['secondary → info.solid (derived later)', 'secondary', { secondary: bind('info.solid') }],
    ['info → secondary.solid (derived earlier)', 'info', { info: bind('secondary.solid') }],
    ['accent → primary.solid-hover (a derived cell)', 'accent', { accent: bind('primary.solid-hover') }],
    ['archetyped brand2 → info.solid', 'brand2', { brand2: { ...bind('info.solid'), $extensions: { 'transtyle.role': { archetype: 'brand' } } } }],
  ];
  for (const [label, role, roles] of BOUND) {
    const { normalized, diagnostics } = await compileBound(roles);
    const noisy = diagnostics.items.filter((d) => ['TST1105', 'TST1203', 'TST1205'].includes(d.code) || d.severity === 'error');
    if (noisy.length) errors.push(`${label}: unexpected ${noisy.map((d) => `${d.code} "${d.message}"`).join('; ')}`);
    for (const mode of ['light', 'dark']) {
      const map = normalized.modes[mode];
      const missing = ARCHETYPE_CELLS.filter((cell) => map?.get(`semantic.color.${role}.${cell}`)?.value === undefined);
      if (missing.length) errors.push(`${label} (${mode}): grid not derived — missing ${missing.map((c) => `${role}.${c}`).join(', ')}`);
    }
    const target = roles[role].solid.$value.slice(1, -1);
    if (JSON.stringify(normalized.modes.light.get(`semantic.color.${role}.solid`)?.value) !== JSON.stringify(normalized.modes.light.get(target)?.value)) {
      errors.push(`${label}: ${role}.solid does not hold its alias target's value — the authored alias must win over the role's default`);
    }
  }
  // Bound to a slot derived after the role grids: the alias resolves, the grid
  // can't be built, and TST1205 says so — once, naming both modes.
  const late = await compileBound({ secondary: bind('ring') });
  const late1205 = late.diagnostics.items.filter((d) => d.code === 'TST1205');
  if (late1205.length !== 1 || !late1205[0].message.includes('secondary.solid aliases {semantic.color.ring}') || !late1205[0].message.includes('light and dark')) {
    errors.push(`secondary → ring: expected one TST1205 naming the alias in both modes, got ${JSON.stringify(late1205.map((d) => d.message))}`);
  }
  if (late.normalized.modes.light.get('semantic.color.secondary.solid')?.value === undefined) {
    errors.push('secondary → ring: the alias itself must still resolve after DERIVE');
  }
  // A dangling target is the cause and the skipped grid its consequence:
  // TST1105 alone.
  const dangling = await compileBound({ secondary: bind('nope.solid') });
  const codes = dangling.diagnostics.items.map((d) => d.code);
  if (!codes.includes('TST1105') || codes.includes('TST1205')) {
    errors.push(`secondary → a missing slot: expected TST1105 and no TST1205, got ${codes.join(', ')}`);
  }

  if (errors.length) {
    console.error(`✖ check-grid failed — ${errors.length} issue(s):\n`);
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }
  console.log(`✔ check-grid: ${REQUIRED_SLOTS.length} catalog slots present in both modes; ${Object.keys(FROZEN_HEX).length} frozen values match the Phase 0 fixture exactly; the crt-amber role archetype derives its full grid in both modes; ${BOUND.length} roles bound to a derived slot get theirs too, a late-derived binding raises TST1205 and a dangling one TST1105 alone`);
}

main();
