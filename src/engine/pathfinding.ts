import { DELTA, DIRECTIONS, idx, inBounds, isWalkable } from './grid';
import type { Level, Vec } from './types';

/**
 * BFS a partire dal bersaglio: restituisce una "mappa di distanze" (Dijkstra map).
 * I nemici la leggono per scendere verso il giocatore senza ricalcolare un A*
 * a testa — un solo passaggio per turno, indipendente dal numero di nemici.
 */
export function distanceField(level: Level, from: Vec, maxDistance: number): Int32Array {
  const field = new Int32Array(level.width * level.height).fill(-1);
  if (!inBounds(level, from.x, from.y)) return field;

  field[idx(level.width, from.x, from.y)] = 0;
  let frontier: Vec[] = [from];

  while (frontier.length > 0) {
    const nextFrontier: Vec[] = [];
    for (const cell of frontier) {
      const distance = field[idx(level.width, cell.x, cell.y)] ?? 0;
      if (distance >= maxDistance) continue;
      for (const dir of DIRECTIONS) {
        const d = DELTA[dir];
        const nx = cell.x + d.x;
        const ny = cell.y + d.y;
        if (!inBounds(level, nx, ny)) continue;
        if (!isWalkable(level, nx, ny)) continue;
        if ((field[idx(level.width, nx, ny)] ?? -1) !== -1) continue;
        field[idx(level.width, nx, ny)] = distance + 1;
        nextFrontier.push({ x: nx, y: ny });
      }
    }
    frontier = nextFrontier;
  }
  return field;
}

/** Passo successivo lungo il gradiente discendente del campo, o null se bloccato. */
export function stepDownhill(
  level: Level,
  field: Int32Array,
  from: Vec,
  blocked: (pos: Vec) => boolean,
): Vec | null {
  const here = field[idx(level.width, from.x, from.y)] ?? -1;
  if (here <= 0) return null;
  let best: Vec | null = null;
  let bestValue = here;
  for (const dir of DIRECTIONS) {
    const d = DELTA[dir];
    const nx = from.x + d.x;
    const ny = from.y + d.y;
    if (!inBounds(level, nx, ny) || !isWalkable(level, nx, ny)) continue;
    const value = field[idx(level.width, nx, ny)] ?? -1;
    if (value < 0 || value >= bestValue) continue;
    if (blocked({ x: nx, y: ny })) continue;
    bestValue = value;
    best = { x: nx, y: ny };
  }
  return best;
}

/** Cella percorribile più lontana dal punto dato (usata per piazzare l'uscita). */
export function farthestFrom(level: Level, from: Vec): Vec {
  const field = distanceField(level, from, Number.MAX_SAFE_INTEGER);
  let best = from;
  let bestDistance = -1;
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const distance = field[idx(level.width, x, y)] ?? -1;
      if (distance > bestDistance) {
        bestDistance = distance;
        best = { x, y };
      }
    }
  }
  return best;
}

export function reachableCount(level: Level, from: Vec): number {
  const field = distanceField(level, from, Number.MAX_SAFE_INTEGER);
  let count = 0;
  for (let i = 0; i < field.length; i++) if ((field[i] ?? -1) >= 0) count++;
  return count;
}
