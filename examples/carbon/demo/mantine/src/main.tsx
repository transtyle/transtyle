import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';
// Wired exactly as the generated usage.md prescribes: the theme object and the
// resolver go to the provider, and nothing else themes the page.
import { theme, cssVariablesResolver } from '../../../dist/mantine/theme.transtyle';
import App from './App';
import ds from './ds.config';

// demo chrome: web fonts (the families themselves come from the compiled theme)
if (ds.fontsHref) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = ds.fontsHref;
  document.head.appendChild(link);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme={ds.defaultMode}>
      <App />
    </MantineProvider>
  </StrictMode>,
);
