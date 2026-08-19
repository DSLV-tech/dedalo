/**
 * Tipi condivisi del motore.
 * Il motore è puro: nessun accesso al DOM, nessuna data/ora, nessun Math.random.
 * Tutta la casualità passa dal generatore seedato (`Rng`), così una run è
 * riproducibile a partire dal solo seed.
 */

import type { EndingId } from './lore';

export type { EndingId };

export interface Vec {
  readonly x: number;
  readonly y: number;
}

export const Tile = {
  Wall: 0,
  Floor: 1,
  Door: 2,
  VaultDoor: 3,
  Exit: 4,
} as const;

export type TileId = (typeof Tile)[keyof typeof Tile];

export const Visibility = {
  Unknown: 0,
  Explored: 1,
  Visible: 2,
} as const;

export type VisibilityId = (typeof Visibility)[keyof typeof Visibility];

export type ActorKind =
  | 'player'
  | 'sentinel'
  | 'stalker'
  | 'node'
  | 'warden'
  | 'anchor'
  | 'architect';

export type EnemyKind = Exclude<ActorKind, 'player'>;

export type AiState = 'idle' | 'hunting' | 'stunned';

export interface Actor {
  readonly id: number;
  readonly kind: ActorKind;
  readonly pos: Vec;
  readonly hp: number;
  readonly maxHp: number;
  readonly damage: number;
  /** Punti energia accumulati per il sistema a turni: agisce quando >= COST. */
  readonly clock: number;
  /** Punti guadagnati per turno di gioco: >100 = più veloce del giocatore. */
  readonly speed: number;
  readonly ai: AiState;
  /** Ultima posizione nota del giocatore, usata quando lo perde di vista. */
  readonly target: Vec | null;
}

export type ItemKind = 'shard' | 'cell' | 'repair' | 'key' | 'chip' | 'record';

export interface Item {
  readonly id: number;
  readonly kind: ItemKind;
  readonly pos: Vec;
}

export type UpgradeId =
  | 'vitals'
  | 'capacitor'
  | 'edge'
  | 'optics'
  | 'recycler'
  | 'magnet'
  | 'plating'
  | 'overclock';

export interface Upgrade {
  readonly id: UpgradeId;
  readonly name: string;
  readonly description: string;
}

export interface PlayerStats {
  readonly maxHp: number;
  readonly maxEnergy: number;
  readonly damage: number;
  readonly vision: number;
  /** Energia rigenerata ogni N turni (0 = mai). */
  readonly regenEvery: number;
  /** Raggio di raccolta automatica dei frammenti. */
  readonly magnet: number;
  /** Danno assorbito a ogni colpo subito. */
  readonly armor: number;
}

export interface Level {
  readonly width: number;
  readonly height: number;
  readonly tiles: Uint8Array;
  readonly visibility: Uint8Array;
  readonly entrance: Vec;
  readonly exit: Vec;
}

export interface LogEntry {
  readonly id: number;
  readonly text: string;
  readonly tone: 'neutral' | 'good' | 'bad' | 'system';
}

export type Phase = 'title' | 'playing' | 'upgrade' | 'finale' | 'dead' | 'won';

export interface GameState {
  readonly phase: Phase;
  readonly seed: number;
  readonly rngState: number;
  readonly depth: number;
  readonly level: Level;
  readonly player: Actor;
  readonly enemies: readonly Actor[];
  readonly items: readonly Item[];
  readonly stats: PlayerStats;
  readonly energy: number;
  readonly keys: number;
  readonly shards: number;
  /** Registri dell'archivio recuperati dai caveau: sbloccano l'epilogo "Restituzione". */
  readonly records: number;
  /** Il Nucleo è chiuso finché l'Architetto è in piedi (solo all'ultimo piano). */
  readonly sealed: boolean;
  readonly ending: EndingId | null;
  readonly turn: number;
  readonly log: readonly LogEntry[];
  readonly upgradeChoices: readonly Upgrade[];
  readonly acquired: readonly UpgradeId[];
  readonly nextId: number;
  readonly nextLogId: number;
  /** Impostato dall'ultimo passo, usato dal renderer per gli effetti. */
  readonly fx: readonly Fx[];
}

export interface Fx {
  readonly kind: 'hit' | 'pulse' | 'pickup' | 'phase' | 'death' | 'heal' | 'blocked';
  readonly pos: Vec;
  readonly at: number;
  /** Valore da far fluttuare a schermo (danno, cure). null = nessun numero. */
  readonly amount: number | null;
  readonly tone: 'good' | 'bad' | 'neutral';
  /** Vero se riguarda il giocatore: il renderer scuote la camera solo in quel caso. */
  readonly onPlayer: boolean;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export type GameAction =
  | { readonly type: 'start'; readonly seed: number }
  | { readonly type: 'move'; readonly dir: Direction }
  | { readonly type: 'wait' }
  | { readonly type: 'pulse' }
  | { readonly type: 'phase'; readonly dir: Direction }
  | { readonly type: 'chooseUpgrade'; readonly id: UpgradeId }
  | { readonly type: 'chooseEnding'; readonly id: EndingId }
  | { readonly type: 'restart' }
  | { readonly type: 'toTitle' };
