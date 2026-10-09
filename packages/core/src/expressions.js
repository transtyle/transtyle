/**
 * Token value expressions: the math and in-string references Tokens Studio
 * exports carry (`{space.base} * 2`, `roundTo({size.md} / 3, 2)`,
 * `rgba({color.black}, 0.5)`), evaluated per mode in NORMALIZE
 * (docs/architecture/pipeline.md#2-normalize, ADR-0014).
 *
 * LOAD wraps such a value in an `Expression` (tokens-studio.js), so a plain
 * DTCG string that happens to contain `calc(…)` or a brace is never read as
 * math: only the Tokens Studio layer produces expressions. NORMALIZE resolves
 * the references for the mode at hand, then calls `evaluateExpression()`.
 *
 * The evaluator is a small parser of its own: packages stay zero-dependency,
 * and nothing is handed to `eval` or `Function`. The subset is what Tokens
 * Studio's own build (`@tokens-studio/sd-transforms`, `checkAndEvaluateMath`)
 * evaluates in practice: numbers, `+ - * /`, unary minus, parentheses, and the
 * functions `roundTo(x, digits)`, `min`, `max`, `floor`, `ceil`, `round`. A
 * space-separated list of expressions (`{space.2} {space.4}`) is a shorthand
 * and evaluates part by part. At most one unit per expression: `px` and plain
 * numbers mix (Tokens Studio treats a bare number as px), two different units
 * are an error rather than text kept as is, since that text would be invalid
 * CSS in every target. Results are rounded to 4 decimals and written without
 * exponent notation.
 */

import { parseColor } from './color.js';
import { plainNumber } from './values.js';

/** A value LOAD marked as an expression; `text` has its references already rewritten to IR paths. */
export class Expression {
  constructor(text) {
    this.text = text;
  }
}

export const isExpression = (v) => v instanceof Expression;

/** An expression that cannot be evaluated; reported as TST1006 with `hint`. */
export class ExpressionError extends Error {
  constructor(message, hint) {
    super(message);
    this.hint = hint;
  }
}

const REF = /\{([^{}]+)\}/g;

/** The distinct token paths an expression references, in order of appearance. */
export function expressionRefs(text) {
  return [...new Set([...text.matchAll(REF)].map((m) => m[1].trim()))];
}

const SUBSET_HINT = 'Supported: numbers with at most one unit, + - * /, parentheses, roundTo(x, digits), min, max, floor, ceil, round, and rgba(<color>, <alpha>) for colors. Author the computed value instead.';

const FUNCTIONS = {
  roundTo: (args) => {
    if (args.length < 1 || args.length > 2) throw new ExpressionError(`roundTo() takes 1 or 2 arguments, got ${args.length}`, SUBSET_HINT);
    const f = 10 ** (args[1] ?? 0);
    return Math.round(args[0] * f) / f;
  },
  min: (args) => Math.min(...args),
  max: (args) => Math.max(...args),
  floor: (args) => Math.floor(args[0]),
  ceil: (args) => Math.ceil(args[0]),
  round: (args) => Math.round(args[0]),
};

const NUMBER = /^-?(\d+\.?\d*|\.\d+)([a-z%]*)$/i;

/** A referenced value as a number and its unit, or null when it is not numeric. */
function asQuantity(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return { n: value, unit: '' };
  if (typeof value === 'string') {
    const m = NUMBER.exec(value.trim());
    if (m) return { n: Number(m[0].slice(0, m[0].length - m[2].length)), unit: m[2].toLowerCase() };
  }
  return null;
}

function tokenize(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '{') {
      const end = text.indexOf('}', i);
      if (end === -1) throw new ExpressionError(`unclosed reference in "${text}"`, SUBSET_HINT);
      tokens.push({ kind: 'ref', path: text.slice(i + 1, end).trim() });
      i = end + 1;
      continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)([a-z%]*)/i.exec(text.slice(i));
    if (num) {
      tokens.push({ kind: 'num', n: Number(num[1]), unit: num[2].toLowerCase() });
      i += num[0].length;
      continue;
    }
    const ident = /^[a-z_][\w]*/i.exec(text.slice(i));
    if (ident) {
      tokens.push({ kind: 'ident', name: ident[0] });
      i += ident[0].length;
      continue;
    }
    if ('+-*/(),'.includes(c)) { tokens.push({ kind: c }); i++; continue; }
    throw new ExpressionError(`unsupported character "${c}" in "${text}"`, SUBSET_HINT);
  }
  return tokens;
}

/**
 * Evaluate a numeric expression (or a shorthand list of them). `values` maps
 * each referenced path to its resolved IR value. Returns the parts as
 * `{ n, unit }`, all sharing one unit (or none).
 */
function evaluateNumeric(text, values) {
  const tokens = tokenize(text);
  const units = new Set();
  let pos = 0;
  const peek = () => tokens[pos];
  const take = (kind) => {
    const t = tokens[pos];
    if (!t || t.kind !== kind) throw new ExpressionError(`expected "${kind}" in "${text}"`, SUBSET_HINT);
    pos++;
    return t;
  };
  const unitOf = (unit) => { if (unit) units.add(unit); };

  const primary = () => {
    const t = peek();
    if (!t) throw new ExpressionError(`"${text}" ends too early`, SUBSET_HINT);
    if (t.kind === 'num') { pos++; unitOf(t.unit); return t.n; }
    if (t.kind === 'ref') {
      pos++;
      const q = asQuantity(values.get(t.path));
      if (!q) throw new ExpressionError(`{${t.path}} is ${JSON.stringify(values.get(t.path))}, not a number`, SUBSET_HINT);
      unitOf(q.unit);
      return q.n;
    }
    if (t.kind === '(') { pos++; const v = additive(); take(')'); return v; }
    if (t.kind === 'ident') {
      pos++;
      const fn = FUNCTIONS[t.name];
      if (!fn) throw new ExpressionError(`unsupported function ${t.name}()`, SUBSET_HINT);
      take('(');
      const args = [];
      if (peek()?.kind !== ')') {
        args.push(additive());
        while (peek()?.kind === ',') { pos++; args.push(additive()); }
      }
      take(')');
      return fn(args);
    }
    throw new ExpressionError(`unexpected "${t.kind}" in "${text}"`, SUBSET_HINT);
  };
  const unary = () => {
    if (peek()?.kind === '-') { pos++; return -unary(); }
    if (peek()?.kind === '+') { pos++; return unary(); }
    return primary();
  };
  const multiplicative = () => {
    let v = unary();
    while (peek()?.kind === '*' || peek()?.kind === '/') {
      const op = tokens[pos++].kind;
      const r = unary();
      if (op === '/' && r === 0) throw new ExpressionError(`division by zero in "${text}"`, SUBSET_HINT);
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const additive = () => {
    let v = multiplicative();
    while (peek()?.kind === '+' || peek()?.kind === '-') {
      const op = tokens[pos++].kind;
      const r = multiplicative();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };

  const parts = [];
  while (pos < tokens.length) parts.push(additive());
  if (parts.length === 0) throw new ExpressionError('empty expression', SUBSET_HINT);
  // `px` is what a bare number already means, so it mixes with plain numbers.
  const named = [...units].filter((u) => u !== 'px');
  if (named.length > 1 || (named.length === 1 && units.has('px'))) {
    throw new ExpressionError(`mixes units (${[...units].sort().join(', ')}) in "${text}"`, 'Tokens Studio leaves such an expression unevaluated, which no target can read: use one unit, or author the computed value.');
  }
  const unit = named[0] ?? (units.has('px') ? 'px' : '');
  return parts.map((n) => {
    if (!Number.isFinite(n)) throw new ExpressionError(`"${text}" does not evaluate to a finite number`, SUBSET_HINT);
    const rounded = Math.round(n * 1e4) / 1e4;
    return { n: Object.is(rounded, -0) ? 0 : rounded, unit };
  });
}

const RGBA = /^rgba?\(\s*([^,]+?)\s*,\s*([^,]+?)\s*\)$/i;
const isOklch = (v) => v !== null && typeof v === 'object' && ['l', 'c', 'h'].every((k) => typeof v[k] === 'number');
const NUMERIC_TYPES = new Set(['dimension', 'number', 'fontWeight', 'duration']);

/**
 * Evaluate an expression for a token of `type`, with every reference resolved
 * in `values`. Returns the value in the form the type's parser takes (values.js),
 * or an OKLCH object for a color. Throws `ExpressionError`.
 */
export function evaluateExpression(text, type, values) {
  if (type === 'color') {
    const m = RGBA.exec(text.trim());
    if (!m) throw new ExpressionError(`"${text}" is not a color expression`, SUBSET_HINT);
    const [, colorArg, alphaArg] = m;
    const ref = /^\{([^{}]+)\}$/.exec(colorArg);
    let color;
    if (ref) {
      color = values.get(ref[1].trim());
      if (!isOklch(color)) throw new ExpressionError(`{${ref[1].trim()}} is not a color`, SUBSET_HINT);
    } else {
      try { color = parseColor(colorArg); } catch (e) { throw new ExpressionError(e.message, SUBSET_HINT); }
    }
    const [alpha] = evaluateNumeric(alphaArg, values);
    if (alpha.unit !== '' && alpha.unit !== '%') throw new ExpressionError(`alpha "${alphaArg}" must be a number or a percentage`, SUBSET_HINT);
    const a = alpha.unit === '%' ? alpha.n / 100 : alpha.n;
    if (a < 0 || a > 1) throw new ExpressionError(`alpha ${a} is outside 0–1`, SUBSET_HINT);
    return { ...color, alpha: a };
  }
  if (NUMERIC_TYPES.has(type)) {
    const parts = evaluateNumeric(text, values);
    if (parts.length === 1 && parts[0].unit === '' && type !== 'dimension') return parts[0].n;
    // A unitless dimension is px, as Tokens Studio reads it.
    return parts.map(({ n, unit }) => `${plainNumber(n)}${unit || (type === 'dimension' ? 'px' : '')}`).join(' ');
  }
  // Any other type: the references are spliced into the text.
  return text.replace(REF, (_, p) => {
    const v = values.get(p.trim());
    if (Array.isArray(v)) return v.join(', ');
    if (v !== null && typeof v === 'object') throw new ExpressionError(`{${p.trim()}} cannot be written inside a ${type ?? 'untyped'} string`, SUBSET_HINT);
    return String(v);
  });
}
