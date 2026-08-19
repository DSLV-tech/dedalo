/**
 * Registrazione del service worker.
 * Solo in produzione: in sviluppo intercetterebbe il modulo hot-reload di Vite.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    const url = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(url, { scope: import.meta.env.BASE_URL }).catch(() => {
      // Offline non disponibile (es. contesto non sicuro): il gioco funziona lo stesso.
    });
  });
}
