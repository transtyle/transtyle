/**
 * `transtyle add <npm package>` (docs/specs/cli.md, docs/architecture/plugins.md#trust-model).
 *
 * The helpers behind adding a community exporter: what counts as a package
 * name, reading its manifest before anything is installed (no code runs: the
 * registry's metadata, or the package.json inside a local tarball), the
 * summary the user reads, the confirmation a code package needs, and the one
 * `npm install` call. Nothing here passes a name through a shell.
 */

import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import process from 'node:process';

/** An exact npm package name, scoped or not (new-package rules: lowercase, at most 214 characters). */
const NPM_NAME = /^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/;
/** What a manifest `name` may be: it becomes a config key and a directory name. */
const TARGET_NAME = /^[a-z0-9][a-z0-9-]*$/;

export const isNpmName = (s) => typeof s === 'string' && s.length <= 214 && NPM_NAME.test(s);
export const isTargetName = (s) => typeof s === 'string' && TARGET_NAME.test(s);

/** A local tarball (`npm pack` output): a path ending in .tgz or .tar.gz. */
export const isTarballPath = (s) => /\.(tgz|tar\.gz)$/.test(s) && (s.includes('/') || s.includes('\\') || existsSync(s));

const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
// npm.cmd cannot be spawned without a shell on Windows, so there a spec must be
// plain characters: a validated name or a simple path, never a shell word.
const SHELL_SAFE = /^[\w@./\\:~-]+$/;
const shellOpts = process.platform === 'win32' ? { shell: true } : {};

/**
 * `{ name, version, manifest }` of the package a spec names, read without
 * installing or running anything. Throws an Error with a message for the user.
 * `manifest` is the package.json `transtyle` field, or undefined.
 */
export function readRemoteManifest(spec, { tarball, cwd }) {
  if (tarball) {
    let json;
    try {
      const out = execFileSync('tar', ['-xzOf', tarball, 'package/package.json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      json = JSON.parse(out);
    } catch (e) {
      throw new Error(`Cannot read package/package.json from ${tarball}: ${(e.stderr || e.message).toString().trim().split('\n')[0]}`);
    }
    return { name: json.name, version: json.version, manifest: json.transtyle };
  }
  if (process.platform === 'win32' && !SHELL_SAFE.test(spec)) throw new Error(`Unsupported characters in "${spec}"`);
  let out;
  try {
    out = execFileSync(npmBin, ['view', spec, 'name', 'version', 'transtyle', '--json'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...shellOpts });
  } catch (e) {
    const err = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    if (/E404|404 Not Found|not in this registry/.test(err)) throw new Error(`Package "${spec}" was not found on the npm registry`);
    throw new Error(`Cannot read "${spec}" from the npm registry: ${err.split('\n').find((l) => l.includes('npm error')) ?? e.message}`);
  }
  if (!out.trim()) throw new Error(`Package "${spec}" was not found on the npm registry`);
  const json = JSON.parse(out);
  return { name: json.name ?? spec, version: json.version, manifest: json.transtyle };
}

/** The manifest as lines for the user: what the package says it is, before it is installed. */
export function describeManifest({ name, version }, m) {
  const list = (v) => (Array.isArray(v) ? v.join(', ') : String(v));
  const targets = m.targets && typeof m.targets === 'object'
    ? Object.entries(m.targets).map(([t, ranges]) => `${t} ${list(ranges)}`).join('; ')
    : undefined;
  const rows = [
    ['package', `${name}${version ? ` ${version}` : ''}`],
    ['kind', m.kind],
    ['name', m.name],
    ['irSpec', m.irSpec],
    ['pluginApi', m.pluginApi],
    ['targets', targets],
    ['modes', m.modes === undefined ? undefined : list(m.modes)],
    ['capabilities', m.capabilities === undefined ? undefined : list(m.capabilities)],
    ['declarative', m.declarative],
  ].filter(([, v]) => v !== undefined && v !== '');
  const width = Math.max(...rows.map(([k]) => k.length));
  return rows.map(([k, v]) => `  ${k.padEnd(width)}  ${v}`);
}

/** Key-sorted JSON, so two manifests compare equal whatever order their keys came in. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Ask a yes/no question on the terminal; anything but y/yes is no. */
export async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: false });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

/** Install a package as a dev dependency without running its install scripts. Throws with npm's own output. */
export function installPackage(installSpec, cwd) {
  if (process.platform === 'win32' && !SHELL_SAFE.test(installSpec)) throw new Error(`Unsupported characters in "${installSpec}"`);
  try {
    execFileSync(npmBin, ['install', '--save-dev', '--ignore-scripts', '--no-audit', '--no-fund', installSpec], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...shellOpts });
  } catch (e) {
    throw new Error(`npm install failed:\n${`${e.stdout ?? ''}${e.stderr ?? ''}`.trim().split('\n').map((l) => `    ${l}`).join('\n')}`);
  }
}

/** The installed package's package.json, read from `dir`. */
export const readPackageJson = (dir) => JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
