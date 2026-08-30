#!/usr/bin/env node
/**
 * Fold the built demos into the site, and give each one its switcher.
 *
 *   npm run site:build       → website/dist/          (the site)
 *   npm run demos:build      → demo-dist/<ex>/<tg>/   (32 static apps)
 *   npm run demos:assemble   → website/dist/demo/…    (one deployable tree)
 *
 * Order matters, and this script must run last. `astro build` empties
 * website/dist, so assembling before it would silently delete the demos; and
 * check-site-links.mjs (postsite:build) walks whatever is in website/dist,
 * which should be the site's own pages rather than 32 framework bundles.
 * Running site:build first gets both for free.
 *
 * The only edit made to a built demo is the chrome injected into its root
 * index.html (scripts/lib/demo-chrome.mjs) — the switcher, and a noindex tag.
 * Nested HTML is left alone on purpose: Storybook's iframe.html is the story
 * canvas inside its own manager, and a floating pill belongs on the page, not
 * inside the frame the page is exhibiting.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXAMPLES, TARGETS, discoverDemos } from './lib/demos.mjs';
import { demoChrome, injectChrome } from './lib/demo-chrome.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
};
const from = resolve(root, arg('from') ?? 'demo-dist');
const into = resolve(root, arg('into') ?? 'website/dist/demo');
const allowPartial = process.argv.includes('--allow-partial');

if (!existsSync(from)) {
  console.error(
    `✖ assemble-demos: ${from.replace(root + '/', '')} does not exist — run \`npm run demos:build\` first`,
  );
  process.exit(1);
}

const expected = discoverDemos(root);
const staged = expected.filter((d) => existsSync(join(from, d.example, d.target, 'index.html')));
const missing = expected.filter((d) => !staged.includes(d));

if (missing.length && !allowPartial) {
  console.error(`✖ assemble-demos: ${missing.length} demo(s) not built, so the gallery would 404:`);
  for (const d of missing.slice(0, 10)) console.error(`    ${d.example}/${d.target}`);
  console.error('  Build them (`npm run demos:build`), or pass --allow-partial for a local preview.');
  process.exit(1);
}

// What the switcher is allowed to link to. A partial local assembly dims the
// demos that are not there rather than offering a link into a 404.
const built = staged.map((d) => `${d.example}/${d.target}`);

/**
 * The gallery page and the demos share one directory, and only one of them is
 * Astro's to write.
 *
 * website/dist/demo/index.html is a page of the site (src/pages/demo/index.astro);
 * website/dist/demo/<example>/ is a static build folded in beside it. Clearing
 * the whole directory before copying — the obvious first implementation, and
 * the one that shipped here for an hour — deletes the gallery that all 32 of
 * these demos link back to, leaving a 404 at the URL the site's own navigation
 * points at. Only the example subdirectories are this script's to replace.
 */
if (!existsSync(join(into, 'index.html'))) {
  console.error(
    `✖ assemble-demos: no gallery page at ${join(into, 'index.html').replace(root + '/', '')}` +
      ' — run `npm run site:build` first (astro build empties website/dist, so it has to go first).',
  );
  process.exit(1);
}
for (const example of new Set(expected.map((d) => d.example))) {
  rmSync(join(into, example), { recursive: true, force: true });
}

/**
 * A demo that assumes it is at the server root ships a link nobody can see.
 *
 * Hosted, each demo lives under /demo/<example>/<target>/, so `src="/main.js"`
 * resolves to the site root and 404s — while working perfectly in `npm run
 * dev`, where every demo's own server *is* a root. This is the same failure
 * shape check-site-links.mjs exists for, one directory further down, and it is
 * checked here rather than there because the site's own guard should not have
 * to walk 33 MB of framework bundles to find it.
 *
 * It caught the Angular demos on the first run: the Angular CLI leaves a
 * hand-written root-absolute favicon alone where Vite rewrites it.
 */
const htmlFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    return e.isDirectory() ? htmlFiles(path) : path.endsWith('.html') ? [path] : [];
  });
const rooted = /(?:href|src)="(\/(?!\/)[^"]*)"/g;
const unrooted = [];

for (const demo of staged) {
  const dest = join(into, demo.example, demo.target);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(join(from, demo.example, demo.target), dest, { recursive: true });

  const indexPath = join(dest, 'index.html');
  const chrome = demoChrome({
    root,
    example: demo.example,
    target: demo.target,
    examples: EXAMPLES,
    targets: TARGETS,
    built,
  });
  writeFileSync(indexPath, injectChrome(readFileSync(indexPath, 'utf8'), chrome));

  for (const file of htmlFiles(dest)) {
    for (const [, ref] of readFileSync(file, 'utf8').matchAll(rooted)) {
      unrooted.push(`${file.replace(into + '/', '')}: ${ref}`);
    }
  }
}

if (unrooted.length) {
  console.error('✖ assemble-demos: root-absolute references — these 404 once deployed under /demo/:');
  for (const u of [...new Set(unrooted)].slice(0, 20)) console.error(`    ${u}`);
  console.error('  Make the reference relative in the demo source; see PROFILES in scripts/lib/demos.mjs.');
  process.exit(1);
}

console.log(
  `✔ demos assembled: ${staged.length}/${expected.length} into ${into.replace(root + '/', '')}/` +
    (missing.length ? ` (${missing.length} missing — partial preview)` : ''),
);
