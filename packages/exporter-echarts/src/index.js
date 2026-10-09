/**
 * @transtyle/exporter-echarts — emits Apache ECharts theme objects from the
 * resolved IR. Spec: docs/specs/exporters/echarts.md.
 *
 * ECharts has no runtime mode concept: theme choice happens at init. The
 * color-scheme dimension therefore maps to one theme per mode — the native
 * pattern — and is classified `native` via file multiplication.
 * Colors are hex (canvas rendering); OKLCH → hex may gamut-clamp (→ approximated).
 */

import { droppedDimensions } from '@transtyle/ir';

const S = 'semantic.color.';
const P = 'semantic.palette.categorical.';
const PALETTE_SIZE = 8;

export default {
  name: 'echarts',

  emit(normalized, ctx) {
    const files = [];
    const coverage = [];
    const themeNames = [];

    for (const mode of normalized.modeValues) {
      const map = normalized.modes[mode];
      const themeName = `${ctx.projectName}-${mode}`;
      themeNames.push(themeName);
      const { theme, modeCoverage } = buildTheme(map, mode, ctx);
      // Coverage is identical across modes by construction; record once.
      if (coverage.length === 0) coverage.push(...modeCoverage);

      const json = JSON.stringify(theme, null, 2) + '\n';
      files.push({ path: `theme.${themeName}.json`, contents: json, kind: 'theme' });
      files.push({
        path: `theme.${themeName}.js`,
        contents: umdWrapper(themeName, theme, ctx),
        kind: 'script',
      });
    }

    // Mode dimensions this exporter doesn't express (T8, ir.md#modes) — a
    // no-op unless the compile actually declares one, e.g. `density`.
    coverage.push(...droppedDimensions(normalized.dimensionNames, ['color-scheme']));

    files.push({ path: 'usage.md', contents: renderUsage(ctx, themeNames, coverage), kind: 'doc' });
    return { files, coverage };
  },
};

// ---------- theme construction ----------

function buildTheme(map, mode, ctx) {
  const coverage = [];
  let clampedAny = false;

  const hex = (path) => {
    const value = map.get(path)?.value;
    if (!value) return undefined;
    const { text, clamped } = ctx.formatHex(value);
    if (clamped) clampedAny = { path };
    return text;
  };
  const prov = (path) => map.get(path)?.provenance.kind;
  const cov = (variable, slot, cls, note, provSlot = slot) => {
    // AL5 sweep: when the slot doesn't resolve, `hex()` returns undefined and
    // JSON.stringify silently omits the key — the right behavior, since ECharts
    // then uses its own default. But the row still claimed `native`, so the
    // report asserted coverage for a property the theme file doesn't contain
    // (`semantic.color.border` is authored in all four examples and absent from
    // a minimal design system). Only single-path slots are checkable; the
    // palette row's slot is a range label.
    if (/^semantic\.[\w.-]+$/.test(slot) && map.get(slot)?.value === undefined) {
      coverage.push({
        variable,
        slot: '—',
        class: 'dropped',
        note: `nothing to bind: this design system has no ${slot}, so the property is omitted and ECharts' own default applies`,
      });
      return;
    }
    const provKind = prov(provSlot);
    const finalCls = cls === 'approximated' ? 'approximated' : (provKind === 'derived' ? 'derived' : cls);
    coverage.push({ variable, slot, class: finalCls, provenance: provKind, ...(note && { note }) });
  };

  // Categorical palette — the reason this exporter exists
  const palette = [];
  for (let i = 1; i <= PALETTE_SIZE; i++) {
    const c = hex(`${P}${i}`);
    if (c) palette.push(c);
  }
  cov('color[]', `${P}1–${PALETTE_SIZE}`, 'native', undefined, `${P}1`);

  const background = hex(`${S}elevation.0.surface`);
  const text = hex(`${S}text.base`);
  const textMuted = hex(`${S}text.muted`);
  const border = hex(`${S}border`);
  const overlay = hex(`${S}elevation.3.surface`);
  cov('backgroundColor', `${S}elevation.0.surface`, 'native');
  cov('textStyle.color', `${S}text.base`, 'native');
  cov('title/legend/axisLabel', `${S}text.muted`, 'native');
  cov('axisLine/splitLine/tooltip.borderColor', `${S}border`, 'native');
  cov('tooltip.backgroundColor', `${S}elevation.3.surface`, 'native');

  // fontFamily: ECharts wants a single CSS-style string
  const fontEntry = map.get('semantic.font.sans');
  const fontFamily = fontEntry ? fontEntry.value.join(', ') : undefined;
  if (fontFamily) cov('textStyle.fontFamily', 'semantic.font.sans', 'native');

  // radius: rem → px numeric (unit conversion = approximated)
  const radiusEntry = map.get('semantic.radius.md');
  const radiusPx = radiusEntry ? toPx(radiusEntry.value, ctx) : undefined;
  if (radiusPx !== undefined) {
    cov('tooltip.borderRadius', 'semantic.radius.md', 'approximated', `rem → px (base ${remBase(ctx)})`);
  }

  if (clampedAny) {
    coverage.push({
      variable: '(gamut)', slot: clampedAny.path, class: 'approximated',
      note: 'sRGB gamut clamp during oklch → hex',
    });
  }

  // Honest unsupported: themable ECharts surfaces the IR does not cover yet
  coverage.push({ variable: 'series-specific styles (candlestick, gauge, …)', slot: '—', class: 'unsupported', note: 'beyond catalog semantics; extend the emitted theme manually', meaning: 'chart.series-style' });

  const axisCommon = {
    axisLine: { lineStyle: { color: border } },
    axisTick: { lineStyle: { color: border } },
    axisLabel: { color: textMuted },
    splitLine: { lineStyle: { color: [border] } },
    splitArea: { show: false },
  };

  const theme = {
    color: palette,
    backgroundColor: background,
    textStyle: { color: text, ...(fontFamily && { fontFamily }) },
    title: {
      textStyle: { color: text },
      subtextStyle: { color: textMuted },
    },
    legend: { textStyle: { color: textMuted } },
    tooltip: {
      backgroundColor: overlay,
      borderColor: border,
      borderWidth: 1,
      ...(radiusPx !== undefined && { borderRadius: radiusPx }),
      textStyle: { color: text },
    },
    toolbox: { iconStyle: { borderColor: textMuted } },
    categoryAxis: axisCommon,
    valueAxis: axisCommon,
    logAxis: axisCommon,
    timeAxis: axisCommon,
  };

  return { theme, modeCoverage: coverage };
}

// The rem base is the config's `units.remBase` (default 16px), read through ctx.units.
const remBase = (ctx) => ctx.units?.remBase ?? 16;

function toPx(value, ctx) {
  // A ctx without `units` (an older core, a hand-built test context) keeps the 16px base.
  const px = ctx.units ? ctx.units.toPx(value) : /^([\d.]+)(px|rem)$/.test(value) ? parseFloat(value) * (value.endsWith('rem') ? 16 : 1) : undefined;
  return px === undefined ? undefined : Math.round(px);
}

// ---------- artifacts ----------

function umdWrapper(themeName, theme, ctx) {
  return [
    '/*',
    ` * GENERATED by transtyle — do not edit; source: ${ctx.projectName} token files`,
    ' * Registers the theme when loaded after echarts via <script>, or exports it (CJS/ESM interop via default).',
    ' */',
    '(function (global, factory) {',
    "  if (typeof module === 'object' && module.exports) { module.exports = factory(); }",
    '  else if (global.echarts) { global.echarts.registerTheme(' + JSON.stringify(themeName) + ', factory()); }',
    "}(typeof self !== 'undefined' ? self : this, function () {",
    '  return ' + JSON.stringify(theme, null, 2).replace(/\n/g, '\n  ') + ';',
    '}));',
    '',
  ].join('\n');
}

function renderUsage(ctx, themeNames, coverage) {
  const counts = {};
  for (const c of coverage) counts[c.class] = (counts[c.class] ?? 0) + 1;
  const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(' · ');
  const [lightName, darkName] = themeNames;
  return `# Using this ECharts theme

Generated from the **${ctx.projectName}** design system by transtyle. Coverage: ${summary}.
One theme per color-scheme mode — theme selection at \`init\` is ECharts' native pattern.

## ES modules / bundlers

\`\`\`js
import * as echarts from 'echarts';
import light from './theme.${lightName}.json' with { type: 'json' };
${darkName ? `import dark from './theme.${darkName}.json' with { type: 'json' };` : ''}

echarts.registerTheme('${lightName}', light);
${darkName ? `echarts.registerTheme('${darkName}', dark);` : ''}
const chart = echarts.init(el, '${lightName}');
\`\`\`

## Script tags

\`\`\`html
<script src="https://cdn.jsdelivr.net/npm/echarts@5"></script>
<script src="./theme.${lightName}.js"></script> <!-- registers itself -->
<script>const chart = echarts.init(el, '${lightName}');</script>
\`\`\`

## Switching modes

ECharts themes are fixed at init. To follow a light/dark toggle: \`chart.dispose()\` and re-\`init\` with the other theme name (preserve state via \`chart.getOption()\` if needed).

## Extending

Series-type-specific styling (candlestick colors, gauge bands, …) is beyond design-token semantics and reported as \`unsupported\` in \`report.json\`. Extend by merging your own options on top of the theme at \`init\` — never edit these files; regenerate them with \`transtyle build echarts\`.
`;
}
