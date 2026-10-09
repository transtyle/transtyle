/**
 * Custom vocabulary: the `semantic.*` tokens a design system authors outside
 * the catalog (issue #51; docs/specs/validation-and-coverage.md, "Custom
 * vocabulary").
 *
 * The adoption playbook tells a team to keep its own names as custom
 * `semantic.*` tokens and bind the catalog to them. On the output side their
 * fate used to be invisible: a closed-set target ignored them without a row.
 * Core now accounts for every one of them on every target, after the
 * exporter ran, so no exporter has to do anything:
 *
 *  - emitted: a coverage row that emits (native, derived, approximated) names
 *    the token itself (an open-vocabulary target such as css-variables);
 *  - reached: not emitted under its own name, but on the alias or rule-input
 *    chain of a slot an emitting row names, composite members included (`semantic.color.primary.solid` →
 *    `semantic.color.crt.ink`): its value reaches the target through a binding;
 *  - no path: neither. Core appends one `dropped` row for it, unless the
 *    exporter already reported it itself.
 *
 * "Custom" is the adoption report's definition (adoption.js, issue #61): a
 * `semantic.*` path that `isCatalogSlot()` rejects and that is not a grid cell
 * of a role archetyped with `$extensions.transtyle.role` (a custom role joins
 * the catalog's grid, and exporters already map it). The adoption report says
 * which of them a catalog slot reads; this says what each target does with them.
 */

import { GRID_CELLS, PROVENANCE } from '@transtyle/ir';
import { compareSlotPaths, isCatalogSlot } from './catalog.js';

/** The `meaning` key of the rows core adds (docs/findings/catalog-meanings.json). */
export const CUSTOM_MEANING = 'custom.vocabulary';

/** A custom-token row's `variable`, following the `(mode:<dimension>)` form. */
export const customRowVariable = (path) => `(custom:${path})`;
const CUSTOM_ROW = /^\(custom:/;

/** True for the rows core adds for custom tokens: kept out of coverage percentages. */
export const isCustomRow = (row) => CUSTOM_ROW.test(row?.variable ?? '');

const EMITS = new Set(['native', 'derived', 'approximated']);

/** The map custom tokens are read from: the default mode's (any mode has the same keys). */
const defaultMap = (normalized) =>
  normalized.modes[normalized.defaultMode] ?? normalized.modes.light ?? Object.values(normalized.modes)[0];

/** A grid cell of one of the design system's archetyped custom roles. */
function isCustomRoleCell(path, normalized) {
  const [tier, group, role, ...cell] = path.split('.');
  return (
    tier === 'semantic' &&
    group === 'color' &&
    normalized?.roleArchetypes?.has?.(role) === true &&
    GRID_CELLS.includes(cell.join('.'))
  );
}

/**
 * The design system's custom semantic tokens, in path order: the `semantic.*`
 * paths that are neither catalog slots nor custom role cells.
 */
export function customTokens(normalized) {
  const map = normalized ? defaultMap(normalized) : undefined;
  if (!(map instanceof Map)) return [];
  const out = [];
  for (const path of map.keys()) {
    if (!path.startsWith('semantic.') || isCatalogSlot(path) || isCustomRoleCell(path, normalized)) continue;
    out.push(path);
  }
  return out.sort(compareSlotPaths);
}

/** A rule input is recorded relative (`primary.solid`, `radius.md`): the same lookup `explain` does. */
function qualify(map, input) {
  for (const candidate of [input, `semantic.${input}`, `semantic.color.${input}`, `component.${input}`]) {
    if (map.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Account for the custom tokens on one target, from the rows its exporter
 * returned.
 *
 * @param normalized what the exporter was given
 * @param coverage the exporter's coverage rows (not modified)
 * @param slotsOf `(row) => string[]`, the IR paths a row reads (core's `coverageSlots`)
 * @param {{ open?: boolean, omitted?: boolean }} target `open`: the exporter
 *   declares `openVocabulary`; `omitted`: its options say `customTokens: "omit"`
 * @returns {{ rows: object[], summary: { total, emitted, reached, dropped }, unreached: string[] }}
 *   `rows` are the `dropped` rows to append; `summary` counts every token
 *   once; `unreached` lists the tokens with no path, in path order
 */
export function accountCustomTokens(normalized, coverage, slotsOf, { open = false, omitted = false } = {}) {
  const custom = customTokens(normalized);
  const summary = { total: custom.length, emitted: 0, reached: 0, dropped: 0 };
  if (custom.length === 0) return { rows: [], summary, unreached: [] };
  const map = defaultMap(normalized);

  const emitted = new Set();
  const named = new Set();
  for (const row of coverage) {
    const slots = slotsOf(row);
    for (const s of slots) named.add(s);
    if (EMITS.has(row.class)) for (const s of slots) emitted.add(s);
  }

  // Every slot whose value feeds an emitted one: aliases followed to their
  // target, rules to their inputs (a derived hover cell reads its `.solid`).
  const reached = new Set();
  const stack = [...emitted];
  while (stack.length) {
    const path = stack.pop();
    if (reached.has(path)) continue;
    reached.add(path);
    const prov = map.get(path)?.provenance;
    if (!prov) continue;
    // Composite members read their own targets (a shadow's colour), as in adoption.js.
    const next = [...(prov.kind === PROVENANCE.ALIASED ? [prov.target] : prov.inputs ?? []), ...Object.values(prov.members ?? {})];
    for (const raw of next) {
      const full = raw ? qualify(map, raw) : null;
      if (full && !reached.has(full)) stack.push(full);
    }
  }

  const note = open
    ? omitted
      ? 'custom semantic token; omitted by options.customTokens'
      : 'custom semantic token; this target has an open vocabulary, but its exporter did not emit this token'
    : 'custom semantic token; no catalog slot binds to it and this target has no open vocabulary';
  const rows = [];
  const unreached = [];
  for (const path of custom) {
    if (emitted.has(path)) summary.emitted++;
    else if (reached.has(path)) summary.reached++;
    else {
      summary.dropped++;
      unreached.push(path);
      // The exporter's own row (a type its open vocabulary can't write, say)
      // already says why: no second row for the same token.
      if (!named.has(path)) {
        rows.push({ variable: customRowVariable(path), slot: path, class: 'dropped', note, meaning: CUSTOM_MEANING });
      }
    }
  }
  return { rows, summary, unreached };
}

/**
 * The counts as one phrase, the same in the CLI summary and `usage.md`:
 * `14 tokens, 10 reach this target via bindings, 4 have no path`.
 */
export function customVocabularySentence({ total, emitted, reached, dropped }) {
  const parts = [`${total} ${total === 1 ? 'token' : 'tokens'}`];
  if (emitted) parts.push(`${emitted} emitted under ${emitted === 1 ? 'its' : 'their'} own name`);
  if (reached) parts.push(`${reached} ${reached === 1 ? 'reaches' : 'reach'} this target via bindings`);
  if (dropped) parts.push(`${dropped} ${dropped === 1 ? 'has' : 'have'} no path`);
  return parts.join(', ');
}

/** Appends to a target's `usage.md` what became of the custom tokens (none: unchanged). */
export function withCustomVocabularyNote(contents, summary, unreached) {
  if (!summary.total) return contents;
  const lost = unreached.map((path) => `- \`${path}\``);
  return (
    contents.replace(/\n*$/, '\n') +
    `\n## Custom vocabulary\n\nThe design system's own \`semantic.*\` tokens, outside the catalog: ${customVocabularySentence(summary)}.` +
    (lost.length
      ? ` These have no path to this target (each reported in \`report.json\`):\n\n${lost.join('\n')}\n`
      : '\n')
  );
}
