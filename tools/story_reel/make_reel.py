#!/usr/bin/env python3
"""One command: images -> voice -> sync -> music -> render for reels/<slug> (shots.json must exist).
Each step is skipped if its output exists (use --redo voice,images,...). Missing keys fall back to free tools.
Usage: python3 tools/story_reel/make_reel.py reels/<slug> [--persona ayaan] [--image-provider gemini] [--redo voice]
"""
import argparse, json, os, subprocess, sys
H = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(H))


def run(*cmd):
    print('$', ' '.join(cmd)); return subprocess.run([sys.executable, *cmd]).returncode == 0


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('reel'); ap.add_argument('--persona'); ap.add_argument('--image-provider')
    ap.add_argument('--voice-provider'); ap.add_argument('--redo', default=''); ap.add_argument('--preview', action='store_true'); ap.add_argument('--no-animate', action='store_true')
    a = ap.parse_args(); d = os.path.abspath(a.reel); redo = set(a.redo.split(','))
    spec = json.load(open(os.path.join(d, 'shots.json')))
    have = lambda f: os.path.exists(os.path.join(d, f))
    imgs_ok = all(any(have(f'images/{s["id"]}{e}') for e in ('.png', '.jpg', '.webp')) for s in spec['shots'])
    if not imgs_ok or 'images' in redo:
        prov = a.image_provider or ('gemini' if os.environ.get('GEMINI_API_KEY') else 'openai' if os.environ.get('OPENAI_API_KEY') else 'local')
        if prov == 'local':   # open-source SDXL-Lightning on this machine, no key needed
            run(os.path.join(H, 'gen_images.py'), d, '--provider', 'manual')   # still writes prompts.md
            ml = os.environ.get('ML_PYTHON') or next((p for p in (os.path.expanduser('~/ml/bin/python'), '/home/user/ml/bin/python') if os.path.exists(p)), sys.executable)
            print('$ local SDXL-Lightning'); subprocess.run([ml, os.path.join(H, 'local_images.py'), d])
        else:
            run(os.path.join(H, 'gen_images.py'), d, '--provider', prov, '--characters')
    if not have('voice.mp3') or 'voice' in redo:
        ok = run(os.path.join(H, 'tts.py'), d, *(['--persona', a.persona] if a.persona else []), *(['--provider', a.voice_provider] if a.voice_provider else []))
        if not ok: print('!! voice failed: rendering a silent preview with estimated timing')
    if have('voice.mp3'): run(os.path.join(H, 'align.py'), d)
    tm = json.load(open(os.path.join(d, 'timing.json'))) if have('timing.json') else None
    if not a.no_animate and (not all(have(f'clips/{s["id"]}.mp4') for s in spec['shots']) or 'animate' in redo):
        ml = os.environ.get('ML_PYTHON') or next((p for p in (os.path.expanduser('~/ml/bin/python'), '/home/user/ml/bin/python') if os.path.exists(p)), sys.executable)
        print('$ animate (LTX-Video image-to-video, parallax fallback)'); subprocess.run([ml, os.path.join(H, 'animate.py'), d])
    if not have('music.wav') or 'music' in redo:
        total = tm['total'] if tm else sum(max(2.2, len(s.get('cap', '').split()) / 3.1) for s in spec['shots'])
        turn = next((x['start'] for x, s in zip(tm['shots'], spec['shots']) if s.get('beat') == 'turn'), total * .6) if tm else total * .6
        run(os.path.join(ROOT, 'tools', 'make_music.py'), '--seconds', f'{total + .5:.1f}', '--lift', f'{turn:.1f}', '--out', os.path.join(d, 'music.wav'))
    run(os.path.join(H, 'assemble.py'), d, *(['--preview'] if a.preview else []))


if __name__ == '__main__':
    main()
