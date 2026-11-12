import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import '@fontsource/playfair-display/latin-600.css';
import '@fontsource/playfair-display/latin-600-italic.css';
import '@fontsource/hanken-grotesk/latin-400.css';
import '@fontsource/hanken-grotesk/latin-500.css';
import '@fontsource/hanken-grotesk/latin-600.css';
import './ui/tokens.css';
import './ui/estilo.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
