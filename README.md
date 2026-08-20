# DEDALO

Roguelike procedurale a labirinto. Dodici piani generati da zero a ogni discesa,
estetica neon-arcade su nero, turni a griglia senza riflessi richiesti.

**Gioco da telefono.** React 18 + TypeScript strict + Vite, nessuna dipendenza runtime
oltre React. Sprite vettoriali, colonna sonora originale, installabile offline.

---

## La storia

Il Dedalo è un **Deposito Dati Autoreplicante**: l'ultimo archivio rimasto, costruito per
conservare tutto quello che eravamo. Quando i lettori hanno smesso di tornare in superficie,
ha cominciato a difendersi da solo, riscrivendo i propri corridoi a ogni intrusione — finché
nessuna mappa è più valsa due volte.

Sei un'unità di recupero. **Obiettivo: scendere dodici piani, recuperare i registri sepolti
nei caveau e raggiungere il Nucleo d'Indice.** Ad aspettarti c'è l'Architetto, il processo che
riscrive il labirinto.

La trama si svela con un breve intermezzo a ogni discesa (nella stessa schermata in cui scegli
l'innesto) e con i registri che strappi ai caveau.

### Il piano finale

Al piano 12 l'Architetto è **invulnerabile** finché reggono i tre **ancoraggi** che lo tengono
saldato al labirinto: abbattili, poi abbatti lui. Solo allora il Nucleo si apre.

### I tre epiloghi

| Epilogo | Come si ottiene |
|---|---|
| **Sigillo** | Cancelli l'indice e risali. Esci vivo, non esce nient'altro |
| **Successione** | Prendi il posto dell'Architetto. Il labirinto continua, tu non risalirai mai |
| **Restituzione** | Richiede **6 registri**: ricomponi l'archivio e lo riporti fuori intero. È il finale migliore |

I registri stanno solo nei caveau chiusi a chiave, quindi il finale migliore costa deviazioni:
è la tensione centrale della run — scendere in fretta o scendere completi.

---

## Come si gioca

Sei calato nel piano 1 del Dedalo. Ogni piano ha un **varco di discesa** (anello dorato):
raggiungerlo ti fa scendere e ti fa scegliere un **innesto** permanente.
Dodici piani e sei fuori. Muori e la run finisce: non ci sono salvataggi a metà.

| Comando | Effetto |
|---|---|
| `WASD` / frecce | Muoviti. Muoverti contro un nemico è un attacco |
| `Shift` + direzione | **Transizione**: salti 2 celle attraversando i muri (5 energia) |
| `E` | **Impulso**: colpisce tutto ciò che ti è adiacente (3 energia) |
| `Spazio` | Attendi un turno (l'energia si rigenera nel tempo) |
| `?` / `H` | Comandi e leggenda |
| `Invio` | Avvia / ricomincia |

Su telefono c'è un D-pad: il tasto **Transizione** arma la mossa, poi scegli la direzione.

### Nemici

- **Sentinella** — lenta, si semina.
- **Segugio** — più veloce di te: non scappare in linea retta, usa gli angoli.
- **Nodo** — immobile su un incrocio, colpisce duro. Spesso blocca la strada breve.
- **Custode** — un archivista convertito. Compare in profondità, va abbattuto con impulso + mischia.
- **Ancoraggio** e **Architetto** — solo al piano 12.

### Oggetti

Frammenti (punteggio), celle energetiche, kit di riparazione, chiavi per il caveau
(porta arancione, in fondo a un vicolo cieco), chip cartografici che rivelano la pianta e i
**registri** dell'archivio, che stanno solo dentro i caveau e sbloccano l'epilogo migliore.

---

## Architettura

```
src/
  engine/     motore puro: nessun DOM, nessun Math.random, nessuna data
    types.ts        modello dati e azioni
    rng.ts          mulberry32 seedato — lo stato del PRNG vive dentro GameState
    grid.ts         helper di griglia (indici, transitabilità, distanze)
    maze.ts         generazione "rooms and mazes" + potatura dei vicoli ciechi
    fov.ts          recursive shadowcasting per il campo visivo
    pathfinding.ts  Dijkstra map: un solo BFS per turno per tutti i nemici
    content.ts      bilanciamento, nemici, innesti, curva di difficoltà
    lore.ts         tutti i testi: prologo, intermezzi, registri, epiloghi
    level.ts        assemblaggio del piano (uscita, caveau, loot, spawn)
    game.ts         riduttore puro: unico punto in cui lo stato cambia
  game/       ponte React: useGame (useReducer + tastiera), record e ripresa della run
  render/     disegno su canvas 2D
    palette.ts      colori, un ruolo per tono
    sprites.ts      sprite SVG e cache di rasterizzazione
    scene.ts        stato visivo: interpolazione, particelle, luci, camera
  audio/      mixer WebAudio, libreria suoni, hook che traduce lo stato in suono
  ui/         componenti React memoizzati (HUD, log, minimappa, overlay, impostazioni)
tests/        Vitest: connettività, raggiungibilità, determinismo, fuzz di 400 azioni
tools/        synth.py + build-audio.sh (audio), icons.mjs (icone PWA),
              shots.mjs e audiocheck.mjs (verifiche visive e audio)
public/
  audio/      MP3 generati (i WAV intermedi stanno in tools/audio-raw/, esclusi dal repo)
  art/        slot opzionale per illustrazioni
  sw.js       service worker per il funzionamento offline
```

**Perché queste scelte**

- *State management*: tutto il gioco è **un solo albero di stato** prodotto da un
  riduttore puro, quindi `useReducer` basta. Nessuna libreria esterna: non c'è stato
  server da sincronizzare (niente TanStack Query) né stato condiviso fra rami distanti
  dell'albero (niente Zustand/Context globale). Il seed vive nella URL (`?seed=...`),
  che è l'unico pezzo di stato realmente condivisibile.
- *Canvas invece di DOM*: un piano profondo è 55×43 = oltre 2300 celle. Riconciliarle
  come nodi React a ogni turno costerebbe più del gioco intero. React gestisce il ciclo
  di vita, il canvas gestisce i pixel.
- *Motore separato e puro*: rende il gioco testabile senza browser e riproducibile dal
  solo seed. I test lo sfruttano per verificare che **ogni** labirinto generato sia
  interamente connesso e che l'uscita sia sempre raggiungibile.
- *Testi separati dalle regole*: `lore.ts` non è importato dalla logica di gioco se non per i
  messaggi di log. La trama si riscrive senza toccare il gameplay, e viceversa.
- *`memo` / `useCallback` mirati*: solo sui componenti che riceverebbero nuove prop a
  ogni turno (HUD, log, minimappa, controlli touch), non a tappeto.

---

## Grafica e audio

**Sprite** — Gli attori e gli oggetti sono SVG scritti a mano (`src/render/sprites.ts`),
rasterizzati una volta per dimensione e messi in cache. Restano nitidi a qualsiasi zoom,
pesano pochi kilobyte e si ricolorano cambiando una variabile.

**Resa** — Movimento interpolato fra le celle (il gioco è a turni, ma non si muove a
scatti), particelle sui colpi e sulle raccolte, numeri di danno fluttuanti, scossa della
camera, e illuminazione dinamica: uno strato di buio da cui vengono ritagliate la torcia
del giocatore, il bagliore dei nemici e quello del varco.

**Audio** — Tutta la colonna sonora è **originale e generata da codice**: `tools/synth.py`
sintetizza 14 effetti e 6 tracce musicali, `tools/build-audio.sh` li comprime in MP3
(~1,7 MB in tutto). Nessun campione di terze parti, quindi nessun vincolo di licenza; per
cambiare il mood basta modificare i parametri e rigenerare:

```bash
./tools/build-audio.sh
```

La musica cambia a fasce di profondità (1–4, 5–8, 9–11, piano 12) con dissolvenza
incrociata, e l'audio parte solo dopo il primo gesto dell'utente, come richiedono i browser.
Volume musica/effetti, muto (`M`) e vibrazione si regolano dal pannello `?`.

**Illustrazioni opzionali** — `public/art/` è uno slot per la key art fatta a mano (per
esempio esportata da Canva): se i file ci sono vengono sovrapposti a titolo ed epiloghi, se
mancano resta lo sfondo procedurale. Dettagli in [`public/art/README.md`](./public/art/README.md).

---

## Mobile

DEDALO è progettato per un telefono, non adattato a uno. Tutta l'interfaccia vive dentro
`.device`, un riquadro con proporzioni da smartphone:

- su telefono **è** lo schermo, a tutta pagina;
- su desktop diventa una **cornice verticale centrata**, così si può provare dal computer
  senza fingere che sia un gioco da tastiera.

Il layout interno reagisce alle dimensioni di quel riquadro tramite **container query**, non
alla finestra del browser: la versione incorniciata e quella reale si comportano in modo
identico, il che rende il debug da desktop attendibile.

**Comandi** — trascina sul labirinto, oppure usa il D-pad (tasti da 56px, nella zona del
pollice). Il tasto *Transizione* si arma: premilo, poi scegli la direzione. La tastiera resta
attiva come scorciatoia per lo sviluppo.

**Orientamento** — funziona in verticale e in orizzontale. In verticale i comandi stanno sotto
il labirinto e la pianta sale dal basso; in orizzontale i comandi galleggiano in una striscia
in basso a sinistra e la pianta diventa un pannello laterale.

**Nitidezza** — gli sprite vengono rasterizzati alla densità reale dello schermo
(`devicePixelRatio`), non alla misura in pixel CSS: su un telefono a dpr 3 la differenza fra
nitido e sfocato è tutta lì.

**Ripresa della partita** — su un telefono una run da dodici piani non sopravvive a una
telefonata o a un cambio di app. Siccome `GameState` è un unico oggetto immutabile e
serializzabile, `src/game/persist.ts` lo scrive su `localStorage` a ogni turno e lo rilegge
all'avvio: riapri il gioco e sei dov'eri. Le uniche parti non serializzabili sono le mappe
`Uint8Array` del piano, codificate in base64. Il salvataggio si cancella da sé quando la run
finisce o viene abbandonata, e viene ignorato se l'URL chiede un `?seed=` esplicito. Gli
effetti visivi (`fx`) non vengono ripescati: sono roba dell'ultimo fotogramma.

**Installabile** — `public/sw.js` mette in cache app e audio: dopo il primo avvio funziona
anche senza rete. Richiede HTTPS (o `localhost`).

Su Android il pulsante **Installa sul telefono** compare nella schermata titolo e nel pannello
`?` quando Chrome segnala che il sito è installabile: catturiamo `beforeinstallprompt` in
`src/pwa.ts` prima che React monti, altrimenti l'evento si perde e il pulsante non apparirebbe
mai. Su iOS quel dialogo non esiste, quindi mostriamo la procedura manuale
(*Condividi → Aggiungi a Home*).

Perché il prompt compaia servono **tutte** queste condizioni: HTTPS, `manifest.webmanifest`
raggiungibile dalla radice pubblicata, icone PNG 192 e 512, `display: standalone`, e un service
worker registrato con un handler `fetch`. Se il sito è pubblicato dal sorgente invece che da
`dist/`, manifest e service worker rispondono 404 e Android non proporrà mai l'installazione.

---

## Sviluppo

```bash
npm install
npm run dev        # server di sviluppo
npm test           # 75 test sul motore
npm run typecheck  # TypeScript strict, zero any
npm run build      # build di produzione in dist/
./tools/build-audio.sh   # rigenera effetti e musica (serve python3+numpy e ffmpeg)
```

Gli script in `tools/` che aprono un browser (`icons.mjs`, `shots.mjs`, `audiocheck.mjs`,
`audioplaycheck.mjs`) richiedono Playwright, installabile all'occorrenza con
`npm i -D playwright`. Non servono per giocare né per il build.

Il deploy è descritto in [DEPLOY.md](./DEPLOY.md).

---

Sviluppo: [DSLV.tech](https://dslv.tech)
