import { idx, isWalkable } from '../engine/grid';
import type { Actor, Fx, GameState, Level, Vec } from '../engine/types';
import { Tile, Visibility } from '../engine/types';
import { ACTOR_COLOR, ITEM_COLOR, PALETTE } from './palette';
import { loadSpriteAtlas } from './sprites';
import type { SpriteAtlas, SpriteId } from './sprites';

export interface Camera {
  readonly tile: number;
  readonly originX: number;
  readonly originY: number;
}

const MIN_TILE = 14;
const MAX_TILE = 34;
const MOVE_MS = 130;
const FX_MS = 460;
const NUMBER_MS = 900;

/**
 * Quante celle tenere in vista. Su schermo stretto ne mostriamo meno, altrimenti
 * i tasselli scendono sotto i 16px e il labirinto diventa illeggibile su telefono.
 */
function targetCells(width: number): { readonly columns: number; readonly rows: number } {
  if (width < 480) return { columns: 13, rows: 11 };
  if (width < 900) return { columns: 17, rows: 13 };
  return { columns: 21, rows: 14 };
}

export function computeCamera(state: GameState, width: number, height: number, focus: Vec): Camera {
  const target = targetCells(width);
  const tile = Math.max(
    MIN_TILE,
    Math.min(MAX_TILE, Math.floor(Math.min(width / target.columns, height / target.rows))),
  );
  const columns = width / tile;
  const rows = height / tile;
  const { level } = state;

  const clamp = (value: number, span: number, total: number): number => {
    if (total <= span) return (total - span) / 2;
    return Math.max(0, Math.min(total - span, value));
  };

  return {
    tile,
    originX: clamp(focus.x + 0.5 - columns / 2, columns, level.width),
    originY: clamp(focus.y + 0.5 - rows / 2, rows, level.height),
  };
}

interface Motion {
  from: Vec;
  to: Vec;
  start: number;
  facing: Vec;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface FloatingNumber {
  x: number;
  y: number;
  text: string;
  color: string;
  start: number;
}

interface TimedFx extends Fx {
  readonly start: number;
}

function visibilityAt(level: Level, x: number, y: number): number {
  return level.visibility[idx(level.width, x, y)] ?? Visibility.Unknown;
}

function glow(ctx: CanvasRenderingContext2D, color: string, blur: number): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function clearGlow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowBlur = 0;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/**
 * La scena tiene lo stato *visivo* che il motore non conosce: interpolazione fra
 * celle, particelle, numeri fluttuanti, scossa della camera e cache degli sprite.
 * Il motore resta puro e a turni; qui il turno diventa movimento continuo.
 */
export class Scene {
  private atlas: SpriteAtlas | null = null;
  private motions = new Map<number, Motion>();
  private particles: Particle[] = [];
  private numbers: FloatingNumber[] = [];
  private effects: TimedFx[] = [];
  private shake = 0;
  private flash = 0;
  private flashColor: string = PALETTE.danger;
  private lastTurn = -1;
  private lastDepth = -1;
  private lightCanvas: HTMLCanvasElement | null = null;
  private reducedMotion = false;

  public constructor(reducedMotion: boolean) {
    this.reducedMotion = reducedMotion;
  }

  public async load(): Promise<void> {
    this.atlas = await loadSpriteAtlas();
  }

  public get ready(): boolean {
    return this.atlas !== null;
  }

  /** Chiamato quando arriva un nuovo stato dal motore. */
  public sync(state: GameState, now: number): void {
    if (state.depth !== this.lastDepth) {
      this.motions.clear();
      this.particles = [];
      this.numbers = [];
      this.effects = [];
      this.lastDepth = state.depth;
    }
    if (state.turn === this.lastTurn) return;
    this.lastTurn = state.turn;

    for (const actor of [state.player, ...state.enemies]) {
      this.trackMotion(actor, now);
    }
    const alive = new Set<number>([state.player.id, ...state.enemies.map((e) => e.id)]);
    for (const id of [...this.motions.keys()]) if (!alive.has(id)) this.motions.delete(id);

    for (const fx of state.fx) {
      this.effects.push({ ...fx, start: now });
      this.spawnFor(fx);
    }
  }

  private trackMotion(actor: Actor, now: number): void {
    const existing = this.motions.get(actor.id);
    if (!existing) {
      this.motions.set(actor.id, {
        from: actor.pos,
        to: actor.pos,
        start: now,
        facing: { x: 0, y: 1 },
      });
      return;
    }
    if (existing.to.x === actor.pos.x && existing.to.y === actor.pos.y) return;

    const current = this.interpolate(existing, now);
    const dx = actor.pos.x - existing.to.x;
    const dy = actor.pos.y - existing.to.y;
    this.motions.set(actor.id, {
      from: current,
      to: actor.pos,
      start: now,
      facing: dx === 0 && dy === 0 ? existing.facing : { x: Math.sign(dx), y: Math.sign(dy) },
    });
  }

  private interpolate(motion: Motion, now: number): Vec {
    if (this.reducedMotion) return motion.to;
    const t = Math.min(1, (now - motion.start) / MOVE_MS);
    const e = easeOut(t);
    return {
      x: motion.from.x + (motion.to.x - motion.from.x) * e,
      y: motion.from.y + (motion.to.y - motion.from.y) * e,
    };
  }

  private positionOf(actor: Actor, now: number): Vec {
    const motion = this.motions.get(actor.id);
    return motion ? this.interpolate(motion, now) : actor.pos;
  }

  private spawnFor(fx: Fx): void {
    const color =
      fx.tone === 'bad' ? PALETTE.danger : fx.tone === 'good' ? PALETTE.player : PALETTE.wallVisible;

    if (fx.amount !== null && fx.amount > 0) {
      this.numbers.push({
        x: fx.pos.x + 0.5,
        y: fx.pos.y + 0.4,
        text: fx.kind === 'heal' ? `+${fx.amount}` : `−${fx.amount}`,
        color: fx.kind === 'heal' ? PALETTE.player : fx.tone === 'bad' ? PALETTE.danger : PALETTE.exit,
        start: performance.now(),
      });
    }

    const counts: Record<Fx['kind'], number> = {
      hit: 14,
      death: 30,
      pulse: 26,
      pickup: 12,
      phase: 16,
      heal: 12,
      blocked: 8,
    };
    const count = this.reducedMotion ? 0 : counts[fx.kind];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 0.6 + Math.random() * (fx.kind === 'death' ? 3.2 : 1.8);
      this.particles.push({
        x: fx.pos.x + 0.5,
        y: fx.pos.y + 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 340 + Math.random() * 420,
        size: 0.05 + Math.random() * 0.08,
        color: fx.kind === 'pickup' ? PALETTE.wallVisible : color,
      });
    }

    if (fx.onPlayer && fx.kind === 'hit') {
      this.shake = Math.min(1, this.shake + 0.8);
      this.flash = 1;
      this.flashColor = PALETTE.danger;
    }
    if (fx.kind === 'death') this.shake = Math.min(1, this.shake + 0.35);
    if (fx.kind === 'pulse') {
      this.flash = 0.5;
      this.flashColor = PALETTE.player;
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    width: number,
    height: number,
    now: number,
    delta: number,
  ): void {
    this.step(delta);

    const focus = this.positionOf(state.player, now);
    const camera = computeCamera(state, width, height, focus);
    const t = camera.tile;
    const shakeX = this.reducedMotion ? 0 : (Math.random() - 0.5) * this.shake * t * 0.5;
    const shakeY = this.reducedMotion ? 0 : (Math.random() - 0.5) * this.shake * t * 0.5;

    const toX = (x: number): number => (x - camera.originX) * t + shakeX;
    const toY = (y: number): number => (y - camera.originY) * t + shakeY;

    ctx.fillStyle = PALETTE.background;
    ctx.fillRect(0, 0, width, height);

    const { level } = state;
    const minX = Math.max(0, Math.floor(camera.originX) - 1);
    const minY = Math.max(0, Math.floor(camera.originY) - 1);
    const maxX = Math.min(level.width - 1, Math.ceil(camera.originX + width / t) + 1);
    const maxY = Math.min(level.height - 1, Math.ceil(camera.originY + height / t) + 1);

    this.drawFloors(ctx, level, minX, minY, maxX, maxY, t, toX, toY, now);
    this.drawWalls(ctx, level, minX, minY, maxX, maxY, t, toX, toY);
    this.drawDoors(ctx, level, minX, minY, maxX, maxY, t, toX, toY);
    this.drawExit(ctx, state, t, toX, toY, now);
    this.drawItems(ctx, state, t, toX, toY, now);
    this.drawActors(ctx, state, t, toX, toY, now);
    this.drawParticles(ctx, t, toX, toY);
    this.drawEffects(ctx, t, toX, toY, now);
    this.applyLighting(ctx, state, width, height, t, toX, toY, focus, now);
    this.drawNumbers(ctx, t, toX, toY, now);
    this.drawFlash(ctx, width, height);
  }

  private step(delta: number): void {
    const decay = Math.exp(-delta / 90);
    this.shake *= decay;
    if (this.shake < 0.01) this.shake = 0;
    this.flash *= Math.exp(-delta / 110);
    if (this.flash < 0.01) this.flash = 0;

    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.life += delta;
      if (p.life >= p.maxLife) continue;
      const drag = Math.exp(-delta / 260);
      p.x += (p.vx * delta) / 1000;
      p.y += (p.vy * delta) / 1000;
      p.vx *= drag;
      p.vy *= drag;
      alive.push(p);
    }
    this.particles = alive.slice(-600);

    const now = performance.now();
    this.numbers = this.numbers.filter((n) => now - n.start < NUMBER_MS);
    this.effects = this.effects.filter((f) => now - f.start < FX_MS);
  }

  private drawFloors(
    ctx: CanvasRenderingContext2D,
    level: Level,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    t: number,
    toX: (n: number) => number,
    toY: (n: number) => number,
    now: number,
  ): void {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const vis = visibilityAt(level, x, y);
        if (vis === Visibility.Unknown) continue;
        const tile = level.tiles[idx(level.width, x, y)];
        if (!isWalkable(level, x, y) && tile !== Tile.VaultDoor) continue;

        const sx = toX(x);
        const sy = toY(y);
        ctx.fillStyle = vis === Visibility.Visible ? PALETTE.floorVisible : PALETTE.floorExplored;
        ctx.fillRect(sx, sy, t, t);

        // Trama del pavimento: un reticolo tenue che dà scala e profondità.
        if (vis === Visibility.Visible && t >= 18) {
          ctx.strokeStyle = 'rgba(49,245,255,0.07)';
          ctx.lineWidth = 1;
          ctx.strokeRect(sx + t * 0.28, sy + t * 0.28, t * 0.44, t * 0.44);
          if ((x + y) % 3 === 0) {
            const shimmer = 0.04 + 0.03 * Math.sin(now / 900 + x * 0.7 + y * 0.9);
            ctx.fillStyle = `rgba(49,245,255,${shimmer.toFixed(3)})`;
            ctx.fillRect(sx, sy, t, t);
          }
        }
      }
    }
  }

  private drawWalls(
    ctx: CanvasRenderingContext2D,
    level: Level,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    t: number,
    toX: (n: number) => number,
    toY: (n: number) => number,
  ): void {
    ctx.lineCap = 'round';
    for (const pass of [Visibility.Explored, Visibility.Visible] as const) {
      ctx.strokeStyle = pass === Visibility.Visible ? PALETTE.wallVisible : PALETTE.wallExplored;
      ctx.lineWidth = pass === Visibility.Visible ? Math.max(1.6, t * 0.09) : Math.max(1, t * 0.06);
      glow(ctx, PALETTE.wallVisible, pass === Visibility.Visible ? 14 : 0);
      ctx.beginPath();
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (visibilityAt(level, x, y) !== pass) continue;
          if (level.tiles[idx(level.width, x, y)] === Tile.Wall) continue;
          const sx = toX(x);
          const sy = toY(y);
          const solid = (nx: number, ny: number): boolean =>
            nx < 0 || ny < 0 || nx >= level.width || ny >= level.height
              ? true
              : level.tiles[idx(level.width, nx, ny)] === Tile.Wall;
          if (solid(x, y - 1)) { ctx.moveTo(sx, sy); ctx.lineTo(sx + t, sy); }
          if (solid(x, y + 1)) { ctx.moveTo(sx, sy + t); ctx.lineTo(sx + t, sy + t); }
          if (solid(x - 1, y)) { ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + t); }
          if (solid(x + 1, y)) { ctx.moveTo(sx + t, sy); ctx.lineTo(sx + t, sy + t); }
        }
      }
      ctx.stroke();
    }
    clearGlow(ctx);
  }

  private drawDoors(
    ctx: CanvasRenderingContext2D,
    level: Level,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    t: number,
    toX: (n: number) => number,
    toY: (n: number) => number,
  ): void {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const vis = visibilityAt(level, x, y);
        if (vis === Visibility.Unknown) continue;
        const tile = level.tiles[idx(level.width, x, y)];
        if (tile !== Tile.Door && tile !== Tile.VaultDoor) continue;
        const color = tile === Tile.VaultDoor ? PALETTE.vault : PALETTE.door;
        const sx = toX(x);
        const sy = toY(y);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, t * 0.12);
        glow(ctx, color, vis === Visibility.Visible ? 14 : 0);
        ctx.strokeRect(sx + t * 0.2, sy + t * 0.2, t * 0.6, t * 0.6);
        if (tile === Tile.VaultDoor) {
          ctx.beginPath();
          ctx.moveTo(sx + t * 0.35, sy + t * 0.5);
          ctx.lineTo(sx + t * 0.65, sy + t * 0.5);
          ctx.stroke();
        }
        clearGlow(ctx);
      }
    }
  }

  private sprite(id: SpriteId, size: number): CanvasImageSource | null {
    return this.atlas ? this.atlas.get(id, size) : null;
  }

  private drawExit(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    t: number,
    toX: (n: number) => number,
    toY: (n: number) => number,
    now: number,
  ): void {
    const { level } = state;
    if (visibilityAt(level, level.exit.x, level.exit.y) === Visibility.Unknown) return;
    const image = this.sprite(state.sealed ? 'exitSealed' : 'exit', t * 1.15);
    const pulse = 0.9 + 0.1 * Math.sin(now / 320);
    const size = t * 1.15 * (state.sealed ? 1 : pulse);
    const cx = toX(level.exit.x) + t / 2;
    const cy = toY(level.exit.y) + t / 2;
    if (!image) return;
    ctx.save();
    ctx.globalAlpha = visibilityAt(level, level.exit.x, level.exit.y) === Visibility.Visible ? 1 : 0.45;
    if (!state.sealed) {
      ctx.translate(cx, cy);
      ctx.rotate(now / 4000);
      ctx.drawImage(image, -size / 2, -size / 2, size, size);
    } else {
      ctx.drawImage(image, cx - size / 2, cy - size / 2, size, size);
    }
    ctx.restore();
  }

  private drawItems(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    t: number,
    toX: (n: number) => number,
    toY: (n: number) => number,
    now: number,
  ): void {
    for (const item of state.items) {
      const vis = visibilityAt(state.level, item.pos.x, item.pos.y);
      if (vis === Visibility.Unknown) continue;
      const visible = vis === Visibility.Visible;
      const image = this.sprite(item.kind, t * 0.78);
      if (!image) continue;
      const bob = visible && !this.reducedMotion ? Math.sin(now / 420 + item.id) * t * 0.07 : 0;
      const size = t * 0.78;
      ctx.save();
      ctx.globalAlpha = visible ? 1 : 0.34;
      ctx.drawImage(image, toX(item.pos.x) + (t - size) / 2, toY(item.pos.y) + (t - size) / 2 + bob, size, size);
      ctx.restore();
      this.dropShadow(ctx, toX(item.pos.x) + t / 2, toY(item.pos.y) + t * 0.86, t * 0.24, visible ? 0.4 : 0.15);
      void ITEM_COLOR[item.kind];
    }
  }

  private dropShadow(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    alpha: number,
  ): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawActors(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    t: number,
    toX: (n: number) => number,
    toY: (n: number) => number,
    now: number,
  ): void {
    const anchorsStanding = state.enemies.some((e) => e.kind === 'anchor');

    const paint = (actor: Actor, alpha: number): void => {
      const pos = this.positionOf(actor, now);
      const scale = actor.kind === 'architect' ? 1.5 : actor.kind === 'warden' ? 1.15 : 1;
      const size = t * 0.94 * scale;
      const image = this.sprite(actor.kind, size);
      const cx = toX(pos.x) + t / 2;
      const cy = toY(pos.y) + t / 2;
      this.dropShadow(ctx, cx, toY(pos.y) + t * 0.9, t * 0.3 * scale, 0.45 * alpha);

      ctx.save();
      ctx.globalAlpha = alpha;
      const idleBob = this.reducedMotion ? 0 : Math.sin(now / 520 + actor.id) * t * 0.03;
      if (image) {
        const motion = this.motions.get(actor.id);
        const facing = motion?.facing ?? { x: 0, y: 1 };
        ctx.translate(cx, cy + idleBob);
        // Solo un leggero sbandamento nella direzione di marcia: niente rotazioni piene,
        // che renderebbero illeggibili gli sprite.
        if (!this.reducedMotion) ctx.rotate(facing.x * 0.08);
        ctx.drawImage(image, -size / 2, -size / 2, size, size);
      }
      ctx.restore();

      if (actor.kind === 'architect' && anchorsStanding) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-now / 900);
        ctx.strokeStyle = PALETTE.vault;
        ctx.setLineDash([t * 0.2, t * 0.18]);
        ctx.lineWidth = Math.max(1.6, t * 0.08);
        glow(ctx, PALETTE.vault, 16);
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.72, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        clearGlow(ctx);
      }

      if (actor.kind !== 'player' && actor.hp < actor.maxHp) {
        const ratio = Math.max(0, actor.hp / actor.maxHp);
        const barWidth = t * 0.66;
        const barX = cx - barWidth / 2;
        const barY = toY(pos.y) + t * 0.02;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(barX, barY, barWidth, t * 0.075);
        ctx.fillStyle = ACTOR_COLOR[actor.kind];
        ctx.fillRect(barX, barY, barWidth * ratio, t * 0.075);
      }
    };

    for (const enemy of state.enemies) {
      const vis = visibilityAt(state.level, enemy.pos.x, enemy.pos.y);
      if (vis !== Visibility.Visible) continue;
      paint(enemy, 1);
    }
    paint(state.player, 1);
  }

  private drawParticles(
    ctx: CanvasRenderingContext2D,
    t: number,
    toX: (n: number) => number,
    toY: (n: number) => number,
  ): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const fade = 1 - p.life / p.maxLife;
      ctx.globalAlpha = fade * 0.9;
      ctx.fillStyle = p.color;
      const size = p.size * t * fade;
      ctx.fillRect(toX(p.x) - size / 2, toY(p.y) - size / 2, size, size);
    }
    ctx.restore();
  }

  private drawEffects(
    ctx: CanvasRenderingContext2D,
    t: number,
    toX: (n: number) => number,
    toY: (n: number) => number,
    now: number,
  ): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const fx of this.effects) {
      const age = (now - fx.start) / FX_MS;
      if (age < 0 || age > 1) continue;
      const fade = 1 - age;
      const cx = toX(fx.pos.x + 0.5);
      const cy = toY(fx.pos.y + 0.5);
      ctx.globalAlpha = fade;
      if (fx.kind === 'pulse') {
        ctx.strokeStyle = PALETTE.player;
        ctx.lineWidth = Math.max(2, t * 0.14) * fade;
        ctx.beginPath();
        ctx.arc(cx, cy, t * (0.4 + age * 1.6), 0, Math.PI * 2);
        ctx.stroke();
      } else if (fx.kind === 'phase') {
        ctx.strokeStyle = PALETTE.door;
        ctx.lineWidth = Math.max(1.6, t * 0.09) * fade;
        ctx.strokeRect(cx - t * 0.45 * (1 + age), cy - t * 0.45 * (1 + age), t * 0.9 * (1 + age), t * 0.9 * (1 + age));
      } else if (fx.kind === 'blocked') {
        ctx.strokeStyle = PALETTE.vault;
        ctx.lineWidth = Math.max(2, t * 0.1) * fade;
        ctx.beginPath();
        ctx.arc(cx, cy, t * (0.7 - age * 0.2), 0, Math.PI * 2);
        ctx.stroke();
      } else if (fx.kind === 'pickup') {
        ctx.strokeStyle = PALETTE.wallVisible;
        ctx.lineWidth = Math.max(1.5, t * 0.07) * fade;
        ctx.beginPath();
        ctx.arc(cx, cy, t * (0.6 - age * 0.4), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /**
   * Illuminazione: uno strato scuro a schermo intero da cui "ritagliamo" le luci.
   * Il risultato è che il buio pesa davvero e le sorgenti luminose contano.
   */
  private applyLighting(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    width: number,
    height: number,
    t: number,
    toX: (n: number) => number,
    toY: (n: number) => number,
    focus: Vec,
    now: number,
  ): void {
    if (!this.lightCanvas) this.lightCanvas = document.createElement('canvas');
    const canvas = this.lightCanvas;
    if (canvas.width !== Math.ceil(width) || canvas.height !== Math.ceil(height)) {
      canvas.width = Math.ceil(width);
      canvas.height = Math.ceil(height);
    }
    const light = canvas.getContext('2d');
    if (!light) return;

    light.globalCompositeOperation = 'source-over';
    light.fillStyle = 'rgba(2, 4, 10, 0.62)';
    light.fillRect(0, 0, width, height);
    light.globalCompositeOperation = 'destination-out';

    const carve = (cx: number, cy: number, radius: number, strength: number): void => {
      const gradient = light.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius);
      gradient.addColorStop(0, `rgba(0,0,0,${strength})`);
      gradient.addColorStop(0.55, `rgba(0,0,0,${strength * 0.7})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      light.fillStyle = gradient;
      light.beginPath();
      light.arc(cx, cy, radius, 0, Math.PI * 2);
      light.fill();
    };

    const flicker = this.reducedMotion ? 1 : 0.97 + 0.03 * Math.sin(now / 140);
    // Due aloni: uno stretto e pieno (la torcia), uno largo e tenue che tiene
    // leggibile la parte di labirinto già esplorata.
    carve(toX(focus.x + 0.5), toY(focus.y + 0.5), state.stats.vision * t * 2.4, 0.45);
    carve(toX(focus.x + 0.5), toY(focus.y + 0.5), state.stats.vision * t * 0.95 * flicker, 1);

    for (const enemy of state.enemies) {
      if (visibilityAt(state.level, enemy.pos.x, enemy.pos.y) !== Visibility.Visible) continue;
      const pos = this.positionOf(enemy, now);
      carve(toX(pos.x + 0.5), toY(pos.y + 0.5), t * (enemy.kind === 'architect' ? 3.4 : 1.9), 0.85);
    }
    for (const item of state.items) {
      if (visibilityAt(state.level, item.pos.x, item.pos.y) !== Visibility.Visible) continue;
      carve(toX(item.pos.x + 0.5), toY(item.pos.y + 0.5), t * 1.2, 0.6);
    }
    if (visibilityAt(state.level, state.level.exit.x, state.level.exit.y) !== Visibility.Unknown) {
      carve(toX(state.level.exit.x + 0.5), toY(state.level.exit.y + 0.5), t * 3, 0.9);
    }

    light.globalCompositeOperation = 'source-over';
    ctx.drawImage(canvas, 0, 0, width, height);

    // Alone caldo attorno al giocatore, sopra il buio.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(
      toX(focus.x + 0.5),
      toY(focus.y + 0.5),
      0,
      toX(focus.x + 0.5),
      toY(focus.y + 0.5),
      t * 3.4,
    );
    halo.addColorStop(0, 'rgba(124,255,90,0.16)');
    halo.addColorStop(1, 'rgba(124,255,90,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  private drawNumbers(
    ctx: CanvasRenderingContext2D,
    t: number,
    toX: (n: number) => number,
    toY: (n: number) => number,
    now: number,
  ): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const n of this.numbers) {
      const age = (now - n.start) / NUMBER_MS;
      if (age > 1) continue;
      const rise = easeOut(age) * t * 1.1;
      ctx.globalAlpha = 1 - age * age;
      ctx.font = `700 ${Math.max(12, t * 0.5)}px ui-monospace, Menlo, monospace`;
      ctx.lineWidth = Math.max(2, t * 0.08);
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(n.text, toX(n.x), toY(n.y) - rise);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, toX(n.x), toY(n.y) - rise);
    }
    ctx.restore();
  }

  private drawFlash(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.flash <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.flash * 0.22;
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

/** Minimappa: pianta compatta di ciò che è già stato esplorato. */
export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  height: number,
): void {
  const { level } = state;
  const scale = Math.max(1, Math.floor(Math.min(width / level.width, height / level.height)));
  const offsetX = (width - level.width * scale) / 2;
  const offsetY = (height - level.height * scale) / 2;

  ctx.clearRect(0, 0, width, height);
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const vis = visibilityAt(level, x, y);
      if (vis === Visibility.Unknown) continue;
      const tile = level.tiles[idx(level.width, x, y)];
      if (tile === Tile.Wall) continue;
      ctx.fillStyle =
        tile === Tile.Exit
          ? PALETTE.exit
          : tile === Tile.VaultDoor
            ? PALETTE.vault
            : vis === Visibility.Visible
              ? 'rgba(49,245,255,0.75)'
              : 'rgba(49,245,255,0.22)';
      ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
    }
  }
  for (const item of state.items) {
    if (visibilityAt(level, item.pos.x, item.pos.y) === Visibility.Unknown) continue;
    if (item.kind !== 'record' && item.kind !== 'key') continue;
    ctx.fillStyle = ITEM_COLOR[item.kind];
    ctx.fillRect(offsetX + item.pos.x * scale - 1, offsetY + item.pos.y * scale - 1, scale + 2, scale + 2);
  }
  ctx.fillStyle = PALETTE.player;
  ctx.fillRect(offsetX + state.player.pos.x * scale - 1, offsetY + state.player.pos.y * scale - 1, scale + 2, scale + 2);
}

/** Converte una posizione sullo schermo in coordinate di griglia (input touch). */
export function screenToTile(
  state: GameState,
  width: number,
  height: number,
  clientX: number,
  clientY: number,
): Vec {
  const camera = computeCamera(state, width, height, state.player.pos);
  return {
    x: Math.floor(camera.originX + clientX / camera.tile),
    y: Math.floor(camera.originY + clientY / camera.tile),
  };
}
