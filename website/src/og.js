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
 * Colours are the site's own dark-theme tokens, converted from OKLCH to hex
 * with Transtyle's own color module (satori has no OKLCH support). If
 * global.css's dark palette changes, these follow it by hand.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';

const require = createRequire(import.meta.url);
const font = (weight) =>
  readFileSync(require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`));

const FONTS = [
  { name: 'Inter', data: font(400), weight: 400, style: 'normal' },
  { name: 'Inter', data: font(700), weight: 700, style: 'normal' },
];

// oklch(0.16 0.014 262) etc. — see global.css [data-theme='dark'].
const BG = '#0a0d13';
const SURFACE = '#141821';
const TEXT = '#e5e8ed';
const MUTED = '#999fa8';
const PRIMARY = '#6fa2ff';
const VIOLET = '#ae8dfc';

/** The wordmark, as the header's own logo — embedded rather than redrawn. */
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${PRIMARY}"/><stop offset="1" stop-color="${VIOLET}"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#lg)"/><path d="M18 24h28M32 24v22" stroke="#fff" stroke-width="6" stroke-linecap="round" fill="none"/></svg>`;
const LOGO_URI = `data:image/svg+xml;base64,${Buffer.from(LOGO).toString('base64')}`;

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
 * @param {{kicker: string, title: string, footer?: string}} card
 * @returns {Promise<Buffer>} a 1200×630 PNG
 */
export async function renderCard({ kicker, title, footer }) {
  // Long titles get a smaller size rather than a fourth line: three lines at
  // 62px is the most this layout holds without crowding the footer.
  const fontSize = title.length > 78 ? 46 : title.length > 46 ? 54 : 62;
  // The footer is one line sharing its row with the domain; a docs page's full
  // description would run off the edge, and satori clips rather than wraps it.
  const line = footer ?? 'One design system. Every ecosystem.';
  const footerText = line.length > 62 ? `${line.slice(0, 61).trimEnd()}…` : line;

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
        backgroundColor: BG,
        backgroundImage: `radial-gradient(circle at 12% 0%, ${SURFACE} 0%, ${BG} 55%)`,
        fontFamily: 'Inter',
        color: TEXT,
      },
      children: [
        row({ alignItems: 'center', gap: 20 }, [
          { type: 'img', props: { src: LOGO_URI, width: 64, height: 64 } },
          text({ fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em' }, 'transtyle'),
          text(
            {
              marginLeft: 'auto',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: PRIMARY,
            },
            kicker.toUpperCase(),
          ),
        ]),
        text({ fontSize, fontWeight: 700, lineHeight: 1.14, letterSpacing: '-0.03em' }, title),
        row({ flexDirection: 'column', gap: 22 }, [
          // The brand bar: the same primary→violet gradient as the site's headline.
          {
            type: 'div',
            props: { style: { display: 'flex', width: 240, height: 6, borderRadius: 3, backgroundImage: `linear-gradient(90deg, ${PRIMARY}, ${VIOLET})` } },
          },
          row({ alignItems: 'center', gap: 14, fontSize: 24, color: MUTED }, [
            text({}, footerText),
            text({ marginLeft: 'auto' }, 'transtyle.dev'),
          ]),
        ]),
      ],
    },
  };

  const svg = await satori(card, { width: 1200, height: 630, fonts: FONTS });
  await ensureWasm();
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng());
}
