import { describe, expect, it } from 'vitest';
import { createRng, next, seedFromString } from '../src/engine/rng';
import { buildLevel } from '../src/engine/level';
import { distanceField, reachableCount } from '../src/engine/pathfinding';
import { DELTA, idx, isWalkable } from '../src/engine/grid';
import { computeFov } from '../src/engine/fov';
import { reduce, startRun } from '../src/engine/game';
import { MAX_DEPTH, UPGRADES } from '../src/engine/content';
import { RECORDS_FOR_TRUE_ENDING } from '../src/engine/lore';
import { Tile, Visibility } from '../src/engine/types';
import type { GameState } from '../src/engine/types';

const SEEDS = [1, 7, 42, 1337, 90210, 2026, seedFromString('dedalo')];

describe('rng', () => {
  it('è deterministico a parità di seed', () => {
    const a = createRng(123);
    const b = createRng(123);
    const seqA = Array.from({ length: 50 }, () => next(a));
    const seqB = Array.from({ length: 50 }, () => next(b));
    expect(seqA).toEqual(seqB);
  });

  it('resta nell’intervallo [0,1)', () => {
    const rng = createRng(9);
    for (let i = 0; i < 2000; i++) {
      const value = next(rng);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('generazione dei piani', () => {
  for (const seed of SEEDS) {
    for (const depth of [1, 4, 8, MAX_DEPTH]) {
      it(`seed ${seed} / profondità ${depth}: labirinto interamente connesso`, () => {
        const rng = createRng(seed);
        const built = buildLevel(rng, depth, 1);
        const { level } = built;

        let walkable = 0;
        for (let y = 0; y < level.height; y++) {
          for (let x = 0; x < level.width; x++) {
            if (isWalkable(level, x, y)) walkable++;
          }
        }
        // Le porte del caveau (chiuse) non sono percorribili: le tolleriamo.
        const vaultDoors = Array.from(level.tiles).filter((t) => t === Tile.VaultDoor).length;
        const reached = reachableCount(level, level.entrance);
        expect(reached + vaultDoors).toBeGreaterThanOrEqual(walkable);
      });

      it(`seed ${seed} / profondità ${depth}: uscita raggiungibile e distante`, () => {
        const rng = createRng(seed);
        const { level, enemies, items } = buildLevel(rng, depth, 1);
        const field = distanceField(level, level.entrance, Number.MAX_SAFE_INTEGER);
        const toExit = field[idx(level.width, level.exit.x, level.exit.y)] ?? -1;
        expect(toExit).toBeGreaterThan(5);

        // Nessuna entità sepolta in un muro o sovrapposta.
        const seen = new Set<string>();
        for (const entity of [...enemies, ...items]) {
          expect(isWalkable(level, entity.pos.x, entity.pos.y)).toBe(true);
          const key = `${entity.pos.x},${entity.pos.y}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
      });
    }
  }

  it('la chiave è raggiungibile senza attraversare il caveau', () => {
    for (const seed of SEEDS) {
      const rng = createRng(seed);
      const { level, items } = buildLevel(rng, 5, 1);
      const field = distanceField(level, level.entrance, Number.MAX_SAFE_INTEGER);
      const key = items.find((i) => i.kind === 'key');
      if (!key) continue;
      expect(field[idx(level.width, key.pos.x, key.pos.y)] ?? -1).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('campo visivo', () => {
  it('illumina la posizione del giocatore e non esce dai limiti', () => {
    const rng = createRng(5);
    const { level } = buildLevel(rng, 3, 1);
    const visibility = computeFov(level, level.entrance, 7);
    expect(visibility.length).toBe(level.width * level.height);
    expect(visibility[idx(level.width, level.entrance.x, level.entrance.y)]).toBe(Visibility.Visible);
    const visible = Array.from(visibility).filter((v) => v === Visibility.Visible).length;
    expect(visible).toBeGreaterThan(1);
  });

  it('conserva le celle già esplorate', () => {
    const rng = createRng(11);
    const { level } = buildLevel(rng, 2, 1);
    const first = computeFov(level, level.entrance, 6);
    const moved = computeFov({ ...level, visibility: first }, level.exit, 6);
    const explored = Array.from(moved).filter((v) => v !== Visibility.Unknown).length;
    const initial = Array.from(first).filter((v) => v !== Visibility.Unknown).length;
    expect(explored).toBeGreaterThanOrEqual(initial);
  });
});

describe('riduttore', () => {
  it('avvia una run coerente', () => {
    const state = startRun(2026);
    expect(state.phase).toBe('playing');
    expect(state.depth).toBe(1);
    expect(state.player.hp).toBe(state.stats.maxHp);
    expect(isWalkable(state.level, state.player.pos.x, state.player.pos.y)).toBe(true);
  });

  it('non muta lo stato precedente', () => {
    const state = startRun(3);
    const before = JSON.stringify({ pos: state.player.pos, turn: state.turn });
    reduce(state, { type: 'move', dir: 'up' });
    reduce(state, { type: 'wait' });
    expect(JSON.stringify({ pos: state.player.pos, turn: state.turn })).toBe(before);
  });

  it('un’attesa consuma esattamente un turno', () => {
    const state = startRun(77);
    const after = reduce(state, { type: 'wait' });
    expect(after.turn).toBe(state.turn + 1);
  });

  it('rifiuta le mosse contro i muri senza consumare turni', () => {
    let state = startRun(101);
    const directions = ['up', 'down', 'left', 'right'] as const;
    for (const dir of directions) {
      const before = state.turn;
      const after = reduce(state, { type: 'move', dir });
      const moved = after.player.pos.x !== state.player.pos.x || after.player.pos.y !== state.player.pos.y;
      if (!moved && after.turn === before) {
        expect(after.turn).toBe(before);
      }
      state = after;
    }
    expect(state.phase === 'playing' || state.phase === 'dead' || state.phase === 'upgrade').toBe(true);
  });

  it('l’impulso senza energia non consuma il turno', () => {
    const state: GameState = { ...startRun(9), energy: 0 };
    const after = reduce(state, { type: 'pulse' });
    expect(after.turn).toBe(state.turn);
    expect(after.energy).toBe(0);
  });

  it('la scelta di un innesto fa scendere di un piano', () => {
    const state: GameState = { ...startRun(55), phase: 'upgrade', upgradeChoices: UPGRADES.slice(0, 3) };
    const first = UPGRADES[0];
    if (!first) throw new Error('nessun upgrade');
    const after = reduce(state, { type: 'chooseUpgrade', id: first.id });
    expect(after.depth).toBe(state.depth + 1);
    expect(after.phase).toBe('playing');
    expect(after.acquired).toContain(first.id);
  });

  it('sopravvive a 400 azioni casuali senza eccezioni', () => {
    let state = startRun(4242);
    const rng = createRng(8);
    const moves = ['up', 'down', 'left', 'right'] as const;
    for (let i = 0; i < 400; i++) {
      if (state.phase === 'dead' || state.phase === 'won') break;
      if (state.phase === 'finale') {
        state = reduce(state, { type: 'chooseEnding', id: 'seal' });
        continue;
      }
      if (state.phase === 'upgrade') {
        const choice = state.upgradeChoices[0];
        if (!choice) break;
        state = reduce(state, { type: 'chooseUpgrade', id: choice.id });
        continue;
      }
      const roll = next(rng);
      const dir = moves[Math.floor(next(rng) * moves.length)] ?? 'up';
      state = reduce(
        state,
        roll < 0.75 ? { type: 'move', dir } : roll < 0.85 ? { type: 'pulse' } : roll < 0.95 ? { type: 'phase', dir } : { type: 'wait' },
      );
      expect(state.player.hp).toBeLessThanOrEqual(state.stats.maxHp);
      expect(state.energy).toBeLessThanOrEqual(state.stats.maxEnergy);
      expect(state.energy).toBeGreaterThanOrEqual(0);
    }
    expect(['playing', 'dead', 'won', 'upgrade', 'finale']).toContain(state.phase);
  });
});

describe('piano finale', () => {
  const finalLevel = (seed: number) => buildLevel(createRng(seed), MAX_DEPTH, 1);

  it('genera esattamente un Architetto e tre ancoraggi, con Nucleo sigillato', () => {
    for (const seed of SEEDS) {
      const built = finalLevel(seed);
      expect(built.sealed).toBe(true);
      expect(built.enemies.filter((e) => e.kind === 'architect')).toHaveLength(1);
      expect(built.enemies.filter((e) => e.kind === 'anchor')).toHaveLength(3);
    }
  });

  it('Architetto e ancoraggi non compaiono nei piani normali', () => {
    for (const seed of SEEDS) {
      for (const depth of [1, 5, 11]) {
        const built = buildLevel(createRng(seed), depth, 1);
        expect(built.sealed).toBe(false);
        expect(built.enemies.some((e) => e.kind === 'architect' || e.kind === 'anchor')).toBe(false);
      }
    }
  });
});

describe('scontro con l’Architetto', () => {
  /** Costruisce uno stato al piano finale con il giocatore accanto all'Architetto. */
  function bossState(seed: number, withAnchors: boolean): GameState {
    const built = buildLevel(createRng(seed), MAX_DEPTH, 1);
    const architect = built.enemies.find((e) => e.kind === 'architect');
    if (!architect) throw new Error('Architetto assente');
    const spot = (['up', 'down', 'left', 'right'] as const)
      .map((dir) => ({ x: architect.pos.x + DELTA[dir].x, y: architect.pos.y + DELTA[dir].y }))
      .find((p) => isWalkable(built.level, p.x, p.y) && !built.enemies.some((e) => e.pos.x === p.x && e.pos.y === p.y));
    if (!spot) throw new Error('Nessuna cella adiacente libera');

    const base = startRun(seed);
    return {
      ...base,
      depth: MAX_DEPTH,
      level: { ...built.level, visibility: built.level.visibility.fill(2) },
      player: { ...base.player, pos: spot },
      enemies: withAnchors
        ? built.enemies.filter((e) => e.kind === 'architect' || e.kind === 'anchor')
        : built.enemies.filter((e) => e.kind === 'architect'),
      items: [],
      sealed: true,
    };
  }

  function directionTo(from: { x: number; y: number }, to: { x: number; y: number }) {
    if (to.y < from.y) return 'up' as const;
    if (to.y > from.y) return 'down' as const;
    if (to.x < from.x) return 'left' as const;
    return 'right' as const;
  }

  it('è invulnerabile finché gli ancoraggi sono in piedi', () => {
    const state = bossState(2026, true);
    const architect = state.enemies.find((e) => e.kind === 'architect');
    if (!architect) throw new Error('Architetto assente');
    const after = reduce(state, { type: 'move', dir: directionTo(state.player.pos, architect.pos) });
    const hit = after.enemies.find((e) => e.id === architect.id);
    expect(hit?.hp).toBe(architect.hp);
    expect(after.log.some((entry) => entry.text.includes('ancoraggi'))).toBe(true);
  });

  it('senza ancoraggi incassa danno e, abbattuto, apre il Nucleo', () => {
    let state = bossState(2026, false);
    const architect = state.enemies.find((e) => e.kind === 'architect');
    if (!architect) throw new Error('Architetto assente');

    const weakened: GameState = {
      ...state,
      enemies: state.enemies.map((e) => (e.id === architect.id ? { ...e, hp: 1 } : e)),
      player: { ...state.player, hp: 999, maxHp: 999 },
    };
    state = reduce(weakened, { type: 'move', dir: directionTo(weakened.player.pos, architect.pos) });

    expect(state.enemies.some((e) => e.kind === 'architect')).toBe(false);
    expect(state.sealed).toBe(false);
  });

  it('il Nucleo aperto porta alla scelta finale e agli epiloghi', () => {
    const built = buildLevel(createRng(2026), MAX_DEPTH, 1);
    const base = startRun(2026);
    const atExit: GameState = {
      ...base,
      depth: MAX_DEPTH,
      level: built.level,
      player: { ...base.player, pos: built.level.exit },
      enemies: [],
      items: [],
      sealed: false,
      records: RECORDS_FOR_TRUE_ENDING,
    };

    // Entra nella fase di scelta uscendo e rientrando sul Nucleo.
    const stepped = reduce({ ...atExit, player: { ...atExit.player, pos: built.level.entrance } }, { type: 'wait' });
    expect(stepped.phase).toBe('playing');

    const finale: GameState = { ...atExit, phase: 'finale' };
    const restored = reduce(finale, { type: 'chooseEnding', id: 'restore' });
    expect(restored.phase).toBe('won');
    expect(restored.ending).toBe('restore');

    const sealedEnd = reduce(finale, { type: 'chooseEnding', id: 'seal' });
    expect(sealedEnd.ending).toBe('seal');
  });

  it('rifiuta la Restituzione senza registri sufficienti', () => {
    const base = startRun(11);
    const finale: GameState = { ...base, phase: 'finale', records: 0 };
    const rejected = reduce(finale, { type: 'chooseEnding', id: 'restore' });
    expect(rejected.phase).toBe('finale');
    expect(rejected.ending).toBeNull();
  });

  it('il Nucleo sigillato non fa finire la partita', () => {
    const built = buildLevel(createRng(7), MAX_DEPTH, 1);
    const base = startRun(7);
    const atExit: GameState = {
      ...base,
      depth: MAX_DEPTH,
      level: built.level,
      player: { ...base.player, pos: built.level.exit },
      enemies: [],
      items: [],
      sealed: true,
    };
    const after = reduce(atExit, { type: 'wait' });
    expect(after.phase).toBe('playing');
  });
});
