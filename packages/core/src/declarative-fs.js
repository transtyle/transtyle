/**
 * The disk side of declarative exporters (issue #82, ADR-0016): reading a
 * mapping file, or the mapping of an installed package. Kept apart from
 * declarative.js so the browser entry never reaches a Node built-in.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createDeclarativeExporter } from './declarative.js';

/**
 * Read and parse a mapping file. Never throws: `{ mapping, error }`, where
 * `error` (a string) says why the file couldn't be read or parsed.
 */
export function readMappingFile(file) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    return { mapping: null, error: `cannot read ${file}: ${e.code ?? e.message}` };
  }
  try {
    return { mapping: JSON.parse(text), error: null };
  } catch (e) {
    return { mapping: null, error: `not valid JSON: ${e.message}` };
  }
}

/**
 * Load a declarative exporter package from its directory, without importing
 * any of its code: `{ plugin, manifest, package }`, the shape `compile()`'s
 * `loadExporter` returns. The manifest's `declarative` path must stay inside
 * the package; a missing or unreadable mapping is carried on the plugin and
 * reported by `compile()` as TST1014.
 */
export function loadDeclarativePackage(dir) {
  const json = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const rel = json.transtyle?.declarative;
  const pkg = { name: json.name, version: json.version };
  const source = `${json.name}/${rel}`;
  const file = path.resolve(dir, String(rel));
  let read;
  if (typeof rel !== 'string' || !file.startsWith(path.resolve(dir) + path.sep)) {
    read = { mapping: null, error: `the manifest's "declarative" must be a path inside the package, got ${JSON.stringify(rel)}` };
  } else {
    read = readMappingFile(file);
  }
  return { plugin: createDeclarativeExporter(read.mapping, { source, error: read.error, fallbackName: json.transtyle?.name }), manifest: json.transtyle, package: pkg };
}
