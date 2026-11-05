#!/usr/bin/env python3
"""Sync shots + captions to the real narration (voice.mp3) with faster-whisper word timestamps.

Writes timing.json:
  shots: [{id, start, end}]  - shot i changes when its first narration word is spoken
  words: [{w, start, end}]   - Romanised caption words ("cap" of each shot), spread over the spoken words of that shot
  total: seconds

Usage: python3 tools/story_reel/align.py reels/<slug> [--model small]
"""
import argparse, json, os, subprocess


def from_voice_map(d, spec, vm, tail):
    """Exact sync from tts.py: shots start at their first phrase; caption words fill only the spoken intervals."""
    ph = vm['phrases']; shots = spec['shots']; out_shots, words = [], []
    total = ph[-1]['end'] + tail
    starts = {}
    for p in ph: starts.setdefault(p['shot'], p['start'])
    for i, s in enumerate(shots):
        st = 0.0 if i == 0 else starts[s['id']] - 0.05
        en = (starts[shots[i + 1]['id']] - 0.05) if i + 1 < len(shots) else total
        if s.get('card') and i == len(shots) - 1: en = max(en, st + 3.5)
        out_shots.append({'id': s['id'], 'start': round(st, 3), 'end': round(en, 3)})
        iv = [(p['start'], p['end']) for p in ph if p['shot'] == s['id']]; tot = sum(b - a for a, b in iv)
        cap = s.get('cap', '').split(); wts = [len(w) + 1.5 for w in cap]; W = sum(wts) or 1
        acc = 0.0
        for w, wt in zip(cap, wts):
            t0 = acc / W * tot; t1 = (acc + wt) / W * tot; acc += wt
            def at(x):  # speech-time -> clock time
                for a, b in iv:
                    if x <= b - a: return a + x
                    x -= b - a
                return iv[-1][1]
            words.append({'w': w, 'start': round(at(t0), 3), 'end': round(at(t1 - 1e-4), 3)})
    total = max(total, out_shots[-1]['end'])
    json.dump({'shots': out_shots, 'words': words, 'total': round(total, 3)}, open(os.path.join(d, 'timing.json'), 'w'), indent=1, ensure_ascii=False)
    print(f'timing.json (exact, from voice_map): {len(out_shots)} shots, {len(words)} caption words, {total:.1f}s')


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('reel'); ap.add_argument('--model', default='small')
    ap.add_argument('--tail', type=float, default=0.6, help='seconds kept after the last word')
    ap.add_argument('--whisper', action='store_true', help='ignore voice_map.json and use speech recognition')
    a = ap.parse_args(); d = os.path.abspath(a.reel); spec = json.load(open(os.path.join(d, 'shots.json')))
    voice = os.path.join(d, 'voice.mp3')
    vm_path = os.path.join(d, 'voice_map.json')
    if os.path.exists(vm_path) and not a.whisper:
        return from_voice_map(d, spec, json.load(open(vm_path)), a.tail)
    from faster_whisper import WhisperModel
    m = WhisperModel(a.model, device='cpu', compute_type='int8')
    import numpy as np
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', voice, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True).stdout
    segs, _ = m.transcribe(np.frombuffer(raw, np.float32), language=spec.get('language', 'hi'), word_timestamps=True, vad_filter=False)
    spoken = [w for s in segs for w in s.words]
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voice], capture_output=True, text=True).stdout)
    # map script position (by characters) -> spoken word index
    shots = spec['shots']; lens = [len(s['vo'].replace(' ', '')) for s in shots]; tot = sum(lens)
    sp_len = [len(w.word.strip()) for w in spoken]; sp_tot = sum(sp_len); cum = [0]
    for L in sp_len: cum.append(cum[-1] + L)

    def word_at(frac):
        target = frac * sp_tot
        for i in range(len(spoken)):
            if cum[i + 1] > target: return i
        return len(spoken) - 1
    bounds, acc = [], 0
    for L in lens: bounds.append(word_at(acc / tot)); acc += L
    out_shots, words = [], []
    total = min(dur, spoken[-1].end + a.tail) if spoken else dur
    for i, s in enumerate(shots):
        wi = bounds[i]; wj = bounds[i + 1] - 1 if i + 1 < len(shots) else len(spoken) - 1
        start = 0.0 if i == 0 else spoken[wi].start
        end = spoken[bounds[i + 1]].start if i + 1 < len(shots) else total
        if s.get('card') and i == len(shots) - 1: end = max(end, start + 3.5)
        out_shots.append({'id': s['id'], 'start': round(start, 3), 'end': round(end, 3)})
        cap = s.get('cap', '').split(); seg = spoken[wi:wj + 1] or [spoken[wi]]
        for k, w in enumerate(cap):  # caption word k <- proportional spoken word
            a0 = seg[min(len(seg) - 1, int(k * len(seg) / len(cap)))]
            a1 = seg[min(len(seg) - 1, int((k + 1) * len(seg) / len(cap)) - 1 if k + 1 < len(cap) else len(seg) - 1)]
            words.append({'w': w, 'start': round(a0.start, 3), 'end': round(max(a1.end, a0.start + .12), 3)})
    total = max(total, out_shots[-1]['end'])
    json.dump({'shots': out_shots, 'words': words, 'total': round(total, 3)}, open(os.path.join(d, 'timing.json'), 'w'), indent=1, ensure_ascii=False)
    print(f'timing.json: {len(out_shots)} shots, {len(words)} caption words, {total:.1f}s')


if __name__ == '__main__':
    main()
