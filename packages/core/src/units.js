/**
 * Unit conversion for exporters whose target demands pixels (or rem) where the
 * IR carries the other: the `rem` base comes from the config's
 * `units.remBase` (a string such as "16px", default "16px"), and exporters read
 * it through `ctx.units` instead of hard-coding a constant. Dimensions reach
 * exporters as authored CSS strings (docs/architecture/ir.md#dimensions), so
 * both helpers take that string and return `undefined` for anything else —
 * each exporter keeps its own fallback.
 */

export const DEFAULT_REM_BASE = 16;

const DIMENSION = /^([\d.]+)(px|rem)$/;

/** The configured base in px; the config schema guarantees the shape, so this only reads it. */
export function remBaseOf(config) {
  const raw = config?.units?.remBase;
  return raw === undefined ? DEFAULT_REM_BASE : parseFloat(raw);
}

export function makeUnits(config) {
  const remBase = remBaseOf(config);
  const parse = (dimension) => DIMENSION.exec(String(dimension));
  return {
    /** The root font size, in px, that one `rem` stands for. */
    remBase,
    /** `"0.5rem"` / `"8px"` → px as a number (unrounded); anything else → undefined. */
    toPx(dimension) {
      const m = parse(dimension);
      return m ? parseFloat(m[1]) * (m[2] === 'rem' ? remBase : 1) : undefined;
    },
    /** `"8px"` / `"0.5rem"` → rem as a number (unrounded); anything else → undefined. */
    toRem(dimension) {
      const m = parse(dimension);
      return m ? parseFloat(m[1]) / (m[2] === 'rem' ? 1 : remBase) : undefined;
    },
  };
}
