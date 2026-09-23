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
 *     it: the site's brand config (header, favicons, manifest, Open Graph
 *     cards), the feed, the root README, and every publishable package README.
 *  3. No dangling reference — nothing in the tree points at a brand/ file that
 *     does not exist, which is how a rename silently breaks a README image.
 *  4. Absolute URLs off-repo — package READMEs are rendered by npm, outside
 *     the repository, so their logo must be an absolute URL rather than a
 *     relative path that only resolves on GitHub.
 *  5. One glyph — the site's own copy of the mark (website/src/brand/mark.svg,
 *     drawn in currentColor for the header and the Open Graph cards) and its
 *     favicon draw exactly the geometry below, so a redraw here cannot leave
 *     the site on the old one.
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
import { GLYPH, GLYPH_16, OUTPUTS, render } from './gen-brand.mjs';

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
  ['website/astro.config.mjs', "mark: './src/brand/mark.svg'", 'the header mark and the Open Graph badge'],
  ['website/astro.config.mjs', "favicons: './src/brand/favicons/'", 'the favicons, app icons and web manifest'],
  ['website/src/pages/blog/rss.xml.js', "withBase('/feed-icon-144.png')", 'the RSS channel image'],
  ['README.md', '.github/header.svg', 'the README header'],
  ['README.md', '.github/header.png', 'the README header, for hosts that refuse SVG'],
];
for (const file of ['.github/header.svg', '.github/header.png']) {
  if (!existsSync(join(root, file))) fail(`${file} is missing — the README opens with it`);
}
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

// 5. one glyph — the site's copies draw the same geometry as the generator.
// Compared as number sequences, so path formatting (commas, spaces, repeated
// commands) is free to differ and only the shape is held.
const numbers = (text) => (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number).join(' ');
const pathsIn = (file) => [...read(file).matchAll(/<path[^>]*\sd="([^"]+)"/g)].map(([, d]) => numbers(d));
for (const [file, glyph] of [
  ['website/src/brand/mark.svg', GLYPH],
  ['website/src/brand/favicons/favicon.svg', GLYPH_16],
]) {
  const found = pathsIn(file);
  if (found.length !== glyph.length || glyph.some((d, i) => numbers(d) !== found[i])) {
    fail(`${file} does not draw the glyph in scripts/gen-brand.mjs — the site and the mark have come apart`);
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
    // Relative, not root-absolute. The demos are published under
    // /demo/<example>/<target>/ (scripts/assemble-demos.mjs), where
    // `href="/favicon.svg"` asks the *site* root for a file that lives in the
    // demo's own directory. Vite happened to rewrite it and Angular did not,
    // so the Angular demos shipped that 404 until the demos left localhost —
    // where every one of them is served from a root and it cannot be seen.
    const linked = html.some((t) => t.includes('href="favicon.svg"'));
    const staticDir = existsSync(sbMain) && readFileSync(sbMain, 'utf8').includes("staticDirs: ['../public']");
    if (!linked && !staticDir) {
      fail(
        `${where} does not use its public/favicon.svg — link it from index.html (\`<link rel="icon" type="image/svg+xml" href="favicon.svg">\`, relative so it survives being served from a subdirectory) or, for Storybook, serve it with \`staticDirs: ['../public']\``,
      );
    }
  }

  // Storybook is the one target with a *brand* slot as well as a tab icon, and
  // it is filled from the example's own config rather than from the demo — the
  // generated theme carries `brandImage` through from `options.brand`.
  const config = JSON.parse(read(`examples/${e}/transtyle.config.json`));
  const brand = config.targets?.storybook?.options?.brand;
  if (existsSync(join(demoDir, 'storybook')) && brand?.image !== 'logo.png') {
    fail(
      `examples/${e}/transtyle.config.json: targets.storybook.options.brand.image should be "logo.png" — the generated theme is what puts the lockup in Storybook's sidebar, public/logo.png is generated for it, and the path is relative so it also resolves at /demo/${e}/storybook/`,
    );
  }
}

if (errors.length) {
  for (const e of errors) console.error(`✖ brand: ${e}`);
  process.exit(1);
}
console.log(
  `✔ brand: ${OUTPUTS.length} generated assets match the mark, and every surface still carries it (${SURFACES.length} site/README references, ${packages} package pages, ${demos} demo projects), and the site draws the same glyph`,
);
