// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://transtyle.dev',
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    },
  },
});
