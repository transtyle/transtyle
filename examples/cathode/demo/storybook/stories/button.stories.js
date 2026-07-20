// daisyUI buttons rendered under the composed transtyle theme — flip the
// toolbar's "Scheme" control and both sibling stylesheets follow.
export default {
  title: 'Components/Button',
  render: ({ label, variant, outline }) =>
    `<button class="btn ${variant ? `btn-${variant}` : ''} ${outline ? 'btn-outline' : ''}">${label}</button>`,
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'accent', 'neutral', 'info', 'success', 'warning', 'error'],
    },
    outline: { control: 'boolean' },
  },
  args: { label: 'Button', outline: false },
};

export const Primary = { args: { variant: 'primary', label: 'Primary' } };
export const Secondary = { args: { variant: 'secondary', label: 'Secondary' } };
export const Danger = { args: { variant: 'error', label: 'Delete' } };
export const AllVariants = {
  render: () => `
    <div style="display:flex; flex-wrap:wrap; gap:.5rem; align-items:center">
      ${['primary', 'secondary', 'accent', 'neutral', 'info', 'success', 'warning', 'error']
        .map((v) => `<button class="btn btn-${v}">${v}</button>`)
        .join('')}
      <button class="btn btn-outline btn-primary">outline</button>
      <button class="btn" disabled>disabled</button>
    </div>`,
};
