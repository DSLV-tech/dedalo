import { generateMaze, toLevel } from './maze';
import { distanceField, farthestFrom } from './pathfinding';
import { DELTA, DIRECTIONS, idx, isWalkable } from './grid';
import { chance, pick, shuffle } from './rng';
import type { Rng } from './rng';
import { ANCHOR_COUNT, ENEMIES, MAX_DEPTH, enemyTemplate, planForDepth } from './content';
import type { Actor, Item, ItemKind, Level, Vec } from './types';
import { Tile } from './types';

export interface BuiltLevel {
  readonly level: Level;
  readonly enemies: readonly Actor[];
  readonly items: readonly Item[];
  readonly nextId: number;
  /** Vero solo sul piano del Nucleo: l'uscita resta chiusa finché l'Architetto è vivo. */
  readonly sealed: boolean;
}

function key(pos: Vec): string {
  return `${pos.x},${pos.y}`;
}

function countExits(level: Level, pos: Vec): number {
  let exits = 0;
  for (const dir of DIRECTIONS) {
    const d = DELTA[dir];
    if (isWalkable(level, pos.x + d.x, pos.y + d.y)) exits++;
  }
  return exits;
}

/**
 * Assembla un piano completo: geometria, uscita, caveau, nemici e oggetti.
 * Tutto derivato dal solo `rng`, quindi lo stesso seed produce lo stesso piano.
 */
export function buildLevel(rng: Rng, depth: number, startId: number): BuiltLevel {
  const plan = planForDepth(depth);
  const isFinal = depth >= MAX_DEPTH;
  const maze = generateMaze(rng, {
    width: plan.width,
    height: plan.height,
    roomAttempts: plan.roomAttempts,
    windiness: plan.windiness,
    deadEndKeep: plan.deadEndKeep,
    extraConnectors: plan.extraConnectors,
  });

  const entrance = pick(rng, maze.floors);
  let level = toLevel(maze.tiles, maze.width, maze.height, entrance, entrance);
  const exit = farthestFrom(level, entrance);
  maze.tiles[idx(maze.width, exit.x, exit.y)] = Tile.Exit;
  level = toLevel(maze.tiles, maze.width, maze.height, entrance, exit);

  const field = distanceField(level, entrance, Number.MAX_SAFE_INTEGER);
  const distanceTo = (pos: Vec): number => field[idx(level.width, pos.x, pos.y)] ?? -1;
  const maxDistance = Math.max(...maze.floors.map(distanceTo), 1);

  const occupied = new Set<string>([key(entrance), key(exit)]);
  const free = shuffle(
    rng,
    maze.floors.filter((p) => distanceTo(p) >= 0 && !occupied.has(key(p))),
  );

  const take = (predicate: (pos: Vec) => boolean): Vec | null => {
    const index = free.findIndex((p) => !occupied.has(key(p)) && predicate(p));
    if (index === -1) return null;
    const pos = free[index] as Vec;
    occupied.add(key(pos));
    return pos;
  };

  let nextId = startId;
  const items: Item[] = [];
  const enemies: Actor[] = [];

  const addItem = (kind: ItemKind, pos: Vec): void => {
    items.push({ id: nextId++, kind, pos });
  };

  // --- caveau: dietro una porta blindata, in fondo a un vicolo cieco --------
  let vaultPlaced = false;
  if (plan.hasVault) {
    const deadEnd = take((p) => countExits(level, p) === 1 && distanceTo(p) > maxDistance * 0.35);
    if (deadEnd) {
      const doorDir = DIRECTIONS.find((dir) => {
        const d = DELTA[dir];
        return isWalkable(level, deadEnd.x + d.x, deadEnd.y + d.y);
      });
      if (doorDir) {
        const d = DELTA[doorDir];
        const doorPos = { x: deadEnd.x + d.x, y: deadEnd.y + d.y };
        // La porta va sul corridoio solo se non è a sua volta un incrocio.
        if (countExits(level, doorPos) <= 2) {
          maze.tiles[idx(level.width, doorPos.x, doorPos.y)] = Tile.VaultDoor;
          occupied.add(key(doorPos));
          // Una cella = un oggetto: il caveau custodisce un registro dell'archivio.
          addItem('record', deadEnd);
          vaultPlaced = true;
        }
      }
    }
  }
  if (vaultPlaced) {
    const keyPos = take((p) => distanceTo(p) < maxDistance * 0.7);
    if (keyPos) addItem('key', keyPos);
  }

  // --- loot ----------------------------------------------------------------
  for (let i = 0; i < plan.shardCount; i++) {
    const pos = take((p) => (chance(rng, 0.6) ? countExits(level, p) === 1 : true));
    if (pos) addItem('shard', pos);
  }
  for (let i = 0; i < plan.cellCount; i++) {
    const pos = take(() => true);
    if (pos) addItem('cell', pos);
  }
  const repairs = plan.repairCount + (vaultPlaced ? 1 : 0);
  for (let i = 0; i < repairs; i++) {
    const pos = take(() => true);
    if (pos) addItem('repair', pos);
  }
  if (!vaultPlaced && chance(rng, 0.5)) {
    const pos = take(() => true);
    if (pos) addItem('chip', pos);
  }

  // --- nemici --------------------------------------------------------------
  const pool = ENEMIES.filter((e) => e.minDepth <= depth);
  const weighted: string[] = [];
  for (const template of pool) {
    const bonus = template.minDepth >= 6 ? Math.max(0, depth - 5) : 0;
    for (let i = 0; i < template.weight + bonus; i++) weighted.push(template.kind);
  }

  // Sul piano del Nucleo la fauna ordinaria si dimezza: lo spazio è per l'Architetto.
  const regularCount = isFinal ? Math.floor(plan.enemyCount / 2) : plan.enemyCount;
  for (let i = 0; i < regularCount; i++) {
    const kind = pick(rng, weighted) as (typeof ENEMIES)[number]['kind'];
    const template = enemyTemplate(kind);
    const pos = take((p) =>
      template.stationary
        ? countExits(level, p) >= 3 && distanceTo(p) > 6
        : distanceTo(p) > 8,
    ) ?? take((p) => distanceTo(p) > 4);
    if (!pos) continue;
    const hpBonus = Math.floor(depth / 3);
    enemies.push({
      id: nextId++,
      kind: template.kind,
      pos,
      hp: template.hp + hpBonus,
      maxHp: template.hp + hpBonus,
      damage: template.damage + Math.floor(depth / 5),
      clock: 0,
      speed: template.speed,
      ai: 'idle',
      target: null,
    });
  }

  // --- piano finale: Architetto + ancoraggi -------------------------------
  if (isFinal) {
    const spawnFixed = (kind: 'anchor' | 'architect', pos: Vec): void => {
      const template = enemyTemplate(kind);
      enemies.push({
        id: nextId++,
        kind,
        pos,
        hp: template.hp,
        maxHp: template.hp,
        damage: template.damage,
        clock: 0,
        speed: template.speed,
        ai: 'idle',
        target: null,
      });
    };

    for (let i = 0; i < ANCHOR_COUNT; i++) {
      const pos =
        take((p) => countExits(level, p) >= 3 && distanceTo(p) > maxDistance * 0.3) ??
        take((p) => distanceTo(p) > maxDistance * 0.2) ??
        take(() => true);
      if (pos) spawnFixed('anchor', pos);
    }

    const bossPos =
      take((p) => distanceTo(p) > maxDistance * 0.55 && countExits(level, p) >= 2) ??
      take((p) => distanceTo(p) > maxDistance * 0.4) ??
      take(() => true);
    if (bossPos) spawnFixed('architect', bossPos);
  }

  return {
    level: toLevel(maze.tiles, maze.width, maze.height, entrance, exit),
    enemies,
    items,
    nextId,
    sealed: isFinal,
  };
}
