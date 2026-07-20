// Token reference: swatches read the LIVE CSS custom properties from the
// sibling shadcn stylesheet, so they follow the Scheme toolbar. The design
// system documents itself inside Storybook.
const ROLES = [
  '--background', '--foreground', '--card', '--primary', '--primary-foreground',
  '--secondary', '--muted', '--accent', '--destructive', '--border', '--ring',
  '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5',
];

export default { title: 'Tokens/Colors' };

export const Roles = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:.75rem; font:13px var(--font-sans, monospace)';
    for (const name of ROLES) {
      const cell = document.createElement('div');
      const sw = document.createElement('div');
      sw.style.cssText = `height:52px; border-radius:8px; border:1px solid var(--border); background:var(${name})`;
      const label = document.createElement('code');
      label.textContent = name;
      cell.append(sw, label);
      wrap.append(cell);
    }
    return wrap;
  },
};
