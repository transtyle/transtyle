/**
 * /report/samples/<example>.<target>.json — the report viewer's samples as
 * static files: what `transtyle build` writes as that target's report.json
 * (src/report-samples.js builds and validates them). The viewer fetches them
 * through the same reader as a visitor's own file, and they are plain links
 * for anyone who wants a real report to look at.
 */
import { reportSamples } from '../../../report-samples.js';
import { repoRoot } from '../../../../../scripts/lib/demos.mjs';

export async function getStaticPaths() {
  const samples = await reportSamples(repoRoot());
  return samples.map((s) => ({ params: { sample: s.id }, props: { json: s.json } }));
}

export function GET({ props }) {
  return new Response(props.json, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
