import { memo } from 'react';
import { PHASE_COST, PULSE_COST } from '../engine/content';
import type { Direction } from '../engine/types';
import styles from './TouchControls.module.css';

interface Props {
  readonly onMove: (dir: Direction) => void;
  readonly onWait: () => void;
  readonly onPulse: () => void;
  readonly phaseArmed: boolean;
  readonly onTogglePhase: () => void;
  readonly panelOpen: boolean;
  readonly onTogglePanel: () => void;
  readonly energy: number;
}

const ARROWS: ReadonlyArray<{
  readonly dir: Direction;
  readonly glyph: string;
  readonly label: string;
  readonly area: string;
}> = [
  { dir: 'up', glyph: '▲', label: 'Su', area: 'up' },
  { dir: 'left', glyph: '◀', label: 'Sinistra', area: 'left' },
  { dir: 'right', glyph: '▶', label: 'Destra', area: 'right' },
  { dir: 'down', glyph: '▼', label: 'Giù', area: 'down' },
];

/** `onPointerDown` invece di `onClick`: su telefono la risposta è immediata. */
function press(handler: () => void) {
  return (event: React.PointerEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    handler();
  };
}

function TouchControlsImpl({
  onMove,
  onWait,
  onPulse,
  phaseArmed,
  onTogglePhase,
  panelOpen,
  onTogglePanel,
  energy,
}: Props): JSX.Element {
  const canPulse = energy >= PULSE_COST;
  const canPhase = energy >= PHASE_COST;

  return (
    <div className={styles.wrap}>
      <div className={styles.pad}>
        {ARROWS.map(({ dir, glyph, label, area }) => (
          <button
            key={dir}
            type="button"
            className={phaseArmed ? styles.keyArmed : styles.key}
            style={{ gridArea: area }}
            aria-label={phaseArmed ? `Transizione verso: ${label}` : label}
            onPointerDown={press(() => onMove(dir))}
          >
            {glyph}
          </button>
        ))}
        <button
          type="button"
          className={styles.wait}
          style={{ gridArea: 'mid' }}
          aria-label="Attendi un turno"
          onPointerDown={press(onWait)}
        >
          ·
        </button>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={canPulse ? styles.action : styles.actionOff}
          onPointerDown={press(onPulse)}
        >
          Impulso <em>{PULSE_COST}</em>
        </button>
        <button
          type="button"
          className={phaseArmed ? styles.actionArmed : canPhase ? styles.action : styles.actionOff}
          aria-pressed={phaseArmed}
          onPointerDown={press(onTogglePhase)}
        >
          {phaseArmed ? 'Scegli dir.' : 'Transizione'} <em>{PHASE_COST}</em>
        </button>
        <button
          type="button"
          className={panelOpen ? styles.actionArmed : styles.action}
          aria-pressed={panelOpen}
          onPointerDown={press(onTogglePanel)}
        >
          {panelOpen ? 'Chiudi' : 'Mappa'}
        </button>
      </div>
    </div>
  );
}

export const TouchControls = memo(TouchControlsImpl);
