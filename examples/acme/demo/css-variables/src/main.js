import './style.css';
import ds from './ds.config.js';
// The stylesheet is loaded twice: once as a real <link> (so the sample card
// above actually renders themed), once as raw text (so this page can list
// every variable it declares) — the demo reads only the compiled artifact,
// never internal token paths.
import cssText from '../../../dist/css-variables/variables.transtyle.css?raw';

const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = '../../../dist/css-variables/variables.transtyle.css';
document.head.appendChild(link);

if (ds.fontsHref) {
  const fonts = document.createElement('link');
  fonts.rel = 'stylesheet';
  fonts.href = ds.fontsHref;
  document.head.appendChild(fonts);
}
document.getElementById('demo-brand').textContent = `transtyle demo · ${ds.label}`;

// Parse `--name: value;` out of the :root block only (skip the dark block —
// this page lists the light values; toggling mode re-renders swatches live).
function parseRootDeclarations(text) {
  const rootMatch = /:root\s*\{([\s\S]*?)\n\}/.exec(text);
  const body = rootMatch ? rootMatch[1] : '';
  const out = [];
  for (const line of body.split('\n')) {
    const m = /^\s*(--[\w-]+):\s*([^;]+);/.exec(line);
    if (m) out.push([m[1], m[2].trim()]);
  }
  return out;
}

const declarations = parseRootDeclarations(cssText);
const families = new Map();
for (const [name, value] of declarations) {
  const family = name.replace(/^--/, '').split('-')[0];
  if (!families.has(family)) families.set(family, []);
  families.get(family).push([name, value]);
}

const isColor = (v) => /^(oklch|rgb|hsl|#)/i.test(v);

const container = document.getElementById('families');
for (const [family, vars] of [...families.entries()].sort()) {
  const section = document.createElement('div');
  section.className = 'family';
  const heading = document.createElement('h3');
  heading.textContent = `${family} (${vars.length})`;
  section.appendChild(heading);

  const colorVars = vars.filter(([, v]) => isColor(v));
  const otherVars = vars.filter(([, v]) => !isColor(v));

  if (colorVars.length) {
    const swatches = document.createElement('div');
    swatches.className = 'swatches';
    for (const [name] of colorVars) {
      const sw = document.createElement('div');
      sw.className = 'swatch';
      sw.innerHTML = `<div class="chip" style="background:var(${name})"></div><code>${name}</code>`;
      swatches.appendChild(sw);
    }
    section.appendChild(swatches);
  }
  if (otherVars.length) {
    const list = document.createElement('div');
    list.className = 'values';
    for (const [name, value] of otherVars) {
      const row = document.createElement('div');
      row.innerHTML = `<code>${name}</code><span>${value}</span>`;
      list.appendChild(row);
    }
    section.appendChild(list);
  }
  container.appendChild(section);
}

let mode = ds.defaultMode;
const btn = document.getElementById('demo-mode');
const apply = () => {
  document.documentElement.setAttribute('data-color-scheme', mode);
  btn.textContent = mode === 'dark' ? '☀ light' : '☾ dark';
};
btn.addEventListener('click', () => {
  mode = mode === 'dark' ? 'light' : 'dark';
  apply();
});
apply();
