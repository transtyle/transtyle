/**
 * The gallery's swatches, taken from the compiler rather than from a designer.
 *
 * Every colour, radius and typeface the demo gallery paints its preview cards
 * with is read out of a real compile of that example, in this process, at build
 * time. Nothing on the page is a hand-picked hex that resembles the output —
 * change `option.color.blue.600` in examples/acme and the gallery card moves
 * with the demos it links to, or the build fails saying which slot went away.
 *
 * That is the same rule scripts/check-doc-numbers.mjs follows, for the same
 * reason it gives: compiling asks whether the page matches the *code*, while
 * reading examples/<id>/dist/ asks whether it matches whichever build happens
 * to be on this machine — and that tree is gitignored, so in a fresh checkout
 * (CI's, every time) there is nothing there to read.
 *
 * The css-variables target is the one queried because it is the resolved
 * catalog 1:1, with no framework's naming in between — the exporter that
 * exists to be read.
 */
import { join } from 'node:path';
import { compile } from '@transtyle/core';

/** The slots a preview card needs, mapped to the custom properties that carry them. */
const SLOTS = {
  page: '--elevation-0-surface',
  surface: '--elevation-1-surface',
  text: '--color-text-base',
  muted: '--color-text-muted',
  border: '--color-border',
  primary: '--color-primary-solid',
  onPrimary: '--color-primary-on-solid',
  tint: '--color-primary-tint',
  danger: '--color-danger-solid',
  success: '--color-success-solid',
  warning: '--color-warning-solid',
  radius: '--radius-control',
  radiusCard: '--radius-container',
  font: '--font-sans',
  mono: '--font-mono',
};

/**
 * Pull one mode's block out of the emitted stylesheet.
 *
 * Deliberately anchored to a selector at the start of a line: the file's header
 * comment spells out `[data-color-scheme="dark"]` as prose on every example
 * including the single-mode ones, and a looser match reads GOV.UK — which
 * publishes no dark theme and emits no dark block — as having one.
 */
function block(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, (m) => '\\' + m);
  const start = css.search(new RegExp(`^${escaped}\\s*\\{`, 'm'));
  if (start === -1) return null;
  const body = css.slice(start, css.indexOf('\n}', start));
  const vars = {};
  for (const [, name, value] of body.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) {
    vars[name] = value.trim();
  }
  return vars;
}

const pick = (vars) =>
  vars &&
  Object.fromEntries(
    Object.entries(SLOTS)
      .map(([key, prop]) => [key, vars[prop]])
      .filter(([, value]) => value !== undefined),
  );

/**
 * Compile the four examples once per site build and return their preview themes.
 *
 * `modes` is what the example actually publishes, not what the catalog allows:
 * GOV.UK comes back light-only, which is the honest thing for the card to show
 * and a fact worth putting on the page rather than papering over.
 */
const cache = new Map();

export async function demoThemes(examples, repoRoot) {
  // Two pages want these (the gallery and the homepage strip) and a compile is
  // not free; within one build the answer cannot change.
  const key = examples.map((e) => e.id).join(',');
  if (cache.has(key)) return cache.get(key);
  const themes = {};
  for (const example of examples) {
    const result = await compile({
      cwd: join(repoRoot, 'examples', example.id),
      emit: false,
      loadExporter: async (name) => (await import(`@transtyle/exporter-${name}`)).default,
    });
    const css = result.results
      .find((r) => r.target === 'css-variables')
      ?.emitted.find((f) => f.path.endsWith('.css'))?.contents;
    if (!css) throw new Error(`demo gallery: examples/${example.id} emitted no css-variables CSS`);

    const light = pick(block(css, ':root'));
    const dark = pick(block(css, '[data-color-scheme="dark"]'));
    if (!light?.primary) {
      throw new Error(`demo gallery: examples/${example.id} has no --color-primary-solid to preview`);
    }
    themes[example.id] = { light, dark, modes: dark ? ['light', 'dark'] : ['light'] };
  }
  cache.set(key, themes);
  return themes;
}
