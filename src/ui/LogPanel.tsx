import { memo, useEffect, useRef } from 'react';
import type { LogEntry } from '../engine/types';
import styles from './LogPanel.module.css';

interface Props {
  readonly log: readonly LogEntry[];
}

const TONE_CLASS: Readonly<Record<LogEntry['tone'], string>> = {
  neutral: styles.neutral ?? '',
  good: styles.good ?? '',
  bad: styles.bad ?? '',
  system: styles.system ?? '',
};

function LogPanelImpl({ log }: Props): JSX.Element {
  const listRef = useRef<HTMLOListElement | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [log]);

  return (
    <section className={styles.wrap} aria-label="Registro eventi">
      <span className={styles.label}>Registro</span>
      <ol className={styles.list} ref={listRef}>
        {log.slice(-40).map((entry) => (
          <li key={entry.id} className={TONE_CLASS[entry.tone]}>
            {entry.text}
          </li>
        ))}
      </ol>
    </section>
  );
}

export const LogPanel = memo(LogPanelImpl);
