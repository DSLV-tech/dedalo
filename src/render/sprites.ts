import type { ActorKind, ItemKind } from '../engine/types';
import { ACTOR_COLOR, ITEM_COLOR, PALETTE } from './palette';

export type SpriteId = ActorKind | ItemKind | 'exit' | 'exitSealed';

const VIEW = 64;

/**
 * Gli sprite sono SVG scritti a mano: restano nitidi a qualsiasi dimensione di
 * tassello, pesano pochi kilobyte e possono essere ricolorati cambiando una sola
 * variabile. Vengono rasterizzati una volta per dimensione e messi in cache.
 */
function wrap(body: string, glow: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" width="${VIEW}" height="${VIEW}">
<defs>
  <filter id="g" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur stdDeviation="2.1" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <linearGradient id="shell" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${glow}" stop-opacity="0.30"/>
    <stop offset="1" stop-color="#03060c" stop-opacity="0.92"/>
  </linearGradient>
</defs>
<g filter="url(#g)" fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</g>
</svg>`;
}

function actorSvg(kind: ActorKind): string {
  const c = ACTOR_COLOR[kind];
  switch (kind) {
    case 'player':
      // Unità di recupero: casco con visore, corazza leggera, faro sulla spalla.
      return wrap(
        `<path d="M32 4 C46 4 55 13 55 26 L55 42 C55 54 45 60 32 60 C19 60 9 54 9 42 L9 26 C9 13 18 4 32 4 Z" fill="url(#shell)" stroke="${c}" stroke-width="3.4"/>
         <path d="M15 24 C15 17 23 13 32 13 C41 13 49 17 49 24 L49 33 C49 37 41 40 32 40 C23 40 15 37 15 33 Z" fill="${c}" fill-opacity="0.6" stroke="${c}" stroke-width="2.6"/>
         <path d="M20 22 C24 19 29 18 32 18" stroke="#ffffff" stroke-width="2.4" stroke-opacity="0.7"/>
         <path d="M17 47 L47 47" stroke="${c}" stroke-width="3.4" stroke-opacity="0.85"/>
         <path d="M23 54 L41 54" stroke="${c}" stroke-width="2.6" stroke-opacity="0.5"/>
         <circle cx="53" cy="17" r="4" fill="${c}"/>
         <circle cx="11" cy="17" r="3" fill="${c}" fill-opacity="0.6"/>`,
        c,
      );
    case 'sentinel':
      // Sentinella: telaio squadrato, occhio a fessura, piastre laterali.
      return wrap(
        `<rect x="12" y="14" width="40" height="36" rx="5" fill="url(#shell)" stroke="${c}" stroke-width="3"/>
         <rect x="19" y="26" width="26" height="9" rx="4.5" fill="${c}" fill-opacity="0.85"/>
         <path d="M12 21 L5 25 L5 39 L12 43" stroke="${c}" stroke-width="2.6"/>
         <path d="M52 21 L59 25 L59 39 L52 43" stroke="${c}" stroke-width="2.6"/>
         <path d="M22 45 L42 45" stroke="${c}" stroke-width="2.4" stroke-opacity="0.55"/>`,
        c,
      );
    case 'stalker':
      // Segugio: profilo affusolato, zampe corte, scia.
      return wrap(
        `<path d="M32 8 L52 34 L44 34 L48 56 L32 42 L16 56 L20 34 L12 34 Z" fill="url(#shell)" stroke="${c}" stroke-width="2.8"/>
         <path d="M26 26 L32 20 L38 26" stroke="${c}" stroke-width="2.6"/>
         <circle cx="32" cy="33" r="4.4" fill="${c}"/>
         <path d="M22 47 L14 60 M42 47 L50 60" stroke="${c}" stroke-width="2.2" stroke-opacity="0.45"/>`,
        c,
      );
    case 'node':
      // Nodo: torretta esagonale piantata nel pavimento, anello di sorveglianza.
      return wrap(
        `<path d="M32 6 L54 19 L54 45 L32 58 L10 45 L10 19 Z" fill="url(#shell)" stroke="${c}" stroke-width="3"/>
         <path d="M32 16 L45 24 L45 40 L32 48 L19 40 L19 24 Z" stroke="${c}" stroke-width="2.2" stroke-opacity="0.7"/>
         <circle cx="32" cy="32" r="6" fill="${c}"/>
         <path d="M32 6 L32 0 M54 19 L60 15 M10 45 L4 49" stroke="${c}" stroke-width="2.4" stroke-opacity="0.6"/>`,
        c,
      );
    case 'warden':
      // Custode: archivista convertito — figura incappucciata con visore orizzontale.
      return wrap(
        `<path d="M32 5 C45 5 52 15 52 28 L52 45 C52 54 44 59 32 59 C20 59 12 54 12 45 L12 28 C12 15 19 5 32 5 Z" fill="url(#shell)" stroke="${c}" stroke-width="3"/>
         <path d="M18 27 L46 27 L46 34 L18 34 Z" fill="${c}" fill-opacity="0.8"/>
         <path d="M32 5 L32 27" stroke="${c}" stroke-width="2.2" stroke-opacity="0.6"/>
         <path d="M20 42 L44 42 M24 50 L40 50" stroke="${c}" stroke-width="2.4" stroke-opacity="0.5"/>`,
        c,
      );
    case 'anchor':
      // Ancoraggio: pilone conficcato, anelli orbitali, cuore incandescente.
      return wrap(
        `<path d="M32 4 L44 20 L44 44 L32 60 L20 44 L20 20 Z" fill="url(#shell)" stroke="${c}" stroke-width="3"/>
         <ellipse cx="32" cy="32" rx="26" ry="10" stroke="${c}" stroke-width="2.4" stroke-opacity="0.75"/>
         <ellipse cx="32" cy="32" rx="16" ry="6" stroke="${c}" stroke-width="2" stroke-opacity="0.5"/>
         <circle cx="32" cy="32" r="5.5" fill="${c}"/>`,
        c,
      );
    case 'architect':
      // Architetto: geometria del labirinto fatta creatura, bianca e simmetrica.
      return wrap(
        `<path d="M32 2 L58 17 L58 47 L32 62 L6 47 L6 17 Z" fill="url(#shell)" stroke="${c}" stroke-width="2.6"/>
         <path d="M32 12 L49 22 L49 42 L32 52 L15 42 L15 22 Z" stroke="${c}" stroke-width="2.2" stroke-opacity="0.8"/>
         <path d="M32 22 L41 27 L41 37 L32 42 L23 37 L23 27 Z" fill="${c}" fill-opacity="0.5" stroke="${c}" stroke-width="2"/>
         <circle cx="32" cy="32" r="3.4" fill="#ffffff"/>
         <path d="M32 2 L32 12 M58 17 L49 22 M6 47 L15 42 M32 62 L32 52" stroke="${c}" stroke-width="2" stroke-opacity="0.55"/>`,
        c,
      );
    default: {
      const exhaustive: never = kind;
      throw new Error(`Sprite mancante: ${String(exhaustive)}`);
    }
  }
}

function itemSvg(kind: ItemKind): string {
  const c = ITEM_COLOR[kind];
  switch (kind) {
    case 'shard':
      return wrap(
        `<path d="M32 6 L46 28 L32 58 L18 28 Z" fill="url(#shell)" stroke="${c}" stroke-width="3"/>
         <path d="M32 6 L32 58 M18 28 L46 28" stroke="${c}" stroke-width="2" stroke-opacity="0.7"/>`,
        c,
      );
    case 'cell':
      return wrap(
        `<rect x="20" y="10" width="24" height="44" rx="5" fill="url(#shell)" stroke="${c}" stroke-width="3"/>
         <rect x="27" y="4" width="10" height="7" rx="2" fill="${c}"/>
         <path d="M34 20 L26 35 L32 35 L30 46 L39 30 L33 30 Z" fill="${c}"/>`,
        c,
      );
    case 'repair':
      return wrap(
        `<rect x="9" y="18" width="46" height="32" rx="6" fill="url(#shell)" stroke="${c}" stroke-width="3"/>
         <path d="M25 18 L25 12 L39 12 L39 18" stroke="${c}" stroke-width="2.6"/>
         <path d="M32 26 L32 42 M24 34 L40 34" stroke="${c}" stroke-width="5"/>`,
        c,
      );
    case 'key':
      return wrap(
        `<circle cx="22" cy="24" r="12" fill="url(#shell)" stroke="${c}" stroke-width="3.2"/>
         <circle cx="22" cy="24" r="4" fill="${c}"/>
         <path d="M30 32 L50 52" stroke="${c}" stroke-width="4"/>
         <path d="M42 44 L48 38 M47 49 L53 43" stroke="${c}" stroke-width="3.4"/>`,
        c,
      );
    case 'chip':
      return wrap(
        `<rect x="16" y="16" width="32" height="32" rx="4" fill="url(#shell)" stroke="${c}" stroke-width="3"/>
         <rect x="26" y="26" width="12" height="12" rx="2" fill="${c}"/>
         <path d="M22 16 L22 8 M32 16 L32 8 M42 16 L42 8 M22 48 L22 56 M32 48 L32 56 M42 48 L42 56" stroke="${c}" stroke-width="2.6"/>
         <path d="M16 22 L8 22 M16 32 L8 32 M16 42 L8 42 M48 22 L56 22 M48 32 L56 32 M48 42 L56 42" stroke="${c}" stroke-width="2.6"/>`,
        c,
      );
    case 'record':
      return wrap(
        `<path d="M14 8 L44 8 L52 18 L52 56 L14 56 Z" fill="url(#shell)" stroke="${c}" stroke-width="3"/>
         <path d="M44 8 L44 18 L52 18" stroke="${c}" stroke-width="2.4"/>
         <path d="M22 28 L44 28 M22 37 L44 37 M22 46 L36 46" stroke="${c}" stroke-width="3"/>`,
        c,
      );
    default: {
      const exhaustive: never = kind;
      throw new Error(`Sprite mancante: ${String(exhaustive)}`);
    }
  }
}

function exitSvg(sealed: boolean): string {
  const c = sealed ? PALETTE.danger : PALETTE.exit;
  const core = sealed
    ? `<path d="M22 22 L42 42 M42 22 L22 42" stroke="${c}" stroke-width="4"/>`
    : `<circle cx="32" cy="32" r="7" fill="${c}"/>`;
  return wrap(
    `<circle cx="32" cy="32" r="26" stroke="${c}" stroke-width="2.4" stroke-opacity="0.55"/>
     <circle cx="32" cy="32" r="19" stroke="${c}" stroke-width="3"/>
     <circle cx="32" cy="32" r="12" stroke="${c}" stroke-width="2.2" stroke-opacity="0.8"/>
     ${core}`,
    c,
  );
}

const SOURCES: Readonly<Record<SpriteId, string>> = {
  player: actorSvg('player'),
  sentinel: actorSvg('sentinel'),
  stalker: actorSvg('stalker'),
  node: actorSvg('node'),
  warden: actorSvg('warden'),
  anchor: actorSvg('anchor'),
  architect: actorSvg('architect'),
  shard: itemSvg('shard'),
  cell: itemSvg('cell'),
  repair: itemSvg('repair'),
  key: itemSvg('key'),
  chip: itemSvg('chip'),
  record: itemSvg('record'),
  exit: exitSvg(false),
  exitSealed: exitSvg(true),
};

export const SPRITE_IDS = Object.keys(SOURCES) as readonly SpriteId[];

export interface SpriteAtlas {
  /** Canvas già rasterizzato alla dimensione richiesta, o null se non pronto. */
  get(id: SpriteId, size: number): CanvasImageSource | null;
  readonly ready: boolean;
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Carica gli SVG come immagini e li rasterizza su richiesta.
 * Le dimensioni sono arrotondate a multipli di 4 per limitare il numero di
 * rasterizzazioni durante il ridimensionamento della finestra.
 */
export async function loadSpriteAtlas(): Promise<SpriteAtlas> {
  const images = new Map<SpriteId, HTMLImageElement>();

  await Promise.all(
    SPRITE_IDS.map(
      (id) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.decoding = 'async';
          image.onload = () => {
            images.set(id, image);
            resolve();
          };
          image.onerror = () => resolve();
          image.src = svgToDataUrl(SOURCES[id]);
        }),
    ),
  );

  const cache = new Map<string, HTMLCanvasElement>();

  return {
    ready: true,
    get(id, size) {
      const bucket = Math.max(8, Math.round(size / 4) * 4);
      const cacheKey = `${id}:${bucket}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const image = images.get(id);
      if (!image) return null;

      const canvas = document.createElement('canvas');
      canvas.width = bucket;
      canvas.height = bucket;
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.drawImage(image, 0, 0, bucket, bucket);
      cache.set(cacheKey, canvas);
      return canvas;
    },
  };
}
