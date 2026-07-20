import './main.scss';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import ds from './ds.config.js';

// demo chrome: web fonts + mode toggle (Bootstrap's own mechanism: data-bs-theme)
if (ds.fontsHref) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = ds.fontsHref;
  document.head.appendChild(link);
}

document.getElementById('demo-brand').textContent = `transtyle demo · ${ds.label}`;

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
