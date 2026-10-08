#!/usr/bin/env node
/**
 * GENERATOR (not a checker): re-records the README's hero GIF.
 *
 *   media/demo.gif   Acme and Cathode, one Bootstrap demo each, side by side
 *
 * Usage: npm run demo:record [-- --skip-build]
 *
 * The GIF is a recording of the real thing, so it is re-recorded by hand when the demos' look
 * changes; nothing in CI runs it (it needs a browser) and no checker reads it. Nothing is
 * installed by it: it needs `npm ci`, `npm ci --prefix scripts/record-demo` (the ffmpeg binary, kept
 * out of the workspaces so CI never downloads it) and `npx playwright install chromium`, once each.
 *
 * How: builds the two demo projects the shot needs (`acme-demo-bootstrap`,
 * `cathode-demo-bootstrap`; each compiles its own tokens first), serves their `dist/` folders on two
 * free ports, writes a small page to the OS temp directory with one frame per design system, drives
 * it with Playwright (Chromium) at a fixed viewport, and encodes the video with the ffmpeg binary
 * from `ffmpeg-static` (installed under `scripts/record-demo/`; palettegen; widths tried in turn until the file is under 2 MB).
 *
 * Why two iframes and not the website's compare view: that view needs all 32 demos assembled
 * (`npm run demos:all`, several minutes); this builds two and is reproducible in about a minute.
 * Same markup in both frames, so what differs is what the compiler emitted.
 *
 * The storyboard has no text overlay (the demo's own chrome bar is the only text) and ends where
 * it starts, so the loop is seamless. Temporary files live in the OS temp directory.
 */
import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
// ffmpeg-static downloads its binary from GitHub releases when installed. It lives in its own
// package, outside the workspaces, so the root `npm ci` (every CI job) never fetches it.
let ffmpegPath;
try {
  ffmpegPath = createRequire(join(here, 'record-demo/'))('ffmpeg-static');
} catch {
  console.error('ffmpeg-static is not installed. Run `npm ci --prefix scripts/record-demo` once, then retry.');
  process.exit(1);
}
const OUT_GIF = join(root, 'media/demo.gif');
const GIF_LIMIT = 2 * 1024 * 1024;
const VIEWPORT = { width: 1280, height: 720 };
const GAP = 4;
const DEMOS = [
  { workspace: 'acme-demo-bootstrap', dir: 'examples/acme/demo/bootstrap' },
  { workspace: 'cathode-demo-bootstrap', dir: 'examples/cathode/demo/bootstrap' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${r.status})`);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json',
};

/** Serves a folder on a free port (port 0), no dependency. */
function serve(dir) {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(dir, path);
    if (path.endsWith('/')) file = join(file, 'index.html');
    if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, port: server.address().port })));
}

if (!process.argv.includes('--skip-build')) {
  for (const d of DEMOS) run('npm', ['run', 'build', '-w', d.workspace]);
}
for (const d of DEMOS) {
  if (!existsSync(join(root, d.dir, 'dist/index.html'))) throw new Error(`${d.dir}/dist is missing: run without --skip-build`);
}

mkdirSync(dirname(OUT_GIF), { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'transtyle-demo-'));
const servers = [];
let browser;
try {
  const ports = [];
  for (const d of DEMOS) {
    const s = await serve(join(root, d.dir, 'dist'));
    servers.push(s.server);
    ports.push(s.port);
  }
  const paneWidth = (VIEWPORT.width - GAP) / 2;
  const frames = ports
    .map((p) => `<iframe src="http://127.0.0.1:${p}/" title="demo ${p}" style="width:${paneWidth}px"></iframe>`)
    .join('');
  const pageFile = join(tmp, 'index.html');
  writeFileSync(
    pageFile,
    `<!doctype html><meta charset="utf-8"><title>Transtyle demo</title><style>
html,body{margin:0;height:100%;background:#808080;overflow:hidden}
body{display:flex;gap:${GAP}px}iframe{border:0;height:100%;flex:none}</style>${frames}`,
  );

  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir: tmp, size: VIEWPORT },
  });
  const t0 = Date.now();
  const page = await context.newPage();
  await page.goto(`file://${pageFile}`);
  const panes = page.frames().filter((f) => f !== page.mainFrame());
  for (const f of panes) {
    await f.waitForSelector('#demo-mode');
    await f.evaluate(() => document.fonts.ready);
  }
  const toggle = async () => {
    for (const f of panes) {
      const b = await f.locator('#demo-mode').boundingBox();
      const frameBox = await (await f.frameElement()).boundingBox();
      await page.mouse.move(frameBox.x + b.x + b.width / 2, frameBox.y + b.y + b.height / 2, { steps: 14 });
      await f.locator('#demo-mode').click();
      await f.evaluate(() => document.activeElement?.blur()); // no lingering focus state: the loop must close cleanly
    }
  };
  // Smooth scroll of both panes together, eased, to a fraction of the page.
  const scrollTo = (fraction, ms) =>
    Promise.all(
      panes.map((f) =>
        f.evaluate(
          ([fr, dur]) =>
            new Promise((done) => {
              const el = document.scrollingElement;
              const from = el.scrollTop;
              const to = (el.scrollHeight - innerHeight) * fr;
              const t = performance.now();
              const step = (now) => {
                const k = Math.min(1, (now - t) / dur);
                el.scrollTop = from + (to - from) * (k * k * (3 - 2 * k));
                k < 1 ? requestAnimationFrame(step) : done();
              };
              requestAnimationFrame(step);
            }),
          [fraction, ms],
        ),
      ),
    );
  const home = { x: VIEWPORT.width / 2, y: VIEWPORT.height - 12 };
  // Park the mouse over the neutral gap between the panes. A hover left on a button would not
  // match the first frame; passing through a pane's body first makes Chromium drop it.
  const park = async () => {
    await page.mouse.move(VIEWPORT.width / 4, VIEWPORT.height / 2, { steps: 6 });
    await page.mouse.move(home.x, home.y, { steps: 8 });
  };
  await page.mouse.move(home.x, home.y);
  await sleep(600);

  // Storyboard (about 7 s). Mouse and scroll only; ends where it starts, so the loop is seamless.
  const start = Date.now() - t0;
  await sleep(600); // idle on both panes
  await scrollTo(0.6, 1700); // both panes scroll down: form, card, table
  await sleep(300);
  await toggle(); // each pane's own mode toggle: Acme goes dark, Cathode flips to its light
  await park();
  await sleep(900);
  await toggle(); // back to the original modes
  await park();
  await scrollTo(0, 1400); // back to the top
  await sleep(600); // idle again
  const end = Date.now() - t0;

  const video = page.video();
  await context.close();
  const webm = await video.path();

  const trim = ['-ss', (start / 1000).toFixed(2), '-t', ((end - start) / 1000).toFixed(2)];
  for (const [width, fps, colors] of [[800, 10, 64], [720, 10, 64], [640, 10, 96], [560, 10, 64]]) {
    const filter = `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`;
    run(ffmpegPath, ['-y', '-loglevel', 'error', ...trim, '-i', webm, '-filter_complex', filter, '-loop', '0', OUT_GIF]);
    const size = statSync(OUT_GIF).size;
    console.log(`gif ${width}px @${fps}fps, ${colors} colors: ${(size / 1024).toFixed(0)} KB`);
    if (size <= GIF_LIMIT) break;
  }
  const size = statSync(OUT_GIF).size;
  if (size > GIF_LIMIT) throw new Error('GIF is still over 2 MB at the smallest size');
  console.log(`media/demo.gif: ${(size / 1024).toFixed(0)} KB, ${((end - start) / 1000).toFixed(1)} s`);
} finally {
  await browser?.close();
  for (const s of servers) s.close();
  rmSync(tmp, { recursive: true, force: true });
}
