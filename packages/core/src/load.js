/** LOAD stage: config discovery + token file reading (docs/architecture/pipeline.md#1-load). */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export async function loadConfig(cwd) {
  const file = path.join(cwd, 'transtyle.config.json');
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    throw new Error(`No transtyle.config.json found in ${cwd}`);
  }
  const config = JSON.parse(raw);
  if (!config.tokens?.length) throw new Error('Config error: "tokens" must list at least one glob.');
  return { config, configPath: file };
}

/** Minimal glob: supports literal paths and single-`*` segments (e.g. "tokens/*.tokens.json"). */
async function expandGlob(cwd, pattern) {
  if (pattern.includes('**')) throw new Error(`Skeleton glob does not support "**": ${pattern}`);
  const segs = pattern.split('/');
  let paths = [cwd];
  for (const seg of segs) {
    const next = [];
    for (const p of paths) {
      if (seg.includes('*')) {
        const re = new RegExp('^' + seg.split('*').map(escapeRe).join('.*') + '$');
        let entries = [];
        try { entries = await readdir(p, { withFileTypes: true }); } catch { /* missing dir */ }
        for (const e of entries) if (re.test(e.name)) next.push(path.join(p, e.name));
      } else {
        next.push(path.join(p, seg));
      }
    }
    paths = next;
  }
  return paths.sort(); // deterministic order
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Token entries are strings (globs) or objects `{ files, mode }` — the latter
 * declares a mode-scoped layer: a pure DTCG file whose values apply to one
 * mode of one dimension (docs/specs/configuration.md#token-layering).
 */
export async function loadTokenTrees(cwd, entries, diagnostics) {
  const trees = [];
  for (const entry of entries) {
    const globs = typeof entry === 'string' ? [entry] : [].concat(entry.files);
    const modeScope = typeof entry === 'string' ? undefined : entry.mode;
    for (const g of globs) {
      const files = await expandGlob(cwd, g);
      if (files.length === 0) diagnostics.warn('TST1001', `Token glob matched no files: ${g}`);
      for (const f of files) {
        try {
          trees.push({ file: path.relative(cwd, f), tree: JSON.parse(await readFile(f, 'utf8')), modeScope });
        } catch (e) {
          diagnostics.error('TST1002', `Failed to parse ${f}: ${e.message}`);
        }
      }
    }
  }
  return trees;
}
