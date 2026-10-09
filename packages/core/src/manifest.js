/**
 * The emitted-file manifest (docs/architecture/pipeline.md, section 5; issue #10).
 *
 * Each build writes `transtyle-manifest.json` in every target's output
 * directory, in the same atomic swap as the files it describes (src/emit.js):
 * a sha256 of each file the exporter produced, keyed by its path inside the
 * output directory. `report.json` and the manifest itself are not listed: the
 * first is the record of a run, not a file anyone consumes or edits.
 *
 * What it buys, read back before anything is written:
 *
 *   - drift (`TST1312`, warning): a listed file whose bytes no longer match, or
 *     that is gone, was changed outside transtyle since the last build. Only
 *     `build` and `check` ask for it (`compile({ drift: true })`), so `explain`,
 *     `diff` and API callers keep their output.
 *   - stale files: a file the previous manifest lists that this build does not
 *     produce any more. It is left in place (deleting files is orphan cleanup,
 *     still specced) and returned per target so the CLI can say so.
 *
 * Deterministic: keys sorted, no timestamp, no tool version. Hashes are taken
 * over the text with CRLF turned into LF on both sides, so a checkout with
 * `core.autocrlf` does not report every file as edited. Zero dependencies
 * (`node:crypto`).
 */

import path from 'node:path';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { validate } from './schema/validate.js';
import { manifestSchema, MANIFEST_SCHEMA_URL } from './schema/manifest.schema.js';

export const MANIFEST_FILE = 'transtyle-manifest.json';

/** sha256 of the text, line endings normalized to LF. */
export function hashContents(text) {
  return createHash('sha256').update(String(text).replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

/** Paths inside a manifest always use `/`, whatever the platform. */
const posix = (p) => p.split(path.sep).join('/');

/** The manifest of one target, as the bytes core writes. */
export function renderManifest(target, files) {
  const entries = files
    .map((f) => [posix(path.normalize(f.path)), hashContents(f.contents)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const manifest = {
    $schema: MANIFEST_SCHEMA_URL,
    target,
    algorithm: 'sha256',
    files: Object.fromEntries(entries),
  };
  return JSON.stringify(manifest, null, 2) + '\n';
}

/** A manifest key must stay inside its output directory. */
function escapes(key) {
  if (path.isAbsolute(key) || /^[a-zA-Z]:/.test(key)) return true;
  const n = path.posix.normalize(key);
  return n === '..' || n.startsWith('../');
}

/**
 * Read the previous manifest of each selected, configured target, in the
 * directory the build writes to (`<outRoot>/<name>` under `build --out`). Returns a Map
 * of instance name → `{ outDir, manifest, problem }`: `manifest` is the parsed
 * object (null when there is none, or it can't be used), `problem` says why an
 * existing manifest can't be used. A manifest written by another instance that
 * shares the directory, or by an instance since renamed, is not this target's:
 * it is ignored, as if absent.
 */
export async function readManifests(cwd, config, names, outRoot) {
  const out = new Map();
  for (const name of names) {
    const targetConfig = config.targets?.[name];
    if (!targetConfig || out.has(name)) continue;
    const outDir = outRoot ? path.resolve(outRoot, name) : path.resolve(cwd, targetConfig.output ?? `dist/${name}`);
    const entry = { outDir, manifest: null, problem: null };
    out.set(name, entry);
    let text;
    try {
      text = await readFile(path.join(outDir, MANIFEST_FILE), 'utf8');
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') entry.problem = `cannot be read: ${err.code ?? err.message}`;
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      entry.problem = 'is not valid JSON';
      continue;
    }
    const errors = validate(parsed, manifestSchema);
    if (errors.length > 0) {
      const { path: p, message } = errors[0];
      entry.problem = `does not match its schema (${p === '(root)' ? '' : p + ' '}${message})`;
      continue;
    }
    const outside = Object.keys(parsed.files).find(escapes);
    if (outside !== undefined) {
      entry.problem = `lists a path outside its directory (${outside})`;
      continue;
    }
    if (parsed.target !== name) continue;
    entry.manifest = parsed;
  }
  return out;
}

/**
 * TST1312: compare what each previous manifest recorded with the disk, before
 * anything is written. One warning per file (edited or missing) and one per
 * manifest that can't be used; a target without a manifest is silent (never
 * built, built before manifests existed, or its output isn't committed).
 */
export async function reportDrift(manifests, cwd, diagnostics) {
  for (const [name, { outDir, manifest, problem }] of manifests) {
    const rel = (p) => posix(path.relative(cwd, p));
    const dirRel = rel(outDir);
    if (problem) {
      diagnostics.warn('TST1312', `${name}: ${rel(path.join(outDir, MANIFEST_FILE))} ${problem}, so its files cannot be checked for changes`, {
        target: name,
        hint: `\`transtyle build ${name}\` writes a new one.`,
      });
      continue;
    }
    if (!manifest) continue;
    for (const key of Object.keys(manifest.files).sort()) {
      const file = path.join(outDir, key);
      let text;
      try {
        text = await readFile(file, 'utf8');
      } catch (err) {
        if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR' && err.code !== 'EISDIR') throw err;
        diagnostics.warn('TST1312', `${name}: ${rel(file)} is listed in ${MANIFEST_FILE} but missing`, {
          target: name,
          hint: `\`transtyle build ${name}\` writes it again.`,
        });
        continue;
      }
      if (hashContents(text) === manifest.files[key]) continue;
      diagnostics.warn('TST1312', `${name}: ${rel(file)} was changed outside transtyle since the last build`, {
        target: name,
        hint: `\`transtyle build ${name}\` overwrites it with the generated file. Make the change in the tokens or the config to keep it; if a formatter or linter rewrote it, exclude ${dirRel}/ from that tool.`,
      });
    }
  }
}

/**
 * Files the previous manifest lists that this build does not produce, and
 * that are still on disk: they stay where they are (nothing is deleted), and
 * the new manifest no longer lists them. Paths relative to `cwd`, sorted.
 */
export async function staleFiles(previous, files, cwd) {
  if (!previous?.manifest) return [];
  const produced = new Set(files.map((f) => posix(path.normalize(f.path))));
  const stale = [];
  for (const key of Object.keys(previous.manifest.files).sort()) {
    if (produced.has(key)) continue;
    const file = path.join(previous.outDir, key);
    try {
      if ((await stat(file)).isFile()) stale.push(posix(path.relative(cwd, file)));
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') throw err;
    }
  }
  return stale;
}
