/**
 * The `report.json` schema — the machine-readable build report core emits per
 * target (docs/specs/validation-and-coverage.md). Source of truth for the
 * published file (scripts/gen-schemas.mjs → website/public/schemas/report/v0.json).
 * Unlike the config schema this is not enforced on user input — core *produces*
 * reports — but scripts/check-schemas.mjs validates every generated report
 * against it, so the published schema can never drift from what we actually emit.
 */

const coverageItem = {
  type: 'object',
  required: ['variable', 'slot', 'class'],
  additionalProperties: false,
  properties: {
    variable: { type: 'string' },
    slot: { type: 'string' },
    class: { type: 'string', enum: ['native', 'derived', 'approximated', 'dropped', 'unsupported'] },
    provenance: { type: 'string', enum: ['authored', 'aliased', 'derived', 'defaulted'] },
    note: { type: 'string' },
  },
};

const diagnostic = {
  type: 'object',
  required: ['severity', 'code', 'message'],
  additionalProperties: true,
  properties: {
    severity: { type: 'string', enum: ['error', 'warning', 'info'] },
    code: { type: 'string' },
    message: { type: 'string' },
  },
};

export const reportSchema = {
  type: 'object',
  required: ['target', 'generatedBy', 'coverage', 'diagnostics', 'files'],
  additionalProperties: false,
  properties: {
    $schema: { type: 'string' },
    target: { type: 'string' },
    options: { type: 'object' },
    generatedBy: { type: 'string' },
    coverage: {
      type: 'object',
      required: ['counts', 'items'],
      additionalProperties: false,
      properties: {
        counts: { type: 'object', additionalProperties: { type: 'integer' } },
        items: { type: 'array', items: coverageItem },
      },
    },
    diagnostics: { type: 'array', items: diagnostic },
    files: { type: 'array', items: { type: 'string' } },
  },
};

export const reportSchemaMeta = {
  $id: 'https://transtyle.dev/schemas/report/v0.json',
  title: 'Transtyle build report (report.json)',
  description: 'Schema for a Transtyle per-target build report. See https://transtyle.dev/docs/diagnostics/.',
};
