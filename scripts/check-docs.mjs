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
 *   2. links         — every internal link (/docs/<slug>/, /blog/<slug>/ and
 *                      known site routes) resolves; every #anchor points at a
 *                      real heading of the target page. Blog posts are checked
 *                      as link *sources* too — same promises, same checker.
 *   2b. blog         — every website/src/blog/*.md post has the frontmatter
 *                      the index, the post header and llms.txt render, and a
 *                      URL-safe filename. Posts are deliberately exempt from
 *                      check 6: a dated post records what was true when it was
 *                      written, while a docs page must describe today.
 *   3. CLI           — the commands the CLI actually implements (COMMANDS in
 *                      packages/cli/src/main.js) and the commands cli.md's
 *                      "Implemented" section documents are the same set.
 *   4. diagnostics   — every TST code emitted anywhere in the packages'
 *                      src/ trees is documented in diagnostics.md; every code
 *                      listed as a table row in diagnostics.md exists in source;
 *                      and each code's documented Severity column matches the
 *                      diagnostics.warn/.error/.info call that actually emits
 *                      it (TST1112's warning→error promotion left the table
 *                      saying "warning" until this was added — presence-only
 *                      checking cannot see a severity drift, only a diff can).
 *
 *   5. overviews    — every shipped exporter is named on each surface that
 *                     enumerates "what ships today": the docs overview, the
 *                     homepage, and the engineering overview's own pipeline
 *                     diagram.
 *   6. stale claims — no page describes an implemented CLI command as specced
 *                     or unimplemented. Covers the website docs plus
 *                     docs/specs/ and docs/architecture/, which make the same
 *                     claims about the same CLI and drift the same way. Dated
 *                     records (worklogs, exercises, proposals, findings, ADRs,
 *                     plans) are deliberately excluded: they state what was
 *                     true on their date, and "fixing" them rewrites history.
 *
 * Run: node scripts/check-docs.mjs (also: npm run check:docs, part of
 * check:sync and check:all). Exits 1 with a list of violations. Extend it
 * whenever a new class of docs drift is discovered — same contract as
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

const BLOG_DIR = 'website/src/blog';
const blogSlugs = readdirSync(join(root, BLOG_DIR))
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

const headingAnchors = (body) =>
  new Set([...stripFences(body).matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => slugify(m[1])));

const anchorsOf = {};
for (const s of slugs) anchorsOf[s] = headingAnchors(read(`${DOCS_DIR}/${s}.md`));
const blogAnchorsOf = {};
for (const s of blogSlugs) blogAnchorsOf[s] = headingAnchors(read(`${BLOG_DIR}/${s}.md`));

// Non-/docs/ site routes that legitimately exist (pages/ + public/).
const KNOWN_ROUTES = new Set(['/', '/docs/', '/blog/', '/blog/rss.xml', '/llms.txt', '/llms-full.txt']);
const publicFiles = readdirSync(join(root, 'website/public'), { recursive: true }).map((f) => '/' + String(f).replaceAll('\\', '/'));

// Every markdown page the site publishes — docs and blog posts alike. A blog
// post makes exactly the same promises a docs page does (its links resolve,
// its anchors exist), so it goes through exactly the same checker.
const markdownPages = [
  ...slugs.map((s) => ({ label: `${s}.md`, file: `${DOCS_DIR}/${s}.md`, ownAnchors: anchorsOf[s] })),
  ...blogSlugs.map((s) => ({ label: `blog/${s}.md`, file: `${BLOG_DIR}/${s}.md`, ownAnchors: blogAnchorsOf[s] })),
];

for (const page of markdownPages) {
  const body = stripFences(read(page.file));
  for (const m of body.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:)/.test(target)) continue;
    const [path_, anchor] = target.split('#');
    if (path_ === '') {
      // same-page anchor
      if (anchor && !page.ownAnchors.has(anchor)) fail(`links: ${page.label} → "#${anchor}" matches no heading on the page`);
      continue;
    }
    const docMatch = path_.match(/^\/docs\/(?:([\w-]+)(?:\/|\.md)?)?$/);
    if (docMatch) {
      const targetSlug = docMatch[1] ?? 'index';
      if (!slugs.includes(targetSlug)) {
        fail(`links: ${page.label} → "${target}" — no such docs page`);
        continue;
      }
      if (anchor && !anchorsOf[targetSlug].has(anchor)) {
        fail(`links: ${page.label} → "${target}" — page exists but has no heading "#${anchor}"`);
      }
      continue;
    }
    const blogMatch = path_.match(/^\/blog\/([\w-]+)(?:\/|\.md)?$/);
    if (blogMatch) {
      const targetSlug = blogMatch[1];
      if (!blogSlugs.includes(targetSlug)) {
        fail(`links: ${page.label} → "${target}" — no such blog post`);
        continue;
      }
      if (anchor && !blogAnchorsOf[targetSlug].has(anchor)) {
        fail(`links: ${page.label} → "${target}" — post exists but has no heading "#${anchor}"`);
      }
      continue;
    }
    if (KNOWN_ROUTES.has(path_) || publicFiles.includes(path_)) continue;
    fail(`links: ${page.label} → "${target}" — not a docs page, blog post, known route, or public/ file`);
  }
}

// ---------- 2b. blog frontmatter ----------
// A post's filename is its published URL and its frontmatter is what the index
// page, the post header, and llms.txt all render — a missing field is a broken
// listing, not a cosmetic gap, so every field the templates read is required.
const BLOG_FIELDS = ['title', 'description', 'date', 'author'];
for (const s of blogSlugs) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) {
    fail(`blog: "${s}.md" — filename is the published URL; use lowercase-kebab-case`);
  }
  const front = read(`${BLOG_DIR}/${s}.md`).match(/^---\n([\s\S]*?)\n---/)?.[1];
  if (!front) {
    fail(`blog: ${s}.md has no frontmatter block`);
    continue;
  }
  for (const field of BLOG_FIELDS) {
    if (!new RegExp(`^${field}:\\s*\\S`, 'm').test(front)) fail(`blog: ${s}.md is missing frontmatter "${field}"`);
  }
  const date = front.match(/^date:\s*'?(\d{4}-\d{2}-\d{2})'?\s*$/m)?.[1];
  if (!date) fail(`blog: ${s}.md — "date" must be a quoted YYYY-MM-DD string (posts sort and render on it)`);
  else if (Number.isNaN(Date.parse(`${date}T00:00:00Z`))) fail(`blog: ${s}.md — "date: ${date}" is not a real date`);

  // Optional: pins the social card's accent instead of deriving it from the
  // slug (website/src/blog.js). A typo here doesn't fail the build — it just
  // silently paints the card with NaN's fallback — so it's checked.
  if (/^accentHue:/m.test(front)) {
    const hue = front.match(/^accentHue:\s*(\d+(?:\.\d+)?)\s*$/m)?.[1];
    if (hue === undefined || Number(hue) < 0 || Number(hue) > 360) {
      fail(`blog: ${s}.md — "accentHue" must be a number between 0 and 360 (OKLCH degrees)`);
    }
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
// Severity actually used at each call site: `diagnostics.warn('TSTxxxx', ...)`,
// `.error(...)`, `.info(...)` — also matches the `diagnostics?.warn(` optional-
// chaining form (packages/ir), which is why the method name is matched loosely
// (`\.(warn|error|info)\(`) rather than anchored to a literal `diagnostics.`.
const sourceSeverity = new Map(); // code -> Set<'warning'|'error'|'info'>
const SEVERITY_NAME = { warn: 'warning', error: 'error', info: 'info' };
for (const pkg of readdirSync(join(root, 'packages'), { withFileTypes: true })) {
  if (!pkg.isDirectory()) continue;
  const srcDir = join(root, 'packages', pkg.name, 'src');
  if (!existsSync(srcDir)) continue;
  for (const f of readdirSync(srcDir, { recursive: true })) {
    if (!String(f).endsWith('.js')) continue;
    const src = readFileSync(join(srcDir, String(f)), 'utf8');
    for (const m of src.matchAll(/TST\d{4}/g)) sourceCodes.add(m[0]);
    for (const m of src.matchAll(/\.(warn|error|info)\(\s*\n?\s*[`'"](TST\d{4})/g)) {
      const [, method, code] = m;
      if (!sourceSeverity.has(code)) sourceSeverity.set(code, new Set());
      sourceSeverity.get(code).add(SEVERITY_NAME[method]);
    }
  }
}
const diagPage = read(`${DOCS_DIR}/diagnostics.md`);
for (const code of [...sourceCodes].sort()) {
  if (!diagPage.includes(code)) fail(`diagnostics: ${code} is emitted in packages/*/src but absent from diagnostics.md`);
}
const docSeverity = new Map(); // code -> severity string from the table
for (const m of diagPage.matchAll(/^\|\s*`(TST\d{4})`\s*\|\s*(\w+)\s*\|/gm)) {
  docSeverity.set(m[1], m[2]);
  if (!sourceCodes.has(m[1])) fail(`diagnostics: diagnostics.md lists ${m[1]} as a code table row, but nothing in packages/*/src emits it`);
}
for (const [code, severities] of sourceSeverity) {
  if (severities.size > 1) {
    fail(`diagnostics: ${code} is emitted with inconsistent severities in source (${[...severities].join(', ')}) — the docs table can't match a code with more than one severity`);
    continue;
  }
  const [actual] = severities;
  const documented = docSeverity.get(code);
  if (documented && documented !== actual) {
    fail(`diagnostics: ${code} is documented as "${documented}" in diagnostics.md but source emits it as "${actual}"`);
  }
}

// ---------- 5. overview surfaces name every shipped exporter ----------
// The docs overview and the homepage both enumerate "what ships today"; a new
// exporter that misses either page understates the product (this happened:
// both pages said 5 exporters while 8 were registered — and again in the
// engineering overview's own pipeline diagram, which still drew five backends
// long after three more shipped, which is why it is checked here too).
const registry = cliSrc.match(/OFFICIAL_EXPORTERS\s*=\s*\{([\s\S]*?)\}/)?.[1] ?? '';
const exporters = [...registry.matchAll(/^\s*['"]?([\w-]+)['"]?:/gm)].map((m) => m[1]);
const squash = (s) => s.toLowerCase().replace(/[\s/-]/g, '');
for (const surface of ['website/src/docs/index.md', 'website/src/pages/index.astro', 'docs/architecture/overview.md']) {
  const text = squash(read(surface));
  for (const name of exporters) {
    if (!text.includes(squash(name))) fail(`overview: ${surface} does not name shipped exporter "${name}"`);
  }
}

// ---------- 6. implemented features described as unimplemented ----------
// "There is no `transtyle init` yet" survived two releases after init shipped.
// cli.md is exempt (its Implemented/Specced split has its own exact check above).
const STALE = (cmd) => new RegExp(
  '(?:no|not yet|not implemented|specced)[^.\\n]{0,60}`transtyle ' + cmd + '\\b' +
  '|`transtyle ' + cmd + '[^`]*`[^.\\n]{0,60}(?:not implemented|not yet|specced)', 'i');
for (const s of slugs) {
  if (s === 'cli') continue;
  const body = read(`${DOCS_DIR}/${s}.md`);
  for (const c of commands) {
    if (STALE(c).test(body)) fail(`stale-claim: ${s}.md describes implemented command "transtyle ${c}" as unimplemented`);
  }
}

// The pattern above only sees the fully-qualified spelling. Real drift used the
// bare one: `transtyle diff` shipped while the status callout on index.md said
// "specced but not implemented: `diff`, `import`, `preview`" and the roadmap's
// "Specced, not yet implemented" table still listed it — three surfaces
// understating the product with a backtick and no "transtyle " in sight.
//
// So also scan the two places such a claim lives: any section whose HEADING
// announces unimplemented work, and any single line that says so inline. A bare
// backticked command name in either is a claim that it doesn't exist.
// Qualified mentions are legitimate ("richer `init` (interactive)" describes a
// future variant of a shipped command) and are exempted the same way cli.md's
// own Specced table exempts them.
const CLAIM_HEADING = /^#{2,6}\s+.*(?:specced|not (?:yet )?implemented)/i;
const CLAIM_LINE = /not (?:yet )?implemented|remains? specced|specced but|still specced/i;
const QUALIFIER = /richer|interactive|variant|mode\b|flag|option|--\w/i;

/**
 * The text that actually makes an "it doesn't exist yet" claim.
 *
 * Under a claim heading, only the **enumerating** lines — list items and table
 * rows. That is where every real instance of this drift has lived (a roadmap
 * table row, a bullet in a "specced" list), and prose under such a heading is
 * where the false positives live: derivation.md's specced user-rules section
 * explains that arbitrary JS "would make `explain` output unreadable", which is
 * a sentence about a shipped command, not a claim it is missing.
 *
 * Inline, it's only the sentence carrying the phrase — index.md's status
 * callout says what IS real and what is NOT in one line, and scanning the whole
 * line would flag every shipped command it correctly advertises.
 */
const ENUMERATING = /^\s*(?:[-*+]\s|\d+\.\s|\|)/;

const claimRegions = (body) => {
  const regions = [];
  let inClaimSection = false;
  for (const line of body.split('\n')) {
    if (/^#{2,6}\s+/.test(line)) inClaimSection = CLAIM_HEADING.test(line);
    if (inClaimSection && ENUMERATING.test(line)) regions.push(line);
    else if (CLAIM_LINE.test(line)) regions.push(...line.split(/(?<=\.)\s+/).filter((s) => CLAIM_LINE.test(s)));
  }
  return regions;
};

// The engineering docs make the same claims about the same CLI, and drift the
// same way — docs/specs/cli.md's status banner went on calling `diff` specced
// for as long as the website's did. Dated records (worklogs, exercises,
// proposals, findings, ADRs, plans) are deliberately NOT scanned: they say what
// was true on their date, and editing them would be rewriting history.
const claimSurfaces = [
  ...slugs.filter((s) => s !== 'cli').map((s) => `${DOCS_DIR}/${s}.md`),
  ...['docs/specs', 'docs/architecture'].flatMap((dir) =>
    readdirSync(join(root, dir))
      .filter((f) => f.endsWith('.md'))
      .map((f) => `${dir}/${f}`),
  ),
];

for (const surface of claimSurfaces) {
  for (const line of claimRegions(read(surface))) {
    // Qualification is judged on the comma/semicolon-delimited segment the
    // command sits in, not on a fixed character window: in a list like
    // "`--dry-run`, `import`, `diff`, `migrate` remain specced" a window wide
    // enough to see a real qualifier also sees the neighbouring item's flag,
    // and every entry in the list goes quietly unchecked.
    const segments = line.split(/[,;]/);
    for (const m of line.matchAll(/`([\w-]+)`/g)) {
      if (!commands.includes(m[1])) continue;
      const segment = segments.find((s) => s.includes(`\`${m[1]}\``)) ?? line;
      if (QUALIFIER.test(segment)) continue; // a future variant of a shipped command
      fail(`stale-claim: ${surface} lists implemented command \`${m[1]}\` as specced/unimplemented — "${line.trim().slice(0, 90)}"`);
    }
  }
}

// ---------- verdict ----------
if (errors.length) {
  console.error(`✖ docs check: ${errors.length} violation(s)\n`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(
  `✔ docs check: ${slugs.length} pages all reachable; ${blogSlugs.length} blog post(s) well-formed; internal links + anchors resolve; ` +
  `${commands.length} CLI commands and ${sourceCodes.size} diagnostic codes (severity included) match the docs exactly`,
);
