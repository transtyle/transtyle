/**
 * Minimal OKLCH color engine (zero deps).
 * Internal canonical form: { l, c, h, alpha } — docs/architecture/ir.md#values.
 */

import { NAMED_COLORS } from './css-colors.js';

const FUNC_RE = /^([a-z][a-z0-9-]*)\(\s*([^)]*)\s*\)$/i;

/**
 * The fourteen DTCG color spaces (DTCG 2025.10, Color module), and the
 * `colorSpace` values a DTCG color object may name.
 */
export const DTCG_COLOR_SPACES = [
  'srgb', 'srgb-linear', 'hsl', 'hwb', 'lab', 'lch', 'oklab', 'oklch',
  'display-p3', 'a98-rgb', 'prophoto-rgb', 'rec2020', 'xyz-d65', 'xyz-d50',
];

/** `color(<space> …)`'s predefined spaces (CSS Color 4); `xyz` is `xyz-d65`. */
const CSS_PREDEFINED = {
  srgb: 'srgb', 'srgb-linear': 'srgb-linear', 'display-p3': 'display-p3', 'a98-rgb': 'a98-rgb',
  'prophoto-rgb': 'prophoto-rgb', rec2020: 'rec2020', xyz: 'xyz-d65', 'xyz-d65': 'xyz-d65', 'xyz-d50': 'xyz-d50',
};

/**
 * What 100% means for each component of the CSS functions that share the
 * DTCG converter (CSS Color 4, "reference range"); `hue` is an <angle>.
 * Percentages map onto the DTCG component ranges, so `hwb(0 20% 30%)` and
 * `{ "colorSpace": "hwb", "components": [0, 20, 30] }` are the same color.
 */
const CSS_PERCENT = {
  lab: [100, 125, 125],
  lch: [100, 150, 'hue'],
  oklab: [1, 0.4, 0.4],
  oklch: [1, 0.4, 'hue'],
  hwb: ['hue', 100, 100],
};

/**
 * Parse any color syntax a real stylesheet or a DTCG file is likely to contain
 * (docs/architecture/ir.md#values): `#hex` (3/4/6/8 digits), `rgb()`/`rgba()`,
 * `hsl()`/`hsla()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`,
 * `color(<predefined space> …)`, the CSS named colors and `transparent`, or a
 * DTCG color object `{ colorSpace, components, alpha?, hex? }` in any of the
 * fourteen DTCG color spaces. `rgb()`/`hsl()` take both the modern
 * space-separated (`rgb(255 0 0 / 50%)`) and legacy comma (`rgba(255, 0, 0, .5)`)
 * forms. Everything canonicalizes to OKLCH.
 *
 * `onWarning({ code, message, hint })` receives the non-fatal findings (a DTCG
 * `srgb` object whose `hex` disagrees with its `components`, TST1123); a
 * malformed value throws.
 */
export function parseColor(input, { onWarning } = {}) {
  if (input !== null && typeof input === 'object' && !Array.isArray(input)) return parseColorObject(input, onWarning);
  if (typeof input !== 'string') {
    throw new Error(`expected a CSS color string or a DTCG color object { colorSpace, components, alpha? }, got ${JSON.stringify(input)}`);
  }
  const s = input.trim();

  if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) {
    const { alpha, ...rgb } = hexToSrgb(s);
    return srgbToOklch(rgb, alpha);
  }

  const fn = FUNC_RE.exec(s);
  if (fn) {
    const kind = fn[1].toLowerCase();
    if (kind === 'color') return parseColorFunction(fn[2], s);
    if (CSS_PERCENT[kind]) {
      const { parts, alpha } = splitComponents(fn[2]);
      if (parts.length !== 3) throw new Error(`Malformed ${kind}() color: ${s}`);
      const components = parts.map((p, i) => cssComponent(p, CSS_PERCENT[kind][i]));
      if (components.some(Number.isNaN)) throw new Error(`Malformed ${kind}() color: ${s}`);
      return spaceToOklch(kind, components, parseAlpha(alpha));
    }
    if (!/^(rgba?|hsla?)$/.test(kind)) throw unsupported(s);
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

  throw unsupported(s);
}

const unsupported = (s) =>
  new Error(`Unsupported color syntax: ${s} (expected #hex, rgb(), hsl(), hwb(), lab(), lch(), oklab(), oklch(), color(), a CSS named color, or a DTCG color object)`);

/** `color(<space> c1 c2 c3 [/ alpha])`: components are numbers, or percentages of 1. */
function parseColorFunction(inner, s) {
  const [name, ...rest] = inner.trim().split(/\s+/);
  const space = CSS_PREDEFINED[name?.toLowerCase()];
  if (!space) {
    throw new Error(`Unsupported color() space in ${s} (expected one of ${Object.keys(CSS_PREDEFINED).join(', ')})`);
  }
  const { parts, alpha } = splitComponents(rest.join(' '));
  const components = parts.map((p) => cssComponent(p, 1));
  if (parts.length !== 3 || components.some(Number.isNaN)) throw new Error(`Malformed color() color: ${s}`);
  return spaceToOklch(space, components, parseAlpha(alpha));
}

const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

/** One CSS component: `none` (→ 0), a number, a percentage of `ref`, or an <angle> when ref is 'hue'. */
function cssComponent(v, ref) {
  if (v.toLowerCase() === 'none') return 0;
  if (ref === 'hue') return parseHue(v);
  if (v.endsWith('%')) return NUMBER_RE.test(v.slice(0, -1)) ? (Number(v.slice(0, -1)) / 100) * ref : NaN;
  return NUMBER_RE.test(v) ? Number(v) : NaN;
}

const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * A DTCG color object (DTCG 2025.10, Color module): `colorSpace` one of the
 * fourteen, three `components` (each a number or `"none"`, which converts as
 * 0), an optional `alpha` in [0, 1], an optional six-digit `hex` fallback.
 * Out-of-range components are accepted (`lab` a/b and `xyz` are unbounded; a
 * wide-gamut color is the point of the form): lightness and chroma clamp at 0
 * as in CSS, and what lands outside sRGB is TST1120's business downstream.
 *
 * `hex`: for `srgb`, a `hex` that agrees with `components` within 0.01 per
 * channel (the precision of a two-decimal export) wins, so the color the
 * designer saw in their tool is the one that ships; one that disagrees loses
 * to `components` with a TST1123 warning naming both. For the other spaces
 * `hex` is the fallback the spec calls it and `components` are the value.
 */
function parseColorObject(obj, onWarning) {
  const show = JSON.stringify(obj);
  const { colorSpace, components, alpha = 1, hex } = obj;
  if (colorSpace === undefined) throw new Error(`color object has no "colorSpace": ${show}`);
  if (!DTCG_COLOR_SPACES.includes(colorSpace)) {
    throw new Error(`unknown colorSpace ${JSON.stringify(colorSpace)} (DTCG color spaces: ${DTCG_COLOR_SPACES.join(', ')})`);
  }
  if (!Array.isArray(components) || components.length !== 3 || !components.every((c) => isNumber(c) || c === 'none')) {
    throw new Error(`color "components" must be three numbers (or "none"), got ${JSON.stringify(components)}`);
  }
  if (!isNumber(alpha) || alpha < 0 || alpha > 1) throw new Error(`color "alpha" must be a number from 0 to 1, got ${JSON.stringify(alpha)}`);
  if (hex !== undefined && (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex))) {
    throw new Error(`color "hex" must be a six-digit "#rrggbb", got ${JSON.stringify(hex)}`);
  }
  const values = components.map((c) => (c === 'none' ? 0 : c));
  if (colorSpace === 'srgb' && hex !== undefined) {
    const { r, g, b } = hexToSrgb(hex);
    const rgb = { r, g, b };
    const agrees = [rgb.r, rgb.g, rgb.b].every((v, i) => Math.abs(v - values[i]) <= HEX_TOLERANCE);
    if (agrees) return srgbToOklch(rgb, alpha);
    const compiled = spaceToOklch('srgb', values, alpha);
    onWarning?.({
      code: 'TST1123',
      message: `srgb components [${components.join(', ')}] and hex ${hex} disagree by more than 0.01 per channel; compiled the components (${formatHex(compiled).text})`,
      hint: 'Within 0.01 per channel the hex wins, as the color the design tool shows; beyond that the components are the value and the hex is ignored. Fix whichever one is wrong in the token file, or drop "hex".',
    });
    return compiled;
  }
  return spaceToOklch(colorSpace, values, alpha);
}

/** 0.01 per channel, with room for the float error in a two-decimal value. */
const HEX_TOLERANCE = 0.01 + 1e-9;

/**
 * DTCG/CSS color space → OKLCH. Every space goes to **unbounded** linear sRGB
 * (so a wide-gamut color survives) and then through the one OKLab matrix
 * (linearSrgbToOklch); `srgb` takes srgbToOklch(), the same path as `#hex`, so
 * an `srgb` object and its hex compile bit-identical. `oklch`/`oklab` skip
 * the matrices. Matrices and transfer functions: CSS Color 4, "Sample code
 * for color conversions".
 */
function spaceToOklch(space, [x, y, z], alpha) {
  switch (space) {
    case 'srgb': return srgbToOklch({ r: x, g: y, b: z }, alpha);
    case 'srgb-linear': return linearSrgbToOklch({ r: x, g: y, b: z }, alpha);
    case 'hsl': return srgbToOklch(hslToSrgb(x, y / 100, z / 100), alpha);
    case 'hwb': return srgbToOklch(hwbToSrgb(x, y / 100, z / 100), alpha);
    case 'lab': return xyzD50ToOklch(labToXyzD50(x, y, z), alpha);
    case 'lch': {
      const c = Math.max(0, y), hr = (z * Math.PI) / 180;
      return xyzD50ToOklch(labToXyzD50(x, c * Math.cos(hr), c * Math.sin(hr)), alpha);
    }
    case 'oklab': {
      const c = Math.hypot(y, z);
      return { l: clamp01(x), c, h: ((Math.atan2(z, y) * 180) / Math.PI + 360) % 360, alpha };
    }
    case 'oklch': return { l: clamp01(x), c: Math.max(0, y), h: z, alpha };
    case 'display-p3': return xyzD65ToOklch(mul(P3_TO_XYZ, [x, y, z].map(srgbToLinear)), alpha);
    case 'a98-rgb': return xyzD65ToOklch(mul(A98_TO_XYZ, [x, y, z].map(a98ToLinear)), alpha);
    case 'rec2020': return xyzD65ToOklch(mul(REC2020_TO_XYZ, [x, y, z].map(rec2020ToLinear)), alpha);
    case 'prophoto-rgb': return xyzD50ToOklch(mul(PROPHOTO_TO_XYZ_D50, [x, y, z].map(prophotoToLinear)), alpha);
    case 'xyz-d65': return xyzD65ToOklch([x, y, z], alpha);
    case 'xyz-d50': return xyzD50ToOklch([x, y, z], alpha);
    default: throw new Error(`unknown colorSpace ${JSON.stringify(space)}`);
  }
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const mul = (m, v) => m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
const signed = (v, f) => (v < 0 ? -f(-v) : f(v));

const XYZ_TO_LINEAR_SRGB = [
  [12831 / 3959, -329 / 214, -1974 / 3959],
  [-851781 / 878810, 1648619 / 878810, 36519 / 878810],
  [705 / 12673, -2585 / 12673, 705 / 667],
];
const P3_TO_XYZ = [
  [608311 / 1250200, 189793 / 714400, 198249 / 1000160],
  [35783 / 156275, 247089 / 357200, 198249 / 2500400],
  [0, 32229 / 714400, 5220557 / 5000800],
];
const A98_TO_XYZ = [
  [573536 / 994567, 263643 / 1420810, 187206 / 994567],
  [591459 / 1989134, 6239551 / 9945670, 374412 / 4972835],
  [53769 / 1989134, 351524 / 4972835, 4929758 / 4972835],
];
const REC2020_TO_XYZ = [
  [63426534 / 99577255, 20160776 / 139408157, 47086771 / 278816314],
  [26158966 / 99577255, 472592308 / 697040785, 8267143 / 139408157],
  [0, 19567812 / 697040785, 295819943 / 278816314],
];
const PROPHOTO_TO_XYZ_D50 = [
  [0.7977666449006423, 0.13518129740053308, 0.0313477341283922],
  [0.2880748288194013, 0.711835234241873, 0.00008993693872564],
  [0, 0, 0.8251046025104602],
];
/** Bradford chromatic adaptation, D50 → D65. */
const D50_TO_D65 = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
];
const D50_WHITE = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

const a98ToLinear = (v) => signed(v, (a) => a ** (563 / 256));
const prophotoToLinear = (v) => signed(v, (a) => (a <= 16 / 512 ? a / 16 : a ** 1.8));
const REC_A = 1.09929682680944, REC_B = 0.018053968510807;
const rec2020ToLinear = (v) => signed(v, (a) => (a < REC_B * 4.5 ? a / 4.5 : ((a + REC_A - 1) / REC_A) ** (1 / 0.45)));

/** CIE Lab (D50) → XYZ (D50). */
function labToXyzD50(L, a, b) {
  const l = Math.min(100, Math.max(0, L));
  const k = 24389 / 27, e = 216 / 24389;
  const f1 = (l + 16) / 116;
  const f0 = a / 500 + f1;
  const f2 = f1 - b / 200;
  const xyz = [
    f0 ** 3 > e ? f0 ** 3 : (116 * f0 - 16) / k,
    l > k * e ? ((l + 16) / 116) ** 3 : l / k,
    f2 ** 3 > e ? f2 ** 3 : (116 * f2 - 16) / k,
  ];
  return xyz.map((v, i) => v * D50_WHITE[i]);
}

const xyzD65ToOklch = (xyz, alpha) => {
  const [r, g, b] = mul(XYZ_TO_LINEAR_SRGB, xyz);
  return linearSrgbToOklch({ r, g, b }, alpha);
};
const xyzD50ToOklch = (xyz, alpha) => xyzD65ToOklch(mul(D50_TO_D65, xyz), alpha);

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

/** CSS Color 4: whiteness + blackness ≥ 1 is the gray w / (w + b). */
function hwbToSrgb(hDeg, w, b) {
  if (w + b >= 1) {
    const gray = w / (w + b);
    return { r: gray, g: gray, b: gray };
  }
  const { r, g, b: bl } = hslToSrgb(hDeg, 1, 0.5);
  const k = 1 - w - b;
  return { r: r * k + w, g: g * k + w, b: bl * k + w };
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

/** sRGB transfer function, extended to negative values by symmetry (CSS Color 4). */
function srgbToLinear(v) {
  if (v < -0.04045) return -(((-v + 0.055) / 1.055) ** 2.4);
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function srgbToOklch({ r, g, b }, alpha = 1) {
  return linearSrgbToOklch({ r: srgbToLinear(r), g: srgbToLinear(g), b: srgbToLinear(b) }, alpha);
}

/** Linear sRGB (unbounded, so a wide-gamut color keeps its chroma) → OKLCH. */
function linearSrgbToOklch({ r: lr, g: lg, b: lb }, alpha = 1) {
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
