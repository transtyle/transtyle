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

The site's `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`,
`icon-192.png` and `icon-512.png` come out of the same generator into
`website/public/`. The Apple and PWA icons are deliberately **full-bleed
squares**: both platforms apply their own rounded mask, and masking an
already-rounded tile clips its corners twice.

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

## Where the mark appears

- **Site header** — inlined in `website/src/layouts/Base.astro` from
  `transtyle-mark.svg`, with the ring applied in CSS on the dark theme (a
  1-unit stroke in a 400-unit viewBox would be a fifth of a pixel at 24px;
  a `box-shadow` stays one crisp pixel at any size).
- **Favicon, apple-touch icon, PWA icons** — `website/public/`, linked from
  `Base.astro` and listed in `website/src/pages/site.webmanifest.js`.
- **Open Graph cards** — the badge on every generated card
  (`website/src/og.js`), on-dark variant.
- **Root README** — `<picture>`, both variants.
- **All twelve package READMEs** — on-dark variant, by absolute URL, because
  npm renders them outside the repository.

A GitHub repository's social preview is uploaded in **Settings → General →
Social preview**, not committed; `transtyle-mark-1024.png` or a downloaded
`/og/default.png` both work there.
