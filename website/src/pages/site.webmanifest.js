/**
 * The web app manifest — what a browser reads when someone installs the site
 * or pins it to a home screen: the name to show, the icons to use, and the
 * colours to paint the shell while the page loads.
 *
 * An endpoint rather than a static file in public/, for the same reason every
 * link on this site goes through withBase(): the site is served from a GitHub
 * Pages *project* path (/transtyle/), so a hand-written "/icon-192.png" in a
 * checked-in manifest resolves to a 404 in production while working perfectly
 * in `astro dev` — and unlike an HTML link, nothing would ever show a broken
 * image, the install prompt would just quietly stop offering an icon.
 * scripts/check-site-links.mjs does not scan .webmanifest, so this file is the
 * guard: the base can only come from Astro's own view of it.
 *
 * The icons are generated from the one brand mark (scripts/gen-brand.mjs) and
 * are deliberately full-bleed squares — Android and iOS apply their own mask,
 * and masking an already-rounded tile clips its corners twice.
 */
import { withBase } from '../url.js';

export async function GET() {
  const manifest = {
    name: 'Transtyle',
    short_name: 'Transtyle',
    description:
      'A design system compiler: describe your design system once, compile native themes for every ecosystem.',
    start_url: withBase('/'),
    scope: withBase('/'),
    display: 'standalone',
    // The mark's own tile, so the splash screen is the logo's background
    // rather than a white flash before it.
    background_color: '#080A24',
    theme_color: '#080A24',
    icons: [
      { src: withBase('/icon-192.png'), sizes: '192x192', type: 'image/png' },
      { src: withBase('/icon-512.png'), sizes: '512x512', type: 'image/png' },
      { src: withBase('/favicon.svg'), sizes: 'any', type: 'image/svg+xml' },
    ],
  };

  return new Response(JSON.stringify(manifest, null, 2) + '\n', {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
}
