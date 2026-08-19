export const SFX = [
  'step',
  'hit',
  'hurt',
  'pickup',
  'record',
  'pulse',
  'phase',
  'death',
  'deny',
  'descend',
  'boss',
  'gameover',
  'victory',
  'ui',
] as const;

export type SfxName = (typeof SFX)[number];

export const MUSIC = ['menu', 'shallow', 'deep', 'core', 'boss', 'epilogue'] as const;

export type MusicName = (typeof MUSIC)[number];

/** Il brano cambia a fasce di profondità: la discesa si sente, non solo si legge. */
export function musicForDepth(depth: number): MusicName {
  if (depth >= 12) return 'boss';
  if (depth >= 9) return 'core';
  if (depth >= 5) return 'deep';
  return 'shallow';
}

/** Volume relativo per effetto: evita di dover ri-masterizzare i file. */
export const SFX_GAIN: Readonly<Record<SfxName, number>> = {
  step: 0.22,
  hit: 0.7,
  hurt: 0.85,
  pickup: 0.5,
  record: 0.6,
  pulse: 0.75,
  phase: 0.6,
  death: 0.7,
  deny: 0.45,
  descend: 0.7,
  boss: 0.8,
  gameover: 0.8,
  victory: 0.8,
  ui: 0.35,
};
