import { memo } from 'react';
import { MAX_DEPTH } from '../engine/content';
import type { GameState } from '../engine/types';
import { Wordmark } from './Wordmark';
import styles from './Hud.module.css';

interface Props {
  readonly state: GameState;
  readonly onHelp: () => void;
  readonly muted: boolean;
  readonly onToggleMute: () => void;
}

interface BarProps {
  readonly label: string;
  readonly value: number;
  readonly max: number;
  readonly tone: 'life' | 'energy';
}

function Bar({ label, value, max, tone }: BarProps): JSX.Element {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className={styles.bar}>
      <div className={styles.barHead}>
        <span>{label}</span>
        <span className={styles.mono}>
          {value}/{max}
        </span>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div className={tone === 'life' ? styles.fillLife : styles.fillEnergy} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

/**
 * Barra di stato compatta: una sola versione, pensata per lo schermo del
 * telefono. Le abilità non sono più elencate qui — sono i tasti in basso.
 */
function HudImpl({ state, onHelp, muted, onToggleMute }: Props): JSX.Element {
  return (
    <header className={styles.hud}>
      <div className={styles.top}>
        <span className={styles.brand}>
          <Wordmark />
        </span>
        <span className={styles.depth}>
          Prof. <strong>{state.depth}</strong>
          <span className={styles.dim}>/{MAX_DEPTH}</span>
        </span>
        <button
          type="button"
          className={styles.icon}
          onClick={onToggleMute}
          aria-label={muted ? 'Riattiva l’audio' : 'Silenzia l’audio'}
          aria-pressed={muted}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button type="button" className={styles.icon} onClick={onHelp} aria-label="Comandi e leggenda">
          ?
        </button>
      </div>

      <div className={styles.bars}>
        <Bar label="Integrità" value={state.player.hp} max={state.stats.maxHp} tone="life" />
        <Bar label="Energia" value={state.energy} max={state.stats.maxEnergy} tone="energy" />
      </div>

      <dl className={styles.stats}>
        <div>
          <dt>Frammenti</dt>
          <dd>{state.shards}</dd>
        </div>
        <div>
          <dt>Registri</dt>
          <dd>{state.records}</dd>
        </div>
        <div>
          <dt>Chiavi</dt>
          <dd>{state.keys}</dd>
        </div>
        <div>
          <dt>Turno</dt>
          <dd>{state.turn}</dd>
        </div>
      </dl>
    </header>
  );
}

export const Hud = memo(HudImpl);
