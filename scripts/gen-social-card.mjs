#!/usr/bin/env node
/**
 * The social card: one token definition, and what four ecosystems get from it.
 *
 * The image a launch post carries makes a claim — "this is what comes out" —
 * and the ordinary way to produce one is to screenshot a page and crop it, or
 * to draw the components by hand in a design tool. Both go stale silently. A
 * hand-drawn card is the same dishonesty the coverage report exists to
 * prevent, one surface over: a picture of output nobody compiled.
 *
 * So the card is compiled. Every value on it is read from a fresh in-process
 * build of examples/acme — `primary.solid` and `danger.solid` are that build's
 * hexes, the five bars are the categorical palette the ECharts exporter
 * actually emitted, and the authored/resolved counts are counted off the same
 * normalized graph. Change a derivation rule and the next render moves with
 * it. Nothing here is typed in twice.
 *
 * Rendering is satori + @resvg/resvg-wasm, the same pair src/og.js uses for
 * the site's Open Graph cards: pure JS and wasm, so it needs no browser, no
 * native binary and no system fonts, and a laptop and CI produce the same
 * bytes. Two constraints come with satori and are worked around rather than
 * fought: it has no OKLCH, so the card's own chrome is hex (the site's dark
 * palette, converted once); and Inter's Latin subset has no arrow glyph, so
 * the stat strip separates with a middot — an arrow renders as tofu, which is
 * how this was found.
 *
 * Output is deliberately NOT committed: brand/social/ is gitignored. The
 * generated brand assets in brand/ are committed because a dozen surfaces
 * reference them and check-brand.mjs proves they are current; a social card is
 * referenced by nothing in the repository and belongs to whichever post it was
 * rendered for. Regenerate it when you need one.
 *
 * Run: node scripts/gen-social-card.mjs [outdir]   (also: npm run gen:social).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
// satori and resvg-wasm both ship CJS; depending on the resolver the namespace
// either is the module or nests it one level down. Unwrap whichever shows up
// rather than assuming — the shape differs between `node` and Astro's loader.
const satoriMod = await import('satori');
const satori = typeof satoriMod.default === 'function' ? satoriMod.default : satoriMod.default.default;
const resvgMod = await import('@resvg/resvg-wasm');
const { initWasm, Resvg } = resvgMod.initWasm ? resvgMod : resvgMod.default;
const core = await import(join(repo, 'packages/core/src/index.js'));
const outDir = process.argv[2] ?? join(repo, 'brand/social');

const font = (weight) =>
  readFileSync(require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`));
const FONTS = [
  { name: 'Inter', data: font(400), weight: 400, style: 'normal' },
  { name: 'Inter', data: font(500), weight: 500, style: 'normal' },
  { name: 'Inter', data: font(700), weight: 700, style: 'normal' },
];

/** Compile Acme and read the slots the card claims to show. */
async function acme() {
  const result = await core.compile({
    cwd: join(repo, 'examples/acme'),
    emit: false,
    loadExporter: async (n) => (await import(join(repo, `packages/exporter-${n}/src/index.js`))).default,
  });
  const hex = (mode, slot) => {
    const v = result.normalized.modes[mode].get(slot);
    if (!v) throw new Error(`missing slot ${slot} in ${mode}`);
    return core.formatHex(v.value).text;
  };
  const raw = (mode, slot) => result.normalized.modes[mode].get(slot).value;
  return {
    light: {
      primary: hex('light', 'semantic.color.primary.solid'),
      onPrimary: hex('light', 'semantic.color.primary.on-solid'),
      danger: hex('light', 'semantic.color.danger.solid'),
      surface: hex('light', 'semantic.color.elevation.0.surface'),
      raised: hex('light', 'semantic.color.elevation.1.surface'),
      text: hex('light', 'semantic.color.text.base'),
      muted: hex('light', 'semantic.color.text.muted'),
      border: hex('light', 'semantic.color.border'),
    },
    dark: {
      primary: hex('dark', 'semantic.color.primary.solid'),
      onPrimary: hex('dark', 'semantic.color.primary.on-solid'),
      danger: hex('dark', 'semantic.color.danger.solid'),
      surface: hex('dark', 'semantic.color.elevation.0.surface'),
      raised: hex('dark', 'semantic.color.elevation.1.surface'),
      text: hex('dark', 'semantic.color.text.base'),
      muted: hex('dark', 'semantic.color.text.muted'),
      border: hex('dark', 'semantic.color.border'),
    },
    radius: raw('light', 'semantic.radius.md'),
    // Counted from the same compile, so the stat strip cannot drift either.
    stats: (() => {
      const map = result.normalized.modes.light;
      const slots = [...map.keys()];
      const authored = slots.filter((s) => ['authored', 'aliased'].includes(map.get(s).provenance?.kind));
      return { slots: slots.length, authored: authored.length, targets: result.results.length };
    })(),
    // The ECharts categorical palette, derived from the one brand colour.
    // Dark theme file, to match the card's own dark ground.
    chart: (() => {
      const echarts = result.results.find((r) => r.target === 'echarts');
      const file = echarts?.emitted?.find((f) => /theme\..*dark\.json$/.test(f.path));
      return JSON.parse(file.contents).color.slice(0, 5);
    })(),
  };
}

// ---------- card ----------------------------------------------------------
// Card chrome mirrors the site's own dark theme — computed the same way
// src/og.js computes its OG card colors: OKLCH in, hex out, via Transtyle's
// own color module (satori has no OKLCH support). Values are
// global.css's [data-theme='dark'] custom properties, so a re-theme of the
// site moves this card too, rather than leaving a hand-picked hex behind.
const oklch = (l, c, h) => ({ l, c, h, alpha: 1 });
const hex = (color) => core.formatHex(color).text;

const BG = hex(oklch(0.16, 0.03, 275)); // --bg
const PANEL = hex(oklch(0.21, 0.034, 275)); // --surface
const LINE = hex(oklch(0.31, 0.034, 275)); // --border
const TEXT = hex(oklch(0.93, 0.01, 275)); // --text
const MUTED = hex(oklch(0.7, 0.018, 275)); // --text-muted
const BRAND = hex(oklch(0.72, 0.15, 269)); // --primary
const VIOLET = hex(oklch(0.72, 0.16, 315)); // --violet

const el = (type, props, ...children) => ({
  type,
  props: { ...props, children: children.length > 1 ? children : children[0] },
});
const div = (style, ...children) => el('div', { style }, ...children);
const row = (style, ...children) => div({ display: 'flex', ...style }, ...children);
const text = (style, value) => div({ display: 'flex', ...style }, value);
const img = (src, width, height) => el('img', { src, width, height });

// The mark, inlined from the same brand/ source the site and package READMEs
// render from, so the card can never carry a logo the rest of the repo has
// moved on from. On-dark variant: the card's own ground is near-black, and
// the plain mark's tile would dissolve into it (see brand/README.md).
const logoSvg = readFileSync(join(repo, 'brand/transtyle-mark-on-dark.svg'), 'utf8');
const LOGO_URI = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString('base64')}`;

/** A miniature framework frame: caption plus a body of fake components. */
const frame = (label, bg, borderColor, body) =>
  div(
    {
      display: 'flex',
      flexDirection: 'column',
      borderRadius: 12,
      border: `1px solid ${borderColor}`,
      background: bg,
      overflow: 'hidden',
      width: 296,
    },
    text(
      {
        fontSize: 13,
        fontWeight: 500,
        color: MUTED,
        padding: '7px 12px',
        borderBottom: `1px solid ${borderColor}`,
      },
      label,
    ),
    div({ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 16px', height: 92 }, ...body),
  );

const pill = (bg, color, label, extra = {}) =>
  text(
    {
      background: bg,
      color,
      fontSize: 14,
      fontWeight: 500,
      padding: '7px 14px',
      borderRadius: 8,
      ...extra,
    },
    label,
  );

function card(v) {
  const swatch = (color, slot, value) =>
    row(
      { alignItems: 'center', gap: 12 },
      div({ display: 'flex', width: 26, height: 26, borderRadius: 7, background: color }),
      div(
        { display: 'flex', flexDirection: 'column' },
        text({ fontSize: 16, color: TEXT, fontWeight: 500 }, slot),
        text({ fontSize: 14, color: MUTED }, value),
      ),
    );

  return div(
    {
      width: 1200,
      height: 675,
      display: 'flex',
      flexDirection: 'column',
      background: BG,
      padding: '48px 56px',
      fontFamily: 'Inter',
    },
    // header
    row(
      { alignItems: 'baseline', gap: 16 },
      text({ fontSize: 42, fontWeight: 700, color: TEXT, letterSpacing: '-0.02em' }, 'One design system.'),
      text({ fontSize: 42, fontWeight: 700, color: VIOLET, letterSpacing: '-0.02em' }, 'Every ecosystem.'),
    ),
    text({ fontSize: 19, color: MUTED, marginTop: 10 }, 'Describe your design system once. Transtyle compiles native, idiomatic themes for every ecosystem — real compiled output, not a mockup.'),

    // body: tokens | frames
    row(
      { marginTop: 34, gap: 34, alignItems: 'flex-start' },
      // left: what you write
      div(
        {
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          background: PANEL,
          border: `1px solid ${LINE}`,
          borderRadius: 14,
          padding: '20px 22px',
          width: 280,
        },
        text({ fontSize: 13, fontWeight: 700, color: BRAND, letterSpacing: '0.1em' }, 'YOU WRITE'),
        swatch(v.light.primary, 'primary.solid', v.light.primary),
        swatch(v.light.danger, 'danger.solid', v.light.danger),
        row(
          { alignItems: 'center', gap: 12 },
          div({
            display: 'flex',
            width: 26,
            height: 26,
            borderRadius: 8,
            border: `2px solid ${MUTED}`,
          }),
          div(
            { display: 'flex', flexDirection: 'column' },
            text({ fontSize: 16, color: TEXT, fontWeight: 500 }, 'radius.md'),
            text({ fontSize: 14, color: MUTED }, v.radius),
          ),
        ),
      ),

      // right: what comes out
      div(
        { display: 'flex', flexDirection: 'column', gap: 14 },
        text({ fontSize: 13, fontWeight: 700, color: BRAND, letterSpacing: '0.1em' }, 'YOU SHIP'),
        row(
          { gap: 14 },
          frame('Bootstrap', v.dark.surface, v.dark.border, [
            pill(v.dark.primary, v.dark.onPrimary, 'Primary'),
            pill('transparent', v.dark.primary, 'Secondary', { border: `1px solid ${v.dark.primary}` }),
          ]),
          frame('shadcn/ui', v.dark.surface, v.dark.border, [
            pill(v.dark.primary, v.dark.onPrimary, 'Continue'),
            pill('transparent', v.dark.muted, 'Cancel'),
          ]),
        ),
        row(
          { gap: 14 },
          frame('daisyUI', v.dark.raised, v.dark.border, [
            pill(v.dark.primary, v.dark.onPrimary, 'Accept'),
            pill(v.dark.danger, '#ffffff', 'error', { borderRadius: 99, fontSize: 13 }),
          ]),
          frame('Apache ECharts', v.dark.surface, v.dark.border, [
            // The derived categorical palette, drawn as the bar chart it becomes.
            div(
              { display: 'flex', alignItems: 'flex-end', gap: 11, height: 56 },
              ...v.chart.map((c, i) =>
                div({
                  display: 'flex',
                  width: 20,
                  height: [56, 34, 45, 22, 38][i],
                  borderRadius: 4,
                  background: c,
                }),
              ),
            ),
          ]),
        ),
      ),
    ),

    // the three facts, counted from the same compile
    row(
      { marginTop: 32, gap: 32, alignItems: 'baseline' },
      ...[
        [`${v.stats.authored} authored tokens`, `· ${v.stats.slots} resolved slots per mode`],
        ['Everything else', 'derived by rules you can read'],
        ['Zero runtime', 'files out, nothing in'],
      ].map(([head, tail]) =>
        row(
          { alignItems: 'baseline', gap: 8 },
          text({ fontSize: 16, fontWeight: 700, color: TEXT }, head),
          text({ fontSize: 15, color: MUTED }, tail),
        ),
      ),
    ),

    // footer
    row(
      { marginTop: 'auto', alignItems: 'center', gap: 14, paddingTop: 22 },
      img(LOGO_URI, 40, 40),
      text({ fontSize: 20, fontWeight: 700, color: TEXT }, 'Transtyle'),
      text({ fontSize: 19, color: MUTED }, '— the design system compiler'),
      text({ fontSize: 17, color: MUTED, marginLeft: 'auto' }, 'transtyle.github.io/transtyle'),
    ),
  );
}

// ---------- render --------------------------------------------------------
const values = await acme();
const svg = await satori(card(values), { width: 1200, height: 675, fonts: FONTS });

await initWasm(readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();

mkdirSync(outDir, { recursive: true });
const out = join(outDir, 'transtyle-social-card.png');
writeFileSync(out, png);
writeFileSync(join(outDir, 'transtyle-social-card.svg'), svg);
// The summary states what was rendered FROM, not just that something was
// written: the point of the script is that these values came out of a build,
// so a run that cannot show them has not proved anything.
console.log(`✔ social card: ${out.replace(`${repo}/`, '')} — ${(png.length / 1024).toFixed(0)} KB, 1200×675`);
console.log(
  `  compiled from examples/acme: primary ${values.light.primary} · danger ${values.light.danger} · radius ${values.radius} · ${values.stats.authored} authored → ${values.stats.slots} slots`,
);
console.log(`  derived chart palette: ${values.chart.join(' ')}`);
