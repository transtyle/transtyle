/**
 * Contrast standards (docs/specs/validation-and-coverage.md#contrast,
 * docs/adr/0013-apca-optional-peer.md).
 *
 * One object per standard answers every contrast question the compiler asks:
 * how to measure a foreground on a background, how big a measurement is, the
 * minimum for a pair's use, and how to print both. `check` (TST2101), `diff`'s
 * contrast regressions and DERIVE's on-color picks all go through it, so they
 * can never disagree on what "passing" means.
 *
 * WCAG 2.1 is built in. APCA is not reimplemented here: its licence
 * (apca-w3's LICENSE.md) allows it only unmodified, kept current, and for web
 * content, so core loads the `apca-w3` package from the user's install, an
 * optional peer dependency, when the config asks for it.
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { contrastRatio, formatHex } from './color.js';

/** Values of `check.contrast.standard`. */
export const CONTRAST_STANDARDS = ['wcag21-aa', 'wcag21-aaa', 'apca'];
export const DEFAULT_CONTRAST_STANDARD = 'wcag21-aa';
/** Values of `derivation.contrast` (the method DERIVE picks on-colors with). */
export const DERIVATION_CONTRAST = ['wcag21', 'apca'];

/** The APCA package core loads, and the base algorithm its 0.1.x line implements. */
export const APCA_PACKAGE = 'apca-w3';
export const APCA_BASE_ALGORITHM = '0.0.98G-4g';

/**
 * APCA Bronze simple mode, by use: Lc 75 for body text, Lc 60 for other
 * content text (secondary text, labels, buttons, badges). WCAG 2.1 has one
 * minimum for all text and ignores the use.
 */
export const APCA_LEVELS = { body: 75, content: 60 };
const WCAG_MIN = { 'wcag21-aa': 4.5, 'wcag21-aaa': 7 };

// Round toward zero to one decimal, so a value just under a threshold never
// prints as the threshold itself (4.47 must not read "4.5:1", Lc 59.96 must not
// read "Lc 60").
const toward0 = (n) => Math.trunc(n * 10) / 10 || 0;

/** WCAG 2.1: the contrast ratio, order-independent, one minimum for every use. */
export function wcagContrast(standard = DEFAULT_CONTRAST_STANDARD) {
  const min = WCAG_MIN[standard] ?? WCAG_MIN[DEFAULT_CONTRAST_STANDARD];
  return {
    standard,
    unit: 'ratio',
    algorithm: 'WCAG 2.1 contrast ratio',
    measure: (fg, bg) => contrastRatio(fg, bg),
    score: (v) => v,
    threshold: () => min,
    format: (v) => `${toward0(v)}:1`,
    formatThreshold: () => `${min}:1`,
    // `diff` reports an already-failing pair as worsened past this drop.
    tolerance: 0.05,
  };
}

/** sRGB 8-bit channels of the hex Transtyle emits for `color` (APCA's input). */
function srgb8(color) {
  const hex = formatHex(color).text;
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/**
 * APCA, from a loaded `apca-w3` module. Lc is signed: positive for dark text
 * on a light background, negative for light on dark. Thresholds compare its
 * magnitude; messages keep the sign, which APCA requires so the polarity shows.
 * Colors are measured as the 8-bit hex Transtyle emits, so a printed Lc matches
 * what the reference implementation gives for the shipped values.
 */
export function apcaContrast(lib, version) {
  const y = (c) => lib.sRGBtoY(srgb8(c));
  const threshold = (use) => APCA_LEVELS[use] ?? APCA_LEVELS.content;
  return {
    standard: 'apca',
    unit: 'Lc',
    algorithm: `APCA ${APCA_BASE_ALGORITHM} (${APCA_PACKAGE} ${version})`,
    measure: (fg, bg) => lib.APCAcontrast(y(fg), y(bg)),
    score: (v) => Math.abs(v),
    threshold,
    format: (v) => `Lc ${toward0(v)}`,
    formatThreshold: (use) => `Lc ${threshold(use)}`,
    tolerance: 1,
  };
}

/** The configured check standard, or the default. */
export function checkStandard(config) {
  return config?.check?.contrast?.standard ?? DEFAULT_CONTRAST_STANDARD;
}

/**
 * The method DERIVE picks on-colors with: `derivation.contrast` when set, else
 * the family of the check standard, so a project that checks under APCA also
 * derives under it and does not warn about values the compiler chose itself.
 */
export function derivationMethod(config) {
  return config?.derivation?.contrast ?? (checkStandard(config) === 'apca' ? 'apca' : 'wcag21');
}

/** Whether this config needs the APCA package at all. */
export function needsApca(config) {
  return checkStandard(config) === 'apca' || derivationMethod(config) === 'apca';
}

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
 * Both contrast objects a compile needs: `check` (TST2101 and diff) and
 * `derive` (on-color picks; WCAG aims at 4.5:1 whatever the check level, as
 * it always has). Throws like loadApca when APCA is configured but missing.
 */
export async function loadContrast(config, cwd, options) {
  const apca = needsApca(config) ? await loadApca(cwd, options) : null;
  const make = (standard) => (standard === 'apca' ? apcaContrast(apca.lib, apca.version) : wcagContrast(standard));
  return {
    check: make(checkStandard(config)),
    derive: make(derivationMethod(config) === 'apca' ? 'apca' : 'wcag21-aa'),
  };
}
