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

import { COMPLETENESS_LEVELS } from '../completeness.js';

const tokenLayer = {
  anyOf: [
    { type: 'string' },
    {
      type: 'object',
      required: ['files'],
      // A bare `{ files }` is just a string glob: the object form needs a
      // reason to exist, a `mode` scope or an `override` flag.
      anyOf: [{ required: ['mode'] }, { required: ['override'] }],
      additionalProperties: false,
      properties: {
        files: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
        mode: { type: 'object', additionalProperties: { type: 'string' } },
        override: { enum: [true, 'extend'] },
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
    // Per-target subset of the project's mode matrix: { <dimension>: [<value>, ...] }.
    // Dimension/value names are checked against the project's `modes` in compile()
    // (TST1308), which this static schema can't see.
    modes: { type: 'object', additionalProperties: { type: 'array', minItems: 1, items: { type: 'string' } } },
  },
};

const bindingRule = {
  type: 'object',
  required: ['slot', 'from'],
  additionalProperties: false,
  properties: {
    slot: { type: 'string' },
    from: { type: 'string' },
    roles: { type: 'array', minItems: 1, items: { type: 'string' } },
    required: { type: 'boolean' },
    description: { type: 'string' },
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
    bindings: { type: 'array', items: bindingRule },
    derivation: {
      type: 'object',
      additionalProperties: false,
      properties: {
        rules: { type: 'string' },
        autoDark: { type: 'boolean' },
        // A token path, or `completeness:<level>` (completeness.js), which expands to that level's slots.
        require: {
          type: 'array',
          items: {
            type: 'string',
            pattern: `^(?!completeness:)|^completeness:(${COMPLETENESS_LEVELS.join('|')})$`,
            description: `a token path, or one of ${COMPLETENESS_LEVELS.map((l) => `completeness:${l}`).join(', ')}`,
          },
        },
      },
    },
    units: {
      type: 'object',
      additionalProperties: false,
      properties: {
        remBase: {
          type: 'string',
          pattern: '^(?=.*[1-9])\\d+(\\.\\d+)?px$',
          description: 'What one rem is worth, as a positive px length such as "16px" (the default).',
        },
      },
    },
    targets: { type: 'object', additionalProperties: target },
    check: {
      type: 'object',
      additionalProperties: false,
      properties: {
        failOn: { type: 'string', enum: ['error', 'warning', 'approximation'] },
        // The level the authoring summary line and `check --json` report on (docs/specs/cli.md). Never changes the exit code.
        completeness: { type: 'string', enum: [...COMPLETENESS_LEVELS] },
        // Silence a known warning or info with a reason (docs/specs/validation-and-coverage.md#suppressions).
        suppress: {
          type: 'array',
          items: {
            type: 'object',
            required: ['code', 'reason'],
            additionalProperties: false,
            properties: {
              code: { type: 'string', pattern: '^TST[0-9]{4}$', description: 'a diagnostic code such as TST1305' },
              // An exact token path, or a prefix ending in `.*`; no other wildcard.
              path: { type: 'string', pattern: '^[^*]+(\\.\\*)?$', description: 'an exact token path, or a prefix ending in .*' },
              reason: { type: 'string', minLength: 1, pattern: '\\S' },
            },
          },
        },
        contrast: {
          type: 'object',
          additionalProperties: false,
          properties: { standard: { type: 'string', enum: ['wcag21-aa', 'wcag21-aaa'] } },
        },
        hygiene: {
          type: 'object',
          additionalProperties: false,
          properties: {
            unusedOption: { type: 'string', enum: ['info', 'warning', 'off'] },
            duplicateOption: { type: 'string', enum: ['info', 'warning', 'off'] },
          },
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
