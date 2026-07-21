import type { StorybookConfig } from '@storybook/html-vite';

// The simplest possible Storybook instance: the demo IS Storybook itself —
// its chrome (sidebar, toolbar, controls, docs) themed by the transtyle-built
// dist/storybook/ fragments. Stories are deliberately minimal.
const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(js|ts)'],
  framework: { name: '@storybook/html-vite', options: {} },
};
export default config;
