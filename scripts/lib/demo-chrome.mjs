/**
 * The chrome that turns 32 separate builds into one browsable exhibit.
 *
 * Every hosted demo gets a small pill in its bottom-left corner that opens a
 * switcher: jump to the same page in another design system (Acme → Carbon,
 * Bootstrap stays), or to another target in the same design system. That
 * cross-axis move is the whole argument of the demo harness — the markup is
 * byte-identical across examples (scripts/check-demo-parity.mjs proves it), so
 * everything that changes when you switch columns is the design system and
 * nothing else. Without a switcher, seeing that means finding the gallery,
 * going back, and clicking the neighbouring cell.
 *
 * Three constraints shaped how this is built:
 *
 *   It is injected at *assembly* time, never checked into the demos. The demo
 *   projects are supposed to be honest, copyable examples of consuming
 *   `dist/` — a navigation widget for a website they know nothing about has no
 *   business in the file a reader is meant to copy. It would also have to be
 *   byte-identical across all four examples to satisfy the parity checker,
 *   while needing to name the example it is in. Hosting concern, hosting layer.
 *
 *   It lives in a shadow root. It is dropped into pages that ship Bootstrap,
 *   Tailwind, PrimeNG and Storybook's own manager CSS; `.btn` and `.panel` are
 *   spoken for several times over in there. A shadow root is the only way to be
 *   sure the widget looks the same in all 32 and changes none of them.
 *
 *   Every link it emits is relative. The demos sit at
 *   <base>/demo/<example>/<target>/, and the base moves — it is /transtyle/
 *   today and '/' when transtyle.dev exists. `../../<example>/<target>/`
 *   survives that move without this file knowing anything about deployment.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The header mark, from the one file every brand asset is rendered from. */
const markSvg = (root) =>
  readFileSync(join(root, 'brand', 'transtyle-mark.svg'), 'utf8')
    .replace(/<\?xml[^>]*>/, '')
    .replace(' role="img" aria-label="Transtyle"', ' aria-hidden="true" focusable="false"')
    .replace(/\s*<title>[^<]*<\/title>/, '')
    .replace(' width="400" height="400"', '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * JSON safe to embed in an inline <script>.
 *
 * `</script>` inside a string literal ends the element — the browser is
 * parsing HTML, not JavaScript, and does not care that it is quoted. The demo
 * blurbs are prose written by hand, so this is a real hazard rather than a
 * ritual, and `<!--` closes the same hole from the other side.
 */
const embed = (value) =>
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e');

/**
 * The markup to inject before </body>.
 *
 * @param {object} o
 * @param {string} o.root        repo root (for the brand mark)
 * @param {string} o.example     example id this build belongs to
 * @param {string} o.target      target id this build belongs to
 * @param {object[]} o.examples  EXAMPLES from lib/demos.mjs
 * @param {object[]} o.targets   TARGETS from lib/demos.mjs
 * @param {string[]} o.built     "<example>/<target>" pairs that actually exist
 */
export function demoChrome({ root, example, target, examples, targets, built }) {
  const here = examples.find((e) => e.id === example);
  const what = targets.find((t) => t.id === target);
  const data = {
    example,
    target,
    exampleTitle: here?.title ?? example,
    targetTitle: what?.title ?? target,
    stack: what?.stack ?? '',
    doc: what?.doc ?? '',
    unaffiliated: here?.unaffiliated ?? null,
    examples: examples.map((e) => ({ id: e.id, title: e.title, kicker: e.kicker })),
    targets: targets.map((t) => ({ id: t.id, title: t.title })),
    built,
  };

  return `
<!-- Injected by scripts/assemble-demos.mjs — not part of the demo project. -->
<script>
(function () {
  var D = ${embed(data)};
  var MARK = ${embed(markSvg(root))};
  var host = document.createElement('div');
  host.id = 'transtyle-demo-chrome';
  // The host is the only thing this widget adds to the page's own DOM, and
  // the only positioned box in the widget: everything inside the shadow root
  // lays out normally within it. Nesting a second fixed-position element in
  // here resolved its offsets against this zero-height box rather than the
  // viewport, which is how the open panel ended up above the top of the screen.
  host.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:2147483647';
  var s = host.attachShadow({ mode: 'open' });

  var css = \`
    * { box-sizing: border-box; }
    /* Inherited text properties cross the shadow boundary — Cathode's demo
       sets uppercase and wide tracking on body text, and without these the
       switcher quietly joins in. Everything else is blocked by the boundary. */
    .root {
      font: 500 13px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      color: #e8e9f2; text-transform: none; letter-spacing: normal; text-align: left;
      direction: ltr; word-spacing: normal; text-indent: 0; visibility: visible;
      display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
    }
    button { font: inherit; cursor: pointer; }
    .pill {
      display: flex; align-items: center; gap: 8px;
      padding: 7px 12px 7px 8px; border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.16);
      background: rgba(14,16,32,0.82);
      -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
      color: #e8e9f2; box-shadow: 0 4px 20px rgba(0,0,0,0.35);
      transition: border-color .15s, transform .15s;
    }
    .pill:hover { border-color: rgba(255,255,255,0.34); transform: translateY(-1px); }
    .pill svg { width: 18px; height: 18px; border-radius: 4px; display: block; }
    .pill b { font-weight: 650; }
    .pill .sep { opacity: .45; }
    .pill .caret { opacity: .55; font-size: 10px; margin-left: 2px; }
    .panel {
      width: min(92vw, 340px); max-height: min(78vh, 620px); overflow: auto;
      border-radius: 14px; padding: 14px;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(14,16,32,0.94);
      -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);
      box-shadow: 0 18px 50px rgba(0,0,0,0.5);
    }
    .head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
    .kicker { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; opacity: .55; font-weight: 700; }
    .close { background: none; border: 0; color: inherit; opacity: .55; font-size: 16px; line-height: 1; padding: 2px 4px; }
    .close:hover { opacity: 1; }
    .now { font-size: 15px; font-weight: 650; margin: 6px 0 2px; letter-spacing: -.01em; }
    .sub { font-size: 12px; opacity: .6; margin-bottom: 12px; }
    .label { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; opacity: .5; font-weight: 700; margin: 12px 0 6px; }
    .grid { display: grid; gap: 5px; }
    .grid.ex { grid-template-columns: 1fr 1fr; }
    .grid.tg { grid-template-columns: 1fr 1fr; }
    .opt {
      display: block; text-decoration: none; color: #dfe1ee;
      border: 1px solid rgba(255,255,255,0.12); border-radius: 9px;
      padding: 7px 9px; font-size: 12.5px; background: rgba(255,255,255,0.03);
      transition: background .12s, border-color .12s;
    }
    .opt:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.28); }
    .opt small { display: block; font-size: 10px; opacity: .5; font-weight: 500; }
    .opt[aria-current] {
      border-color: #8f9cff; background: rgba(120,135,255,0.18); color: #fff;
    }
    .opt[data-missing] { opacity: .32; pointer-events: none; }
    .foot { margin-top: 14px; padding-top: 11px; border-top: 1px solid rgba(255,255,255,0.1); display: grid; gap: 6px; }
    .foot a { color: #b9c0ff; text-decoration: none; font-size: 12px; }
    .foot a:hover { text-decoration: underline; }
    .note {
      margin-top: 11px; padding: 8px 10px; border-radius: 9px; font-size: 11px; line-height: 1.5;
      background: rgba(255,190,80,0.1); border: 1px solid rgba(255,190,80,0.24); color: #ffd9a1;
    }
    @media print { .root { display: none; } }
  \`;

  var wrap = document.createElement('div');
  wrap.className = 'root';

  // Relative, so the widget never learns the deploy path: from
  // /demo/<example>/<target>/ two levels up is /demo/, three is the site root.
  var demo = function (ex, tg) { return '../../' + ex + '/' + tg + '/'; };
  var site = function (path) { return '../../../' + path; };
  var has = function (ex, tg) { return D.built.indexOf(ex + '/' + tg) !== -1; };
  var esc = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };

  var opts = function (list, kind) {
    return list.map(function (item) {
      var ex = kind === 'example' ? item.id : D.example;
      var tg = kind === 'example' ? D.target : item.id;
      var current = item.id === (kind === 'example' ? D.example : D.target);
      return '<a class="opt" href="' + demo(ex, tg) + '"' +
        (current ? ' aria-current="page"' : '') +
        (has(ex, tg) ? '' : ' data-missing') + '>' + esc(item.title) +
        (item.kicker ? '<small>' + esc(item.kicker) + '</small>' : '') + '</a>';
    }).join('');
  };

  wrap.innerHTML =
    '<div class="panel" hidden>' +
      '<div class="head"><span class="kicker">Transtyle demo</span>' +
      '<button class="close" type="button" aria-label="Close switcher">✕</button></div>' +
      '<div class="now">' + esc(D.exampleTitle) + ' × ' + esc(D.targetTitle) + '</div>' +
      '<div class="sub">' + esc(D.stack) + ' — the same page, compiled from ' + esc(D.exampleTitle) + '\\u2019s tokens.</div>' +
      '<div class="label">Same page, other design system</div>' +
      '<div class="grid ex">' + opts(D.examples, 'example') + '</div>' +
      '<div class="label">Same design system, other target</div>' +
      '<div class="grid tg">' + opts(D.targets, 'target') + '</div>' +
      (D.unaffiliated
        ? '<div class="note">An independent demonstration of Transtyle. Not affiliated with, endorsed by, or produced by ' + esc(D.unaffiliated) + '.</div>'
        : '') +
      '<div class="foot">' +
        '<a href="' + site('demo/') + '">← All 32 demos</a>' +
        (D.doc ? '<a href="' + site('docs/' + D.doc + '/') + '">How the ' + esc(D.targetTitle) + ' target works →</a>' : '') +
        '<a href="https://github.com/transtyle/transtyle/tree/main/examples/' + D.example + '/demo/' + D.target + '" rel="noopener">Source of this demo →</a>' +
      '</div>' +
    '</div>' +
    '<button class="pill" type="button" aria-expanded="false">' + MARK +
      '<span><b>' + esc(D.exampleTitle) + '</b> <span class="sep">×</span> ' + esc(D.targetTitle) + '</span>' +
      '<span class="caret">▲</span></button>';

  var style = document.createElement('style');
  style.textContent = css;
  s.appendChild(style);
  s.appendChild(wrap);

  var panel = wrap.querySelector('.panel');
  var pill = wrap.querySelector('.pill');
  var open = function (yes) {
    panel.hidden = !yes;
    pill.setAttribute('aria-expanded', String(yes));
    wrap.querySelector('.caret').textContent = yes ? '▼' : '▲';
    if (yes) panel.querySelector('.close').focus();
  };
  pill.addEventListener('click', function () { open(panel.hidden); });
  wrap.querySelector('.close').addEventListener('click', function () { open(false); pill.focus(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) { open(false); pill.focus(); }
  });

  document.body.appendChild(host);
})();
</script>
`;
}

/**
 * Put the chrome in, and keep the demos out of search results.
 *
 * The 32 pages are, by construction, the same handful of words repeated 32
 * times — that is the point of the harness and exactly what a search engine
 * reads as duplicate content. The gallery is the page that should rank; these
 * are what it links to. Injected rather than authored for the same reason as
 * the widget: it is true of the deployment, not of the demo project.
 */
export function injectChrome(html, snippet) {
  const noindex = '<meta name="robots" content="noindex" />';
  let out = html;
  out = /<\/head>/i.test(out)
    ? out.replace(/<\/head>/i, `  ${noindex}\n</head>`)
    : out.replace(/<head([^>]*)>/i, `<head$1>${noindex}`);
  return /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${snippet}</body>`) : out + snippet;
}
