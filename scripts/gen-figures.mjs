#!/usr/bin/env node
/**
 * The blog's figures — pictures of output, painted by the compiler.
 *
 * A post that claims "four design systems, one set of markup, four different
 * results" needs to *show* that, and the ordinary way to get such a picture is
 * to screenshot a running demo and crop it. Screenshots go stale in silence:
 * they keep asserting last quarter's brand blue long after the tokens moved,
 * and nothing in the repository can tell that they have. That is the same
 * dishonesty the coverage report exists to prevent, one surface over — a
 * picture of output nobody compiled.
 *
 * So these are compiled. Every hex, every corner radius and every chart bar
 * below is read from a fresh in-process build of the example it illustrates,
 * in this process, at generation time. The five images cannot disagree with
 * examples/ because they *are* examples/, rendered.
 *
 * What they are not is a screenshot of the demos, and the post says so: the
 * typeface is Inter throughout (satori needs font binaries, and GDS Transport
 * and IBM Plex are not ours to ship), so each figure prints the real compiled
 * `font.sans` stack in its spec strip and links to the live demo where the
 * real typography is. Colour, geometry and the derived chart palette are the
 * genuine article.
 *
 * Rendering is satori + @resvg/resvg-wasm, as in scripts/gen-social-card.mjs
 * and website/src/og.js: pure JS and wasm, no browser, no native binary and no
 * system fonts, so a laptop and CI produce the same bytes. That byte-stability
 * is what lets `--check` treat a stale figure as an error rather than noise —
 * the same bargain scripts/check-brand.mjs makes for the brand assets.
 *
 * Unlike the social card, the output IS committed: website/src/blog references
 * these files, scripts/check-docs.mjs proves the references resolve against
 * website/public/, and a fresh checkout builds the site without running this.
 *
 * Run: node scripts/gen-figures.mjs            (also: npm run gen:figures)
 *      node scripts/gen-figures.mjs --check    (also: npm run check:figures)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXAMPLES } from './lib/demos.mjs';

const require = createRequire(import.meta.url);
const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(repo, 'website/public/figures');
const check = process.argv.includes('--check');

// satori and resvg-wasm both ship CJS; depending on the resolver the namespace
// either is the module or nests it one level down (see gen-social-card.mjs).
const satoriMod = await import('satori');
const satori = typeof satoriMod.default === 'function' ? satoriMod.default : satoriMod.default.default;
const resvgMod = await import('@resvg/resvg-wasm');
const { initWasm, Resvg } = resvgMod.initWasm ? resvgMod : resvgMod.default;

const font = (weight) =>
  readFileSync(require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`));
const FONTS = [
  { name: 'Inter', data: font(400), weight: 400, style: 'normal' },
  { name: 'Inter', data: font(500), weight: 500, style: 'normal' },
  { name: 'Inter', data: font(700), weight: 700, style: 'normal' },
];

// ---------------------------------------------------------------------------
// Reading a system out of the compiler
// ---------------------------------------------------------------------------

/** The slots a figure paints with. Missing one is an error, never a fallback. */
const COLORS = {
  page: 'semantic.color.elevation.0.surface',
  surface: 'semantic.color.elevation.1.surface',
  text: 'semantic.color.text.base',
  muted: 'semantic.color.text.muted',
  border: 'semantic.color.border',
  primary: 'semantic.color.primary.solid',
  onPrimary: 'semantic.color.primary.on-solid',
  tint: 'semantic.color.primary.tint',
  onTint: 'semantic.color.primary.on-tint',
  primaryText: 'semantic.color.primary.text',
  successTint: 'semantic.color.success.tint',
  successText: 'semantic.color.success.text',
  warningTint: 'semantic.color.warning.tint',
  warningText: 'semantic.color.warning.text',
  dangerTint: 'semantic.color.danger.tint',
  dangerText: 'semantic.color.danger.text',
};

/** rem → px so satori can lay it out. The figures are drawn at a 16px root. */
const px = (value) => {
  const m = /^(-?[\d.]+)(rem|px)?$/.exec(String(value).trim());
  if (!m) throw new Error(`figures: cannot read "${value}" as a length`);
  return m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1]);
};

async function readSystem(id) {
  const core = await import(join(repo, 'packages/core/src/index.js'));
  const result = await core.compile({
    cwd: join(repo, 'examples', id),
    emit: false,
    loadExporter: async (n) => (await import(join(repo, `packages/exporter-${n}/src/index.js`))).default,
  });

  // The declared modes, default first. Compound modes (light+compact) are the
  // cross-product of two axes; the figures show the colour-scheme axis only.
  const modes = Object.keys(result.normalized.modes).filter((m) => !m.includes('+'));

  const slot = (mode, name) => {
    const v = result.normalized.modes[mode].get(name);
    if (!v) throw new Error(`figures: examples/${id} has no ${name} in mode "${mode}"`);
    return v;
  };
  const palette = (mode) =>
    Object.fromEntries(
      Object.entries(COLORS).map(([key, name]) => [key, core.formatHex(slot(mode, name).value).text]),
    );

  // The categorical chart palette, as the ECharts exporter actually emitted it
  // — five bars derived, on most of these systems, from one authored colour.
  const chart = (mode) => {
    const echarts = result.results.find((r) => r.target === 'echarts');
    const file = echarts?.emitted?.find((f) => new RegExp(`${mode}\\.json$`).test(f.path));
    if (!file) throw new Error(`figures: examples/${id} emitted no ECharts theme for "${mode}"`);
    return JSON.parse(file.contents).color.slice(0, 5);
  };

  return {
    id,
    modes,
    fontStack: slot(modes[0], 'semantic.font.sans').value.join(', '),
    radius: {
      control: px(slot(modes[0], 'semantic.radius.control').value),
      field: px(slot(modes[0], 'semantic.radius.field').value),
      container: px(slot(modes[0], 'semantic.radius.container').value),
    },
    modeValues: Object.fromEntries(modes.map((m) => [m, { ...palette(m), chart: chart(m) }])),
  };
}

// ---------------------------------------------------------------------------
// Figure chrome — the frame around the panels, in the site's dark palette
// ---------------------------------------------------------------------------

const BG = '#12151c';
const LINE = '#2c313b';
const TEXT = '#eceef2';
const MUTED = '#a5abb6';
const BRAND = '#6b8dff';

const el = (type, props, ...children) => ({
  type,
  props: { ...props, children: children.length > 1 ? children : children[0] },
});
const div = (style, ...children) => el('div', { style }, ...children);
const row = (style, ...children) => div({ display: 'flex', ...style }, ...children);
const text = (style, value) => div({ display: 'flex', ...style }, value);

/**
 * One miniature application, painted entirely in one mode of one system.
 *
 * Every colour here is that system's, and the only numbers not from the
 * compiler are the layout ones — the sizes of the boxes, which are the same
 * for all four systems on purpose. That is the demo gallery's argument in a
 * still image: identical structure, four results.
 */
function app(v, radius, { width, detail }) {
  const chip = (bg, color, label) =>
    text(
      { background: bg, color, fontSize: 11, fontWeight: 500, padding: '5px 9px', borderRadius: radius.control },
      label,
    );

  return div(
    {
      display: 'flex',
      flexDirection: 'column',
      width,
      background: v.page,
      border: `1px solid ${v.border}`,
      // The frame wears the system's own container radius: on Acme that is a
      // soft 8px, and on the other three it is the hard 0 they all authored.
      borderRadius: radius.container,
      overflow: 'hidden',
    },
    // window bar
    row(
      {
        alignItems: 'center',
        gap: 8,
        padding: detail ? '11px 14px' : '9px 12px',
        borderBottom: `1px solid ${v.border}`,
        background: v.surface,
      },
      text({ fontSize: detail ? 13 : 11, fontWeight: 700, color: v.text }, 'Nimbus Console'),
      text({ fontSize: detail ? 12 : 10, color: v.muted, marginLeft: 'auto' }, 'Overview'),
    ),
    // body
    div(
      { display: 'flex', flexDirection: 'column', gap: detail ? 12 : 9, padding: detail ? 14 : 11 },
      // the card
      div(
        {
          display: 'flex',
          flexDirection: 'column',
          gap: detail ? 11 : 8,
          background: v.surface,
          border: `1px solid ${v.border}`,
          borderRadius: radius.container,
          padding: detail ? 14 : 11,
        },
        text({ fontSize: detail ? 14 : 12, fontWeight: 700, color: v.text }, 'Monthly revenue'),
        // the derived categorical palette, drawn as the chart it becomes
        row(
          { alignItems: 'flex-end', gap: detail ? 9 : 7, height: detail ? 54 : 40 },
          ...v.chart.map((c, i) =>
            div({
              display: 'flex',
              width: detail ? 22 : 16,
              height: [54, 33, 44, 22, 38][i] * (detail ? 1 : 0.74),
              borderRadius: Math.min(radius.control, 6),
              background: c,
            }),
          ),
        ),
        row(
          { gap: detail ? 8 : 6, alignItems: 'center' },
          text(
            {
              background: v.primary,
              color: v.onPrimary,
              fontSize: detail ? 12 : 10,
              fontWeight: 500,
              padding: detail ? '7px 13px' : '6px 10px',
              borderRadius: radius.control,
            },
            'Export',
          ),
          text(
            {
              background: v.tint,
              color: v.onTint,
              fontSize: detail ? 12 : 10,
              fontWeight: 500,
              padding: detail ? '7px 13px' : '6px 10px',
              borderRadius: radius.control,
            },
            'Filter',
          ),
          detail
            ? text(
                {
                  color: v.primaryText,
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '6px 12px',
                  border: `1px solid ${v.primaryText}`,
                  borderRadius: radius.control,
                },
                'Cancel',
              )
            : div({ display: 'flex' }),
        ),
      ),
      // status chips — three roles, each with its own tint and text pairing
      row(
        { gap: detail ? 8 : 6 },
        chip(v.successTint, v.successText, 'Operational'),
        chip(v.warningTint, v.warningText, 'Degraded'),
        detail ? chip(v.dangerTint, v.dangerText, 'Incident') : div({ display: 'flex' }),
      ),
      // a form field, so radius.field gets to differ from radius.control
      detail
        ? row(
            {
              alignItems: 'center',
              padding: '9px 12px',
              border: `1px solid ${v.border}`,
              borderRadius: radius.field,
              background: v.page,
            },
            text({ fontSize: 12, color: v.muted }, 'Search accounts'),
          )
        : div({ display: 'flex' }),
    ),
  );
}

/** The label above a panel: which mode, and the surface hex it is painted on. */
const panelLabel = (mode, v, note) =>
  row(
    { alignItems: 'baseline', gap: 8, marginBottom: 10 },
    text({ fontSize: 13, fontWeight: 700, color: TEXT, letterSpacing: '0.06em' }, mode.toUpperCase()),
    text({ fontSize: 13, color: MUTED }, note ?? `${v.page} · ${v.primary}`),
  );

const specStrip = (system) =>
  row(
    { marginTop: 'auto', paddingTop: 22, gap: 26, alignItems: 'baseline', borderTop: `1px solid ${LINE}` },
    ...[
      ['radius.control', system.radius.control === 0 ? '0' : `${system.radius.control / 16}rem`],
      ['radius.container', system.radius.container === 0 ? '0' : `${system.radius.container / 16}rem`],
      ['font.sans', system.fontStack],
    ].map(([k, val]) =>
      row(
        { alignItems: 'baseline', gap: 7 },
        text({ fontSize: 13, color: BRAND, fontWeight: 500 }, k),
        text({ fontSize: 13, color: MUTED }, val),
      ),
    ),
  );

/** One system, both of its modes side by side (or its one mode, said plainly). */
function systemFigure(meta, system) {
  const [first, second] = system.modes;
  const width = 548;

  const panel = (mode) =>
    div(
      { display: 'flex', flexDirection: 'column' },
      panelLabel(mode, system.modeValues[mode]),
      app(system.modeValues[mode], system.radius, { width, detail: true }),
    );

  // GOV.UK publishes no dark theme, so the second panel says that rather than
  // inventing one. A compiler that fabricates a mode nobody designed is a
  // compiler you cannot trust about the modes it did not fabricate.
  const absent = div(
    { display: 'flex', flexDirection: 'column' },
    panelLabel('dark', null, '— not published by this system'),
    div(
      {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width,
        flexGrow: 1,
        border: `1px dashed ${LINE}`,
        borderRadius: 10,
        padding: 30,
        gap: 10,
      },
      text({ fontSize: 17, fontWeight: 700, color: TEXT }, 'This system has one mode.'),
      text(
        { fontSize: 14, color: MUTED, lineHeight: 1.5 },
        'Its config declares light only, so the compiler emits light only — no invented dark palette, and every target told the same story.',
      ),
    ),
  );

  return div(
    { width: 1200, height: 502, display: 'flex', flexDirection: 'column', background: BG, padding: '36px 40px', fontFamily: 'Inter' },
    row(
      { alignItems: 'baseline', gap: 12 },
      text({ fontSize: 26, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }, meta.title),
      text({ fontSize: 15, color: MUTED }, meta.kicker.replace(' · ', ' — ')),
      text({ fontSize: 14, color: BRAND, marginLeft: 'auto' }, `compiled from examples/${meta.id}`),
    ),
    row({ gap: 24, marginTop: 22 }, panel(first), second ? panel(second) : absent),
    specStrip(system),
  );
}

/** All four systems at once: the same miniature app, four compiled results. */
function comparisonFigure(systems) {
  const width = 264;
  return div(
    { width: 1200, height: 432, display: 'flex', flexDirection: 'column', background: BG, padding: '36px 40px', fontFamily: 'Inter' },
    row(
      { alignItems: 'baseline', gap: 12 },
      text({ fontSize: 26, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }, 'One layout. Four design systems.'),
      text({ fontSize: 15, color: MUTED, marginLeft: 'auto' }, 'Every colour compiled from that system’s own tokens'),
    ),
    row(
      { gap: 20, marginTop: 24 },
      ...systems.map(({ meta, system }) => {
        const mode = system.modes[0];
        return div(
          { display: 'flex', flexDirection: 'column' },
          row(
            { alignItems: 'baseline', gap: 7, marginBottom: 9 },
            text({ fontSize: 14, fontWeight: 700, color: TEXT }, meta.title),
            text({ fontSize: 12, color: MUTED }, `${mode} · ${system.modeValues[mode].primary}`),
          ),
          app(system.modeValues[mode], system.radius, { width, detail: false }),
        );
      }),
    ),
    row(
      { marginTop: 'auto', paddingTop: 20, gap: 26, alignItems: 'baseline', borderTop: `1px solid ${LINE}` },
      text({ fontSize: 13, color: MUTED }, 'Identical structure, identical box sizes — nothing here was styled by hand.'),
      text({ fontSize: 13, color: BRAND, marginLeft: 'auto' }, 'transtyle.github.io/transtyle/demo/'),
    ),
  );
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

await initWasm(readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));

const render = async (node, width, height) => {
  const svg = await satori(node, { width, height, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
};

const systems = [];
for (const meta of EXAMPLES) systems.push({ meta, system: await readSystem(meta.id) });

const files = [['four-systems.png', await render(comparisonFigure(systems), 1200, 432)]];
for (const { meta, system } of systems) {
  files.push([`${meta.id}.png`, await render(systemFigure(meta, system), 1200, 502)]);
}

if (check) {
  const stale = [];
  for (const [name, png] of files) {
    const path = join(outDir, name);
    if (!existsSync(path)) stale.push(`${name} — missing`);
    else if (!readFileSync(path).equals(png)) stale.push(`${name} — differs from a fresh compile`);
  }
  if (stale.length) {
    console.error('✖ figures: the blog figures no longer match the examples they were compiled from:');
    for (const s of stale) console.error(`    ${s}`);
    console.error('  Run `npm run gen:figures` and commit the result.');
    process.exit(1);
  }
  console.log(`✔ figures: ${files.length} blog figures match a fresh compile of all ${EXAMPLES.length} examples`);
} else {
  mkdirSync(outDir, { recursive: true });
  for (const [name, png] of files) writeFileSync(join(outDir, name), png);
  const kb = files.reduce((n, [, png]) => n + png.length, 0) / 1024;
  console.log(`✔ figures: ${files.length} written to website/public/figures/ — ${kb.toFixed(0)} KB total`);
  for (const { meta, system } of systems) {
    const v = system.modeValues[system.modes[0]];
    console.log(
      `  ${meta.id}: ${system.modes.join(' + ')} · primary ${v.primary} · surface ${v.page} · radius ${system.radius.control}px`,
    );
  }
}
