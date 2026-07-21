// The only story — plain text, on purpose. The demo is Storybook's own chrome:
// everything AROUND this canvas is themed by the transtyle-built
// dist/storybook/ fragments. (Colors here read the sibling shadcn variables so
// the canvas follows the Scheme toolbar too.)
export default {
  title: 'Welcome',
  render: ({ note }) => {
    const el = document.createElement('div');
    el.style.cssText =
      'max-width: 62ch; font-family: var(--font-sans, system-ui, sans-serif); line-height: 1.65; color: var(--foreground, inherit); padding: 1rem;';
    el.innerHTML = `
      <h1 style="font-size:1.3rem; margin:0 0 .75rem">This Storybook is the demo</h1>
      <p>Nothing to see in this canvas — look <em>around</em> it. Storybook's own UI is themed by
      the design system's compiled output (<code>dist/storybook/</code>):</p>
      <ul>
        <li>the <strong>sidebar</strong> — background, text, the highlight color of the selected item;</li>
        <li>the <strong>toolbar</strong> and its <strong>Scheme</strong> control — flip it and the canvas
        background follows the design system's modes;</li>
        <li>the <strong>Controls panel</strong> below — its inputs wear the theme's field colors
        (edit the <code>note</code> control to see one);</li>
        <li>the fonts everywhere — the design system's own families.</li>
      </ul>
      <p>Wiring: <code>.storybook/manager.ts</code> imports <code>manager.transtyle.ts</code> (chrome, in the
      design system's native mode) and <code>.storybook/preview.ts</code> re-exports
      <code>preview.transtyle.ts</code> (Scheme toolbar, mode decorator, canvas backgrounds).
      Regenerate with <code>transtyle build storybook</code> — never edit those files.</p>
      <p style="opacity:.7">${note}</p>`;
    return el;
  },
  args: { note: 'This text field exists so the Controls panel has something themed to show.' },
};

export const Welcome = {};
