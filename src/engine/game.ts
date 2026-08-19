import { createRng, next, range, shuffle } from './rng';
import type { Rng } from './rng';
import { DELTA, add, chebyshev, equals, idx, inBounds, isWalkable, tileAt } from './grid';
import { computeFov } from './fov';
import { distanceField, stepDownhill } from './pathfinding';
import { buildLevel } from './level';
import {
  ACTION_COST,
  BASE_STATS,
  ITEM_LABELS,
  MAX_DEPTH,
  PHASE_COST,
  PULSE_COST,
  UPGRADES,
  applyUpgrade,
  enemyTemplate,
} from './content';
import {
  endingById,
  BOSS_DEFEATED,
  BOSS_INTRO,
  BOSS_UNSHIELDED,
  EXIT_SEALED,
  recordText,
} from './lore';
import type { EndingId } from './lore';
import type {
  Actor,
  Direction,
  Fx,
  GameAction,
  GameState,
  Item,
  Level,
  LogEntry,
  Vec,
} from './types';
import { Tile, Visibility } from './types';

const LOG_LIMIT = 60;

/** Stato mutabile interno a un singolo `reduce`: evita copie a catena. */
interface Draft {
  state: GameState;
  rng: Rng;
  log: LogEntry[];
  fx: Fx[];
  nextLogId: number;
}

function say(draft: Draft, text: string, tone: LogEntry['tone'] = 'neutral'): void {
  draft.log.push({ id: draft.nextLogId++, text, tone });
  if (draft.log.length > LOG_LIMIT) draft.log.splice(0, draft.log.length - LOG_LIMIT);
}

function emptyLevel(): Level {
  return {
    width: 1,
    height: 1,
    tiles: new Uint8Array(1),
    visibility: new Uint8Array(1),
    entrance: { x: 0, y: 0 },
    exit: { x: 0, y: 0 },
  };
}

export function createTitleState(seed: number): GameState {
  return {
    phase: 'title',
    seed,
    rngState: seed >>> 0,
    depth: 0,
    level: emptyLevel(),
    player: {
      id: 0,
      kind: 'player',
      pos: { x: 0, y: 0 },
      hp: BASE_STATS.maxHp,
      maxHp: BASE_STATS.maxHp,
      damage: BASE_STATS.damage,
      clock: 0,
      speed: 100,
      ai: 'idle',
      target: null,
    },
    enemies: [],
    items: [],
    stats: BASE_STATS,
    energy: BASE_STATS.maxEnergy,
    keys: 0,
    shards: 0,
    records: 0,
    sealed: false,
    ending: null,
    turn: 0,
    log: [],
    upgradeChoices: [],
    acquired: [],
    nextId: 1,
    nextLogId: 1,
    fx: [],
  };
}

export function startRun(seed: number): GameState {
  const base = createTitleState(seed);
  const rng = createRng(seed);
  const built = buildLevel(rng, 1, 1);
  const player: Actor = { ...base.player, pos: built.level.entrance, id: 0 };
  const visibility = computeFov(built.level, player.pos, BASE_STATS.vision);

  return {
    ...base,
    phase: 'playing',
    rngState: rng.state,
    depth: 1,
    level: { ...built.level, visibility },
    player,
    enemies: built.enemies,
    items: built.items,
    nextId: built.nextId,
    sealed: built.sealed,
    turn: 1,
    log: [
      { id: 1, text: 'Sistemi online. Profondità 1.', tone: 'system' },
      { id: 2, text: 'Trova il varco di discesa. Il labirinto si riscrive a ogni piano.', tone: 'neutral' },
    ],
    nextLogId: 3,
  };
}

function descend(draft: Draft): void {
  const state = draft.state;
  const depth = state.depth + 1;
  const built = buildLevel(draft.rng, depth, state.nextId);
  const player: Actor = { ...state.player, pos: built.level.entrance };
  const visibility = computeFov(built.level, player.pos, state.stats.vision);

  draft.state = {
    ...state,
    phase: 'playing',
    depth,
    level: { ...built.level, visibility },
    player,
    enemies: built.enemies,
    items: built.items,
    nextId: built.nextId,
    sealed: built.sealed,
    upgradeChoices: [],
  };
  say(draft, `Discesa completata. Profondità ${depth}.`, 'system');
  if (built.sealed) say(draft, BOSS_INTRO, 'bad');
}

function refreshFov(draft: Draft): void {
  const { level, player, stats } = draft.state;
  draft.state = {
    ...draft.state,
    level: { ...level, visibility: computeFov(level, player.pos, stats.vision) },
  };
}

function enemyAt(state: GameState, pos: Vec): Actor | undefined {
  return state.enemies.find((e) => e.hp > 0 && equals(e.pos, pos));
}

/** L'Architetto è invulnerabile finché resta in piedi almeno un ancoraggio. */
export function isShielded(state: GameState, actor: Actor): boolean {
  return actor.kind === 'architect' && state.enemies.some((e) => e.kind === 'anchor' && e.hp > 0);
}

function damageEnemy(draft: Draft, target: Actor, amount: number): void {
  const template = enemyTemplate(target.kind === 'player' ? 'sentinel' : target.kind);

  if (isShielded(draft.state, target)) {
    draft.fx.push({ kind: 'blocked', pos: target.pos, at: draft.state.turn, amount: null, tone: 'bad', onPlayer: false });
    say(draft, 'Gli ancoraggi reggono: l’Architetto non è scalfibile.', 'bad');
    return;
  }

  const hp = target.hp - amount;
  draft.fx.push({
    kind: hp <= 0 ? 'death' : 'hit',
    pos: target.pos,
    at: draft.state.turn,
    amount: amount,
    tone: 'good',
    onPlayer: false,
  });
  draft.state = {
    ...draft.state,
    enemies: draft.state.enemies.map((e) => (e.id === target.id ? { ...e, hp, ai: 'hunting', target: draft.state.player.pos } : e)),
  };
  if (hp <= 0) {
    say(draft, `${template.label} disattivat${target.kind === 'architect' || target.kind === 'anchor' ? 'o' : 'a'}.`, 'good');
    draft.state = {
      ...draft.state,
      enemies: draft.state.enemies.filter((e) => e.id !== target.id),
      shards: draft.state.shards + 1,
    };

    if (target.kind === 'anchor' && !draft.state.enemies.some((e) => e.kind === 'anchor')) {
      say(draft, BOSS_UNSHIELDED, 'system');
    }
    if (target.kind === 'architect') {
      draft.state = { ...draft.state, sealed: false };
      say(draft, BOSS_DEFEATED, 'system');
    }
  } else {
    say(draft, `Colpisci ${template.label} (${amount}).`);
  }
}

function damagePlayer(draft: Draft, amount: number, source: string): void {
  const mitigated = Math.max(1, amount - draft.state.stats.armor);
  const hp = draft.state.player.hp - mitigated;
  draft.fx.push({
    kind: 'hit',
    pos: draft.state.player.pos,
    at: draft.state.turn,
    amount: mitigated,
    tone: 'bad',
    onPlayer: true,
  });
  draft.state = { ...draft.state, player: { ...draft.state.player, hp } };
  say(draft, `${source} ti colpisce (${mitigated}).`, 'bad');
  if (hp <= 0) {
    draft.state = { ...draft.state, phase: 'dead' };
    say(draft, 'Integrità a zero. Il labirinto ti trattiene.', 'bad');
  }
}

function revealAll(visibility: Uint8Array): Uint8Array {
  const revealed = new Uint8Array(visibility);
  for (let i = 0; i < revealed.length; i++) {
    if (revealed[i] === Visibility.Unknown) revealed[i] = Visibility.Explored;
  }
  return revealed;
}

function collect(draft: Draft): void {
  const state = draft.state;
  const player = state.player;
  const radius = state.stats.magnet;
  const taken: Item[] = [];
  const rest: Item[] = [];

  for (const item of state.items) {
    const near = chebyshev(item.pos, player.pos);
    const grabbed = near === 0 || (item.kind === 'shard' && near <= radius);
    if (grabbed) taken.push(item);
    else rest.push(item);
  }
  if (taken.length === 0) return;

  let { energy, keys, shards, records } = state;
  let hp = player.hp;
  let visibility = state.level.visibility;

  for (const item of taken) {
    draft.fx.push({ kind: 'pickup', pos: item.pos, at: state.turn, amount: null, tone: 'good', onPlayer: false });
    switch (item.kind) {
      case 'shard':
        shards += 1;
        break;
      case 'cell':
        energy = Math.min(state.stats.maxEnergy, energy + 4);
        say(draft, 'Cella energetica assorbita (+4).', 'good');
        break;
      case 'repair': {
        const healed = Math.min(state.stats.maxHp, hp + 6) - hp;
        hp += healed;
        draft.fx.push({ kind: 'heal', pos: player.pos, at: state.turn, amount: healed, tone: 'good', onPlayer: true });
        say(draft, `Kit di riparazione (+${healed} integrità).`, 'good');
        break;
      }
      case 'key':
        keys += 1;
        say(draft, 'Chiave del caveau recuperata.', 'good');
        break;
      case 'chip': {
        visibility = revealAll(visibility);
        say(draft, 'Chip cartografico: pianta del piano acquisita.', 'good');
        break;
      }
      case 'record': {
        visibility = revealAll(visibility);
        records += 1;
        say(draft, recordText(state.depth), 'system');
        say(draft, `Registro recuperato (${records}). Pianta del piano acquisita.`, 'good');
        break;
      }
      default: {
        const exhaustive: never = item.kind;
        throw new Error(`Oggetto sconosciuto: ${String(exhaustive)}`);
      }
    }
  }

  const shardGain = taken.filter((i) => i.kind === 'shard').length;
  if (shardGain > 0) {
    say(draft, `${shardGain} ${ITEM_LABELS.shard}${shardGain > 1 ? 'i' : ''} raccolt${shardGain > 1 ? 'i' : 'o'}.`);
  }

  draft.state = {
    ...draft.state,
    items: rest,
    energy,
    keys,
    shards,
    records,
    player: { ...player, hp },
    level: { ...state.level, visibility },
  };
}

function offerUpgrades(draft: Draft): void {
  const owned = new Set(draft.state.acquired);
  const pool = UPGRADES.filter((u) => !owned.has(u.id) || u.id === 'vitals' || u.id === 'capacitor');
  const choices = shuffle(draft.rng, pool.length >= 3 ? pool : UPGRADES).slice(0, 3);
  draft.state = { ...draft.state, phase: 'upgrade', upgradeChoices: choices };
}

function reachExit(draft: Draft): void {
  if (draft.state.depth >= MAX_DEPTH) {
    if (draft.state.sealed) {
      say(draft, EXIT_SEALED, 'bad');
      return;
    }
    draft.state = { ...draft.state, phase: 'finale' };
    return;
  }
  say(draft, 'Varco di discesa attivato.', 'system');
  offerUpgrades(draft);
}

function moveOrAttack(draft: Draft, dir: Direction): boolean {
  const state = draft.state;
  const destination = add(state.player.pos, DELTA[dir]);
  if (!inBounds(state.level, destination.x, destination.y)) return false;

  const target = enemyAt(state, destination);
  if (target) {
    const roll = state.stats.damage + range(draft.rng, 0, 2);
    damageEnemy(draft, target, roll);
    return true;
  }

  const tile = tileAt(state.level, destination.x, destination.y);
  if (tile === Tile.VaultDoor) {
    if (state.keys <= 0) {
      say(draft, 'Porta blindata: serve una chiave.', 'bad');
      return false;
    }
    const tiles = new Uint8Array(state.level.tiles);
    tiles[idx(state.level.width, destination.x, destination.y)] = Tile.Door;
    draft.state = {
      ...state,
      keys: state.keys - 1,
      level: { ...state.level, tiles },
    };
    say(draft, 'Porta del caveau sbloccata.', 'good');
    return true;
  }

  if (!isWalkable(state.level, destination.x, destination.y)) return false;

  draft.state = { ...state, player: { ...state.player, pos: destination } };
  collect(draft);
  if (tile === Tile.Exit) reachExit(draft);
  return true;
}

function pulse(draft: Draft): boolean {
  if (draft.state.energy < PULSE_COST) {
    say(draft, 'Energia insufficiente per l’impulso.', 'bad');
    return false;
  }
  draft.state = { ...draft.state, energy: draft.state.energy - PULSE_COST };
  draft.fx.push({ kind: 'pulse', pos: draft.state.player.pos, at: draft.state.turn, amount: null, tone: 'neutral', onPlayer: true });

  const origin = draft.state.player.pos;
  const hits = draft.state.enemies.filter((e) => chebyshev(e.pos, origin) === 1);
  if (hits.length === 0) {
    say(draft, 'Impulso a vuoto.', 'neutral');
    return true;
  }
  for (const target of hits) {
    const alive = draft.state.enemies.find((e) => e.id === target.id);
    if (!alive) continue;
    damageEnemy(draft, alive, draft.state.stats.damage + 2);
  }
  return true;
}

function phaseDash(draft: Draft, dir: Direction): boolean {
  if (draft.state.energy < PHASE_COST) {
    say(draft, 'Energia insufficiente per la transizione.', 'bad');
    return false;
  }
  const state = draft.state;
  const delta = DELTA[dir];
  const destination = { x: state.player.pos.x + delta.x * 2, y: state.player.pos.y + delta.y * 2 };
  if (
    !inBounds(state.level, destination.x, destination.y) ||
    !isWalkable(state.level, destination.x, destination.y) ||
    enemyAt(state, destination)
  ) {
    say(draft, 'Transizione impossibile in quella direzione.', 'bad');
    return false;
  }

  draft.fx.push({ kind: 'phase', pos: state.player.pos, at: state.turn, amount: null, tone: 'neutral', onPlayer: true });
  draft.state = {
    ...state,
    energy: state.energy - PHASE_COST,
    player: { ...state.player, pos: destination },
  };
  draft.fx.push({ kind: 'phase', pos: destination, at: state.turn, amount: null, tone: 'neutral', onPlayer: true });
  collect(draft);
  if (tileAt(draft.state.level, destination.x, destination.y) === Tile.Exit) reachExit(draft);
  return true;
}

function wander(draft: Draft, enemy: Actor): Vec | null {
  const options: Vec[] = [];
  for (const dir of ['up', 'right', 'down', 'left'] as const) {
    const d = DELTA[dir];
    const p = { x: enemy.pos.x + d.x, y: enemy.pos.y + d.y };
    if (isWalkable(draft.state.level, p.x, p.y) && !enemyAt(draft.state, p)) options.push(p);
  }
  if (options.length === 0) return null;
  if (next(draft.rng) > 0.35) return null;
  return options[Math.floor(next(draft.rng) * options.length)] ?? null;
}

function runEnemies(draft: Draft): void {
  const field = distanceField(draft.state.level, draft.state.player.pos, 30);

  for (const snapshot of draft.state.enemies) {
    if (draft.state.phase !== 'playing') return;
    let self = draft.state.enemies.find((e) => e.id === snapshot.id);
    if (!self) continue;

    let clock = self.clock + self.speed;
    while (clock >= ACTION_COST) {
      clock -= ACTION_COST;
      self = draft.state.enemies.find((e) => e.id === snapshot.id);
      if (!self || draft.state.phase !== 'playing') break;

      const template = enemyTemplate(self.kind === 'player' ? 'sentinel' : self.kind);
      const player = draft.state.player;
      const distance = chebyshev(self.pos, player.pos);
      const seen =
        draft.state.level.visibility[idx(draft.state.level.width, self.pos.x, self.pos.y)] ===
          Visibility.Visible || distance <= template.senseRadius;

      if (distance === 1) {
        damagePlayer(draft, self.damage, template.label);
        continue;
      }

      let updated: Actor = seen ? { ...self, ai: 'hunting', target: player.pos } : self;
      if (!template.stationary) {
        const goal = updated.ai === 'hunting' ? player.pos : null;
        const step = goal
          ? stepDownhill(draft.state.level, field, updated.pos, (p) => Boolean(enemyAt(draft.state, p)))
          : wander(draft, updated);
        if (step) updated = { ...updated, pos: step };
        else if (updated.ai === 'hunting' && !goal) updated = { ...updated, ai: 'idle', target: null };
      }

      const settled = updated;
      draft.state = {
        ...draft.state,
        enemies: draft.state.enemies.map((e) => (e.id === settled.id ? settled : e)),
      };
    }

    const finalClock = clock;
    draft.state = {
      ...draft.state,
      enemies: draft.state.enemies.map((e) => (e.id === snapshot.id ? { ...e, clock: finalClock } : e)),
    };
  }
}

function endTurn(draft: Draft): void {
  if (draft.state.phase !== 'playing') return;
  runEnemies(draft);
  if (draft.state.phase !== 'playing') return;

  const turn = draft.state.turn + 1;
  const regen = draft.state.stats.regenEvery;
  const energy =
    regen > 0 && turn % regen === 0
      ? Math.min(draft.state.stats.maxEnergy, draft.state.energy + 1)
      : draft.state.energy;

  draft.state = { ...draft.state, turn, energy };
  refreshFov(draft);
}

function commit(draft: Draft): GameState {
  return {
    ...draft.state,
    rngState: draft.rng.state,
    log: draft.log,
    nextLogId: draft.nextLogId,
    fx: draft.fx,
  };
}

/** Riduttore puro: unico punto in cui lo stato di gioco cambia. */
export function reduce(state: GameState, action: GameAction): GameState {
  if (action.type === 'start') return startRun(action.seed);
  if (action.type === 'restart') return startRun((state.seed + 0x9e3779b9) >>> 0);
  if (action.type === 'toTitle') return createTitleState((state.seed + 1) >>> 0);

  const draft: Draft = {
    state,
    rng: { state: state.rngState },
    log: state.log.slice(),
    fx: [],
    nextLogId: state.nextLogId,
  };

  if (action.type === 'chooseEnding') {
    if (state.phase !== 'finale') return state;
    const id: EndingId = action.id;
    // Guardia anche nel motore: la UI disabilita la carta, ma la regola vive qui.
    if (state.records < endingById(id).requiredRecords) return state;
    draft.state = { ...state, phase: 'won', ending: id };
    say(draft, 'Istruzione trasmessa al Nucleo.', 'system');
    return commit(draft);
  }

  if (action.type === 'chooseUpgrade') {
    if (state.phase !== 'upgrade') return state;
    const result = applyUpgrade(state.stats, action.id);
    const chosen = UPGRADES.find((u) => u.id === action.id);
    draft.state = {
      ...state,
      stats: result.stats,
      acquired: [...state.acquired, action.id],
      player: {
        ...state.player,
        maxHp: result.stats.maxHp,
        hp: Math.min(result.stats.maxHp, state.player.hp + result.healHp),
        damage: result.stats.damage,
      },
      energy: result.refillEnergy ? result.stats.maxEnergy : Math.min(result.stats.maxEnergy, state.energy),
    };
    if (chosen) say(draft, `Innesto installato: ${chosen.name}.`, 'good');
    descend(draft);
    refreshFov(draft);
    return commit(draft);
  }

  if (state.phase !== 'playing') return state;

  let spent = false;
  switch (action.type) {
    case 'move':
      spent = moveOrAttack(draft, action.dir);
      break;
    case 'wait':
      spent = true;
      break;
    case 'pulse':
      spent = pulse(draft);
      break;
    case 'phase':
      spent = phaseDash(draft, action.dir);
      break;
    default: {
      const exhaustive: never = action;
      throw new Error(`Azione sconosciuta: ${JSON.stringify(exhaustive)}`);
    }
  }

  if (!spent) return commit(draft);
  endTurn(draft);
  return commit(draft);
}
