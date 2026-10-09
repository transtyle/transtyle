#!/usr/bin/env node
/**
 * Plugin conformance gate (ROADMAP P1). Runs @transtyle/plugin-kit's
 * `conformance()` against every official exporter and asserts each passes every
 * check — so the plugin contract is enforced executably, not just described in
 * plugins.md. Also runs it against a tiny inline "third-party" plugin the kit
 * has never seen, proving the suite works on an arbitrary plugin object and not
 * only on the built-ins.
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
import { conformance, fixtureIR } from '@transtyle/plugin-kit';
import { formatColor, formatHslTriplet, formatHex, contrastRatio, mix } from '@transtyle/core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

const OFFICIAL = ['shadcn', 'echarts', 'daisyui', 'bootstrap', 'storybook', 'css-variables', 'radix', 'primeng', 'mantine'];

// Exporters bind to the semantic tier (ir.md): `option.*` is private vocabulary
// users restructure freely, so no coverage row may name an option slot.
// (`component.*` is a legitimate binding: that is the point of the tier.)
const fixture = await fixtureIR();
const fixtureCtx = { config: { name: 'tier', targets: {} }, targetConfig: { output: 'dist', options: {} }, formatColor, formatHslTriplet, formatHex, contrastRatio, mix, projectName: 'tier', siblings: [] };
function optionBindings(plugin) {
  return (plugin.emit(fixture, fixtureCtx).coverage ?? []).filter((c) => String(c.slot).startsWith('option.'));
}

async function checkPlugin(label, plugin, manifest) {
  const bound = optionBindings(plugin);
  if (bound.length) {
    console.error(`✖ ${label}: tier violation — coverage rows bind below the semantic tier: ${bound.map((c) => `${c.variable} <- ${c.slot}`).join(', ')}`);
    failures.push(`${label}:option-binding`);
  }
  const { pass, checks } = await conformance(plugin, manifest ? { manifest } : {});
  if (pass) {
    console.log(`✔ ${label}: ${checks.length} checks pass`);
  } else {
    for (const c of checks.filter((c) => !c.pass)) {
      console.error(`✖ ${label}: ${c.name} — ${c.detail} [${c.spec}]`);
      failures.push(`${label}:${c.name}`);
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
    return {
      files: [{ path: 'acme.css', contents: `:root { ${line} }\n`, kind: 'stylesheet' }],
      coverage: [{ variable: '--acme-primary', slot: 'semantic.color.primary.solid', class: 'native' }],
      // The optional diagnostics channel, exercised by a plugin the kit doesn't know.
      diagnostics: [{ severity: 'info', code: 'ACME0001', message: 'acme.css writes hex only', hint: 'Nothing to do.' }],
    };
  },
};
await checkPlugin('third-party (inline)', thirdParty, { kind: 'exporter', name: 'acme-custom', irSpec: 'v0-draft', pluginApi: '0', capabilities: ['build'] });

// The tier gate has teeth too: a plugin binding a coverage row to `option.*` is caught.
const optionBinder = { name: 'option-binder', emit: () => ({ files: [], coverage: [{ variable: '--x', slot: 'option.color.blue.500', class: 'native' }] }) };
if (optionBindings(optionBinder).length !== 1) {
  console.error('✖ negative test: a plugin binding a coverage row to option.* was NOT detected');
  failures.push('negative-test-tier');
} else {
  console.log('✔ negative test: a plugin binding below the semantic tier (option.*) is correctly detected');
}

// A deliberately broken plugin must FAIL — proves the gate has teeth.
const broken = { name: 'broken', emit: () => ({ files: [{ path: 'x', contents: 'y', kind: 'k' }], coverage: [{ variable: 'v', slot: 's', class: 'made-up-class' }] }) };
const brokenResult = await conformance(broken);
if (brokenResult.pass) {
  console.error('✖ negative test: a plugin with an invalid coverage class was NOT rejected');
  failures.push('negative-test');
} else {
  console.log('✔ negative test: a broken plugin (bad coverage class) is correctly rejected');
}

// An exporter cannot raise an error from emit (a throw is TST3001): a
// diagnostic with severity "error" breaks the contract and must be rejected.
const loud = { name: 'loud', emit: () => ({ files: [], coverage: [], diagnostics: [{ severity: 'error', code: 'X0001', message: 'stop' }] }) };
const loudResult = await conformance(loud);
if (loudResult.pass || !loudResult.checks.some((c) => c.name === 'emit-diagnostics-valid' && !c.pass)) {
  console.error('✖ negative test: a plugin returning an error-severity diagnostic was NOT rejected');
  failures.push('negative-test-diagnostics');
} else {
  console.log('✔ negative test: a plugin returning an error-severity diagnostic is correctly rejected');
}

if (failures.length) {
  console.error(`\n✖ check-plugins: ${failures.length} conformance failure(s)`);
  process.exit(1);
}
console.log(`\n✔ check-plugins: all ${OFFICIAL.length} official exporters + an inline third-party plugin pass conformance`);
