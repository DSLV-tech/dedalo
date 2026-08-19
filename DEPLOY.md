# Deploy

Il build è statico e usa `base: './'`, quindi la stessa cartella `dist/` funziona
su GitHub Pages, Vercel, Netlify o anche aperta da file system.

## GitHub Pages (automatico)

Il workflow `.github/workflows/deploy.yml` è già pronto: a ogni push su `main`
esegue test, build e pubblicazione.

1. Crea il repository e fai push su `main`.
2. Su GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Il primo push pubblica su `https://<utente>.github.io/<repo>/`.

## Vercel

1. **Add New → Project**, importa il repository.
2. Framework preset: **Vite**. Build command `npm run build`, output `dist`.
3. Deploy. Nessuna variabile d'ambiente richiesta.

## Manuale

```bash
npm ci
npm run build
# carica il contenuto di dist/ su qualsiasi hosting statico
```

## Note

- Nessun backend, nessuna chiamata di rete: il gioco gira interamente nel browser.
- L'audio (`public/audio/*.mp3`, ~1,7 MB) viene copiato in `dist/` dal build: va
  pubblicato insieme al resto, altrimenti il gioco resta muto (senza però rompersi).
- Il service worker richiede HTTPS (o `localhost`): su GitHub Pages e Vercel funziona
  da subito. Cambiando versione degli asset, aggiorna `CACHE` in `public/sw.js` per
  invalidare la cache dei giocatori.
- L'unico dato salvato è il record personale in `localStorage` (chiave `dedalo.record.v1`),
  tecnico e anonimo: non serve banner cookie.
- `?seed=<numero o parola>` nella URL riproduce esattamente la stessa run.
