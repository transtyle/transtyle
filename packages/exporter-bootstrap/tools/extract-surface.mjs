#!/usr/bin/env node
/**
 * AL1.1 (docs/plan/bootstrap-component-tier.md): extract Bootstrap's
 * component-theming surface into a machine-readable inventory.
 *
 * Sources, per the plan's ground-truth section:
 *   - scss/_variables.scss — every top-level `$` variable (952 in 5.3.8),
 *     parsed with a paren-depth-aware scanner because map values span lines.
 *   - the component partials (scss/*.scss, scss/forms/*.scss, scss/helpers/*.scss)
 *     — every `--#{$prefix}<name>:` declaration, so each `$` variable records
 *     the CSS-variable counterpart(s) it is interpolated into (`#{$var}`).
 *     _variables*.scss/_maps.scss/_root.scss are excluded: their custom
 *     properties are the *global* layer (driven by the semantic tier today),
 *     not the per-component layer this inventory measures.
 *
 * The inventory defines the denominator for "ALL tokens" (plan §design-2):
 * component families are in; feature flags, palette/theme maps, and
 * foundations scales are out, each with its reason recorded here.
 *
 * Usage: node tools/extract-surface.mjs [--write]   (from packages/exporter-bootstrap)
 * Exported for scripts/check-bootstrap-surface.mjs, which regenerates and diffs.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const scssDir = join(repoRoot, 'node_modules', 'bootstrap', 'scss');

/**
 * Component families (in inventory). Order matters: longest prefix wins, so
 * `form-check` must be matched before `form`, `btn-close` before `btn`,
 * `navbar` before `nav`. Names mirror Bootstrap's own partials/docs sections.
 */
const COMPONENT_FAMILIES = [
  'accordion',
  'alert',
  'badge',
  'blockquote',
  'breadcrumb',
  'btn-close',
  'btn',
  'caret',
  'card',
  'carousel',
  'code',
  'dropdown',
  'dt',
  'figure',
  'form-check',
  'form-color',
  'form-feedback',
  'form-file',
  'form-floating',
  'form-label',
  'form-range',
  'form-select',
  'form-switch',
  'form-text',
  'form-valid',
  'form-invalid',
  'form-validation',
  'hr',
  'input-group',
  'input',
  'kbd',
  'legend',
  'list-group',
  'mark',
  'modal',
  'navbar',
  'nav-link',
  'nav',
  'offcanvas',
  'pagination',
  'placeholder',
  'popover',
  'pre',
  'progress',
  'spinner',
  'table',
  'thumbnail',
  'toast',
  'tooltip',
];

/**
 * Out-of-inventory rules, checked in order before family matching where the
 * rule is broader than a family (flags, palettes), after it otherwise.
 * Each entry: [predicate on name, out-group id, reason].
 */
const OUT_RULES = [
  [(n) => n.startsWith('enable-'), 'feature-flag', 'build switch, not a theme value'],
  [
    (n) =>
      /^(blue|indigo|purple|pink|red|orange|yellow|green|teal|cyan|black|white|gray)(s|-\d{2,3})?$/.test(n) ||
      /^(primary|secondary|success|info|warning|danger|light|dark)(-text-emphasis|-bg-subtle|-border-subtle)?$/.test(n) ||
      /^color-contrast-(light|dark)$/.test(n) ||
      ['colors', 'grays', 'theme-colors', 'theme-colors-rgb', 'theme-colors-text', 'theme-colors-bg-subtle', 'theme-colors-border-subtle', 'min-contrast-ratio'].includes(n),
    'palette',
    'palette / theme-color / contrast machinery — already driven by the semantic tier today',
  ],
  [
    (n) =>
      /^(font|line-height|headings|display|lead|small|sub-sup|initialism|list-inline|paragraph)-/.test(n) ||
      /^h[1-6]-font-size$/.test(n) ||
      ['font-family-base', 'font-family-code', 'text-muted'].includes(n),
    'typography-foundation',
    'typography foundation — driven by the semantic type scale today',
  ],
  [
    (n) => /^(spacer|grid|container|gutter)/.test(n) || n === 'spacers',
    'layout-foundation',
    'spacing/grid/container scale — foundations tier, already covered',
  ],
  [
    (n) => /^(border|box-shadow|focus-ring|transition|aspect-ratios|zindex|vr-)/.test(n) || n === 'gradient',
    'global-foundation',
    'global border/shadow/focus/motion/z/gradient ladder — foundations tier shared across components, driven semantically today',
  ],
  [
    (n) => /^(body|link|icon-link|stretched-link|hover|emphasis|secondary|tertiary)-/.test(n),
    'global-semantic',
    'document-level semantic value (body/link/emphasis) — driven by the semantic tier today',
  ],
  [
    (n) => /^component-active-(bg|color)$/.test(n),
    'global-semantic',
    'cross-component active-state pair (primary.solid / on-solid shaped) — shared, not component-scoped; flagged in the AL1.2 cross-walk findings as a semantic-tier driving candidate',
  ],
  [
    (n) => ['variable-prefix', 'prefix', 'color-mode-type'].includes(n),
    'infrastructure',
    'CSS-variable prefix / color-mode build machinery',
  ],
  [
    (n) => /^(table-variants|utilities|overflows|position-values|escaped-characters|all-colors)/.test(n),
    'utility-map',
    'utility-generation map, not a theme value',
  ],
];

/** Parse every top-level `$name: value;` from _variables.scss (depth-aware). */
export function parseVariables(source) {
  const vars = [];
  const re = /^\$([a-zA-Z0-9_-]+):/gm;
  let m;
  while ((m = re.exec(source))) {
    const name = m[1];
    let i = re.lastIndex;
    let depth = 0;
    let value = '';
    while (i < source.length) {
      const ch = source[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ';' && depth === 0) break;
      value += ch;
      i++;
    }
    value = value
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\s+/g, ' ')
      .replace(/!default\s*$/, '')
      .trim();
    const line = source.slice(0, m.index).split('\n').length;
    vars.push({ name, value, line });
  }
  return vars;
}

// One irregular name: `$nested-kbd-font-weight` styles kbd-inside-kbd.
const FAMILY_ALIASES = { 'nested-kbd-font-weight': 'kbd' };
const familyOf = (name) => FAMILY_ALIASES[name] ?? COMPONENT_FAMILIES.find((f) => name === f || name.startsWith(f + '-')) ?? null;

/** Coarse informational type guess from the raw default value. */
function guessType(name, value) {
  if (value.startsWith('(')) return 'map';
  if (/(^|\s)(true|false)(\s|$)/.test(value) && !/\$/.test(value)) return 'flag';
  if (/-(box-shadow|shadow)$/.test(name)) return 'shadow';
  if (/filter$/.test(name)) return 'filter';
  if (/(transition|animation)/.test(name)) return 'motion';
  if (/^(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|currentcolor|transparent)/.test(value) || /-(color|bg|border-color)$/.test(name)) return 'color';
  if (/^-?[\d.]+(rem|em|px|%|vh|vw)/.test(value) || /(padding|margin|width|height|radius|size|gap|offset|spacer|translate)/.test(name)) return 'dimension';
  if (/^-?[\d.]+$/.test(value)) return 'number';
  if (/font-weight|font-style/.test(name)) return 'font';
  if (/^url\(|escape-svg/.test(value)) return 'asset';
  return 'other';
}

/** All `--#{$prefix}<x>: <value>` declarations in the component partials. */
export function parseCssVarDecls() {
  const decls = [];
  const skip = new Set(['_variables.scss', '_variables-dark.scss', '_maps.scss', '_root.scss', '_reboot.scss', '_utilities.scss', '_functions.scss', '_mixins.scss']);
  const dirs = ['', 'forms', 'helpers'];
  for (const d of dirs) {
    const dir = join(scssDir, d);
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.scss') || skip.has(f)) continue;
      const text = readFileSync(join(dir, f), 'utf8');
      const re = /--#\{\$prefix\}([a-zA-Z0-9-]+):\s*([^;]+);/g;
      let m;
      while ((m = re.exec(text))) decls.push({ cssVar: m[1], value: m[2].trim(), file: (d ? d + '/' : '') + f });
    }
  }
  return decls;
}

export function extractSurface() {
  const source = readFileSync(join(scssDir, '_variables.scss'), 'utf8');
  const version = JSON.parse(readFileSync(join(repoRoot, 'node_modules', 'bootstrap', 'package.json'), 'utf8')).version;
  const parsed = parseVariables(source);
  const decls = parseCssVarDecls();

  // $var -> [cssVar names it is directly interpolated into]
  const cssVarsFor = new Map();
  for (const { cssVar, value } of decls) {
    for (const ref of value.matchAll(/#\{\$([a-zA-Z0-9_-]+)\}/g)) {
      const list = cssVarsFor.get(ref[1]) ?? [];
      if (!list.includes(cssVar)) list.push(cssVar);
      cssVarsFor.set(ref[1], list);
    }
  }

  const variables = parsed.map(({ name, value, line }) => {
    const family = familyOf(name);
    const refs = [...new Set([...value.matchAll(/\$([a-zA-Z0-9_-]+)/g)].map((r) => r[1]).filter((r) => r !== 'prefix'))];
    const aliasesGlobalCssVar = /var\(--#\{\$prefix\}/.test(value) && refs.length === 0;
    const entry = {
      name,
      line,
      family,
      type: guessType(name, value),
      value,
      refs,
      aliasesGlobalCssVar,
      cssVars: (cssVarsFor.get(name) ?? []).sort(),
    };
    if (family) return { ...entry, scope: 'component' };
    const out = OUT_RULES.find(([test]) => test(name));
    return { ...entry, scope: 'out', outGroup: out ? out[1] : 'global-other', reason: out ? out[2] : 'global option/value with no component scope — not part of the component-theming surface' };
  });

  const counts = {
    total: variables.length,
    component: variables.filter((v) => v.scope === 'component').length,
    out: variables.filter((v) => v.scope === 'out').length,
    families: Object.fromEntries(
      COMPONENT_FAMILIES.map((f) => [f, variables.filter((v) => v.family === f).length]).filter(([, n]) => n > 0),
    ),
    outGroups: {},
  };
  for (const v of variables) if (v.scope === 'out') counts.outGroups[v.outGroup] = (counts.outGroups[v.outGroup] ?? 0) + 1;

  return { bootstrapVersion: version, generatedBy: 'packages/exporter-bootstrap/tools/extract-surface.mjs', counts, variables };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const inventory = extractSurface();
  const out = join(here, '..', 'surface-inventory.json');
  if (process.argv.includes('--write')) {
    writeFileSync(out, JSON.stringify(inventory, null, 2) + '\n');
    console.log(`wrote ${out} (bootstrap@${inventory.bootstrapVersion}: ${inventory.counts.component} component-scoped of ${inventory.counts.total})`);
  } else {
    console.log(JSON.stringify(inventory.counts, null, 2));
  }
}
