import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
// Theme comes only from compiled output (docs/specs/demo-app.md) — never hand-copied.
import preset from '../../../../dist/primeng/preset.transtyle';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    providePrimeNG({
      // '.dark' matches every other demo's mode-toggle convention (docs/specs/demo-app.md).
      theme: { preset, options: { darkModeSelector: '.dark', cssLayer: false } },
    }),
  ],
};
