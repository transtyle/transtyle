/**
 * Minimal OKLCH color engine (zero deps).
 * Internal canonical form: { l, c, h, alpha } — docs/architecture/ir.md#values.
 */

import { NAMED_COLORS } from './css-colors.js';

const OKLCH_RE = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i;
const FUNC_RE = /^(rgba?|hsla?)\(\s*([^)]*)\s*\)$/i;

/**
 * Parse any color syntax a real stylesheet is likely to contain
 * (docs/architecture/ir.md#values): `oklch()`, `#hex` (3/4/6/8 digits),
 * `rgb()`/`rgba()`, `hsl()`/`hsla()`, the CSS named colors, and `transparent`.
 * Both the modern space-separated (`rgb(255 0 0 / 50%)`) and legacy comma
 * (`rgba(255, 0, 0, .5)`) forms are accepted. Everything canonicalizes to OKLCH.
 */
export function parseColor(str) {
  if (typeof str !== 'string') throw new Error(`Not a color string: ${JSON.stringify(str)}`);
  const s = str.trim();

  const m = OKLCH_RE.exec(s);
  if (m) {
    const num = (v) => (v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v));
    return { l: num(m[1]), c: parseFloat(m[2]), h: parseFloat(m[3]), alpha: m[4] ? num(m[4]) : 1 };
  }

  if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) {
    const { alpha, ...rgb } = hexToSrgb(s);
    return srgbToOklch(rgb, alpha);
  }

  const fn = FUNC_RE.exec(s);
  if (fn) {
    const kind = fn[1].toLowerCase();
    const { parts, alpha } = splitComponents(fn[2]);
    if (parts.length < 3) throw new Error(`Malformed ${kind}() color: ${s}`);
    const a = parseAlpha(alpha);
    if (kind.startsWith('rgb')) {
      const ch = (v) => (v === 'none' ? 0 : v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v) / 255);
      const rgb = { r: ch(parts[0]), g: ch(parts[1]), b: ch(parts[2]) };
      if (Object.values(rgb).some(Number.isNaN)) throw new Error(`Malformed ${kind}() color: ${s}`);
      return srgbToOklch(rgb, a);
    }
    const h = parseHue(parts[0]);
    const pct = (v) => (v === 'none' ? 0 : parseFloat(v) / 100);
    const sat = pct(parts[1]), lig = pct(parts[2]);
    if ([h, sat, lig].some(Number.isNaN)) throw new Error(`Malformed ${kind}() color: ${s}`);
    return srgbToOklch(hslToSrgb(h, sat, lig), a);
  }

  const lower = s.toLowerCase();
  if (lower === 'transparent') return { l: 0, c: 0, h: 0, alpha: 0 };
  if (NAMED_COLORS[lower]) {
    const { alpha, ...rgb } = hexToSrgb(NAMED_COLORS[lower]);
    return srgbToOklch(rgb, alpha);
  }

  throw new Error(`Unsupported color syntax: ${s} (expected oklch(), #hex, rgb(), hsl(), or a CSS named color)`);
}

/** Split a function body into 3 components + optional alpha, modern or legacy form. */
function splitComponents(inner) {
  const body = inner.trim();
  const slash = body.indexOf('/');
  if (slash !== -1) {
    return { parts: body.slice(0, slash).trim().split(/\s+/), alpha: body.slice(slash + 1).trim() };
  }
  if (body.includes(',')) {
    const all = body.split(',').map((p) => p.trim());
    return { parts: all.slice(0, 3), alpha: all[3] };
  }
  return { parts: body.split(/\s+/), alpha: undefined };
}

const parseAlpha = (v) => {
  if (v === undefined || v === '' || v === 'none') return 1;
  const n = v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v);
  return Number.isNaN(n) ? 1 : Math.min(1, Math.max(0, n));
};

/** CSS <angle> → degrees (deg/rad/grad/turn, or unitless = deg). */
function parseHue(v) {
  const m = /^(-?[\d.]+)(deg|rad|grad|turn)?$/i.exec(v.trim());
  if (!m) return NaN;
  const n = parseFloat(m[1]);
  switch ((m[2] ?? 'deg').toLowerCase()) {
    case 'rad': return (n * 180) / Math.PI;
    case 'grad': return n * 0.9;
    case 'turn': return n * 360;
    default: return n;
  }
}

function hslToSrgb(hDeg, s, l) {
  const h = ((hDeg % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return { r: r + m, g: g + m, b: b + m };
}

export function formatColor({ l, c, h, alpha = 1 }) {
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const L = Math.min(1, Math.max(0, r3(l)));
  let C = Math.max(0, r3(c));
  let H = Math.round(h * 10) / 10;
  if (C < 0.002) { C = 0; H = 0; } // achromatic: drop meaningless hue
  const a = alpha < 1 ? ` / ${r3(alpha)}` : '';
  return `oklch(${L} ${C} ${H}${a})`;
}

/** Mix a toward b by t (0 = a, 1 = b), in OKLCH with shortest-path hue. */
export function mix(a, b, t) {
  // Cartesian OKLab interpolation (derivation.md, pinned by exercise F21).
  // Polar hue lerp passes through unrelated hues at moderate ratios (an amber
  // border tint on a blue-cast surface must not travel through cyan).
  const lerp = (x, y) => x + (y - x) * t;
  const rad = Math.PI / 180;
  const A = lerp(a.c * Math.cos(a.h * rad), b.c * Math.cos(b.h * rad));
  const B = lerp(a.c * Math.sin(a.h * rad), b.c * Math.sin(b.h * rad));
  const c = Math.sqrt(A * A + B * B);
  const h = c < 1e-9 ? 0 : (Math.atan2(B, A) / rad + 360) % 360;
  return { l: lerp(a.l, b.l), c, h, alpha: lerp(a.alpha ?? 1, b.alpha ?? 1) };
}

// ---- OKLab <-> linear sRGB (Björn Ottosson's matrices) ----

function oklchToLinearSrgb({ l, c, h }) {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    g: -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    b: -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  };
}

/** #rgb / #rgba / #rrggbb / #rrggbbaa → sRGB (+ alpha). */
function hexToSrgb(hex) {
  let s = hex.slice(1);
  if (s.length === 3 || s.length === 4) s = s.split('').map((ch) => ch + ch).join('');
  const n = parseInt(s.slice(0, 6), 16);
  const alpha = s.length === 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1;
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, alpha };
}

function srgbToLinear(v) {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function srgbToOklch({ r, g, b }, alpha = 1) {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const c = Math.hypot(A, B);
  const h = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h, alpha };
}

const linearToSrgb = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

const inSrgbGamut = ({ r, g, b }) => r >= -0.0005 && r <= 1.0005 && g >= -0.0005 && g <= 1.0005 && b >= -0.0005 && b <= 1.0005;

/**
 * Reduce chroma at a fixed lightness/hue until the color lands inside the
 * sRGB gamut (binary search; ~20 steps is well under float precision).
 * Keeps `l` and `h` exactly as given — only `c` moves — because rules like
 * F20 (contrast-anchor) pick `l`/`h` for a reason (contrast, brand hue) and
 * should not have those silently perturbed by channel-clipping downstream.
 * A no-op when the color is already in gamut.
 */
export function clampChromaToGamut({ l, c, h, alpha = 1 }) {
  if (c <= 0 || inSrgbGamut(oklchToLinearSrgb({ l, c, h }))) return { l, c, h, alpha };
  let lo = 0, hi = c;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (inSrgbGamut(oklchToLinearSrgb({ l, c: mid, h }))) lo = mid;
    else hi = mid;
  }
  return { l, c: lo, h, alpha };
}

/**
 * OKLCH → gamma-encoded sRGB. `clamped` is true when the color was outside the
 * sRGB gamut and had to be clamped (coverage class: approximated).
 */
export function oklchToSrgb(color) {
  const lin = oklchToLinearSrgb(color);
  let clamped = false;
  const enc = (v) => {
    if (v < -0.005 || v > 1.005) clamped = true;
    return linearToSrgb(Math.min(1, Math.max(0, v)));
  };
  return { r: enc(lin.r), g: enc(lin.g), b: enc(lin.b), clamped };
}

/**
 * Format as an HSL channel triplet ("221 83% 53%") — the shadcn tailwind-v3
 * convention (wrapped by components as hsl(var(--x))).
 */
export function formatHslTriplet(color) {
  // Near-achromatic: drop the meaningless hue/saturation before conversion,
  // otherwise rounding noise yields absurd triplets like "180 100% 99.9%".
  const input = color.c < 0.002 ? { ...color, c: 0 } : color;
  const { r, g, b, clamped } = oklchToSrgb(input);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0, s = 0;
  if (d > 1e-6) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  const r1 = (n) => Math.round(n * 10) / 10;
  return { text: `${r1(h)} ${r1(s * 100)}% ${r1(l * 100)}%`, clamped };
}

/**
 * Format as #rrggbb hex (canvas-friendly: ECharts). `clamped` mirrors oklchToSrgb.
 *
 * Round-trip note (measured exhaustively, guarded by scripts/check-color.mjs):
 * `formatHex(parseColor(hex))` returns the input for all but 1580 of the
 * 16,777,216 sRGB values (0.0094%), which come back ±1/255. Those all sit in the
 * near-black range, where sRGB's transfer curve is steepest relative to an 8-bit
 * step; it is inherent to canonicalizing through OKLCH in float64. Determinism is
 * unaffected — the same input always yields the same output.
 */
export function formatHex(color) {
  const input = color.c < 0.002 ? { ...color, c: 0 } : color;
  const { r, g, b, clamped } = oklchToSrgb(input);
  const h2 = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return { text: `#${h2(r)}${h2(g)}${h2(b)}`, clamped };
}

/** WCAG 2.1 relative luminance (via linear sRGB, gamut-clamped). */
export function relativeLuminance(color) {
  const { r, g, b } = oklchToLinearSrgb(color);
  const cl = (v) => Math.min(1, Math.max(0, v));
  return 0.2126 * cl(r) + 0.7152 * cl(g) + 0.0722 * cl(b);
}

/** WCAG 2.1 contrast ratio between two colors (order-independent). */
export function contrastRatio(a, b) {
  const ya = relativeLuminance(a), yb = relativeLuminance(b);
  const [hi, lo] = ya >= yb ? [ya, yb] : [yb, ya];
  return (hi + 0.05) / (lo + 0.05);
}

/** Pick the candidate with the highest contrast against bg. Returns { color, ratio, index }. */
export function contrastPick(bg, candidates) {
  let best = null;
  candidates.forEach((cand, index) => {
    const ratio = contrastRatio(bg, cand);
    if (!best || ratio > best.ratio) best = { color: cand, ratio, index };
  });
  return best;
}
