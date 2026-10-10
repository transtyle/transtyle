/**
 * `report.json`, the per-target build report (docs/specs/validation-and-coverage.md
 * "Report format"). `compile()` writes one next to each target's files; the
 * function is public so a tool that compiles in memory (`emit: false`, as the
 * website's report viewer does for its samples) builds the very object a real
 * build would write instead of a copy of its shape.
 *
 * The shape is `reportSchema` (schema/report.schema.js), published as
 * `report/v0.json`; `scripts/check-schemas.mjs` validates every emitted report
 * against it.
 */
import { withMetadata } from './metadata.js';

/** The `$schema` every report carries. Not fetched by anything yet. */
export const REPORT_SCHEMA_ID = 'https://transtyle.dev/schemas/report/v0.json';

/**
 * @param {object} report
 * @param {string} report.target the target instance name (the config key)
 * @param {string[]} [report.config] the config files the build read, root base first (an `extends` chain); left out when not given
 * @param {object} [report.options] the instance's `options` from the config
 * @param {object[]} report.coverage the target's coverage rows
 * @param {string[]} [report.reads] the catalog slots the exporter read (a target result's `reads`);
 *   left out of the report when not given
 * @param {object} [report.normalized] the IR the target was emitted from (`compile()`'s
 *   `normalized`, or the target's own mode view): when given, each row whose `slot` has a DTCG
 *   `$description` or reaches a `$deprecated` token carries it (`description`, `deprecated`,
 *   `deprecatedBy`), read from the default mode
 * @param {object[]} [report.diagnostics] the build's diagnostics (`Diagnostics#items`)
 * @param {object[]} [report.suppressed] what `check.suppress` silenced (`Diagnostics#suppressed`)
 * @param {string[]} [report.files] the written paths, relative to the project
 * @param {object} [report.customVocabulary] the custom-vocabulary summary (issue #51), under `coverage`
 * @returns the report object, ready for `JSON.stringify`
 */
export function buildReport({ target, config, options, coverage, reads, normalized, diagnostics = [], suppressed = [], files = [], customVocabulary }) {
  const items = normalized ? withMetadata(coverage, normalized.modes[normalized.defaultMode]) : coverage;
  const counts = {};
  for (const item of items) counts[item.class] = (counts[item.class] ?? 0) + 1;
  return {
    $schema: REPORT_SCHEMA_ID,
    target,
    ...(config !== undefined ? { config } : {}),
    options: options ?? {},
    generatedBy: 'transtyle 0.1.0 (walking skeleton)',
    coverage: { counts, items, ...(customVocabulary && { customVocabulary }) },
    ...(reads !== undefined ? { reads } : {}),
    diagnostics,
    suppressed,
    files,
  };
}
