#!/usr/bin/env node
/**
 * Ground-truth check for the brand mark, in the shape check-schemas.mjs uses:
 * one generator owns the artifact, and this proves the committed copies are
 * what that generator currently produces — and that every surface meant to
 * carry the mark still does.
 *
 * A logo is the textbook multi-surface asset. One mark ends up as a 16px
 * favicon, a 180px iOS tile, a 512px install icon, two README images and a
 * 64px badge on every Open Graph card. Left to hand-maintenance, a redraw
 * lands on three of those and the rest quietly keep shipping last year's logo
 * to the surfaces nobody looks at — npm package pages, an install prompt, a
 * link preview in someone else's Slack.
 *
 * Six assertions:
 *
 *  1. Drift — every file in gen-brand's OUTPUTS matches a fresh render, byte
 *     for byte. Rasterization is pure wasm, so this is a real equality, not an
 *     approximate one.
 *  2. Consumption — the surfaces that are supposed to show the mark reference
 *     it: the site head, the manifest, the OG renderer, the feed, the root
 *     README, and every publishable package README.
 *  3. No dangling reference — nothing in the tree points at a brand/ file that
 *     does not exist, which is how a rename silently breaks a README image.
 *  4. Absolute URLs off-repo — package READMEs are rendered by npm, outside
 *     the repository, so their logo must be an absolute URL rather than a
 *     relative path that only resolves on GitHub.
 *  5. Palette — the site's brand hues ARE the mark's. `--primary` and
 *     `--violet` are the two ends of the logo's gradient read back in OKLCH,
 *     and og.js and blog.js each hold their own copy of the same number. All
 *     three are recomputed here from the gradient rather than trusted, because
 *     "the accent no longer matches the logo" is invisible in a diff and
 *     obvious on the page.
 *  6. Demos — every example demo project carries the favicon. There are
 *     thirty-two of them across three toolchains, which is exactly the kind of
 *     set where a new one gets added and quietly skipped.
 *
 * Run: node scripts/check-brand.mjs (also: npm run check:brand; part of
 * check:all).
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseColor } from '../packages/core/src/color.js';
import { GRADIENT, OUTPUTS, render } from './gen-brand.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const errors = [];
const fail = (m) => errors.push(m);

// 1. drift
for (const output of OUTPUTS) {
  const abs = join(root, output.rel);
  if (!existsSync(abs)) {
    fail(`${output.rel} missing — run npm run gen:brand`);
    continue;
  }
  const expected = await render(output);
  if (!readFileSync(abs).equals(expected)) {
    fail(`${output.rel} is stale — run npm run gen:brand and commit`);
  }
}

// 2. consumption — each surface, and the asset it must name.
const RAW = 'https://raw.githubusercontent.com/transtyle/transtyle/main/brand';
const SURFACES = [
  ['website/src/layouts/Base.astro', 'brand/transtyle-mark.svg?raw', 'the header mark'],
  ['website/src/layouts/Base.astro', "withBase('/favicon.svg')", 'the SVG favicon'],
  ['website/src/layouts/Base.astro', "withBase('/favicon-32.png')", 'the PNG favicon fallback'],
  ['website/src/layouts/Base.astro', "withBase('/apple-touch-icon.png')", 'the iOS home-screen icon'],
  ['website/src/layouts/Base.astro', "withBase('/site.webmanifest')", 'the web app manifest'],
  ['website/src/pages/site.webmanifest.js', "withBase('/icon-192.png')", 'the 192px install icon'],
  ['website/src/pages/site.webmanifest.js', "withBase('/icon-512.png')", 'the 512px install icon'],
  ['website/src/og.js', 'brand/transtyle-mark-on-dark.svg?raw', 'the Open Graph card badge'],
  ['website/src/pages/blog/rss.xml.js', "withBase('/feed-icon-144.png')", 'the RSS channel image'],
  ['README.md', 'brand/transtyle-mark-256.png', 'the README logo (light)'],
  ['README.md', 'brand/transtyle-mark-on-dark-256.png', 'the README logo (dark)'],
];
for (const [file, needle, what] of SURFACES) {
  if (!read(file).includes(needle)) fail(`${file} no longer references ${needle} — ${what}`);
}

// Every package npm will render a page for carries the mark, by absolute URL:
// a relative path resolves on GitHub and 404s on npmjs.com.
const pkgDir = join(root, 'packages');
let packages = 0;
for (const d of readdirSync(pkgDir)) {
  const manifest = join(pkgDir, d, 'package.json');
  if (!existsSync(manifest)) continue;
  if (JSON.parse(readFileSync(manifest, 'utf8')).private) continue;
  packages++;
  const rel = `packages/${d}/README.md`;
  if (!existsSync(join(root, rel))) continue; // check-package-manifests owns "README exists"
  const text = read(rel);
  if (!text.includes('brand/transtyle-mark')) {
    fail(`${rel} has no brand mark — npm renders this as the package page`);
  } else if (!text.includes(`${RAW}/transtyle-mark-on-dark-256.png`)) {
    fail(
      `${rel} must use the absolute ${RAW}/… URL and the on-dark variant: npm renders package READMEs outside the repo, on both a light and a dark page`,
    );
  }
}

// 3. no dangling brand/ reference anywhere in the tracked tree
const TEXT_SKIP = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2']);
const tracked = execSync('git ls-files -z', { cwd: root, maxBuffer: 64 * 1024 * 1024 })
  .toString('utf8')
  .split('\0')
  .filter(Boolean);
const dangling = new Set();
for (const file of tracked) {
  if (TEXT_SKIP.has(extname(file))) continue;
  let text;
  try {
    text = read(file);
  } catch {
    continue;
  }
  // Only references that name a file — an extension is what separates a real
  // link from prose or a `startsWith`-style prefix used by a check.
  for (const [, ref] of text.matchAll(/\bbrand\/(transtyle-[\w-]+\.(?:svg|png|md))/g)) {
    if (!existsSync(join(root, 'brand', ref))) dangling.add(`${file}: brand/${ref} does not exist`);
  }
}
for (const d of dangling) fail(d);

// 5. palette — the site's brand hues are the mark's, recomputed from the
// gradient by the same colour module the compiler itself uses.
const hueOf = (hex) => Math.round(parseColor(hex).h);
const BRAND_HUE = hueOf(GRADIENT.at(-1).color); // the blue end, #6B8DFF → 269
const VIOLET_HUE = hueOf(GRADIENT[0].color); //   the magenta end, #D77BFF → 315
const ACCENT_STEP = VIOLET_HUE - BRAND_HUE;

const css = read('website/src/styles/global.css');
// --primary-strong and --primary-soft are ramp steps of the same hue; --violet
// is the other end of the logo's own sweep. Lightness and chroma are the
// contrast budget and are deliberately NOT constrained here.
for (const [name, expected] of [
  ['primary', BRAND_HUE],
  ['primary-strong', BRAND_HUE],
  ['primary-soft', BRAND_HUE],
  ['violet', VIOLET_HUE],
]) {
  const decls = [...css.matchAll(new RegExp(`--${name}:\\s*oklch\\([\\d.]+\\s+[\\d.]+\\s+([\\d.]+)\\)`, 'g'))];
  if (decls.length === 0) {
    fail(`global.css declares no --${name} in the expected oklch(L C H) form`);
    continue;
  }
  for (const [, h] of decls) {
    if (Math.round(Number(h)) !== expected) {
      fail(
        `global.css --${name} is hue ${h}, but the mark's gradient says ${expected} — the site accent and the logo have come apart (npm run check:brand explains; the hues come from brand/transtyle-mark.svg)`,
      );
    }
  }
}

for (const [file, name, expected] of [
  ['website/src/og.js', 'BRAND_HUE', BRAND_HUE],
  ['website/src/og.js', 'ACCENT_STEP', ACCENT_STEP],
  ['website/src/blog.js', 'BRAND_HUE', BRAND_HUE],
]) {
  const found = read(file).match(new RegExp(`const ${name} = (\\d+);`))?.[1];
  if (found === undefined) fail(`${file} no longer declares ${name} as a plain number`);
  else if (Number(found) !== expected) {
    fail(`${file} ${name} is ${found}, but the mark's gradient says ${expected}`);
  }
}

// 6. demos — every example demo project carries the favicon, whichever
// toolchain it is built with.
const examplesDir = join(root, 'examples');
let demos = 0;
for (const e of readdirSync(examplesDir)) {
  const demoDir = join(examplesDir, e, 'demo');
  if (!existsSync(join(examplesDir, e, 'transtyle.config.json')) || !existsSync(demoDir)) continue;
  for (const t of readdirSync(demoDir)) {
    const dir = join(demoDir, t);
    if (!statSync(dir).isDirectory()) continue;
    demos++;
    const where = `examples/${e}/demo/${t}`;
    // Vite and Angular link it from their index.html; Storybook has no HTML of
    // its own and finds the icon by serving public/ as a static dir.
    const html = ['index.html', 'src/index.html']
      .map((f) => join(dir, f))
      .filter(existsSync)
      .map((f) => readFileSync(f, 'utf8'));
    const sbMain = join(dir, '.storybook', 'main.ts');
    const linked = html.some((t) => t.includes('href="/favicon.svg"'));
    const staticDir = existsSync(sbMain) && readFileSync(sbMain, 'utf8').includes("staticDirs: ['../public']");
    if (!linked && !staticDir) {
      fail(
        `${where} does not use its public/favicon.svg — link it from index.html (\`<link rel="icon" type="image/svg+xml" href="/favicon.svg">\`) or, for Storybook, serve it with \`staticDirs: ['../public']\``,
      );
    }
  }
}

if (errors.length) {
  for (const e of errors) console.error(`✖ brand: ${e}`);
  process.exit(1);
}
console.log(
  `✔ brand: ${OUTPUTS.length} generated assets match the mark, and every surface still carries it (${SURFACES.length} site/README references, ${packages} package pages, ${demos} demo projects); the site's --primary/--violet are the gradient's own hues, ${BRAND_HUE}° and ${VIOLET_HUE}°`,
);
