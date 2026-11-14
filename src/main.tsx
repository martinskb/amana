import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import { iniciarCapturaInstalacao } from './lib/instalar';
import './ui/fontes.css';
import '@fontsource/caveat/latin-700.css';
import './ui/tokens.css';
import './ui/estilo.css';

// antes de tudo: o aviso de instalação do Android chega logo na abertura
iniciarCapturaInstalacao();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
