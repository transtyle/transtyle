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
 * Exporter conventions validated engine-exact against the Phase 0 fixtures
 * (docs/exercises/phase0-bootstrap-rerun.md):
 *  - $light/$dark pseudo-roles (F12): neutral.subtle / neutral.contrast, with
 *    bg-subtle mix(·, surface, 0.6)/(0.85) and border-subtle
 *    mix(neutral.base, surface, 0.7) / mix(neutral.contrast, surface, 0.55).
 *  - border-subtle(role) = mix(role.base, surface, 0.70) (F10 watch item).
 *  - link ← primary; dark link ← ring[dark] (F13 asymmetry), hover = one
 *    lightness step (+0.05 in dark, primary.hover in light).
 *  - shadows composed from scrim at fixed alpha ramps (F2).
 */

const S = 'semantic.color.';

/** Bootstrap's theme-color order; light/dark are exporter pseudo-roles (F12). */
const ROLES = ['primary', 'secondary', 'success', 'info', 'warning', 'danger'];
const SHADOWS = [
  { name: 'sm', geometry: '0 1px 2px', light: 0.06, dark: 0.3 },
  { name: '', geometry: '0 4px 12px', light: 0.1, dark: 0.4 },
  { name: 'lg', geometry: '0 12px 32px', light: 0.16, dark: 0.5 },
];
/** Defaulted modular type scale (base 1rem, ratio 1.25) when the DS authors no type tokens. */
const TYPE_SCALE = [
  ['h1', '3.052rem', 'size.4xl'], ['h2', '2.441rem', 'size.3xl'], ['h3', '1.953rem', 'size.2xl'],
  ['h4', '1.563rem', 'size.xl'], ['h5', '1.25rem', 'size.lg'], ['h6', '1rem', 'size.md'],
];
/** Bootstrap's $spacers keys ← linear space scale (base 0.25rem). */
const SPACERS = [['0', '0', 'space.0'], ['1', '.25rem', 'space.1'], ['2', '.5rem', 'space.2'], ['3', '1rem', 'space.4'], ['4', '1.5rem', 'space.6'], ['5', '3rem', 'space.12']];

export default {
  name: 'bootstrap',

  emit(normalized, ctx) {
    // Mode polarity: bind mode NAMES (ir.md#modes) — :root/[data-bs-theme=light]
    // is always the light map, even for dark-native design systems.
    const light = normalized.modes.light ?? normalized.modes[normalized.defaultMode];
    const dark = normalized.modes.dark;
    const r = resolve(light, dark, ctx);

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
  const provKind = (map, p) => map?.get(S + p)?.provenance.kind;
  const cls = (p, mappedCls = 'native') =>
    mappedCls !== 'native' ? mappedCls : provKind(light, p) === 'derived' ? 'derived' : 'native';
  const cov = (variable, slot, klass, note) =>
    coverage.push({ variable, slot, class: klass, ...(note && { note }) });

  const perMode = (map) => {
    if (!map) return null;
    const surface = val(map, 'surface.base') ?? val(map, 'background.base');
    const role = (name) => {
      if (name === 'light') {
        return {
          base: val(map, 'neutral.subtle'),
          text: val(map, 'text-on-neutral.subtle'),
          bgSubtle: ctx.mix(val(map, 'neutral.subtle'), surface, 0.6),
          borderSubtle: ctx.mix(val(map, 'neutral.base'), surface, 0.7),
        };
      }
      if (name === 'dark') {
        return {
          base: val(map, 'neutral.contrast'),
          text: val(map, 'neutral.contrast'),
          bgSubtle: ctx.mix(val(map, 'neutral.contrast'), surface, 0.85),
          borderSubtle: ctx.mix(val(map, 'neutral.contrast'), surface, 0.55),
        };
      }
      return {
        base: val(map, `${name}.base`),
        text: val(map, `text-on-${name}.subtle`),
        bgSubtle: val(map, `${name}.subtle`),
        borderSubtle: ctx.mix(val(map, `${name}.base`), surface, 0.7),
      };
    };
    const ring = val(map, 'ring.base');
    return {
      roles: Object.fromEntries([...ROLES, 'light', 'dark'].map((n) => [n, role(n)])),
      bodyBg: val(map, 'background.base'),
      bodyColor: val(map, 'text.base'),
      emphasis: val(map, 'neutral.contrast'),
      secondaryColor: val(map, 'text-muted.base'),
      secondaryBg: val(map, 'neutral.subtle'),
      tertiaryBg: val(map, 'surface.base'),
      border: val(map, 'border.base'),
      primary: val(map, 'primary.base'),
      primaryHover: val(map, 'primary.hover'),
      ring,
      ringHover: ring && { ...ring, l: Math.min(1, ring.l + 0.05) },
      scrim: val(map, 'scrim.base'),
    };
  };

  // theme-color coverage (once, from the light map)
  for (const name of ROLES) {
    cov(`$${name}`, `${S}${name}.base`, cls(`${name}.base`));
    cov(`$theme-colors-text.${name}`, `${S}text-on-${name}.subtle`, cls(`text-on-${name}.subtle`));
    cov(`$theme-colors-bg-subtle.${name}`, `${S}${name}.subtle`, cls(`${name}.subtle`));
    cov(`$theme-colors-border-subtle.${name}`, `${S}${name}.base`, 'approximated', 'exporter convention: mix(role.base, surface, 0.70) — no IR per-role border slot (F10)');
  }
  cov('$light', `${S}neutral.subtle`, 'approximated', 'exporter convention: Bootstrap $light has no IR role (F12)');
  cov('$dark', `${S}neutral.contrast`, 'approximated', 'exporter convention (F12)');
  cov('$body-bg', `${S}background.base`, cls('background.base'));
  cov('$body-color', `${S}text.base`, cls('text.base'));
  cov('$body-emphasis-color', `${S}neutral.contrast`, cls('neutral.contrast'));
  cov('$body-secondary-color', `${S}text-muted.base`, cls('text-muted.base'));
  cov('$body-secondary-bg', `${S}neutral.subtle`, cls('neutral.subtle'));
  cov('$body-tertiary-bg', `${S}surface.base`, cls('surface.base'));
  cov('$border-color', `${S}border.base`, cls('border.base'));
  cov('$link-color', `${S}primary.base`, cls('primary.base'), 'exporter convention: link ← primary (matches Bootstrap default)');
  cov('$link-hover-color', `${S}primary.hover`, cls('primary.hover'), 'replaces Bootstrap sRGB shade-color(20%)');
  cov('$focus-ring-color', `${S}ring.base`, cls('ring.base'), 'ring ← primary (F3) at Bootstrap conventional alpha .25');
  for (const s of SHADOWS) cov(`$box-shadow${s.name && '-' + s.name}`, `${S}scrim.base`, 'derived', 'composed from scrim alpha ramp (F2)');
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
  const hasTypeScale = [...light.keys()].some((k) => k.startsWith('semantic.type.'));
  cov('$font-size-base…$h1-font-size', hasTypeScale ? 'semantic.type.*' : '—', 'derived', hasTypeScale ? undefined : 'defaulted modular scale (base 1rem, ratio 1.25) — no authored type tokens');
  cov('$display-font-sizes', '—', 'unsupported', 'no IR concept of display sizes; Bootstrap defaults kept');
  const hasSpace = [...light.keys()].some((k) => k.startsWith('semantic.space.'));
  cov('$spacer/$spacers', hasSpace ? 'semantic.space.*' : '—', hasSpace ? 'native' : 'derived', hasSpace ? undefined : 'defaulted linear scale (base 0.25rem)');
  cov('$grid-breakpoints/$container-max-widths', '—', 'unsupported', 'breakpoints are a known IR catalog candidate');
  cov('$btn-*/component tier', '—', 'unsupported', 'component-tier variables reserved for the v2 component layer (ADR-0003)');
  cov('motion ($transition-*)', '—', 'dropped', 'Bootstrap themes almost none of it');

  return {
    light: perMode(light),
    dark: perMode(dark),
    radiusEntries: Object.fromEntries(['md', 'sm', 'lg', 'xl', 'full'].map((k) => [k, radius(k)])),
    fontSans: font('sans'),
    fontMono: font('mono'),
    hasTypeScale,
    hasSpace,
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
  lines.push(`$body-bg:              ${hx(L.bodyBg)};  // background.base`);
  lines.push(`$body-color:           ${hx(L.bodyColor)};  // text.base`);
  lines.push(`$body-emphasis-color:  ${hx(L.emphasis)};  // neutral.contrast (F20)`);
  lines.push(`$body-secondary-color: ${hx(L.secondaryColor)};  // text-muted.base`);
  lines.push(`$body-tertiary-bg:     ${hx(L.tertiaryBg)};  // surface.base (F11)`);
  lines.push(`$body-secondary-bg:    ${hx(L.secondaryBg)};  // neutral.subtle (F11)`);
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
  lines.push('$link-color:       $primary;  // exporter convention: link ← primary.base');
  lines.push(`$link-hover-color: ${hx(L.primaryHover)};  // primary.hover — replaces Bootstrap's sRGB shade-color(20%)`);
  lines.push('// $link-color-dark intentionally NOT emitted: Bootstrap derives it from $primary (F13)');
  lines.push('$focus-ring-color: rgba($primary, .25);  // ring.base ← primary (F3)');
  lines.push('');
  lines.push('// ---------------------------------------------------------------- typography');
  if (r.fontSans) lines.push(`$font-family-sans-serif: ${fontList(r.fontSans.value)};  // font.sans`);
  if (r.fontMono) lines.push(`$font-family-monospace:  ${fontList(r.fontMono.value)};  // font.mono`);
  if (!r.hasTypeScale) {
    lines.push('$font-size-base:   1rem;  // size.md · defaulted (no authored type scale — base 1rem, ratio 1.25)');
    lines.push('$line-height-base: 1.5;   // leading.normal · defaulted');
    for (const [h, size, slot] of TYPE_SCALE) lines.push(`$${h}-font-size: ${size};  // ${slot} · defaulted`);
  }
  lines.push('');
  lines.push('// ------------------------------------------------------------------- spacing');
  if (!r.hasSpace) {
    lines.push('$spacer: 1rem;  // space.4 · defaulted linear scale (base 0.25rem)');
    lines.push('$spacers: (');
    lines.push(SPACERS.map(([k, v, slot]) => `  ${k}: ${v}${k === '5' ? '' : ','}   // ${slot}`).join('\n'));
    lines.push(');');
  }
  lines.push('');
  lines.push('// ------------------------------------------------------------- radius / borders');
  const rad = r.radiusEntries;
  if (rad.md) lines.push(`$border-radius:      ${rad.md.value};  // radius.md`);
  if (rad.sm) lines.push(`$border-radius-sm:   ${rad.sm.value};  // radius.sm · derived (F8: md × 0.5)`);
  if (rad.lg) lines.push(`$border-radius-lg:   ${rad.lg.value};  // radius.lg · derived (F8: md × 1.5)`);
  if (rad.xl) lines.push(`$border-radius-xl:   ${rad.xl.value};  // radius.xl · derived (F8: md × 2)`);
  if (rad.md) lines.push(`$border-radius-xxl:  ${xxl(rad.md.value)};  // exporter convention: xl × 2 (F8 watch item)`);
  lines.push('$border-radius-pill: 50rem;  // radius.full, in Bootstrap\'s own idiom');
  lines.push(`$border-color:       ${hx(L.border)};  // border.base`);
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
    '// mechanism that makes text-on-<role>.subtle → -text-emphasis NATIVE (F9).',
    '',
    '// text-on-<role>.subtle (on-brand walk, F1/F19)',
    mapBlock('theme-colors-text', (x) => x.text, 'light'),
    '',
    '// <role>.subtle (mix toward surface — cartesian OKLab, F21)',
    mapBlock('theme-colors-bg-subtle', (x) => x.bgSubtle, 'light'),
    '',
    '// exporter convention: mix(role.base, surface, 0.70) (F10 watch item)',
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
    lines.push(`  --bs-secondary-color: ${hx(M.secondaryColor)};  /* text-muted.base */`);
    lines.push(`  --bs-secondary-bg: ${hx(M.secondaryBg)};  /* neutral.subtle */`);
    lines.push(`  --bs-tertiary-bg: ${hx(M.tertiaryBg)};  /* surface.base */`);
    lines.push(`  --bs-border-color: ${hx(M.border)};  /* border.base */`);
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
