import type { StorybookConfig } from '@storybook/html-vite';

// The simplest possible Storybook instance: the demo IS Storybook itself —
// its chrome (sidebar, toolbar, controls, docs) themed by the transtyle-built
// dist/storybook/ fragments. Stories are deliberately minimal.
const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(js|ts)'],
  framework: { name: '@storybook/html-vite', options: {} },
  // Storybook picks the manager's favicon out of a static dir; public/ is the
  // same folder the Vite demos serve theirs from (scripts/gen-brand.mjs).
  staticDirs: ['../public'],
};
export default config;
