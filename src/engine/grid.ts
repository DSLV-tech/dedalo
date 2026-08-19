import type { Direction, Level, TileId, Vec } from './types';
import { Tile } from './types';

export const DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left'];

export const DELTA: Readonly<Record<Direction, Vec>> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

export function idx(width: number, x: number, y: number): number {
  return y * width + x;
}

export function inBounds(level: Pick<Level, 'width' | 'height'>, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < level.width && y < level.height;
}

export function tileAt(level: Level, x: number, y: number): TileId {
  if (!inBounds(level, x, y)) return Tile.Wall;
  return (level.tiles[idx(level.width, x, y)] ?? Tile.Wall) as TileId;
}

/** Il tile lascia passare la luce? Le porte chiuse a chiave bloccano la vista. */
export function isTransparent(level: Level, x: number, y: number): boolean {
  const t = tileAt(level, x, y);
  return t !== Tile.Wall && t !== Tile.VaultDoor;
}

/** Il tile è calpestabile senza abilità speciali? */
export function isWalkable(level: Level, x: number, y: number): boolean {
  const t = tileAt(level, x, y);
  return t === Tile.Floor || t === Tile.Door || t === Tile.Exit;
}

export function equals(a: Vec, b: Vec): boolean {
  return a.x === b.x && a.y === b.y;
}

export function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y };
}

/** Distanza di Chebyshev: adatta a una griglia con vista a 8 direzioni. */
export function chebyshev(a: Vec, b: Vec): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function manhattan(a: Vec, b: Vec): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
