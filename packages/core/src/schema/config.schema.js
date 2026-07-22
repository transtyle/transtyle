/**
 * The `transtyle.config.json` schema — source of truth for BOTH the runtime
 * validator (validate.js, used in compile()) and the published editor schema
 * (scripts/gen-schemas.mjs → website/public/schemas/config/v0.json). Written in
 * the JSON Schema subset validate.js understands; scripts/check-schemas.mjs
 * proves the published file and this object stay identical.
 *
 * Matches docs/specs/configuration.md. `additionalProperties: false` at the top
 * level and inside each target is what makes a typo an error (audit A8) instead
 * of a silently-ignored key.
 *
 * NOTE: exporter `options` are intentionally `additionalProperties: true` here —
 * each exporter validates its own options against its own schema at load time
 * (index.js + exporter `optionsSchema`), because the shape depends on which
 * exporter the instance selects, which this static schema can't know.
 */

const tokenLayer = {
  anyOf: [
    { type: 'string' },
    {
      type: 'object',
      required: ['files', 'mode'],
      additionalProperties: false,
      properties: {
        files: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
        mode: { type: 'object', additionalProperties: { type: 'string' } },
      },
    },
  ],
};

const modeDimension = {
  type: 'object',
  required: ['values'],
  additionalProperties: false,
  properties: {
    values: { type: 'array', minItems: 1, items: { type: 'string' } },
    default: { type: 'string' },
  },
};

const target = {
  type: 'object',
  additionalProperties: false,
  properties: {
    output: { type: 'string' },
    exporter: { type: 'string' },
    options: { type: 'object' }, // validated per-exporter at load time; see note above
  },
};

export const configSchema = {
  type: 'object',
  required: ['tokens'],
  additionalProperties: false,
  properties: {
    $schema: { type: 'string' },
    name: { type: 'string' },
    tokens: { type: 'array', minItems: 1, items: tokenLayer },
    modes: { type: 'object', additionalProperties: modeDimension },
    derivation: {
      type: 'object',
      additionalProperties: false,
      properties: {
        rules: { type: 'string' },
        autoDark: { type: 'boolean' },
        require: { type: 'array', items: { type: 'string' } },
      },
    },
    targets: { type: 'object', additionalProperties: target },
    check: {
      type: 'object',
      additionalProperties: false,
      properties: {
        failOn: { type: 'string', enum: ['error', 'warning', 'approximation'] },
        contrast: {
          type: 'object',
          additionalProperties: false,
          properties: { standard: { type: 'string', enum: ['wcag21-aa', 'wcag21-aaa'] } },
        },
      },
    },
  },
};

/** Metadata added only to the *published* file (gen-schemas.mjs), not used at runtime. */
export const configSchemaMeta = {
  $id: 'https://transtyle.dev/schemas/config/v0.json',
  title: 'Transtyle config (transtyle.config.json)',
  description: 'Schema for a Transtyle project configuration file. See https://transtyle.dev/docs/configuration/.',
};
