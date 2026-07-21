/**
 * @transtyle/exporter-bootstrap — emits a Bootstrap (>=5.3 <6) theme from the
 * resolved IR. Spec: docs/specs/exporters/bootstrap.md.
 *
 * Two consumption paths (the Bootstrap community is split):
 *  - Sass path (full fidelity): `_variables.transtyle.scss` before Bootstrap,
 *    `_maps.transtyle.scss` after Bootstrap's own variables — our OKLCH-derived
 *    subtle/emphasis values REPLACE Bootstrap's sRGB tint/shade derivations.
 *  - CSS-variable path (lower fidelity, documented): `bootstrap-theme.css`
 *    loaded after bootstrap.css — rethemes the token tier only; values Sass
 *    baked into component rules (`.btn-primary` backgrounds, hovers) are out
 *    of reach (exercise finding F13).
 *
 * Exporter conventions, now engine-owned via the role grid
 * (docs/architecture/ir.md#color-the-role-grid; docs/plan/catalog-revision.md T3):
 *  - $light/$dark pseudo-roles (F12): neutral.tint / neutral.text-strong.
 *  - border-subtle(role) = role.outline directly (was a private mix; F10 is
 *    now a first-class grid cell — no exporter-side formula left).
 *  - $light/$dark's own bg-subtle stay Bootstrap-private (no grid equivalent
 *    for "a tint of a tint"); $light's border-subtle = neutral.outline
 *    (same 0.70 ratio as every other role, so no private formula needed there
 *    either); $dark's border-subtle keeps its private 0.55 mix.
 *  - link ← primary; dark link ← ring[dark] (F13 asymmetry), hover = one
 *    lightness step (+0.05 in dark, primary.solid-hover in light).
 *  - shadows composed from scrim at fixed alpha ramps (F2).
 *  - type/space scales: consumed from the engine's always-present
 *    catalog-default scales (semantic.type.*, semantic.space.*) instead of a
 *    private exporter fallback table.
 */

import { droppedDimensions } from '@transtyle/ir';

const S = 'semantic.color.';

/** Bootstrap's theme-color order; light/dark are exporter pseudo-roles (F12). */
const ROLES = ['primary', 'secondary', 'success', 'info', 'warning', 'danger'];
const SHADOWS = [
  { name: 'sm', geometry: '0 1px 2px', light: 0.06, dark: 0.3 },
  { name: '', geometry: '0 4px 12px', light: 0.1, dark: 0.4 },
  { name: 'lg', geometry: '0 12px 32px', light: 0.16, dark: 0.5 },
];
/** Bootstrap's $spacers keys ← the engine's linear space scale (0.25rem base). */
const SPACE_MAP = [['0', '0'], ['1', '1'], ['2', '2'], ['3', '4'], ['4', '6'], ['5', '12']];

export default {
  name: 'bootstrap',

  emit(normalized, ctx) {
    // Mode polarity: bind mode NAMES (ir.md#modes) — :root/[data-bs-theme=light]
    // is always the light map, even for dark-native design systems.
    const light = normalized.modes.light ?? normalized.modes[normalized.defaultMode];
    const dark = normalized.modes.dark;
    const r = resolve(light, dark, ctx);
    // Mode dimensions this exporter doesn't express (T8, ir.md#modes) — a
    // no-op unless the compile actually declares one, e.g. `density`.
    r.coverage.push(...droppedDimensions(normalized.dimensionNames, ['color-scheme']));

    const files = [
      { path: '_variables.transtyle.scss', contents: renderVariables(r, ctx), kind: 'stylesheet' },
      { path: '_maps.transtyle.scss', contents: renderMaps(r, ctx), kind: 'stylesheet' },
      { path: 'bootstrap-theme.css', contents: renderCss(r, ctx), kind: 'stylesheet' },
      { path: 'usage.md', contents: renderUsage(ctx, r.coverage), kind: 'doc' },
    ];
    return { files, coverage: r.coverage };
  },
};

// ---------- resolution ----------

function resolve(light, dark, ctx) {
  const coverage = [];
  const hx = (c) => (c ? ctx.formatHex(c).text : undefined);
  const val = (map, p) => map?.get(S + p)?.value;
  const raw = (map, p) => map?.get(`semantic.${p}`)?.value;
  const provKind = (map, p) => map?.get(S + p)?.provenance.kind;
  const cls = (p, mappedCls = 'native') =>
    mappedCls !== 'native' ? mappedCls : provKind(light, p) === 'derived' ? 'derived' : 'native';
  const cov = (variable, slot, klass, note) =>
    coverage.push({ variable, slot, class: klass, ...(note && { note }) });

  const perMode = (map) => {
    if (!map) return null;
    const surface = val(map, 'elevation.1.surface');
    const role = (name) => {
      if (name === 'light') {
        return {
          base: val(map, 'neutral.tint'),
          text: val(map, 'neutral.on-tint'),
          bgSubtle: ctx.mix(val(map, 'neutral.tint'), surface, 0.6),
          borderSubtle: val(map, 'neutral.outline'),
        };
      }
      if (name === 'dark') {
        return {
          base: val(map, 'neutral.text-strong'),
          text: val(map, 'neutral.text-strong'),
          bgSubtle: ctx.mix(val(map, 'neutral.text-strong'), surface, 0.85),
          borderSubtle: ctx.mix(val(map, 'neutral.text-strong'), surface, 0.55),
        };
      }
      return {
        base: val(map, `${name}.solid`),
        text: val(map, `${name}.on-tint`),
        bgSubtle: val(map, `${name}.tint`),
        borderSubtle: val(map, `${name}.outline`),
      };
    };
    const ring = val(map, 'ring');
    return {
      roles: Object.fromEntries([...ROLES, 'light', 'dark'].map((n) => [n, role(n)])),
      bodyBg: val(map, 'elevation.0.surface'),
      bodyColor: val(map, 'text.base'),
      emphasis: val(map, 'neutral.text-strong'),
      secondaryColor: val(map, 'text.muted'),
      secondaryBg: val(map, 'neutral.tint'),
      tertiaryBg: val(map, 'elevation.1.surface'),
      border: val(map, 'border'),
      primary: val(map, 'primary.solid'),
      primaryHover: val(map, 'primary.solid-hover'),
      ring,
      ringHover: ring && { ...ring, l: Math.min(1, ring.l + 0.05) },
      scrim: val(map, 'scrim'),
    };
  };

  // theme-color coverage (once, from the light map)
  for (const name of ROLES) {
    cov(`$${name}`, `${S}${name}.solid`, cls(`${name}.solid`));
    cov(`$theme-colors-text.${name}`, `${S}${name}.on-tint`, cls(`${name}.on-tint`));
    cov(`$theme-colors-bg-subtle.${name}`, `${S}${name}.tint`, cls(`${name}.tint`));
    cov(`$theme-colors-border-subtle.${name}`, `${S}${name}.outline`, cls(`${name}.outline`), 'promoted from a private mix to a first-class grid cell (F10)');
  }
  cov('$light', `${S}neutral.tint`, cls('neutral.tint'), 'exporter convention: $light/$dark map from the neutral role (F12)');
  cov('$dark', `${S}neutral.text-strong`, cls('neutral.text-strong'), 'exporter convention (F12)');
  cov('$body-bg', `${S}elevation.0.surface`, cls('elevation.0.surface'));
  cov('$body-color', `${S}text.base`, cls('text.base'));
  cov('$body-emphasis-color', `${S}neutral.text-strong`, cls('neutral.text-strong'));
  cov('$body-secondary-color', `${S}text.muted`, cls('text.muted'));
  cov('$body-secondary-bg', `${S}neutral.tint`, cls('neutral.tint'));
  cov('$body-tertiary-bg', `${S}elevation.1.surface`, cls('elevation.1.surface'));
  cov('$border-color', `${S}border`, cls('border'));
  cov('$link-color', `${S}primary.solid`, cls('primary.solid'), 'exporter convention: link ← primary.solid (matches Bootstrap default)');
  cov('$link-hover-color', `${S}primary.solid-hover`, cls('primary.solid-hover'), 'replaces Bootstrap sRGB shade-color(20%)');
  cov('$focus-ring-color', `${S}ring`, cls('ring'), 'ring ← primary (F3) at Bootstrap conventional alpha .25');
  for (const s of SHADOWS) cov(`$box-shadow${s.name && '-' + s.name}`, `${S}scrim`, 'derived', 'composed from scrim alpha ramp (F2)');
  cov('$box-shadow-inset', '—', 'unsupported', 'no IR inset-shadow concept; Bootstrap default kept');

  const radius = (k) => light.get(`semantic.radius.${k}`);
  for (const k of ['md', 'sm', 'lg', 'xl']) {
    const e = radius(k);
    if (e) cov(`$border-radius${k === 'md' ? '' : '-' + k}`, `semantic.radius.${k}`, e.provenance.kind === 'derived' ? 'derived' : 'native');
  }
  cov('$border-radius-xxl', 'semantic.radius.xl', 'approximated', 'exporter convention: xl × 2 — no IR 2xl slot (F8 watch item)');
  cov('$border-radius-pill', 'semantic.radius.full', 'derived', 'emitted in Bootstrap idiom (50rem)');

  const font = (k) => light.get(`semantic.font.${k}`);
  if (font('sans')) cov('$font-family-sans-serif', 'semantic.font.sans', 'native');
  if (font('mono')) cov('$font-family-monospace', 'semantic.font.mono', 'native');

  const typeProv = light.get('semantic.type.size.md')?.provenance.kind;
  cov('$font-size-base…$h1-font-size', 'semantic.type.*', (typeProv === 'authored' || typeProv === 'aliased') ? 'native' : 'derived',
    typeProv === 'defaulted' ? 'defaulted modular scale (base 1rem, ratio 1.25) — no authored type tokens' : undefined);
  cov('$display-font-sizes', '—', 'unsupported', 'no IR concept of display sizes; Bootstrap defaults kept');

  const spaceProv = light.get('semantic.space.4')?.provenance.kind;
  cov('$spacer/$spacers', 'semantic.space.*', (spaceProv === 'authored' || spaceProv === 'aliased') ? 'native' : 'derived',
    spaceProv === 'defaulted' ? 'defaulted linear scale (base 0.25rem)' : undefined);
  cov('$grid-breakpoints/$container-max-widths', '—', 'unsupported', 'breakpoints are a known IR catalog candidate');
  cov('$btn-*/component tier', '—', 'unsupported', 'component-tier variables reserved for the v2 component layer (ADR-0003)');
  cov('motion ($transition-*)', '—', 'dropped', 'Bootstrap themes almost none of it');

  const typeScale = {
    base: raw(light, 'type.size.md'),
    leading: raw(light, 'type.leading.normal'),
    h1: raw(light, 'type.size.4xl'), h2: raw(light, 'type.size.3xl'), h3: raw(light, 'type.size.2xl'),
    h4: raw(light, 'type.size.xl'), h5: raw(light, 'type.size.lg'), h6: raw(light, 'type.size.md'),
  };
  const spaceScale = SPACE_MAP.map(([bsKey, catKey]) => {
    const v = raw(light, `space.${catKey}`);
    return [bsKey, parseFloat(v) === 0 ? '0' : v, `space.${catKey}`];
  });

  return {
    light: perMode(light),
    dark: perMode(dark),
    radiusEntries: Object.fromEntries(['md', 'sm', 'lg', 'xl', 'full'].map((k) => [k, radius(k)])),
    fontSans: font('sans'),
    fontMono: font('mono'),
    typeScale,
    spaceScale,
    hx,
    coverage,
  };
}

// ---------- shared formatting ----------

const fontList = (value) => value.map((f) => (/[^a-z-]/.test(f) ? `"${f}"` : f)).join(', ');
const rgbTriplet = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};
const scssHeader = (ctx) => [
  '// GENERATED by transtyle — do not edit; source: ' + ctx.projectName + ' token files',
  '// Target: bootstrap (>=5.3 <6), Sass path · rules standard@1',
  '//',
  '// Import order (Sass path):',
  '//   @import "variables.transtyle";  // this file — BEFORE bootstrap',
  '//   @import "maps.transtyle";       // AFTER bootstrap variables, BEFORE the rest',
  '//   (or with bootstrap.scss directly — see usage.md)',
  '',
].join('\n');

const xxl = (radiusMd) => {
  // exporter convention: xl × 2 (F8 watch item), from the same dimension unit
  const m = /^([\d.]+)([a-z%]+)$/.exec(String(radiusMd));
  return m ? `${parseFloat(m[1]) * 4}${m[2]}` : '2rem';
};

// ---------- _variables.transtyle.scss ----------

function renderVariables(r, ctx) {
  const { hx } = r;
  const L = r.light, D = r.dark;
  const lines = [scssHeader(ctx)];
  lines.push('// ---------------------------------------------------------------- theme colors');
  for (const [name, sassVar] of [...ROLES.map((n) => [n, n]), ['light', 'light'], ['dark', 'dark']]) {
    lines.push(`$${sassVar}: ${hx(L.roles[name].base)};`);
  }
  lines.push('');
  lines.push('// -------------------------------------------------------------- body / surfaces');
  lines.push(`$body-bg:              ${hx(L.bodyBg)};  // elevation.0.surface`);
  lines.push(`$body-color:           ${hx(L.bodyColor)};  // text.base`);
  lines.push(`$body-emphasis-color:  ${hx(L.emphasis)};  // neutral.text-strong (F20)`);
  lines.push(`$body-secondary-color: ${hx(L.secondaryColor)};  // text.muted`);
  lines.push(`$body-tertiary-bg:     ${hx(L.tertiaryBg)};  // elevation.1.surface (F11)`);
  lines.push(`$body-secondary-bg:    ${hx(L.secondaryBg)};  // neutral.tint (F11)`);
  if (D) {
    lines.push('');
    lines.push('// dark mode (data-bs-theme="dark") — Bootstrap 5.3 *-dark variables');
    lines.push(`$body-bg-dark:              ${hx(D.bodyBg)};`);
    lines.push(`$body-color-dark:           ${hx(D.bodyColor)};`);
    lines.push(`$body-emphasis-color-dark:  ${hx(D.emphasis)};`);
    lines.push(`$body-secondary-color-dark: ${hx(D.secondaryColor)};`);
    lines.push(`$body-tertiary-bg-dark:     ${hx(D.tertiaryBg)};`);
    lines.push(`$body-secondary-bg-dark:    ${hx(D.secondaryBg)};`);
    lines.push(`$border-color-dark:         ${hx(D.border)};`);
  }
  lines.push('');
  lines.push('// -------------------------------------------------------------- links / focus');
  lines.push('$link-color:       $primary;  // exporter convention: link ← primary.solid');
  lines.push(`$link-hover-color: ${hx(L.primaryHover)};  // primary.solid-hover — replaces Bootstrap's sRGB shade-color(20%)`);
  lines.push('// $link-color-dark intentionally NOT emitted: Bootstrap derives it from $primary (F13)');
  lines.push('$focus-ring-color: rgba($primary, .25);  // ring ← primary (F3)');
  lines.push('');
  lines.push('// ---------------------------------------------------------------- typography');
  if (r.fontSans) lines.push(`$font-family-sans-serif: ${fontList(r.fontSans.value)};  // font.sans`);
  if (r.fontMono) lines.push(`$font-family-monospace:  ${fontList(r.fontMono.value)};  // font.mono`);
  const ts = r.typeScale;
  lines.push(`$font-size-base:   ${ts.base};  // type.size.md`);
  lines.push(`$line-height-base: ${ts.leading};   // type.leading.normal`);
  lines.push(`$h1-font-size: ${ts.h1};  // type.size.4xl`);
  lines.push(`$h2-font-size: ${ts.h2};  // type.size.3xl`);
  lines.push(`$h3-font-size: ${ts.h3};  // type.size.2xl`);
  lines.push(`$h4-font-size: ${ts.h4};  // type.size.xl`);
  lines.push(`$h5-font-size: ${ts.h5};  // type.size.lg`);
  lines.push(`$h6-font-size: ${ts.h6};  // type.size.md`);
  lines.push('');
  lines.push('// ------------------------------------------------------------------- spacing');
  lines.push(`$spacer: ${r.spaceScale[3][1]};  // space.4`);
  lines.push('$spacers: (');
  lines.push(r.spaceScale.map(([k, v, slot]) => `  ${k}: ${v}${k === '5' ? '' : ','}   // ${slot}`).join('\n'));
  lines.push(');');
  lines.push('');
  lines.push('// ------------------------------------------------------------- radius / borders');
  const rad = r.radiusEntries;
  if (rad.md) lines.push(`$border-radius:      ${rad.md.value};  // radius.md`);
  if (rad.sm) lines.push(`$border-radius-sm:   ${rad.sm.value};  // radius.sm · derived (F8: md × 0.5)`);
  if (rad.lg) lines.push(`$border-radius-lg:   ${rad.lg.value};  // radius.lg · derived (F8: md × 1.5)`);
  if (rad.xl) lines.push(`$border-radius-xl:   ${rad.xl.value};  // radius.xl · derived (F8: md × 2)`);
  if (rad.md) lines.push(`$border-radius-xxl:  ${xxl(rad.md.value)};  // exporter convention: xl × 2 (F8 watch item)`);
  lines.push('$border-radius-pill: 50rem;  // radius.full, in Bootstrap\'s own idiom');
  lines.push(`$border-color:       ${hx(L.border)};  // border`);
  lines.push('');
  lines.push('// ------------------------------------------------------------------- shadows');
  lines.push('// Composed from scrim at fixed alpha ramps (F2)');
  for (const s of SHADOWS) {
    lines.push(`$box-shadow${s.name ? '-' + s.name : ''}: ${s.geometry} rgba(${hx(L.scrim)}, .${String(s.light * 100).padStart(2, '0')});`);
  }
  lines.push('// shadow.xl: dropped — Bootstrap has no -xl slot; $box-shadow-inset kept at Bootstrap default');
  lines.push('');
  return lines.join('\n');
}

// ---------- _maps.transtyle.scss ----------

function renderMaps(r, ctx) {
  const { hx } = r;
  const mapBlock = (name, pick, mode) => {
    const entries = [...ROLES, 'light', 'dark'].map((role) => {
      const v = hx(pick(r[mode].roles[role]));
      return `  "${role}": ${v}`;
    });
    return `$${name}: (\n${entries.join(',\n')}\n);`;
  };
  const lines = [
    '// GENERATED by transtyle — do not edit; source: ' + ctx.projectName + ' token files',
    '// Target: bootstrap (>=5.3 <6), Sass path · rules standard@1',
    '//',
    '// These maps REPLACE Bootstrap\'s own tint-color()/shade-color() derivations',
    '// with OKLCH-derived values (perceptually consistent across roles) — the',
    '// mechanism that makes role.on-tint → -text-emphasis NATIVE (F9).',
    '',
    '// <role>.on-tint (on-brand walk, F1/F19)',
    mapBlock('theme-colors-text', (x) => x.text, 'light'),
    '',
    '// <role>.tint (mix toward surface — cartesian OKLab, F21)',
    mapBlock('theme-colors-bg-subtle', (x) => x.bgSubtle, 'light'),
    '',
    '// <role>.outline (F10, now a first-class grid cell)',
    mapBlock('theme-colors-border-subtle', (x) => x.borderSubtle, 'light'),
  ];
  if (r.dark) {
    lines.push('', '// ------------------------------------------------- dark mode (data-bs-theme="dark")', '');
    lines.push(mapBlock('theme-colors-text-dark', (x) => x.text, 'dark'));
    lines.push('');
    lines.push(mapBlock('theme-colors-bg-subtle-dark', (x) => x.bgSubtle, 'dark'));
    lines.push('');
    lines.push(mapBlock('theme-colors-border-subtle-dark', (x) => x.borderSubtle, 'dark'));
  }
  lines.push('');
  return lines.join('\n');
}

// ---------- bootstrap-theme.css (CSS-variable path) ----------

function renderCss(r, ctx) {
  const { hx } = r;
  const modeBlock = (M, isDark) => {
    const lines = [];
    if (!isDark) {
      for (const name of [...ROLES, 'light', 'dark']) {
        const h = hx(M.roles[name].base);
        lines.push(`  --bs-${name}: ${h};  --bs-${name}-rgb: ${rgbTriplet(h)};`);
      }
      lines.push('');
    }
    for (const name of [...ROLES, 'light', 'dark']) {
      const x = M.roles[name];
      lines.push(`  --bs-${name}-text-emphasis: ${hx(x.text)};  --bs-${name}-bg-subtle: ${hx(x.bgSubtle)};  --bs-${name}-border-subtle: ${hx(x.borderSubtle)};`);
    }
    lines.push('');
    const bg = hx(M.bodyBg), color = hx(M.bodyColor), emph = hx(M.emphasis);
    lines.push(`  --bs-body-bg: ${bg};  --bs-body-bg-rgb: ${rgbTriplet(bg)};`);
    lines.push(`  --bs-body-color: ${color};  --bs-body-color-rgb: ${rgbTriplet(color)};`);
    lines.push(`  --bs-emphasis-color: ${emph};  --bs-emphasis-color-rgb: ${rgbTriplet(emph)};`);
    lines.push(`  --bs-secondary-color: ${hx(M.secondaryColor)};  /* text.muted */`);
    lines.push(`  --bs-secondary-bg: ${hx(M.secondaryBg)};  /* neutral.tint */`);
    lines.push(`  --bs-tertiary-bg: ${hx(M.tertiaryBg)};  /* elevation.1.surface */`);
    lines.push(`  --bs-border-color: ${hx(M.border)};  /* border */`);
    lines.push('');
    // Link asymmetry (F13): light links ← primary; dark links ← ring[dark]
    // because CDN users have Bootstrap's stock literals baked in.
    const link = isDark ? hx(M.ring) : hx(M.primary);
    const linkHover = isDark ? hx(M.ringHover) : hx(M.primaryHover);
    lines.push(`  --bs-link-color: ${link};  --bs-link-color-rgb: ${rgbTriplet(link)};`);
    lines.push(`  --bs-link-hover-color: ${linkHover};  --bs-link-hover-color-rgb: ${rgbTriplet(linkHover)};`);
    lines.push(`  --bs-focus-ring-color: rgba(${rgbTriplet(isDark ? hx(M.ring) : hx(M.primary))}, 0.25);`);
    lines.push('');
    for (const s of SHADOWS) {
      const alpha = isDark ? s.dark : s.light;
      lines.push(`  --bs-box-shadow${s.name ? '-' + s.name : ''}: ${s.geometry} rgba(${rgbTriplet(hx(M.scrim))}, ${alpha});`);
    }
    return lines;
  };

  const lines = [
    '/*',
    ` * GENERATED by transtyle — do not edit; source: ${ctx.projectName} token files`,
    ' * Target: bootstrap (>=5.3 <6), CSS-variable path · rules standard@1',
    ' *',
    ' * LOWER-FIDELITY PATH (documented, per the exporter spec): this layer',
    ' * rethemes Bootstrap\'s token tier (utilities, helpers, borders, body).',
    ' * It does NOT reach values Sass compiled into component rules — .btn-primary',
    ' * backgrounds/hovers are literals baked at Bootstrap\'s build time (F13).',
    ' * Use the Sass path for full fidelity. Load AFTER bootstrap.css.',
    ' */',
    '',
    ':root,',
    '[data-bs-theme="light"] {',
    ...modeBlock(r.light, false),
    '',
  ];
  const rad = r.radiusEntries;
  lines.push('  /* mode-invariant */');
  if (rad.md) lines.push(`  --bs-border-radius: ${rad.md.value};`);
  if (rad.sm) lines.push(`  --bs-border-radius-sm: ${rad.sm.value};`);
  if (rad.lg) lines.push(`  --bs-border-radius-lg: ${rad.lg.value};`);
  if (rad.xl) lines.push(`  --bs-border-radius-xl: ${rad.xl.value};`);
  if (rad.md) lines.push(`  --bs-border-radius-xxl: ${xxl(rad.md.value)};`);
  lines.push('  --bs-border-radius-pill: 50rem;');
  if (r.fontSans) lines.push(`  --bs-font-sans-serif: ${fontList(r.fontSans.value)};`);
  if (r.fontMono) lines.push(`  --bs-font-monospace: ${fontList(r.fontMono.value)};`);
  lines.push('}');
  if (r.dark) {
    lines.push('', '[data-bs-theme="dark"] {', ...modeBlock(r.dark, true), '}');
  }
  lines.push('');
  return lines.join('\n');
}

// ---------- usage ----------

function renderUsage(ctx, coverage) {
  const counts = {};
  for (const c of coverage) counts[c.class] = (counts[c.class] ?? 0) + 1;
  const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(' · ');
  return `# Using this Bootstrap theme

Generated from the **${ctx.projectName}** design system by transtyle (Bootstrap >=5.3 <6). Coverage: ${summary}.

## Sass path (recommended — full fidelity)

Your build imports our variables **before** Bootstrap and our maps **after** Bootstrap's variables:

\`\`\`scss
@import "variables.transtyle";                  // theme values, BEFORE bootstrap
@import "bootstrap/scss/functions";
@import "bootstrap/scss/variables";
@import "bootstrap/scss/variables-dark";
@import "maps.transtyle";                       // replaces tint/shade derivations
@import "bootstrap/scss/maps";
@import "bootstrap/scss/mixins";
@import "bootstrap/scss/root";
@import "bootstrap/scss/bootstrap";             // or the parts you use
\`\`\`

Every component (buttons, alerts, badges…) is compiled from your theme values.

## CSS-variable path (no Sass build)

Load \`bootstrap-theme.css\` **after** \`bootstrap.css\` (CDN or otherwise). This
rethemes the token tier only — component rules keep the values Bootstrap's own
build baked in (e.g. \`.btn-primary\` backgrounds). The gap is documented, not a bug.

## Dark mode

Both paths follow Bootstrap's own mechanism: \`data-bs-theme="dark"\` on \`<html>\`.

## Regenerating

Never edit these files — change the design system tokens and run \`transtyle build bootstrap\`.
See \`report.json\` for the full coverage/provenance breakdown.
`;
}
