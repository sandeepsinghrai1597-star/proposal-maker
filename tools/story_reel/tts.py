#!/usr/bin/env python3
"""Performance TTS: narration that breathes like the user's ElevenLabs reference renders.

Why not one TTS call?  A single call lets the model decide pauses, and it rushes or pauses in
the wrong place. Here we DIRECT the read, like a dubbing director:
  1. direct()     script -> phrases (split at punctuation / breath points), each with a beat
                  (hook, story, dialogue, twist, moral, cta) and an exact pause after it, using
                  pause lengths measured from the reference voices (voice_profiles.json).
  2. synth        each phrase is voiced separately (ElevenLabs gets previous/next text so the
                  intonation stays continuous) with per-beat expression settings.
  3. assemble     phrases are trimmed and joined with the measured silence (+ room tone),
                  10 ms crossfades, then EQ/compression/loudness.
  4. qc           pause rate, median pause, pause share and speed are compared with the
                  reference range and printed as PASS/WARN.
Outputs voice.mp3 + voice_map.json (exact phrase timings -> align.py uses it, so captions are
frame-accurate without speech recognition).

Script marks you can use inside "vo":
  ,  ->  short breath      ...  ->  dramatic beat     ।/.  -> sentence     ?/! -> question/exclaim
  [p] -> extra pause        *word* -> emphasis (ElevenLabs only)

Usage:
  python3 tools/story_reel/tts.py reels/<slug> [--persona aakash|ayaan] [--provider kokoro|parler|elevenlabs|openai|edge]
  (default without keys: kokoro = open-source Kokoro-82M, Apache-2.0, runs locally; parler needs a HF token)
  python3 tools/story_reel/tts.py reels/<slug> --plan        # only print the directed plan
"""
import argparse, asyncio, json, os, re, subprocess, sys, tempfile, urllib.parse, urllib.request
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
PROFILES = json.load(open(os.path.join(HERE, 'voice_profiles.json')))
SR = 44100

# Pause lengths (seconds). Base values = measured medians/percentiles of the reference renders:
# p25 ~0.22, median ~0.38, p75 ~0.48, p90 ~0.52, max ~0.64. Persona scales them (ayaan breathes more).
PAUSE = {'rhetorical': 0.78, 'comma': 0.22, 'breath': 0.18, 'sentence': 0.40, 'question': 0.46, 'beat': 0.52,
         'pre_moral': 0.62, 'shot_end': 0.40, 'extra': 0.35, 'final': 0.0}
PERSONA_SCALE = {'aakash': 0.80, 'ayaan': 1.12}
MAX_WORDS = 8          # longest phrase without a breath (reference: ~5-7 words between pauses)
SPEECH_VERBS = {'बोला', 'बोली', 'बोले', 'कहा', 'पूछा', 'चिल्लाया', 'चिल्लाए', 'दहाड़ा', 'हँसा', 'हंसा'}
BREATH_BEFORE = {'सिर्फ', 'और', 'पर', 'लेकिन', 'कि', 'तो', 'जो', 'क्योंकि', 'जब', 'तब', 'फिर', 'वरना', 'बल्कि'}

# Expression per beat: ElevenLabs (stability lower = more emotional; speed) / edge-tts (rate, pitch delta)
BEAT_STYLE = {
    'hook':     {'stability': 0.42, 'style': 0.35, 'speed': 0.97, 'rate': -3, 'pitch': 0},
    'setup':    {'stability': 0.50, 'style': 0.20, 'speed': 1.02, 'rate': 3, 'pitch': 0},
    'spark':    {'stability': 0.46, 'style': 0.30, 'speed': 1.00, 'rate': 0, 'pitch': 2},
    'pressure': {'stability': 0.40, 'style': 0.40, 'speed': 1.03, 'rate': 4, 'pitch': 0},
    'dialogue': {'stability': 0.36, 'style': 0.50, 'speed': 1.00, 'rate': 0, 'pitch': 4},
    'turn':     {'stability': 0.38, 'style': 0.45, 'speed': 0.95, 'rate': -4, 'pitch': -2},
    'moral':    {'stability': 0.55, 'style': 0.30, 'speed': 0.93, 'rate': -7, 'pitch': -3},
    'cta':      {'stability': 0.55, 'style': 0.20, 'speed': 1.02, 'rate': 2, 'pitch': 2},
}


# ------------------------------------------------------------------ 1. direction
def direct(spec, persona):
    sc = PERSONA_SCALE.get(persona, 1.0); plan = []
    shots = spec['shots']
    for si, s in enumerate(shots):
        beat = s.get('beat', 'setup'); beat = 'pressure' if beat == 'conflict' else beat
        text = s['vo'].strip()
        # split keeping the delimiter
        toks = re.split(r'(\.\.\.|…|\[p\]|[,،।.?!—])', text)
        cur = ''
        pieces = []
        for t in toks:
            if t is None or t == '': continue
            if t in ('...', '…'): pieces.append((cur, 'beat')); cur = ''
            elif t == '[p]': pieces.append((cur, 'extra')); cur = ''
            elif t in (',', '،', '—'): pieces.append((cur + ',', 'comma')); cur = ''
            elif t in ('।', '.'): pieces.append((cur + '।', 'sentence')); cur = ''
            elif t in ('?', '!'): pieces.append((cur + t, 'question')); cur = ''
            else: cur += t
        if cur.strip(): pieces.append((cur, 'shot_end'))
        # long phrases get a breath before a conjunction
        final = []
        for ph, kind in pieces:
            w = ph.split()
            if not w:
                if final: final[-1] = (final[-1][0], kind if PAUSE[kind] > PAUSE[final[-1][1]] else final[-1][1])
                continue
            while len(w) > MAX_WORDS:
                cut = next((i for i in range(len(w) - 2, 2, -1) if w[i] in BREATH_BEFORE and i <= MAX_WORDS), min(MAX_WORDS, len(w) // 2))
                final.append((' '.join(w[:cut]), 'breath')); w = w[cut:]
            final.append((' '.join(w), kind))
        in_dialogue = False
        for pi, (ph, kind) in enumerate(final):
            prev_words = final[pi - 1][0].strip(' ,।.?!').split() if pi > 0 else []
            if prev_words and prev_words[-1] in SPEECH_VERBS: in_dialogue = True
            b = 'dialogue' if in_dialogue else beat
            last_of_shot = pi == len(final) - 1
            k = kind
            nxt = shots[si + 1] if si + 1 < len(shots) else None
            if last_of_shot and nxt and nxt.get('beat') == 'moral' and beat != 'moral': k = 'pre_moral'
            if last_of_shot and si == 0: k = 'question' if kind != 'beat' else 'beat'   # hook gets air
            if last_of_shot and si == len(shots) - 1: k = 'final'
            if k == 'shot_end': k = 'sentence'
            if k == 'question' and pi + 1 < len(final) and len(final[pi + 1][0].split()) <= 3: k = 'rhetorical'  # Q -> short answer
            plan.append({'shot': s['id'], 'text': ph.strip(), 'beat': b, 'pause_after': round(PAUSE[k] * sc, 3), 'kind': k})
    return plan


# ------------------------------------------------------------------ 2. synthesis providers
def voice_id(persona):
    p = PROFILES[persona]; vid = os.environ.get(p['elevenlabs_voice_id_env']) or os.environ.get('ELEVENLABS_VOICE_ID')
    if vid: return vid
    q = urllib.parse.quote(p['elevenlabs_name'].split(' - ')[0].split(' (')[0])
    req = urllib.request.Request(f'https://api.elevenlabs.io/v2/voices?search={q}', headers={'xi-api-key': os.environ['ELEVENLABS_API_KEY']})
    vs = json.load(urllib.request.urlopen(req, timeout=60)).get('voices', [])
    if not vs: sys.exit(f"ElevenLabs voice '{p['elevenlabs_name']}' not in your account: add it from the Voice Library or set {p['elevenlabs_voice_id_env']}")
    return vs[0]['voice_id']


def synth_elevenlabs(item, prev_t, next_t, persona, out, cache={}):
    if persona not in cache: cache[persona] = voice_id(persona)
    st = dict(PROFILES[persona]['settings']); bs = BEAT_STYLE[item['beat']]
    st.update(stability=bs['stability'], style=bs['style'], speed=round(st.get('speed', 1) * bs['speed'], 2))
    text = re.sub(r'\*(.+?)\*', r'\1', item['text'])
    body = {'text': text, 'model_id': os.environ.get('ELEVENLABS_MODEL', 'eleven_multilingual_v2'), 'voice_settings': st,
            'previous_text': prev_t, 'next_text': next_t, 'language_code': 'hi'}
    req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{cache[persona]}?output_format=mp3_44100_192',
                                 data=json.dumps(body).encode(), headers={'xi-api-key': os.environ['ELEVENLABS_API_KEY'], 'Content-Type': 'application/json'})
    open(out, 'wb').write(urllib.request.urlopen(req, timeout=180).read())


def synth_openai(item, prev_t, next_t, persona, out):
    bs = BEAT_STYLE[item['beat']]
    ins = (f"Hindi storyteller. {PROFILES[persona]['character']}. This line is the '{item['beat']}' part of the story. "
           f"Natural Hindi pronunciation, {'slower and weighty' if bs['speed'] < 1 else 'steady and engaging'}.")
    body = {'model': 'gpt-4o-mini-tts', 'voice': PROFILES[persona]['openai']['voice'], 'input': item['text'].replace('*', ''), 'instructions': ins, 'response_format': 'wav'}
    req = urllib.request.Request('https://api.openai.com/v1/audio/speech', data=json.dumps(body).encode(),
                                 headers={'Authorization': 'Bearer ' + os.environ['OPENAI_API_KEY'], 'Content-Type': 'application/json'})
    open(out, 'wb').write(urllib.request.urlopen(req, timeout=180).read())


def synth_edge(item, prev_t, next_t, persona, out):
    import edge_tts
    e = PROFILES[persona]['edge']; bs = BEAT_STYLE[item['beat']]
    rate = int(e['rate'].rstrip('%')) + bs['rate']; pitch = int(e['pitch'].rstrip('Hz')) + bs['pitch']
    async def run():
        await edge_tts.Communicate(item['text'].replace('*', ''), e['voice'], rate=f'{rate:+d}%', pitch=f'{pitch:+d}Hz').save(out)
    asyncio.run(run())


SYNTH = {'elevenlabs': synth_elevenlabs, 'openai': synth_openai, 'edge': synth_edge}

# Open-source provider: AI4Bharat Indic Parler-TTS. Style is set by a description per beat.
PARLER_BEAT = {
    'hook': 'in a slow, suspenseful and slightly dramatic way',
    'setup': 'in a clear, engaging storytelling way at a moderate pace',
    'spark': 'with a hint of wonder, at a moderate pace',
    'pressure': 'in an expressive and intense way at a moderate pace',
    'dialogue': 'in a very expressive and animated way, like acting out a character',
    'turn': 'in a slow, intense and dramatic way',
    'moral': 'slowly, calmly and with deep conviction',
    'cta': 'in a warm, friendly and confident way at a moderate pace',
}


def parler_description(persona, beat):
    p = PROFILES[persona]['parler']
    return (f"{p['speaker']} speaks with {p['timbre']} {PARLER_BEAT.get(beat, PARLER_BEAT['setup'])}. "
            'The recording is of very high quality, with the speaker very close to the microphone, no background noise and no reverberation.')


def synth_kokoro_batch(plan, persona, tmp):
    """Kokoro-82M (Apache-2.0): voice picked by measured pitch, expression via per-beat speed."""
    py = os.environ.get('ML_PYTHON') or next((p for p in (os.path.expanduser('~/ml/bin/python'), '/home/user/ml/bin/python') if os.path.exists(p)), '')
    if not py: sys.exit('ML virtualenv missing: see tools/story_reel/kokoro_worker.py header')
    k = PROFILES[persona]['kokoro']; outs = [os.path.join(tmp, f'{i:03d}.wav') for i in range(len(plan))]
    jobs = [{'text': p['text'].replace('*', ''), 'voice': k['voice'], 'out': o,
             'speed': round(k['speed'] * BEAT_STYLE[p['beat']]['speed'], 3)} for p, o in zip(plan, outs)]
    jf = os.path.join(tmp, 'jobs.json'); json.dump(jobs, open(jf, 'w'), ensure_ascii=False)
    subprocess.run([py, os.path.join(HERE, 'kokoro_worker.py'), jf], check=True)
    return outs


def synth_parler_batch(plan, persona, tmp):
    py = os.environ.get('PARLER_PYTHON') or next((p for p in (os.path.expanduser('~/tts/bin/python'), '/home/user/tts/bin/python') if os.path.exists(p)), '')
    if not os.path.exists(py): sys.exit('parler virtualenv missing: see tools/story_reel/parler_worker.py header')
    outs = [os.path.join(tmp, f'{i:03d}.wav') for i in range(len(plan))]
    for attempt in range(3):
        jobs = [{'text': p['text'].replace('*', ''), 'description': parler_description(persona, p['beat']), 'out': o, 'seed': 42 + attempt * 101 + i}
                for i, (p, o) in enumerate(zip(plan, outs))]
        jf = os.path.join(tmp, 'jobs.json'); json.dump(jobs, open(jf, 'w'), ensure_ascii=False)
        subprocess.run([py, os.path.join(HERE, 'parler_worker.py'), jf], check=True)
        bad = []
        for i, (p, o) in enumerate(zip(plan, outs)):   # sanity: speaking rate and no runaway generation
            x = trim(load(o)); cps = len(p['text'].replace(' ', '')) / max(.1, len(x) / SR)
            if not (6 <= cps <= 22): bad.append(i); os.remove(o)
        if not bad: break
        print(f'regenerating {len(bad)} phrases with odd timing: {bad}')
    return outs


# ------------------------------------------------------------------ 3. assembly
def load(path):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def trim(x, db=-42, keep=0.03):
    """Cut leading/trailing silence, keep a few ms so consonants are not clipped."""
    if not len(x): return x
    env = np.sqrt(np.convolve(x ** 2, np.ones(441) / 441, 'same')); thr = 10 ** (db / 20) * max(1e-4, np.max(np.abs(x)))
    idx = np.where(env > thr)[0]
    if not len(idx): return x
    a = max(0, idx[0] - int(keep * SR)); b = min(len(x), idx[-1] + int(keep * 2 * SR))
    return x[a:b]


def room_tone(n, level=0.0009):
    if n <= 0: return np.zeros(0, np.float32)
    rng = np.random.default_rng(n)
    t = rng.normal(0, 1, n).astype(np.float32); t = np.convolve(t, np.ones(30) / 30, 'same')
    return t / (np.std(t) + 1e-9) * level


def join(pieces, pauses):
    out = []; xf = int(0.01 * SR)
    for x, p in zip(pieces, pauses):
        x = x.copy()
        if len(x) > 2 * xf: x[:xf] *= np.linspace(0, 1, xf); x[-xf:] *= np.linspace(1, 0, xf)
        out += [x, room_tone(int(p * SR))]
    return np.concatenate(out)


def master(x, out_mp3):
    tmp = out_mp3 + '.wav'
    write_wav(tmp, x)
    # broadcast voice chain: rumble cut, low-mid clean, presence, gentle compression, loudness
    af = ('highpass=f=70,equalizer=f=250:t=q:w=1.2:g=-2,equalizer=f=3200:t=q:w=1.0:g=2.5,'
          'acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=2,alimiter=limit=0.95,loudnorm=I=-16:TP=-1.5:LRA=9')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-af', af, '-ar', str(SR), '-b:a', '192k', out_mp3], check=True)
    os.remove(tmp)


def write_wav(path, x):
    import wave
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


# ------------------------------------------------------------------ 4. QC vs reference
def pause_stats(x, sr=SR):
    hop = sr // 100; fr = np.lib.stride_tricks.sliding_window_view(x, hop * 2)[::hop]
    db = 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-6); thr = np.percentile(db, 95) - 30; sil = db < thr
    runs, i, n = [], 0, len(sil)
    while i < n:
        if sil[i]:
            j = i
            while j < n and sil[j]: j += 1
            if (j - i) * .01 >= .12 and i > 0 and j < n: runs.append((j - i) * .01)
            i = j
        else: i += 1
    dur = len(x) / sr; r = np.array(runs or [0])
    return {'dur': round(dur, 1), 'pauses_per_min': round(len(runs) / dur * 60, 1), 'pause_median_s': round(float(np.median(r)), 2),
            'pause_max_s': round(float(r.max()), 2), 'pause_share_pct': round(float(r.sum() / dur * 100), 1)}


def qc(path, persona, words):
    x = load(path); s = pause_stats(x); m = PROFILES[persona]['measured']
    s['words_per_min'] = round(words / s['dur'] * 60)
    def chk(v, lo, hi): return 'PASS' if lo * .9 <= v <= hi * 1.1 else 'WARN'
    rows = [('pauses/min', s['pauses_per_min'], m['pauses_per_min']), ('median pause s', s['pause_median_s'], m['pause_median_s']),
            ('pause share %', s['pause_share_pct'], m['pause_share_pct']), ('longest pause s', s['pause_max_s'], [0.3, m['pause_max_s'] + .1])]
    print(f"QC vs '{persona}' reference ({s['dur']}s, {s['words_per_min']} wpm):")
    for name, v, (lo, hi) in rows: print(f"  {chk(v, lo, hi)}  {name:16s} {v:>6}   target {lo}-{hi}")
    return s


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(); ap.add_argument('reel'); ap.add_argument('--provider'); ap.add_argument('--persona')
    ap.add_argument('--plan', action='store_true'); ap.add_argument('--qc', help='only run QC on an existing audio file')
    a = ap.parse_args(); d = os.path.abspath(a.reel); spec = json.load(open(os.path.join(d, 'shots.json')))
    persona = a.persona or spec.get('voice', {}).get('persona', 'aakash')
    words = sum(len(s['vo'].split()) for s in spec['shots'])
    if a.qc: qc(a.qc, persona, words); return
    plan = direct(spec, persona)
    if a.plan:
        for p in plan: print(f"{p['shot']} {p['beat']:9s} {p['text']}  ⏸ {p['pause_after']}s ({p['kind']})")
        return
    prov = a.provider or ('elevenlabs' if os.environ.get('ELEVENLABS_API_KEY') else 'openai' if os.environ.get('OPENAI_API_KEY') else 'kokoro')
    tmp = tempfile.mkdtemp(); pieces = []
    if prov in ('parler', 'kokoro'):
        pieces = [trim(load(o)) for o in (synth_parler_batch if prov == 'parler' else synth_kokoro_batch)(plan, persona, tmp)]
    for i, p in enumerate(plan if prov not in ('parler', 'kokoro') else []):
        f = os.path.join(tmp, f'{i:03d}.' + ('wav' if prov == 'openai' else 'mp3'))
        prev_t = ' '.join(q['text'] for q in plan[max(0, i - 2):i]); next_t = ' '.join(q['text'] for q in plan[i + 1:i + 3])
        for attempt in range(3):
            try: SYNTH[prov](p, prev_t, next_t, persona, f); break
            except Exception as e:
                if attempt == 2: raise
                print('retry', i, e)
        pieces.append(trim(load(f))); print(f'\rphrase {i + 1}/{len(plan)}', end='', flush=True)
    print()
    x = join(pieces, [p['pause_after'] for p in plan]); out = os.path.join(d, 'voice.mp3'); master(x, out)
    # exact phrase map (start/end in the final file) for caption + shot sync
    t = 0.0; vm = []
    for p, piece in zip(plan, pieces):
        dur = len(piece) / SR; vm.append(dict(p, start=round(t, 3), end=round(t + dur, 3))); t += dur + p['pause_after']
    json.dump({'provider': prov, 'persona': persona, 'phrases': vm}, open(os.path.join(d, 'voice_map.json'), 'w'), ensure_ascii=False, indent=1)
    print('wrote', out); qc(out, persona, words)


if __name__ == '__main__':
    main()
