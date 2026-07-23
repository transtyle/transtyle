#!/usr/bin/env node
/**
 * Encoding guard for tracked text files.
 *
 * Exists because a real defect got through: two NUL bytes landed inside a
 * template literal in packages/exporter-bootstrap/src/components.js and
 * survived three commits (docs/worklog/2026-07-23-overlay-scrim-pass.md).
 * JavaScript accepts NUL in a string, so every test passed and every emitted
 * artifact was correct — but git recorded the file as `Bin 0 -> 10525 bytes`,
 * meaning it was committed with NO reviewable diff, and `grep` reported
 * "Binary file matches" instead of showing lines. The damage was to
 * reviewability, which no other check in this repo was looking at.
 *
 * Checks every git-tracked file that isn't a known binary type for:
 *   - NUL bytes        — makes git/grep/GitHub treat the source as binary
 *   - invalid UTF-8    — mojibake, and the same tooling breakage
 *   - a UTF-8 BOM      — breaks shebangs and JSON parsers
 *
 * Run: node scripts/check-encoding.mjs (also: npm run check:encoding).
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Extensions whose contents are legitimately binary — skipped wholesale. */
const BINARY_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.ico',
  '.icns',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.pdf',
  '.zip',
  '.gz',
  '.tgz',
  '.mp4',
  '.webm',
  '.mp3',
  '.wav',
]);

const files = execSync('git ls-files -z', { cwd: root, maxBuffer: 64 * 1024 * 1024 })
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
  .filter((f) => !BINARY_EXT.has(extname(f).toLowerCase()));

const decoder = new TextDecoder('utf8', { fatal: true });
const errors = [];

for (const file of files) {
  let buf;
  try {
    buf = readFileSync(join(root, file));
  } catch {
    continue; // submodule / broken symlink — not this check's business
  }

  const nul = buf.indexOf(0);
  if (nul >= 0) {
    const line = buf.subarray(0, nul).toString('utf8').split('\n').length;
    const near = buf
      .subarray(Math.max(0, nul - 40), nul + 20)
      .toString('utf8')
      .replace(/\0/g, '␀')
      .replace(/\n/g, '⏎');
    errors.push(
      `${file}:${line} contains a NUL byte (offset ${nul}) — git and grep will treat this file as binary\n      near: …${near}…`,
    );
    continue;
  }

  try {
    decoder.decode(buf);
  } catch {
    errors.push(`${file} is not valid UTF-8`);
    continue;
  }

  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    errors.push(`${file} starts with a UTF-8 BOM — breaks shebangs and strict JSON parsers`);
  }
}

if (errors.length) {
  console.error(`✖ check-encoding failed — ${errors.length} file(s):\n`);
  for (const e of errors) console.error('  - ' + e);
  console.error(
    '\n  A NUL byte usually comes from a shell heredoc or an escaped-string write mangling a\n  literal; replace it with the character it should have been (often a space).',
  );
  process.exit(1);
}
console.log(
  `✔ encoding: ${files.length} tracked text files are clean UTF-8 (no NUL bytes, no BOM)`,
);
