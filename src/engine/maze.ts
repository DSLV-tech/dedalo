import { chance, next, pick, range, shuffle } from './rng';
import type { Rng } from './rng';
import { DELTA, DIRECTIONS, idx } from './grid';
import type { Level, Vec } from './types';
import { Tile, Visibility } from './types';

export interface MazeOptions {
  readonly width: number;
  readonly height: number;
  /** Tentativi di piazzamento stanze: più alto = pianta più "dungeon". */
  readonly roomAttempts: number;
  /** 0 = corridoi dritti, 1 = corridoi tortuosi. */
  readonly windiness: number;
  /** Quota di vicoli ciechi lasciati aperti: 0 = dungeon pulito, 1 = labirinto puro. */
  readonly deadEndKeep: number;
  /** Probabilità di aprire un collegamento ridondante fra due regioni già unite. */
  readonly extraConnectors: number;
}

export interface Room {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface MazeResult {
  readonly width: number;
  readonly height: number;
  readonly tiles: Uint8Array;
  readonly rooms: readonly Room[];
  readonly floors: readonly Vec[];
}

/** Forza dimensioni dispari: il carving lavora su celle dispari. */
function odd(n: number): number {
  return n % 2 === 0 ? n - 1 : n;
}

/**
 * Generatore ibrido stanze + labirinto (approccio "rooms and mazes"):
 * 1. piazza stanze non sovrapposte,
 * 2. riempie lo spazio residuo con un labirinto perfetto (growing tree),
 * 3. unisce tutte le regioni con connettori scelti a caso,
 * 4. pota i vicoli ciechi lasciandone una quota controllata.
 * Il risultato è sempre completamente connesso — garantito dal passo 3 e
 * verificato dai test.
 */
export function generateMaze(rng: Rng, options: MazeOptions): MazeResult {
  const width = odd(options.width);
  const height = odd(options.height);
  const tiles = new Uint8Array(width * height).fill(Tile.Wall);
  const regions = new Int32Array(width * height).fill(-1);
  let currentRegion = -1;

  const carve = (x: number, y: number, tile: number = Tile.Floor): void => {
    tiles[idx(width, x, y)] = tile;
    regions[idx(width, x, y)] = currentRegion;
  };

  // --- 1. stanze -----------------------------------------------------------
  const rooms: Room[] = [];
  for (let attempt = 0; attempt < options.roomAttempts; attempt++) {
    const size = range(rng, 1, 3) * 2 + 1;
    const rectangularity = range(rng, 0, 1 + Math.floor(size / 2)) * 2;
    let w = size;
    let h = size;
    if (chance(rng, 0.5)) w += rectangularity;
    else h += rectangularity;

    const x = range(rng, 0, Math.floor((width - w - 1) / 2)) * 2 + 1;
    const y = range(rng, 0, Math.floor((height - h - 1) / 2)) * 2 + 1;
    if (x + w >= width || y + h >= height) continue;

    const room: Room = { x, y, w, h };
    const overlaps = rooms.some(
      (other) =>
        room.x <= other.x + other.w &&
        other.x <= room.x + room.w &&
        room.y <= other.y + other.h &&
        other.y <= room.y + room.h,
    );
    if (overlaps) continue;

    rooms.push(room);
    currentRegion++;
    for (let ry = y; ry < y + h; ry++) {
      for (let rx = x; rx < x + w; rx++) carve(rx, ry);
    }
  }

  // --- 2. labirinto nello spazio residuo -----------------------------------
  for (let y = 1; y < height; y += 2) {
    for (let x = 1; x < width; x += 2) {
      if (tiles[idx(width, x, y)] !== Tile.Wall) continue;
      currentRegion++;
      growMaze(rng, { x, y }, width, height, tiles, options.windiness, carve);
    }
  }

  // --- 3. connessione delle regioni ---------------------------------------
  connectRegions(rng, width, height, tiles, regions, options.extraConnectors);

  // --- 4. potatura dei vicoli ciechi --------------------------------------
  pruneDeadEnds(rng, width, height, tiles, options.deadEndKeep);

  const floors: Vec[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[idx(width, x, y)] !== Tile.Wall) floors.push({ x, y });
    }
  }

  return { width, height, tiles, rooms, floors };
}

function growMaze(
  rng: Rng,
  start: Vec,
  width: number,
  height: number,
  tiles: Uint8Array,
  windiness: number,
  carve: (x: number, y: number) => void,
): void {
  const cells: Vec[] = [];
  carve(start.x, start.y);
  cells.push(start);
  let lastDir: Vec | null = null;

  while (cells.length > 0) {
    const cell = cells[cells.length - 1] as Vec;
    const open: Vec[] = [];
    for (const dir of DIRECTIONS) {
      const d = DELTA[dir];
      const nx = cell.x + d.x * 2;
      const ny = cell.y + d.y * 2;
      if (nx <= 0 || ny <= 0 || nx >= width - 1 || ny >= height - 1) continue;
      if (tiles[idx(width, nx, ny)] !== Tile.Wall) continue;
      open.push(d);
    }

    if (open.length === 0) {
      cells.pop();
      lastDir = null;
      continue;
    }

    const previous: Vec | null = lastDir;
    const canGoStraight =
      previous !== null && open.some((d) => d.x === previous.x && d.y === previous.y);
    const dir: Vec =
      canGoStraight && previous !== null && next(rng) > windiness ? previous : pick(rng, open);

    carve(cell.x + dir.x, cell.y + dir.y);
    carve(cell.x + dir.x * 2, cell.y + dir.y * 2);
    cells.push({ x: cell.x + dir.x * 2, y: cell.y + dir.y * 2 });
    lastDir = dir;
  }
}

function connectRegions(
  rng: Rng,
  width: number,
  height: number,
  tiles: Uint8Array,
  regions: Int32Array,
  extraChance: number,
): void {
  interface Connector {
    readonly pos: Vec;
    readonly regions: readonly number[];
  }

  const connectors: Connector[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (tiles[idx(width, x, y)] !== Tile.Wall) continue;
      const found = new Set<number>();
      for (const dir of DIRECTIONS) {
        const d = DELTA[dir];
        const r = regions[idx(width, x + d.x, y + d.y)];
        if (r !== undefined && r >= 0) found.add(r);
      }
      if (found.size >= 2) connectors.push({ pos: { x, y }, regions: [...found] });
    }
  }

  // Union-find: unisce le regioni man mano che apriamo i varchi.
  const parent = new Map<number, number>();
  const find = (a: number): number => {
    let root = a;
    while (parent.get(root) !== undefined && parent.get(root) !== root) {
      root = parent.get(root) as number;
    }
    parent.set(a, root);
    return root;
  };
  const union = (a: number, b: number): void => {
    parent.set(find(a), find(b));
  };
  for (const c of connectors) for (const r of c.regions) if (!parent.has(r)) parent.set(r, r);

  for (const connector of shuffle(rng, connectors)) {
    const roots = new Set(connector.regions.map(find));
    if (roots.size >= 2) {
      const [first, ...rest] = [...roots];
      for (const r of rest) union(r, first as number);
      tiles[idx(width, connector.pos.x, connector.pos.y)] = Tile.Floor;
    } else if (chance(rng, extraChance)) {
      // Anello ridondante: rende il labirinto meno ad albero e più navigabile.
      tiles[idx(width, connector.pos.x, connector.pos.y)] = Tile.Floor;
    }
  }
}

function pruneDeadEnds(
  rng: Rng,
  width: number,
  height: number,
  tiles: Uint8Array,
  keep: number,
): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (tiles[idx(width, x, y)] === Tile.Wall) continue;
        let exits = 0;
        for (const dir of DIRECTIONS) {
          const d = DELTA[dir];
          if (tiles[idx(width, x + d.x, y + d.y)] !== Tile.Wall) exits++;
        }
        if (exits !== 1) continue;
        if (chance(rng, keep)) continue;
        tiles[idx(width, x, y)] = Tile.Wall;
        changed = true;
      }
    }
  }
}

/** Costruisce un Level a partire dai tile grezzi, con visibilità azzerata. */
export function toLevel(
  tiles: Uint8Array,
  width: number,
  height: number,
  entrance: Vec,
  exit: Vec,
): Level {
  return {
    width,
    height,
    tiles,
    visibility: new Uint8Array(width * height).fill(Visibility.Unknown),
    entrance,
    exit,
  };
}
