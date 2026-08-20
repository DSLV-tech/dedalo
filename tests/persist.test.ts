import { describe, expect, it } from 'vitest';
import { reduce, startRun } from '../src/engine/game';
import { decodeRun, encodeRun, isResumable, withResumeNotice } from '../src/game/persist';
import type { Direction, GameState } from '../src/engine/types';

const SEED = 4242;
const WALK: readonly Direction[] = ['up', 'right', 'down', 'left', 'right', 'up'];

/** Qualche turno giocato, così lo stato salvato non è quello iniziale. */
function playedState(seed = SEED): GameState {
  let state = startRun(seed);
  for (const dir of WALK) state = reduce(state, { type: 'move', dir });
  return state;
}

describe('persist / round-trip', () => {
  it('ricostruisce lo stato identico, Uint8Array compresi', () => {
    const state = playedState();
    const restored = decodeRun(encodeRun(state));

    expect(restored).not.toBeNull();
    // Gli effetti sono volutamente azzerati: sono roba dell'ultimo fotogramma.
    expect(restored).toEqual({ ...state, fx: [] });
    expect(restored?.level.tiles).toBeInstanceOf(Uint8Array);
    expect(restored?.level.tiles).toEqual(state.level.tiles);
    expect(restored?.level.visibility).toEqual(state.level.visibility);
  });

  it('non riporta a schermo gli effetti del turno precedente', () => {
    const state = playedState();
    const restored = decodeRun(encodeRun(state));
    expect(restored?.fx).toEqual([]);
  });

  it('riprende la run senza rompere il determinismo', () => {
    const state = playedState();
    const restored = decodeRun(encodeRun(state));
    expect(restored).not.toBeNull();
    if (!restored) return;

    // Stessa sequenza di mosse dallo stato originale e da quello ripreso:
    // se il salvataggio fosse incompleto (rngState, orologi, id) divergerebbero.
    let a = state;
    let b = restored;
    for (const dir of ['down', 'down', 'left', 'up'] as const) {
      a = reduce(a, { type: 'move', dir });
      b = reduce(b, { type: 'move', dir });
    }
    expect(b).toEqual(a);
  });
});

describe('persist / salvataggi non validi', () => {
  it('scarta JSON corrotto', () => {
    expect(decodeRun('{ non è json')).toBeNull();
    expect(decodeRun('')).toBeNull();
    expect(decodeRun('null')).toBeNull();
    expect(decodeRun('[]')).toBeNull();
  });

  it('scarta una versione diversa del formato', () => {
    const envelope: unknown = JSON.parse(encodeRun(playedState()));
    const bumped = { ...(envelope as Record<string, unknown>), version: 99 };
    expect(decodeRun(JSON.stringify(bumped))).toBeNull();
  });

  it('scarta una run già conclusa', () => {
    const envelope = JSON.parse(encodeRun(playedState())) as {
      version: number;
      state: Record<string, unknown>;
    };
    for (const phase of ['dead', 'won', 'title']) {
      const ended = { ...envelope, state: { ...envelope.state, phase } };
      expect(decodeRun(JSON.stringify(ended))).toBeNull();
    }
  });

  it('scarta un livello con le mappe troncate', () => {
    const envelope = JSON.parse(encodeRun(playedState())) as {
      version: number;
      state: { level: Record<string, unknown> } & Record<string, unknown>;
    };
    const broken = {
      ...envelope,
      state: { ...envelope.state, level: { ...envelope.state.level, width: 9999 } },
    };
    expect(decodeRun(JSON.stringify(broken))).toBeNull();
  });

  it('scarta campi mancanti o del tipo sbagliato', () => {
    const envelope = JSON.parse(encodeRun(playedState())) as {
      version: number;
      state: Record<string, unknown>;
    };
    for (const field of ['seed', 'rngState', 'depth', 'turn', 'player', 'stats', 'enemies']) {
      const broken = { ...envelope, state: { ...envelope.state, [field]: null } };
      expect(decodeRun(JSON.stringify(broken)), `campo ${field}`).toBeNull();
    }
  });
});

describe('persist / fasi riprendibili', () => {
  it('riprende solo una spedizione davvero in corso', () => {
    expect(isResumable('playing')).toBe(true);
    expect(isResumable('upgrade')).toBe(true);
    expect(isResumable('finale')).toBe(true);
    expect(isResumable('title')).toBe(false);
    expect(isResumable('dead')).toBe(false);
    expect(isResumable('won')).toBe(false);
  });
});

describe('persist / avviso di ripresa', () => {
  it('aggiunge una riga di registro senza toccare il resto', () => {
    const state = playedState();
    const resumed = withResumeNotice(state);

    expect(resumed.log.length).toBe(state.log.length + 1);
    expect(resumed.log[resumed.log.length - 1]?.text).toContain('ripresa');
    expect(resumed.nextLogId).toBe(state.nextLogId + 1);
    expect({ ...resumed, log: state.log, nextLogId: state.nextLogId }).toEqual(state);
  });

  it('non fa crescere il registro oltre il limite', () => {
    let state = playedState();
    for (let i = 0; i < 200; i += 1) state = withResumeNotice(state);
    expect(state.log.length).toBeLessThanOrEqual(60);
  });
});
