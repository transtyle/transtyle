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
    // A human label: an IR path, or prose such as `via driven roots`.
    slot: { type: 'string' },
    // The fully qualified IR paths the variable reads, when `slot` alone
    // doesn't say (a member suffix, a pair of slots). Absent: a `slot` that is
    // an IR path counts as `[slot]`.
    slots: { type: 'array', items: { type: 'string' } },
    // The target variables this one follows (a Sass `!default` chain, a
    // global custom property), each the `variable` of another row.
    via: { type: 'array', items: { type: 'string' } },
    class: { type: 'string', enum: ['native', 'derived', 'approximated', 'dropped', 'unsupported'] },
    provenance: { type: 'string', enum: ['authored', 'aliased', 'derived', 'defaulted'] },
    note: { type: 'string' },
    // Issue #94: an optional, exporter-declared key for WHAT an `unsupported`
    // row is missing ("icon.size"), so rows from different exporters can be
    // grouped by meaning instead of by note text. Read by
    // scripts/gen-catalog-signals.mjs; every key must be registered in
    // docs/findings/catalog-meanings.json.
    meaning: {
      type: 'string',
      pattern: '^[a-z][a-z0-9]*(-[a-z0-9]+)*(\\.[a-z][a-z0-9]*(-[a-z0-9]+)*)*$',
      description: 'dot-separated kebab-case segments, e.g. "icon.size"',
    },
    // Issue #30: token metadata, added by core from the default mode's entry
    // for `slot` (never by exporters). `description` is the slot's own DTCG
    // `$description`; `deprecated` (the `$deprecated` reason, or `true`) and
    // `deprecatedBy` (that token's path) are set when the slot, or a token its
    // value comes through, is deprecated. Absent otherwise.
    description: { type: 'string' },
    deprecated: { type: ['boolean', 'string'], description: 'true, or the reason given in $deprecated' },
    deprecatedBy: { type: 'string', description: 'path of the deprecated token the value comes through (may be the slot itself)' },
  },
};

/**
 * Where a diagnostic is about, when it is about something authored: the token
 * or group `path`, and the `file` (relative to the project), `line` and
 * `column` (1-based) of its key. Absent when the thing is derived or not in a
 * file (docs/specs/validation-and-coverage.md#source-locations).
 */
const location = {
  path: { type: 'string' },
  file: { type: 'string' },
  line: { type: 'integer' },
  column: { type: 'integer' },
};

const diagnostic = {
  type: 'object',
  required: ['severity', 'code', 'message'],
  additionalProperties: true,
  properties: {
    severity: { type: 'string', enum: ['error', 'warning', 'info'] },
    code: { type: 'string' },
    message: { type: 'string' },
    // AL5: optional, and deliberately separate from `message` — what is wrong
    // and what to change are different sentences, and tools consuming the
    // report (editors, CI annotations) want to place them differently.
    hint: { type: 'string' },
    ...location,
  },
};

/** A diagnostic silenced by `check.suppress`, with the reason its entry gave. */
const suppressedDiagnostic = {
  ...diagnostic,
  required: [...diagnostic.required, 'reason'],
  properties: { ...diagnostic.properties, reason: { type: 'string' } },
};

export const reportSchema = {
  type: 'object',
  required: ['target', 'generatedBy', 'coverage', 'diagnostics', 'suppressed', 'files'],
  additionalProperties: false,
  properties: {
    $schema: { type: 'string' },
    target: { type: 'string' },
    // The config files the build read, in merge order (root base first, the
    // project's own config last), relative to the project directory. One entry
    // without `extends` (docs/specs/configuration.md#inheritance-extends).
    config: { type: 'array', minItems: 1, items: { type: 'string' } },
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
    // Issue #160: the catalog slots (`semantic.*`, `component.*`) the exporter
    // read while it emitted, sorted. Optional: reports written before it lack it.
    reads: {
      type: 'array',
      items: { type: 'string', pattern: '^(semantic|component)\\.' },
      description: 'Catalog slots the exporter read while emitting, sorted (recorded by core, not declared by the exporter).',
    },
    diagnostics: { type: 'array', items: diagnostic },
    suppressed: { type: 'array', items: suppressedDiagnostic },
    files: { type: 'array', items: { type: 'string' } },
  },
};

export const reportSchemaMeta = {
  $id: 'https://transtyle.dev/schemas/report/v0.json',
  title: 'Transtyle build report (report.json)',
  description: 'Schema for a Transtyle per-target build report. See https://transtyle.dev/docs/diagnostics/.',
};
