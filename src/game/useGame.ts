import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createTitleState, reduce } from '../engine/game';
import { seedFromString } from '../engine/rng';
import type { Direction, GameAction, GameState } from '../engine/types';
import { loadRecord, mergeRecord, saveRecord } from './storage';
import type { RunRecord } from './storage';
import { loadRun, saveRun, withResumeNotice } from './persist';

const KEY_TO_DIRECTION: Readonly<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
};

export interface GameApi {
  readonly state: GameState;
  readonly record: RunRecord;
  readonly helpOpen: boolean;
  readonly dispatch: (action: GameAction) => void;
  readonly move: (dir: Direction) => void;
  readonly phaseDash: (dir: Direction) => void;
  readonly toggleHelp: () => void;
}

function initialSeed(): number {
  // Il seed può arrivare dall'URL (?seed=...) per rigiocare esattamente la stessa run.
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('seed');
  if (raw !== null && raw.trim() !== '') {
    const numeric = Number(raw);
    return Number.isFinite(numeric) && numeric > 0 ? numeric >>> 0 : seedFromString(raw);
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

/**
 * Se c'è una spedizione interrotta la si riprende da dov'era, tranne quando
 * l'URL chiede esplicitamente un seed: in quel caso l'intenzione è giocare
 * *quella* run, non riprendere la precedente.
 */
function initialState(): GameState {
  const requestedSeed = new URLSearchParams(window.location.search).get('seed');
  if (requestedSeed === null || requestedSeed.trim() === '') {
    const saved = loadRun();
    if (saved) return withResumeNotice(saved);
  }
  return createTitleState(initialSeed());
}

/**
 * Il gioco vive in un solo albero di stato prodotto da un riduttore puro,
 * quindi `useReducer` basta e avanza: niente store esterno, niente sincronizzazione.
 * L'unico stato di UI separato è l'apertura dell'aiuto.
 */
export function useGame(): GameApi {
  const [state, rawDispatch] = useReducer(reduce, undefined, initialState);
  const [record, setRecord] = useState<RunRecord>(() => loadRecord());
  const [helpOpen, setHelpOpen] = useState(false);
  const scored = useRef<number | null>(null);

  const dispatch = useCallback((action: GameAction) => {
    rawDispatch(action);
  }, []);

  const move = useCallback((dir: Direction) => dispatch({ type: 'move', dir }), [dispatch]);
  const phaseDash = useCallback((dir: Direction) => dispatch({ type: 'phase', dir }), [dispatch]);
  const toggleHelp = useCallback(() => setHelpOpen((open) => !open), []);

  // La spedizione in corso viene riscritta a ogni turno; a run conclusa
  // `saveRun` cancella da sé il salvataggio, così non si riprende una partita
  // già finita.
  useEffect(() => {
    saveRun(state);
  }, [state]);

  // Registra il risultato una sola volta per run conclusa.
  useEffect(() => {
    if (state.phase !== 'dead' && state.phase !== 'won') return;
    if (scored.current === state.seed) return;
    scored.current = state.seed;
    setRecord((previous) => {
      const merged = mergeRecord(previous, state.depth, state.shards);
      saveRecord(merged);
      return merged;
    });
  }, [state.phase, state.seed, state.depth, state.shards]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key;

      if (key === '?' || key === 'h' || key === 'H') {
        event.preventDefault();
        setHelpOpen((open) => !open);
        return;
      }
      if (key === 'Escape') {
        setHelpOpen(false);
        return;
      }
      if (key === 'Enter' && (state.phase === 'title' || state.phase === 'dead' || state.phase === 'won')) {
        event.preventDefault();
        dispatch(state.phase === 'title' ? { type: 'start', seed: state.seed } : { type: 'restart' });
        return;
      }
      if (state.phase !== 'playing') return;

      const direction = KEY_TO_DIRECTION[key];
      if (direction) {
        event.preventDefault();
        dispatch(event.shiftKey ? { type: 'phase', dir: direction } : { type: 'move', dir: direction });
        return;
      }
      if (key === ' ' || key === '.') {
        event.preventDefault();
        dispatch({ type: 'wait' });
        return;
      }
      if (key === 'e' || key === 'E') {
        event.preventDefault();
        dispatch({ type: 'pulse' });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, state.phase, state.seed]);

  return useMemo(
    () => ({ state, record, helpOpen, dispatch, move, phaseDash, toggleHelp }),
    [state, record, helpOpen, dispatch, move, phaseDash, toggleHelp],
  );
}
