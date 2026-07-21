import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import ds from './ds.config';

// demo chrome: web fonts (the families themselves come from the compiled theme)
if (ds.fontsHref) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = ds.fontsHref;
  document.head.appendChild(link);
}

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
