#!/usr/bin/env node
/**
 * Point `latest` at the release just published — but only while no stable
 * release exists.
 *
 * The policy (maintainer, 2026-08-30):
 *
 *   - No stable release yet → `latest` tracks the newest alpha, so a bare
 *     `npm install @transtyle/cli` gets the current alpha rather than being
 *     stranded on whichever prerelease npm auto-tagged first.
 *   - A stable release exists → prereleases never touch `latest` again. From
 *     then on `npm install` means "the stable one" and `@alpha` is the opt-in.
 *
 * `npm publish --tag <tag>` sets exactly one tag, so the alpha channel and the
 * default channel cannot both be served by the publish alone. This runs after
 * it and moves `latest` when — and only when — the rule above says it should.
 *
 * The condition is read off the registry rather than tracked in the repo: if
 * the CURRENT `latest` carries a prerelease identifier, no stable release has
 * taken over yet, so `latest` is still the alpha's to move. The moment a stable
 * version is published, `npm publish --tag latest` repoints it, this check sees
 * a stable `latest`, and it stops touching it forever after. Self-maintaining,
 * with no flag anyone has to remember to flip.
 *
 * It deliberately uses `npm dist-tag ls` rather than the packument: that
 * endpoint is not CDN-cached and answers correctly immediately after a publish,
 * where registry.npmjs.org/<pkg> can 404 for minutes.
 *
 * Run: node scripts/sync-latest-tag.mjs [--dry-run] [--otp=<code>]
 *      (also: npm run sync:latest-tag)
 *
 * Run locally it is INTERACTIVE: an account with 2FA on writes will make npm
 * either print an auth URL to open or ask for a code, once per package. Answer
 * the prompts. It is not interactive in CI, where OIDC authenticates it.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dryRun = process.argv.includes('--dry-run');
// Accounts with 2FA on writes need an OTP; CI does not, authenticating via OIDC.
const otp = process.argv.find((a) => a.startsWith('--otp='));
const errors = [];

/**
 * npm's real error is buried under Node's ExperimentalWarning noise, and the
 * first stderr line is almost never the one that matters. Prefer `npm error`
 * lines, and drop the runtime's own chatter.
 */
function npmError(err) {
  const raw = String(err.stderr || err.message || '');
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/ExperimentalWarning|trace-warnings|loading ES Module|^\(Use /.test(l));
  const real = lines.filter((l) => l.startsWith('npm error')).map((l) => l.replace(/^npm error\s*/, ''));
  const picked = (real.length ? real : lines).filter((l) => !/^A complete log/.test(l));
  const msg = picked.slice(0, 2).join(' — ') || 'unknown error';
  return /EOTP|one-time password/.test(raw)
    ? `${msg}\n    → this account requires 2FA for dist-tag writes. If npm printed an auth URL above, open it and approve; if it asked for a code, re-run with --otp=<code>. CI does not hit this: it authenticates via OIDC.`
    : msg;
}

const isPrerelease = (v) => /-/.test(v);

const pkgDir = join(root, 'packages');
const packages = readdirSync(pkgDir)
  .map((d) => join(pkgDir, d, 'package.json'))
  .filter((f) => existsSync(f))
  .map((f) => JSON.parse(readFileSync(f, 'utf8')))
  .filter((p) => !p.private);

let moved = 0;
let leftAlone = 0;

for (const { name, version } of packages) {
  let tags;
  try {
    tags = execFileSync('npm', ['dist-tag', 'ls', name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    errors.push(`${name}: could not read dist-tags — ${npmError(err)}`);
    continue;
  }
  const current = /^latest:\s*(\S+)$/m.exec(tags)?.[1];

  if (current !== undefined && !isPrerelease(current)) {
    console.log(`  ${name}: latest is ${current} (stable) — left alone, as the policy requires`);
    leftAlone++;
    continue;
  }
  if (current === version) {
    console.log(`  ${name}: latest is already ${version}`);
    leftAlone++;
    continue;
  }

  if (dryRun) {
    console.log(`  ${name}: would move latest ${current ?? '(unset)'} → ${version}`);
    moved++;
    continue;
  }
  // stdio is INHERITED here, unlike the read above, and that is load-bearing.
  // `dist-tag add` is a write, so npm may need to authenticate — and on an
  // account using npm's web auth flow it prints a URL and blocks on ENTER
  // rather than asking for a code. Captured stdout hides the URL and an ignored
  // stdin can never deliver the ENTER, so piping here hangs forever with no
  // output. Inheriting lets npm talk to whoever is running this. In CI there is
  // no TTY and no prompt: the OIDC token authenticates, and npm's output goes
  // to the job log, which is where it belongs anyway.
  try {
    console.log(`  ${name}: moving latest ${current ?? '(unset)'} → ${version}`);
    execFileSync('npm', ['dist-tag', 'add', `${name}@${version}`, 'latest', ...(otp ? [otp] : [])], { stdio: 'inherit' });
    moved++;
  } catch (err) {
    errors.push(`${name}: could not move latest — ${npmError(err)} (npm's own output is above)`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(`✖ latest-tag: ${e}`);
  process.exit(1);
}
console.log(
  `✔ latest tag${dryRun ? ' (dry run)' : ''}: ${moved} moved, ${leftAlone} left as-is, across ${packages.length} packages`,
);
