import { SFX, SFX_GAIN } from './library';
import type { MusicName, SfxName } from './library';

export interface AudioSettings {
  readonly muted: boolean;
  readonly music: number;
  readonly sfx: number;
  /** Vibrazione su colpi, danni e discese (solo dove il dispositivo la supporta). */
  readonly haptics: boolean;
}

const STORAGE_KEY = 'dedalo.audio.v1';
const DEFAULTS: AudioSettings = { muted: false, music: 0.55, sfx: 0.8, haptics: true };

export function loadSettings(): AudioSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULTS;
    const value = parsed as Partial<AudioSettings>;
    return {
      muted: typeof value.muted === 'boolean' ? value.muted : DEFAULTS.muted,
      music: typeof value.music === 'number' ? value.music : DEFAULTS.music,
      sfx: typeof value.sfx === 'number' ? value.sfx : DEFAULTS.sfx,
      haptics: typeof value.haptics === 'boolean' ? value.haptics : DEFAULTS.haptics,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(settings: AudioSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage non disponibile: l'audio funziona comunque per questa sessione */
  }
}

function assetUrl(file: string): string {
  // `import.meta.env.BASE_URL` tiene conto della base relativa (GitHub Pages).
  return `${import.meta.env.BASE_URL}audio/${file}`;
}

/**
 * Mixer WebAudio minimale.
 *
 * I browser bloccano l'audio finché non c'è un gesto dell'utente: il contesto
 * viene creato al primo tasto o tocco (`unlock`) e non prima. Gli effetti sono
 * pochi kilobyte e vengono precaricati insieme; la musica si scarica solo quando
 * serve davvero quel brano.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<AudioBuffer | null>>();
  private currentMusic: MusicName | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicFader: GainNode | null = null;
  private settings: AudioSettings;
  private lastPlayed = new Map<string, number>();

  public constructor(settings: AudioSettings) {
    this.settings = settings;
  }

  public get unlocked(): boolean {
    return this.context !== null;
  }

  /** Da chiamare al primo gesto dell'utente. Idempotente. */
  public unlock(): void {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return;
    }
    type WindowWithLegacyAudio = Window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as WindowWithLegacyAudio).webkitAudioContext;
    if (!Ctor) return;

    const context = new Ctor();
    this.context = context;
    this.masterGain = context.createGain();
    this.musicGain = context.createGain();
    this.sfxGain = context.createGain();
    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(context.destination);
    this.applySettings();

    void Promise.all(SFX.map((name) => this.buffer(`sfx-${name}.mp3`)));

    // Il brano scelto prima dello sblocco è rimasto in sospeso: ora si può suonare.
    // Succede sempre, perché React aggiorna la fase di gioco nello stesso evento
    // che sblocca l'audio, e l'effetto può arrivare prima di questo unlock.
    const pending = this.currentMusic;
    if (pending) {
      this.currentMusic = null;
      this.playMusic(pending, 1.6);
    }
  }

  public update(settings: AudioSettings): void {
    this.settings = settings;
    this.applySettings();
  }

  private applySettings(): void {
    if (!this.masterGain || !this.musicGain || !this.sfxGain || !this.context) return;
    const now = this.context.currentTime;
    this.masterGain.gain.setTargetAtTime(this.settings.muted ? 0 : 1, now, 0.05);
    this.musicGain.gain.setTargetAtTime(this.settings.music, now, 0.08);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfx, now, 0.05);
  }

  private async buffer(file: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(file);
    if (cached) return cached;
    const inFlight = this.pending.get(file);
    if (inFlight) return inFlight;
    const context = this.context;
    if (!context) return null;

    const task = (async (): Promise<AudioBuffer | null> => {
      try {
        const response = await fetch(assetUrl(file));
        if (!response.ok) return null;
        const bytes = await response.arrayBuffer();
        const decoded = await context.decodeAudioData(bytes);
        this.buffers.set(file, decoded);
        return decoded;
      } catch {
        // Audio mancante o non decodificabile: il gioco resta perfettamente giocabile.
        return null;
      } finally {
        this.pending.delete(file);
      }
    })();

    this.pending.set(file, task);
    return task;
  }

  /**
   * @param throttleMs evita che venti eventi nello stesso turno diventino
   *                   venti copie sovrapposte dello stesso campione.
   */
  public play(name: SfxName, options: { rate?: number; gain?: number; throttleMs?: number } = {}): void {
    const context = this.context;
    if (!context || !this.sfxGain || this.settings.muted) return;

    const throttle = options.throttleMs ?? 40;
    const now = performance.now();
    const previous = this.lastPlayed.get(name) ?? -Infinity;
    if (now - previous < throttle) return;
    this.lastPlayed.set(name, now);

    void this.buffer(`sfx-${name}.mp3`).then((buffer) => {
      if (!buffer || !this.sfxGain || !this.context) return;
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = options.rate ?? 1;
      const gain = this.context.createGain();
      gain.gain.value = (options.gain ?? 1) * SFX_GAIN[name];
      source.connect(gain);
      gain.connect(this.sfxGain);
      source.start();
    });
  }

  /** Passa a un brano con dissolvenza incrociata. Ripetere lo stesso brano non fa nulla. */
  public playMusic(name: MusicName | null, fadeSeconds = 1.1): void {
    if (this.currentMusic === name) return;
    this.currentMusic = name;
    const context = this.context;
    if (!context || !this.musicGain) return;

    const previousSource = this.musicSource;
    const previousFader = this.musicFader;
    if (previousSource && previousFader) {
      previousFader.gain.setTargetAtTime(0, context.currentTime, fadeSeconds / 3);
      window.setTimeout(() => {
        try {
          previousSource.stop();
        } catch {
          /* già fermata */
        }
      }, fadeSeconds * 1000 + 200);
    }
    this.musicSource = null;
    this.musicFader = null;
    if (!name) return;

    void this.buffer(`music-${name}.mp3`).then((buffer) => {
      if (!buffer || this.currentMusic !== name || !this.context || !this.musicGain) return;
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const fader = this.context.createGain();
      fader.gain.value = 0;
      fader.gain.setTargetAtTime(1, this.context.currentTime, fadeSeconds / 3);
      source.connect(fader);
      fader.connect(this.musicGain);
      source.start();
      this.musicSource = source;
      this.musicFader = fader;
    });
  }

  public suspend(): void {
    if (this.context && this.context.state === 'running') void this.context.suspend();
  }

  public resume(): void {
    if (this.context && this.context.state === 'suspended') void this.context.resume();
  }
}
