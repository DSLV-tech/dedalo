import type { EnemyKind, ItemKind, PlayerStats, Upgrade, UpgradeId } from './types';

export const ACTION_COST = 100;
export const PLAYER_SPEED = 100;
export const MAX_DEPTH = 12;

export const PULSE_COST = 3;
export const PHASE_COST = 5;

export interface EnemyTemplate {
  readonly kind: EnemyKind;
  readonly label: string;
  readonly hp: number;
  readonly damage: number;
  readonly speed: number;
  /** I nodi non si muovono: presidiano un incrocio. */
  readonly stationary: boolean;
  /** Distanza entro cui percepisce il giocatore anche senza vederlo. */
  readonly senseRadius: number;
  /** Profondità minima di comparsa. */
  readonly minDepth: number;
  readonly weight: number;
}

export const ENEMIES: readonly EnemyTemplate[] = [
  { kind: 'sentinel', label: 'Sentinella', hp: 6, damage: 2, speed: 60, stationary: false, senseRadius: 4, minDepth: 1, weight: 10 },
  { kind: 'stalker', label: 'Segugio', hp: 4, damage: 3, speed: 150, stationary: false, senseRadius: 7, minDepth: 2, weight: 8 },
  { kind: 'node', label: 'Nodo', hp: 10, damage: 4, speed: 100, stationary: true, senseRadius: 2, minDepth: 3, weight: 5 },
  { kind: 'warden', label: 'Custode', hp: 18, damage: 5, speed: 80, stationary: false, senseRadius: 6, minDepth: 6, weight: 4 },
  // minDepth oltre il fondo del Dedalo: non entrano mai nel sorteggio, li piazza a mano il piano finale.
  { kind: 'anchor', label: 'Ancoraggio', hp: 16, damage: 3, speed: 100, stationary: true, senseRadius: 3, minDepth: 99, weight: 0 },
  { kind: 'architect', label: 'Architetto', hp: 70, damage: 7, speed: 90, stationary: false, senseRadius: 14, minDepth: 99, weight: 0 },
];

/** Quanti ancoraggi tengono l'Architetto invulnerabile all'ultimo piano. */
export const ANCHOR_COUNT = 3;

export function enemyTemplate(kind: EnemyKind): EnemyTemplate {
  const found = ENEMIES.find((e) => e.kind === kind);
  if (!found) throw new Error(`Template mancante: ${kind}`);
  return found;
}

export const ITEM_LABELS: Readonly<Record<ItemKind, string>> = {
  shard: 'frammento',
  cell: 'cella energetica',
  repair: 'kit di riparazione',
  key: 'chiave',
  chip: 'chip cartografico',
  record: 'registro',
};

export const BASE_STATS: PlayerStats = {
  maxHp: 20,
  maxEnergy: 10,
  damage: 4,
  vision: 7,
  regenEvery: 12,
  magnet: 1,
  armor: 0,
};

export const UPGRADES: readonly Upgrade[] = [
  { id: 'vitals', name: 'Bio-innesto', description: '+6 integrità massima, e ti ripara subito di 6.' },
  { id: 'capacitor', name: 'Condensatore', description: '+4 energia massima, ricarica completa.' },
  { id: 'edge', name: 'Lama a induzione', description: '+2 danno in mischia.' },
  { id: 'optics', name: 'Ottiche estese', description: '+2 raggio visivo nel labirinto.' },
  { id: 'recycler', name: 'Riciclatore', description: 'Rigenerazione energia più rapida (ogni 6 turni).' },
  { id: 'magnet', name: 'Campo attrattivo', description: '+2 raggio di raccolta automatica dei frammenti.' },
  { id: 'plating', name: 'Piastre reattive', description: '+1 armatura: assorbi 1 danno a ogni colpo.' },
  { id: 'overclock', name: 'Overclock', description: '+1 danno e +2 energia massima.' },
];

export function applyUpgrade(
  stats: PlayerStats,
  id: UpgradeId,
): { readonly stats: PlayerStats; readonly healHp: number; readonly refillEnergy: boolean } {
  switch (id) {
    case 'vitals':
      return { stats: { ...stats, maxHp: stats.maxHp + 6 }, healHp: 6, refillEnergy: false };
    case 'capacitor':
      return { stats: { ...stats, maxEnergy: stats.maxEnergy + 4 }, healHp: 0, refillEnergy: true };
    case 'edge':
      return { stats: { ...stats, damage: stats.damage + 2 }, healHp: 0, refillEnergy: false };
    case 'optics':
      return { stats: { ...stats, vision: stats.vision + 2 }, healHp: 0, refillEnergy: false };
    case 'recycler':
      return { stats: { ...stats, regenEvery: 6 }, healHp: 0, refillEnergy: false };
    case 'magnet':
      return { stats: { ...stats, magnet: stats.magnet + 2 }, healHp: 0, refillEnergy: false };
    case 'plating':
      return { stats: { ...stats, armor: stats.armor + 1 }, healHp: 0, refillEnergy: false };
    case 'overclock':
      return {
        stats: { ...stats, damage: stats.damage + 1, maxEnergy: stats.maxEnergy + 2 },
        healHp: 0,
        refillEnergy: false,
      };
    default: {
      const exhaustive: never = id;
      throw new Error(`Upgrade sconosciuto: ${String(exhaustive)}`);
    }
  }
}

/** Curva di difficoltà: dimensioni, popolazione e loot per profondità. */
export interface DepthPlan {
  readonly width: number;
  readonly height: number;
  readonly enemyCount: number;
  readonly shardCount: number;
  readonly cellCount: number;
  readonly repairCount: number;
  readonly hasVault: boolean;
  readonly windiness: number;
  readonly deadEndKeep: number;
  readonly roomAttempts: number;
  readonly extraConnectors: number;
}

export function planForDepth(depth: number): DepthPlan {
  const step = Math.min(depth, MAX_DEPTH);
  const width = Math.min(21 + step * 4, 55);
  const height = Math.min(17 + step * 3, 43);
  return {
    width,
    height,
    enemyCount: 3 + Math.floor(step * 1.6),
    shardCount: 5 + step,
    cellCount: 2 + Math.floor(step / 3),
    repairCount: step % 2 === 0 ? 2 : 1,
    hasVault: step >= 2,
    // Più si scende, più il tracciato diventa tortuoso e povero di scorciatoie.
    windiness: Math.min(0.35 + step * 0.05, 0.85),
    deadEndKeep: Math.min(0.12 + step * 0.04, 0.5),
    roomAttempts: Math.max(30 - step * 2, 8),
    extraConnectors: Math.max(0.14 - step * 0.01, 0.03),
  };
}
