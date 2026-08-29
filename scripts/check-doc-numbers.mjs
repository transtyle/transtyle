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

// ---------- verdict ----------
if (errors.length) {
  console.error(`✖ doc numbers: ${errors.length} stale claim(s)\n`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('✔ doc numbers: every coverage transcript and matrix in the docs matches the committed reports');
