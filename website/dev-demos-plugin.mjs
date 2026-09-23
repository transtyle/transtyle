// @ts-check
/**
 * The demos under `astro dev`, when they have been built.
 *
 * The 32 demos are separate applications. At deploy time
 * scripts/assemble-demos.mjs copies each one from demo-dist/<example>/<target>/
 * into the built site at <base>demo/<example>/<target>/ and injects the
 * switcher and the compare bridge (scripts/lib/demo-chrome.mjs). `astro dev`
 * has no such step, so the gallery's links and every compare pane pointed at
 * nothing: the compare view, the one page that is nothing but demos, showed a
 * 404 in each pane.
 *
 * This serves the same files from the same place, with the same chrome
 * injected into each demo's index.html, straight out of demo-dist/ — so after
 * one `npm run demos:build`, `npm run site:dev` shows the real thing. A demo
 * that has not been built is left to the dev server's 404, exactly as before,
 * and the switcher only links to the demos that are there. Build output is
 * untouched: this plugin only has a `configureServer` hook.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXAMPLES, TARGETS, discoverDemos } from '../scripts/lib/demos.mjs';
import { demoChrome, injectChrome } from '../scripts/lib/demo-chrome.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const from = join(root, 'demo-dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

/** @param {{ base: string }} options */
export function devDemosPlugin({ base }) {
  const baseless = base.replace(/\/$/, '');
  return {
    name: 'transtyle:dev-demos',
    /** @param {import('vite').ViteDevServer} server */
    configureServer(server) {
      if (!existsSync(from)) return;
      server.middlewares.use((req, res, next) => {
        // The dev server may already have taken `base` off the URL; accept both.
        let url = (req.url ?? '').split('?')[0];
        if (baseless && url.startsWith(`${baseless}/`)) url = url.slice(baseless.length);
        if (!url.startsWith('/demo/')) return next();
        const [example, target, ...rest] = decodeURIComponent(url.slice('/demo/'.length)).split('/');
        if (!example || !target) return next();
        const dir = join(from, example, target);
        if (!existsSync(join(dir, 'index.html'))) return next();

        let file = normalize(join(dir, ...rest));
        if (!file.startsWith(dir)) return next(); // no ../ out of the demo
        if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
        if (!existsSync(file)) return next();

        let body = readFileSync(file);
        if (file === join(dir, 'index.html')) {
          // Recomputed per request, so a demo built while the server runs
          // shows up in the switcher without a restart.
          const built = discoverDemos(root)
            .filter((d) => existsSync(join(from, d.example, d.target, 'index.html')))
            .map((d) => `${d.example}/${d.target}`);
          const chrome = demoChrome({ root, example, target, examples: EXAMPLES, targets: TARGETS, built });
          body = Buffer.from(injectChrome(body.toString('utf8'), chrome));
        }
        res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
        res.end(body);
      });
    },
  };
}
