#!/usr/bin/env node
/**
 * Color-engine ground truth (audit A3; guards the B7 syntax surface added after
 * the P4 hostile-adoption experiment found named colors were a hard stop).
 *
 * Colour math is the most correctness-critical code in the compiler — every
 * derived value, every contrast check, and every emitted hex flows through it.
 * These assertions are reference values, not snapshots of our own output.
 *
 * Run: node scripts/check-color.mjs (also: npm run check:color; in check:all).
 */
import { parseColor, formatHex, contrastRatio, mix, DTCG_COLOR_SPACES } from '../packages/core/src/color.js';
import { loadContrast, wcagContrast } from '../packages/core/src/contrast.js';

let failures = 0;
const eq = (label, got, want) => {
  if (got === want) return;
  console.error(`✖ ${label}: got ${got}, want ${want}`);
  failures++;
};
const near = (label, got, want, tol = 0.01) => {
  if (Math.abs(got - want) <= tol) return;
  console.error(`✖ ${label}: got ${got}, want ~${want}`);
  failures++;
};

// --- syntax coverage: every form a real stylesheet contains → the same colour ---
const hexOf = (s) => formatHex(parseColor(s)).text;
for (const [input, want] of [
  ['#ff0000', '#ff0000'],
  ['#f00', '#ff0000'],
  ['red', '#ff0000'],                       // CSS named (P4's hard stop)
  ['purple', '#800080'],
  ['rebeccapurple', '#663399'],
  ['REBECCAPURPLE', '#663399'],             // case-insensitive
  ['rgb(255, 0, 0)', '#ff0000'],            // legacy comma
  ['rgb(255 0 0)', '#ff0000'],              // modern space
  ['rgb(100% 0% 0%)', '#ff0000'],           // percentage channels
  ['rgba(51, 102, 204, 1)', '#3366cc'],
  ['hsl(0, 100%, 50%)', '#ff0000'],
  ['hsl(120 100% 50%)', '#00ff00'],
  ['hsl(240deg 100% 50%)', '#0000ff'],
  ['hsl(0.5turn 100% 50%)', '#00ffff'],     // turn units
  ['hsl(210 50% 40%)', '#336699'],
]) eq(`parse ${input}`, hexOf(input), want);

// --- alpha, from every syntax that carries it ---
for (const [input, want] of [
  ['#ff000080', 128 / 255],
  ['#f00f', 1],
  ['rgba(255,0,0,0.5)', 0.5],
  ['rgb(255 0 0 / 25%)', 0.25],
  ['hsl(0 100% 50% / 0.75)', 0.75],
  ['transparent', 0],
  ['red', 1],
]) near(`alpha ${input}`, parseColor(input).alpha, want);

// --- every DTCG color space, and the CSS functions that share its converter (issue #25) ---
// Reference values: sRGB red (#ff0000) written in each space, as published by
// independent implementations of the CSS Color 4 conversions (colorjs.io's
// `new Color('red').to(space)`), rounded to 4–5 decimals. Never our own output.
// Within 1/255 per channel of #ff0000, and of red's OKLCH within 0.001.
const RED_IN = {
  srgb: [1, 0, 0],
  'srgb-linear': [1, 0, 0],
  hsl: [0, 100, 50],
  hwb: [0, 0, 0],
  lab: [54.29, 80.81, 69.89],
  lch: [54.29, 106.84, 40.85],
  oklab: [0.62796, 0.22486, 0.12585],
  oklch: [0.62796, 0.25768, 29.2339],
  'display-p3': [0.91749, 0.20029, 0.13856],
  'a98-rgb': [0.85839, 0, 0],
  rec2020: [0.79198, 0.23098, 0.07376],
  'prophoto-rgb': [0.70225, 0.27572, 0.10355],
  'xyz-d65': [0.41239, 0.21264, 0.01933],
  'xyz-d50': [0.43607, 0.22249, 0.01392],
};
const RED = { l: 0.62796, c: 0.25768, h: 29.2339 };
const channels = (hex) => [1, 3, 5].map((k) => parseInt(hex.substr(k, 2), 16));
const nearRed = (label, color) => {
  const got = channels(formatHex(color).text);
  if (got.some((v, i) => Math.abs(v - [255, 0, 0][i]) > 1)) { console.error(`✖ ${label}: got ${formatHex(color).text}, want #ff0000 ±1/255`); failures++; }
  near(`${label} L`, color.l, RED.l, 0.001);
  near(`${label} C`, color.c, RED.c, 0.001);
  near(`${label} H`, color.h, RED.h, 0.05);
};
eq('DTCG color spaces all covered', Object.keys(RED_IN).sort().join(), [...DTCG_COLOR_SPACES].sort().join());
for (const [colorSpace, components] of Object.entries(RED_IN)) nearRed(`DTCG ${colorSpace}`, parseColor({ colorSpace, components }));
for (const input of [
  'lab(54.29% 80.81 69.89)',
  'lab(54.29 64.648% 55.912%)',             // a/b percentages: 100% = 125
  'lch(54.29 106.84 40.85deg)',
  'oklab(62.796% 0.22486 0.12585)',
  'oklch(62.796% 64.42% 29.2339)',          // chroma percentage: 100% = 0.4
  'oklch(0.62796 0.25768 0.081205turn)',
  'hwb(0 0% 0%)',
  'color(srgb 100% 0% 0%)',
  'color(display-p3 0.91749 0.20029 0.13856)',
  'color(xyz 0.41239 0.21264 0.01933)',
  'color(xyz-d50 0.43607 0.22249 0.01392)',
]) nearRed(`parse ${input}`, parseColor(input));
// CSS Color 4: whiteness + blackness ≥ 100% is a gray; `none` is 0.
eq('hwb gray', hexOf('hwb(0 90% 60%)'), '#999999');
eq('hwb(120 20% 20%)', hexOf('hwb(120 20% 20%)'), '#33cc33');
eq('DTCG hwb gray', formatHex(parseColor({ colorSpace: 'hwb', components: ['none', 60, 40] })).text, '#999999');
near('alpha lab() / 40%', parseColor('lab(50 0 0 / 40%)').alpha, 0.4);
near('alpha DTCG', parseColor({ colorSpace: 'oklch', components: [0.5, 0, 0], alpha: 0.25 }).alpha, 0.25);
// Wide gamut survives: display-p3 red is outside sRGB (published oklch(0.6486 0.2995 28.96)).
const p3red = parseColor({ colorSpace: 'display-p3', components: [1, 0, 0] });
near('display-p3 red L', p3red.l, 0.6486, 0.001);
near('display-p3 red C', p3red.c, 0.2995, 0.001);
eq('display-p3 red is clamped in hex', formatHex(p3red).clamped, true);

// --- the srgb object and #hex are the same bits; an oklch object, the same as oklch() ---
const same = (label, a, b) => eq(label, JSON.stringify(a), JSON.stringify(b));
same('srgb object = #1d70b8', parseColor({ colorSpace: 'srgb', components: [29 / 255, 112 / 255, 184 / 255] }), parseColor('#1d70b8'));
same('oklch object = oklch()', parseColor({ colorSpace: 'oklch', components: [0.62, 0.17, 255], alpha: 1 }), parseColor('oklch(0.62 0.17 255)'));

// --- `hex` on an srgb object: wins within 0.01 per channel, else components + TST1123 ---
const warnings = [];
const onWarning = (w) => warnings.push(w);
// The DTCG spec's own example: two-decimal components, the hex the tool showed.
same('agreeing hex wins', parseColor({ colorSpace: 'srgb', components: [0, 0.43, 0.84], alpha: 1, hex: '#026fd7' }, { onWarning }), parseColor('#026fd7'));
eq('agreeing hex: no warning', warnings.length, 0);
same('disagreeing hex loses', parseColor({ colorSpace: 'srgb', components: [0, 0.5, 0.84], hex: '#026fd7' }, { onWarning }), parseColor({ colorSpace: 'srgb', components: [0, 0.5, 0.84] }));
eq('disagreeing hex: TST1123', warnings.map((w) => w.code).join(), 'TST1123');
same('hex is a fallback outside srgb', parseColor({ colorSpace: 'oklch', components: [0.62, 0.17, 255], hex: '#000000' }, { onWarning }), parseColor('oklch(0.62 0.17 255)'));
eq('no warning outside srgb', warnings.length, 1);

// --- unsupported syntax and malformed objects still fail loudly rather than silently mis-parsing ---
for (const bad of [
  'not-a-color', 'rgb(1,2)', 'hsl(nope 1% 2%)', 'lab(50% 40)', 'lch(50 x 30)', 'color(cmyk 0 0 0)', 'color(srgb 1 0)', 'device-cmyk(0 0 0 1)',
  { colorSpace: 'cmyk', components: [0, 0, 0] },
  { components: [0, 0, 0] },
  { colorSpace: 'srgb', components: [0, 0] },
  { colorSpace: 'srgb', components: [0, '0.5', 0] },
  { colorSpace: 'srgb', components: [0, 0, 0], alpha: 2 },
  { colorSpace: 'srgb', components: [0, 0, 0], hex: '#fff' },
  42,
]) {
  let threw = false;
  try { parseColor(bad); } catch { threw = true; }
  if (!threw) { console.error(`✖ ${JSON.stringify(bad)} should have thrown`); failures++; }
}

// --- round-trip fidelity: hex → OKLCH → hex ---
// Deterministic on purpose: an earlier random-sampling version of this check was
// flaky and, worse, reported "lossless" because 4096 random draws missed the
// affected population. The real, measured behaviour (exhaustive 16,777,216-value
// sweep): 1580 values (0.0094%) drift by exactly 1/255, all in the near-black
// range where sRGB's transfer curve is steepest relative to an 8-bit step. That
// is inherent to canonicalizing through OKLCH in float64, and imperceptible —
// but it is a bound we assert rather than a claim we hope for.
const MAX_DRIFT = 1;
const h2 = (n) => n.toString(16).padStart(2, '0');
let worst = 0, drifted = 0, sampled = 0;
for (let r = 0; r < 256; r += 4) for (let g = 0; g < 256; g += 4) for (let b = 0; b < 256; b += 4) {
  const hex = `#${h2(r)}${h2(g)}${h2(b)}`;
  sampled++;
  const out = hexOf(hex);
  if (out === hex) continue;
  drifted++;
  worst = Math.max(worst, ...[1, 3, 5].map((k) => Math.abs(parseInt(hex.substr(k, 2), 16) - parseInt(out.substr(k, 2), 16))));
}
if (worst > MAX_DRIFT) { console.error(`✖ hex round-trip drifted by ${worst}/255 (bound is ${MAX_DRIFT})`); failures++; }
if (drifted / sampled > 0.001) { console.error(`✖ hex round-trip drift affects ${(100 * drifted / sampled).toFixed(3)}% of samples (expected well under 0.1%)`); failures++; }

// Colours anyone actually authors must round-trip exactly.
for (const hex of ['#ffffff', '#000000', '#026fd7', '#1d70b8', '#ca3535', '#3366cc', '#4d90fe', '#333333', '#f5f5f5'])
  eq(`exact round-trip ${hex}`, hexOf(hex), hex);

// --- contrast: WCAG reference values ---
near('contrast black/white', contrastRatio(parseColor('#000'), parseColor('#fff')), 21, 0.05);
near('contrast white/white', contrastRatio(parseColor('#fff'), parseColor('#fff')), 1, 0.001);
near('contrast is order-independent',
  contrastRatio(parseColor('#333'), parseColor('#fff')) - contrastRatio(parseColor('#fff'), parseColor('#333')), 0, 1e-9);

// --- contrast: APCA reference values (BL-15, ADR-0013) ---
// The eight vectors of apca-w3 0.1.9's own test suite (test/index.js), text
// first: Transtyle measures through the package, from the hex it emits, and
// must reproduce them to the last digit.
const { check: apca } = await loadContrast({ check: { contrast: { standard: 'apca' } } }, process.cwd());
for (const [text, bg, want] of [
  ['#888', '#fff', 63.056469930209424],
  ['#fff', '#888', -68.54146436644962],
  ['#000', '#aaa', 58.146262578561334],
  ['#aaa', '#000', -56.24113336839742],
  ['#123', '#def', 91.66830811481631],
  ['#def', '#123', -93.06770049484275],
  ['#123', '#444', 8.32326136957393],
  ['#444', '#123', -7.526878460278154],
])
  eq(`APCA Lc ${text} on ${bg}`, apca.measure(parseColor(text), parseColor(bg)), want);
eq('APCA algorithm is named with its base version', apca.algorithm, 'APCA 0.0.98G-4g (apca-w3 0.1.9)');
eq('APCA body text needs Lc 75', apca.threshold('body'), 75);
eq('APCA content text needs Lc 60', apca.threshold('content'), 60);
// Printed values are rounded toward zero, so just under a threshold never reads as it.
eq('APCA prints Lc -59.96 as -59.9', apca.format(-59.96), 'Lc -59.9');
eq('APCA keeps the polarity sign', apca.format(63.056), 'Lc 63');
eq('WCAG prints 4.47 as 4.4:1', wcagContrast('wcag21-aa').format(4.47), '4.4:1');
eq('WCAG AAA needs 7:1 for every use', wcagContrast('wcag21-aaa').threshold('content'), 7);

// --- mix endpoints ---
eq('mix t=0 is a', formatHex(mix(parseColor('#ff0000'), parseColor('#0000ff'), 0)).text, '#ff0000');
eq('mix t=1 is b', formatHex(mix(parseColor('#ff0000'), parseColor('#0000ff'), 1)).text, '#0000ff');

if (failures) {
  console.error(`\n✖ check-color: ${failures} failure(s)`);
  process.exit(1);
}
console.log('✔ check-color: all syntaxes and the fourteen DTCG color spaces parse to reference values; srgb objects match their hex bit for bit; hex-vs-components rule, alpha, round-trip fidelity, WCAG and APCA contrast (apca-w3 reference vectors) and mix endpoints correct');
