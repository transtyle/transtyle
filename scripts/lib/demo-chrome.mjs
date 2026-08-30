/**
 * The chrome that turns 32 separate builds into one browsable exhibit.
 *
 * Two things are injected into every hosted demo, and they serve the same end
 * by opposite means:
 *
 *   a **switcher** — a pill in the bottom-left corner that jumps to the same
 *   page in another design system or another target;
 *   a **bridge** — a mute agent, no UI at all, that lets the compare view
 *   (website/src/pages/compare/index.astro) drive this demo's own mode toggle
 *   and relay its scroll position to the demo beside it.
 *
 * The switcher is for a visitor looking at one demo; the bridge is for a
 * visitor looking at two. A framed demo gets only the bridge — inside a
 * compare pane the pill is both redundant (the pane has its own pickers) and
 * in the way (it floats over a column half the width it was designed for).
 *
 * The switcher: jump to the same page in another design system (Acme → Carbon,
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

  // Only the compare view frames a demo, and inside it the switcher is
  // replaced by that page's own pickers.
  var framed = window.top !== window.self;

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

  // The design system the compare link opens beside this one: the first that
  // is not this one and has this target built, so the link is never a 404 and
  // never a comparison of a demo with itself.
  var neighbour = D.examples.filter(function (e) { return e.id !== D.example && has(e.id, D.target); })[0];
  var other = neighbour ? neighbour.id : D.example;
  var otherTitle = neighbour ? neighbour.title : D.exampleTitle;

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
        // The same page against the nearest design system that is not this
        // one — the switcher's move, but without losing sight of where you
        // started.
        '<a href="' + site('compare/?left=' + D.example + '.' + D.target +
          '&right=' + other + '.' + D.target + '&mode=light') +
          '">⇄ Compare with ' + esc(otherTitle) + ' side by side</a>' +
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

  if (!framed) document.body.appendChild(host);

  // ---------- the compare view's bridge ----------

  /**
   * How this demo's mode gets driven from outside, without reaching inside it.
   *
   * The compare page and the demos are same-origin, so that page *could* walk
   * this document itself. It deliberately does not: every target encodes the
   * mode its own way (\`data-bs-theme\`, \`.dark\`, \`data-theme\`, a re-\`init\`ed
   * ECharts instance, an Angular signal), and a parent reaching in would have
   * to learn all eight and re-learn the ninth. The demos already agree on
   * something better — every one of them puts the mode on a real button in its
   * chrome bar, labelled with the mode it will switch *to* — so the bridge
   * presses that button and lets each demo do its own thing. What is checked
   * (scripts/check-demos.mjs) is exactly that agreement.
   *
   * Storybook is the exception and is handled by the compare page instead: the
   * demo there *is* Storybook's chrome, whose scheme lives in a toolbar global
   * rather than in the page, so it takes the mode through its own URL.
   */
  var SUN = '\\u2600'; // ☀ — shown while the demo is dark, offering light
  var toggle = function () {
    var nodes = document.querySelectorAll('button, [role="button"]');
    for (var i = 0; i < nodes.length; i++) {
      var text = nodes[i].textContent || '';
      if (text.indexOf(SUN) !== -1 || text.indexOf('\\u263E') !== -1) return nodes[i];
    }
    return null;
  };

  if (framed) {
    var suppressUntil = 0;
    var maxScroll = function () {
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    };
    // Nothing here is private — a demo id and a scroll ratio — and a framed
    // page cannot read its embedder's origin to name it, so '*' is the honest
    // target rather than a guess. The compare page checks the origin on its side.
    var tell = function (message) {
      message.source = 'transtyle-demo';
      window.parent.postMessage(message, '*');
    };

    window.addEventListener('message', function (event) {
      var m = event.data;
      if (!m || m.source !== 'transtyle-compare') return;
      if (m.type === 'mode') {
        var btn = toggle();
        if (btn && ((btn.textContent || '').indexOf(SUN) !== -1 ? 'dark' : 'light') !== m.mode) {
          btn.click();
        }
      } else if (m.type === 'scroll-to') {
        // Without this window the two panes ping-pong: each scroll we apply
        // fires our own scroll listener, which tells the other pane to move.
        suppressUntil = Date.now() + 150;
        // \`'instant'\`, not \`'auto'\`: "auto" means *defer to the element's
        // computed scroll-behavior*, and Bootstrap's reboot sets
        // \`:root { scroll-behavior: smooth }\`, so an auto scroll here animates.
        // That animates for longer than the window above, restarting exactly
        // the feedback loop it is there to stop — and it does not animate at
        // all while the tab is in the background, where a smooth scroll has no
        // frames to run on and the pane simply never moves.
        window.scrollTo({ top: Math.round(m.ratio * maxScroll()), behavior: 'instant' });
      }
    });

    var queued = false;
    window.addEventListener(
      'scroll',
      function () {
        if (queued || Date.now() < suppressUntil) return;
        queued = true;
        // A timer rather than requestAnimationFrame: rAF is paused in a
        // document the browser considers hidden, and a compare pane counts as
        // hidden whenever the window is behind something — the sync would come
        // back only once you looked at it, which is not when you need it.
        setTimeout(function () {
          queued = false;
          var max = maxScroll();
          // A ratio, not an offset: the same page is a different height in
          // Bootstrap and in Radix, and pixels drift a screenful apart by the
          // bottom of a long comparison.
          tell({ type: 'scroll', ratio: max ? window.scrollY / max : 0 });
        }, 16);
      },
      { passive: true },
    );

    // React, Angular and ECharts all mount their chrome bar after this script
    // runs, so announcing immediately would announce a page with no toggle in
    // it. Wait for the button, but not forever — a demo that never grows one
    // should still say hello and be told about it.
    var tries = 0;
    (function waitForToggle() {
      if (toggle() || tries++ > 60) {
        tell({ type: 'ready', example: D.example, target: D.target, canToggle: !!toggle() });
        return;
      }
      setTimeout(waitForToggle, 50);
    })();
  }
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
