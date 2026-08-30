# Brand assets

The Transtyle mark, and everything rendered from it.

Nothing in this folder is hand-edited. The mark's geometry and palette live in
[`scripts/gen-brand.mjs`](../scripts/gen-brand.mjs), and every file here — plus
the site's favicon and app icons — is generated from that one description:

```bash
npm run gen:brand
```

`npm run check:brand` fails if a committed asset has drifted from a fresh
render, or if a surface that is supposed to carry the mark has stopped doing
so. It runs as part of `npm run check:all` and in CI, so a change to the mark
cannot land on some surfaces and not others.

## The two variants

|                                                   | Use it                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `transtyle-mark.svg` · `transtyle-mark-256.png`   | On light backgrounds, and anywhere the surface is known to be light. |
| `transtyle-mark-on-dark.svg` · `-on-dark-256.png` | On dark backgrounds, and wherever the background is unknown.         |

They differ by one hairline. The tile is `#080A24` — near-black — so on a light
page it reads as a crisp rounded square, but on a dark one (the site's own
background is `#0a0d13`, GitHub's dark is `#0d1117`) the square dissolves and
leaves the glyph floating. The on-dark variant adds a 14%-white ring inside the
tile edge to give the silhouette back.

Because that ring is invisible against a light background, **the on-dark
variant is the safe default when you cannot control the surface** — which is
why it is the one the package READMEs use: npm renders those on both a white
and a black page, from a single `<img>` with no way to swap per theme.

Where both variants can be offered, offer both. The root README does this with
a `<picture>`, which GitHub honours:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/transtyle-mark-on-dark-256.png" />
  <img src="brand/transtyle-mark-256.png" alt="" width="112" height="112" />
</picture>
```

## Files

| File                             | What it is                                                           |
| -------------------------------- | -------------------------------------------------------------------- |
| `transtyle-mark.svg`             | The mark. The source of truth for every raster below.                |
| `transtyle-mark-on-dark.svg`     | The same, with the ring.                                             |
| `transtyle-mark-256.png`         | For surfaces that will not take an SVG (GitHub proxies, npm, feeds). |
| `transtyle-mark-on-dark-256.png` | Same, on-dark.                                                       |
| `transtyle-mark-1024.png`        | Slides, talks, a GitHub repo social-preview upload.                  |
| `transtyle-lockup.png`           | The mark plus the wordmark, for wide slots. See below.               |

The site's `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`,
`icon-192.png`, `icon-512.png` and `feed-icon-144.png` come out of the same
generator into `website/public/`, and so does a `public/favicon.svg` for each
of the thirty-two example demo projects.

Two of those shapes are deliberate. The Apple and PWA icons are **full-bleed
squares**, because both platforms apply their own rounded mask and masking an
already-rounded tile clips its corners twice. The feed icon is **144px**,
because that is the widest RSS 2.0 allows for a channel `<image>`.

The demo copies look like the drift this generator exists to prevent, and are
not: they are generated outputs, so `gen:brand` rewrites all thirty-two and
`check:brand` compares every byte. What the duplication buys is zero
configuration — `public/` is already what Vite serves at `/`, what Angular's
assets glob points at, and what Storybook takes as a `staticDirs` entry, so one
`<link rel="icon" href="/favicon.svg">` works across all three toolchains in
both dev and build. The obvious alternative — one shared file behind a relative
path — was tried and rejected: Vite rewrites `link[href]` into a hashed asset at
build time but leaves it alone in dev, so the icon resolved in `npm run build`
and 404'd in `npm run dev`, which is the only way anyone opens a demo.

## The lockup

`transtyle-lockup.png` is the mark with `transtyle` beside it, on a bar of the
mark's own tile colour with the same 14%-white ring. Roughly 3.3:1, so it fits
slots that want something wider than a square.

It exists because Storybook's sidebar heading is one of those. A square mark
there renders at 100×100 and swallows the header; the lockup lands at a
well-proportioned 150×46. It carries its own dark ground rather than sitting on
transparency for the same reason the on-dark variant does — that sidebar is
themed by whichever design system is on show, and Cathode's boots black while
Acme's is near-white. No single wordmark colour survives both.

It is a PNG, and rendered with satori rather than drawn as SVG `<text>`,
because the bundled static Inter comes out identical on a laptop and in CI
while a system font stack would render differently on every machine that opened
it.

## Colors

| Token         | Value     | Where                                                                 |
| ------------- | --------- | --------------------------------------------------------------------- |
| Tile          | `#080A24` | The mark's ground; the site's dark `theme-color`; the OG card ground. |
| Gradient from | `#D77BFF` | Top-left of the glyph.                                                |
| Gradient mid  | `#C77CFF` | 45% along.                                                            |
| Gradient to   | `#6B8DFF` | Bottom-right of the glyph.                                            |

The glyph gradient is **fixed**. The site and the Open Graph cards re-hue their
accents per page and per post; the mark never moves with them. It is the logo,
not the accent.

The site's brand pair, however, _is_ the mark's. Read back in OKLCH the two
ends of the gradient are hue **269** and hue **315**, and that is what
`global.css` sets `--primary` and `--violet` to — so the headline sweep and the
primary button run the same 46° arc as the logo above them, in the same
direction. `og.js` and `blog.js` hold the same two numbers for the social cards
and the per-post accent ladder, and `check:brand` recomputes all three from the
gradient rather than trusting them.

Only the hues were taken. Lightness and chroma stay where they were, because
those are what the contrast holds on: the move cost at most 0.1 of a contrast
point anywhere, and every pair still clears AA. The neutrals stay at hue
260/262 — retinting every surface toward the tile is a larger decision, and it
would work against the on-dark ring.

## Where the mark appears

- **Site header** — inlined in `website/src/layouts/Base.astro` from
  `transtyle-mark.svg`, with the ring applied in CSS on the dark theme (a
  1-unit stroke in a 400-unit viewBox would be a fifth of a pixel at 24px;
  a `box-shadow` stays one crisp pixel at any size).
- **Favicon, apple-touch icon, PWA icons** — `website/public/`, linked from
  `Base.astro` and listed in `website/src/pages/site.webmanifest.js`.
- **Open Graph cards** — the badge on every generated card
  (`website/src/og.js`), on-dark variant.
- **The RSS feed** — the channel `<image>`, on-dark and 144px per the spec.
- **All thirty-two example demos** — a generated `public/favicon.svg` each,
  linked from `index.html` (Vite, Angular) or served via `staticDirs`
  (Storybook).
- **The four Storybook demos' sidebars** — the lockup, as `public/logo.png`,
  reaching the chrome through each example's
  `targets.storybook.options.brand` rather than by editing `manager.ts`: the
  storybook exporter already carries `brand.title`/`url`/`image` into the
  generated theme, and nothing exercised it until now.
- **Root README** — `<picture>`, both variants.
- **All twelve package READMEs** — on-dark variant, by absolute URL, because
  npm renders them outside the repository.

A GitHub repository's social preview is uploaded in **Settings → General →
Social preview**, not committed; `transtyle-mark-1024.png` or a downloaded
`/og/default.png` both work there.
