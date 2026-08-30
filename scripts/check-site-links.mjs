#!/usr/bin/env node
/**
 * Base-path guard for the built site.
 *
 * The site is served from a GitHub Pages project URL —
 * https://transtyle.github.io/transtyle/ — so every internal path lives under
 * `/transtyle/`. A hand-written `href="/docs/"` still works perfectly in
 * `astro dev` and in every local preview, and 404s only once deployed. That is
 * the failure shape this exists to make impossible: it is invisible in review,
 * invisible in the build log, and only the people reading the live site find it.
 *
 * It reads the emitted files rather than the sources on purpose. Links reach
 * the page by several routes — withBase() in components, the Sätteri plugin for
 * markdown links, its raw-node pass for the HTML blocks in docs/index.md,
 * absolute URLs assembled by hand in the sitemap, RSS, llms.txt and robots.txt
 * — and a source-level rule would have to know all of them. The output knows
 * none of that, and is what visitors actually get.
 *
 * Two checks, one idea:
 *   1. no root-absolute href/src that doesn't start with the base
 *   2. no absolute URL on our own origin that skips the base
 *
 * Runs automatically after `npm run site:build` (postsite:build), so it covers
 * CI, the Pages deploy and any local build without anyone opting in.
 *
 * Run: node scripts/check-site-links.mjs (also: npm run check:site-links).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'website', 'dist');
const errors = [];

if (!existsSync(dist)) {
  console.error('✖ site links: website/dist does not exist — run `npm run site:build` first');
  process.exit(1);
}

// The config is the single source of truth for both values, and it is a plain
// ESM module, so it can simply be asked rather than parsed or duplicated.
const config = (await import(pathToFileURL(join(root, 'website', 'astro.config.mjs')).href))
  .default;
const site = String(config.site).replace(/\/$/, '');
const base = String(config.base ?? '/').replace(/\/$/, '');

// Text formats the site emits. Binary output (the OG cards) carries no links.
const TEXT = /\.(html|xml|txt|md|json|css|js)$/;

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : TEXT.test(p) ? [p] : [];
  });

const files = walk(dist);

// A root-absolute link that does not start with the base. `//host` is
// protocol-relative and belongs to someone else, so it is excluded.
const unbasedPath = new RegExp(`(?:href|src)="(/(?!/)(?!${base.slice(1)}/)[^"]*)"`, 'g');
// Our own origin, with the base missing — how an absolute URL built by hand
// (sitemap, RSS, llms.txt) goes wrong.
const unbasedUrl = new RegExp(`${site}(?!${base}/)(?!${base}")(?!/?["'\\s])[^"'\\s<)]*`, 'g');

let checked = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const where = relative(root, file);
  checked++;
  for (const [, path] of text.matchAll(unbasedPath)) {
    errors.push(
      `${where}: ${path} — root-absolute but not under ${base}/, so it 404s on the deployed site (use withBase() in components; markdown is handled by website/base-urls-plugin.mjs)`,
    );
  }
  for (const [url] of text.matchAll(unbasedUrl)) {
    errors.push(
      `${where}: ${url} — an absolute URL on our own origin that skips the ${base} base path`,
    );
  }
}

if (errors.length) {
  // Same link repeated across 30 pages is one mistake, not thirty.
  for (const e of [...new Set(errors)].slice(0, 25)) console.error(`✖ site links: ${e}`);
  if (new Set(errors).size > 25) console.error(`  … and ${new Set(errors).size - 25} more`);
  process.exit(1);
}
console.log(
  `✔ site links: ${checked} built files — every internal link and own-origin URL sits under ${base}/`,
);
