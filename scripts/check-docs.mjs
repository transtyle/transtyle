#!/usr/bin/env node
/**
 * Docs-precision guard — the website half of the sync rule (CONTRIBUTING.md).
 *
 * check-sync.mjs proves every *exporter* exists on all five surfaces; this
 * checker proves the website's *content* is precise against the code it
 * documents. A docs page that names a command, a diagnostic code, or another
 * page is making a promise — every promise here is mechanically re-checked:
 *
 *   1. nav ↔ files   — every website/src/docs/*.md page is reachable from
 *                      nav.js, and every nav slug has a page (no orphans,
 *                      no dead entries).
 *   2. links         — every internal link (/docs/<slug>/ and known site
 *                      routes) resolves; every #anchor points at a real
 *                      heading of the target page.
 *   3. CLI           — the commands the CLI actually implements (COMMANDS in
 *                      packages/cli/src/main.js) and the commands cli.md's
 *                      "Implemented" section documents are the same set.
 *   4. diagnostics   — every TST code emitted anywhere in the packages'
 *                      src/ trees is documented in diagnostics.md; every code
 *                      listed as a table row in diagnostics.md exists in source.
 *
 * Run: node scripts/check-docs.mjs (also: npm run check:docs, part of
 * check:sync and check:all). Exits 1 with a list of violations. Extend it
 * whenever a new class of website drift is discovered — same contract as
 * check-sync.mjs: this file exists because real drift was possible.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const errors = [];
const fail = (msg) => errors.push(msg);

const DOCS_DIR = 'website/src/docs';
const slugs = readdirSync(join(root, DOCS_DIR))
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.replace(/\.md$/, ''));

// ---------- 1. nav ↔ files ----------
const navSrc = read('website/src/nav.js');
const navSlugs = [...navSrc.matchAll(/slugs:\s*\[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/'([\w-]+)'/g)].map((s) => s[1]));
for (const s of slugs) {
  if (!navSlugs.includes(s)) fail(`nav: ${DOCS_DIR}/${s}.md exists but is not reachable from nav.js (orphan page)`);
}
for (const s of navSlugs) {
  if (!slugs.includes(s)) fail(`nav: nav.js lists '${s}' but ${DOCS_DIR}/${s}.md does not exist (dead entry)`);
}

// ---------- 2. internal links + anchors ----------
/**
 * GitHub-style heading slug, matching Astro's github-slugger: punctuation is
 * removed, each space becomes a hyphen, and runs are NOT collapsed — so
 * "GOV.UK — a real design system" → "govuk--a-real-design-system" (verified
 * against the built HTML's ids).
 */
const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // linked headings keep their text
    .trim()
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .replace(/ /g, '-');

const stripFences = (md) => md.replace(/```[\s\S]*?```/g, '');

const anchorsOf = {};
for (const s of slugs) {
  const body = stripFences(read(`${DOCS_DIR}/${s}.md`));
  anchorsOf[s] = new Set(
    [...body.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => slugify(m[1])),
  );
}

// Non-/docs/ site routes that legitimately exist (pages/ + public/).
const KNOWN_ROUTES = new Set(['/', '/docs/', '/llms.txt', '/llms-full.txt']);
const publicFiles = readdirSync(join(root, 'website/public'), { recursive: true }).map((f) => '/' + String(f).replaceAll('\\', '/'));

for (const s of slugs) {
  const body = stripFences(read(`${DOCS_DIR}/${s}.md`));
  for (const m of body.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:)/.test(target)) continue;
    const [path_, anchor] = target.split('#');
    if (path_ === '') {
      // same-page anchor
      if (anchor && !anchorsOf[s].has(anchor)) fail(`links: ${s}.md → "#${anchor}" matches no heading on the page`);
      continue;
    }
    const docMatch = path_.match(/^\/docs\/(?:([\w-]+)(?:\/|\.md)?)?$/);
    if (docMatch) {
      const targetSlug = docMatch[1] ?? 'index';
      if (!slugs.includes(targetSlug)) {
        fail(`links: ${s}.md → "${target}" — no such docs page`);
        continue;
      }
      if (anchor && !anchorsOf[targetSlug].has(anchor)) {
        fail(`links: ${s}.md → "${target}" — page exists but has no heading "#${anchor}"`);
      }
      continue;
    }
    if (KNOWN_ROUTES.has(path_) || publicFiles.includes(path_)) continue;
    fail(`links: ${s}.md → "${target}" — not a docs page, known route, or public/ file`);
  }
}

// ---------- 3. CLI commands ----------
const cliSrc = read('packages/cli/src/main.js');
const commands = cliSrc.match(/COMMANDS\s*=\s*\[([^\]]*)\]/)?.[1].match(/'(\w+)'/g)?.map((c) => c.slice(1, -1)) ?? [];
if (commands.length === 0) fail('cli: could not parse COMMANDS from packages/cli/src/main.js');
const cliPage = read(`${DOCS_DIR}/cli.md`);
const implementedSection = cliPage.split(/##\s+Specced/)[0];
const documented = [...implementedSection.matchAll(/###\s+`transtyle\s+(\w+)/g)].map((m) => m[1]);
for (const c of commands) {
  if (!documented.includes(c)) fail(`cli: command "${c}" is implemented but has no \`### transtyle ${c}\` heading in cli.md's Implemented section`);
}
for (const c of documented) {
  if (!commands.includes(c)) fail(`cli: cli.md documents "transtyle ${c}" as implemented, but COMMANDS does not include it`);
}
// In the Specced section, a row may document a *future variant* of an
// implemented command ("`transtyle init` (interactive mode)") — that's fine.
// What must not happen is a bare implemented command claimed as unimplemented.
const speccedSection = cliPage.split(/##\s+Specced/)[1] ?? '';
for (const row of speccedSection.matchAll(/^\|\s*(`[^`]+`)\s*\|/gm)) {
  const cmd = row[1].match(/^`transtyle\s+(\w+)/)?.[1];
  if (cmd && commands.includes(cmd)) {
    fail(`cli: cli.md's Specced table row ${row[1]} names implemented command "${cmd}" with no qualifier — move it to Implemented or qualify it`);
  }
}

// ---------- 4. diagnostic codes ----------
const sourceCodes = new Set();
for (const pkg of readdirSync(join(root, 'packages'), { withFileTypes: true })) {
  if (!pkg.isDirectory()) continue;
  const srcDir = join(root, 'packages', pkg.name, 'src');
  if (!existsSync(srcDir)) continue;
  for (const f of readdirSync(srcDir, { recursive: true })) {
    if (!String(f).endsWith('.js')) continue;
    for (const m of readFileSync(join(srcDir, String(f)), 'utf8').matchAll(/TST\d{4}/g)) sourceCodes.add(m[0]);
  }
}
const diagPage = read(`${DOCS_DIR}/diagnostics.md`);
for (const code of [...sourceCodes].sort()) {
  if (!diagPage.includes(code)) fail(`diagnostics: ${code} is emitted in packages/*/src but absent from diagnostics.md`);
}
for (const m of diagPage.matchAll(/^\|\s*`(TST\d{4})`/gm)) {
  if (!sourceCodes.has(m[1])) fail(`diagnostics: diagnostics.md lists ${m[1]} as a code table row, but nothing in packages/*/src emits it`);
}

// ---------- verdict ----------
if (errors.length) {
  console.error(`✖ docs check: ${errors.length} violation(s)\n`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(
  `✔ docs check: ${slugs.length} pages all reachable; internal links + anchors resolve; ` +
  `${commands.length} CLI commands and ${sourceCodes.size} diagnostic codes match the docs exactly`,
);
