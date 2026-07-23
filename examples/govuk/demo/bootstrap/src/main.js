import './main.scss';
import * as bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';
import ds from './ds.config.js';

// demo chrome: web fonts + mode toggle (Bootstrap's own mechanism: data-bs-theme)
if (ds.fontsHref) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = ds.fontsHref;
  document.head.appendChild(link);
}

document.getElementById('demo-brand').textContent = `transtyle demo · ${ds.label}`;

// Bootstrap tooltips are opt-in — initialize the ones in the markup so the
// component.tooltip.max-width binding is actually rendered, not just emitted.
for (const el of document.querySelectorAll('[data-bs-toggle="tooltip"]')) {
  new bootstrap.Tooltip(el);
}

let mode = ds.defaultMode;
const btn = document.getElementById('demo-mode');
const apply = () => {
  document.documentElement.setAttribute('data-bs-theme', mode);
  btn.textContent = mode === 'dark' ? '☀ light' : '☾ dark';
};
btn.addEventListener('click', () => {
  mode = mode === 'dark' ? 'light' : 'dark';
  apply();
});
apply();
