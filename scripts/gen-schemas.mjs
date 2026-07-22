#!/usr/bin/env node
/**
 * Publish the config + report schemas as real draft-2020-12 JSON Schema files
 * (audit A7 — the `$schema` URLs Transtyle emits were fictional). The schema
 * *objects* are the source of truth in `@transtyle/core` (used at runtime by
 * validate.js); this script wraps each with draft/$id/title metadata and writes
 * it to website/public/schemas/, from where the deployed site serves it at the
 * `$id` URL. So `"$schema": "https://transtyle.dev/schemas/config/v0.json"` in a
 * user's config resolves to a real, matching schema once the site is live (R5).
 *
 * Run: node scripts/gen-schemas.mjs   (also: npm run gen:schemas).
 * scripts/check-schemas.mjs fails if the committed files drift from this output.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configSchema, configSchemaMeta } from '../packages/core/src/schema/config.schema.js';
import { reportSchema, reportSchemaMeta } from '../packages/core/src/schema/report.schema.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRAFT = 'https://json-schema.org/draft/2020-12/schema';

/** Wrap a source-of-truth schema object with the metadata a published file needs. */
export function publishable(schema, meta) {
  return { $schema: DRAFT, ...meta, ...schema };
}

const OUTPUTS = [
  { rel: 'website/public/schemas/config/v0.json', doc: publishable(configSchema, configSchemaMeta) },
  { rel: 'website/public/schemas/report/v0.json', doc: publishable(reportSchema, reportSchemaMeta) },
];

export function render(doc) {
  return JSON.stringify(doc, null, 2) + '\n';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const { rel, doc } of OUTPUTS) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, render(doc));
    console.log(`✔ wrote ${rel}`);
  }
}

export { OUTPUTS };
