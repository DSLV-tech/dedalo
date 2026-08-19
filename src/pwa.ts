import { useCallback, useSyncExternalStore } from 'react';

/**
 * Evento non standard di Chrome/Edge: il browser lo emette quando il sito
 * soddisfa i criteri di installabilità. Va catturato *prima* che React monti,
 * altrimenti si perde e il pulsante "Installa" non comparirà mai.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
  prompt: () => Promise<void>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Da chiamare in `main.tsx`, prima del render. */
export function initInstall(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Senza preventDefault Chrome mostra (o nasconde) il suo banner e noi
    // perdiamo il controllo su quando chiedere.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // Safari iOS non implementa display-mode: usa una proprietà proprietaria.
  const legacy = window.navigator as Navigator & { standalone?: boolean };
  return legacy.standalone === true;
}

function isIos(): boolean {
  const ua = window.navigator.userAgent;
  const iOsDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS si dichiara "Macintosh": lo distinguiamo dal supporto touch.
  const iPadOs = ua.includes('Macintosh') && navigator.maxTouchPoints > 1;
  return iOsDevice || iPadOs;
}

export interface InstallApi {
  /** Il browser è pronto a mostrare il dialogo nativo. */
  readonly available: boolean;
  /** Siamo su iOS, dove l'installazione è solo manuale. */
  readonly manualIos: boolean;
  readonly install: () => void;
}

export function useInstall(): InstallApi {
  const available = useSyncExternalStore(
    subscribe,
    () => deferred !== null,
    () => false,
  );

  const install = useCallback(() => {
    const event = deferred;
    if (!event) return;
    void event.prompt().then(() => {
      void event.userChoice.finally(() => {
        deferred = null;
        notify();
      });
    });
  }, []);

  const manualIos = typeof window !== 'undefined' && isIos() && !isStandalone();
  return { available, manualIos, install };
}

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
