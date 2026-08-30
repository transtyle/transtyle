#!/usr/bin/env node
/**
 * Release guard: resolve the npm dist-tag, and refuse a release that would
 * arm the catalog freeze by accident.
 *
 * ADR-0010, as amended 2026-08-30, makes the freeze re-arm on "the first
 * release whose version carries no prerelease identifier" — not on a dist-tag,
 * because npmjs.org auto-assigns `latest` on a package's first publish no
 * matter what `--tag` is passed. From that release on, the semantic catalog is
 * additive-only forever: nothing removed, nothing re-typed. That is a one-way
 * door, and the only thing standing between it and an ordinary `npm run
 * release` is a maintainer remembering which mode the repo is in.
 *
 * So the machine checks instead. This script:
 *   - reads .changeset/pre.json to learn whether a prerelease is in progress
 *   - asserts every publishable package agrees on one version (the `fixed`
 *     group in .changeset/config.json means they must)
 *   - asserts the versions match the mode: in pre mode every version carries
 *     the `-<tag>.N` identifier; out of pre mode none may
 *   - refuses a freeze-arming (non-prerelease) release unless the caller sets
 *     CONFIRM_STABLE_RELEASE=arm-the-freeze, so it cannot happen by reflex
 *
 * On success it prints the dist-tag to pass to `changeset publish --tag`, and
 * writes `dist-tag=<tag>` to $GITHUB_OUTPUT when running in Actions.
 *
 * Run: node scripts/check-release-tag.mjs (also: npm run check:release-tag).
 */
import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const errors = [];
const fail = (m) => errors.push(m);

// ---------- the packages a release would actually publish ----------
const pkgDir = join(root, 'packages');
const publishable = readdirSync(pkgDir)
  .map((d) => join(pkgDir, d, 'package.json'))
  .filter((f) => existsSync(f))
  .map((f) => JSON.parse(readFileSync(f, 'utf8')))
  .filter((p) => !p.private);

if (publishable.length === 0) fail('no publishable packages found under packages/ — nothing to release');

// ---------- one version across the fixed group ----------
const versions = [...new Set(publishable.map((p) => p.version))];
if (versions.length > 1) {
  fail(
    `.changeset/config.json puts every @transtyle/* package in one "fixed" group, so they must share a version — found ${versions.length}: ${versions.join(', ')}. Run \`npx changeset version\` rather than editing versions by hand.`,
  );
}
const version = versions[0];

// ---------- what mode are we in ----------
const prePath = join(root, '.changeset', 'pre.json');
const pre = existsSync(prePath) ? JSON.parse(readFileSync(prePath, 'utf8')) : undefined;
const inPre = pre !== undefined && pre.mode === 'pre';

// A prerelease identifier is everything after the first `-`: 0.1.0-alpha.3.
const prerelease = version === undefined ? undefined : /-(?<id>.+)$/.exec(version)?.groups.id;

let distTag;
if (inPre) {
  distTag = pre.tag;
  if (prerelease === undefined) {
    fail(
      `.changeset/pre.json says a "${pre.tag}" prerelease is in progress, but the packages are at ${version} — a version with no prerelease identifier. Run \`npx changeset version\` to restamp them, or \`npx changeset pre exit\` if the prerelease is over.`,
    );
  } else if (!prerelease.startsWith(`${pre.tag}.`)) {
    fail(
      `.changeset/pre.json says the prerelease tag is "${pre.tag}", but the packages are at ${version}. The identifier must read -${pre.tag}.N so the dist-tag and the version agree.`,
    );
  }
} else {
  distTag = 'latest';
  if (prerelease !== undefined) {
    fail(
      `the packages are at ${version} — a prerelease — but .changeset/pre.json is absent or exited, so this would publish to the "latest" dist-tag. Run \`npx changeset pre enter ${prerelease.split('.')[0]}\` before versioning, or \`npx changeset version\` to cut a real release.`,
    );
  } else if (process.env.CONFIRM_STABLE_RELEASE !== 'arm-the-freeze') {
    fail(
      `refusing to publish ${version}: a version with no prerelease identifier ARMS THE CATALOG FREEZE.\n` +
        `    From that release on, ADR-0010 makes the semantic catalog additive-only — nothing removed, nothing\n` +
        `    re-typed, rule semantics only via a new rule-pack version — and that cannot be undone by unpublishing.\n` +
        `    Read docs/adr/0010-pre-release-breaking-changes.md and RELEASING.md, then, if you mean it, re-run with\n` +
        `    CONFIRM_STABLE_RELEASE=arm-the-freeze set.`,
    );
  }
}

// ---------- verdict ----------
if (errors.length) {
  for (const e of errors) console.error(`✖ release guard: ${e}`);
  process.exit(1);
}

const mode = inPre ? `prerelease "${pre.tag}"` : 'stable release';
console.log(`✔ release guard: ${publishable.length} packages at ${version}, ${mode} → npm dist-tag "${distTag}"`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `dist-tag=${distTag}\n`);
