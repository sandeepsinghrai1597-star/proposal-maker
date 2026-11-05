#!/usr/bin/env python3
"""Generate one still per shot in the reel's style, and always write prompts.md (manual mode).

Providers (pick with --provider, default = first one whose key is set):
  gemini       GEMINI_API_KEY   best for comic illustration + character consistency (reference images)
  openai       OPENAI_API_KEY   gpt-image-1, 1024x1536
  pollinations no key           DRAFT quality only (layout checks), never for posting
  manual       -                only writes prompts.md: paste each prompt into the Gemini / ChatGPT / Meta AI app,
                                save the result as images/<shot id>.png

Character consistency: put a reference picture at characters/<name>.png (generate the character sheet first with
--characters). Gemini receives it with every shot that lists that character in "chars".

Usage: python3 tools/story_reel/gen_images.py reels/<slug> [--provider gemini] [--only s03,s07] [--characters]
"""
import argparse, base64, json, os, sys, time, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from styles import STYLES, image_prompt, motion_prompt

GEMINI_MODEL = os.environ.get('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash-image')


def http_json(url, body, headers):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', **headers})
    with urllib.request.urlopen(req, timeout=180) as r: return json.load(r)


def gen_gemini(prompt, refs, out):
    parts = [{'text': prompt}]
    for p in refs:
        parts.append({'inline_data': {'mime_type': 'image/png', 'data': base64.b64encode(open(p, 'rb').read()).decode()}})
    if refs: parts[0]['text'] = 'Use the attached reference image(s) for the exact character design. ' + prompt
    body = {'contents': [{'parts': parts}], 'generationConfig': {'responseModalities': ['IMAGE'], 'imageConfig': {'aspectRatio': '9:16'}}}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent'
    r = http_json(url, body, {'x-goog-api-key': os.environ['GEMINI_API_KEY']})
    for c in r.get('candidates', []):
        for p in c.get('content', {}).get('parts', []):
            d = p.get('inline_data') or p.get('inlineData')
            if d: open(out, 'wb').write(base64.b64decode(d['data'])); return
    raise RuntimeError('no image in Gemini response: ' + json.dumps(r)[:300])


def gen_openai(prompt, refs, out):
    r = http_json('https://api.openai.com/v1/images/generations',
                  {'model': os.environ.get('OPENAI_IMAGE_MODEL', 'gpt-image-1'), 'prompt': prompt, 'size': '1024x1536', 'quality': 'high'},
                  {'Authorization': 'Bearer ' + os.environ['OPENAI_API_KEY']})
    open(out, 'wb').write(base64.b64decode(r['data'][0]['b64_json']))


def gen_pollinations(prompt, refs, out, seed=7):
    url = 'https://image.pollinations.ai/prompt/' + urllib.parse.quote(prompt[:1500]) + f'?width=720&height=1280&nologo=true&seed={seed}'
    with urllib.request.urlopen(url, timeout=180) as r: open(out, 'wb').write(r.read())


PROVIDERS = {'gemini': gen_gemini, 'openai': gen_openai, 'pollinations': gen_pollinations}


def write_prompts_md(d, spec):
    lines = [f"# Prompt pack: {spec.get('title', '')}", '',
             f"Style: **{STYLES[spec.get('style', 'A')]['name']}**. Generate each image in 9:16, save as `images/<id>.png`.",
             'Then (optional) animate each one in Meta AI / Grok Imagine / Kling with the motion prompt and save as `clips/<id>.mp4`.', '']
    if spec.get('characters'):
        lines += ['## Character sheets (make these first, reuse as reference images)', '']
        for k, c in spec['characters'].items():
            lines += [f"### {k}", '```', STYLES[spec.get('style', 'A')]['prefix'] + f"Character design sheet of {c['look']} Full body, front and three-quarter view, plain cream background." + ' No text.', '```', '']
    lines += ['## Shots', '']
    for s in spec['shots']:
        lines += [f"### {s['id']}: {s.get('beat', '')}  (camera: {s.get('camera', 'push_in')})", f"> VO: {s.get('vo', '')}", '',
                  '**Image prompt**', '```', image_prompt(spec, s), '```', '**Motion prompt**', '```', motion_prompt(s), '```', '']
    open(os.path.join(d, 'prompts.md'), 'w').write('\n'.join(lines))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('reel'); ap.add_argument('--provider')
    ap.add_argument('--only'); ap.add_argument('--force', action='store_true'); ap.add_argument('--characters', action='store_true')
    a = ap.parse_args(); d = os.path.abspath(a.reel); spec = json.load(open(os.path.join(d, 'shots.json')))
    write_prompts_md(d, spec); print('wrote', os.path.join(d, 'prompts.md'))
    prov = a.provider or ('gemini' if os.environ.get('GEMINI_API_KEY') else 'openai' if os.environ.get('OPENAI_API_KEY') else 'manual')
    if prov == 'manual':
        print('manual mode: paste prompts.md into Gemini / ChatGPT / Meta AI and save images/<id>.png'); return
    fn = PROVIDERS[prov]; os.makedirs(os.path.join(d, 'images'), exist_ok=True); os.makedirs(os.path.join(d, 'characters'), exist_ok=True)
    if a.characters:
        for k, c in spec.get('characters', {}).items():
            out = os.path.join(d, 'characters', f'{k}.png')
            if os.path.exists(out) and not a.force: continue
            fn(STYLES[spec.get('style', 'A')]['prefix'] + f"Character design sheet of {c['look']} Full body, plain cream background. No text.", [], out); print('character', k)
    only = set(a.only.split(',')) if a.only else None
    for i, s in enumerate(spec['shots']):
        if only and s['id'] not in only: continue
        out = os.path.join(d, 'images', f"{s['id']}.png")
        if os.path.exists(out) and not a.force: continue
        refs = [p for p in (os.path.join(d, 'characters', f'{k}.png') for k in s.get('chars', [])) if os.path.exists(p)] if prov == 'gemini' else []
        for attempt in range(3):
            try:
                if prov == 'pollinations': fn(image_prompt(spec, s), refs, out, seed=100 + i)
                else: fn(image_prompt(spec, s), refs, out)
                print('image', s['id']); break
            except Exception as e:
                print('retry', s['id'], e); time.sleep(4 * (attempt + 1))


if __name__ == '__main__':
    main()
