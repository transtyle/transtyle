import './style.css';
import * as echarts from 'echarts';
import ds from './ds.config.js';

// Themes come from the transtyle-built dist/ (per dist/echarts/usage.md):
// one theme per color-scheme mode, registered by name, chosen at init.
const themeModules = import.meta.glob('../../../dist/echarts/theme.*.json', { eager: true });
for (const [file, mod] of Object.entries(themeModules)) {
  const name = file.match(/theme\.(.+)\.json$/)[1];
  echarts.registerTheme(name, mod.default);
}

if (ds.fontsHref) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = ds.fontsHref;
  document.head.appendChild(link);
}
document.getElementById('demo-brand').textContent = `transtyle demo · ${ds.label}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const CHARTS = [
  {
    el: 'chart-revenue',
    option: {
      tooltip: { trigger: 'axis' },
      legend: { data: ['Revenue', 'Costs'] },
      grid: { left: 48, right: 16, top: 40, bottom: 28 },
      xAxis: { type: 'category', data: MONTHS },
      yAxis: { type: 'value' },
      series: [
        { name: 'Revenue', type: 'bar', data: [42, 51, 48, 63, 71, 84] },
        { name: 'Costs', type: 'bar', data: [31, 33, 30, 38, 41, 45] },
      ],
    },
  },
  {
    el: 'chart-signups',
    option: {
      tooltip: { trigger: 'axis' },
      legend: { data: ['Organic', 'Referral'] },
      grid: { left: 48, right: 16, top: 40, bottom: 28 },
      xAxis: { type: 'category', data: MONTHS, boundaryGap: false },
      yAxis: { type: 'value' },
      series: [
        { name: 'Organic', type: 'line', smooth: true, areaStyle: { opacity: 0.15 }, data: [18, 26, 24, 39, 52, 66] },
        { name: 'Referral', type: 'line', smooth: true, areaStyle: { opacity: 0.15 }, data: [8, 11, 14, 13, 19, 27] },
      ],
    },
  },
  {
    el: 'chart-channels',
    option: {
      tooltip: { trigger: 'item' },
      legend: { top: 'bottom' },
      series: [
        {
          name: 'Traffic',
          type: 'pie',
          radius: ['40%', '68%'],
          itemStyle: { borderRadius: 4 },
          data: [
            { value: 1048, name: 'Search' },
            { value: 735, name: 'Direct' },
            { value: 580, name: 'Email' },
            { value: 484, name: 'Social' },
            { value: 300, name: 'Ads' },
          ],
        },
      ],
    },
  },
  {
    el: 'chart-load',
    option: {
      tooltip: { trigger: 'axis' },
      legend: { data: ['p50', 'p99'] },
      grid: { left: 48, right: 16, top: 40, bottom: 28 },
      xAxis: { type: 'category', data: ['eu-west', 'us-east', 'ap-south', 'sa-east'] },
      yAxis: { type: 'value', name: 'ms' },
      series: [
        { name: 'p50', type: 'bar', data: [42, 38, 61, 55] },
        { name: 'p99', type: 'line', data: [180, 140, 260, 210] },
      ],
    },
  },
];

let mode = ds.defaultMode;
let instances = [];

function render() {
  for (const c of instances) c.dispose();
  instances = [];
  const themeName = ds.echartsTheme(mode);
  const theme = themeModules[`../../../dist/echarts/theme.${themeName}.json`]?.default ?? {};
  // The page shell wears the theme too — straight from the generated JSON.
  const root = document.documentElement;
  root.style.setProperty('--demo-bg', theme.backgroundColor ?? '#fff');
  root.style.setProperty('--demo-text', theme.textStyle?.color ?? '#111');
  if (theme.textStyle?.fontFamily) root.style.setProperty('--demo-font', theme.textStyle.fontFamily);

  for (const { el, option } of CHARTS) {
    const chart = echarts.init(document.getElementById(el), themeName);
    chart.setOption(option);
    instances.push(chart);
  }
  document.getElementById('demo-mode').textContent = mode === 'dark' ? '☀ light' : '☾ dark';
}

document.getElementById('demo-mode').addEventListener('click', () => {
  mode = mode === 'dark' ? 'light' : 'dark';
  render();
});
window.addEventListener('resize', () => instances.forEach((c) => c.resize()));
render();
