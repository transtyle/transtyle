import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
// Wired exactly as the generated usage.md prescribes: the compiled theme goes
// to the provider, and nothing else themes the page.
import { theme } from '../../../dist/mui/theme.transtyle';
import App from './App';
import ds from './ds.config';

// demo chrome: web fonts (the families themselves come from the compiled theme)
if (ds.fontsHref) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = ds.fontsHref;
  document.head.appendChild(link);
}

// The hosted demos share one origin: a storage key per design system keeps
// one demo's mode from leaking into another's.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme} defaultMode={ds.defaultMode} modeStorageKey={`transtyle-demo-${ds.label}-mode`}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
