import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ChakraProvider } from '@chakra-ui/react';
// Wired exactly as the generated usage.md prescribes: the compiled system goes
// to the provider, and nothing else themes the page.
import { system } from '../../../dist/chakra/theme.transtyle';
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
    <ChakraProvider value={system}>
      <App />
    </ChakraProvider>
  </StrictMode>,
);
