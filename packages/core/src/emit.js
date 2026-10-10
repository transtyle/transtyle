/**
 * Atomic staging and swap for EMIT (docs/architecture/pipeline.md, section 5).
 *
 * `commitOutputs` takes every target's complete file list and either puts all of
 * it in place or leaves every output directory exactly as it was:
 *
 *   1. STAGE: each file is written under `<output>.transtyle-tmp/`, a sibling of
 *      its output directory (same filesystem, so the swap is a rename). Nothing
 *      under a real output directory is touched yet, so a failure here costs
 *      nothing.
 *   2. SWAP: each staged file is renamed onto its destination. A file that
 *      already exists is first moved to `<output>.transtyle-bak/`. Every step is
 *      journaled; on the first failure the journal is replayed backwards, which
 *      restores replaced files, removes new ones and removes directories this
 *      build created.
 *   3. Both staging directories are removed, on success and on failure.
 *
 * Files in an output directory that this build does not produce are never
 * moved or deleted (orphan cleanup is still specced; src/manifest.js only lists
 * them as stale), which is why the swap is per file rather than per directory. Zero dependencies, no timestamps
 * or randomness: the temp names are fixed, so a leftover from a killed process
 * is cleared by the next build.
 */

import path from 'node:path';
import { copyFile, mkdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';

export const STAGE_SUFFIX = '.transtyle-tmp';
export const BACKUP_SUFFIX = '.transtyle-bak';

// Windows (and some network or overlay filesystems) refuse a rename that a
// POSIX one accepts; copy + delete is the portable fallback.
const FALLBACK_CODES = new Set(['EXDEV', 'EPERM', 'EACCES', 'EBUSY']);

async function move(from, to) {
  try {
    await rename(from, to);
  } catch (err) {
    if (!FALLBACK_CODES.has(err.code)) throw err;
    await copyFile(from, to);
    await unlink(from);
  }
}

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

/**
 * @param {{ outDir: string, files: { path: string, contents: string }[] }[]} plans
 *   absolute output directories with every file to write, in emission order.
 */
export async function commitOutputs(plans) {
  const staged = [];
  const journal = []; // { dest, backup | null }
  const createdDirs = []; // outermost directory each mkdir created, in order

  try {
    // 1. STAGE
    for (const { outDir, files } of plans) {
      const tmp = outDir + STAGE_SUFFIX;
      // The staging directory sits next to the output, so its parents may be new too.
      const madeParent = await mkdir(path.dirname(outDir), { recursive: true });
      if (madeParent) createdDirs.push(madeParent);
      await rm(tmp, { recursive: true, force: true });
      await rm(outDir + BACKUP_SUFFIX, { recursive: true, force: true });
      for (const f of files) {
        const src = path.join(tmp, f.path);
        await mkdir(path.dirname(src), { recursive: true });
        await writeFile(src, f.contents, 'utf8');
        staged.push({ src, dest: path.join(outDir, f.path), outDir });
      }
    }

    // 2. SWAP
    for (const { src, dest, outDir } of staged) {
      const made = await mkdir(path.dirname(dest), { recursive: true });
      if (made) createdDirs.push(made);
      let backup = null;
      if (await exists(dest)) {
        backup = path.join(outDir + BACKUP_SUFFIX, path.relative(outDir, dest));
        await mkdir(path.dirname(backup), { recursive: true });
        await move(dest, backup);
        journal.push({ dest, backup });
      } else {
        journal.push({ dest, backup: null });
      }
      await move(src, dest);
    }
  } catch (err) {
    for (const { dest, backup } of journal.reverse()) {
      await rm(dest, { force: true }).catch(() => {});
      if (backup) await move(backup, dest).catch(() => {});
    }
    for (const dir of createdDirs.reverse()) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
    throw err;
  } finally {
    // 3. CLEAN UP
    for (const { outDir } of plans) {
      await rm(outDir + STAGE_SUFFIX, { recursive: true, force: true }).catch(() => {});
      await rm(outDir + BACKUP_SUFFIX, { recursive: true, force: true }).catch(() => {});
    }
  }
}

/**
 * Write what `compileProject()` returned (pipeline.js) under `cwd`: each
 * result's `files` into its `output` directory, all targets at once through
 * `commitOutputs`, so a failed write leaves every directory as it was. It
 * writes exactly the files it is given and does not look at diagnostics:
 * `compile()` only calls it for a run without errors, and adds each target's
 * `transtyle-manifest.json` (manifest.js) to its files first.
 */
export async function writeResults(results, cwd) {
  const plans = results
    .filter((r) => r.files.length > 0)
    .map((r) => ({ outDir: path.resolve(cwd, r.output), files: r.files }));
  if (plans.length > 0) await commitOutputs(plans);
}
