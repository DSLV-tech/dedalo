/**
 * PRNG deterministico (mulberry32). Lo stato è un semplice numero:
 * lo teniamo dentro GameState così l'intera run è serializzabile e riproducibile.
 */

export interface Rng {
  /** Stato corrente: da rimettere in GameState dopo l'uso. */
  state: number;
}

export function createRng(seed: number): Rng {
  return { state: seed >>> 0 };
}

/** Float in [0, 1). */
export function next(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Intero in [min, max] inclusi. */
export function range(rng: Rng, min: number, max: number): number {
  return min + Math.floor(next(rng) * (max - min + 1));
}

export function chance(rng: Rng, probability: number): boolean {
  return next(rng) < probability;
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick: array vuoto');
  const item = items[Math.floor(next(rng) * items.length)];
  // noUncheckedIndexedAccess: l'indice è sempre valido, ma il tipo non lo sa.
  return item as T;
}

/** Fisher–Yates su una copia: non muta l'input. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next(rng) * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/** Seed leggibile a partire da una stringa (per le run condivise). */
export function seedFromString(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
