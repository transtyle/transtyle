/**
 * The declarative mapping schema (`*.mapping.json`, issue #82, ADR-0017): a
 * JSON table that is an exporter without code. Source of truth for the
 * runtime validator (declarative.js) and the published editor schema
 * (scripts/gen-schemas.mjs → website/public/schemas/mapping/v0.json), in the
 * JSON Schema subset validate.js understands.
 *
 * What the schema can't say is checked by `validateMapping()` next to it: a
 * variable name that doesn't fit its template (`--x` for CSS, `$x` for Sass,
 * `@x` for Less), a variable repeated in one file, `blocks` outside a CSS
 * file, a block naming more than one dimension, a `part` on a slot whose type
 * has no members. Spec: docs/specs/declarative-mapping.md.
 */

export const MAPPING_TEMPLATES = ['css-custom-properties', 'scss-variables', 'less-variables', 'json'];
export const MAPPING_FORMATS = ['oklch', 'hex', 'hsl-triplet'];
/** What a mapping may claim for a row that resolved: the other two classes are the runtime's to give. */
export const MAPPING_CLASSES = ['native', 'derived', 'approximated'];

const modeSelection = {
  type: 'object',
  additionalProperties: { type: 'string', minLength: 1 },
  description: 'one value per mode dimension, e.g. { "color-scheme": "dark" }',
};

const row = {
  type: 'object',
  required: ['variable', 'slot'],
  additionalProperties: false,
  properties: {
    variable: { type: 'string', minLength: 1, description: 'the name written to the file, sigil included: --x, $x, @x, or a JSON key' },
    slot: { type: 'string', pattern: '^(semantic|component)\\.[A-Za-z0-9_.-]+$', description: 'a semantic.* or component.* slot path' },
    part: { type: 'string', minLength: 1, description: 'a member of a composite value: fontSize, fontWeight, lineHeight, fontFamily, color, width…' },
    format: { type: 'string', enum: MAPPING_FORMATS },
    class: { type: 'string', enum: MAPPING_CLASSES },
    note: { type: 'string' },
  },
};

const block = {
  type: 'object',
  required: ['mode', 'selector'],
  additionalProperties: false,
  properties: {
    mode: modeSelection,
    selector: { type: 'string', minLength: 1 },
  },
};

const file = {
  type: 'object',
  required: ['path', 'template', 'rows'],
  additionalProperties: false,
  properties: {
    path: { type: 'string', pattern: '^(?!/)(?!.*(^|/)\\.\\.(/|$))[^\\\\]+$', description: 'a relative path inside the target output, no ".." segment' },
    template: { type: 'string', enum: MAPPING_TEMPLATES },
    header: { type: 'array', items: { type: 'string' }, description: 'lines written first, verbatim; {projectName} is the one placeholder' },
    selector: { type: 'string', minLength: 1, description: 'css-custom-properties: the base block selector (default :root)' },
    mode: modeSelection,
    blocks: { type: 'array', items: block },
    comments: { type: 'string', enum: ['provenance'] },
    rows: { type: 'array', minItems: 1, items: row },
  },
};

export const mappingSchema = {
  type: 'object',
  required: ['name', 'files'],
  additionalProperties: false,
  properties: {
    $schema: { type: 'string' },
    name: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$', description: 'the exporter name, lowercase with dashes' },
    description: { type: 'string' },
    files: { type: 'array', minItems: 1, items: file },
  },
};

/** Metadata added only to the *published* file (gen-schemas.mjs), not used at runtime. */
export const mappingSchemaMeta = {
  $id: 'https://transtyle.dev/schemas/mapping/v0.json',
  title: 'Transtyle declarative mapping (*.mapping.json)',
  description: 'A JSON mapping table that is a Transtyle exporter without code. See https://transtyle.dev/docs/write-an-exporter/#start-declarative-a-mapping-table.',
};
