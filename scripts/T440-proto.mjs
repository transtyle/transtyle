import { compile } from '@transtyle/core';
import { pinDimension, MODE_MEDIA_QUERIES } from '@transtyle/ir';
import { parseRules, computed } from './lib/css-cascade.mjs';
const cwd = 'packages/core/test-fixtures/mode-dimensions';
const TARGETS = {
  'css-variables': { file: 'variables.transtyle.css', dark: { attrs: { 'data-color-scheme': 'dark' } }, dims: ['contrast', 'motion', 'brand'] },
  shadcn: { file: 'globals.transtyle.css', dark: { classes: ['dark'] }, dims: ['contrast', 'brand'] },
  'shadcn-v3': { file: 'globals.transtyle.css', dark: { classes: ['dark'] }, dims: ['contrast', 'brand'] },
  radix: { file: 'radix-colors.transtyle.css', dark: { classes: ['dark'] }, dims: ['contrast', 'brand'] },
  bootstrap: { file: 'bootstrap-theme.css', dark: { attrs: { 'data-bs-theme': 'dark' } }, dims: ['contrast', 'brand'], scopes: ['.btn-primary', '.btn-outline-danger'] },
};
const loadExporter = async (n) => (await import(`@transtyle/exporter-${n}`)).default;
const errors = [];
let checked = 0;
for (const [target, spec] of Object.entries(TARGETS)) {
  const full = await compile({ cwd, targets: [target], emit: false, loadExporter });
  const n = full.normalized;
  const exporterName = full.config.targets[target].exporter ?? target;
  const exporter = await loadExporter(exporterName);
  const ctxBase = { config: full.config, targetConfig: full.config.targets[target], projectName: full.config.name };
  const fullCss = full.results[0].emitted.find((f) => f.path === spec.file).contents;
  const rules = parseRules(fullCss);
  const core = await import('@transtyle/core');
  const ctx = { ...ctxBase, formatColor: core.formatColor, formatHslTriplet: core.formatHslTriplet, formatHex: core.formatHex, contrastRatio: core.contrastRatio, mix: core.mix, units: core.makeUnits(full.config), siblings: [] };
  const dims = spec.dims;
  let combos = [{}];
  for (const d of dims) combos = combos.flatMap((c) => n.dimensions[d].values.map((v) => ({ ...c, [d]: v })));
  for (const combo of combos) {
    const pinnedCss = exporter.emit(pinDimension(n, combo), ctx).files.find((f) => f.path === spec.file).contents;
    const pinnedRules = parseRules(pinnedCss);
    for (const scheme of ['light', 'dark']) {
      const schemeState = scheme === 'dark' ? spec.dark : {};
      const attrs = { ...(schemeState.attrs ?? {}) };
      for (const d of dims) attrs[`data-${d}`] = combo[d];
      const states = [{ attrs, features: [] }];
      // OS setting instead of the attribute, for each media-capable non-default value.
      const viaMedia = dims.filter((d) => MODE_MEDIA_QUERIES[d]?.[combo[d]]);
      for (let mask = 1; mask < 1 << viaMedia.length; mask++) {
        const sub = viaMedia.filter((_, i) => mask & (1 << i));
        const a = { ...attrs };
        for (const d of sub) delete a[`data-${d}`];
        states.push({ attrs: a, features: sub.map((d) => MODE_MEDIA_QUERIES[d][combo[d]]) });
      }
      // An explicit default value wins over the OS setting.
      const defaultsOverOs = dims.filter((d) => combo[d] === n.dimensions[d].default && Object.keys(MODE_MEDIA_QUERIES[d] ?? {}).length);
      if (defaultsOverOs.length) {
        states.push({ attrs, features: defaultsOverOs.flatMap((d) => Object.values(MODE_MEDIA_QUERIES[d])) });
      }
      for (const st of states) {
        for (const scope of [undefined, ...(spec.scopes ?? [])]) {
          const want = computed(pinnedRules, { attrs: schemeState.attrs ?? {}, classes: schemeState.classes ?? [] }, [], scope);
          const got = computed(rules, { attrs: st.attrs, classes: schemeState.classes ?? [] }, st.features, scope);
          for (const [name, value] of want) {
            checked++;
            if (got.get(name) !== value) errors.push(`${target} ${scheme} ${JSON.stringify(combo)} ${st.features.join('&')} ${scope ?? ''} ${name}: got ${got.get(name)}, want ${value}`);
          }
        }
      }
    }
  }
}
console.log(checked, 'checked;', errors.length, 'errors');
console.log(errors.slice(0, 20).join('\n'));
