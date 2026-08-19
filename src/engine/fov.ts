import { idx, inBounds, isTransparent } from './grid';
import type { Level, Vec } from './types';
import { Visibility } from './types';

interface Octant {
  readonly xx: number;
  readonly xy: number;
  readonly yx: number;
  readonly yy: number;
}

const OCTANTS: readonly Octant[] = [
  { xx: 1, xy: 0, yx: 0, yy: 1 },
  { xx: 0, xy: 1, yx: 1, yy: 0 },
  { xx: 0, xy: -1, yx: 1, yy: 0 },
  { xx: -1, xy: 0, yx: 0, yy: 1 },
  { xx: -1, xy: 0, yx: 0, yy: -1 },
  { xx: 0, xy: -1, yx: -1, yy: 0 },
  { xx: 0, xy: 1, yx: -1, yy: 0 },
  { xx: 1, xy: 0, yx: 0, yy: -1 },
];

/**
 * Recursive shadowcasting. Ritorna una NUOVA mappa di visibilità:
 * ciò che era visibile diventa "esplorato", ciò che il raggio raggiunge
 * torna "visibile". Nessuna mutazione del livello in ingresso.
 */
export function computeFov(level: Level, origin: Vec, radius: number): Uint8Array {
  const out = new Uint8Array(level.visibility.length);
  for (let i = 0; i < level.visibility.length; i++) {
    out[i] = level.visibility[i] === Visibility.Unknown ? Visibility.Unknown : Visibility.Explored;
  }

  const mark = (x: number, y: number): void => {
    if (!inBounds(level, x, y)) return;
    out[idx(level.width, x, y)] = Visibility.Visible;
  };

  mark(origin.x, origin.y);
  for (const octant of OCTANTS) {
    castLight(level, origin, radius, 1, 1, 0, octant, mark);
  }
  return out;
}

function castLight(
  level: Level,
  origin: Vec,
  radius: number,
  row: number,
  startSlope: number,
  endSlope: number,
  octant: Octant,
  mark: (x: number, y: number) => void,
): void {
  if (startSlope < endSlope) return;
  const radius2 = radius * radius;
  let nextStart = startSlope;

  for (let distance = row; distance <= radius; distance++) {
    let blocked = false;
    for (let deltaX = -distance; deltaX <= 0; deltaX++) {
      const deltaY = -distance;
      const currentX = origin.x + deltaX * octant.xx + deltaY * octant.xy;
      const currentY = origin.y + deltaX * octant.yx + deltaY * octant.yy;
      const leftSlope = (deltaX - 0.5) / (deltaY + 0.5);
      const rightSlope = (deltaX + 0.5) / (deltaY - 0.5);

      if (rightSlope > nextStart) continue;
      if (leftSlope < endSlope) break;

      if (deltaX * deltaX + deltaY * deltaY <= radius2) mark(currentX, currentY);

      const opaque = !isTransparent(level, currentX, currentY);
      if (blocked) {
        if (opaque) {
          nextStart = rightSlope;
        } else {
          blocked = false;
          startSlope = nextStart;
        }
      } else if (opaque && distance < radius) {
        blocked = true;
        castLight(level, origin, radius, distance + 1, startSlope, leftSlope, octant, mark);
        nextStart = rightSlope;
      }
    }
    if (blocked) break;
  }
}

export function isVisible(visibility: Uint8Array, width: number, pos: Vec): boolean {
  return visibility[idx(width, pos.x, pos.y)] === Visibility.Visible;
}
