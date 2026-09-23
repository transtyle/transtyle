# Brand assets

The Transtyle mark, and everything rendered from it.

Nothing in this folder is hand-edited. The mark's geometry and palette live in
[`scripts/gen-brand.mjs`](../scripts/gen-brand.mjs), and every file here — plus
the feed icon and a favicon for each of the thirty-two example demo projects — is
generated from that one description:

```bash
npm run gen:brand
```

`npm run check:brand` fails if a committed asset has drifted from a fresh
render, if a surface that is supposed to carry the mark has stopped doing so,
or if the site's own copy of the mark no longer draws the same glyph. It runs
as part of `npm run check:all` and in CI, so a change to the mark cannot land on
some surfaces and not others.

## The mark

The T-and-slash glyph in one colour: the crossbar's left half, its right half
sheared into a 45° cut, and the stem hanging off the same cut. Bar height, stem
width and the cut are one module, so the glyph sits on a 4 × 3 grid of them. No
gradient, no rounded tile: the glyph is the foreground colour, and the ground
under it is whatever surface it is on — or, in every file here, a field of its
own.

## The two variants

|                                                   | Use it                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `transtyle-mark.svg` · `transtyle-mark-256.png`   | On light backgrounds, and anywhere the surface is known to be light. |
| `transtyle-mark-on-dark.svg` · `-on-dark-256.png` | On dark backgrounds, and wherever the background is unknown.         |

Both carry their own dark field, because every place they are shown is somebody
else's page — GitHub, npm, a feed reader. They differ by one hairline. On a
light page the field reads as a crisp square; on a dark one (GitHub's dark is
`#0d1117`) it dissolves and leaves the glyph floating. The on-dark variant adds
a hairline inside the edge to give the silhouette back.

Because that hairline is invisible against a light background, **the on-dark
variant is the safe default when you cannot control the surface** — which is
why it is the one the package READMEs use: npm renders those on both a white
and a black page, from a single `<img>` with no way to swap per theme.

## Files

| File                             | What it is                                                           |
| -------------------------------- | -------------------------------------------------------------------- |
| `transtyle-mark.svg`             | The mark on its field. The source of truth for every raster below.   |
| `transtyle-mark-on-dark.svg`     | The same, with the hairline.                                         |
| `transtyle-mark-256.png`         | For surfaces that will not take an SVG (GitHub proxies, npm, feeds). |
| `transtyle-mark-on-dark-256.png` | Same, on-dark.                                                       |
| `transtyle-mark-1024.png`        | Slides and talks.                                                    |
| `transtyle-lockup.png`           | The mark plus the name, for wide slots. See below.                   |

Out of the same generator: `website/public/feed-icon-144.png` (144px, the widest
RSS 2.0 allows for a channel `<image>`, on-dark because a feed reader's chrome
is never ours to know), and a `public/favicon.svg` for every example demo
project — drawn on a 16-pixel grid so each edge lands on a whole pixel.

The demo copies look like the drift this generator exists to prevent, and are
not: they are generated outputs, so `gen:brand` rewrites all thirty-two and
`check:brand` compares every byte. What the duplication buys is zero
configuration — `public/` is already what Vite serves at `/`, what Angular's
assets glob points at, and what Storybook takes as a `staticDirs` entry, so one
`<link rel="icon" href="favicon.svg">` works across all three toolchains in
both dev and build.

## The site and the README

The site's mark, favicons, app icons and Open Graph artwork are committed files
in [`website/src/brand/`](../website/src/brand/), named once in
`website/astro.config.mjs` and served by
[`@deramond.dev/astro`](https://www.npmjs.com/package/@deramond.dev/astro),
which also draws the header, the docs shell and the Open Graph cards. The site
mark is the glyph alone in `currentColor`, so it takes the header's colour;
`check:brand` holds its geometry, and the favicon's, to the generator's.

The README opens with [`.github/header.svg`](../.github/header.svg) (and a PNG
for hosts that refuse SVG): the name, the one-line description and the same
artwork as the Open Graph cards.

## The lockup

`transtyle-lockup.png` is the mark with the name beside it, in the site's
display face, on the same field with the same hairline. Roughly 3.3:1, so it
fits slots that want something wider than a square.

It exists because Storybook's sidebar heading is one of those. A square mark
there renders at 100×100 and swallows the header; the lockup lands at a
well-proportioned 150×46. It carries its own dark ground rather than sitting on
transparency for the same reason the on-dark variant does — that sidebar is
themed by whichever design system is on show, and Cathode's boots black while
Acme's is near-white.

It is a PNG, and rendered with satori rather than drawn as SVG `<text>`,
because the bundled static font comes out identical on a laptop and in CI while
a system font stack would render differently on every machine that opened it.

## Colors

| Role  | Value     | Where                                                     |
| ----- | --------- | --------------------------------------------------------- |
| Field | `#0A0C11` | The ground of every file here; the site's background.     |
| Ink   | `#E6E8EC` | The glyph; the site's foreground.                         |
| Line  | `#292C33` | The on-dark hairline and the lockup's edge; site borders. |

The mark is never drawn in the accent colour and never in a gradient. On the
site these three are design tokens from `@deramond.dev/tokens`; the files here
write them out because an image carries its colours with it.
