#!/usr/bin/env node
/**
 * The brand mark, and every file derived from it.
 *
 * There is exactly one description of the logo — the geometry and palette
 * constants below — and every asset the repository ships is rendered from it:
 * the two SVG variants in brand/, their PNG rasters, the wordmark lockup, the
 * site's favicon, apple-touch, PWA and feed icons, and a favicon for each of
 * the thirty-two example demo projects. Nothing is hand-drawn twice.
 *
 * That matters more than it looks. A logo is the classic multi-surface asset:
 * one mark ends up as a 16px favicon, a 180px iOS tile, a 512px install icon,
 * a README image and a 64px badge on an Open Graph card. Kept as six separate
 * files, they drift — someone tweaks the SVG, the PNGs stay on last year's
 * gradient, and the drift is invisible until you see two of them side by side.
 * Here the PNGs cannot disagree with the SVG, because they are the SVG.
 *
 * Two variants exist, and the difference is one hairline:
 *
 *   transtyle-mark.svg          the mark as designed
 *   transtyle-mark-on-dark.svg  the same, plus a 14%-white inner ring
 *
 * The tile is #080A24 — near-black. On a light page that reads as a crisp
 * rounded square; on a dark page (the site's own --bg is #0a0d13, GitHub's
 * dark is #0d1117) the square dissolves into the background and the glyph is
 * left floating. The ring gives the silhouette its edge back. It is invisible
 * against a light background, so the on-dark variant is the safe choice
 * anywhere the background is unknown — npm renders package READMEs on both.
 *
 * Rasterization is @resvg/resvg-wasm: pure wasm, so a laptop and CI produce
 * the same bytes, which is what lets scripts/check-brand.mjs treat a stale
 * PNG as an error rather than noise.
 *
 * Run: node scripts/gen-brand.mjs   (also: npm run gen:brand).
 * scripts/check-brand.mjs fails if the committed files drift from this output.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initWasm, Resvg } from '@resvg/resvg-wasm';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// The mark
// ---------------------------------------------------------------------------

/** The tile. Also the site's dark `theme-color` and the OG card's ground. */
export const TILE = '#080A24';

/**
 * The glyph gradient, magenta → blue across the mark's own diagonal.
 *
 * Exported because it is also the site's brand pair: read back in OKLCH these
 * two ends are hue 315 and hue 269, which is exactly what global.css sets
 * `--violet` and `--primary` to. check-brand.mjs recomputes them from here and
 * fails if the stylesheet, the OG renderer or the blog's accent ladder drifts.
 */
export const GRADIENT = [
  { offset: '0', color: '#D77BFF' },
  { offset: '0.45', color: '#C77CFF' },
  { offset: '1', color: '#6B8DFF' },
];

/** Everything is authored on a 400×400 grid with a 24-unit corner radius. */
const SIZE = 400;
const RADIUS = 24;

/** The rounded tile, as a path (a `rect` would not survive being inset below). */
const TILE_PATH =
  'M376 0H24C10.7452 0 0 10.7452 0 24V376C0 389.255 10.7452 400 24 400H376C389.255 400 400 389.255 400 376V24C400 10.7452 389.255 0 376 0Z';

/**
 * The three blocks of the T: the crossbar's left half, its right half sheared
 * into the diagonal, and the stem hanging off the same 45° cut.
 */
const GLYPH = [
  'M58 121H200V194H58V121Z',
  'M200 194L272 121H342V194H200Z',
  'M200 194L129 265V339H200V194Z',
];

/** The on-dark ring, in user units — see the header note on why it exists. */
const RING = { color: '#FFFFFF', opacity: '0.14', width: 6 };

/**
 * @param {{ id: string, ring?: boolean, square?: boolean }} options
 *   `id` namespaces the gradient, so two marks can be inlined on one page.
 *   `square` drops the rounded corners for full-bleed tiles (iOS and Android
 *   apply their own mask and would otherwise round an already-rounded icon).
 * @returns {string} a standalone SVG document
 */
export function mark({ id, ring = false, square = false }) {
  const stops = GRADIENT.map(
    (s) => `      <stop offset="${s.offset}" stop-color="${s.color}" />`,
  ).join('\n');
  const tile = square
    ? `  <path d="M0 0H${SIZE}V${SIZE}H0V0Z" fill="${TILE}" />`
    : `  <path d="${TILE_PATH}" fill="${TILE}" />`;
  const glyph = GLYPH.map((d) => `  <path d="${d}" fill="url(#${id})" />`).join('\n');
  // Inset by half the stroke width so the ring sits *inside* the tile edge
  // rather than straddling it, which would leave a soft half-pixel fringe.
  const inset = RING.width / 2;
  const edge = ring
    ? `\n  <rect x="${inset}" y="${inset}" width="${SIZE - RING.width}" height="${SIZE - RING.width}" rx="${square ? 0 : RADIUS - inset}" fill="none" stroke="${RING.color}" stroke-opacity="${RING.opacity}" stroke-width="${RING.width}" />`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" role="img" aria-label="Transtyle">
  <title>Transtyle</title>
  <defs>
    <linearGradient id="${id}" x1="58" y1="110" x2="342" y2="180" gradientUnits="userSpaceOnUse">
${stops}
    </linearGradient>
  </defs>
${tile}
${glyph}${edge}
</svg>
`;
}

// ---------------------------------------------------------------------------
// Rasterization
// ---------------------------------------------------------------------------

let wasmReady;
const ensureWasm = () => {
  // initWasm throws if called twice, so the promise is the guard.
  wasmReady ??= initWasm(readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
  return wasmReady;
};

/** @returns {Promise<Buffer>} `svg` rasterized to a `size`×`size` PNG. */
export async function raster(svg, size) {
  await ensureWasm();
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng());
}

// ---------------------------------------------------------------------------
// The lockup
// ---------------------------------------------------------------------------

/**
 * The mark with the wordmark beside it, for slots that want something wider
 * than a square — Storybook's sidebar heading is the one in this repo, and it
 * is why this exists: a square mark there renders at 100×100 and swallows the
 * header, while a 4:1 lockup lands at a well-proportioned 150×38.
 *
 * It carries the tile as its own ground rather than sitting on transparency,
 * for the same reason the on-dark variant exists: that sidebar is themed by
 * whichever design system is on show — Acme's is near-white, Cathode's boots
 * black — and no single wordmark colour survives both. Extending the mark's
 * own ground under the word is the honest way to be legible on either.
 *
 * satori lays it out and resvg rasterizes it, exactly as the Open Graph cards
 * do, and for the same reason: the *static* Inter that `@fontsource/inter`
 * ships alongside its variable build renders identically on a laptop and in
 * CI, where an SVG `<text>` in a system font stack would come out different on
 * every machine that opened it.
 */
const LOCKUP = { width: 430, height: 132, scale: 2 };

async function lockup() {
  const { default: satori } = await import('satori');
  const font = (weight) =>
    readFileSync(require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`));
  // The plain mark, not the on-dark one: inside the bar the tile IS the bar,
  // so the ring would draw a stray box around the glyph. The bar wears the ring
  // instead — same job, one level out.
  const markUri = `data:image/svg+xml;base64,${Buffer.from(mark({ id: 'transtyle-mark' })).toString('base64')}`;

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          width: '100%',
          height: '100%',
          padding: '0 40px 0 18px',
          backgroundColor: TILE,
          // The mark's own corner, scaled: 24 on 400 is 6%, and 6% of this
          // bar's height keeps the two shapes visibly the same family.
          borderRadius: Math.round(LOCKUP.height * (RADIUS / SIZE)),
          // The on-dark ring, at the mark's own proportion (6 units on 400).
          border: `2px solid rgba(255, 255, 255, ${RING.opacity})`,
        },
        children: [
          { type: 'img', props: { src: markUri, width: 96, height: 96 } },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                fontFamily: 'Inter',
                fontSize: 58,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: '#FFFFFF',
              },
              children: 'transtyle',
            },
          },
        ],
      },
    },
    {
      width: LOCKUP.width,
      height: LOCKUP.height,
      fonts: [
        { name: 'Inter', data: font(400), weight: 400, style: 'normal' },
        { name: 'Inter', data: font(700), weight: 700, style: 'normal' },
      ],
    },
  );

  await ensureWasm();
  return Buffer.from(
    new Resvg(svg, {
      fitTo: { mode: 'width', value: LOCKUP.width * LOCKUP.scale },
    })
      .render()
      .asPng(),
  );
}

// ---------------------------------------------------------------------------
// The outputs
// ---------------------------------------------------------------------------

const ROUNDED = mark({ id: 'transtyle-mark' });
const ON_DARK = mark({ id: 'transtyle-mark', ring: true });
const FULL_BLEED = mark({ id: 'transtyle-mark', square: true });

/**
 * Every generated file, in one list — this is what `npm run gen:brand` writes
 * and what scripts/check-brand.mjs compares the working tree against.
 *
 * `svg` entries carry text; `png` entries carry the source document and the
 * pixel size to render it at.
 */
export const OUTPUTS = [
  // The brand folder: the mark itself, plus rasters for surfaces that cannot
  // be trusted with an SVG (npm strips very little, but GitHub proxies images
  // and some feed readers refuse SVG outright).
  { rel: 'brand/transtyle-mark.svg', svg: ROUNDED },
  { rel: 'brand/transtyle-mark-on-dark.svg', svg: ON_DARK },
  { rel: 'brand/transtyle-mark-256.png', from: ROUNDED, size: 256 },
  { rel: 'brand/transtyle-mark-on-dark-256.png', from: ON_DARK, size: 256 },
  { rel: 'brand/transtyle-mark-1024.png', from: ROUNDED, size: 1024 },
  { rel: 'brand/transtyle-lockup.png', lockup: true },

  // The site. favicon.svg is what every modern browser actually uses; the PNG
  // is the fallback for the ones that don't, and for anything that scrapes a
  // tab icon. The Apple and PWA icons are full-bleed because both platforms
  // mask the icon themselves.
  { rel: 'website/public/favicon.svg', svg: ROUNDED },
  { rel: 'website/public/favicon-32.png', from: ROUNDED, size: 32 },
  { rel: 'website/public/apple-touch-icon.png', from: FULL_BLEED, size: 180 },
  { rel: 'website/public/icon-192.png', from: FULL_BLEED, size: 192 },
  { rel: 'website/public/icon-512.png', from: FULL_BLEED, size: 512 },

  // The RSS channel image. 144px because that is the widest RSS 2.0 permits
  // for <image> (default 88, max width 144, max height 400), and on-dark
  // because a feed reader's chrome is somebody else's background — usually
  // dark, never ours to know.
  { rel: 'website/public/feed-icon-144.png', from: ON_DARK, size: 144 },

  ...demoFavicons(),
];

/**
 * A `public/favicon.svg` for every example demo project.
 *
 * The demos are thirty-two separate applications — six Vite ones, an Angular
 * one and a Storybook per example — and every one of them ran with the
 * browser's default blank page icon. A tab that says "· transtyle demo"
 * deserves the mark next to it.
 *
 * A copy per project rather than one shared file, which sounds like exactly
 * the drift this script exists to prevent — except these copies are OUTPUTS,
 * so they cannot drift: `gen:brand` rewrites all of them and `check:brand`
 * compares every byte. What that buys is zero configuration. `public/` is
 * already what Vite serves at `/` (in dev *and* in the build), what Angular's
 * assets glob points at, and what Storybook takes as a `staticDirs` entry, so
 * one `<link rel="icon" href="/favicon.svg">` works identically across all
 * three toolchains, in dev and in a production build.
 *
 * The alternative — one shared file referenced by a relative path — was tried
 * and rejected: Vite rewrites `link[href]` into a hashed asset at build time
 * but leaves it untouched in dev, so the icon resolved in `npm run build` and
 * 404'd in `npm run dev`, which is the only way anyone actually opens a demo.
 *
 * Derived by scanning rather than listed, so a new example or a new target
 * gets its favicon — and its check — without anyone remembering to add it.
 */
function demoFavicons() {
  const examplesDir = join(root, 'examples');
  return readdirSync(examplesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(examplesDir, e.name, 'transtyle.config.json')))
    .flatMap((e) => {
      const demoDir = join(examplesDir, e.name, 'demo');
      if (!existsSync(demoDir)) return [];
      return readdirSync(demoDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .flatMap((d) => [
          { rel: `examples/${e.name}/demo/${d.name}/public/favicon.svg`, svg: ROUNDED },
          // Storybook alone has a *brand* slot as well as a tab icon: the
          // sidebar heading, which the generated theme fills from the
          // example's `options.brand.image`. On-dark, because that sidebar is
          // themed by the design system on show and Cathode's boots black.
          ...(d.name === 'storybook'
            ? [{ rel: `examples/${e.name}/demo/${d.name}/public/logo.png`, lockup: true }]
            : []),
        ]);
    });
}

// The lockup costs a satori layout plus a rasterization, and two outputs want
// the same bytes; render it once per process.
let lockupBytes;

/** @returns {Promise<Buffer>} the exact bytes `rel` should contain. */
export async function render(output) {
  if (output.lockup) return (lockupBytes ??= await lockup());
  return output.svg !== undefined
    ? Buffer.from(output.svg, 'utf8')
    : await raster(output.from, output.size);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const output of OUTPUTS) {
    const abs = join(root, output.rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, await render(output));
    console.log(`  wrote ${output.rel}`);
  }
  console.log(`✔ brand: ${OUTPUTS.length} files rendered from one mark`);
}
