import { defineConfig } from 'vite';

export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        // Bootstrap 5.3 still uses @import internally; keep its deprecation
        // noise out of the demo build.
        quietDeps: true,
        silenceDeprecations: ['import', 'mixed-decls', 'color-functions', 'global-builtin'],
      },
    },
  },
});
