import type { ActorKind, ItemKind } from '../engine/types';

/** Palette neon: pochi toni saturi su nero, ognuno con un ruolo preciso. */
export const PALETTE = {
  background: '#04060d',
  grid: '#0a1020',
  wallVisible: '#31f5ff',
  wallExplored: '#1f7286',
  floorVisible: 'rgba(20, 120, 140, 0.16)',
  floorExplored: 'rgba(16, 60, 76, 0.42)',
  player: '#7cff5a',
  exit: '#ffd23f',
  vault: '#ff8a3d',
  door: '#8ab4ff',
  text: '#dff7ff',
  danger: '#ff3d68',
} as const;

export const ACTOR_COLOR: Readonly<Record<ActorKind, string>> = {
  player: PALETTE.player,
  sentinel: '#ffb03a',
  stalker: '#ff4fd8',
  node: '#ff3d68',
  warden: '#b388ff',
  anchor: '#ff8a3d',
  architect: '#f2fbff',
};

export const ITEM_COLOR: Readonly<Record<ItemKind, string>> = {
  shard: '#31f5ff',
  cell: '#ffe066',
  repair: '#7cff5a',
  key: '#ffb03a',
  chip: '#8ab4ff',
  record: '#ffd23f',
};
