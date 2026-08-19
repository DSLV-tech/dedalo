"""
Sintesi audio di DEDALO.

Genera tutti gli effetti e le tracce musicali del gioco. Nessun campione esterno:
l'audio è composto qui, quindi non ha vincoli di licenza e si può rigenerare
cambiando qualche parametro. Uscita: WAV, poi compressi in MP3 da build-audio.sh.
"""

import math
import os
import numpy as np

SR = 44100
# I WAV restano fuori da public/: solo gli MP3 finiscono nel build.
OUT = os.path.join(os.path.dirname(__file__), "audio-raw")
os.makedirs(OUT, exist_ok=True)

rng = np.random.default_rng(20260819)


# ---------------------------------------------------------------- primitive

def t(n):
    return np.arange(n) / SR


def sine(freq, n, phase=0.0):
    return np.sin(2 * np.pi * freq * t(n) + phase)


def saw(freq, n):
    ph = (t(n) * freq) % 1.0
    return 2.0 * ph - 1.0


def square(freq, n, duty=0.5):
    ph = (t(n) * freq) % 1.0
    return np.where(ph < duty, 1.0, -1.0)


def triangle(freq, n):
    ph = (t(n) * freq) % 1.0
    return 4.0 * np.abs(ph - 0.5) - 1.0


def noise(n):
    return rng.uniform(-1.0, 1.0, n)


def adsr(n, a=0.01, d=0.1, s=0.6, r=0.2):
    """Inviluppo classico, con release che rientra nella durata richiesta."""
    a_n = max(1, int(a * SR))
    d_n = max(1, int(d * SR))
    r_n = max(1, int(r * SR))
    s_n = max(0, n - a_n - d_n - r_n)
    env = np.concatenate([
        np.linspace(0, 1, a_n),
        np.linspace(1, s, d_n),
        np.full(s_n, s),
        np.linspace(s, 0, r_n),
    ])
    return env[:n] if len(env) >= n else np.pad(env, (0, n - len(env)))


def lowpass(x, cutoff):
    """Filtro a un polo: sporco quanto basta, e velocissimo."""
    dt = 1.0 / SR
    rc = 1.0 / (2 * np.pi * max(20.0, cutoff))
    alpha = dt / (rc + dt)
    out = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += alpha * (x[i] - acc)
        out[i] = acc
    return out


def lowpass_sweep(x, cut_start, cut_end):
    dt = 1.0 / SR
    cuts = np.geomspace(max(30.0, cut_start), max(30.0, cut_end), len(x))
    out = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        rc = 1.0 / (2 * np.pi * cuts[i])
        alpha = dt / (rc + dt)
        acc += alpha * (x[i] - acc)
        out[i] = acc
    return out


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def delay(x, seconds, feedback=0.35, mix=0.35, repeats=6):
    d = int(seconds * SR)
    out = x.copy()
    tap = x.copy()
    for i in range(1, repeats + 1):
        tap = np.pad(tap, (d, 0))[: len(x)] * feedback
        out += tap * mix
    return out


def reverb(x, decay=2.2, mix=0.3):
    """Riverbero a convoluzione con una coda di rumore che decade."""
    n = int(decay * SR)
    ir = noise(n) * np.exp(-np.linspace(0, 7, n))
    ir[0] = 1.0
    ir = lowpass(ir, 3200)
    wet = np.convolve(x, ir)[: len(x)]
    wet /= max(1e-9, np.max(np.abs(wet)))
    return (1 - mix) * x + mix * wet * np.max(np.abs(x))


def normalize(x, peak=0.89):
    m = np.max(np.abs(x))
    return x if m < 1e-9 else x * (peak / m)


def soft_clip(x):
    return np.tanh(x * 1.2) / np.tanh(1.2)


def fade(x, seconds=0.01):
    n = int(seconds * SR)
    if n * 2 >= len(x):
        return x
    x = x.copy()
    x[:n] *= np.linspace(0, 1, n)
    x[-n:] *= np.linspace(1, 0, n)
    return x


def place(buf, x, at):
    i = int(at * SR)
    end = min(len(buf), i + len(x))
    if i >= len(buf) or end <= i:
        return
    buf[i:end] += x[: end - i]


def write(name, x, stereo_width=0.0):
    x = soft_clip(normalize(x))
    if stereo_width > 0:
        d = int(0.012 * SR * stereo_width)
        left = x
        right = np.pad(x, (d, 0))[: len(x)] * 0.94
        data = np.stack([left, right], axis=1)
    else:
        data = x[:, None]
    pcm = (np.clip(data, -1, 1) * 32767).astype("<i2")
    import wave

    path = os.path.join(OUT, name + ".wav")
    with wave.open(path, "w") as f:
        f.setnchannels(data.shape[1])
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(pcm.tobytes())
    print(f"  {name}.wav  {len(x)/SR:.1f}s")


# ---------------------------------------------------------------- effetti

def sfx_step():
    n = int(0.09 * SR)
    body = lowpass(noise(n), 900) * adsr(n, 0.002, 0.02, 0.1, 0.05)
    click = sine(180, n) * adsr(n, 0.001, 0.03, 0.0, 0.02) * 0.5
    return fade(body * 0.7 + click, 0.004)


def sfx_hit():
    n = int(0.26 * SR)
    crack = highpass(noise(n), 1400) * adsr(n, 0.001, 0.05, 0.12, 0.16)
    thud = sine(np.geomspace(220, 60, n)[0], n)
    thud = np.sin(2 * np.pi * np.cumsum(np.geomspace(240, 70, n)) / SR) * adsr(n, 0.001, 0.07, 0.15, 0.14)
    return fade(crack * 0.6 + thud * 0.9, 0.004)


def sfx_hurt():
    n = int(0.42 * SR)
    growl = np.sin(2 * np.pi * np.cumsum(np.geomspace(190, 48, n)) / SR)
    growl *= adsr(n, 0.002, 0.12, 0.3, 0.24)
    grit = lowpass(noise(n), 1800) * adsr(n, 0.001, 0.08, 0.15, 0.3) * 0.5
    return fade(reverb(growl + grit, 1.0, 0.18), 0.006)


def sfx_pickup():
    n = int(0.34 * SR)
    out = np.zeros(n)
    for i, f in enumerate([880, 1174, 1568]):
        seg = int(0.09 * SR)
        tone = (sine(f, seg) * 0.7 + triangle(f * 2, seg) * 0.3) * adsr(seg, 0.004, 0.05, 0.2, 0.04)
        place(out, tone, i * 0.055)
    return fade(reverb(out, 0.9, 0.25), 0.004)


def sfx_record():
    n = int(1.1 * SR)
    out = np.zeros(n)
    for i, f in enumerate([523.25, 659.25, 783.99, 1046.5]):
        seg = int(0.6 * SR)
        tone = sine(f, seg) * adsr(seg, 0.01, 0.25, 0.25, 0.3) * (0.9 - i * 0.12)
        place(out, tone, i * 0.11)
    return fade(reverb(out, 2.4, 0.42), 0.01)


def sfx_pulse():
    n = int(0.6 * SR)
    sweep = np.sin(2 * np.pi * np.cumsum(np.geomspace(90, 1400, n)) / SR) * adsr(n, 0.004, 0.1, 0.4, 0.3)
    air = lowpass_sweep(noise(n), 400, 6000) * adsr(n, 0.01, 0.15, 0.3, 0.3) * 0.5
    boom = np.sin(2 * np.pi * np.cumsum(np.geomspace(140, 40, n)) / SR) * adsr(n, 0.001, 0.2, 0.1, 0.3)
    return fade(reverb(sweep * 0.5 + air + boom * 0.8, 1.4, 0.3), 0.005)


def sfx_phase():
    n = int(0.5 * SR)
    base = square(np.float64(1), n)  # placeholder shape
    freq = np.geomspace(1600, 220, n)
    base = np.sign(np.sin(2 * np.pi * np.cumsum(freq) / SR))
    base *= adsr(n, 0.002, 0.1, 0.25, 0.25)
    glitch = noise(n) * (rng.random(n) > 0.985) * 0.6
    return fade(lowpass(base * 0.4 + glitch, 5200), 0.005)


def sfx_death():
    n = int(0.8 * SR)
    zap = np.sin(2 * np.pi * np.cumsum(np.geomspace(900, 60, n)) / SR) * adsr(n, 0.001, 0.2, 0.2, 0.5)
    debris = highpass(noise(n), 900) * adsr(n, 0.001, 0.3, 0.1, 0.4) * 0.55
    return fade(reverb(zap + debris, 1.8, 0.32), 0.006)


def sfx_deny():
    n = int(0.3 * SR)
    buzz = square(92, n, 0.35) * adsr(n, 0.002, 0.05, 0.5, 0.18)
    return fade(lowpass(buzz, 900) * 0.8, 0.005)


def sfx_descend():
    n = int(1.8 * SR)
    shimmer = np.zeros(n)
    for f in [261.63, 329.63, 392.0, 523.25, 659.25]:
        shimmer += sine(f, n) * adsr(n, 0.35, 0.5, 0.4, 0.9) * 0.3
    rise = np.sin(2 * np.pi * np.cumsum(np.geomspace(80, 900, n)) / SR) * adsr(n, 0.5, 0.4, 0.4, 0.8) * 0.5
    return fade(reverb(shimmer + rise, 2.6, 0.42), 0.02)


def sfx_boss():
    n = int(2.6 * SR)
    out = np.zeros(n)
    for i, f in enumerate([55, 58.27, 55]):
        seg = int(0.9 * SR)
        tone = saw(f, seg) * adsr(seg, 0.02, 0.3, 0.5, 0.4)
        tone = lowpass(tone, 420)
        place(out, tone * 0.9, i * 0.75)
    stab = highpass(noise(int(0.5 * SR)), 2200) * adsr(int(0.5 * SR), 0.001, 0.2, 0.1, 0.25)
    place(out, stab * 0.5, 0.0)
    return fade(reverb(out, 3.0, 0.4), 0.02)


def sfx_gameover():
    n = int(3.0 * SR)
    out = np.zeros(n)
    for i, f in enumerate([220.0, 174.61, 146.83, 110.0]):
        seg = int(1.6 * SR)
        tone = (sine(f, seg) * 0.6 + saw(f, seg) * 0.25) * adsr(seg, 0.02, 0.5, 0.35, 0.8)
        place(out, lowpass(tone, 1400) * (0.9 - i * 0.1), i * 0.42)
    return fade(reverb(out, 3.4, 0.45), 0.03)


def sfx_victory():
    n = int(3.4 * SR)
    out = np.zeros(n)
    for i, f in enumerate([261.63, 329.63, 392.0, 523.25]):
        seg = int(2.0 * SR)
        tone = (sine(f, seg) * 0.55 + triangle(f * 2, seg) * 0.25) * adsr(seg, 0.03, 0.4, 0.5, 1.0)
        place(out, tone * (0.95 - i * 0.08), i * 0.28)
    return fade(reverb(out, 3.2, 0.45), 0.03)


def sfx_ui():
    n = int(0.12 * SR)
    return fade(sine(1320, n) * adsr(n, 0.002, 0.03, 0.1, 0.06) * 0.7, 0.003)


# ---------------------------------------------------------------- musica

NOTE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def hz(name, octave):
    return 440.0 * (2 ** ((NOTE[name] + (octave - 4) * 12 - 9) / 12))


def pad(freqs, dur, cutoff=1100, detune=0.004, level=0.5):
    n = int(dur * SR)
    out = np.zeros(n)
    for f in freqs:
        for d in (-detune, 0.0, detune):
            out += saw(f * (1 + d), n) / 3
    out = lowpass(out, cutoff) * adsr(n, dur * 0.28, dur * 0.2, 0.7, dur * 0.4)
    return out * level / max(1, len(freqs))


def pluck(freq, dur, cutoff=2400, level=0.5, wave="saw"):
    n = int(dur * SR)
    src = saw(freq, n) if wave == "saw" else square(freq, n, 0.35)
    env = adsr(n, 0.004, dur * 0.3, 0.18, dur * 0.5)
    return lowpass_sweep(src * env, cutoff, cutoff * 0.25) * level


def sub(freq, dur, level=0.7):
    n = int(dur * SR)
    return sine(freq, n) * adsr(n, 0.01, dur * 0.25, 0.6, dur * 0.35) * level


def kick(dur=0.4, level=0.9):
    n = int(dur * SR)
    body = np.sin(2 * np.pi * np.cumsum(np.geomspace(120, 42, n)) / SR)
    return body * adsr(n, 0.001, 0.12, 0.1, 0.25) * level


def hat(dur=0.07, level=0.28, bright=7000):
    n = int(dur * SR)
    return highpass(noise(n), bright) * adsr(n, 0.001, 0.02, 0.05, 0.04) * level


def snare(dur=0.22, level=0.5):
    n = int(dur * SR)
    return (highpass(noise(n), 1600) * 0.8 + sine(190, n) * 0.35) * adsr(n, 0.001, 0.08, 0.1, 0.12) * level


def build_track(bars, bpm, builder, swing=0.0):
    """Rende il brano con un margine di coda, che poi ripiegheremo sull'inizio."""
    beat = 60.0 / bpm
    length = bars * 4 * beat
    buf = np.zeros(int(length * SR) + 4 * SR)
    builder(buf, beat, bars, swing)
    return buf, int(length * SR)


def make_loop(x, length):
    """
    Ripiega la coda (riverbero, delay, release) sull'inizio del brano: il loop
    si richiude senza il click che si sentirebbe tagliando di netto.
    """
    out = x[:length].copy()
    tail = x[length:]
    n = min(len(tail), length)
    if n > 0:
        out[:n] += tail[:n]
    return out


def theme_menu():
    bpm, bars = 72, 8
    beat = 60.0 / bpm

    def build(buf, beat, bars, _swing):
        chords = [
            [hz("A", 2), hz("C", 3), hz("E", 3)],
            [hz("F", 2), hz("A", 2), hz("C", 3)],
            [hz("G", 2), hz("B", 2), hz("D", 3)],
            [hz("E", 2), hz("G", 2), hz("B", 2)],
        ]
        for b in range(bars):
            at = b * 4 * beat
            ch = chords[b % len(chords)]
            place(buf, pad(ch, 4 * beat, cutoff=760, level=0.62), at)
            place(buf, sub(ch[0] / 2, 4 * beat, 0.5), at)
            for i, step in enumerate([0, 1.5, 2.5, 3.25]):
                f = ch[i % len(ch)] * 2
                place(buf, pluck(f, beat * 0.7, 2600, 0.22) * 0.9, at + step * beat)
            for i in range(8):
                place(buf, hat(level=0.10 + 0.03 * (i % 2), bright=8200), at + i * beat / 2)
    x, length = build_track(bars, bpm, build)
    return make_loop(reverb(delay(x, beat * 0.75, 0.28, 0.24), 2.6, 0.34), length)


def theme_depth(level_index):
    """Tre varianti: più si scende, più il brano si stringe e si incupisce."""
    presets = [
        dict(bpm=84, bars=8, cut=980, roots=["A", "F", "G", "D"], octave=2, drums=0.5, arp=0.30, dark=0.0),
        dict(bpm=92, bars=8, cut=760, roots=["D", "A#", "C", "A"], octave=2, drums=0.75, arp=0.34, dark=0.25),
        dict(bpm=100, bars=8, cut=580, roots=["C", "G#", "A#", "F"], octave=1, drums=0.95, arp=0.30, dark=0.5),
    ]
    p = presets[level_index]
    bpm, bars = p["bpm"], p["bars"]
    beat = 60.0 / bpm

    def build(buf, beat, bars, _swing):
        for b in range(bars):
            at = b * 4 * beat
            root_name = p["roots"][b % len(p["roots"])]
            root = hz(root_name, p["octave"] + 1)
            third = root * (2 ** (3 / 12))
            fifth = root * (2 ** (7 / 12))
            seventh = root * (2 ** (10 / 12))
            place(buf, pad([root, third, fifth, seventh], 4 * beat, p["cut"], level=0.5), at)
            place(buf, sub(hz(root_name, p["octave"]), 4 * beat, 0.62), at)

            arp = [root * 2, fifth * 2, third * 4, fifth * 2, root * 4, third * 2]
            for i in range(8):
                place(buf, pluck(arp[i % len(arp)], beat * 0.42, 3000, p["arp"]), at + i * beat / 2)

            d = p["drums"]
            place(buf, kick(level=0.85 * d), at)
            place(buf, kick(level=0.7 * d), at + 2.5 * beat)
            place(buf, snare(level=0.42 * d), at + 2 * beat)
            for i in range(8):
                place(buf, hat(level=(0.13 if i % 2 == 0 else 0.07) * d, bright=7600), at + i * beat / 2)
            if p["dark"] > 0 and b % 4 == 3:
                place(buf, lowpass(noise(int(beat * 2 * SR)), 500) * np.linspace(0, p["dark"], int(beat * 2 * SR)), at + 2 * beat)
    x, length = build_track(bars, bpm, build)
    return make_loop(reverb(delay(x, beat * 0.5, 0.3, 0.2), 2.2, 0.28), length)


def theme_boss():
    bpm, bars = 112, 8
    beat = 60.0 / bpm

    def build(buf, beat, bars, _swing):
        root_name = "D"
        for b in range(bars):
            at = b * 4 * beat
            root = hz(root_name, 2)
            place(buf, sub(root / 2, 4 * beat, 0.75), at)
            place(buf, pad([root, root * 2 ** (3 / 12), root * 2 ** (6 / 12)], 4 * beat, 520, level=0.55), at)
            riff = [root * 2, root * 2, root * 2 ** (15 / 12), root * 2, root * 2 ** (18 / 12), root * 2 ** (15 / 12)]
            for i in range(16):
                place(buf, pluck(riff[i % len(riff)], beat * 0.22, 3400, 0.26, "square"), at + i * beat / 4)
            for i in range(4):
                place(buf, kick(level=0.95), at + i * beat)
            place(buf, snare(level=0.55), at + beat)
            place(buf, snare(level=0.55), at + 3 * beat)
            for i in range(16):
                place(buf, hat(level=0.10, bright=9000), at + i * beat / 4)
            if b % 4 == 0:
                place(buf, sfx_boss()[: int(beat * 2 * SR)] * 0.35, at)
    x, length = build_track(bars, bpm, build)
    return make_loop(reverb(x, 1.8, 0.24), length)


def theme_epilogue():
    bpm, bars = 62, 6
    beat = 60.0 / bpm

    def build(buf, beat, bars, _swing):
        chords = [
            [hz("C", 3), hz("E", 3), hz("G", 3)],
            [hz("A", 2), hz("C", 3), hz("E", 3)],
            [hz("F", 2), hz("A", 2), hz("C", 3)],
            [hz("G", 2), hz("B", 2), hz("D", 3)],
        ]
        for b in range(bars):
            at = b * 4 * beat
            ch = chords[b % len(chords)]
            place(buf, pad(ch, 4 * beat, 900, level=0.6), at)
            place(buf, sub(ch[0] / 2, 4 * beat, 0.45), at)
            for i, f in enumerate(ch):
                place(buf, pluck(f * 2, beat * 1.4, 2200, 0.2), at + i * beat)
    x, length = build_track(bars, bpm, build)
    return make_loop(reverb(delay(x, beat, 0.3, 0.26), 3.4, 0.42), length)


# ---------------------------------------------------------------- esecuzione

if __name__ == "__main__":
    only = os.environ.get("ONLY", "")
    if only != "music":
        print("Effetti:")
    sfx_list = [
        ("step", sfx_step), ("hit", sfx_hit), ("hurt", sfx_hurt), ("pickup", sfx_pickup),
        ("record", sfx_record), ("pulse", sfx_pulse), ("phase", sfx_phase), ("death", sfx_death),
        ("deny", sfx_deny), ("descend", sfx_descend), ("boss", sfx_boss),
        ("gameover", sfx_gameover), ("victory", sfx_victory), ("ui", sfx_ui),
    ]
    if only != "music":
        for name, fn in sfx_list:
            write("sfx-" + name, fn())

    print("Musica:")
    write("music-menu", theme_menu(), stereo_width=1.0)
    for i, tag in enumerate(["shallow", "deep", "core"]):
        write("music-" + tag, theme_depth(i), stereo_width=1.0)
    write("music-boss", theme_boss(), stereo_width=0.6)
    write("music-epilogue", theme_epilogue(), stereo_width=1.0)
    print("Fatto.")
