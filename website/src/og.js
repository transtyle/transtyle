/**
 * Open Graph card renderer — the image link previews show for a page.
 *
 * Social platforms only accept raster formats (PNG/JPEG), so an SVG card is
 * not enough on its own: satori lays the card out and emits SVG, resvg
 * rasterizes it to PNG. Both are pure JS/wasm, so the same bytes come out on a
 * laptop and in CI — no native binaries, no system fonts, no build-machine
 * variance. Cards are generated at build time by src/pages/og/[slug].png.js.
 *
 * Fonts: `@fontsource/inter` ships static `.woff` alongside its `.woff2`, and
 * satori reads `.woff` directly. The *variable* font the site itself uses is
 * deliberately not used here — satori's opentype fork crashes on a subset
 * variable font's `fvar` table, and even when it doesn't, it renders every
 * weight at the default instance, which would silently flatten the bold title.
 *
 * Colors: satori has no OKLCH support, so every value is converted to hex —
 * by Transtyle's own color module, the same code that compiles the themes this
 * site is about. The OKLCH literals below mirror global.css's dark palette; a
 * change there is a one-line change here, in the same notation, with no hand
 * conversion in between.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { formatHex, contrastRatio } from '@transtyle/core';
import logoSvg from '../../brand/transtyle-mark-on-dark.svg?raw';

const require = createRequire(import.meta.url);
const font = (weight) =>
  readFileSync(require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`));

const FONTS = [
  { name: 'Inter', data: font(400), weight: 400, style: 'normal' },
  { name: 'Inter', data: font(700), weight: 700, style: 'normal' },
];

const oklch = (l, c, h) => ({ l, c, h, alpha: 1 });
const hex = (color) => formatHex(color).text;

// global.css, [data-theme='dark'].
const BG = oklch(0.16, 0.014, 262);
const SURFACE = oklch(0.21, 0.018, 262);
const TEXT = oklch(0.93, 0.008, 260);
const MUTED = oklch(0.7, 0.015, 260);
const BRAND_HUE = 262;

// The dark theme's --primary, and the +34° step to --violet that the site's
// gradients use. An accent hue moves the pair; the relationship is fixed.
const ACCENT_L = 0.72;
const ACCENT_C = 0.15;
const ACCENT_STEP = 34;

/**
 * The accent pair for a hue, contrast-guarded against the card background.
 *
 * The kicker is small text on near-black, so it has to clear WCAG AA on its
 * own terms rather than on the assumption that L=0.72 is bright enough at
 * every hue. If a hue lands short, lightness steps up until it clears — the
 * same "walk until AA clears" shape the derivation engine uses for on-colors.
 */
function accentPair(hue) {
  let l = ACCENT_L;
  while (l < 0.95 && contrastRatio(oklch(l, ACCENT_C, hue), BG) < 4.5) l += 0.02;
  return {
    from: hex(oklch(l, ACCENT_C, hue)),
    to: hex(oklch(l, ACCENT_C + 0.01, (hue + ACCENT_STEP) % 360)),
  };
}

/**
 * The mark, inlined from the same brand/ source the favicon and the site
 * header are rendered from (scripts/gen-brand.mjs), so a card can never carry
 * a logo the rest of the site has moved on from.
 *
 * The on-dark variant specifically: this card's ground is a near-black, and so
 * is the mark's tile, so the plain variant would lose its rounded-square
 * silhouette entirely and leave the glyph floating. It is also the one place
 * the mark is *not* re-hued per card — the accent below moves with the post,
 * the logo does not.
 */
const LOGO_URI = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString('base64')}`;

let wasmReady;
const ensureWasm = () => {
  // initWasm throws if called twice, so the promise is the guard: every card
  // in a build awaits the same initialization.
  wasmReady ??= initWasm(readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
  return wasmReady;
};

const row = (style, children) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children } });
const text = (style, content) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children: content } });

/**
 * @param {{kicker: string, title: string, footer?: string, hue?: number}} card
 * @returns {Promise<Buffer>} a 1200×630 PNG
 */
export async function renderCard({ kicker, title, footer, hue = BRAND_HUE }) {
  // Long titles get a smaller size rather than a fourth line: three lines at
  // 62px is the most this layout holds without crowding the footer.
  const fontSize = title.length > 78 ? 46 : title.length > 46 ? 54 : 62;
  // The footer is one line sharing its row with the domain; a docs page's full
  // description would run off the edge, and satori clips rather than wraps it.
  const line = footer ?? 'One design system. Every ecosystem.';
  const footerText = line.length > 62 ? `${line.slice(0, 61).trimEnd()}…` : line;
  const accent = accentPair(hue);
  // A wash of the accent behind the top-left corner, so the tint reads even at
  // the thumbnail size a timeline renders. Mixed toward the surface, not the
  // accent itself: a saturated corner would fight the title.
  const glow = hex(oklch(0.26, 0.05, hue));

  const card = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: '64px 72px',
        backgroundColor: hex(BG),
        backgroundImage: `radial-gradient(circle at 12% 0%, ${glow} 0%, ${hex(SURFACE)} 28%, ${hex(BG)} 62%)`,
        fontFamily: 'Inter',
        color: hex(TEXT),
      },
      children: [
        row({ alignItems: 'center', gap: 20 }, [
          { type: 'img', props: { src: LOGO_URI, width: 64, height: 64 } },
          text({ fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em' }, 'transtyle'),
          text(
            { marginLeft: 'auto', fontSize: 20, fontWeight: 700, letterSpacing: '0.14em', color: accent.from },
            kicker.toUpperCase(),
          ),
        ]),
        text({ fontSize, fontWeight: 700, lineHeight: 1.14, letterSpacing: '-0.03em' }, title),
        row({ flexDirection: 'column', gap: 22 }, [
          // The brand bar, in this card's accent — the site's headline gradient.
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                width: 240,
                height: 6,
                borderRadius: 3,
                backgroundImage: `linear-gradient(90deg, ${accent.from}, ${accent.to})`,
              },
            },
          },
          row({ alignItems: 'center', gap: 14, fontSize: 24, color: hex(MUTED) }, [
            text({}, footerText),
            // Not a domain: the site moved to a Pages URL nobody would type, and
            // the wordmark above already says the name. The repo is the stable
            // thing to put in a reader's hands.
            text({ marginLeft: 'auto' }, 'github.com/transtyle'),
          ]),
        ]),
      ],
    },
  };

  const svg = await satori(card, { width: 1200, height: 630, fonts: FONTS });
  await ensureWasm();
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng());
}
