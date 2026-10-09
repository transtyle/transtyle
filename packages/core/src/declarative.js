/**
 * Declarative exporters (issue #82, ADR-0017): a JSON mapping table that is an
 * exporter without code. Spec: docs/specs/declarative-mapping.md.
 *
 * A mapping lists output files, each a template (CSS custom properties, Sass
 * or Less variables, flat JSON) and a list of rows `{ variable, slot, part?,
 * format?, class?, note? }`. This runtime resolves each row against the IR the
 * exporter receives, formats the value the way the official exporters do
 * (`ctx.formatColor`, `formatHex`, `formatHslTriplet`), and derives the
 * coverage report from the rows themselves: a row whose slot has no value is
 * `dropped`, a colour the hex or HSL format had to clamp into sRGB is
 * `approximated`, everything else is what the row claims (`native` unless it
 * says otherwise).
 *
 * Two ways to point a target at one, and neither imports any code:
 * - a file next to the config: `"exporter": "./ourlib.mapping.json"`, read by
 *   `compile()` itself (`readMappingFile`);
 * - an npm package whose `transtyle` manifest says `"declarative":
 *   "mapping.json"`, read by the caller's loader from the package directory
 *   (`loadDeclarativePackage`). Its `main`, if it has one, is never imported.
 *
 * `createDeclarativeExporter(mapping)` returns a plain `{ name, emit }`
 * plugin, so `@transtyle/plugin-kit`'s conformance suite runs it unchanged.
 *
 * Not in v0, on purpose: conditions, expressions, value arithmetic, naming
 * patterns, wildcard rows. That is where a mapping graduates to code.
 */

import { comboKey, droppedDimensions } from '@transtyle/ir';
import { validate } from './schema/validate.js';
import { mappingSchema } from './schema/mapping.schema.js';
import { catalog } from './catalog.js';
import { nearestName } from './nearest.js';

export { mappingSchema, MAPPING_TEMPLATES, MAPPING_FORMATS } from './schema/mapping.schema.js';

/** Value types whose value carries a colour: a `color-scheme` block repeats them all. */
const COLOR_BEARING = new Set(['color', 'shadow', 'border', 'gradient']);
/** Types whose value is an object of members a row's `part` can pick from. */
const COMPOSITES = new Set(['typography', 'shadow', 'border', 'transition']);

const SIGILS = {
  'css-custom-properties': { re: /^--[A-Za-z0-9_-]+$/, says: 'start with "--" (a CSS custom property)' },
  'scss-variables': { re: /^\$[A-Za-z_][A-Za-z0-9_-]*$/, says: 'start with "$" (a Sass variable)' },
  'less-variables': { re: /^@[A-Za-z_][A-Za-z0-9_-]*$/, says: 'start with "@" (a Less variable)' },
  json: { re: /\S/, says: 'not be blank' },
};
const FILE_KIND = { 'css-custom-properties': 'stylesheet', 'scss-variables': 'stylesheet', 'less-variables': 'stylesheet', json: 'data' };

let catalogTypes;
/** slot path → DTCG type, from the catalog (the engine's own vocabulary). */
function catalogTypeMap() {
  catalogTypes ??= new Map(catalog().slots.map((s) => [s.path, s.type]));
  return catalogTypes;
}

/**
 * Check a parsed mapping. Returns `{ path, message }[]` (empty = valid):
 * the schema first, then what the schema can't express. Pure: no I/O, no IR.
 */
export function validateMapping(mapping) {
  const errors = validate(mapping, mappingSchema);
  if (errors.length) return errors;
  const types = catalogTypeMap();
  mapping.files.forEach((file, f) => {
    const at = `files[${f}]`;
    const css = file.template === 'css-custom-properties';
    if (!css) {
      for (const key of ['selector', 'blocks']) {
        if (file[key] !== undefined) errors.push({ path: `${at}.${key}`, message: `is only allowed in a css-custom-properties file (this one is ${file.template})` });
      }
    }
    if (file.template === 'json') {
      for (const key of ['header', 'comments']) {
        if (file[key] !== undefined) errors.push({ path: `${at}.${key}`, message: 'is not allowed in a json file (JSON has no comments)' });
      }
    }
    for (const [key, sel] of [['selector', file.selector], ...(file.blocks ?? []).map((b, i) => [`blocks[${i}].selector`, b.selector])]) {
      if (sel !== undefined && /[{}]/.test(sel)) errors.push({ path: `${at}.${key}`, message: 'must not contain "{" or "}"' });
    }
    (file.blocks ?? []).forEach((b, i) => {
      if (Object.keys(b.mode).length !== 1) errors.push({ path: `${at}.blocks[${i}].mode`, message: 'must name exactly one mode dimension' });
    });
    const seen = new Map();
    file.rows.forEach((row, r) => {
      const rat = `${at}.rows[${r}]`;
      const sigil = SIGILS[file.template];
      if (!sigil.re.test(row.variable)) errors.push({ path: `${rat}.variable`, message: `"${row.variable}" must ${sigil.says} in a ${file.template} file` });
      if (seen.has(row.variable)) errors.push({ path: `${rat}.variable`, message: `"${row.variable}" is already written by rows[${seen.get(row.variable)}] of this file` });
      else seen.set(row.variable, r);
      const type = types.get(row.slot);
      if (type === undefined) return; // a custom role or component token: checked against the IR at compile time
      if (row.part !== undefined && !COMPOSITES.has(type)) errors.push({ path: `${rat}.part`, message: `${row.slot} is a ${type}, which has no members to pick` });
      if (row.part === undefined && type === 'typography') errors.push({ path: `${rat}.part`, message: `${row.slot} is a typography composite: pick one member (fontSize, fontWeight, lineHeight, fontFamily)` });
    });
  });
  return errors;
}

/**
 * The rows whose slot is neither in the catalog nor anywhere in this IR (a
 * typo, most of the time): `{ path, slot, near }[]`, `near` being the closest
 * known slot or null. Custom roles and authored component tokens are in the
 * IR, so they pass.
 */
/**
 * The file `mode`s and block `mode`s naming a dimension this design system
 * doesn't declare (`colour-scheme`): `{ path, message }[]`, reported as
 * TST1014. A declared dimension with a value the system lacks (`dark` on a
 * light-only system) is not an error: that block or file is left out, so one
 * mapping serves systems with and without the mode.
 */
export function unknownMappingModes(mapping, ir) {
  const dims = ir.dimensions ?? {};
  const out = [];
  mapping.files.forEach((file, f) => {
    const picks = [[`files[${f}].mode`, file.mode ?? {}], ...(file.blocks ?? []).map((b, i) => [`files[${f}].blocks[${i}].mode`, b.mode])];
    for (const [at, pick] of picks) {
      for (const dim of Object.keys(pick)) {
        if (!(dim in dims)) out.push({ path: at, message: `names the mode dimension "${dim}", which this design system doesn't declare (it has ${Object.keys(dims).map((d) => `"${d}"`).join(', ') || 'none'})` });
      }
    }
  });
  return out;
}

export function unknownMappingSlots(mapping, ir) {
  const known = new Set(catalogTypeMap().keys());
  for (const map of Object.values(ir.modes)) if (map instanceof Map) for (const k of map.keys()) known.add(k);
  const out = [];
  mapping.files.forEach((file, f) => file.rows.forEach((row, r) => {
    if (!known.has(row.slot)) out.push({ path: `files[${f}].rows[${r}].slot`, slot: row.slot, near: nearestName(row.slot, [...known]) });
  }));
  return out;
}

/**
 * A plain exporter from a mapping. `source` names where the mapping came from
 * (for diagnostics); `error` carries a read/parse failure for `compile()` to
 * report. The mapping is not validated here: `compile()` does it (TST1014,
 * TST1015) and plugin-kit's conformance suite needs only `{ name, emit }`.
 */
export function createDeclarativeExporter(mapping, { source = '(inline mapping)', error = null, fallbackName } = {}) {
  return {
    name: typeof mapping?.name === 'string' ? mapping.name : fallbackName ?? 'declarative',
    declarative: { mapping, source, error },
    emit(ir, ctx) {
      return emitMapping(mapping, ir, ctx);
    },
  };
}

/** The value one row writes from one entry: `{ text, clamped }`, or null when it has no single-value form. */
function render(entry, row, ctx) {
  if (entry?.value === undefined) return null;
  let value = entry.value;
  let type = entry.type;
  if (row.part !== undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || value[row.part] === undefined) return null;
    value = value[row.part];
    type = memberType(value, row.part);
  }
  let clamped = false;
  const color = (c) => {
    if (row.format === 'hex' || row.format === 'hsl-triplet') {
      const out = row.format === 'hex' ? ctx.formatHex(c) : ctx.formatHslTriplet(c);
      clamped ||= out.clamped;
      return out.text;
    }
    return ctx.formatColor(c);
  };
  const text = renderValue(type, value, color);
  return text === null ? null : { text, clamped };
}

const isColor = (v) => v && typeof v === 'object' && typeof v.l === 'number' && typeof v.c === 'number' && typeof v.h === 'number';

/** The type a composite member renders as. */
function memberType(value, part) {
  if (isColor(value)) return 'color';
  if (part === 'fontFamily') return 'fontFamily';
  if (part === 'timingFunction') return 'cubicBezier';
  return 'string';
}

/** Rendering, kept identical to exporter-css-variables' so the reference mapping reproduces it byte for byte. */
function renderValue(type, value, color) {
  if (type === 'color') return isColor(value) ? color(value) : null;
  if (type === 'typography' || type === 'gradient') return null;
  if (type === 'cubicBezier') return cubicBezier(value);
  if (type === 'shadow') {
    const layers = Array.isArray(value) ? value : [value];
    return layers.map((s) => `${s.inset ? 'inset ' : ''}${s.offsetX} ${s.offsetY} ${s.blur} ${s.spread} ${color(s.color)}`).join(', ');
  }
  if (type === 'border') return typeof value.style === 'string' ? `${value.width} ${value.style} ${color(value.color)}` : null;
  if (type === 'transition') return `${value.duration} ${cubicBezier(value.timingFunction)} ${value.delay}`;
  if (Array.isArray(value)) return fontList(value);
  if (value && typeof value === 'object') return null;
  return String(value);
}

const cubicBezier = (value) => (Array.isArray(value) ? `cubic-bezier(${value.join(', ')})` : String(value));
const fontList = (value) => value.map((f) => (/[^a-z-]/.test(f) ? `"${f}"` : f)).join(', ');

const comment = (entry) => ` /* ${entry.provenance?.kind && entry.provenance.kind !== 'authored' ? entry.provenance.kind + ' · ' : ''}${entry.type} */`;

/** The mode map for the default of every dimension, with `pick` overriding some. */
function modeMap(ir, pick = {}) {
  const dims = ir.dimensionNames ?? [ir.modeDimension];
  const values = Object.fromEntries(dims.map((d) => [d, ir.dimensions?.[d]?.default]));
  for (const [d, v] of Object.entries(pick)) values[d] = v;
  if (Object.keys(pick).length === 0) return ir.modes[comboKey(dims, values)] ?? ir.modes[ir.defaultMode];
  return ir.modes[comboKey(dims, values)];
}

/**
 * Run a mapping against an IR: `{ files, coverage }`. Called by the plugin's
 * `emit`; the mapping is assumed valid (`compile()` refuses an invalid one
 * before any emit).
 */
export function emitMapping(mapping, ir, ctx) {
  const files = [];
  const coverage = [];
  const covered = new Set();
  const expressed = new Set();
  const project = ctx.projectName ?? 'design-system';

  for (const file of mapping.files) {
    for (const d of Object.keys(file.mode ?? {})) expressed.add(d);
    for (const b of file.blocks ?? []) for (const d of Object.keys(b.mode)) expressed.add(d);
    const base = modeMap(ir, file.mode ?? {});
    if (!base) {
      // A file for a mode this design system doesn't have (a dark file on a
      // light-only system) is not written; its rows say why.
      const which = Object.entries(file.mode).map(([d, v]) => `${d}: ${v}`).join(', ');
      for (const row of file.rows) {
        if (covered.has(row.variable)) continue;
        covered.add(row.variable);
        coverage.push({ variable: row.variable, slot: row.slot, class: 'dropped', note: row.note ?? `this design system has no ${which} mode, so ${file.path} is not written` });
      }
      continue;
    }
    const out = file.template === 'json' ? {} : null;
    const lines = [];
    const rowClamped = new Map();

    const line = (row, entry, r) => {
      const tail = file.comments === 'provenance' ? comment(entry) : '';
      if (file.template === 'css-custom-properties') return `  ${row.variable}: ${r.text};${tail}`;
      return `${row.variable}: ${r.text};${tail}`;
    };

    for (const row of file.rows) {
      const entry = base.get(row.slot);
      const r = render(entry, row, ctx);
      if (r) {
        if (out) out[row.variable] = r.text;
        else lines.push(line(row, entry, r));
        if (r.clamped) rowClamped.set(row.variable, true);
      }
      if (covered.has(row.variable)) continue;
      covered.add(row.variable);
      coverage.push(coverageRow(row, entry, r));
    }

    const blocks = [];
    for (const block of file.blocks ?? []) {
      const [dim, value] = Object.entries(block.mode)[0];
      const map = modeMap(ir, { ...(file.mode ?? {}), [dim]: value });
      if (!map || map === base) continue;
      const blockLines = [];
      for (const row of file.rows) {
        const entry = map.get(row.slot);
        const r = render(entry, row, ctx);
        if (!r) continue;
        if (dim === ir.modeDimension) {
          // A colour-scheme block is self-contained: every colour-bearing row,
          // changed or not, so switching the scheme never leans on the base.
          if (!COLOR_BEARING.has(entry.type)) continue;
        } else {
          // Any other dimension: only what differs from the base.
          const b = render(base.get(row.slot), row, ctx);
          if (b && b.text === r.text) continue;
        }
        blockLines.push(line(row, entry, r));
        if (r.clamped) rowClamped.set(row.variable, true);
      }
      if (blockLines.length) blocks.push('', `${block.selector} {`, ...blockLines, '}');
    }

    for (const c of coverage) {
      if (rowClamped.get(c.variable) && c.class !== 'dropped' && c.class !== 'approximated') {
        c.class = 'approximated';
        c.note = c.note ? `${c.note}; sRGB gamut clamp (${formatOf(mapping, c.variable)})` : `sRGB gamut clamp (${formatOf(mapping, c.variable)})`;
      }
    }

    const header = (file.header ?? []).map((h) => h.replaceAll('{projectName}', project));
    let contents;
    if (out) {
      contents = JSON.stringify(out, null, 2) + '\n';
    } else if (file.template === 'css-custom-properties') {
      contents = [...header, ...(header.length ? [''] : []), `${file.selector ?? ':root'} {`, ...lines, '}', ...blocks, ''].join('\n');
    } else {
      contents = [...header, ...(header.length ? [''] : []), ...lines, ''].join('\n');
    }
    files.push({ path: file.path, contents, kind: FILE_KIND[file.template] });
  }

  const multi = (ir.dimensionNames ?? []).filter((d) => (ir.dimensions?.[d]?.values?.length ?? 1) > 1);
  coverage.push(...droppedDimensions(multi, [...expressed]));
  return { files, coverage };
}

function formatOf(mapping, variable) {
  for (const f of mapping.files) for (const r of f.rows) if (r.variable === variable) return r.format ?? 'oklch';
  return 'hex';
}

function coverageRow(row, entry, r) {
  const base = { variable: row.variable, slot: row.slot };
  if (entry?.value === undefined) {
    return { ...base, class: 'dropped', note: row.note ?? 'the slot has no value in this design system' };
  }
  if (!r) {
    return { ...base, class: 'dropped', note: row.note ?? (row.part !== undefined ? `the value has no "${row.part}" member` : `a ${entry.type} value has no single-value form here`) };
  }
  return { ...base, class: row.class ?? 'native', provenance: entry.provenance?.kind, ...(row.note !== undefined ? { note: row.note } : {}) };
}
