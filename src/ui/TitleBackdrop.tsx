import { memo, useEffect, useRef, useState } from 'react';
import { PALETTE } from '../render/palette';
import styles from './TitleBackdrop.module.css';

interface Ring {
  /** Profondità: 0 = punto di fuga, 1 = addosso allo spettatore. */
  z: number;
  seed: number;
}

const RING_COUNT = 26;
const SPEED = 0.055; // giri di profondità al secondo

/** PRNG deterministico per la forma di un anello: stessa seed, stesse tacche. */
function seeded(seed: number): () => number {
  let state = (seed * 1664525 + 1013904223) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Profilo di un anello del corridoio: un rettangolo con qualche rientranza,
 * come le nicchie degli scaffali dell'archivio. Coordinate normalizzate
 * in [-1, 1] sull'asse x e [-ASPECT, ASPECT] sull'asse y.
 */
function ringPath(seed: number, aspect: number): Array<[number, number]> {
  const rand = seeded(seed);
  const points: Array<[number, number]> = [];
  const corners: Array<[number, number]> = [
    [-1, -aspect],
    [1, -aspect],
    [1, aspect],
    [-1, aspect],
  ];

  for (let side = 0; side < 4; side++) {
    const from = corners[side] as [number, number];
    const to = corners[(side + 1) % 4] as [number, number];
    points.push(from);
    if (rand() > 0.45) {
      const t1 = 0.2 + rand() * 0.3;
      const t2 = t1 + 0.12 + rand() * 0.22;
      const depth = (0.12 + rand() * 0.22) * (side % 2 === 0 ? aspect : 1);
      const inward = side === 0 ? [0, depth] : side === 1 ? [-depth, 0] : side === 2 ? [0, -depth] : [depth, 0];
      const at = (t: number): [number, number] => [
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
      ];
      const a = at(t1);
      const b = at(t2);
      points.push(a);
      points.push([a[0] + (inward[0] ?? 0), a[1] + (inward[1] ?? 0)]);
      points.push([b[0] + (inward[0] ?? 0), b[1] + (inward[1] ?? 0)]);
      points.push(b);
    }
  }
  return points;
}

/**
 * Sfondo della schermata titolo: il pozzo del Dedalo visto dall'alto, un
 * corridoio al neon che sprofonda nel nero con il giocatore in fondo.
 *
 * È disegnato in codice invece che con un'immagine: si adatta a qualsiasi
 * proporzione di schermo senza tagli, non pesa nulla e si muove.
 * Se in `public/art/title.jpg` esiste un'illustrazione, viene sovrapposta.
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

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rings: Ring[] = Array.from({ length: RING_COUNT }, (_, i) => ({
      z: (i + 1) / RING_COUNT,
      seed: i + 1,
    }));
    const paths = new Map<number, Array<[number, number]>>();
    let nextSeed = RING_COUNT + 1;
    let width = 0;
    let height = 0;
    let frame = 0;
    let previous = performance.now();

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

    const pathFor = (seed: number, aspect: number): Array<[number, number]> => {
      const cached = paths.get(seed);
      if (cached) return cached;
      const built = ringPath(seed, aspect);
      paths.set(seed, built);
      return built;
    };

    const draw = (time: number, delta: number): void => {
      const aspect = Math.max(0.75, Math.min(1.5, height / width * 1.5));
      const vanishX = width / 2;
      // Punto di fuga in alto: il fondo del pozzo — e il puntino verde —
      // restano visibili sopra il pannello del titolo.
      const vanishY = height * 0.19;
      // L'imboccatura deve uscire dallo schermo: il corridoio ci ingloba.
      const reach = Math.max(width, height) * 1.15;

      context.fillStyle = PALETTE.background;
      context.fillRect(0, 0, width, height);

      if (!reduced) {
        for (const ring of rings) {
          ring.z += SPEED * (delta / 1000);
          if (ring.z >= 1) {
            ring.z -= 1;
            paths.delete(ring.seed);
            ring.seed = nextSeed++;
          }
        }
      }

      const ordered = [...rings].sort((a, b) => a.z - b.z);
      const project = (point: [number, number], z: number): [number, number] => {
        const scale = Math.pow(z, 2.6) * reach;
        return [vanishX + point[0] * scale, vanishY + point[1] * scale];
      };

      // Binari: collegano gli angoli fra anelli vicini e danno la fuga prospettica.
      context.strokeStyle = PALETTE.wallVisible;
      context.lineWidth = 1;
      context.globalAlpha = 0.16;
      context.beginPath();
      for (let i = 0; i < ordered.length - 1; i++) {
        const near = ordered[i + 1] as Ring;
        const far = ordered[i] as Ring;
        for (const corner of [
          [-1, -aspect],
          [1, -aspect],
          [1, aspect],
          [-1, aspect],
        ] as Array<[number, number]>) {
          const a = project(corner, far.z);
          const b = project(corner, near.z);
          context.moveTo(a[0], a[1]);
          context.lineTo(b[0], b[1]);
        }
      }
      context.stroke();

      // Anelli: più vicini, più luminosi e spessi.
      for (const ring of ordered) {
        const path = pathFor(ring.seed, aspect);
        const fade = Math.min(1, ring.z * 4.5) * Math.min(1, (1 - ring.z) * 3.2);
        if (fade <= 0.01) continue;
        context.globalAlpha = 0.2 + fade * 0.75;
        context.lineWidth = 0.8 + ring.z * 3.4;
        context.strokeStyle = PALETTE.wallVisible;
        context.shadowColor = PALETTE.wallVisible;
        context.shadowBlur = 6 + ring.z * 26;
        context.beginPath();
        path.forEach((point, index) => {
          const [x, y] = project(point, ring.z);
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.closePath();
        context.stroke();
      }
      context.shadowBlur = 0;
      context.globalAlpha = 1;

      // In fondo al pozzo, il giocatore.
      const pulse = reduced ? 1 : 0.75 + 0.25 * Math.sin(time / 420);
      context.fillStyle = PALETTE.player;
      context.shadowColor = PALETTE.player;
      context.shadowBlur = 18 * pulse;
      context.beginPath();
      context.arc(vanishX, vanishY, Math.max(2.5, width * 0.004) * pulse, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
    };

    if (reduced) {
      draw(0, 0);
      return () => observer.disconnect();
    }

    const loop = (time: number): void => {
      const delta = Math.min(64, time - previous);
      previous = time;
      draw(time, delta);
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

export const TitleBackdrop = memo(TitleBackdropImpl);
