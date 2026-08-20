/**
 * Persistenza della spedizione in corso.
 *
 * DEDALO è un gioco da telefono: una chiamata in arrivo, un cambio di app o il
 * browser che libera memoria bastano a far sparire una run da dodici piani.
 * Il motore però produce un unico `GameState` immutabile e interamente
 * serializzabile, quindi basta scriverlo su `localStorage` a ogni turno e
 * rileggerlo all'avvio.
 *
 * L'unico campo che non sopravvive a JSON è `Level.tiles`/`visibility`
 * (`Uint8Array`), codificato qui in base64.
 */

import type {
  Actor,
  GameState,
  Item,
  Level,
  LogEntry,
  Phase,
  PlayerStats,
  Upgrade,
  UpgradeId,
  Vec,
} from '../engine/types';
import type { EndingId } from '../engine/lore';

const KEY = 'dedalo.run.v1';

/**
 * Cambia questo numero quando la forma di `GameState` cambia: i salvataggi
 * vecchi vengono scartati invece di produrre una run corrotta.
 */
const VERSION = 1;

const LOG_LIMIT = 60;

/** Fasi che vale la pena riprendere: a run conclusa il salvataggio si cancella. */
const RESUMABLE: readonly Phase[] = ['playing', 'upgrade', 'finale'];

export function isResumable(phase: Phase): boolean {
  return RESUMABLE.includes(phase);
}

interface SavedLevel {
  readonly width: number;
  readonly height: number;
  readonly tiles: string;
  readonly visibility: string;
  readonly entrance: Vec;
  readonly exit: Vec;
}

type SavedState = Omit<GameState, 'level'> & { readonly level: SavedLevel };

interface Envelope {
  readonly version: number;
  readonly state: SavedState;
}

/* ------------------------------------------------------------------ base64 */

/** Conversione a blocchi: lo spread su array grandi farebbe esplodere lo stack. */
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* ---------------------------------------------------------------- validazione */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function num(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function str(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isVec(value: unknown): value is Vec {
  return isRecord(value) && num(value.x) && num(value.y);
}

/**
 * I controlli sono strutturali, non semantici: questi dati li abbiamo scritti
 * noi, quindi il rischio reale non è la manomissione ma un salvataggio di una
 * versione precedente del gioco — e a quello pensa già `VERSION`. Qui basta
 * evitare che un salvataggio troncato o corrotto faccia partire una run rotta.
 */
function isActor(value: unknown): value is Actor {
  return (
    isRecord(value) &&
    num(value.id) &&
    str(value.kind) &&
    isVec(value.pos) &&
    num(value.hp) &&
    num(value.maxHp) &&
    num(value.damage) &&
    num(value.clock) &&
    num(value.speed) &&
    str(value.ai) &&
    (value.target === null || isVec(value.target))
  );
}

function isItem(value: unknown): value is Item {
  return isRecord(value) && num(value.id) && str(value.kind) && isVec(value.pos);
}

function isStats(value: unknown): value is PlayerStats {
  return (
    isRecord(value) &&
    num(value.maxHp) &&
    num(value.maxEnergy) &&
    num(value.damage) &&
    num(value.vision) &&
    num(value.regenEvery) &&
    num(value.magnet) &&
    num(value.armor)
  );
}

function isLogEntry(value: unknown): value is LogEntry {
  return isRecord(value) && num(value.id) && typeof value.text === 'string' && str(value.tone);
}

function isUpgrade(value: unknown): value is Upgrade {
  return (
    isRecord(value) &&
    str(value.id) &&
    typeof value.name === 'string' &&
    typeof value.description === 'string'
  );
}

function every<T>(value: unknown, guard: (item: unknown) => item is T): value is readonly T[] {
  return Array.isArray(value) && value.every(guard);
}

function decodeLevel(value: unknown): Level | null {
  if (!isRecord(value)) return null;
  const { width, height, tiles, visibility, entrance, exit } = value;
  if (!num(width) || !num(height) || width <= 0 || height <= 0) return null;
  if (!str(tiles) || !str(visibility)) return null;
  if (!isVec(entrance) || !isVec(exit)) return null;

  const decodedTiles = fromBase64(tiles);
  const decodedVisibility = fromBase64(visibility);
  const expected = width * height;
  if (decodedTiles.length !== expected || decodedVisibility.length !== expected) return null;

  return {
    width,
    height,
    tiles: decodedTiles,
    visibility: decodedVisibility,
    entrance,
    exit,
  };
}

/* ------------------------------------------------------------- serializzazione */

export function encodeRun(state: GameState): string {
  const level: SavedLevel = {
    width: state.level.width,
    height: state.level.height,
    tiles: toBase64(state.level.tiles),
    visibility: toBase64(state.level.visibility),
    entrance: state.level.entrance,
    exit: state.level.exit,
  };
  const envelope: Envelope = { version: VERSION, state: { ...state, level } };
  return JSON.stringify(envelope);
}

export function decodeRun(text: string): GameState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || parsed.version !== VERSION) return null;
  const state = parsed.state;
  if (!isRecord(state)) return null;

  const phase = state.phase;
  if (!str(phase) || !RESUMABLE.includes(phase as Phase)) return null;

  const level = decodeLevel(state.level);
  if (!level) return null;

  if (!isActor(state.player) || !isStats(state.stats)) return null;
  if (!every(state.enemies, isActor) || !every(state.items, isItem)) return null;
  if (!every(state.log, isLogEntry) || !every(state.upgradeChoices, isUpgrade)) return null;
  if (!every<string>(state.acquired, str)) return null;
  if (
    !num(state.seed) ||
    !num(state.rngState) ||
    !num(state.depth) ||
    !num(state.energy) ||
    !num(state.keys) ||
    !num(state.shards) ||
    !num(state.records) ||
    !num(state.turn) ||
    !num(state.nextId) ||
    !num(state.nextLogId)
  ) {
    return null;
  }
  if (typeof state.sealed !== 'boolean') return null;
  if (state.ending !== null && !str(state.ending)) return null;

  // Ricostruito campo per campo invece che con uno spread: così il compilatore
  // verifica che il salvataggio copra davvero tutto `GameState`.
  return {
    phase: phase as Phase,
    seed: state.seed,
    rngState: state.rngState,
    depth: state.depth,
    level,
    player: state.player,
    enemies: state.enemies,
    items: state.items,
    stats: state.stats,
    energy: state.energy,
    keys: state.keys,
    shards: state.shards,
    records: state.records,
    sealed: state.sealed,
    ending: state.ending as EndingId | null,
    turn: state.turn,
    log: state.log,
    upgradeChoices: state.upgradeChoices,
    acquired: state.acquired as readonly UpgradeId[],
    nextId: state.nextId,
    nextLogId: state.nextLogId,
    // Gli effetti sono roba dell'ultimo fotogramma: ripescarli mostrerebbe
    // numeri di danno e scosse di camera per colpi presi ieri.
    fx: [],
  };
}

/** Riga di registro che spiega al giocatore perché è già dentro al labirinto. */
export function withResumeNotice(state: GameState): GameState {
  const entry: LogEntry = {
    id: state.nextLogId,
    text: 'Spedizione ripresa.',
    tone: 'system',
  };
  return {
    ...state,
    log: [...state.log, entry].slice(-LOG_LIMIT),
    nextLogId: state.nextLogId + 1,
  };
}

/* ------------------------------------------------------------------ storage */

/** Accesso difensivo: in modalità privata o con storage pieno il gioco continua. */
export function saveRun(state: GameState): void {
  try {
    if (!isResumable(state.phase)) {
      window.localStorage.removeItem(KEY);
      return;
    }
    window.localStorage.setItem(KEY, encodeRun(state));
  } catch {
    /* niente storage: si gioca lo stesso, semplicemente senza ripresa */
  }
}

export function loadRun(): GameState | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const state = decodeRun(raw);
    if (!state) {
      // Salvataggio illeggibile o di una versione precedente: si riparte puliti.
      window.localStorage.removeItem(KEY);
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

export function clearRun(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* vedi sopra */
  }
}
