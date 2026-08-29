#!/usr/bin/env node
/**
 * Numeric-claim guard — the third checker in the docs family.
 *
 * check-sync.mjs proves every exporter exists on all five surfaces;
 * check-docs.mjs proves the pages' *structure* is precise (links, anchors,
 * commands, diagnostic codes). Neither can see a page whose links all resolve
 * and whose prose quotes a coverage number that stopped being true two
 * refactors ago — which is exactly what happened: the GOV.UK showcase's
 * coverage matrix said bootstrap was 23% native long after the AL3
 * reclassification made it 2%, and cli.md's sample transcript printed a
 * shadcn split the CLI had not produced in months. Nothing failed, because
 * nothing was checking.
 *
 * A number copied out of a build is a promise, so the two shapes that carry
 * them verbatim are re-derived from the committed reports on every run:
 *
 *   1. coverage transcripts — a line shaped like the CLI's own output,
 *      `<target>  42% native · 53% derived · …`, in any docs page, blog post,
 *      or the homepage. Checked against examples/<example>/dist/<target>/
 *      report.json, recomputed with the CLI's own rounding. The example is
 *      `acme` unless the surrounding block declares another one (see
 *      EXAMPLE_HINT) — the docs' worked example throughout.
 *
 *   2. coverage matrices — the `.covmatrix` diagram's segment widths, which
 *      must equal the report percentages for the example named by the block's
 *      `data-example` attribute. A matrix without that attribute is an error:
 *      an unlabeled diagram is a number nobody can re-derive.
 *
 *   3. measured markers — the counts prose states in a thousand different
 *      shapes ("40 authored tokens", "657 component-scoped variables"). A page
 *      declares them next to the claim:
 *
 *          <!-- measured: acme.slots = 271 -->
 *          …**40 authored DTCG tokens produce 271 resolved slots per mode**…
 *
 *      The declared value is recomputed from the repo, and the number must
 *      still appear in the block the marker introduces, so neither half can
 *      drift away from the other. See `measure()` for the metric list.
 *
 * Both compare against the reports committed in the repo, which is the honest
 * question — "do the docs say what this repo's own output says?" — and stays
 * answerable without running a build.
 *
 * Run: node scripts/check-doc-numbers.mjs (also: npm run check:doc-numbers,
 * part of check:all). Exits 1 with a list of violations. Extend it when a new
 * shape of copied number appears in the docs.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const errors = [];
const fail = (msg) => errors.push(msg);

const DEFAULT_EXAMPLE = 'acme';
const CLASSES = ['native', 'derived', 'approximated', 'dropped', 'unsupported'];

/** The surfaces that quote build numbers in prose or in a diagram. */
const SURFACES = [
  ...readdirSync(join(root, 'website/src/docs')).filter((f) => f.endsWith('.md')).map((f) => `website/src/docs/${f}`),
  ...readdirSync(join(root, 'website/src/blog')).filter((f) => f.endsWith('.md')).map((f) => `website/src/blog/${f}`),
  'website/src/pages/index.astro',
  'README.md',
  'ROADMAP.md',
  'CONTRIBUTING.md',
];

/**
 * Percentages exactly as the CLI prints them (packages/cli/src/main.js): count
 * over the report's total, rounded half-up per class. Rounding independently
 * per class is why a row can sum to 101 — that is the CLI's behavior, and the
 * docs quote the CLI, so it is reproduced rather than corrected.
 */
const reportPercentages = (example, target) => {
  const path = `examples/${example}/dist/${target}/report.json`;
  if (!existsSync(join(root, path))) return null;
  const counts = JSON.parse(read(path)).coverage.counts;
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(
    Object.entries(counts).map(([k, v]) => [k, Math.round((v / total) * 100)]),
  );
};

const knownTargets = (example) => {
  const dir = join(root, 'examples', example, 'dist');
  return existsSync(dir) ? readdirSync(dir) : [];
};
const targetsOfAcme = new Set(knownTargets(DEFAULT_EXAMPLE));

// ---------- 1. coverage transcripts ----------
// `shadcn  42% native · 53% derived · 3% approximated · 3% dropped`, with the
// leading `# ` a commented bash sample uses. A line naming something that is
// not a real target of the example is left alone: the exporter tutorial walks
// through an invented `alacritty` target, and inventing one is legitimate.
const TRANSCRIPT = /^[#\s]*([a-z][\w-]*)\s{2,}((?:\d{1,3}% (?:native|derived|approximated|dropped|unsupported)(?: · )?)+)\s*$/gm;
// An `<!-- example: govuk -->` comment (or a covmatrix's data-example earlier
// in the file) re-points the transcripts that follow it.
const EXAMPLE_HINT = /<!--\s*example:\s*([\w-]+)\s*-->/;

// The homepage prints its transcript with the classes wrapped in coloured
// spans, so tags come off before matching — the claim is the text, not the
// markup carrying it.
const stripTags = (s) => s.replace(/<[^>]+>/g, '');

for (const surface of SURFACES) {
  const body = read(surface);
  const example = EXAMPLE_HINT.exec(body)?.[1] ?? DEFAULT_EXAMPLE;
  for (const m of stripTags(body).matchAll(TRANSCRIPT)) {
    const [, target, bar] = m;
    if (!targetsOfAcme.has(target) && !knownTargets(example).includes(target)) continue;
    const actual = reportPercentages(example, target);
    if (!actual) {
      fail(`${surface}: quotes coverage for "${target}", which has no report in examples/${example}/dist/`);
      continue;
    }
    const claimed = Object.fromEntries(
      [...bar.matchAll(/(\d{1,3})% (\w+)/g)].map((c) => [c[2], Number(c[1])]),
    );
    for (const cls of CLASSES) {
      const want = actual[cls] ?? 0;
      const got = claimed[cls] ?? 0;
      if (want !== got) {
        fail(
          `${surface}: "${target}" transcript says ${got}% ${cls}, but examples/${example}/dist/${target}/report.json says ${want}% ` +
            `— rewrite the line as: ${target}  ${CLASSES.map((c) => (actual[c] ? `${actual[c]}% ${c}` : null)).filter(Boolean).join(' · ')}`,
        );
        break; // one line, one message: the fix rewrites the whole bar
      }
    }
  }
}

// ---------- 2. coverage matrices ----------
const MATRIX = /<div class="covmatrix"([^>]*)>([\s\S]*?)<\/div>\s*$/gm;
const ROW = /<span class="cm-name">([\w-]+)<\/span>([\s\S]*?)<\/div>/g;

for (const surface of SURFACES) {
  const body = read(surface);
  for (const block of body.matchAll(/<div class="covmatrix"([^>]*)>([\s\S]*?)<\/div>\s*\n\s*<\/div>/g)) {
    const [, attrs, inner] = block;
    const example = /data-example="([\w-]+)"/.exec(attrs)?.[1];
    if (!example) {
      fail(`${surface}: a .covmatrix diagram has no data-example attribute — its numbers can't be re-derived from any report`);
      continue;
    }
    for (const row of inner.matchAll(ROW)) {
      const [, target, segments] = row;
      const actual = reportPercentages(example, target);
      if (!actual) {
        fail(`${surface}: covmatrix row "${target}" has no report in examples/${example}/dist/`);
        continue;
      }
      // The diagram merges dropped + unsupported into one grey `other` segment.
      const expected = {
        native: actual.native ?? 0,
        derived: actual.derived ?? 0,
        approx: actual.approximated ?? 0,
        other: (actual.dropped ?? 0) + (actual.unsupported ?? 0),
      };
      const claimed = Object.fromEntries(
        [...segments.matchAll(/cm-seg (\w+)"\s*style="width:(\d{1,3})%"/g)].map((s) => [s[1], Number(s[2])]),
      );
      for (const [seg, want] of Object.entries(expected)) {
        const got = claimed[seg] ?? 0;
        if (want !== got) {
          fail(
            `${surface}: covmatrix row "${target}" (${example}) shows ${got}% ${seg}, report says ${want}%`,
          );
        }
      }
    }
  }
}

// ---------- 3. measured markers ----------
/**
 * The counts a transcript-shaped regex can never find: "40 authored tokens",
 * "271 resolved slots per mode", "657 component-scoped variables". Prose can
 * say those in a thousand shapes, so instead of guessing at the prose, a page
 * declares the claim next to it:
 *
 *   <!-- measured: acme.slots = 271 -->
 *   …**40 authored DTCG tokens produce 271 resolved slots per mode**…
 *
 * Two things are then checked: the declared value still matches what the repo
 * actually produces, and the number still appears in the paragraph the marker
 * introduces — so a marker cannot quietly drift away from the sentence it
 * certifies, and a sentence cannot be edited out from under its marker.
 *
 * Every metric below is computed from the repo, not from a second copy of the
 * answer. Adding one is the cheap way to put a new prose number under guard.
 */
const cliSrc = read('packages/cli/src/main.js');
const cache = new Map();
const memo = (key, fn) => {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
};

const exampleNames = () =>
  readdirSync(join(root, 'examples'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, 'examples', d.name, 'transtyle.config.json')))
    .map((d) => d.name);

/** Compile an example (no emit) and count what the engine resolved. */
const compiled = async (example) => {
  const key = `compile:${example}`;
  if (!cache.has(key)) {
    const { compile } = await import('../packages/core/src/index.js');
    const loadExporter = async (name) => (await import(`../packages/exporter-${name}/src/index.js`)).default;
    const { normalized } = await compile({ cwd: join(root, 'examples', example), emit: false, loadExporter });
    // The default mode carries every slot; per-mode counts are identical by
    // construction (every slot resolves in every mode).
    const map = normalized.modes[Object.keys(normalized.modes)[0]];
    const slots = [...map.keys()];
    const written = slots.filter((s) => ['authored', 'aliased'].includes(map.get(s).provenance?.kind));
    const tier = (list, name) => list.filter((s) => s.startsWith(`${name}.`)).length;
    cache.set(key, {
      slots: slots.length,
      authored: written.length,
      engine: slots.length - written.length,
      'authored.option': tier(written, 'option'),
      'authored.semantic': tier(written, 'semantic'),
      'authored.component': tier(written, 'component'),
    });
  }
  return cache.get(key);
};

/**
 * What an example's build actually emitted for one target: CSS custom-property
 * declarations (`decls`, and `distinct` names among them), Sass variables
 * (`sass`), and classified coverage rows (`rows`) — the three shapes the
 * exporter pages quote when they say how much output a theme is.
 */
const emitted = (example, target) => {
  const dir = join(root, 'examples', example, 'dist', target);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir);
  const matchIn = (ext, re) =>
    files.filter((f) => f.endsWith(ext)).flatMap((f) => readFileSync(join(dir, f), 'utf8').match(re) ?? []);
  const decls = matchIn('.css', /^\s*--[\w-]+:/gm);
  const report = files.includes('report.json') ? JSON.parse(read(`examples/${example}/dist/${target}/report.json`)) : null;
  return {
    decls: decls.length,
    distinct: new Set(decls.map((d) => d.trim())).size,
    sass: matchIn('.scss', /^\s*\$[\w-]+:/gm).length,
    rows: report ? Object.values(report.coverage.counts).reduce((a, b) => a + b, 0) : null,
  };
};

const surfaceInventory = (target) => {
  const path = `packages/exporter-${target}/surface-inventory.json`;
  return existsSync(join(root, path)) ? JSON.parse(read(path)) : null;
};

/** metric name → computed value (or null when the metric can't be resolved). */
async function measure(metric) {
  const parts = metric.split('.');

  if (metric === 'exporters') {
    return memo(metric, () => (cliSrc.match(/OFFICIAL_EXPORTERS\s*=\s*\{([\s\S]*?)\}/)?.[1].match(/^\s*['"]?[\w-]+['"]?:/gm) ?? []).length);
  }
  if (metric === 'examples') return memo(metric, () => exampleNames().length);
  if (metric === 'demos') {
    return memo(metric, () =>
      exampleNames().reduce((n, ex) => {
        const dir = join(root, 'examples', ex, 'demo');
        return n + (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).length : 0);
      }, 0),
    );
  }

  // <target>.surface.total | <target>.surface.component
  if (parts[1] === 'surface') {
    const inv = surfaceInventory(parts[0]);
    if (!inv) return null;
    if (parts[2] === 'total') return inv.counts.total;
    if (parts[2] === 'component') return inv.counts.component ?? inv.counts.components ?? null;
    return null;
  }

  const [example, ...rest] = parts;
  if (!exampleNames().includes(example)) return null;

  // <example>.<target>.decls | .distinct | .sass | .rows
  if (rest.length === 2 && ['decls', 'distinct', 'sass', 'rows'].includes(rest[1])) {
    return emitted(example, rest[0])?.[rest[1]] ?? null;
  }

  // <example>.slots | .authored | .engine | .authored.<tier>
  const stats = await compiled(example);
  return stats[rest.join('.')] ?? null;
}

const MARKER = /^[ \t]*<!--\s*measured:\s*([\w.-]+)\s*=\s*(\d+)\s*-->[ \t]*$/;

for (const surface of SURFACES) {
  const lines = read(surface).split('\n');
  for (const [i, line] of lines.entries()) {
    const m = MARKER.exec(line);
    if (!m) continue;
    const [, metric, declared] = m;
    const actual = await measure(metric);
    if (actual === null || actual === undefined) {
      fail(`${surface}:${i + 1}: <!-- measured: ${metric} --> names a metric check-doc-numbers.mjs can't compute`);
      continue;
    }
    if (Number(declared) !== actual) {
      fail(`${surface}:${i + 1}: ${metric} is ${actual}, but the page claims ${declared} — update the marker and the sentence under it`);
      continue;
    }
    // The marker must still sit on top of the sentence it certifies: look at
    // the block it introduces (skipping further markers and blank lines).
    let j = i + 1;
    while (j < lines.length && (lines[j].trim() === '' || MARKER.test(lines[j]))) j++;
    let block = '';
    while (j < lines.length && lines[j].trim() !== '') block += lines[j++] + '\n';
    // Prose spells small numbers ("eight exporters", "four examples"), so the
    // claim counts either way — the marker is about the fact, not the glyph.
    const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
    const spelled = WORDS[Number(declared)];
    const said =
      new RegExp(`(?<![\\d,.])${declared}(?![\\d,.])`).test(block.replace(/,/g, '')) ||
      (spelled !== undefined && new RegExp(`\\b${spelled}\\b`, 'i').test(block));
    if (!said) {
      fail(`${surface}:${i + 1}: <!-- measured: ${metric} = ${declared} --> introduces a block that never says ${declared} — the marker has drifted off its claim`);
    }
  }
}

// ---------- verdict ----------
if (errors.length) {
  console.error(`✖ doc numbers: ${errors.length} stale claim(s)\n`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('✔ doc numbers: every coverage transcript and matrix in the docs matches the committed reports');
