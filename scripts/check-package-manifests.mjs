#!/usr/bin/env node
/**
 * Publishable-manifest guard for packages/*.
 *
 * Exists because a real defect shipped: `@transtyle/cli` declared
 * `"bin": { "transtyle": "./src/main.js" }`, and npm rewrites or rejects a bin
 * path it considers unclean at publish time. Depending on the npm version that
 * is either a silent "script name was cleaned" or a
 * "script name ... was invalid and removed" — and the second one publishes a
 * CLI package with no CLI in it. Nothing in the repo noticed, because every
 * check ran against the workspace, where `npm link` had already wired the
 * binary up and the field was never consulted.
 *
 * The checks are all things that are invisible in the workspace and only bite
 * a consumer who installs the tarball:
 *   - publishConfig.access — a scoped package defaults to RESTRICTED, so a
 *     missing one either fails the publish or, worse, succeeds privately
 *   - repository/homepage/bugs — npm matches `repository` for provenance
 *   - files — the allowlist must exist, and everything the package needs to
 *     RUN must be inside it (entry points are checked; runtime data files are
 *     the reason `files` is reviewed by hand)
 *   - bin — must resolve, live inside `files`, carry a shebang, and be written
 *     in the form npm normalizes to, so npm never has to "correct" anything
 *
 * Run: node scripts/check-package-manifests.mjs (also: npm run check:manifests).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const errors = [];
const fail = (pkg, m) => errors.push(`${pkg}: ${m}`);

/** Is `target` covered by one of the `files` allowlist entries? */
const coveredByFiles = (files, target) =>
  files.some((f) => {
    const entry = normalize(f).replace(/\/$/, '');
    return target === entry || target.startsWith(`${entry}/`);
  });

const pkgDir = join(root, 'packages');
let checked = 0;

for (const d of readdirSync(pkgDir)) {
  const manifestPath = join(pkgDir, d, 'package.json');
  if (!existsSync(manifestPath)) continue;
  const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (pkg.private) continue;
  checked++;
  const name = pkg.name;
  const dir = join(pkgDir, d);

  // --- npm metadata a published package needs -------------------------------
  if (pkg.publishConfig?.access !== 'public') {
    fail(name, 'publishConfig.access must be "public" — a scoped package defaults to restricted');
  }
  for (const field of ['repository', 'homepage', 'bugs']) {
    if (!pkg[field]) fail(name, `missing "${field}" (npm matches repository when attaching provenance)`);
  }

  // --- the files allowlist --------------------------------------------------
  const files = pkg.files;
  if (!Array.isArray(files) || files.length === 0) {
    fail(name, 'missing a "files" allowlist — without one the tarball ships test fixtures and dev tooling');
    continue;
  }
  for (const f of files) {
    if (!existsSync(join(dir, f))) fail(name, `"files" lists ${f}, which does not exist`);
  }

  // --- entry points must resolve AND be inside the allowlist ----------------
  const entries = [];
  if (pkg.main) entries.push(['main', pkg.main]);
  for (const [k, v] of Object.entries(pkg.exports ?? {})) {
    if (typeof v === 'string') entries.push([`exports["${k}"]`, v]);
  }
  for (const [label, rel] of entries) {
    const target = normalize(rel.replace(/^\.\//, ''));
    if (!existsSync(join(dir, target))) fail(name, `${label} points at ${rel}, which does not exist`);
    else if (!coveredByFiles(files, target)) fail(name, `${label} points at ${rel}, which "files" does not include — it would be missing from the tarball`);
  }

  // --- bin: the field that actually broke -----------------------------------
  for (const [cmd, rel] of Object.entries(pkg.bin ?? {})) {
    if (rel.startsWith('./')) {
      fail(
        name,
        `bin["${cmd}"] is "${rel}" — npm normalizes this at publish time and, depending on the npm version, may drop the entry entirely, publishing a CLI with no command. Write it as "${rel.slice(2)}".`,
      );
    }
    const target = normalize(rel.replace(/^\.\//, ''));
    const abs = join(dir, target);
    if (!existsSync(abs)) {
      fail(name, `bin["${cmd}"] points at ${rel}, which does not exist`);
      continue;
    }
    if (!coveredByFiles(files, target)) {
      fail(name, `bin["${cmd}"] points at ${rel}, which "files" does not include — installs would have a dangling command`);
    }
    if (!readFileSync(abs, 'utf8').startsWith('#!')) {
      fail(name, `bin["${cmd}"] target ${rel} has no #! shebang — it will not run when npm links it`);
    }
    if (!(statSync(abs).mode & 0o111)) {
      fail(name, `bin["${cmd}"] target ${rel} is not executable`);
    }
  }
}

if (errors.length) {
  for (const e of errors) console.error(`✖ manifest: ${e}`);
  process.exit(1);
}
console.log(`✔ package manifests: ${checked} publishable packages — access, provenance metadata, files allowlist, entry points and bin all resolve`);
