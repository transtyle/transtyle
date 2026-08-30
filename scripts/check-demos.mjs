#!/usr/bin/env node
/**
 * The demo gallery's half of the sync rule (CONTRIBUTING.md).
 *
 * check-sync.mjs proves every exporter exists on all five surfaces and
 * check-docs.mjs proves the docs are precise about the code. This one covers
 * the surface those two do not touch: the 32 published demos, the page that
 * indexes them, and the CI that builds them.
 *
 * Everything it checks is a way the exhibit can rot silently — the failure is
 * always a link that resolves in review and 404s for a visitor, or a demo that
 * quietly stops being published:
 *
 *   1. model ↔ disk   — every example and target directory has prose in
 *                       lib/demos.mjs, and every entry there exists on disk.
 *   2. full grid      — every example builds every target. A missing cell is
 *                       either a real gap worth knowing about or a directory
 *                       someone forgot to add.
 *   3. docs pages     — each target's `doc` slug is a real docs page and is
 *                       reachable from the sidebar.
 *   4. see-it-live    — each exporter page links to its demos, and the gallery
 *                       is reachable from the site header.
 *   5. demo READMEs   — each example's demo/README.md table names every
 *                       project in its directory, with its port.
 *   6. CI matrix      — .github/workflows/ci.yml builds exactly the demo
 *                       workspaces that exist, and pages.yml publishes them.
 *
 * Run: node scripts/check-demos.mjs (also: npm run check:demos, part of
 * check:all). Exits 1 with a list of violations.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXAMPLES, TARGETS, discoverDemos, demoPath } from './lib/demos.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const errors = [];
const fail = (msg) => errors.push(msg);

const demos = discoverDemos(root);

// ---------- 1. model ↔ disk ----------
const onDisk = {
  examples: [...new Set(demos.map((d) => d.example))],
  targets: [...new Set(demos.map((d) => d.target))],
};
for (const id of onDisk.examples) {
  if (!EXAMPLES.some((e) => e.id === id)) {
    fail(
      `examples/${id}/demo/ exists but ${id} has no entry in scripts/lib/demos.mjs — the gallery ` +
        'cannot describe a design system nobody has written a line about',
    );
  }
}
for (const id of onDisk.targets) {
  if (!TARGETS.some((t) => t.id === id)) {
    fail(`demo target "${id}" exists on disk but has no entry in scripts/lib/demos.mjs`);
  }
}
for (const e of EXAMPLES) {
  if (!onDisk.examples.includes(e.id)) fail(`lib/demos.mjs describes example "${e.id}", which has no examples/${e.id}/demo/`);
}
for (const t of TARGETS) {
  if (!onDisk.targets.includes(t.id)) fail(`lib/demos.mjs describes target "${t.id}", which no example has a demo for`);
}

// ---------- 2. full grid ----------
for (const e of EXAMPLES) {
  for (const t of TARGETS) {
    if (!demos.some((d) => d.example === e.id && d.target === t.id)) {
      fail(`no demo project at examples/${e.id}/demo/${t.id}/ — the gallery would show a gap in the grid`);
    }
  }
}

// ---------- 3. docs pages ----------
const nav = read('website/src/nav.js');
for (const t of TARGETS) {
  if (!existsSync(join(root, 'website/src/docs', `${t.doc}.md`))) {
    fail(`target "${t.id}" points at docs page "${t.doc}", which does not exist`);
  } else if (!nav.includes(`'${t.doc}'`)) {
    fail(`docs page "${t.doc}" is linked from the gallery but is not in the sidebar (website/src/nav.js)`);
  }
}

// ---------- 4. see-it-live links ----------
// A visitor reading about an exporter should never have to find the gallery on
// their own — that link is the whole point of publishing the demos.
for (const t of TARGETS) {
  const page = `website/src/docs/${t.doc}.md`;
  if (!existsSync(join(root, page))) continue;
  const body = read(page);
  const linked = EXAMPLES.some((e) => body.includes(demoPath(e.id, t.id)));
  if (!linked) {
    fail(
      `${page} links to none of its live demos — add at least one ${demoPath(EXAMPLES[0].id, t.id)} link ` +
        '("See it live"), or the exporter page is a dead end',
    );
  }
}
if (!read('website/src/layouts/Base.astro').includes("withBase('/demo/')")) {
  fail('website/src/layouts/Base.astro does not link to /demo/ — the gallery is unreachable from the site header');
}

// ---------- 5. demo READMEs ----------
// Each example's demo/README.md is a table of its projects, and it is the page
// a contributor lands on. It went a whole release cycle saying "Seven npm
// projects" with no PrimeNG row after PrimeNG shipped, because nothing was
// comparing the prose to the directory listing.
for (const example of onDisk.examples) {
  const path = `examples/${example}/demo/README.md`;
  if (!existsSync(join(root, path))) {
    fail(`${path} does not exist — every example's demo directory documents its projects`);
    continue;
  }
  const body = read(path);
  for (const demo of demos.filter((d) => d.example === example)) {
    if (!body.includes(`${demo.target}/`)) {
      fail(`${path} does not mention the ${demo.target}/ project — the table has drifted from the directory`);
    }
    if (demo.port && !body.includes(String(demo.port))) {
      fail(`${path} does not give ${demo.workspace}'s port (${demo.port})`);
    }
  }
}

// ---------- 6. CI ----------
const ci = read('.github/workflows/ci.yml');
for (const demo of demos) {
  if (!ci.includes(`- ${demo.workspace}\n`)) {
    fail(`.github/workflows/ci.yml does not build ${demo.workspace} — a demo nobody checks is a demo that breaks`);
  }
}
const matrixed = [...ci.matchAll(/^\s+- ([a-z]+-demo-[a-z-]+)$/gm)].map((m) => m[1]);
for (const workspace of matrixed) {
  if (!demos.some((d) => d.workspace === workspace)) {
    fail(`.github/workflows/ci.yml builds "${workspace}", which is not a demo workspace any more`);
  }
}
const pages = read('.github/workflows/pages.yml');
for (const script of ['demos:build', 'demos:assemble']) {
  if (!pages.includes(script)) {
    fail(`.github/workflows/pages.yml does not run \`npm run ${script}\` — the site would deploy with 32 dead links`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(`✖ demos: ${e}`);
  process.exit(1);
}
console.log(
  `✔ demos: ${demos.length} demo projects (${EXAMPLES.length} × ${TARGETS.length}) — described, documented, linked and built in CI`,
);
