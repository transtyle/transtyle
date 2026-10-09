/**
 * The report viewer's reading of a `report.json`, shared by the page's server
 * render (src/pages/report/index.astro) and its browser script
 * (src/report-dom.js): what counts as a report, and what the page shows of one.
 *
 * Browser-safe on purpose: it imports core's schema validator and the report
 * schema by path, not `@transtyle/core` (whose entry point reads the file
 * system). Both files import nothing but `nearest.js`, which imports nothing.
 * The viewer never fetches the `$schema` URL: it doesn't resolve yet, and the
 * schema it would describe is bundled here.
 */
import { validate } from '../../packages/core/src/schema/validate.js';
import { reportSchema } from '../../packages/core/src/schema/report.schema.js';
import { REPORT_SCHEMA_ID } from '../../packages/core/src/report.js';

/** The largest input the viewer reads. Real reports are well under 1 MB. */
export const MAX_BYTES = 20 * 1024 * 1024;

/** How many schema problems are listed before "and N more". */
const MAX_SCHEMA_ERRORS = 20;

/**
 * The five coverage classes, in the order the CLI prints them. `seg` is the
 * site's colour for the class (global.css `.covmatrix`): dropped and
 * unsupported share the grey, and their words tell them apart.
 */
export const CLASSES = [
  { id: 'native', seg: 'native', blurb: 'first-class slot, lossless' },
  { id: 'derived', seg: 'derived', blurb: 'synthesized by derivation, then mapped natively' },
  { id: 'approximated', seg: 'approx', blurb: 'mapped, but the meaning changed' },
  { id: 'dropped', seg: 'other', blurb: 'your system has it, this target can’t say it' },
  { id: 'unsupported', seg: 'other', blurb: 'the target has it, Transtyle doesn’t cover it yet' },
];

export const SEVERITIES = [
  { id: 'error', label: 'Errors' },
  { id: 'warning', label: 'Warnings' },
  { id: 'info', label: 'Info' },
];

const typeName = (v) => (v === null ? 'null' : Array.isArray(v) ? 'an array' : `a ${typeof v}`);

/** `code`: the lines are data (JSON paths, a parser message), set in mono. */
const fail = (title, lines = [], code = false) => ({ error: { title, lines, code } });

/**
 * Read a report from text. Returns `{ report }`, or `{ error: { title, lines } }`
 * (`code`: the lines are data) with a message for each way the input can be wrong, checked in this order so
 * the first message is the most useful one.
 */
export function readReport(text) {
  if (typeof text !== 'string' || text.trim() === '') return fail('Nothing to read: the input is empty.');
  if (text.length > MAX_BYTES) {
    return fail(`This input is ${formatBytes(text.length)}; the viewer reads reports up to ${formatBytes(MAX_BYTES)}.`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return fail('This is not valid JSON.', [withLineColumn(String(e.message), text)], true);
  }

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return fail(`A report.json is a JSON object; this is ${typeName(data)}.`);
  }

  const schema = data.$schema;
  if (typeof schema === 'string' && schema.includes('/schemas/config/')) {
    return fail(`This is a transtyle.config.json (its $schema is ${schema}), not a build report.`, [
      'A build writes report.json next to each target’s files, for example dist/bootstrap/report.json.',
    ]);
  }
  if (schema !== undefined && schema !== REPORT_SCHEMA_ID) {
    return fail(`This file’s $schema is ${JSON.stringify(schema)}, not a Transtyle build report.`, [
      `A report says "$schema": "${REPORT_SCHEMA_ID}".`,
    ]);
  }
  if (Array.isArray(data.targets) && !('coverage' in data)) {
    return fail('This is the output of transtyle check --json, not a report.json.', [
      'It holds every target’s coverage at once, without the target, file list and header a report has.',
      'Open one target’s report.json from its output directory instead, for example dist/bootstrap/report.json, written by transtyle build.',
    ]);
  }
  if ('tokens' in data && 'targets' in data && !('coverage' in data)) {
    return fail('This looks like a transtyle.config.json, not a build report.', [
      'A build writes report.json next to each target’s files, for example dist/bootstrap/report.json.',
    ]);
  }

  const errors = validate(data, reportSchema);
  if (errors.length > 0) {
    const lines = errors.slice(0, MAX_SCHEMA_ERRORS).map((e) => `${e.path}: ${e.message}`);
    if (errors.length > MAX_SCHEMA_ERRORS) lines.push(`… and ${errors.length - MAX_SCHEMA_ERRORS} more.`);
    return fail(
      `This doesn’t match the report schema (report/v0): ${errors.length} problem${errors.length === 1 ? '' : 's'}.`,
      lines,
      true,
    );
  }
  return { report: data };
}

/** Chromium says "at position 42"; add the line and column when it doesn't. */
function withLineColumn(message, text) {
  const m = /position (\d+)/.exec(message);
  if (!m || /line \d+/.test(message)) return message;
  const before = text.slice(0, Number(m[1]));
  const line = before.split('\n').length;
  const column = before.length - before.lastIndexOf('\n');
  return `${message} (line ${line}, column ${column})`;
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Counts and percentages per class, as the CLI computes them: from the rows
 * (not the report's `counts`), each `Math.round(count / rows * 100)`, a class
 * with no row left out of the terminal line. `width` is the exact share, for
 * the bar.
 */
export function coverageSummary(report) {
  const items = report.coverage.items;
  const total = items.length;
  const counts = {};
  for (const item of items) counts[item.class] = (counts[item.class] ?? 0) + 1;
  const classes = CLASSES.map((c) => {
    const count = counts[c.id] ?? 0;
    return {
      ...c,
      count,
      pct: count ? Math.round((count / (total || 1)) * 100) : null,
      width: total ? (count / total) * 100 : 0,
    };
  });
  const line = classes.filter((c) => c.pct !== null).map((c) => `${c.pct}% ${c.id}`).join(' · ');
  return { total, classes, cliLine: `${report.target}  ${line}` };
}

/** `file:line:column`, as the CLI prints it after the code; '' when the diagnostic has no file. */
export function locationOf(d) {
  if (typeof d.file !== 'string') return '';
  if (d.line === undefined) return d.file;
  return `${d.file}:${d.line}${d.column === undefined ? '' : `:${d.column}`}`;
}

/** The diagnostics grouped by severity (errors first), empty groups left out. */
export function groupDiagnostics(list) {
  return SEVERITIES.map((s) => ({ ...s, items: list.filter((d) => d.severity === s.id) })).filter(
    (g) => g.items.length > 0,
  );
}

/** A shell word: as it is when it is safe, single-quoted otherwise (`$primary` would expand). */
export function shellWord(s) {
  return /^[\w./:=@%+-]+$/.test(s) ? s : `'${s.replaceAll("'", `'\\''`)}'`;
}

/**
 * The command that traces a row back to what was authored, or null for rows
 * that name no single variable (`(mode:density)`, PrimeNG's per-family
 * summaries, which carry spaces or parentheses).
 */
export function explainCommand(variable, target) {
  if (!/^[^\s()]+$/.test(variable)) return null;
  return `npx transtyle explain --variable ${shellWord(variable)} --target ${shellWord(target)}`;
}

/**
 * The rows as the table shows them. `id` is the row's anchor; `via` entries
 * point at the row of the variable they name, when the report has one.
 * `reads` is set only when `slots` says more than the `slot` label does.
 */
export function viewRows(report) {
  const items = report.coverage.items;
  const index = new Map();
  items.forEach((item, i) => {
    if (!index.has(item.variable)) index.set(item.variable, i);
  });
  return items.map((item, i) => {
    const reads =
      Array.isArray(item.slots) && !(item.slots.length === 1 && item.slots[0] === item.slot) ? item.slots : null;
    return {
      id: `r-${i}`,
      variable: item.variable,
      slot: item.slot,
      reads,
      via: (item.via ?? []).map((v) => ({ variable: v, href: index.has(v) ? `#r-${index.get(v)}` : null })),
      cls: item.class,
      seg: CLASSES.find((c) => c.id === item.class)?.seg ?? 'other',
      provenance: item.provenance ?? null,
      note: item.note ?? null,
      meaning: item.meaning ?? null,
      // Core adds these from the slot's DTCG $description / $deprecated (#30).
      description: typeof item.description === 'string' ? item.description : null,
      deprecated:
        item.deprecated === undefined || item.deprecated === false
          ? null
          : { reason: typeof item.deprecated === 'string' ? item.deprecated : null, by: item.deprecatedBy ?? null },
      explain: explainCommand(item.variable, report.target),
    };
  });
}

/** The report's `options` as one line of JSON, or null when there are none. */
export function optionsText(report) {
  const o = report.options;
  return o && Object.keys(o).length > 0 ? JSON.stringify(o) : null;
}
