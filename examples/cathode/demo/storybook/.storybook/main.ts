import type { StorybookConfig } from '@storybook/html-vite';
import tailwindcss from '@tailwindcss/vite';

// The simplest possible Storybook instance that wears a transtyle theme:
// one framework, one stories glob, and the Tailwind plugin so the sibling
// daisyUI stylesheet imported by dist/storybook/preview.transtyle.ts (its
// `@plugin "daisyui/theme"` blocks are Tailwind-build input) compiles for real.
const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(js|ts)'],
  framework: { name: '@storybook/html-vite', options: {} },
  viteFinal: async (viteConfig) => {
    viteConfig.plugins = [...(viteConfig.plugins ?? []), tailwindcss()];
    return viteConfig;
  },
};
export default config;
