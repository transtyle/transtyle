/**
 * DERIVE stage — the subset of the standard@1 rule pack needed for the
 * foundations catalog (docs/architecture/derivation.md). Deterministic, pure,
 * provenance-recording. Rules only fill holes; authored values always win.
 */

import { COLOR_ROLES, PROVENANCE } from '@transtyle/ir';
import { mix, contrastRatio, contrastPick } from './color.js';

const S = 'semantic.color.';

export function derive(normalized, config, diagnostics) {
  for (const mode of normalized.modeValues) {
    const map = normalized.modes[mode];
    const isDark = mode === 'dark';
    const ctx = { map, isDark, mode, diagnostics };

    const primary = get(map, `${S}primary.base`);
    if (!primary) {
      diagnostics.error('TST1201', 'semantic.color.primary.base is required (config derivation.require).');
      return;
    }
    const surface = get(map, `${S}surface.base`) ?? get(map, `${S}background.base`);
    const text = get(map, `${S}text.base`);

    // --- Role base anchors (rule: hue-anchor / desaturate / alias) ---
    fill(ctx, `${S}accent.base`, { ...primary }, 'alias-primary', ['primary.base']);
    fill(ctx, `${S}secondary.base`, { l: 0.58, c: r3(primary.c * 0.35), h: primary.h, alpha: 1 },
      'desaturate-primary', ['primary.base']);
    fill(ctx, `${S}danger.base`, { l: primary.l, c: Math.min(primary.c + 0.01, 0.2), h: 25, alpha: 1 },
      'hue-anchor(25)', ['primary.base']);
    fill(ctx, `${S}success.base`, { l: 0.6, c: 0.14, h: 150, alpha: 1 }, 'hue-anchor(150)', ['primary.base']);
    fill(ctx, `${S}warning.base`, { l: 0.76, c: 0.14, h: 85, alpha: 1 }, 'hue-anchor(85)', ['primary.base']);
    fill(ctx, `${S}info.base`, { l: 0.58, c: 0.15, h: 230, alpha: 1 }, 'hue-anchor(230)', ['primary.base']);
    fill(ctx, `${S}neutral.base`, { l: 0.55, c: 0.012, h: primary.h, alpha: 1 }, 'neutral-from-primary-hue', ['primary.base']);

    // --- Surfaces (F2): raise(surface); overlay aliases surface-raised; scrim veil ---
    if (surface) {
      const raised = isDark
        ? { l: surface.l + 0.04, c: surface.c, h: surface.h, alpha: 1 }
        : { l: Math.min(1, surface.l + 0.05), c: surface.c * 0.3, h: surface.h, alpha: 1 };
      fill(ctx, `${S}surface-raised.base`, raised, 'raise(surface)', ['surface.base']);
      fill(ctx, `${S}overlay.base`, { ...get(map, `${S}surface-raised.base`) }, 'alias-surface-raised', ['surface-raised.base']);
    }
    fill(ctx, `${S}scrim.base`, { l: 0.1, c: 0, h: 0, alpha: 0.5 }, 'scrim-veil', []);

    // --- Per-role scales: hover/active/subtle + on-colors (F1) ---
    for (const role of COLOR_ROLES) {
      const base = get(map, `${S}${role}.base`);
      if (!base) continue;
      const dl = isDark ? 1 : -1;
      fill(ctx, `${S}${role}.hover`, { ...base, l: clamp01(base.l + 0.05 * dl) }, 'state-delta(hover)', [`${role}.base`]);
      fill(ctx, `${S}${role}.active`, { ...base, l: clamp01(base.l + 0.07 * dl), c: base.c * 0.9 }, 'state-delta(active)', [`${role}.base`]);
      if (surface) {
        fill(ctx, `${S}${role}.subtle`, mix(base, surface, 0.92), 'mix-toward-surface(0.92)', [`${role}.base`, 'surface.base']);
      }

      // text-on-<role>.base: contrast-pick white vs near-black (AA hard rule)
      const onBase = contrastPick(base, [WHITE, NEARBLACK]);
      fill(ctx, `${S}text-on-${role}.base`, { ...onBase.color }, 'contrast-pick', [`${role}.base`]);
      if (onBase.ratio < 4.5) {
        diagnostics.warn('TST2101',
          `text-on-${role}.base is ${onBase.ratio.toFixed(1)}:1 against ${role}.base in ${mode} mode (< 4.5:1 AA)`);
      }

      // text-on-<role>.subtle (F1): prefer on-brand foreground if it clears AA, else text.base
      const subtle = get(map, `${S}${role}.subtle`);
      if (subtle) {
        const active = get(map, `${S}${role}.active`);
        const candidates = [active, text, WHITE, NEARBLACK].filter(Boolean);
        let chosen = candidates.find((cand) => contrastRatio(subtle, cand) >= 4.5)
          ?? contrastPick(subtle, candidates).color;
        fill(ctx, `${S}text-on-${role}.subtle`, { ...chosen }, 'contrast-pick(subtle)', [`${role}.subtle`]);
      }
    }

    // --- Ring (F3): primary, lightened in dark for visibility ---
    fill(ctx, `${S}ring.base`,
      isDark ? { ...primary, l: clamp01(primary.l + 0.07), c: Math.max(0, primary.c - 0.01) } : { ...primary },
      'ring-from-primary', ['primary.base']);

    // --- Categorical data palette (docs/specs/exporters/echarts.md; shadcn --chart-*) ---
    const HUE_OFFSETS = [0, 130, -105, -170, 55];
    const LIGHT_L = [primary.l, 0.62, 0.6, 0.75, 0.58];
    const CHROMA = [primary.c, 0.15, 0.14, 0.13, 0.16];
    const DARK_DL = [0.07, 0.06, 0.06, 0.03, 0.06];
    for (let i = 0; i < 5; i++) {
      fill(ctx, `semantic.palette.categorical.${i + 1}`, {
        l: clamp01(LIGHT_L[i] + (isDark ? DARK_DL[i] : 0)),
        c: CHROMA[i],
        h: (primary.h + HUE_OFFSETS[i] + 360) % 360,
        alpha: 1,
      }, 'categorical-palette', ['primary.base']);
    }
  }
}

const WHITE = { l: 1, c: 0, h: 0, alpha: 1 };
const NEARBLACK = { l: 0.145, c: 0, h: 0, alpha: 1 };

function get(map, path) { return map.get(path)?.value; }
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const r3 = (n) => Math.round(n * 1000) / 1000;

function fill(ctx, path, value, rule, inputs) {
  const existing = ctx.map.get(path);
  if (existing?.value !== undefined) return; // authored/aliased always wins
  ctx.map.set(path, {
    type: 'color',
    value,
    provenance: { kind: PROVENANCE.DERIVED, rule: `${rule}@standard@1`, inputs, mode: ctx.mode },
  });
}
