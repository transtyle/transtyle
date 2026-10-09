#!/usr/bin/env node
/**
 * Plugin conformance gate (ROADMAP P1). Runs @transtyle/plugin-kit's
 * `conformance()` against every official exporter, over every fixture the kit
 * ships (#96: one-token, three-token, two-dimension, single-mode, component
 * tier, custom role, composites, object form), and asserts each passes every
 * check — so the plugin contract is enforced executably, not just described in
 * plugins.md. Also runs it against a tiny inline "third-party" plugin the kit
 * has never seen, proving the suite works on an arbitrary plugin object and not
 * only on the built-ins, and against deliberately broken plugins, one per
 * check that has to prove it has teeth.
 *
 * Run: node scripts/check-plugins.mjs (also: npm run check:plugins; in check:all).
 *
 * NOTE: the full "separate npm-installed repo" proof from P1's acceptance is
 * gated on publication (R4, parked). This inline plugin proves the decoupling
 * the kit provides today; nothing here imports exporter internals.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conformance, fixtureIR, FIXTURES } from '@transtyle/plugin-kit';
import { formatColor, formatHslTriplet, formatHex, contrastRatio, mix } from '@transtyle/core';
import { satisfies } from '../packages/core/src/semver.js';
import { declaredMatches } from '../packages/core/src/compat.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

const OFFICIAL = ['shadcn', 'echarts', 'daisyui', 'bootstrap', 'storybook', 'css-variables', 'radix', 'primeng', 'mantine', 'chakra', 'mui'];

// Exporters bind to the semantic tier (ir.md): `option.*` is private vocabulary
// users restructure freely, so no coverage row may name an option slot.
// (`component.*` is a legitimate binding: that is the point of the tier.)
// Checked on every fixture: a sparse one is where a fallback to `option.*` would show.
const fixtureIRs = await Promise.all(FIXTURES.map((f) => fixtureIR(f.name)));
const fixtureCtx = { config: { name: 'tier', targets: {} }, targetConfig: { output: 'dist', options: {} }, formatColor, formatHslTriplet, formatHex, contrastRatio, mix, projectName: 'tier', siblings: [] };
function optionBindings(plugin) {
  const rows = fixtureIRs.flatMap((ir) => plugin.emit(ir, fixtureCtx).coverage ?? []);
  return rows.filter((c) => String(c.slot).startsWith('option.'));
}

async function checkPlugin(label, plugin, manifest) {
  const bound = optionBindings(plugin);
  if (bound.length) {
    console.error(`✖ ${label}: tier violation — coverage rows bind below the semantic tier: ${bound.map((c) => `${c.variable} <- ${c.slot}`).join(', ')}`);
    failures.push(`${label}:option-binding`);
  }
  const { pass, checks } = await conformance(plugin, manifest ? { manifest } : {});
  if (pass) {
    const fixtures = new Set(checks.map((c) => c.fixture).filter(Boolean));
    console.log(`✔ ${label}: ${checks.length} checks pass over ${fixtures.size} fixtures`);
  } else {
    for (const c of checks.filter((c) => !c.pass)) {
      console.error(`✖ ${label}: ${c.fixture ? `${c.fixture}: ` : ''}${c.name} — ${c.detail} [${c.spec}]`);
      failures.push(`${label}:${c.fixture ?? ''}:${c.name}`);
    }
  }
}

// The fixture authors its radius, a duration and an easing in DTCG structured
// form (issue #24). Core must hand every exporter the CSS string, so no plugin —
// official or third-party — ever sees `{ value, unit }` and stringifies it to
// `[object Object]`. Checked on the IR the conformance suite itself uses.
const CANONICAL = {
  'semantic.radius.md': '0.5rem',
  'semantic.duration.fast': '150ms',
  'semantic.easing.standard': 'cubic-bezier(0.2, 0, 0, 1)',
};
const ir = await fixtureIR();
for (const [slot, want] of Object.entries(CANONICAL)) {
  const got = ir.modes[ir.defaultMode].get(slot)?.value;
  if (got === want) continue;
  console.error(`✖ fixture IR: ${slot} is ${JSON.stringify(got)}, expected the CSS string ${JSON.stringify(want)} — core must canonicalize DTCG structured values before any exporter sees them (packages/core/src/values.js)`);
  failures.push(`fixture:${slot}`);
}
if (!failures.length) console.log(`✔ fixture IR: ${Object.keys(CANONICAL).length} DTCG structured values reach exporters as CSS strings`);

for (const name of OFFICIAL) {
  const pkgDir = join(root, `packages/exporter-${name}`);
  const plugin = (await import(join(pkgDir, 'src/index.js'))).default;
  const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).transtyle;
  await checkPlugin(`exporter-${name}`, plugin, manifest);
}

// A minimal third-party exporter, defined right here — the kit has no knowledge
// of it. If conformance passes, the suite genuinely tests the contract, not the
// built-ins' shared code.
const thirdParty = {
  name: 'acme-custom',
  optionsSchema: { type: 'object', additionalProperties: false, properties: { flavor: { type: 'string' } } },
  emit(ir, ctx) {
    const light = ir.modes[ir.defaultMode];
    const primary = light.get('semantic.color.primary.solid');
    const line = primary ? `--acme-primary: ${ctx.formatHex(primary.value).text};` : '';
    // One stylesheet for the default mode: every dimension is said to be dropped.
    const modes = (ir.dimensionNames ?? []).map((dim) => ({ variable: `(mode:${dim})`, slot: '—', class: 'dropped', note: 'acme.css holds the default mode only' }));
    return {
      files: [{ path: 'acme.css', contents: `:root { ${line} }\n`, kind: 'stylesheet' }],
      coverage: [{ variable: '--acme-primary', slot: 'semantic.color.primary.solid', class: 'native' }, ...modes],
      // The optional diagnostics channel, exercised by a plugin the kit doesn't know.
      diagnostics: [{ severity: 'info', code: 'ACME0001', message: 'acme.css writes hex only', hint: 'Nothing to do.' }],
    };
  },
};
await checkPlugin('third-party (inline)', thirdParty, { kind: 'exporter', name: 'acme-custom', irSpec: 'v0-draft', pluginApi: '^0', capabilities: ['build'] });

// The tier gate has teeth too: a plugin binding a coverage row to `option.*` is caught.
const optionBinder = { name: 'option-binder', emit: () => ({ files: [], coverage: [{ variable: '--x', slot: 'option.color.blue.500', class: 'native' }] }) };
if (!optionBindings(optionBinder).length) {
  console.error('✖ negative test: a plugin binding a coverage row to option.* was NOT detected');
  failures.push('negative-test-tier');
} else {
  console.log('✔ negative test: a plugin binding below the semantic tier (option.*) is correctly detected');
}

// Deliberately broken plugins must FAIL, each on the check it breaks — proves
// the gate has teeth. Each starts from the inline third-party plugin, so the
// named check is the only thing wrong with it.
const mustFail = async (label, plugin, check, fixtures, manifest) => {
  const { checks } = await conformance(plugin, { ...(fixtures ? { fixtures } : {}), ...(manifest ? { manifest } : {}) });
  if (checks.some((c) => c.name === check && !c.pass)) {
    console.log(`✔ negative test: ${label} fails ${check}`);
  } else {
    console.error(`✖ negative test: ${label} was NOT caught by ${check}`);
    failures.push(`negative-test:${check}`);
  }
};
const withFiles = (contents) => ({ ...thirdParty, emit: (ir, ctx) => ({ ...thirdParty.emit(ir, ctx), files: [{ path: 'acme.css', contents, kind: 'stylesheet' }] }) });
await mustFail('a plugin with an invalid coverage class', { name: 'broken', emit: () => ({ files: [{ path: 'x', contents: 'y', kind: 'k' }], coverage: [{ variable: 'v', slot: 's', class: 'made-up-class' }] }) }, 'coverage-classes-valid', 'canonical');
// An exporter cannot raise an error from emit (a throw is TST3001): a
// diagnostic with severity "error" breaks the contract.
await mustFail('a plugin returning an error-severity diagnostic', { name: 'loud', emit: () => ({ files: [], coverage: [], diagnostics: [{ severity: 'error', code: 'X0001', message: 'stop' }] }) }, 'emit-diagnostics-valid', 'canonical');
await mustFail('a plugin writing `[object Object]` into a value', withFiles(':root { --acme-radius: [object Object]; }\n'), 'no-leaked-values', 'canonical');
await mustFail('a plugin writing `undefined` after a colon', withFiles(':root { --acme-radius: undefined; }\n'), 'no-leaked-values', 'canonical');
await mustFail('a plugin emitting an empty file', withFiles('\n'), 'files-non-empty', 'canonical');
await mustFail(
  'a plugin claiming `native` for a slot the one-token system never resolves',
  { ...thirdParty, emit: (ir, ctx) => { const out = thirdParty.emit(ir, ctx); return { ...out, coverage: [...out.coverage, { variable: '--acme-radius', slot: 'semantic.radius.md', class: 'native' }] }; } },
  'coverage-honest',
  'one-token',
);
await mustFail(
  'a plugin ignoring `density` without a `(mode:density)` row',
  { ...thirdParty, emit: (ir, ctx) => { const out = thirdParty.emit(ir, ctx); return { ...out, coverage: out.coverage.filter((c) => c.class !== 'dropped') }; } },
  'mode-dimensions-accounted',
  'two-dimension',
);
await mustFail(
  'a plugin reading the authored value instead of the canonical one',
  { ...thirdParty, emit: (ir, ctx) => { const raw = ir.modes[ir.defaultMode].get('semantic.radius.md')?.rawValue; return { ...thirdParty.emit(ir, ctx), files: [{ path: 'acme.css', contents: `/* radius.md as authored: ${JSON.stringify(raw)} */\n`, kind: 'stylesheet' }] }; } },
  'structured-values-as-strings',
  'object-form',
);

await mustFail(
  'a coverage row whose `slots` names a path missing from the IR',
  { ...thirdParty, emit: (ir, ctx) => { const out = thirdParty.emit(ir, ctx); return { ...out, coverage: [...out.coverage, { variable: '--acme-radius', slot: 'radius', slots: ['semantic.radius.mdd'], class: 'native' }] }; } },
  'coverage-slots-exist',
  'canonical',
);
await mustFail(
  'a coverage row whose `via` is not a list of variable names',
  { ...thirdParty, emit: (ir, ctx) => { const out = thirdParty.emit(ir, ctx); return { ...out, coverage: [...out.coverage, { variable: '--acme-radius', slot: 'via --acme-base', via: '--acme-base', class: 'derived' }] }; } },
  'coverage-fields-shape',
  'canonical',
);
// The range check behind `manifest-compatible` and TST1309 (core's own,
// zero-dependency semver subset): node-semver's meaning on the forms a
// manifest holds, and a marker (no version number) compared exactly.
const RANGES = [
  ['0.0.0', '0', true], ['0.0.0', '^0', true], ['0.0.0', '0 || 1', true], ['1.4.0', '0 || 1', true], ['0.0.0', '>=0 <2', true],
  ['0.0.0', '^1', false], ['0.0.0', '^0.1', false], ['0.1.5', '^0.1', true], ['0.2.0', '^0.1', false], ['0.0.4', '^0.0.3', false],
  ['1.2.9', '~1.2', true], ['1.3.0', '~1.2', false], ['1.9.9', '>1', false], ['2.1.9', '<=2.1', true], ['2.4.0', '1 - 2.3', false], ['5.0.0', '*', true],
];
const wrongRanges = RANGES.filter(([v, r, want]) => satisfies(v, r) !== want);
const markers = [['v0-draft', 'v0-draft', true], ['v1', 'v0-draft', false], ['0', 'v0-draft', false]];
const wrongMarkers = markers.filter(([declared, provided, want]) => declaredMatches(declared, provided) !== want);
if (wrongRanges.length || wrongMarkers.length) {
  for (const [v, r, want] of wrongRanges) console.error(`✖ semver: ${v} in "${r}" should be ${want} (packages/core/src/semver.js)`);
  for (const [d, p, want] of wrongMarkers) console.error(`✖ compat: marker "${d}" against "${p}" should be ${want} (packages/core/src/compat.js)`);
  failures.push('semver');
} else {
  console.log(`✔ manifest ranges: ${RANGES.length} semver cases and ${markers.length} exact markers match as specified`);
}

// A manifest declaring an IR spec or plugin API this core doesn't provide
// (issue #14): the same check core runs at load time (TST1309).
const thirdPartyManifest = { kind: 'exporter', name: 'acme-custom', irSpec: 'v0-draft', pluginApi: '0', capabilities: ['build'] };
await mustFail('a manifest built for IR spec "v1"', thirdParty, 'manifest-compatible', 'canonical', { ...thirdPartyManifest, irSpec: 'v1' });
await mustFail('a manifest requiring plugin API "^1"', thirdParty, 'manifest-compatible', 'canonical', { ...thirdPartyManifest, pluginApi: '^1' });

if (failures.length) {
  console.error(`\n✖ check-plugins: ${failures.length} conformance failure(s)`);
  process.exit(1);
}
console.log(`\n✔ check-plugins: all ${OFFICIAL.length} official exporters + an inline third-party plugin pass conformance on ${FIXTURES.length} fixtures`);
