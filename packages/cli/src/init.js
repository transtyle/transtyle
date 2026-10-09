/**
 * `transtyle init`: the answers (flags or prompts) and the files they produce
 * (docs/specs/cli.md, "init"). Kept apart from main.js so the scaffold is a
 * pure function of its inputs (same answers → byte-identical files) and the
 * prompts can be driven by any pair of streams, which is how check-cli tests
 * them without a terminal.
 */

import { createInterface } from 'node:readline';
import { parseColor, formatHex, contrastRatio } from '@transtyle/core';

export const DEFAULT_BRAND = 'oklch(0.55 0.18 255)';
export const PRESETS = ['recommended', 'minimal'];
export const LAYOUTS = ['single', 'layered'];
const SCHEME_SETS = ['light,dark', 'light'];

export const INIT_DEFAULTS = {
  brand: DEFAULT_BRAND,
  schemes: ['light', 'dark'],
  targets: ['css-variables'],
  preset: 'recommended',
  layout: 'single',
};

/** Flags `init` takes a value for, in prompt order. */
export const INIT_VALUE_FLAGS = ['brand', 'schemes', 'targets', 'preset', 'layout'];

export const TOKENS_SCHEMA = 'https://transtyle.dev/schemas/tokens/v0.json';
const CONFIG_SCHEMA = 'https://transtyle.dev/schemas/config/v0.json';

// ---------- validation (one function per answer, shared by flags and prompts) ----------

/**
 * Each returns `{ value }` or `{ error }`. `known` is the CLI's exporter list:
 * `init`, like `add`, only offers targets it can load.
 */
export const validators = {
  brand(raw) {
    const s = String(raw ?? '').trim();
    let color;
    try {
      color = parseColor(s);
    } catch {
      return { error: `"${s}" is not a color. Use any CSS color syntax: #e8590c, oklch(0.62 0.19 45), rgb(232 89 12), a named color.` };
    }
    if ((color.alpha ?? 1) < 1) return { error: `"${s}" is translucent; a brand color has to be opaque.` };
    return { value: s };
  },
  schemes(raw) {
    const parts = [...new Set(String(raw ?? '').split(',').map((p) => p.trim().toLowerCase()).filter(Boolean))];
    const key = ['light', 'dark'].filter((p) => parts.includes(p)).join(',');
    if (parts.length && parts.every((p) => p === 'light' || p === 'dark') && SCHEME_SETS.includes(key)) {
      return { value: key.split(',') };
    }
    return { error: `Unknown color schemes "${raw}". Valid: ${SCHEME_SETS.join(' or ')}.` };
  },
  targets(raw, known) {
    const parts = [...new Set(String(raw ?? '').split(',').map((p) => p.trim()).filter(Boolean))];
    const unknown = parts.filter((p) => !known.includes(p));
    if (!parts.length || unknown.length) {
      const what = unknown.length ? `Unknown target${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}` : 'No target given';
      return { error: `${what}\nValid targets: ${known.join(', ')}` };
    }
    // The registry's order, not the order typed: the config is the same whichever way round they were listed.
    return { value: known.filter((k) => parts.includes(k)) };
  },
  preset(raw) {
    const s = String(raw ?? '').trim();
    return PRESETS.includes(s) ? { value: s } : { error: `Unknown preset "${s}". Valid: ${PRESETS.join(', ')}.` };
  },
  layout(raw) {
    const s = String(raw ?? '').trim();
    return LAYOUTS.includes(s) ? { value: s } : { error: `Unknown layout "${s}". Valid: ${LAYOUTS.join(', ')}.` };
  },
};

/** Validate the flags given on the command line. Returns `{ given, errors }`. */
export function validateFlags(flags, known) {
  const given = {};
  const errors = [];
  for (const key of INIT_VALUE_FLAGS) {
    if (flags[key] === undefined) continue;
    const r = validators[key](flags[key], known);
    if (r.error) errors.push(`--${key}: ${r.error}`);
    else given[key] = r.value;
  }
  return { given, errors };
}

// ---------- prompts ----------

/**
 * Ask for every answer not given by a flag. `input`/`output` are any streams
 * (process.stdin / process.stderr in the CLI: prompts are human output, so
 * they go to stderr like every other log). Lines are read through readline's
 * async iterator, which buffers, so scripted input that arrives all at once
 * is consumed one answer at a time. A wrong answer is explained and asked
 * again; input that ends early rejects with `code: 'input-ended'`, before
 * anything is written.
 */
export async function promptAnswers(given, known, { input, output, color = false }) {
  const rl = createInterface({ input, output, terminal: Boolean(input.isTTY && output.isTTY) });
  const lines = rl[Symbol.asyncIterator]();
  const say = (s = '') => output.write(`${s}\n`);
  const ask = async (question) => {
    output.write(question);
    const { value, done } = await lines.next();
    if (done) {
      const e = new Error('input ended before every question was answered');
      e.code = 'input-ended';
      throw e;
    }
    if (!(input.isTTY && output.isTTY)) output.write('\n');
    return value.trim();
  };
  /** Ask until the answer validates; Enter takes the default. `pick` maps "2" to a choice. */
  const until = async (key, question, fallback, pick = (a) => a) => {
    for (;;) {
      const answer = await ask(question);
      const r = validators[key](answer === '' ? fallback : pick(answer), known);
      if (!r.error) return r.value;
      say(`  ✖ ${r.error.replace(/\n/g, '\n    ')}`);
    }
  };
  const byNumber = (choices) => (a) => (/^\d+$/.test(a) && choices[Number(a) - 1]) || a;

  const answers = { ...given };
  try {
    say('transtyle init — press Enter to take the default in brackets.\n');
    if (answers.brand === undefined) {
      answers.brand = await until('brand', `Brand color, any CSS color (#e8590c, oklch(…), rgb(…)) [${DEFAULT_BRAND}]: `, DEFAULT_BRAND);
      say(`  ${swatch(parseColor(answers.brand), null, color)}\n`);
    }
    if (answers.schemes === undefined) {
      say('Color schemes:\n  1) light and dark\n  2) light only');
      answers.schemes = await until('schemes', 'Choose 1 or 2 [1]: ', 'light,dark', byNumber(SCHEME_SETS));
      say();
    }
    if (answers.targets === undefined) {
      say(`Targets (several allowed: 1,3 or shadcn,bootstrap):\n${known.map((k, i) => `  ${String(i + 1).padStart(2)}) ${k}`).join('\n')}`);
      answers.targets = await until('targets', `Targets [${INIT_DEFAULTS.targets.join(',')}]: `, INIT_DEFAULTS.targets.join(','),
        (a) => a.split(',').map((p) => byNumber(known)(p.trim())).join(','));
      say();
    }
    if (answers.preset === undefined) {
      say('Preset:\n  1) recommended: brand color, page and card backgrounds, text, border, radius and fonts, with dark values\n  2) minimal: the brand color only; everything else derives or defaults');
      answers.preset = await until('preset', 'Choose 1 or 2 [1]: ', INIT_DEFAULTS.preset, byNumber(PRESETS));
      say();
    }
    if (answers.layout === undefined) {
      say('File layout:\n  1) single: one token file in the catalog\'s names (dark values in an overlay file)\n  2) layered: your own names, a dark overlay, and a bindings file that maps catalog slots to them');
      answers.layout = await until('layout', 'Choose 1 or 2 [1]: ', INIT_DEFAULTS.layout, byNumber(LAYOUTS));
      say();
    }
  } finally {
    rl.close();
  }
  return answers;
}

// ---------- the scaffold ----------

/**
 * Neutrals for the `recommended` preset: a fixed lightness ladder at low
 * chroma, in the brand's hue. These are authored values written into the
 * user's file (visible, editable), not derivation: auto-dark stays off and
 * dark values stay the author's call (authoring-tokens.md, "Author dark
 * values for your neutrals"); the scaffold only gives them a starting point.
 * check-cli compiles the ladder on five brands of every kind (orange, pale
 * yellow, near-black, neon green, violet) and requires no contrast warning
 * on a neutral pair in either mode.
 */
const NEUTRALS = [
  // [path under semantic.color, layered name, light [l, c], dark [l, c], TODO text]
  [['elevation', '0', 'surface'], 'page', [1, 0], [0.17, 0.006], 'the page background'],
  [['elevation', '1', 'surface'], 'card', [0.985, 0.003], [0.21, 0.006], 'card/panel background'],
  [['text', 'base'], 'ink', [0.21, 0.01], [0.97, 0.004], 'body text color'],
  [['text', 'muted'], 'ink-muted', [0.5, 0.01], [0.72, 0.01], 'muted/secondary text color'],
  [['border'], 'line', [0.9, 0.006], [0.32, 0.01], 'default border color'],
];

/** The brand's hue, or none for a gray brand (its hue is noise). */
function neutralHue(brand) {
  const { c, h } = parseColor(brand);
  return c < 0.02 || !Number.isFinite(h) ? null : Math.round(h) % 360;
}

function oklch([l, c], hue) {
  return hue === null || c === 0 ? `oklch(${l} 0 0)` : `oklch(${l} ${c} ${hue})`;
}

function setPath(obj, keys, value) {
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] ??= {};
  o[keys.at(-1)] = value;
}

const td = (value, description) => (description ? { $value: value, $description: description } : { $value: value });
const BRAND_TODO = 'TODO: your brand color — the one non-negotiable input';
const json = (data) => JSON.stringify(data, null, 2) + '\n';

/**
 * The files `init` writes, as `[{ path, contents }]` in write order, from
 * validated answers. Pure: no clock, no randomness, no filesystem.
 */
export function scaffold({ name, brand, schemes, targets, preset, layout }) {
  const dark = schemes.includes('dark');
  const recommended = preset === 'recommended';
  const layered = layout === 'layered';
  const hue = neutralHue(brand);
  const files = [];
  const tokenEntries = [];

  const darkPath = 'tokens/brand.dark.tokens.json';
  const darkEntry = { files: darkPath, mode: { 'color-scheme': 'dark' } };
  const writesDark = dark && recommended;

  if (!layered) {
    // One file in the catalog's names, plus the dark overlay.
    const color = { $type: 'color', primary: { solid: td('{option.color.brand.500}', BRAND_TODO) } };
    const darkColor = { $type: 'color' };
    if (recommended) {
      for (const [keys, , light, darkLc, todo] of NEUTRALS) {
        setPath(color, keys, td(oklch(light, hue), `TODO: ${todo}`));
        setPath(darkColor, keys, td(oklch(darkLc, hue)));
      }
    }
    const semantic = { color };
    if (recommended) {
      semantic.radius = { md: { $type: 'dimension', $value: '0.5rem' } };
      semantic.font = {
        sans: { $type: 'fontFamily', $value: ['system-ui', 'sans-serif'] },
        mono: { $type: 'fontFamily', $value: ['ui-monospace', 'monospace'] },
      };
    }
    files.push({ path: 'tokens/brand.tokens.json', data: {
      $schema: TOKENS_SCHEMA,
      option: { color: { $type: 'color', brand: { 500: td(brand) } } },
      semantic,
    } });
    tokenEntries.push('tokens/brand.tokens.json');
    if (writesDark) {
      files.push({ path: darkPath, data: { $schema: TOKENS_SCHEMA, semantic: { color: darkColor } } });
      tokenEntries.push(darkEntry);
    }
  } else {
    // The adoption guide's layered layout: your names (source of truth), a dark
    // overlay of those names, and bindings from catalog slots to them.
    const ui = { brand: td('{option.color.brand.500}', BRAND_TODO) };
    const darkUi = {};
    const bindings = { $type: 'color', primary: { solid: td('{semantic.color.ui.brand}') } };
    const option = { color: { $type: 'color', brand: { 500: td(brand) } } };
    if (recommended) {
      for (const [keys, own, light, darkLc, todo] of NEUTRALS) {
        ui[own] = td(oklch(light, hue), `TODO: ${todo}`);
        darkUi[own] = td(oklch(darkLc, hue));
        setPath(bindings, keys, td(`{semantic.color.ui.${own}}`));
      }
      option.radius = { md: { $type: 'dimension', $value: '0.5rem' } };
      option.font = {
        sans: { $type: 'fontFamily', $value: ['system-ui', 'sans-serif'] },
        mono: { $type: 'fontFamily', $value: ['ui-monospace', 'monospace'] },
      };
    }
    files.push({ path: 'tokens/brand.tokens.json', data: {
      $schema: TOKENS_SCHEMA,
      option,
      semantic: { color: { $type: 'color', ui } },
    } });
    tokenEntries.push('tokens/brand.tokens.json');
    if (writesDark) {
      files.push({ path: darkPath, data: { $schema: TOKENS_SCHEMA, semantic: { color: { $type: 'color', ui: darkUi } } } });
      tokenEntries.push(darkEntry);
    }
    const bound = { $schema: TOKENS_SCHEMA, semantic: { color: bindings } };
    if (recommended) {
      bound.semantic.radius = { md: { $type: 'dimension', $value: '{option.radius.md}' } };
      bound.semantic.font = {
        sans: { $type: 'fontFamily', $value: '{option.font.sans}' },
        mono: { $type: 'fontFamily', $value: '{option.font.mono}' },
      };
    }
    files.push({ path: 'tokens/transtyle.bindings.tokens.json', data: bound });
    tokenEntries.push('tokens/transtyle.bindings.tokens.json');
  }

  // Every token file is listed by name: a glob such as `tokens/*.tokens.json`
  // would match nothing more today, but the next file the user drops in the
  // folder would join the base layer silently.
  const config = {
    $schema: CONFIG_SCHEMA,
    name,
    tokens: tokenEntries,
    modes: { 'color-scheme': { values: schemes, default: 'light' } },
    derivation: { rules: 'standard@1', autoDark: false, require: ['semantic.color.primary'] },
    targets: Object.fromEntries(targets.map((t) => [t, targetEntry(t)])),
    check: { failOn: 'error', contrast: { standard: 'wcag21-aa' } },
  };

  return [{ path: 'transtyle.config.json', contents: json(config) }, ...files.map((f) => ({ path: f.path, contents: json(f.data) }))];
}

/** A target's config entry, the same for `init --targets` and `add`. */
export function targetEntry(target) {
  return { output: `dist/${target}` };
}

// ---------- the closing summary ----------

/** sRGB bytes of a `#rrggbb`. */
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * `██ #e8590c` (a truecolor block when `color` is on), or with an on-color,
 * the brand as a chip with its on-color text on it and the contrast ratio,
 * rounded down so 4.47:1 never reads as 4.5:1.
 */
export function swatch(solid, onSolid, color) {
  const hex = formatHex(solid).text;
  if (!onSolid) return color ? `\x1b[38;2;${rgb(hex).join(';')}m██\x1b[0m ${hex}` : hex;
  const onHex = formatHex(onSolid).text;
  const ratio = Math.floor(contrastRatio(solid, onSolid) * 10) / 10;
  const chip = color ? `\x1b[48;2;${rgb(hex).join(';')}m\x1b[38;2;${rgb(onHex).join(';')}m  Aa  \x1b[0m ` : '';
  return `${chip}primary.solid ${hex}, on-solid ${onHex}: ${ratio.toFixed(1)}:1`;
}

/** What a scaffolded system usually authors next, in the order it pays off. */
export function authorNext(preset) {
  return [
    ...(preset === 'minimal' ? ['your neutrals: elevation.0.surface, elevation.1.surface, text.base, text.muted, border (with dark values)'] : []),
    'secondary.solid, if your brand has a second color (derived from primary until you do)',
    'the status roles: success.solid, warning.solid, danger.solid, info.solid',
    'the shared scales: space.*, type.*, size.control.*',
  ];
}
