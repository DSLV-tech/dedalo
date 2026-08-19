import { memo, useCallback, useEffect, useRef } from 'react';
import { drawMinimap } from '../render/scene';
import type { GameState } from '../engine/types';
import styles from './Minimap.module.css';

interface Props {
  readonly state: GameState;
}

function MinimapImpl({ state }: Props): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const paint = useCallback((): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMinimap(context, stateRef.current, rect.width, rect.height);
  }, []);

  // Ridisegna a ogni nuovo stato, ma anche quando il pannello passa da nascosto
  // a visibile: senza ResizeObserver la minimappa resterebbe vuota su telefono.
  useEffect(paint, [state, paint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paint]);

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Pianta</span>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
    </div>
  );
}

export const Minimap = memo(MinimapImpl);
