/**
 * Loading `apca-w3` from disk (docs/adr/0013-apca-optional-peer.md): the Node
 * half of contrast.js, so the browser entry never reaches `node:module`.
 * compile() hands `loadApca(cwd)` to compileProject() as its `apcaLoader`.
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { APCA_PACKAGE, contrastFor, needsApca } from './contrast.js';

/**
 * Load `apca-w3`: from the project first (where the user installs it), then
 * from wherever core itself resolves packages. Returns `{ lib, version }`, or
 * throws with every place tried. `importer` is for tests.
 */
export async function loadApca(cwd, { importer } = {}) {
  if (importer) return importer();
  const tried = [];
  const from = [
    ['the project', cwd && createRequire(path.join(cwd, 'noop.js'))],
    ['the transtyle install', createRequire(import.meta.url)],
  ];
  for (const [where, req] of from) {
    if (!req) continue;
    try {
      const entry = req.resolve(APCA_PACKAGE);
      const lib = await import(pathToFileURL(entry).href);
      let version = 'unknown';
      try {
        version = JSON.parse(readFileSync(req.resolve(`${APCA_PACKAGE}/package.json`), 'utf8')).version;
      } catch {
        // apca-w3 0.1.x exposes package.json; a fork that doesn't still measures.
      }
      return { lib, version };
    } catch (e) {
      tried.push(`from ${where}: ${e.code ?? e.message}`);
    }
  }
  const err = new Error(tried.join('; '));
  err.code = 'APCA_NOT_FOUND';
  throw err;
}

/**
 * Both contrast objects a compile needs (contrast.js `contrastFor`), loading
 * APCA from `cwd` when the config asks for it. Throws like loadApca when APCA
 * is configured but missing.
 */
export async function loadContrast(config, cwd, options) {
  return contrastFor(config, needsApca(config) ? await loadApca(cwd, options) : null);
}
