#!/usr/bin/env node
/**
 * Acceptance check for the role-grid catalog revision
 * (docs/plan/catalog-revision.md T2). Compiles the Acme example directly
 * through @transtyle/core (no exporter needed) and asserts:
 *  (a) every slot the catalog says a rule fills exists in both modes, and
 *      every slot the engine fills is in the catalog (catalog() ⇄ derive.js);
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
 *  (e) every slot a completeness level names (core's completenessLevels())
 *      is a catalog slot, and every family it names has catalog members, so a
 *      renamed or removed slot cannot leave `check --completeness` pointing
 *      at a token nobody can author.
 *  (f) `isCatalogSlot()`, what the adoption report (#61) uses to tell the
 *      catalog from a project's own vocabulary, agrees with catalog(): every
 *      catalog path passes it, and on each of the four examples every slot the
 *      engine fills passes it unless it is a custom role's cell, while a custom
 *      token (Cathode's `crt.ink`) does not.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile } from '@transtyle/core';
import { formatHex, catalog, completenessLevels, isCatalogSlot } from '@transtyle/core';

// A derivation-only stand-in for any exporter — permissive optionsSchema so it
// accepts whatever options the example configs carry (this test exercises the
// engine, not option validation; that's scripts/check-schemas.mjs's job).
const loadExporter = async () => ({ name: 'noop', optionsSchema: { type: 'object' }, emit: () => ({ files: [], coverage: [] }) });

// (a) is the catalog itself (core's catalog(), read off a probe compile of the
// engine — see packages/core/src/catalog.js), not a hand-kept list: every slot
// a rule fills must resolve on Acme in both modes, and every slot the engine
// fills on Acme must be in the catalog, so a new rule in derive.js cannot land
// without `transtyle catalog` knowing it. Authored-only slots (primary.solid,
// border, radius.md, the fonts, tooltip.max-width) have no rule to
// check; Acme authoring them is the examples' business.
const CATALOG = catalog();
const REQUIRED_SLOTS = CATALOG.slots.filter((s) => s.kind !== 'authored-only').map((s) => s.path);
const CATALOG_PATHS = new Set(CATALOG.slots.map((s) => s.path));

// Frozen spot values — hand-verified against examples/acme/expected/bootstrap/* this session.
const FROZEN_HEX = {
  'semantic.color.primary.tint': '#e7effa', // = old <role>.subtle
  'semantic.color.primary.outline': '#b7d2f4', // = F10 fixture border-subtle
  'semantic.color.primary.on-tint': '#005bb6', // = old text-on-<role>.subtle / -text-emphasis
  'semantic.color.neutral.tint': '#edeff1', // = old Bootstrap $light
  'semantic.color.neutral.text-strong': '#171b20', // = old Bootstrap $dark / neutral.contrast
};

// (d) A two-mode design system with only the engine's required anchor, a page
// background (elevation.0.surface) and text.base authored, plus the role
// bindings under test.
async function compileBound(roles, semantic = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-grid-alias-'));
  try {
    mkdirSync(join(dir, 'tokens'));
    const color = {
      primary: { solid: { $type: 'color', $value: '#0d6efd' } },
      elevation: { 0: { surface: { $type: 'color', $value: '#ffffff' } } },
      text: { base: { $type: 'color', $value: '#212529' } },
      ...roles,
    };
    writeFileSync(join(dir, 'tokens', 'base.tokens.json'), JSON.stringify({ semantic: { color, ...semantic } }, null, 2));
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
    // The other direction: a slot DERIVE filled (derived or defaulted) that the
    // catalog doesn't list. A custom archetyped role's grid is the project's
    // own vocabulary, not the catalog's (Acme has none today).
    const customRole = (path) => [...normalized.roleArchetypes.keys()].some((r) => path.startsWith(`semantic.color.${r}.`));
    for (const [slot, entry] of map) {
      const filled = ['derived', 'defaulted'].includes(entry.provenance?.kind);
      if (filled && !CATALOG_PATHS.has(slot) && !customRole(slot)) {
        errors.push(`${mode}: the engine fills ${slot} but catalog() does not list it — packages/core/src/catalog.js probes derive.js, so check what the probe authors`);
      }
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

  // (f) isCatalogSlot ⇄ catalog(), on every example.
  for (const p of CATALOG_PATHS) if (!isCatalogSlot(p)) errors.push(`isCatalogSlot: rejects the catalog slot ${p}`);
  for (const p of ['semantic.color.crt.ink', 'semantic.color.surface', 'semantic.color.crt-amber.solid']) {
    if (isCatalogSlot(p)) errors.push(`isCatalogSlot: accepts ${p}, which is not a catalog slot`);
  }
  let examplesFilled = 0;
  for (const example of ['acme', 'cathode', 'govuk', 'carbon']) {
    const { normalized: n } = await compile({ cwd: `examples/${example}`, targets: [], emit: false, loadExporter });
    const roleCell = (path) => [...n.roleArchetypes.keys()].some((r) => path.startsWith(`semantic.color.${r}.`));
    for (const key of n.allCombos) {
      for (const [slot, entry] of n.modes[key]) {
        if (!['derived', 'defaulted'].includes(entry.provenance?.kind)) continue;
        examplesFilled++;
        if (!isCatalogSlot(slot) && !roleCell(slot)) errors.push(`${example} ${key}: the engine fills ${slot} but isCatalogSlot() rejects it`);
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

  // (e) The F8 radius ramp starts at none = 0, in radius.md's unit
  // (docs/architecture/derivation.md); an authored radius.none still wins.
  const radiusMd = light.get('semantic.radius.md')?.value;
  const radiusUnit = /^[\d.]+([a-z%]+)$/.exec(String(radiusMd))?.[1];
  const none = light.get('semantic.radius.none');
  if (none?.value !== `0${radiusUnit}` || none.provenance?.rule !== 'radius-scale(0)@standard@1') {
    errors.push(`radius.none: expected 0${radiusUnit} from radius-scale(0) (radius.md is ${radiusMd}), got ${none?.value} from ${none?.provenance?.rule}`);
  }
  const authoredNone = await compileBound({}, { radius: { md: { $type: 'dimension', $value: '6px' }, none: { $type: 'dimension', $value: '1px' } } });
  for (const mode of ['light', 'dark']) {
    const got = authoredNone.normalized.modes[mode]?.get('semantic.radius.none')?.value;
    if (got !== '1px') errors.push(`radius.none (${mode}): an authored 1px must win over the ramp, got ${got}`);
  }

  // (e) completeness levels name catalog slots only.
  const catalogPaths = new Set(CATALOG.slots.map((s) => s.path));
  const levels = completenessLevels();
  for (const item of levels.at(-1).items) {
    if (item.members ? item.members.length === 0 : !catalogPaths.has(item.slot)) {
      errors.push(`completeness level "${item.level}" names ${item.slot}, which ${item.members ? 'has no member in' : 'is not in'} catalog() — fix ITEMS in packages/core/src/completeness.js`);
    }
  }

  if (errors.length) {
    console.error(`✖ check-grid failed — ${errors.length} issue(s):\n`);
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }
  console.log(`✔ check-grid: all ${REQUIRED_SLOTS.length} rule-filled catalog slots present in both modes and nothing filled outside the catalog; ${Object.keys(FROZEN_HEX).length} frozen values match the Phase 0 fixture exactly; the crt-amber role archetype derives its full grid in both modes; ${BOUND.length} roles bound to a derived slot get theirs too, a late-derived binding raises TST1205 and a dangling one TST1105 alone; radius.none derives to 0 and an authored one wins; the ${levels.at(-1).items.length} items of the completeness levels name catalog slots; isCatalogSlot() accepts all ${examplesFilled} engine-filled slots across the four examples`);
}

main();
