import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine, loadSettings, saveSettings } from './engine';
import type { AudioSettings } from './engine';
import { musicForDepth } from './library';
import type { SfxName } from './library';
import type { Fx, GameState } from '../engine/types';

export interface AudioApi {
  readonly settings: AudioSettings;
  readonly setSettings: (patch: Partial<AudioSettings>) => void;
  readonly toggleMute: () => void;
  readonly click: () => void;
}

const FX_SOUND: Readonly<Record<Fx['kind'], SfxName>> = {
  hit: 'hit',
  death: 'death',
  pulse: 'pulse',
  phase: 'phase',
  pickup: 'pickup',
  heal: 'pickup',
  blocked: 'deny',
};

function vibrate(pattern: number | readonly number[]): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern as number | number[]);
  } catch {
    /* alcuni browser lo espongono ma lo rifiutano fuori da un gesto */
  }
}

/**
 * Traduce lo stato di gioco in suono. Il motore non conosce l'audio: qui
 * osserviamo i cambiamenti (effetti del turno, profondità, fase) e suoniamo
 * di conseguenza. Nessun suono parte prima del primo gesto dell'utente.
 */
export function useAudio(state: GameState): AudioApi {
  const [settings, setSettingsState] = useState<AudioSettings>(() => loadSettings());
  const engineRef = useRef<AudioEngine | null>(null);
  if (engineRef.current === null) engineRef.current = new AudioEngine(settings);

  const previous = useRef({ turn: -1, depth: -1, phase: state.phase, records: 0, pos: state.player.pos });

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const unlock = (): void => engine.unlock();
    // In cattura: così l'audio è sbloccato prima che il gioco reagisca al tasto.
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    const onVisibility = (): void => {
      if (document.hidden) engine.suspend();
      else engine.resume();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    engineRef.current?.update(settings);
    saveSettings(settings);
  }, [settings]);

  // --- musica: dipende da fase e profondità ---------------------------------
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (state.phase === 'title') engine.playMusic('menu');
    else if (state.phase === 'won' || state.phase === 'finale') engine.playMusic('epilogue');
    else if (state.phase === 'dead') engine.playMusic(null, 0.6);
    else engine.playMusic(musicForDepth(state.depth));
  }, [state.phase, state.depth]);

  // --- effetti: reagiscono agli eventi del turno -----------------------------
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const before = previous.current;

    if (state.phase !== before.phase) {
      if (state.phase === 'dead') {
        engine.play('gameover');
        if (settings.haptics) vibrate([90, 60, 160]);
      }
      if (state.phase === 'won') {
        engine.play('victory');
        if (settings.haptics) vibrate([40, 40, 40, 40, 120]);
      }
    }

    if (state.phase === 'playing' && state.depth !== before.depth) {
      if (before.depth > 0) {
        engine.play('descend');
        if (settings.haptics) vibrate(45);
      }
      if (state.sealed) window.setTimeout(() => engine.play('boss'), 700);
    }

    if (state.turn !== before.turn) {
      for (const fx of state.fx) {
        if (fx.kind === 'hit' && fx.onPlayer) {
          engine.play('hurt');
          if (settings.haptics) vibrate(55);
        } else {
          engine.play(FX_SOUND[fx.kind], { rate: fx.kind === 'heal' ? 0.82 : 1 });
          if (settings.haptics && fx.kind === 'hit') vibrate(18);
        }
      }
      if (state.records > before.records) engine.play('record');
      const moved =
        state.player.pos.x !== before.pos.x || state.player.pos.y !== before.pos.y;
      if (moved && state.fx.length === 0) {
        engine.play('step', { rate: 0.92 + Math.random() * 0.16, throttleMs: 70 });
      }
    }

    previous.current = {
      turn: state.turn,
      depth: state.depth,
      phase: state.phase,
      records: state.records,
      pos: state.player.pos,
    };
  }, [state, settings.haptics]);

  const setSettings = useCallback((patch: Partial<AudioSettings>) => {
    setSettingsState((current) => ({ ...current, ...patch }));
  }, []);

  const toggleMute = useCallback(() => {
    setSettingsState((current) => ({ ...current, muted: !current.muted }));
  }, []);

  const click = useCallback(() => {
    engineRef.current?.unlock();
    engineRef.current?.play('ui');
  }, []);

  return useMemo(
    () => ({ settings, setSettings, toggleMute, click }),
    [settings, setSettings, toggleMute, click],
  );
}
