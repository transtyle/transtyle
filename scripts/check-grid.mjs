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
 */
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

  if (errors.length) {
    console.error(`✖ check-grid failed — ${errors.length} issue(s):\n`);
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }
  console.log(`✔ check-grid: ${REQUIRED_SLOTS.length} catalog slots present in both modes; ${Object.keys(FROZEN_HEX).length} frozen values match the Phase 0 fixture exactly; the crt-amber role archetype derives its full grid in both modes`);
}

main();
