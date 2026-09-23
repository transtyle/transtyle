#!/usr/bin/env node
/**
 * The brand mark, and every file derived from it.
 *
 * There is exactly one description of the logo — the geometry and palette
 * constants below — and every asset the repository ships is rendered from it:
 * the two SVG variants in brand/, their PNG rasters, the wordmark lockup, the
 * feed icon, and a favicon for each of the thirty-two example demo projects.
 * Nothing is hand-drawn twice. (The site's own favicons and app icons are the
 * committed files in website/src/brand/, served by @deramond.dev/astro.)
 *
 * That matters more than it looks. A logo is the classic multi-surface asset:
 * one mark ends up as a 16px favicon, a README image, a feed icon and a
 * sidebar heading in Storybook. Kept as separate files, they drift — someone
 * redraws the SVG, the PNGs stay on last year's mark, and the drift is
 * invisible until you see two of them side by side. Here the PNGs cannot
 * disagree with the SVG, because they are the SVG.
 *
 * The mark is one colour: the T-and-slash glyph in the foreground colour, no
 * gradient. Every file here is shown on somebody else's page — GitHub, npm, a
 * feed reader, a demo themed by another design system — so each one carries
 * its own dark field under the glyph rather than trusting the host's
 * background. Two variants exist, and the difference is one hairline:
 *
 *   transtyle-mark.svg          the glyph on its field
 *   transtyle-mark-on-dark.svg  the same, plus a hairline inside the edge
 *
 * On a light page the field reads as a crisp square; on a dark one (GitHub's
 * dark is #0d1117) it dissolves into the background and the glyph is left
 * floating. The hairline gives the silhouette its edge back. It is invisible
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

/** The field under the glyph: the site's background. */
export const FIELD = '#0A0C11';

/** The glyph: the site's foreground. One colour, never a gradient. */
export const INK = '#E6E8EC';

/** The on-dark hairline: the site's line colour. */
const LINE = '#292C33';

/**
 * The glyph on a 32-unit box: the crossbar's left half, its right half sheared
 * into the diagonal, and the stem hanging off the same 45° cut. Bar height,
 * stem width and the cut are one 6.5-unit module, so the T sits on a 4 × 3
 * grid of them (x 3–29, y 6.25–25.75).
 */
export const GLYPH = [
  'M3 6.25H16V12.75H3Z',
  'M16 12.75L22.5 6.25H29V12.75Z',
  'M16 12.75L9.5 19.25V25.75H16Z',
];

/**
 * The same glyph drawn for 16px, on 3-pixel modules, so every edge of a
 * favicon lands on a whole pixel instead of blurring across two.
 */
export const GLYPH_16 = ['M2 4H8V7H2Z', 'M8 7L11 4H14V7Z', 'M8 7L5 10V13H8Z'];

/**
 * @param {{ ring?: boolean }} options
 *   The field extends half a module past the glyph's box on every side (a
 *   38-unit square), which is the mark's clear space.
 * @returns {string} a standalone SVG document
 */
export function mark({ ring = false } = {}) {
  const glyph = GLYPH.map((d) => `  <path d="${d}" fill="${INK}" />`).join('\n');
  const edge = ring
    ? `\n  <rect x="-2.75" y="-2.75" width="37.5" height="37.5" fill="none" stroke="${LINE}" stroke-width="0.5" />`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 38 38" width="400" height="400" role="img" aria-label="Transtyle">
  <title>Transtyle</title>
  <rect x="-3" y="-3" width="38" height="38" fill="${FIELD}" />
${glyph}${edge}
</svg>
`;
}

/** The 16px favicon: the pixel-grid glyph on the field, edge to edge. */
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" role="img" aria-label="Transtyle">
  <title>Transtyle</title>
  <rect width="16" height="16" fill="${FIELD}" />
${GLYPH_16.map((d) => `  <path d="${d}" fill="${INK}" />`).join('\n')}
</svg>
`;

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
 * It carries the field as its own ground rather than sitting on transparency,
 * for the same reason the on-dark variant exists: that sidebar is themed by
 * whichever design system is on show — Acme's is near-white, Cathode's boots
 * black — and no single wordmark colour survives both.
 *
 * The name is set in Chakra Petch 700, uppercase, the site's display face.
 * satori lays it out and resvg rasterizes it, for the same reason as every
 * other raster here: the static font file renders identically on a laptop and
 * in CI, where an SVG `<text>` in a system font would come out different on
 * every machine that opened it.
 */
const LOCKUP = { width: 430, height: 132, scale: 2 };

async function lockup() {
  const { default: satori } = await import('satori');
  const font = readFileSync(require.resolve('@fontsource/chakra-petch/files/chakra-petch-latin-700-normal.woff'));
  const glyph = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${GLYPH.map((d) => `<path d="${d}" fill="${INK}"/>`).join('')}</svg>`;
  const markUri = `data:image/svg+xml;base64,${Buffer.from(glyph).toString('base64')}`;

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          width: '100%',
          height: '100%',
          padding: '0 30px 0 24px',
          backgroundColor: FIELD,
          // The on-dark hairline, one level out: the bar is the field here.
          border: `2px solid ${LINE}`,
        },
        children: [
          { type: 'img', props: { src: markUri, width: 72, height: 72 } },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                fontFamily: 'Chakra Petch',
                fontSize: 46,
                fontWeight: 700,
                letterSpacing: '0.02em',
                color: INK,
              },
              children: 'TRANSTYLE',
            },
          },
        ],
      },
    },
    {
      width: LOCKUP.width,
      height: LOCKUP.height,
      fonts: [{ name: 'Chakra Petch', data: font, weight: 700, style: 'normal' }],
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

const ON_FIELD = mark();
const ON_DARK = mark({ ring: true });

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
  { rel: 'brand/transtyle-mark.svg', svg: ON_FIELD },
  { rel: 'brand/transtyle-mark-on-dark.svg', svg: ON_DARK },
  { rel: 'brand/transtyle-mark-256.png', from: ON_FIELD, size: 256 },
  { rel: 'brand/transtyle-mark-on-dark-256.png', from: ON_DARK, size: 256 },
  { rel: 'brand/transtyle-mark-1024.png', from: ON_FIELD, size: 1024 },
  { rel: 'brand/transtyle-lockup.png', lockup: true },

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
          { rel: `examples/${e.name}/demo/${d.name}/public/favicon.svg`, svg: FAVICON },
          // Storybook alone has a *brand* slot as well as a tab icon: the
          // sidebar heading, which the generated theme fills from the
          // example's `options.brand.image`. On its own field, because that
          // sidebar is themed by the design system on show and Cathode's boots black.
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
