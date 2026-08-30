/**
 * robots.txt — everything is public, and the sitemap is announced here because
 * that is the only discovery path that needs no search-console account.
 *
 * The raw-markdown routes and llms.txt stay crawlable on purpose: they exist
 * for agents (docs/ai-agents.md). They're simply kept out of the sitemap, which
 * is a recommendation of canonical pages, not an access control.
 */
import { origin, withBase } from '../url.js';

export function GET({ site }) {
  const base = origin(site);
  const body = `User-agent: *
Allow: /

Sitemap: ${base}${withBase('/sitemap.xml')}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
