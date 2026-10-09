/**
 * A zero-dependency semver range check (core has no dependencies, CONTRIBUTING).
 *
 * Covers the range syntax a manifest field realistically holds, with
 * node-semver's meaning: partial and x-ranges (`0`, `0.x`, `1.2.*`, `*`),
 * caret (`^0`, `^0.2`, `^1.2.3`), tilde (`~1.2`), comparators
 * (`>=0.1 <1`, `>1`, `<=2.1`, `=1.0.0`), hyphen ranges (`1 - 2.3`), and `||`
 * between sets. Prerelease tags and build metadata are out of scope: a range
 * or a version carrying one doesn't parse (`null`), and callers treat such a
 * string as a plain marker compared exactly (compat.js).
 */

const NUM = /^(?:0|[1-9]\d*)$/;
const WILD = /^[xX*]$/;

/** `1.2.3` (optionally `v1.2.3`) → [1, 2, 3]; anything else (partial, prerelease) → null. */
export function parseVersion(s) {
  const m = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(String(s).trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** `1.2` → [1, 2]; `1.x` → [1]; `*` → []; invalid → null. */
function parsePartial(s) {
  const parts = s.replace(/^v/, '').split('.');
  if (parts.length > 3) return null;
  const nums = [];
  let wild = false;
  for (const p of parts) {
    if (WILD.test(p)) wild = true;
    else if (NUM.test(p) && !wild) nums.push(Number(p));
    else return null; // a number after a wildcard, a prerelease tag, junk
  }
  return nums;
}

const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const pad = (p) => [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];
/** The first version past every version a partial covers: [1] → 2.0.0, [1, 2] → 1.3.0. */
const next = (p) => (p.length === 1 ? [p[0] + 1, 0, 0] : [p[0], p[1] + 1, 0]);
const ANY = [];
const NONE = [['<', [0, 0, 0]]];

/** One comparator → a list of `[op, version]` tests, all of which must hold. */
function comparator(op, p) {
  const k = p.length;
  if (k === 0) return op === '<' || op === '>' ? NONE : ANY;
  const lo = pad(p);
  switch (op) {
    case '':
    case '=':
      return k === 3 ? [['>=', lo], ['<=', lo]] : [['>=', lo], ['<', next(p)]];
    case '^': {
      if (p[0] > 0 || k === 1) return [['>=', lo], ['<', [p[0] + 1, 0, 0]]];
      if (p[1] > 0 || k === 2) return [['>=', lo], ['<', [0, p[1] + 1, 0]]];
      return [['>=', lo], ['<', [0, 0, p[2] + 1]]];
    }
    case '~':
      return [['>=', lo], ['<', k === 1 ? [p[0] + 1, 0, 0] : [p[0], p[1] + 1, 0]]];
    case '>':
      return k === 3 ? [['>', lo]] : [['>=', next(p)]];
    case '>=':
      return [['>=', lo]];
    case '<':
      return [['<', lo]];
    case '<=':
      return k === 3 ? [['<=', lo]] : [['<', next(p)]];
    default:
      return null;
  }
}

/**
 * Parse a range into its `||` sets, each a list of `[op, version]` tests.
 * Returns null when the string is not a range this parser understands.
 */
export function parseRange(range) {
  if (typeof range !== 'string') return null;
  const sets = [];
  for (const raw of range.split('||')) {
    const set = raw.trim().replace(/(\^|~|>=|<=|>|<|=)\s+/g, '$1');
    const tests = [];
    const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(set);
    if (hyphen) {
      const a = parsePartial(hyphen[1]);
      const b = parsePartial(hyphen[2]);
      if (!a || !b) return null;
      tests.push(...comparator('>=', a), ...comparator('<=', b));
    } else {
      for (const token of set === '' ? ['*'] : set.split(/\s+/)) {
        const m = /^(\^|~|>=|<=|>|<|=)?(.*)$/.exec(token);
        const p = parsePartial(m[2]);
        if (!p) return null;
        tests.push(...comparator(m[1] ?? '', p));
      }
    }
    sets.push(tests);
  }
  return sets;
}

const holds = {
  '<': (c) => c < 0,
  '<=': (c) => c <= 0,
  '>': (c) => c > 0,
  '>=': (c) => c >= 0,
};

/** Does `version` (`1.2.3`) fall in `range`? Null when either doesn't parse. */
export function satisfies(version, range) {
  const v = parseVersion(version);
  const sets = parseRange(range);
  if (!v || !sets) return null;
  return sets.some((tests) => tests.every(([op, bound]) => holds[op](cmp(v, bound))));
}
