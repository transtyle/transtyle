/**
 * One in-memory compile per example, per site build.
 *
 * Several pages read a compile of the examples: the demo gallery and the
 * homepage (src/demo-themes.js) and the report viewer's samples
 * (src/report-samples.js). A compile is not free, and within one build the
 * answer cannot change, so each example is compiled once here and every page
 * shares the result.
 *
 * Compiled, never read from examples/<id>/dist/: that tree is gitignored, so a
 * fresh checkout (CI's, every time) has nothing there, and a local one may hold
 * a build that predates the change under test (CONTRIBUTING.md, the rule every
 * checker follows).
 */
import { join } from 'node:path';
import { compile } from '@transtyle/core';

const loadExporter = async (name) => (await import(`@transtyle/exporter-${name}`)).default;

const cache = new Map();

/**
 * `compile({ emit: false })` of examples/<id>, with its `cwd`. Memoized as a
 * promise, so two pages asking at once still share one compile.
 */
export function compileExample(id, repoRoot) {
  const cwd = join(repoRoot, 'examples', id);
  if (!cache.has(cwd)) {
    cache.set(
      cwd,
      compile({ cwd, emit: false, loadExporter }).then((result) => ({ cwd, ...result })),
    );
  }
  return cache.get(cwd);
}
