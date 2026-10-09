#!/usr/bin/env node
/**
 * The catalog-signals report (docs/findings/catalog-signals.md): every
 * `unsupported` coverage row of every exporter on every example, grouped by
 * what it is missing, generated, never hand-edited (issue #94).
 *
 * The catalog grows on evidence: two independent exporters needing the same
 * thing ("How the language grows", website/src/docs/language.md). That evidence
 * sits in the coverage reports, one exporter at a time, and until now each
 * proposal re-collected it by hand. This page collects it once, from a compile.
 *
 * Grouping is by MEANING, never by note text. An exporter declares on a row
 * what the row is missing (`meaning: "icon.size"`, an optional field of the
 * report schema), and every key is registered, with a status saying whether it
 * is still open or already settled, in docs/findings/catalog-meanings.json.
 * Fuzzy-matching notes was the alternative and was not taken: two exporters'
 * prose never agrees, and a grouping nobody declared is a claim nobody made.
 *
 * PrimeNG reports one row per component family (2759 slots would drown
 * report.json), so for it the unit is the slot: its emitted preset is
 * re-classified with the exporter's own classifySurface() and the slots left
 * on Aura's default are read one by one. The totals are reconciled against the
 * exporter's own report row, so the two views can't drift apart.
 *
 * Mantine reports one summary row per family of its surface inventory and a
 * named row for every entry left on Mantine's default; the named rows are the
 * units and the summaries are skipped.
 *
 * `dropped` rows point the other way (the IR has it, the target can't) and are
 * not catalog-growth signal; they get their own section, by catalog slot.
 *
 * The page applies no threshold. It counts; a proposal decides.
 *
 * `--check` regenerates in memory and fails when the committed page differs,
 * the same bargain gen-figures.mjs makes. Both modes fail on a meaning key the
 * registry doesn't list, and on a registry key nothing reports any more.
 *
 * Run: node scripts/gen-catalog-signals.mjs            (also: npm run gen:catalog-signals)
 *      node scripts/gen-catalog-signals.mjs --check    (also: npm run check:catalog-signals)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import * as prettier from 'prettier';
import { EXAMPLES, TARGETS } from './lib/demos.mjs';
import { compileExamples, exportersOf, root } from './lib/compile-examples.mjs';

const OUT = 'docs/findings/catalog-signals.md';
const REGISTRY = 'docs/findings/catalog-meanings.json';
const outFile = join(root, OUT);
const check = process.argv.includes('--check');
const errors = [];

const { INVENTORY, classifySurface } = await import(
  '../packages/exporter-primeng/src/surface-coverage.js'
);
const registry = JSON.parse(readFileSync(join(root, REGISTRY), 'utf8')).meanings;

/** Statuses, in the order the page lists them. */
const STATUSES = {
  open: 'Open: waiting for evidence from another exporter',
  watch: 'Watch: deferred by a proposal, reopens on a named trigger',
  disagreement: 'Disagreement: both sides have the concept and model it incompatibly',
  rejected: 'Rejected: tested by a proposal and turned down',
  'target-specific': "Target-specific: the target's own surface, not token semantics",
  promoted: 'Promoted: now a catalog slot',
};
for (const [key, entry] of Object.entries(registry)) {
  if (!STATUSES[entry.status])
    errors.push(`${REGISTRY}: "${key}" has status "${entry.status}" (one of: ${Object.keys(STATUSES).join(', ')})`);
  if (!entry.summary) errors.push(`${REGISTRY}: "${key}" has no summary`);
  if (entry.ref && !existsSync(join(root, entry.ref.split('#')[0])))
    errors.push(`${REGISTRY}: "${key}" refers to ${entry.ref}, which doesn't exist`);
}

// ---------------------------------------------------------------------------
// Collect
// ---------------------------------------------------------------------------

let results;
try {
  results = await compileExamples();
} catch (error) {
  console.error(`✖ catalog signals: ${error.message}`);
  process.exit(1);
}
const exampleIds = EXAMPLES.map((e) => e.id);
const exporterTitle = (id) => TARGETS.find((t) => t.id === id)?.title ?? id;

/**
 * One unit of evidence: a report row, or (PrimeNG) a surface slot. The same
 * unit in several examples is one unit seen several times, so examples are a
 * set on it rather than separate rows.
 */
const units = new Map();
function see(example, unit) {
  const id = `${unit.direction}|${unit.exporter}|${unit.id}`;
  if (!units.has(id)) units.set(id, { ...unit, examples: new Set() });
  units.get(id).examples.add(example);
}

/** The literal object PrimeNG's preset file passes to definePreset(Aura, …). */
function primengPreset(contents) {
  const start = contents.indexOf('definePreset(Aura, ');
  const end = contents.lastIndexOf('});');
  if (start < 0 || end < 0) throw new Error('primeng: preset.transtyle.ts no longer calls definePreset(Aura, {…})');
  const literal = contents.slice(start + 'definePreset(Aura, '.length, end + 1);
  // The exporter's serializer writes one `key: <JSON>` per line, keys bare
  // when they are identifiers, and the call's object ends on a trailing
  // comma: quoting the keys and dropping that comma makes it JSON.
  const json = literal.replace(/^(\s*)([A-Za-z_$][\w$]*): /gm, '$1"$2": ').replace(/,\s*}$/, '\n}');
  return JSON.parse(json);
}

for (const [example, result] of results) {
  const exporters = exportersOf(example);
  for (const target of result.results) {
    const exporter = exporters.get(target.target) ?? target.target;

    if (exporter === 'primeng') {
      const file = target.emitted.find((f) => f.path === 'preset.transtyle.ts');
      const { rows, byReason } = classifySurface(INVENTORY, primengPreset(file.contents));
      // Reconcile with the exporter's own totals row before trusting the view.
      const totals = target.coverage.find((c) => c.variable === 'PrimeNG surface totals');
      const reported = Number(/(\d+) Aura default/.exec(totals?.slot ?? '')?.[1]);
      if (reported !== byReason.base)
        errors.push(`primeng (${example}): ${byReason.base} slots on Aura's default here, ${reported} in the report's totals row`);
      for (const r of rows) {
        if (r.reason !== 'base') continue;
        see(example, {
          direction: 'unsupported',
          kind: 'slot',
          exporter,
          id: r.slot.path,
          family: r.slot.family,
          meaning: r.meaning,
          ref: r.slot.kind === 'ref' ? r.slot.ref : undefined,
        });
      }
    }

    for (const row of target.coverage) {
      // Mantine's family rows (`theme.* (73 entries)`) summarize the named
      // entry rows that follow them; the entries are the units, not the sums.
      if (exporter === 'mantine' && /^\w+\.\* \(\d+ entries\)$/.test(row.variable)) continue;
      if (row.class === 'unsupported' && exporter !== 'primeng') {
        see(example, { direction: 'unsupported', kind: 'row', exporter, id: row.variable, meaning: row.meaning, note: row.note });
      } else if (row.class === 'dropped') {
        see(example, { direction: 'dropped', kind: 'row', exporter, id: `${target.target}|${row.variable}`, variable: row.variable, slot: row.slot });
      }
    }
  }
}

const all = [...units.values()];
const unsupported = all.filter((u) => u.direction === 'unsupported');
const keyed = unsupported.filter((u) => u.meaning);

for (const u of keyed) {
  if (!registry[u.meaning])
    errors.push(`${u.exporter}: ${u.id} declares meaning "${u.meaning}", which ${REGISTRY} doesn't list`);
}
const used = new Set(keyed.map((u) => u.meaning));
for (const [key, entry] of Object.entries(registry)) {
  if (!used.has(key) && entry.status !== 'promoted')
    errors.push(`${REGISTRY}: "${key}" is reported by no exporter any more — remove it, or mark it promoted`);
}

if (errors.length > 0) {
  console.error('✖ catalog signals:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const code = (s) => `\`${s.replace(/`/g, "'")}\``;
const unitWord = (exporter, n) => (exporter === 'primeng' ? plural(n, 'slot') : plural(n, 'row'));
const link = (ref) => {
  const [path, anchor] = ref.split('#');
  return `[${path.split('/').pop().replace(/\.md$/, '')}](${relative(dirname(OUT), path)}${anchor ? `#${anchor}` : ''})`;
};
/** "in all four examples" is the normal case and goes unsaid; anything less is printed. */
const onlyIn = (examples) =>
  examples.size === exampleIds.length ? '' : ` (${exampleIds.filter((e) => examples.has(e)).join(', ')} only)`;
const groupBy = (list, key) => {
  const out = new Map();
  for (const item of list) {
    const k = key(item);
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(item);
  }
  return out;
};
const exporterOrder = (a, b) =>
  TARGETS.findIndex((t) => t.id === a) - TARGETS.findIndex((t) => t.id === b) || byText(a, b);

const lines = [
  '<!-- Generated by scripts/gen-catalog-signals.mjs (npm run gen:catalog-signals). Do not edit: check:catalog-signals fails on any hand edit. -->',
  '',
  '# Catalog signals',
  '',
  `Every \`unsupported\` coverage row the official exporters report on the ${plural(exampleIds.length, 'example')}, grouped by what the row says is missing. An \`unsupported\` row is a target slot the IR has no vocabulary for, which makes these rows the raw material of the catalog's growth rule: two independent exporters needing the identical thing, for architectural reasons (see "How the language grows" in [the language reference](../../website/src/docs/language.md)).`,
  '',
  `Rows are grouped by the \`meaning\` key the exporter declares on them, never by their note text. Each key is registered, with a status, in [catalog-meanings.json](catalog-meanings.json); a key the registry doesn't list fails \`check:catalog-signals\`. The page counts and applies no threshold: a count is necessary for a catalog proposal, not sufficient.`,
  '',
  'PrimeNG reports one row per component family, so for PrimeNG the unit is the slot: its preset is re-classified slot by slot and reconciled with its report. A row or slot reported by several examples is counted once; it is marked when it is not reported by all of them.',
  '',
  '## Totals',
  '',
  '| Exporter | `unsupported` | With a meaning | Without |',
  '| --- | --- | --- | --- |',
];
const unsupportedBy = groupBy(unsupported, (u) => u.exporter);
for (const exporter of [...unsupportedBy.keys()].sort(exporterOrder)) {
  const list = unsupportedBy.get(exporter);
  const k = list.filter((u) => u.meaning).length;
  lines.push(`| ${exporterTitle(exporter)} | ${unitWord(exporter, list.length)} | ${k} | ${list.length - k} |`);
}
const partial = unsupported.filter((u) => u.examples.size < exampleIds.length).sort((a, b) => byText(`${a.exporter}|${a.id}`, `${b.exporter}|${b.id}`));
lines.push(
  '',
  partial.length === 0
    ? 'Every row and slot below is reported by all the examples: `unsupported` describes the target, not the design system.'
    : `Every row and slot below is reported by all the examples, except ${partial.map((u) => `${exporterTitle(u.exporter)} ${code(u.id)}${onlyIn(u.examples)}`).join(', ')}: \`unsupported\` mostly describes the target, and only a design system that authors a slot's concept takes it off the list.`,
);
const silent = TARGETS.map((t) => t.id).filter((id) => !unsupportedBy.has(id));
lines.push(
  '',
  `${silent.map(exporterTitle).join(', ')} report no \`unsupported\` row: only exporters that inventory their target's whole surface can say what they leave undriven.`,
);

// ---- meanings ----
const byMeaning = groupBy(keyed, (u) => u.meaning);
const meaningRow = (key) => {
  const list = byMeaning.get(key);
  const per = groupBy(list, (u) => u.exporter);
  const exporters = [...per.keys()].sort(exporterOrder);
  const evidence = exporters.map((e) => `${exporterTitle(e)} (${unitWord(e, per.get(e).length)})`).join(', ');
  return { exporters, evidence, per };
};

lines.push('', '## By meaning', '');
lines.push('| Meaning | Status | Exporters | Evidence | Settled by |', '| --- | --- | --- | --- | --- |');
const meaningKeys = [...byMeaning.keys()].sort(
  (a, b) =>
    Object.keys(STATUSES).indexOf(registry[a].status) - Object.keys(STATUSES).indexOf(registry[b].status) ||
    meaningRow(b).exporters.length - meaningRow(a).exporters.length ||
    byText(a, b),
);
for (const key of meaningKeys) {
  const { exporters, evidence } = meaningRow(key);
  const { status, ref } = registry[key];
  lines.push(`| ${code(key)} | ${status} | ${exporters.length} | ${evidence} | ${ref && status !== 'open' ? link(ref) : ''} |`);
}
lines.push('', 'Statuses:', '');
for (const [status, text] of Object.entries(STATUSES)) lines.push(`- **${status}**: ${text.split(': ')[1]}.`);

lines.push('', '### What each meaning holds');
for (const key of meaningKeys) {
  const { exporters, per } = meaningRow(key);
  const entry = registry[key];
  lines.push('', `#### ${code(key)}`, '', `${entry.summary}${entry.ref ? ` See ${link(entry.ref)}.` : ''}`, '');
  for (const exporter of exporters) {
    const list = per.get(exporter);
    if (exporter === 'primeng') {
      const families = [...groupBy(list, (u) => u.family)].sort(([a], [b]) => byText(a, b));
      lines.push(`- ${exporterTitle(exporter)}: ${plural(list.length, 'slot')} in ${plural(families.length, 'family', 'families')}: ${families.map(([f, s]) => `${f} (${s.length})`).join(', ')}.`);
    } else {
      const ids = list.map((u) => `${code(u.id)}${onlyIn(u.examples)}`).sort(byText);
      lines.push(`- ${exporterTitle(exporter)}: ${ids.join(', ')}.`);
    }
  }
}

// ---- PrimeNG's undriven references ----
const refs = unsupported.filter((u) => !u.meaning && u.ref);
if (refs.length > 0) {
  // `{green.500}` is Aura's primitive palette, not its semantic tier: one
  // group, whatever the hue. A reference that isn't a dotted path at all (a
  // CSS `light-dark()` expression) is counted, not quoted.
  const PALETTE = "Aura's primitive palette";
  const OTHER = 'not a token path';
  const groupOf = (ref) =>
    /^[a-z]+\.\d+$/.test(ref) ? PALETTE : /^[\w.]+$/.test(ref) ? `${ref.split('.').slice(0, 2).join('.')}.*` : OTHER;
  const groups = [...groupBy(refs, (u) => groupOf(u.ref))].sort(
    ([a, x], [b, y]) => y.length - x.length || byText(a, b),
  );
  const label = (group, list) =>
    group === PALETTE
      ? `${PALETTE} (${[...new Set(list.map((u) => `{${u.ref.split('.')[0]}.*}`))].sort(byText).map(code).join(', ')})`
      : group === OTHER
        ? 'A CSS expression, not a token path'
        : code(group);
  lines.push(
    '',
    '## Undriven Aura paths',
    '',
    `${plural(refs.length, 'PrimeNG slot')} keep Aura's default because Aura points them at a semantic path this exporter does not drive. These are exporter work before they are catalog evidence: driving the path cascades to every slot that references it, and some of these paths are reachable with vocabulary the catalog already ships (see the [coverage spec](../specs/validation-and-coverage.md), "Coverage percentages are not comparable across targets").`,
    '',
    '| Aura path | Slots | Families |',
    '| --- | --- | --- |',
  );
  for (const [path, list] of groups) {
    lines.push(`| ${label(path, list)} | ${list.length} | ${new Set(list.map((u) => u.family)).size} |`);
  }
}

// ---- without a meaning ----
const unkeyed = unsupported.filter((u) => !u.meaning && !u.ref);
lines.push('', '## Without a meaning', '');
if (unkeyed.length === 0) {
  lines.push('Every `unsupported` row carries a meaning.');
} else {
  lines.push(
    'Rows and slots no exporter has given a meaning yet. A key goes on the row in the exporter, and in the registry, once another exporter reports the same concept, or once a proposal settles it.',
  );
  for (const [exporter, list] of [...groupBy(unkeyed, (u) => u.exporter)].sort(([a], [b]) => exporterOrder(a, b))) {
    lines.push('', `### ${exporterTitle(exporter)}`, '');
    if (exporter === 'primeng') {
      const leaves = [...groupBy(list, (u) => u.id.split('.').pop())].sort(
        ([a, x], [b, y]) => y.length - x.length || byText(a, b),
      );
      const shown = leaves.filter(([, s]) => s.length >= 10);
      const rest = leaves.slice(shown.length);
      lines.push(
        `${plural(list.length, 'slot')} keep one of Aura's own literals, by property: ${shown.map(([leaf, s]) => `${code(leaf)} ${s.length}`).join(', ')}${rest.length ? `, and ${plural(rest.reduce((n, [, s]) => n + s.length, 0), 'slot')} under ${rest.length} other properties` : ''}.`,
      );
    } else {
      for (const u of list.sort((a, b) => byText(a.id, b.id))) {
        lines.push(`- ${code(u.id)}${onlyIn(u.examples)}: ${u.note ?? 'no note'}`);
      }
    }
  }
}

// ---- dropped ----
const dropped = all.filter((u) => u.direction === 'dropped');
const isCatalogSide = (u) => /^(semantic|component)\./.test(u.slot) || u.variable.startsWith('(mode:');
const catalogSide = groupBy(dropped.filter(isCatalogSide), (u) => (u.slot === '—' ? u.variable : u.slot));
lines.push(
  '',
  '## Target limits (`dropped`)',
  '',
  "`dropped` is the opposite direction: the IR expresses something the target can't. It is not catalog-growth signal, but it says which catalog slots and mode dimensions a target leaves out. Rows naming a catalog slot or a mode dimension:",
  '',
  '| Catalog slot or mode | Dropped by |',
  '| --- | --- |',
);
for (const [what, list] of [...catalogSide].sort(([a, x], [b, y]) => y.length - x.length || byText(a, b))) {
  const per = [...groupBy(list, (u) => u.exporter)].sort(([a], [b]) => exporterOrder(a, b));
  const examples = new Set(list.flatMap((u) => [...u.examples]));
  lines.push(`| ${code(what)}${onlyIn(examples)} | ${per.map(([e]) => exporterTitle(e)).join(', ')} |`);
}
const surfaceSide = groupBy(dropped.filter((u) => !isCatalogSide(u)), (u) => u.exporter);
lines.push(
  '',
  `The other \`dropped\` rows are target variables an exporter leaves alone because they carry no token meaning (layout switches, derivation knobs, filters): ${[...surfaceSide].sort(([a], [b]) => exporterOrder(a, b)).map(([e, l]) => `${exporterTitle(e)} ${l.length}`).join(', ')}. Each one's reason is in that target's \`report.json\`.`,
  '',
);

const config = await prettier.resolveConfig(outFile);
const page = await prettier.format(lines.join('\n'), { ...config, filepath: outFile });
const summary = `${plural(unsupported.length, 'unsupported unit')}, ${plural(byMeaning.size, 'meaning')}, ${plural(refs.length, 'undriven Aura slot')}, ${unkeyed.length} without a meaning`;

if (check) {
  if (!existsSync(outFile) || readFileSync(outFile, 'utf8') !== page) {
    console.error(`✖ catalog signals: ${OUT} no longer matches the exporters' coverage rows.`);
    console.error('  Run `npm run gen:catalog-signals` and commit the result.');
    process.exit(1);
  }
  console.log(`✔ catalog signals: ${OUT} matches a fresh compile (${summary})`);
} else {
  writeFileSync(outFile, page);
  console.log(`✔ catalog signals: wrote ${OUT} (${summary})`);
}
