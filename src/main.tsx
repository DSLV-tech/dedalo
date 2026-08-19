import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { initInstall, registerServiceWorker } from './pwa';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root non trovato');

initInstall();
registerServiceWorker();

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
