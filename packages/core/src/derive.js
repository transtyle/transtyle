/**
 * DERIVE stage — the standard@1 rule pack for the revised (role-grid) semantic
 * catalog (docs/architecture/derivation.md, docs/plan/catalog-revision.md T2).
 * Deterministic, pure, provenance-recording. Rules only fill holes; authored
 * values always win.
 *
 * Every color role is a grid: prominence (solid/tint/outline/text) x
 * interaction state (rest/hover/active/selected) + on-colors. Surfaces are an
 * elevation ladder (0-5); content is a ladder too (strong/base/muted/subtle/
 * disabled/inverse). See docs/architecture/ir.md#the-semantic-contract.
 */

import { COLOR_ROLES, PROVENANCE, comboKey, COMPONENT_CATALOG } from '@transtyle/ir';
import { mix, contrastRatio, contrastPick, clampChromaToGamut } from './color.js';

const S = 'semantic.color.';
const WHITE = { l: 1, c: 0, h: 0, alpha: 1 };
const NEARBLACK = { l: 0.145, c: 0, h: 0, alpha: 1 };
const DARK_CANVAS = { l: 0.145, c: 0, h: 0, alpha: 1 };

export function derive(normalized, config, diagnostics) {
  // Every combo in the expanded mode matrix (T8) gets a full pass — not just
  // the primary dimension's values — so a slot that only the *other*
  // dimension varies (e.g. `space.*` under `density`) still gets every
  // catalog-default scale/role/ladder filled in for that combo. `isDark`
  // reads the primary dimension's component of the combo, not the whole
  // compound key: "dark+compact" is still dark mode.
  for (const combo of normalized.allCombos ?? normalized.modeValues) {
    const map = normalized.modes[combo];
    const isDark = (normalized.comboDims?.[combo]?.[normalized.modeDimension] ?? combo) === 'dark';
    const ctx = { map, isDark, mode: combo, diagnostics };
    const mode = combo; // kept for diagnostic messages below — the full combo key, more informative than just the primary dimension's value
    const dl = isDark ? 1 : -1;

    // AL5: TST1201 is NOT raised here any more. This loop runs before deferred
    // aliases resolve, so a dangling `{semantic.color.brand}` had not been
    // diagnosed yet and "primary.solid is missing" printed *above* the actual
    // cause — the user's eye lands on the first error, which was the symptom.
    // The check now lives in compile(), after all alias resolution, where it can
    // both see the root cause and stay silent when there is one.
    const primary = get(map, `${S}primary.solid`);
    if (!primary) return;
    const textBase = get(map, `${S}text.base`);

    // Custom archetyped roles (T7, docs/architecture/ir.md §archetypes) join the
    // grid loop below exactly like a built-in role: resolveRoleSolid()'s fallback
    // branch requires their `.solid` authored, same as `primary`.
    const roles = [...COLOR_ROLES, ...normalized.roleArchetypes.keys()];

    // --- Elevation ladder (E1): surfaces 0-5, shadows 1-4; scrim stays its own veil (F2) ---
    const elev = [];
    elev[0] = rc(
      ctx,
      `${S}elevation.0.surface`,
      () => (isDark ? DARK_CANVAS : WHITE),
      'default-canvas',
      [],
      PROVENANCE.DEFAULTED,
    );
    elev[1] = rc(
      ctx,
      `${S}elevation.1.surface`,
      () => ({ ...elev[0] }),
      'alias(elevation.0.surface)',
      ['elevation.0.surface'],
    );
    for (let n = 2; n <= 5; n++) {
      elev[n] = rc(
        ctx,
        `${S}elevation.${n}.surface`,
        () => raise(elev[n - 1], isDark),
        `raise(elevation.${n - 1}.surface)`,
        [`elevation.${n - 1}.surface`],
      );
    }
    const surface = (n) => elev[n];

    const scrim = rc(
      ctx,
      `${S}scrim`,
      () => ({ l: 0.1, c: 0, h: 0, alpha: 0.5 }),
      'scrim-veil',
      [],
    );
    for (const spec of SHADOW_LEVELS) {
      const alpha = isDark ? spec.dark : spec.light;
      resolve(
        ctx,
        `${S}elevation.${spec.n}.shadow`,
        'shadow',
        () => ({
          offsetX: '0',
          offsetY: spec.y,
          blur: spec.blur,
          spread: '0',
          color: { ...scrim, alpha },
        }),
        `shadow-ramp(${spec.n})`,
        ['scrim'],
      );
    }

    // --- Role grid (C1): solid/tint/outline/text x rest/hover/active/selected + on-colors ---
    for (const role of roles) {
      const rp = `${S}${role}.`;
      const solid = resolveRoleSolid(ctx, role, rp, primary);
      if (!solid) {
        if (normalized.roleArchetypes.has(role)) {
          diagnostics.warn(
            'TST1203',
            `${role}: has a role archetype but no authored ${role}.solid in ${mode} mode — grid not derived`,
          );
        }
        continue; // built-ins: only reachable if primary itself were missing, already handled above
      }

      const solidHover = rc(
        ctx,
        rp + 'solid-hover',
        () => ({ ...solid, l: clamp01(solid.l + 0.05 * dl) }),
        'state-delta(hover)',
        [`${role}.solid`],
      );
      const solidActive = rc(
        ctx,
        rp + 'solid-active',
        () => ({ ...solid, l: clamp01(solid.l + 0.07 * dl), c: solid.c * 0.9 }),
        'state-delta(active)',
        [`${role}.solid`],
      );
      rc(ctx, rp + 'solid-selected', () => ({ ...solidActive }), 'alias(solid-active)', [
        `${role}.solid-active`,
      ]);

      const s1 = surface(1);
      rc(ctx, rp + 'tint', () => mix(solid, s1, 0.92), 'mix-toward-surface(0.92)', [
        `${role}.solid`,
        'elevation.1.surface',
      ]);
      rc(ctx, rp + 'tint-hover', () => mix(solid, s1, 0.88), 'mix-toward-surface(0.88)', [
        `${role}.solid`,
        'elevation.1.surface',
      ]);
      const tintActive = rc(
        ctx,
        rp + 'tint-active',
        () => mix(solid, s1, 0.84),
        'mix-toward-surface(0.84)',
        [`${role}.solid`, 'elevation.1.surface'],
      );
      rc(ctx, rp + 'tint-selected', () => ({ ...tintActive }), 'alias(tint-active)', [
        `${role}.tint-active`,
      ]);

      rc(ctx, rp + 'outline', () => mix(solid, s1, 0.7), 'mix-toward-surface(0.70)', [
        `${role}.solid`,
        'elevation.1.surface',
      ]);
      rc(ctx, rp + 'outline-hover', () => mix(solid, s1, 0.55), 'mix-toward-surface(0.55)', [
        `${role}.solid`,
        'elevation.1.surface',
      ]);

      // on-solid: contrast-pick white/near-black (AA hard rule)
      const onSolidPick = contrastPick(solid, [WHITE, NEARBLACK]);
      rc(ctx, rp + 'on-solid', () => ({ ...onSolidPick.color }), 'contrast-pick', [
        `${role}.solid`,
      ]);
      if (onSolidPick.ratio < 4.5) {
        diagnostics.warn(
          'TST2101',
          `${role}.on-solid is ${onSolidPick.ratio.toFixed(1)}:1 against ${role}.solid in ${mode} mode (< 4.5:1 AA)`,
        );
      }

      // on-tint: on-brand walk (F19) — start at solid-active, step away from tint until AA clears
      const tint = get(map, rp + 'tint');
      const fallbacks = [textBase, WHITE, NEARBLACK].filter(Boolean);
      const onTint = onBrandWalk(tint, solidActive, fallbacks);
      rc(ctx, rp + 'on-tint', () => ({ ...onTint }), 'contrast-pick(subtle)', [`${role}.tint`]);
      const onTintRatio = contrastRatio(tint, get(map, rp + 'on-tint'));
      if (onTintRatio < 4.5) {
        diagnostics.warn(
          'TST2101',
          `${role}.on-tint is ${onTintRatio.toFixed(1)}:1 against ${role}.tint in ${mode} mode (< 4.5:1 AA)`,
        );
      }

      // text: on-brand walk of solid against the page background (elevation.0.surface)
      const s0 = surface(0);
      const roleText = onBrandWalk(s0, solidActive, fallbacks);
      rc(ctx, rp + 'text', () => ({ ...roleText }), 'contrast-pick(text)', [
        `${role}.solid`,
        'elevation.0.surface',
      ]);
      const textResolved = get(map, rp + 'text');
      rc(
        ctx,
        rp + 'text-hover',
        () => ({ ...textResolved, l: clamp01(textResolved.l + 0.05 * dl) }),
        'state-delta(hover)',
        [`${role}.text`],
      );
      rc(
        ctx,
        rp + 'text-active',
        () => ({ ...textResolved, l: clamp01(textResolved.l + 0.07 * dl) }),
        'state-delta(active)',
        [`${role}.text`],
      );

      // text-strong (F20): the role re-anchored at the content text ladder's lightness.
      // Full solid chroma at that lightness can fall outside sRGB (a vivid hue has
      // little gamut headroom near white/black) — reduce chroma at the same l/h
      // rather than let it clip unevenly per-channel downstream.
      if (textBase) {
        rc(
          ctx,
          rp + 'text-strong',
          () => clampChromaToGamut({ l: textBase.l, c: solid.c, h: solid.h, alpha: 1 }),
          'contrast-anchor(text)',
          [`${role}.solid`, 'text.base'],
        );
      }
    }

    // --- Content hierarchy (X1): text.{strong,muted,subtle,disabled}; inverse is a cross-mode pass below ---
    if (textBase) {
      rc(ctx, `${S}text.muted`, () => mix(textBase, surface(1), 0.35), 'mix-toward-surface(0.35)', [
        'text.base',
        'elevation.1.surface',
      ]);
      rc(
        ctx,
        `${S}text.subtle`,
        () => mix(textBase, surface(1), 0.55),
        'mix-toward-surface(0.55)',
        ['text.base', 'elevation.1.surface'],
      );
      rc(ctx, `${S}text.disabled`, () => ({ ...textBase, alpha: 0.38 }), 'alpha(0.38)', [
        'text.base',
      ]);
    }
    const neutralTextStrong = get(map, `${S}neutral.text-strong`);
    if (neutralTextStrong) {
      rc(ctx, `${S}text.strong`, () => ({ ...neutralTextStrong }), 'alias(neutral.text-strong)', [
        'neutral.text-strong',
      ]);
    }

    // --- Links: alias of primary's text cells (F3-adjacent: link is a role-text consumer) ---
    const primaryText = get(map, `${S}primary.text`);
    if (primaryText) {
      rc(ctx, `${S}link.base`, () => ({ ...primaryText }), 'alias(primary.text)', ['primary.text']);
    }
    const primaryTextHover = get(map, `${S}primary.text-hover`);
    if (primaryTextHover) {
      rc(ctx, `${S}link.hover`, () => ({ ...primaryTextHover }), 'alias(primary.text-hover)', [
        'primary.text-hover',
      ]);
    }
    const linkBase = get(map, `${S}link.base`);
    if (linkBase) {
      rc(
        ctx,
        `${S}link.visited`,
        () => ({ ...linkBase, h: (linkBase.h + 40 + 360) % 360 }),
        'hue-shift(40)',
        ['link.base'],
      );
    }

    // --- Ring (F3): primary, lightened in dark for visibility ---
    rc(
      ctx,
      `${S}ring`,
      () =>
        isDark
          ? { ...primary, l: clamp01(primary.l + 0.07), c: Math.max(0, primary.c - 0.01) }
          : { ...primary },
      'ring-from-primary',
      ['primary.solid'],
    );

    // --- Radius scale (F8) + family aliases ---
    const radiusMd = map.get('semantic.radius.md');
    if (radiusMd?.value !== undefined) {
      const dim = /^([\d.]+)([a-z%]+)$/.exec(String(radiusMd.value));
      if (dim) {
        const [, n, unit] = dim;
        const scale = (f) => `${trimNum(parseFloat(n) * f)}${unit}`;
        rd(ctx, 'semantic.radius.sm', () => scale(0.5), 'radius-scale(0.5)', ['radius.md']);
        rd(ctx, 'semantic.radius.lg', () => scale(1.5), 'radius-scale(1.5)', ['radius.md']);
        rd(ctx, 'semantic.radius.xl', () => scale(2), 'radius-scale(2)', ['radius.md']);
        rd(ctx, 'semantic.radius.full', () => '9999px', 'radius-scale(full)', ['radius.md']);
      }
      const mdVal = radiusMd.value;
      for (const fam of ['control', 'field', 'container']) {
        rd(ctx, `semantic.radius.${fam}`, () => mdVal, 'alias(radius.md)', ['radius.md']);
      }
    }

    // --- New defaulted scales (S1/TY1/M1): catalog-default constants, authored always wins ---
    for (const k of SPACE_KEYS) {
      rd(
        ctx,
        `semantic.space.${k}`,
        () => `${trimNum(k * 0.25)}rem`,
        'linear-scale(0.25rem)',
        [],
        PROVENANCE.DEFAULTED,
      );
    }
    for (const [k, v] of Object.entries(SIZE_CONTROL))
      rd(ctx, `semantic.size.control.${k}`, () => v, 'catalog-default', [], PROVENANCE.DEFAULTED);
    for (const [k, v] of Object.entries(BORDER_WIDTH))
      rd(ctx, `semantic.border-width.${k}`, () => v, 'catalog-default', [], PROVENANCE.DEFAULTED);
    // AL2 promotion: the one opacity meaning both reference component-heavy
    // targets independently need (PrimeNG's `disabledOpacity` constant;
    // Bootstrap's three `*-disabled-opacity` variables). Bootstrap's other
    // opacity knobs (carousel indicators, placeholder shimmer) are single-source
    // and stay exporter-private — this is a slot, not an opacity ladder.
    for (const [k, v] of Object.entries(OPACITY))
      resolve(
        ctx,
        `semantic.opacity.${k}`,
        'number',
        () => v,
        'catalog-default',
        [],
        PROVENANCE.DEFAULTED,
      );
    for (const [k, v] of Object.entries(BREAKPOINT))
      rd(ctx, `semantic.breakpoint.${k}`, () => v, 'catalog-default', [], PROVENANCE.DEFAULTED);
    for (const [k, v] of Object.entries(Z_INDEX))
      resolve(
        ctx,
        `semantic.z.${k}`,
        'number',
        () => v,
        'catalog-default',
        [],
        PROVENANCE.DEFAULTED,
      );
    for (const [k, v] of Object.entries(TYPE_SIZE))
      rd(
        ctx,
        `semantic.type.size.${k}`,
        () => v,
        'modular-scale(1rem,1.25)',
        [],
        PROVENANCE.DEFAULTED,
      );
    for (const [k, v] of Object.entries(TYPE_WEIGHT))
      resolve(
        ctx,
        `semantic.type.weight.${k}`,
        'number',
        () => v,
        'catalog-default',
        [],
        PROVENANCE.DEFAULTED,
      );
    for (const [k, v] of Object.entries(TYPE_LEADING))
      resolve(
        ctx,
        `semantic.type.leading.${k}`,
        'number',
        () => v,
        'catalog-default',
        [],
        PROVENANCE.DEFAULTED,
      );
    for (const [k, v] of Object.entries(TYPE_TRACKING))
      rd(ctx, `semantic.type.tracking.${k}`, () => v, 'catalog-default', [], PROVENANCE.DEFAULTED);
    for (const [k, v] of Object.entries(DURATION))
      resolve(
        ctx,
        `semantic.duration.${k}`,
        'duration',
        () => v,
        'catalog-default',
        [],
        PROVENANCE.DEFAULTED,
      );
    for (const [k, v] of Object.entries(EASING))
      resolve(
        ctx,
        `semantic.easing.${k}`,
        'cubicBezier',
        () => v,
        'catalog-default',
        [],
        PROVENANCE.DEFAULTED,
      );

    // Type role composites: project the primitive scales onto display/heading/title/body/label/code x sm/md/lg
    for (const role of Object.keys(TYPE_ROLE_SIZE)) {
      const familyPath =
        role === 'code'
          ? 'semantic.font.mono'
          : role === 'display' && get(map, 'semantic.font.display')
            ? 'semantic.font.display'
            : 'semantic.font.sans';
      for (const size of ['sm', 'md', 'lg']) {
        const sizeKey = TYPE_ROLE_SIZE[role][size];
        resolve(
          ctx,
          `semantic.type.role.${role}.${size}`,
          'typography',
          // AL5: members whose source doesn't resolve are OMITTED, not carried
          // as `undefined`. A design system that authors no font family is
          // ordinary, and every consumer of this composite — exporters, the
          // Bootstrap `part` recipes — reads members by name; an explicit
          // `fontFamily: undefined` reads as "there is a value" and reached
          // stylesheets as `--type-role-body-md-family: undefined;` (18 of them
          // in css-variables alone). An absent key is the truthful shape.
          () =>
            Object.fromEntries(
              Object.entries({
                fontFamily: get(map, familyPath),
                fontSize: get(map, `semantic.type.size.${sizeKey}`),
                fontWeight: get(map, `semantic.type.weight.${TYPE_ROLE_WEIGHT[role]}`),
                lineHeight: get(map, `semantic.type.leading.${TYPE_ROLE_LEADING[role]}`),
              }).filter(([, v]) => v !== undefined),
            ),
          `type-role-composite(${role}.${size})`,
          [`type.size.${sizeKey}`],
          PROVENANCE.DEFAULTED,
        );
      }
    }

    // --- Categorical data palette (docs/specs/exporters/echarts.md; shadcn --chart-*) ---
    // 8 colors. The first 5 are frozen: extending the palette must never change
    // existing targets' output (shadcn maps 1–5; ECharts consumes all 8).
    const HUE_OFFSETS = [0, 130, -105, -170, 55, -55, 85, -140];
    const LIGHT_L = [primary.l, 0.62, 0.6, 0.75, 0.58, 0.65, 0.7, 0.6];
    const CHROMA = [primary.c, 0.15, 0.14, 0.13, 0.16, 0.13, 0.14, 0.13];
    const DARK_DL = [0.07, 0.06, 0.06, 0.03, 0.06, 0.05, 0.04, 0.06];
    for (let i = 0; i < 8; i++) {
      rc(
        ctx,
        `semantic.palette.categorical.${i + 1}`,
        () => ({
          l: clamp01(LIGHT_L[i] + (isDark ? DARK_DL[i] : 0)),
          c: CHROMA[i],
          h: (primary.h + HUE_OFFSETS[i] + 360) % 360,
          alpha: 1,
        }),
        'categorical-palette',
        ['primary.solid'],
      );
    }

    // --- Component tier (C2, docs/plan/component-tier.md): resolve-or-fill
    // from COMPONENT_CATALOG. Component tokens default from semantic tokens
    // — an empty `component.*` tier still compiles, the same guarantee every
    // other resolve-or-fill slot in the catalog already gives. An authored
    // `component.<name>.<token>` always wins: the generic collectTokens walk
    // (packages/ir) already carries it through untouched before DERIVE runs,
    // same as any other tier — nothing tier-specific needed for that half.
    // A `component:`-prefixed defaultFrom layers one component slot on another
    // (AL2: `button.padding-x` defaults from `control.padding-x`), so authoring
    // the shared control moves buttons too while authoring the button alone
    // stays local. Catalog order guarantees the source is already resolved.
    for (const [name, tokens] of Object.entries(COMPONENT_CATALOG)) {
      for (const [tokenName, { type, defaultFrom }] of Object.entries(tokens)) {
        const fromComponent = defaultFrom.startsWith('component:');
        const sourcePath = fromComponent ? defaultFrom.slice('component:'.length) : defaultFrom;
        const fullPath = `${fromComponent ? 'component' : 'semantic'}.${sourcePath}`;
        // AL5: a `defaultFrom` whose source does not exist has no default to
        // give. Materializing the slot anyway produced an entry with
        // `value: undefined` and a `derived` provenance — which read as "this
        // is covered" to every exporter and to the coverage report, then
        // emitted `$btn-border-radius: undefined;`. Reachable from an ordinary
        // sparse design system: nothing authors `semantic.radius.md`, so the
        // whole radius family (and with it `radius.control`) never exists.
        // Leaving the slot absent is the honest state — the catalog says the
        // default comes from somewhere, and that somewhere isn't there.
        if (get(map, fullPath) === undefined && !map.has(`component.${name}.${tokenName}`)) continue;
        resolve(
          ctx,
          `component.${name}.${tokenName}`,
          type,
          () => get(map, fullPath),
          `alias(${sourcePath})`,
          [sourcePath],
        );
      }
    }
  }

  // --- Cross-mode pass: text.inverse (F15) — needs both modes' per-mode work done first ---
  // Runs per combo (T8), flipping only the primary (color-scheme) dimension's
  // component and holding every other dimension fixed: "dark+compact"'s
  // inverse is "light+compact", not the unrelated "light+comfortable".
  const primaryDim = normalized.modeDimension;
  for (const combo of normalized.allCombos ?? normalized.modeValues) {
    const values = normalized.comboDims?.[combo];
    const here = values?.[primaryDim] ?? combo;
    const flipped = here === 'dark' ? 'light' : here === 'light' ? 'dark' : null;
    if (!flipped) continue;
    const otherCombo =
      values && normalized.dimensionNames
        ? comboKey(normalized.dimensionNames, { ...values, [primaryDim]: flipped })
        : flipped;
    if (!normalized.modes[otherCombo]) continue;
    const map = normalized.modes[combo];
    const otherTextBase = get(normalized.modes[otherCombo], `${S}text.base`);
    if (!otherTextBase) continue;
    const ctx = { map, isDark: here === 'dark', mode: combo, diagnostics };
    rc(ctx, `${S}text.inverse`, () => ({ ...otherTextBase }), 'cross-mode(text.base)', [
      'text.base',
    ]);
  }
}

// ---------- role-solid anchors ----------

function resolveRoleSolid(ctx, role, rp, primary) {
  if (role === 'primary') return get(ctx.map, rp + 'solid'); // required, authored — checked by caller
  if (role === 'accent')
    return rc(ctx, rp + 'solid', () => ({ ...primary }), 'alias(primary.solid)', ['primary.solid']);
  if (role === 'secondary')
    return rc(
      ctx,
      rp + 'solid',
      () => ({ l: 0.58, c: r3(primary.c * 0.35), h: primary.h, alpha: 1 }),
      'desaturate-primary',
      ['primary.solid'],
    );
  if (role === 'danger')
    return rc(
      ctx,
      rp + 'solid',
      () => ({ l: primary.l, c: Math.min(primary.c + 0.01, 0.2), h: 25, alpha: 1 }),
      'hue-anchor(25)',
      ['primary.solid'],
    );
  if (role === 'success')
    return rc(ctx, rp + 'solid', () => ({ l: 0.6, c: 0.14, h: 150, alpha: 1 }), 'hue-anchor(150)', [
      'primary.solid',
    ]);
  if (role === 'warning')
    return rc(ctx, rp + 'solid', () => ({ l: 0.76, c: 0.14, h: 85, alpha: 1 }), 'hue-anchor(85)', [
      'primary.solid',
    ]);
  if (role === 'info')
    return rc(
      ctx,
      rp + 'solid',
      () => ({ l: 0.58, c: 0.15, h: 230, alpha: 1 }),
      'hue-anchor(230)',
      ['primary.solid'],
    );
  if (role === 'neutral')
    return rc(
      ctx,
      rp + 'solid',
      () => ({ l: 0.55, c: 0.012, h: primary.h, alpha: 1 }),
      'neutral-from-primary-hue',
      ['primary.solid'],
    );
  return get(ctx.map, rp + 'solid');
}

// ---------- shared math ----------

/** raise(): one elevation step — toward white in light mode, lighter+neutral-flattening in dark. */
function raise(c, isDark) {
  return isDark
    ? { l: clamp01(c.l + 0.04), c: c.c, h: c.h, alpha: 1 }
    : { l: clamp01(Math.min(1, c.l + 0.05)), c: c.c * 0.3, h: c.h, alpha: 1 };
}

/**
 * on-brand walk (F19): start at `active`, step lightness away from `bg` in
 * 0.01 increments until the pair clears AA 4.5:1; fall back to the
 * max-contrast pick among `fallbacks` if the lightness clamp is reached first.
 */
function onBrandWalk(bg, active, fallbacks) {
  const dir = bg.l >= 0.5 ? -1 : 1;
  for (let i = 0; ; i++) {
    const l = r3(active.l + dir * i * 0.01);
    if (l < 0 || l > 1) break;
    const cand = { ...active, l };
    if (contrastRatio(bg, cand) >= 4.5) return cand;
  }
  return contrastPick(bg, fallbacks).color;
}

// ---------- catalog-default tables ----------

const SHADOW_LEVELS = [
  { n: 1, y: '1px', blur: '2px', light: 0.06, dark: 0.3 },
  { n: 2, y: '4px', blur: '12px', light: 0.1, dark: 0.4 },
  { n: 3, y: '12px', blur: '32px', light: 0.16, dark: 0.5 },
  { n: 4, y: '24px', blur: '48px', light: 0.2, dark: 0.55 },
];
const SPACE_KEYS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24];
const SIZE_CONTROL = { sm: '2rem', md: '2.25rem', lg: '2.5rem' };
const BORDER_WIDTH = { thin: '1px', medium: '2px', thick: '4px' };
const OPACITY = { disabled: 0.6 };
const BREAKPOINT = {
  xs: '480px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};
const Z_INDEX = {
  hide: -1,
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  banner: 1030,
  overlay: 1040,
  modal: 1050,
  popover: 1060,
  toast: 1080,
  tooltip: 1090,
};
const TYPE_SIZE = {
  xs: '0.64rem',
  sm: '0.8rem',
  md: '1rem',
  lg: '1.25rem',
  xl: '1.563rem',
  '2xl': '1.953rem',
  '3xl': '2.441rem',
  '4xl': '3.052rem',
};
const TYPE_WEIGHT = { regular: 400, medium: 500, semibold: 600, bold: 700 };
const TYPE_LEADING = { tight: 1.25, normal: 1.5, loose: 1.75 };
const TYPE_TRACKING = { tight: '-0.01em', normal: '0', wide: '0.02em' };
const DURATION = { instant: '0ms', fast: '150ms', normal: '250ms', slow: '400ms', slower: '600ms' };
const EASING = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  enter: 'cubic-bezier(0, 0, 0, 1)',
  exit: 'cubic-bezier(0.3, 0, 1, 1)',
  emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};
const TYPE_ROLE_SIZE = {
  display: { sm: '2xl', md: '3xl', lg: '4xl' },
  heading: { sm: 'lg', md: 'xl', lg: '2xl' },
  title: { sm: 'md', md: 'lg', lg: 'xl' },
  body: { sm: 'sm', md: 'md', lg: 'lg' },
  label: { sm: 'xs', md: 'sm', lg: 'md' },
  code: { sm: 'xs', md: 'sm', lg: 'md' },
};
const TYPE_ROLE_WEIGHT = {
  display: 'bold',
  heading: 'semibold',
  title: 'semibold',
  body: 'regular',
  label: 'medium',
  code: 'regular',
};
const TYPE_ROLE_LEADING = {
  display: 'tight',
  heading: 'tight',
  title: 'normal',
  body: 'normal',
  label: 'normal',
  code: 'normal',
};

// ---------- helpers ----------

function get(map, path) {
  return map.get(path)?.value;
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const r3 = (n) => Math.round(n * 1000) / 1000;
const trimNum = (n) => String(Math.round(n * 1000) / 1000);

/** Resolve-or-fill: returns the existing (authored/aliased) value, or computes, stores, and returns it. */
function resolve(ctx, path, type, compute, rule, inputs, kind = PROVENANCE.DERIVED) {
  const existing = ctx.map.get(path);
  if (existing?.value !== undefined) return existing.value;
  // An authored alias waiting on a slot DERIVE fills later (normalize.js
  // DEFERRED) has no value yet but must still win over the default — filling
  // it here would silently discard what the author wrote.
  if (existing?.pendingAlias) return undefined;
  const value = compute();
  ctx.map.set(path, {
    type,
    value,
    provenance: { kind, rule: `${rule}@standard@1`, inputs, mode: ctx.mode },
  });
  return value;
}
const rc = (ctx, path, compute, rule, inputs, kind) =>
  resolve(ctx, path, 'color', compute, rule, inputs, kind);
const rd = (ctx, path, compute, rule, inputs, kind) =>
  resolve(ctx, path, 'dimension', compute, rule, inputs, kind);
