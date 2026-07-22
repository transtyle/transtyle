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
import { parseColor, formatHex, contrastRatio, mix } from '../packages/core/src/color.js';

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

// --- unsupported syntax still fails loudly rather than silently mis-parsing ---
for (const bad of ['lab(50% 40 59)', 'not-a-color', 'rgb(1,2)', 'hsl(nope 1% 2%)']) {
  let threw = false;
  try { parseColor(bad); } catch { threw = true; }
  if (!threw) { console.error(`✖ ${bad} should have thrown`); failures++; }
}

// --- round-trip fidelity: hex → OKLCH → hex must be lossless (8-bit exact) ---
let worst = 0;
for (let i = 0; i < 4096; i++) {
  const hex = '#' + Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, '0');
  const out = hexOf(hex);
  if (out !== hex) {
    const d = Math.max(...[1, 3, 5].map((k) => Math.abs(parseInt(hex.substr(k, 2), 16) - parseInt(out.substr(k, 2), 16))));
    worst = Math.max(worst, d);
  }
}
if (worst > 0) { console.error(`✖ hex round-trip drifted by ${worst}/255 (must be lossless)`); failures++; }

// --- contrast: WCAG reference values ---
near('contrast black/white', contrastRatio(parseColor('#000'), parseColor('#fff')), 21, 0.05);
near('contrast white/white', contrastRatio(parseColor('#fff'), parseColor('#fff')), 1, 0.001);
near('contrast is order-independent',
  contrastRatio(parseColor('#333'), parseColor('#fff')) - contrastRatio(parseColor('#fff'), parseColor('#333')), 0, 1e-9);

// --- mix endpoints ---
eq('mix t=0 is a', formatHex(mix(parseColor('#ff0000'), parseColor('#0000ff'), 0)).text, '#ff0000');
eq('mix t=1 is b', formatHex(mix(parseColor('#ff0000'), parseColor('#0000ff'), 1)).text, '#0000ff');

if (failures) {
  console.error(`\n✖ check-color: ${failures} failure(s)`);
  process.exit(1);
}
console.log('✔ check-color: all syntaxes parse to reference values; alpha, round-trip fidelity, contrast and mix endpoints correct');
