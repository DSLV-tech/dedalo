import { memo, useEffect, useRef, useState } from 'react';
import { generateMaze } from '../engine/maze';
import { createRng } from '../engine/rng';
import { idx } from '../engine/grid';
import { Tile } from '../engine/types';
import { PALETTE } from '../render/palette';
import styles from './TitleBackdrop.module.css';

const CELL = 22;

/**
 * Sfondo della schermata titolo: un labirinto che si disegna, respira e si
 * riscrive. Usa lo stesso generatore del gioco, quindi la copertina è
 * letteralmente un piano del Dedalo — non un'illustrazione a parte.
 *
 * Se in `public/art/title.jpg` esiste un'illustrazione, viene sovrapposta;
 * altrimenti resta solo questa animazione.
 */
function TitleBackdropImpl(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [artLoaded, setArtLoaded] = useState(false);

  useEffect(() => {
    const image = new Image();
    image.onload = () => setArtLoaded(true);
    image.src = `${import.meta.env.BASE_URL}art/title.jpg`;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Un solo fotogramma statico, nessuna animazione.
      renderStatic(context, canvas);
      return;
    }

    let frame = 0;
    let seed = 1;
    let segments: Array<[number, number, number, number]> = [];
    let progress = 0;
    let width = 0;
    let height = 0;

    const rebuild = (): void => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const columns = Math.max(9, Math.ceil(width / CELL) + 2);
      const rows = Math.max(9, Math.ceil(height / CELL) + 2);
      const maze = generateMaze(createRng(seed), {
        width: columns,
        height: rows,
        roomAttempts: 16,
        windiness: 0.62,
        deadEndKeep: 0.35,
        extraConnectors: 0.1,
      });

      segments = [];
      for (let y = 0; y < maze.height; y++) {
        for (let x = 0; x < maze.width; x++) {
          if (maze.tiles[idx(maze.width, x, y)] === Tile.Wall) continue;
          const sx = x * CELL;
          const sy = y * CELL;
          const solid = (nx: number, ny: number): boolean =>
            nx < 0 || ny < 0 || nx >= maze.width || ny >= maze.height
              ? true
              : maze.tiles[idx(maze.width, nx, ny)] === Tile.Wall;
          if (solid(x, y - 1)) segments.push([sx, sy, sx + CELL, sy]);
          if (solid(x, y + 1)) segments.push([sx, sy + CELL, sx + CELL, sy + CELL]);
          if (solid(x - 1, y)) segments.push([sx, sy, sx, sy + CELL]);
          if (solid(x + 1, y)) segments.push([sx + CELL, sy, sx + CELL, sy + CELL]);
        }
      }
      progress = Math.floor(segments.length * 0.55);
    };

    const observer = new ResizeObserver(rebuild);
    observer.observe(canvas);
    rebuild();

    const loop = (time: number): void => {
      context.fillStyle = PALETTE.background;
      context.fillRect(0, 0, width, height);

      const total = segments.length;
      progress += total / 900;
      const drawn = Math.min(total, Math.floor(progress));
      const headStart = Math.max(0, drawn - 60);

      // Strato di fondo: tutto il labirinto già tracciato, tenue.
      context.strokeStyle = PALETTE.wallVisible;
      context.lineWidth = 1.2;
      context.globalAlpha = 0.15;
      context.beginPath();
      for (let i = 0; i < headStart; i++) {
        const s = segments[i];
        if (!s) continue;
        context.moveTo(s[0], s[1]);
        context.lineTo(s[2], s[3]);
      }
      context.stroke();

      // Testina di scrittura: le ultime linee, luminose. È il labirinto che si riscrive.
      context.globalAlpha = 0.85;
      context.lineWidth = 1.8;
      context.shadowColor = PALETTE.wallVisible;
      context.shadowBlur = 14;
      context.beginPath();
      for (let i = headStart; i < drawn; i++) {
        const s = segments[i];
        if (!s) continue;
        context.moveTo(s[0], s[1]);
        context.lineTo(s[2], s[3]);
      }
      context.stroke();
      context.shadowBlur = 0;
      context.globalAlpha = 1;

      if (progress > total + 900) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        rebuild();
      }

      void time;
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div className={styles.wrap} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
      {artLoaded && (
        <img className={styles.art} src={`${import.meta.env.BASE_URL}art/title.jpg`} alt="" />
      )}
      <div className={styles.veil} />
    </div>
  );
}

function renderStatic(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width));
  canvas.height = Math.max(1, Math.floor(rect.height));
  context.fillStyle = PALETTE.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

export const TitleBackdrop = memo(TitleBackdropImpl);
