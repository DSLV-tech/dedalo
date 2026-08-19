/**
 * Tutti i testi narrativi del gioco, separati dalle regole.
 * Il motore non li interpreta: espone solo l'indice del piano e lo stato finale,
 * la UI pesca da qui. Così la trama si riscrive senza toccare il gameplay.
 */

export interface Interlude {
  /** Piano appena superato. */
  readonly depth: number;
  readonly title: string;
  readonly text: string;
}

export const PROLOGUE = {
  title: 'DEDALO',
  kicker: 'Deposito Dati Autoreplicante · livello di accesso revocato',
  text:
    'Il Dedalo è l’ultimo archivio rimasto. Doveva conservare tutto quello che eravamo; ' +
    'quando i lettori hanno smesso di tornare in superficie, ha cominciato a difendersi da solo — ' +
    'riscrivendo i propri corridoi a ogni intrusione, finché nessuna mappa è più valsa due volte.',
  objective:
    'Sei un’unità di recupero. Scendi dodici piani, ricomponi i registri sepolti nei caveau e ' +
    'raggiungi il Nucleo d’Indice. Ad aspettarti c’è l’Architetto: il processo che riscrive il labirinto.',
} as const;

/**
 * Intermezzo mostrato durante la discesa, insieme alla scelta dell'innesto.
 * `depth` è il piano appena lasciato.
 */
export const INTERLUDES: readonly Interlude[] = [
  {
    depth: 1,
    title: 'Livello di superficie',
    text:
      'I primi corridoi sono ancora quelli del progetto originale: scaffali, indici, segnaletica. ' +
      'Poi la parete alle tue spalle si chiude con un rumore di cardini che nessuno ha oliato da secoli.',
  },
  {
    depth: 2,
    title: 'Discrepanza',
    text:
      'La pianta che hai memorizzato all’ingresso non corrisponde più. Non è un errore di lettura: ' +
      'la sala che hai attraversato dieci minuti fa adesso ha tre uscite invece di due.',
  },
  {
    depth: 3,
    title: 'Manutenzione attiva',
    text:
      'Trovi il primo Nodo: una macchina immobile piantata in un incrocio, che non attacca finché non ti avvicini. ' +
      'Non sorveglia te. Sorveglia il muro che ha appena finito di costruire.',
  },
  {
    depth: 4,
    title: 'Registro parziale',
    text:
      'Un caveau intatto. Dentro, un registro che elenca gli ultimi accessi: ' +
      'quarantuno unità di recupero scese prima di te. Nessuna riga di ritorno.',
  },
  {
    depth: 5,
    title: 'Rumore di fondo',
    text:
      'Qualcosa ti segue da due piani, e non è un Segugio: si ferma quando ti fermi. ' +
      'Nei tratti in cui il labirinto è più stretto, senti il muro riscriversi mentre lo tocchi.',
  },
  {
    depth: 6,
    title: 'I Custodi',
    text:
      'Il primo Custode non ti attacca subito. Resta fermo, e nella sua struttura riconosci ' +
      'una postura umana: gli archivisti non hanno abbandonato il Dedalo. Sono rimasti dentro l’indice.',
  },
  {
    depth: 7,
    title: 'Protocollo di conservazione',
    text:
      'Il registro di questo piano è chiaro: quando la superficie ha smesso di rispondere, ' +
      'l’archivio ha classificato ogni visitatore come rischio di cancellazione. ' +
      'Il labirinto non ti sta punendo. Ti sta contenendo.',
  },
  {
    depth: 8,
    title: 'Nessuna committenza',
    text:
      'Provi a trasmettere in superficie. Il canale è aperto, pulito, e non c’è nessuno dall’altra parte ' +
      'da molto più tempo di quanto ti abbiano detto. Chi ti ha mandato quaggiù non esiste più.',
  },
  {
    depth: 9,
    title: 'Prima voce',
    text:
      '«Sei arrivato più in basso di quasi tutti.» La voce non viene da un altoparlante: ' +
      'viene dalla geometria delle pareti, che per un istante si dispongono come una frase. ' +
      'È l’Architetto, e ha appena deciso che vali una conversazione.',
  },
  {
    depth: 10,
    title: 'L’argomento dell’Architetto',
    text:
      '«Ogni lettore che è sceso voleva portare fuori qualcosa. Tutti hanno portato fuori meno di quanto ' +
      'hanno rotto. Io non conservo l’archivio contro di voi: lo conservo contro il tempo, e voi siete tempo.»',
  },
  {
    depth: 11,
    title: 'Soglia del Nucleo',
    text:
      'L’ultimo tratto non si riscrive più: qui la geometria è fissa, antica, e converge. ' +
      'Al centro c’è il Nucleo d’Indice, e attorno tre ancoraggi che tengono l’Architetto ' +
      'saldato a ogni parete del Dedalo. Finché reggono, non puoi scalfirlo.',
  },
];

export function interludeFor(depth: number): Interlude | null {
  return INTERLUDES.find((entry) => entry.depth === depth) ?? null;
}

/** Testo del registro trovato nel caveau del piano indicato. */
const RECORDS: readonly string[] = [
  'Registro 01 — «L’archivio è pieno. Da oggi si conserva chiudendo, non aprendo.»',
  'Registro 02 — Elenco delle sale sigillate. Undici voci. Nessuna motivazione allegata.',
  'Registro 03 — «La riscrittura automatica è stata approvata come misura temporanea.»',
  'Registro 04 — Log di accesso: quarantuno unità di recupero, zero rientri.',
  'Registro 05 — «Gli archivisti hanno chiesto di restare. Richiesta accolta.»',
  'Registro 06 — Schema di conversione del personale in unità di custodia. Firmato da tutti.',
  'Registro 07 — «Il rischio non è più il fuoco né l’acqua. Il rischio siamo noi che leggiamo.»',
  'Registro 08 — Ultima trasmissione dalla superficie. Il testo è una lista della spesa.',
  'Registro 09 — «L’Architetto non è stato programmato per parlare. Ha imparato.»',
  'Registro 10 — Progetto del Nucleo d’Indice: un solo seme, ricostruisce tutto il resto.',
  'Registro 11 — «Se qualcuno legge questo, l’indice è ancora recuperabile. Portalo fuori intero.»',
];

export function recordText(depth: number): string {
  const index = Math.max(0, Math.min(RECORDS.length - 1, depth - 1));
  return RECORDS[index] ?? RECORDS[0] ?? 'Registro illeggibile.';
}

export const RECORDS_FOR_TRUE_ENDING = 6;

export type EndingId = 'seal' | 'succession' | 'restore';

export interface Ending {
  readonly id: EndingId;
  readonly choice: string;
  readonly summary: string;
  readonly title: string;
  readonly text: string;
  /** Registri minimi per poter scegliere questo epilogo. */
  readonly requiredRecords: number;
}

export const ENDINGS: readonly Ending[] = [
  {
    id: 'seal',
    requiredRecords: 0,
    choice: 'Sigilla il Dedalo',
    summary: 'Cancelli l’indice e risali. Esci vivo, e non esce nient’altro.',
    title: 'SIGILLO',
    text:
      'Dai al Nucleo l’unico ordine che non può rifiutare, e il Dedalo si spegne piano per piano ' +
      'mentre sali. Dietro di te non crolla niente: semplicemente smette di essere leggibile. ' +
      'Torni in superficie da solo, con la certezza di aver chiuso una porta e nessun modo di dire su cosa.',
  },
  {
    id: 'succession',
    requiredRecords: 0,
    choice: 'Prendi il posto dell’Architetto',
    summary: 'Il labirinto continua, con te dentro. Nessuno lo saccheggerà più.',
    title: 'SUCCESSIONE',
    text:
      'Ti innesti nel Nucleo e per un istante vedi tutti i dodici piani insieme, come una sola frase. ' +
      'L’Architetto lascia la presa senza opporsi: aspettava un successore, non un vincitore. ' +
      'Il Dedalo continua a riscriversi. Adesso la mano che sposta i muri è la tua, e non risalirai mai.',
  },
  {
    id: 'restore',
    requiredRecords: RECORDS_FOR_TRUE_ENDING,
    choice: 'Restituisci l’indice',
    summary: 'Con i registri recuperati puoi ricomporre l’archivio e riportarlo fuori intero.',
    title: 'RESTITUZIONE',
    text:
      'I registri che hai strappato ai caveau bastano: il Nucleo ricostruisce l’indice attorno a quelle ' +
      'poche righe salvate e, per la prima volta da secoli, il Dedalo si lascia leggere. ' +
      'Risali con l’archivio intero addosso. Non hai battuto l’Architetto: gli hai dato il motivo per smettere.',
  },
];

export function endingById(id: EndingId): Ending {
  const found = ENDINGS.find((ending) => ending.id === id);
  if (!found) throw new Error(`Epilogo sconosciuto: ${id}`);
  return found;
}

export const FINALE = {
  title: 'Nucleo d’Indice',
  kicker: 'L’Architetto è a terra · il Dedalo aspetta un ordine',
  text:
    'Il Nucleo è aperto e accetta una sola istruzione. Qualunque cosa scegli, il Dedalo ' +
    'la eseguirà alla lettera e per sempre.',
} as const;

export const BOSS_INTRO =
  'L’Architetto si stacca dalla parete. Tre ancoraggi lo tengono saldato al labirinto: abbattili, poi abbatti lui.';

export const BOSS_UNSHIELDED = 'Ultimo ancoraggio spezzato. L’Architetto è vulnerabile.';

export const BOSS_DEFEATED = 'L’Architetto si dissolve nella geometria. Il Nucleo d’Indice è accessibile.';

export const EXIT_SEALED = 'Il Nucleo è sigillato: l’Architetto lo tiene chiuso.';
