import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly error: Error | null;
}

/**
 * Un errore nel loop di render non deve lasciare uno schermo nero muto:
 * qui lo intercettiamo e offriamo comunque una via d'uscita (ricarica).
 */
export class ErrorBoundary extends Component<Props, State> {
  public override state: State = { error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[DEDALO] errore non gestito', error, info.componentStack);
  }

  public override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className={styles.wrap} role="alert">
        <h1 className={styles.title}>Sistema compromesso</h1>
        <p className={styles.message}>{error.message}</p>
        <button type="button" className={styles.button} onClick={() => window.location.reload()}>
          Riavvia il Dedalo
        </button>
      </div>
    );
  }
}
