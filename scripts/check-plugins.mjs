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
import { conformance } from '@transtyle/plugin-kit';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

const OFFICIAL = ['shadcn', 'echarts', 'daisyui', 'bootstrap', 'storybook', 'css-variables', 'radix', 'primeng'];

async function checkPlugin(label, plugin, manifest) {
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
    };
  },
};
await checkPlugin('third-party (inline)', thirdParty, { kind: 'exporter', name: 'acme-custom', irSpec: 'v0-draft', pluginApi: '0', capabilities: ['build'] });

// A deliberately broken plugin must FAIL — proves the gate has teeth.
const broken = { name: 'broken', emit: () => ({ files: [{ path: 'x', contents: 'y', kind: 'k' }], coverage: [{ variable: 'v', slot: 's', class: 'made-up-class' }] }) };
const brokenResult = await conformance(broken);
if (brokenResult.pass) {
  console.error('✖ negative test: a plugin with an invalid coverage class was NOT rejected');
  failures.push('negative-test');
} else {
  console.log('✔ negative test: a broken plugin (bad coverage class) is correctly rejected');
}

if (failures.length) {
  console.error(`\n✖ check-plugins: ${failures.length} conformance failure(s)`);
  process.exit(1);
}
console.log(`\n✔ check-plugins: all ${OFFICIAL.length} official exporters + an inline third-party plugin pass conformance`);
