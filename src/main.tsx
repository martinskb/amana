import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import './ui/fontes.css';
import '@fontsource/caveat/latin-700.css';
import './ui/tokens.css';
import './ui/estilo.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
