import { memo, useEffect, useRef, useState } from 'react';
import { Scene } from '../render/scene';
import type { Direction, GameState } from '../engine/types';
import styles from './GameCanvas.module.css';

interface Props {
  readonly state: GameState;
  /** Trascinamento sul labirinto: alternativa naturale al D-pad su telefono. */
  readonly onSwipe?: ((dir: Direction) => void) | undefined;
}

const SWIPE_THRESHOLD = 26;

/**
 * Il tabellone è disegnato su canvas invece che con nodi DOM: un labirinto
 * 55x43 sarebbe oltre 2000 elementi da riconciliare a ogni turno.
 * React qui gestisce solo il ciclo di vita, non i singoli tile.
 */
function GameCanvasImpl({ state, onSwipe }: Props): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  const sceneRef = useRef<Scene | null>(null);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const onSwipeRef = useRef(onSwipe);
  const [ready, setReady] = useState(false);

  stateRef.current = state;
  onSwipeRef.current = onSwipe;

  useEffect(() => {
    const scene = sceneRef.current;
    if (scene) scene.sync(state, performance.now());
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new Scene(reduced);
    sceneRef.current = scene;

    let frame = 0;
    let width = 0;
    let height = 0;
    let previous = performance.now();
    let disposed = false;

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const loop = (time: number): void => {
      const delta = Math.min(64, time - previous);
      previous = time;
      scene.render(context, stateRef.current, width, height, time, delta);
      frame = window.requestAnimationFrame(loop);
    };

    void scene.load().then(() => {
      if (disposed) return;
      scene.sync(stateRef.current, performance.now());
      setReady(true);
      frame = window.requestAnimationFrame(loop);
    });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      sceneRef.current = null;
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!onSwipeRef.current) return;
    swipeRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const start = swipeRef.current;
    swipeRef.current = null;
    const swipe = onSwipeRef.current;
    if (!start || !swipe) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) > Math.abs(dy)) swipe(dx > 0 ? 'right' : 'left');
    else swipe(dy > 0 ? 'down' : 'up');
  };

  return (
    <div className={styles.wrap}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-hidden="true"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { swipeRef.current = null; }}
      />
      {!ready && <p className={styles.loading}>Compilazione del labirinto…</p>}
      <p className={styles.srOnly} role="status" aria-live="polite">
        {`Profondità ${state.depth}. Integrità ${state.player.hp} su ${state.stats.maxHp}. Energia ${state.energy}. Nemici in vista: ${state.enemies.length}.`}
      </p>
    </div>
  );
}

export const GameCanvas = memo(GameCanvasImpl);
