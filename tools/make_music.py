#!/usr/bin/env python3
"""Generate a copyright-free cinematic motivational music bed (WAV) with numpy.

Structure follows the story arc: soft sad pad -> heartbeat pulse builds -> big lift with
drums + bright arpeggio at the turning point -> warm resolve.  Optional impact "booms"
land on scene cuts (taken from scenes.json transitions == flash/whip/zoom).

Usage: python3 tools/make_music.py reels/<slug>/scenes.json   (writes music.wav next to it)
       python3 tools/make_music.py --seconds 45 --lift 20 --out music.wav
"""
import argparse, json, os, wave
import numpy as np

SR = 44100
NOTE = {'A2': 110.0, 'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.0, 'A3': 220.0,
        'B3': 246.94, 'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.0, 'A4': 440.0,
        'B4': 493.88, 'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'G5': 783.99}
# i - VI - III - VII in A minor: Am F C G  (the classic "epic motivational" loop)
CHORDS = [('A2', ['A3', 'C4', 'E4']), ('F3', ['F3', 'A3', 'C4']), ('C3', ['C4', 'E4', 'G4']), ('G3', ['G3', 'B3', 'D4'])]


def env(n, a=0.5, r=0.8):
    e = np.ones(n); ai, ri = int(a * SR), int(r * SR)
    if ai: e[:ai] = np.linspace(0, 1, ai)
    if ri: e[-ri:] *= np.linspace(1, 0, ri)
    return e


def pad(freqs, dur):
    t = np.arange(int(dur * SR)) / SR; s = np.zeros_like(t)
    for f in freqs:
        for det in (-0.12, 0, 0.12):  # detuned saw-ish via a few harmonics
            ff = f * (1 + det / 100)
            s += sum(np.sin(2 * np.pi * ff * k * t) / k for k in (1, 2, 3)) * 0.5
    return s / (len(freqs) * 3) * env(len(t), 0.9, 1.0)


def pluck(f, dur=0.6):
    t = np.arange(int(dur * SR)) / SR
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 6)


def kick(dur=0.5):
    t = np.arange(int(dur * SR)) / SR; f = 50 + 90 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)


def boom(dur=2.5, seed=0):
    t = np.arange(int(dur * SR)) / SR; rng = np.random.default_rng(seed)
    low = np.sin(2 * np.pi * np.cumsum(35 + 60 * np.exp(-t * 8)) / SR) * np.exp(-t * 1.8)
    noise = rng.standard_normal(len(t)) * np.exp(-t * 9) * 0.25
    return low + np.convolve(noise, np.ones(40) / 40, 'same')


def place(buf, clip, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf): return
    j = min(len(buf), i + len(clip)); buf[i:j] += clip[:j - i] * gain


def build(seconds, lift, booms, seed=1):
    n = int((seconds + 1) * SR); mix = np.zeros(n); bar = 2.4  # 100 bpm-ish, 4 beats per bar
    rng = np.random.default_rng(seed)
    for b in range(int(seconds / bar) + 1):
        t0 = b * bar; bass, ch = CHORDS[b % 4]
        bright = t0 >= lift
        place(mix, pad([NOTE[x] for x in ch], bar + 1.0), t0, 0.55 if bright else 0.42)
        place(mix, pad([NOTE[bass]], bar + .6), t0, 0.35)
        if t0 >= lift * 0.45:  # heartbeat pulse
            for q in range(4): place(mix, kick(), t0 + q * bar / 4, 0.55 if bright else 0.28)
        if bright:  # arpeggio on top
            notes = [NOTE[x] * 2 for x in ch]
            for q in range(8): place(mix, pluck(notes[(q + b) % 3], 0.5), t0 + q * bar / 8, 0.16)
        elif b % 2 == 0:  # sparse sad piano
            place(mix, pluck(NOTE[ch[rng.integers(0, 3)]] * 2, 1.6), t0 + 0.2, 0.18)
    # riser into the lift
    t = np.arange(int(2.0 * SR)) / SR
    riser = rng.standard_normal(len(t)) * (t / 2) ** 2 * 0.12
    place(mix, np.convolve(riser, np.ones(25) / 25, 'same'), max(0, lift - 2.0))
    for k, b in enumerate(booms): place(mix, boom(seed=k), b, 0.9)
    # simple stereo widening + reverb-ish tail via feedback delay
    left, right = mix.copy(), mix.copy()
    for d, g in ((0.031, .35), (0.067, .25), (0.113, .18)):
        k = int(d * SR); right[k:] += mix[:-k] * g; left[int(k * 1.3):] += mix[:-int(k * 1.3)] * g
    st = np.stack([left, right], 1)[: int(seconds * SR)]
    fade = int(1.5 * SR); st[-fade:] *= np.linspace(1, 0, fade)[:, None]
    st /= np.max(np.abs(st)) + 1e-9
    return (st * 0.89 * 32767).astype(np.int16)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('scenes', nargs='?')
    ap.add_argument('--seconds', type=float); ap.add_argument('--lift', type=float); ap.add_argument('--out')
    a = ap.parse_args()
    booms, seconds, lift, out = [], a.seconds or 45, a.lift, a.out or 'music.wav'
    if a.scenes:
        spec = json.load(open(a.scenes)); t = 0; turn = None
        for s in spec['scenes']:
            if s.get('transition') in ('flash', 'zoom') and t > 0: booms.append(t)
            if s.get('beat') == 'turn' and turn is None: turn = t
            t += s.get('duration', 3)
        seconds = t + 0.5; lift = lift or turn or t * 0.5
        out = a.out or os.path.join(os.path.dirname(a.scenes), 'music.wav')
    lift = lift or seconds * 0.5
    data = build(seconds, lift, booms)
    with wave.open(out, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
    print(f'wrote {out} ({seconds:.1f}s, lift at {lift:.1f}s, {len(booms)} impacts)')


if __name__ == '__main__':
    main()
