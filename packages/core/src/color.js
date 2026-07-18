/**
 * Minimal OKLCH color engine (zero deps).
 * Internal canonical form: { l, c, h, alpha } — docs/architecture/ir.md#values.
 */

const OKLCH_RE = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i;

export function parseColor(str) {
  if (typeof str !== 'string') throw new Error(`Not a color string: ${JSON.stringify(str)}`);
  const s = str.trim();
  const m = OKLCH_RE.exec(s);
  if (m) {
    const num = (v) => (v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v));
    return { l: num(m[1]), c: parseFloat(m[2]), h: parseFloat(m[3]), alpha: m[4] ? num(m[4]) : 1 };
  }
  if (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(s)) return srgbToOklch(hexToSrgb(s));
  throw new Error(`Unsupported color syntax (skeleton supports oklch() and #hex): ${s}`);
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
  const lerp = (x, y) => x + (y - x) * t;
  let h;
  if (a.c < 0.01) h = b.h;
  else if (b.c < 0.01) h = a.h;
  else {
    let d = ((b.h - a.h + 540) % 360) - 180;
    h = (a.h + d * t + 360) % 360;
  }
  return { l: lerp(a.l, b.l), c: lerp(a.c, b.c), h, alpha: lerp(a.alpha ?? 1, b.alpha ?? 1) };
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

function hexToSrgb(hex) {
  let s = hex.slice(1);
  if (s.length === 3) s = s.split('').map((ch) => ch + ch).join('');
  const n = parseInt(s, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function srgbToLinear(v) {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function srgbToOklch({ r, g, b }) {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const c = Math.hypot(A, B);
  const h = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h, alpha: 1 };
}

const linearToSrgb = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

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

/** Format as #rrggbb hex (canvas-friendly: ECharts). `clamped` mirrors oklchToSrgb. */
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
