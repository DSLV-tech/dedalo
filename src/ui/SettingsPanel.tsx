import { memo } from 'react';
import type { AudioSettings } from '../audio/engine';
import styles from './SettingsPanel.module.css';

interface Props {
  readonly settings: AudioSettings;
  readonly onChange: (patch: Partial<AudioSettings>) => void;
}

interface SliderProps {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}

function Slider({ label, value, onChange }: SliderProps): JSX.Element {
  return (
    <label className={styles.row}>
      <span className={styles.label}>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        className={styles.slider}
      />
      <span className={styles.value}>{Math.round(value * 100)}</span>
    </label>
  );
}

export const SettingsPanel = memo(function SettingsPanel({ settings, onChange }: Props): JSX.Element {
  const hapticsSupported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  return (
    <div className={styles.wrap}>
      <label className={styles.toggleRow}>
        <input
          type="checkbox"
          checked={!settings.muted}
          onChange={(event) => onChange({ muted: !event.target.checked })}
        />
        <span>Audio attivo</span>
      </label>
      <Slider label="Musica" value={settings.music} onChange={(music) => onChange({ music })} />
      <Slider label="Effetti" value={settings.sfx} onChange={(sfx) => onChange({ sfx })} />
      <label className={styles.toggleRow}>
        <input
          type="checkbox"
          checked={settings.haptics}
          disabled={!hapticsSupported}
          onChange={(event) => onChange({ haptics: event.target.checked })}
        />
        <span>
          Vibrazione
          {!hapticsSupported && <em className={styles.note}> — non supportata su questo dispositivo</em>}
        </span>
      </label>
    </div>
  );
});
