/**
 * The report viewer's samples: one `report.json` per example × configured
 * target, built at site build time.
 *
 * Each is `buildReport()` over an in-memory compile (src/compiled.js), with
 * `files` computed the way `compile()` computes them, so a sample is the file
 * `npx transtyle build <target> --cwd examples/<id>` writes, byte for byte. The
 * list comes from each example's own config (Acme also builds `shadcn-v3`), not
 * from a list kept here.
 *
 * Every sample is validated against the report schema as it is built: a report
 * that drifts from its published schema fails `npm run site:build`, here,
 * rather than in a visitor's browser.
 */
import { join, relative, resolve } from 'node:path';
import { buildReport } from '@transtyle/core';
import { validate } from '../../packages/core/src/schema/validate.js';
import { reportSchema } from '../../packages/core/src/schema/report.schema.js';
import { EXAMPLES } from '../../scripts/lib/demos.mjs';
import { compileExample } from './compiled.js';

let samples;

/**
 * @returns {Promise<Array<{ id: string, example: string, exampleTitle: string, target: string, report: object, json: string }>>}
 *   `id` is `<example>.<target>` (`acme.bootstrap`), the viewer's `?sample=`
 */
export function reportSamples(repoRoot) {
  samples ??= build(repoRoot);
  return samples;
}

async function build(repoRoot) {
  const list = [];
  for (const example of EXAMPLES) {
    const { cwd, config, diagnostics, results, normalized } = await compileExample(example.id, repoRoot);
    for (const r of results) {
      const targetConfig = config.targets[r.target] ?? {};
      const outDir = resolve(cwd, targetConfig.output ?? `dist/${r.target}`);
      // The exporter's files, as compile() lists them: a report doesn't list itself.
      const files = r.emitted.map((f) => relative(cwd, join(outDir, f.path)));
      const report = buildReport({
        target: r.target,
        options: targetConfig.options,
        coverage: r.coverage,
        reads: r.reads,
        // Rows gain the slot's $description / $deprecated from the IR, as in a build.
        normalized,
        diagnostics: diagnostics.items,
        suppressed: diagnostics.suppressed,
        files,
      });
      const errors = validate(report, reportSchema);
      if (errors.length > 0) {
        throw new Error(
          `report viewer: the ${example.id}.${r.target} sample does not match the report schema:\n` +
            errors.slice(0, 10).map((e) => `  ${e.path}: ${e.message}`).join('\n'),
        );
      }
      list.push({
        id: `${example.id}.${r.target}`,
        example: example.id,
        exampleTitle: example.title,
        target: r.target,
        report,
        // What compile() writes to disk: two-space JSON and a final newline.
        json: JSON.stringify(report, null, 2) + '\n',
      });
    }
  }
  if (list.length === 0) throw new Error('report viewer: no sample report was built');
  return list;
}
