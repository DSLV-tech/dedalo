import { memo } from 'react';
import type { Direction } from '../engine/types';
import styles from './TouchControls.module.css';

interface Props {
  readonly onMove: (dir: Direction) => void;
  readonly onPhase: (dir: Direction) => void;
  readonly onWait: () => void;
  readonly onPulse: () => void;
  readonly phaseArmed: boolean;
  readonly onTogglePhase: () => void;
  readonly panelOpen: boolean;
  readonly onTogglePanel: () => void;
}

const ARROWS: ReadonlyArray<{ readonly dir: Direction; readonly glyph: string; readonly label: string; readonly area: string }> = [
  { dir: 'up', glyph: '▲', label: 'Su', area: 'up' },
  { dir: 'left', glyph: '◀', label: 'Sinistra', area: 'left' },
  { dir: 'right', glyph: '▶', label: 'Destra', area: 'right' },
  { dir: 'down', glyph: '▼', label: 'Giù', area: 'down' },
];

function TouchControlsImpl({
  onMove,
  onPhase,
  onWait,
  onPulse,
  phaseArmed,
  onTogglePhase,
  panelOpen,
  onTogglePanel,
}: Props): JSX.Element {
  return (
    <div className={styles.wrap}>
      <div className={styles.pad}>
        {ARROWS.map(({ dir, glyph, label, area }) => (
          <button
            key={dir}
            type="button"
            className={styles.key}
            style={{ gridArea: area }}
            aria-label={label}
            onPointerDown={(event) => {
              event.preventDefault();
              if (phaseArmed) onPhase(dir);
              else onMove(dir);
            }}
          >
            {glyph}
          </button>
        ))}
        <button type="button" className={styles.wait} style={{ gridArea: 'mid' }} aria-label="Attendi un turno" onPointerDown={(e) => { e.preventDefault(); onWait(); }}>
          ·
        </button>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.action} onPointerDown={(e) => { e.preventDefault(); onPulse(); }}>
          Impulso
        </button>
        <button
          type="button"
          className={phaseArmed ? styles.actionArmed : styles.action}
          aria-pressed={phaseArmed}
          onPointerDown={(e) => { e.preventDefault(); onTogglePhase(); }}
        >
          Transizione
        </button>
        <button
          type="button"
          className={panelOpen ? styles.actionArmed : styles.action}
          aria-pressed={panelOpen}
          onPointerDown={(e) => { e.preventDefault(); onTogglePanel(); }}
        >
          {panelOpen ? 'Chiudi' : 'Mappa'}
        </button>
      </div>
    </div>
  );
}

export const TouchControls = memo(TouchControlsImpl);
