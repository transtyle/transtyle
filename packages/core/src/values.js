/**
 * Per-type value parsing for NORMALIZE (docs/architecture/ir.md#values-and-canonicalization).
 *
 * The DTCG spec gives `dimension` and `duration` an object form
 * (`{ "value": 16, "unit": "px" }`), `cubicBezier` an array form
 * (`[0.2, 0, 0, 1]`), and `fontWeight` a keyword vocabulary (`semi-bold`) that
 * CSS doesn't share. Before this table, every type but `color` was carried
 * through as authored, so those forms reached exporters as JavaScript values and
 * came out as `[object Object]`, `0.2,0,0,1` or `semi-bold` in stylesheets, with
 * no diagnostic (issue #24).
 *
 * The canonical form is the **CSS string** every consumer already reads
 * (`"16px"`, `"cubic-bezier(0.2, 0, 0, 1)"`), not a structured `{ value, unit }`:
 * the radius scale in derive.js, the unit-converting exporters (ECharts,
 * Storybook, Bootstrap's spacer maths) and the plugin-kit fixture all expect the
 * string, so canonicalizing here keeps the IR value contract third-party
 * exporters see unchanged, and makes the two authoring forms byte-identical on
 * every target by construction.
 *
 * String forms pass through untouched (`"0.5rem"`, `"calc(…)"`, `"var(…)"`):
 * they are what real stylesheets are adopted from, and tightening them is a
 * different change. What fails is a value no CSS string can come out of — a
 * malformed object, a bare number where a unit is required, an unknown keyword —
 * with `TST1106` and a hint naming the accepted forms.
 */

import { parseColor } from './color.js';

/** A parse failure, raised as TST1106 by the caller with `hint` attached. */
export class ValueError extends Error {
  constructor(message, hint) {
    super(message);
    this.hint = hint;
  }
}

/** DTCG 2025.10 allows exactly these units for each object form. */
const DIMENSION_UNITS = ['px', 'rem'];
const DURATION_UNITS = ['ms', 's'];

/** DTCG `fontWeight` keywords and their numeric values (DTCG 2025.10, font weight table). */
const FONT_WEIGHT_KEYWORDS = {
  thin: 100,
  hairline: 100,
  'extra-light': 200,
  'ultra-light': 200,
  light: 300,
  normal: 400,
  regular: 400,
  book: 400,
  medium: 500,
  'semi-bold': 600,
  'demi-bold': 600,
  bold: 700,
  'extra-bold': 800,
  'ultra-bold': 800,
  black: 900,
  heavy: 900,
  'extra-black': 950,
  'ultra-black': 950,
};
/** Keywords CSS `font-weight` already understands: kept as authored, so existing output doesn't move. */
const CSS_FONT_WEIGHT_KEYWORDS = new Set(['normal', 'bold', 'bolder', 'lighter']);

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const show = (v) => JSON.stringify(v);

/**
 * A number as CSS writes it: shortest round-trip digits, never exponent
 * notation (`String(1e-7)` is `"1e-7"`, which no stylesheet parses). Exact, not
 * rounded: an authored `0.0625rem` stays `0.0625rem`.
 */
export function plainNumber(n) {
  const s = String(n);
  if (!/e/i.test(s)) return s;
  const [mantissa, expText] = s.split(/e/i);
  const negative = mantissa.startsWith('-');
  const [intPart, fracPart = ''] = mantissa.replace('-', '').split('.');
  const digits = intPart + fracPart;
  const point = intPart.length + Number(expText);
  let out;
  if (point <= 0) out = `0.${'0'.repeat(-point)}${digits}`;
  else if (point >= digits.length) out = digits + '0'.repeat(point - digits.length);
  else out = `${digits.slice(0, point)}.${digits.slice(point)}`;
  return (negative ? '-' : '') + out;
}

/** `dimension` / `duration`: a CSS string as authored, or the DTCG `{ value, unit }` object. */
function measure(type, units, example) {
  const form = `{ "value": <number>, "unit": ${units.map((u) => `"${u}"`).join(' | ')} }`;
  const hint = `A DTCG ${type} is ${form}, e.g. ${show(example)}; a CSS string such as "${example.value}${example.unit}" is accepted too.`;
  return (raw) => {
    if (typeof raw === 'string') return raw;
    if (isPlainObject(raw)) {
      const { value, unit } = raw;
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new ValueError(`${type} object needs a number "value", got ${show(raw)}`, hint);
      }
      if (!units.includes(unit)) {
        throw new ValueError(
          unit === undefined
            ? `${type} object has no "unit", got ${show(raw)}`
            : `${type} unit "${unit}" is not one of ${units.join(', ')}`,
          hint,
        );
      }
      return `${plainNumber(value)}${unit}`;
    }
    // A unitless 0 is a valid CSS length, and what `0` meant before this table
    // existed; every other bare number can only produce invalid CSS.
    if (type === 'dimension' && raw === 0) return raw;
    throw new ValueError(`${type} value must be a CSS string or ${form}, got ${show(raw)}`, hint);
  };
}

/** `cubicBezier`: a CSS string as authored, or the DTCG `[x1, y1, x2, y2]` array. */
function cubicBezier(raw) {
  if (typeof raw === 'string') return raw;
  const hint = 'A DTCG cubicBezier is an array of four numbers [x1, y1, x2, y2] with x1 and x2 between 0 and 1, e.g. [0.2, 0, 0, 1]; a CSS string such as "cubic-bezier(0.2, 0, 0, 1)" or "ease-out" is accepted too.';
  if (!Array.isArray(raw) || raw.length !== 4 || !raw.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    throw new ValueError(`cubicBezier value must be four numbers, got ${show(raw)}`, hint);
  }
  if (raw[0] < 0 || raw[0] > 1 || raw[2] < 0 || raw[2] > 1) {
    throw new ValueError(`cubicBezier x coordinates must be between 0 and 1, got ${show(raw)}`, hint);
  }
  return `cubic-bezier(${raw.map(plainNumber).join(', ')})`;
}

/** `fontWeight`: a number 1–1000, a DTCG keyword (→ its number), or a string CSS already reads. */
function fontWeight(raw) {
  const hint = `A fontWeight is a number from 1 to 1000 or one of the DTCG keywords: ${Object.keys(FONT_WEIGHT_KEYWORDS).join(', ')}.`;
  if (typeof raw === 'number') {
    if (Number.isFinite(raw) && raw >= 1 && raw <= 1000) return raw;
    throw new ValueError(`fontWeight ${show(raw)} is outside 1–1000`, hint);
  }
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (CSS_FONT_WEIGHT_KEYWORDS.has(s)) return raw;
    if (s in FONT_WEIGHT_KEYWORDS) return FONT_WEIGHT_KEYWORDS[s];
    // A numeric string ("600") or a CSS function (`var(--w)`, `calc(…)`) is CSS already.
    if (/^\d+(\.\d+)?$/.test(s) && Number(s) >= 1 && Number(s) <= 1000) return raw;
    if (s.includes('(')) return raw;
    throw new ValueError(`unknown fontWeight keyword ${show(raw)}`, hint);
  }
  throw new ValueError(`fontWeight value must be a number or a keyword, got ${show(raw)}`, hint);
}

/** `number`: a JSON number, or a string as authored; never an object or array. */
function number(raw) {
  if (typeof raw === 'number' || typeof raw === 'string') return raw;
  throw new ValueError(`number value must be a number, got ${show(raw)}`, 'Write a JSON number, e.g. 1.5.');
}

const dimension = measure('dimension', DIMENSION_UNITS, { value: 16, unit: 'px' });
const duration = measure('duration', DURATION_UNITS, { value: 150, unit: 'ms' });

/**
 * Composite members carry the same types (DTCG 2025.10). Only members whose
 * type has a parser are listed; the rest (`color`, `fontFamily`, `style`,
 * `inset`) are carried as authored, exactly as before.
 */
const COMPOSITE_MEMBERS = {
  shadow: { offsetX: dimension, offsetY: dimension, blur: dimension, spread: dimension },
  typography: { fontSize: dimension, letterSpacing: dimension, fontWeight, lineHeight: number },
  border: { width: dimension },
  transition: { duration, delay: duration, timingFunction: cubicBezier },
};

function composite(type, members) {
  const parseOne = (obj) => {
    if (!isPlainObject(obj)) return obj; // a string shorthand stays as authored
    const out = { ...obj };
    for (const [key, parse] of Object.entries(members)) {
      if (out[key] === undefined) continue;
      try {
        out[key] = parse(out[key]);
      } catch (e) {
        if (e instanceof ValueError) throw new ValueError(`${type} member "${key}": ${e.message}`, e.hint);
        throw e;
      }
    }
    return out;
  };
  // DTCG `shadow` may be a list of shadows; each layer is parsed the same way.
  return (raw) => (type === 'shadow' && Array.isArray(raw) ? raw.map(parseOne) : parseOne(raw));
}

const PARSERS = {
  color: parseColor,
  dimension,
  duration,
  cubicBezier,
  fontWeight,
  number,
  ...Object.fromEntries(Object.entries(COMPOSITE_MEMBERS).map(([type, members]) => [type, composite(type, members)])),
};

/**
 * Parse an authored (non-alias) `$value` into its canonical IR value. Types
 * without a parser (`fontFamily`, `gradient`, `strokeStyle`, an unknown or
 * absent `$type`) are carried as authored. Throws on a malformed value; a
 * `ValueError` carries a hint for the TST1106 diagnostic.
 */
export function parseValue(type, raw) {
  const parse = PARSERS[type];
  return parse ? parse(raw) : raw;
}
