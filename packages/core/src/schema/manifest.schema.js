/**
 * The `transtyle-manifest.json` schema — the emitted-file manifest core writes
 * in each target's output directory (src/manifest.js, issue #10). Source of
 * truth for the published file (scripts/gen-schemas.mjs →
 * website/public/schemas/manifest/v0.json). Core validates a manifest against
 * it before trusting it for drift detection, and scripts/check-schemas.mjs
 * validates every manifest the examples emit.
 */

export const MANIFEST_SCHEMA_URL = 'https://transtyle.dev/schemas/manifest/v0.json';

export const manifestSchema = {
  type: 'object',
  required: ['target', 'algorithm', 'files'],
  additionalProperties: false,
  properties: {
    $schema: { type: 'string' },
    // The target instance (the config key) that wrote this directory.
    target: { type: 'string' },
    algorithm: { type: 'string', enum: ['sha256'] },
    // Path inside the output directory (always `/`) → hex sha256 of the file's
    // text with CRLF normalized to LF. `report.json` and the manifest itself are
    // not listed.
    files: {
      type: 'object',
      additionalProperties: {
        type: 'string',
        pattern: '^[0-9a-f]{64}$',
        description: 'a lowercase hex sha256 digest',
      },
    },
  },
};

export const manifestSchemaMeta = {
  $id: MANIFEST_SCHEMA_URL,
  title: 'Transtyle emitted-file manifest (transtyle-manifest.json)',
  description: 'Schema for the per-target manifest of the files a Transtyle build wrote and their content hashes, used for drift detection. See https://transtyle.dev/docs/cli/.',
};
