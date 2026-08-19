import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { registerServiceWorker } from './pwa';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root non trovato');

registerServiceWorker();

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
