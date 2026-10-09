/**
 * The examples, compiled in-process: the data every generated docs view reads.
 *
 * A generated page that quotes the exporters has to be built from a compile,
 * never from an example's `dist/` (gitignored, so absent on a fresh checkout
 * and stale on a working one — see check-doc-numbers.mjs for how that failed).
 * This is that compile, once: `emit: false`, every configured target, each
 * exporter loaded from its workspace source rather than from node_modules, and
 * a compile with errors refused instead of quietly yielding empty coverage.
 *
 * Pass `loadExporter` to wrap the local loader (a recording loader, say) and
 * `targets` to narrow the run; any other option goes to core's `compile()`.
 *
 * Shared by: scripts/gen-catalog-signals.mjs (issue #94) and
 * scripts/gen-matrix.mjs (issue #95, through its recording loader).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { EXAMPLES } from './demos.mjs';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** An official exporter, straight from `packages/exporter-<name>/src`. */
export const localExporter = async (name) =>
  (await import(pathToFileURL(join(root, 'packages', `exporter-${name}`, 'src/index.js')).href))
    .default;

/** An example's config, as committed. */
export const exampleConfig = (example) =>
  JSON.parse(readFileSync(join(root, 'examples', example, 'transtyle.config.json'), 'utf8'));

/**
 * Target instance → exporter name for one example (`shadcn-v3` → `shadcn`).
 * Two instances of one exporter are one witness, not two, so anything that
 * counts exporters goes through this.
 */
export function exportersOf(example) {
  const targets = exampleConfig(example).targets ?? {};
  return new Map(Object.entries(targets).map(([name, t]) => [name, t.exporter ?? name]));
}

/** Compile one example; throws, naming every error, when it doesn't compile. */
export async function compileExample(example, { loadExporter = localExporter, ...options } = {}) {
  const { compile } = await import(pathToFileURL(join(root, 'packages/core/src/index.js')).href);
  const result = await compile({
    cwd: join(root, 'examples', example),
    emit: false,
    loadExporter,
    ...options,
  });
  const errors = result.diagnostics?.errors ?? [];
  if (errors.length > 0) {
    throw new Error(
      `examples/${example} does not compile:\n` +
        errors.map((d) => `    ${d.code} ${d.message}`).join('\n'),
    );
  }
  return result;
}

/** Every example, in the order the docs present them (`EXAMPLES`). */
export async function compileExamples(options = {}) {
  const out = new Map();
  for (const { id } of EXAMPLES) out.set(id, await compileExample(id, options));
  return out;
}
