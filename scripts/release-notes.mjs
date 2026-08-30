#!/usr/bin/env node
/**
 * Render the GitHub Release body for one version.
 *
 * The twelve packages release in lockstep (the `fixed` group in
 * .changeset/config.json), so twelve changelogs say the same thing twelve
 * times, each with a different tail of "Updated dependencies" lines that are
 * bookkeeping rather than news. A release page that pasted all of them would
 * be unreadable, and one that pasted a single package's would silently drop
 * anything that happened only in another.
 *
 * So this takes the UNION of the substantive entries across every package's
 * section for the version, deduplicated by text. Identical entries collapse to
 * one; a change that touched only `@transtyle/ir` still appears, attributed.
 *
 * It reads the changelogs at the current checkout, which means it can render
 * any past version too — that is how the releases for 0.1.0-alpha.0 through .2
 * were backfilled after the fact.
 *
 * Run: node scripts/release-notes.mjs [version]   (default: the current one)
 *      npm run release:notes
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkgDir = join(root, 'packages');

const packages = readdirSync(pkgDir)
  .map((d) => ({ dir: join(pkgDir, d), manifest: join(pkgDir, d, 'package.json') }))
  .filter((p) => existsSync(p.manifest))
  .map((p) => ({ ...p, pkg: JSON.parse(readFileSync(p.manifest, 'utf8')) }))
  .filter((p) => !p.pkg.private);

const version = process.argv[2] ?? packages[0].pkg.version;
const isPrerelease = version.includes('-');

/** The `## <version>` block of one changelog, without its heading. */
function section(changelog, v) {
  const lines = readFileSync(changelog, 'utf8').split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${v}`);
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length && !/^## /.test(lines[end])) end++;
  return lines.slice(start + 1, end).join('\n').trim();
}

/**
 * Split a section into `- ` entries, keeping each entry's indented
 * continuation paragraphs with it. Changesets writes the body indented by two
 * spaces under the bullet, so anything that is not a new top-level bullet
 * belongs to the bullet above it.
 */
function entries(text) {
  const out = [];
  let current = null;
  for (const line of text.split('\n')) {
    if (/^- /.test(line)) {
      if (current) out.push(current.join('\n').trimEnd());
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) out.push(current.join('\n').trimEnd());
  return out;
}

// `### Patch Changes` etc., in the order Changesets emits them.
const KINDS = ['Major Changes', 'Minor Changes', 'Patch Changes'];
const byKind = new Map(KINDS.map((k) => [k, new Map()]));
const missing = [];

for (const { pkg, dir } of packages) {
  const changelog = join(dir, 'CHANGELOG.md');
  const sec = existsSync(changelog) ? section(changelog, version) : null;
  if (sec === null) { missing.push(pkg.name); continue; }

  let kind = 'Patch Changes';
  for (const chunk of sec.split(/^### /m)) {
    const [head, ...rest] = chunk.split('\n');
    if (KINDS.includes(head.trim())) kind = head.trim();
    const body = (KINDS.includes(head.trim()) ? rest.join('\n') : chunk).trim();
    if (!body) continue;
    for (const entry of entries(body)) {
      // Dependency bumps are lockstep bookkeeping, not news: every package
      // lists every sibling, which is 100+ lines saying the version changed.
      if (/^- Updated dependencies/.test(entry)) continue;
      // Key on the prose, not the commit prefix, so the same change written
      // once collapses across all twelve packages.
      const key = entry.replace(/^- [0-9a-f]{7,40}: /, '- ').trim();
      if (!byKind.get(kind).has(key)) byKind.get(kind).set(key, entry);
    }
  }
}

if (missing.length === packages.length) {
  console.error(`✖ release notes: no package changelog has a "## ${version}" section`);
  process.exit(1);
}

const site = 'https://transtyle.github.io/transtyle/';
const tag = isPrerelease ? version.split('-')[1].split('.')[0] : 'latest';

const out = [];
if (isPrerelease) {
  out.push(
    `> **Experimental alpha.** Breaking changes ship without a deprecation cycle — the token vocabulary, the generated output, the config format and the CLI surface can each change between alpha releases. Pin an exact version, and treat generated files as output you regenerate rather than hand-edit.`,
    '',
  );
}
out.push('```bash', `npm i -D @transtyle/cli@${version}`, '```', '');
out.push(`All ${packages.length} \`@transtyle/*\` packages release in lockstep at this version, published under the \`${tag}\` dist-tag.`, '');

for (const kind of KINDS) {
  const found = byKind.get(kind);
  if (found.size === 0) continue;
  out.push(`### ${kind}`, '');
  for (const entry of found.values()) out.push(entry, '');
}

if (missing.length) {
  out.push(`_No changelog entry for this version in: ${missing.join(', ')}._`, '');
}

out.push('---', '', `[Documentation](${site}) · [Packages on npm](https://www.npmjs.com/org/transtyle) · [What is built vs. planned](${site}docs/roadmap/)`);

console.log(out.join('\n'));
