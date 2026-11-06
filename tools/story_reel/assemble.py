#!/usr/bin/env python3
"""Assemble a story reel (Ranger-Alex format) from a reel folder.

reel/<slug>/
  shots.json      spec (see skills/story-reel-visuals/SKILL.md)
  images/<id>.png one still per shot (from gen_images.py or pasted from Gemini/ChatGPT)
  clips/<id>.mp4  OPTIONAL image-to-video clip per shot (Meta AI / Grok / Kling). Used instead of the still.
  timing.json     from align.py (shot start/end + caption word times). Missing -> estimated.
  voice.mp3       OPTIONAL narration;  music.wav OPTIONAL bed

Output: final.mp4 (1080x1920, 30 fps, H.264, AAC, -14 LUFS)

Look (measured from the reference, see analysis/ranger_alex_analysis.md):
  * every still slowly moves (push/pull/pan), cross-dissolves 0.45 s between shots
  * top title badge: dark translucent pill, condensed caps, keyword red (or yellow), emoji at the end
  * one caption word at a time, yellow, at 75% height, Romanised Hinglish
  * last shot can be a "card": picture framed on cream paper (CTA narrator)
"""
import argparse, json, math, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

W, H, FPS = 1080, 1920, 30
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FONTS = os.path.join(ROOT, 'assets', 'fonts')
EMOJI_FONT = '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf'
DISSOLVE = 0.45


def ease(k):
    k = min(1.0, max(0.0, k)); return k * k * (3 - 2 * k)


def hex2rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------- grading
def grade(img, style):
    """Push stills toward the measured reference grade. A = warm storybook, B = punchy comic."""
    img = img.convert('RGB')
    a = np.asarray(img).astype(np.float32)
    if style == 'A':      # warmth R-B ~ +70, sat ~0.46, slightly lifted blacks
        a[..., 0] *= 1.04; a[..., 2] *= 0.90
        a = a * 0.94 + 10
    elif style == 'B':    # sat ~0.52, contrast, warmth ~ +35
        a[..., 0] *= 1.02; a[..., 2] *= 0.96
        a = (a - 128) * 1.08 + 128
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    if style == 'B':
        img = ImageEnhance.Color(img).enhance(1.12)
    return img


def paper_texture(seed=3):
    rng = np.random.default_rng(seed)
    base = np.array(hex2rgb('#EEE7DA'), np.float32)
    n = rng.normal(0, 1, (H // 4, W // 4)).astype(np.float32)
    n = np.array(Image.fromarray(((n + 3) * 40).clip(0, 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)).astype(np.float32)
    fine = rng.normal(0, 5, (H, W)).astype(np.float32)
    a = base[None, None, :] + ((n - 120) * 0.06 + fine)[..., None]
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


# ---------------------------------------------------------------- shot sources
class Still:
    """Animated still: cover-fit with headroom, camera move rendered with sub-pixel affine."""
    MOVES = {
        'push_in': ((1.00, .5, .5), (1.12, .5, .45)),
        'pull_out': ((1.13, .5, .45), (1.00, .5, .5)),
        'pan_left': ((1.12, .62, .5), (1.12, .38, .5)),
        'pan_right': ((1.12, .38, .5), (1.12, .62, .5)),
        'tilt_up': ((1.12, .5, .62), (1.12, .5, .38)),
        'tilt_down': ((1.12, .5, .38), (1.12, .5, .62)),
        'push_eyes': ((1.05, .5, .42), (1.22, .5, .38)),
        'still': ((1.03, .5, .5), (1.06, .5, .5)),
    }

    def __init__(self, path, style, move):
        img = grade(Image.open(path), style)
        s = max(W / img.width, H / img.height) * 1.0
        self.img = img.resize((max(W, round(img.width * s * 1.25)), max(H, round(img.height * s * 1.25))), Image.LANCZOS)
        self.base = max(W / self.img.width, H / self.img.height)  # src px per out px at zoom 1 is 1/base
        self.move = self.MOVES.get(move, self.MOVES['push_in'])

    def frame(self, k):
        (z0, x0, y0), (z1, x1, y1) = self.move
        e = ease(k); z = z0 + (z1 - z0) * e; cx = x0 + (x1 - x0) * e; cy = y0 + (y1 - y0) * e
        sc = 1 / (self.base * z)                       # source px per output px
        vw, vh = W * sc, H * sc
        left = (self.img.width - vw) * cx; top = (self.img.height - vh) * cy
        return self.img.transform((W, H), Image.AFFINE, (sc, 0, left, 0, sc, top), resample=Image.BICUBIC)


class Clip:
    """Image-to-video clip: conformed to the shot length (slowed down / held) by ffmpeg once."""

    def __init__(self, path, dur, style, tmp):
        self.style = style; out = tmp
        probe = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                                     capture_output=True, text=True).stdout.strip() or 0)
        speed = min(1.0, max(0.5, probe / max(dur, .1)))   # slow at most to 0.5x, then hold last frame
        vf = (f"setpts=PTS/{speed:.4f},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
              f"fps={FPS},tpad=stop_mode=clone:stop_duration={dur + 1:.2f}")
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-vf', vf, '-t', f'{dur + DISSOLVE + .1:.2f}',
                        '-an', '-f', 'rawvideo', '-pix_fmt', 'rgb24', out], check=True)
        self.raw = np.memmap(out, dtype=np.uint8, mode='r').reshape(-1, H, W, 3)
        self.dur = dur

    def frame(self, k):  # k may exceed 1 slightly during the dissolve
        i = min(len(self.raw) - 1, max(0, int(k * self.dur * FPS)))
        return grade(Image.fromarray(np.array(self.raw[i])), self.style)


def card_frame(inner, paper):
    """CTA card: picture framed on cream paper, like the reference ending."""
    out = paper.copy(); m = 70
    iw = W - 2 * m; ih = int(iw * 1.02)
    pic = inner.resize((iw, int(inner.height * iw / inner.width)), Image.BICUBIC).crop((0, 0, iw, ih)) if inner.height * iw / inner.width >= ih else inner.resize((iw, ih))
    y = int(H * .5 - ih / 2)
    shadow = Image.new('RGBA', (iw + 40, ih + 40), (0, 0, 0, 0)); ImageDraw.Draw(shadow).rectangle((20, 20, iw + 20, ih + 20), fill=(0, 0, 0, 90))
    out.paste(shadow.filter(ImageFilter.GaussianBlur(14)), (m - 14, y - 6), shadow.filter(ImageFilter.GaussianBlur(14)))
    out.paste(pic, (m, y)); ImageDraw.Draw(out).rectangle((m - 3, y - 3, m + iw + 3, y + ih + 3), outline=(40, 30, 25), width=4)
    return out


# ---------------------------------------------------------------- overlays
def emoji_img(ch, h):
    try:
        f = ImageFont.truetype(EMOJI_FONT, 109)
        im = Image.new('RGBA', (160, 160), (0, 0, 0, 0)); ImageDraw.Draw(im).text((10, 10), ch, font=f, embedded_color=True)
        im = im.crop(im.getbbox()); return im.resize((int(im.width * h / im.height), h), Image.LANCZOS)
    except Exception:
        return None


def make_badge(b):
    """Dark translucent pill, condensed caps. parts: [[text, color], ...] + emoji."""
    if not b: return None
    parts = b.get('parts') or [[b.get('keyword', ''), b.get('keyword_color', '#E8262B')], [b.get('rest', ''), '#FFFFFF']]
    size = b.get('size', 96); font = ImageFont.truetype(os.path.join(FONTS, 'Oswald-700.ttf'), size)
    gap = int(size * .28); words = [(t.upper() if b.get('caps', True) else t, c) for t, c in parts if t]
    widths = [font.getlength(t) for t, _ in words]
    emo = emoji_img(b['emoji'], int(size * .9)) if b.get('emoji') else None
    tw = sum(widths) + gap * (len(words) - 1) + ((emo.width + gap) if emo else 0)
    while tw > W - 150 and size > 50:  # shrink long titles
        b = dict(b, size=size - 6); return make_badge(b)
    pw, ph = int(tw + size * .9), int(size * 1.55)
    im = Image.new('RGBA', (W, ph + 60), (0, 0, 0, 0)); x0 = (W - pw) // 2
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle((x0, 30, x0 + pw, 30 + ph), ph // 3, fill=(0, 0, 0, 110))
    im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(18)))
    d = ImageDraw.Draw(im); d.rounded_rectangle((x0, 30, x0 + pw, 30 + ph), ph // 3, fill=(28, 28, 32, 170))
    x = x0 + size * .45; y = 30 + ph / 2
    for (t, c), w in zip(words, widths):
        d.text((x + 3, y + 4), t, font=font, fill=(0, 0, 0, 200), anchor='lm')
        d.text((x, y), t, font=font, fill=hex2rgb(c), anchor='lm'); x += w + gap
    if emo: im.alpha_composite(emo, (int(x), int(y - emo.height / 2)))
    return im


class Captions:
    def __init__(self, words, cfg):
        self.words = words; self.cfg = cfg
        self.font = ImageFont.truetype(os.path.join(FONTS, 'Poppins-700.ttf'), cfg.get('size', 64))
        self.cache = {}

    def render(self, w):
        if w not in self.cache:
            f = self.font; bb = f.getbbox(w); pad = 30
            im = Image.new('RGBA', (bb[2] - bb[0] + pad * 2, bb[3] - bb[1] + pad * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
            sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).text((pad - bb[0] + 2, pad - bb[1] + 4), w, font=f, fill=(0, 0, 0, 230))
            im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(4))); d = ImageDraw.Draw(im)
            d.text((pad - bb[0], pad - bb[1]), w, font=f, fill=hex2rgb(self.cfg.get('color', '#F5E03A')), stroke_width=3, stroke_fill=(20, 15, 10))
            self.cache[w] = im
        return self.cache[w]

    def draw(self, frame, t):
        cur = None
        for wd in self.words:
            if wd['start'] <= t < wd['end'] + .08: cur = wd
            if wd['start'] > t: break
        if not cur: return
        im = self.render(cur['w']); k = min(1, (t - cur['start']) / .08); s = 1.12 - .12 * k
        if s != 1: im = im.resize((int(im.width * s), int(im.height * s)), Image.BICUBIC)
        y = int(H * self.cfg.get('y', .75))
        frame.alpha_composite(im, (W // 2 - im.width // 2, y - im.height // 2))


# ---------------------------------------------------------------- timing
def load_timing(d, spec):
    p = os.path.join(d, 'timing.json')
    if os.path.exists(p): return json.load(open(p))
    # estimate from word counts (~3.1 words/s, the reference speed) - preview without voice
    t = 0; shots = []; words = []
    for s in spec['shots']:
        n = max(1, len(s.get('cap', s.get('vo', '')).split())); dur = s.get('duration') or max(2.2, n / 3.1)
        shots.append({'id': s['id'], 'start': t, 'end': t + dur})
        cw = s.get('cap', '').split()
        for i, w in enumerate(cw): words.append({'w': w, 'start': t + dur * i / len(cw), 'end': t + dur * (i + 1) / len(cw)})
        t += dur
    return {'shots': shots, 'words': words, 'total': t}


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(); ap.add_argument('reel'); ap.add_argument('--out', default='final.mp4')
    ap.add_argument('--preview', action='store_true', help='540x960 @15fps quick check')
    ap.add_argument('--stills', help='comma separated seconds: write JPG frames instead of a video')
    a = ap.parse_args(); d = os.path.abspath(a.reel)
    spec = json.load(open(os.path.join(d, 'shots.json'))); tm = load_timing(d, spec)
    style = spec.get('style', 'A'); total = tm['total']
    tmpdir = os.path.join(d, '.tmp'); os.makedirs(tmpdir, exist_ok=True)
    paper = paper_texture(); badge = make_badge(spec.get('badge'))
    caps = Captions(tm['words'], spec.get('captions', {}))
    timing = {s['id']: s for s in tm['shots']}
    srcs = []
    for s in spec['shots']:
        st = timing[s['id']]; dur = st['end'] - st['start']
        clip = os.path.join(d, 'clips', f"{s['id']}.mp4"); img = os.path.join(d, 'images', f"{s['id']}.png")
        if not os.path.exists(img):
            for ext in ('.jpg', '.jpeg', '.webp'):
                if os.path.exists(img[:-4] + ext): img = img[:-4] + ext
        if os.path.exists(clip): src = Clip(clip, dur, style, os.path.join(tmpdir, s['id'] + '.raw'))
        elif os.path.exists(img): src = Still(img, style, s.get('camera', 'push_in'))
        else: sys.exit(f"missing image for shot {s['id']}: put images/{s['id']}.png (see prompts.md)")
        srcs.append((s, st['start'], st['end'], src))

    def shot_img(i, t):
        s, t0, t1, src = srcs[i]; k = (t - t0) / max(.01, (t1 - t0))
        fr = src.frame(k).convert('RGB')
        if s.get('card'): fr = card_frame(fr, paper)
        return fr

    def render(t):
        i = next((j for j, (_, t0, t1, _) in enumerate(srcs) if t < t1), len(srcs) - 1)
        fr = shot_img(i, t)
        # dissolve into the next shot (centred on the boundary)
        if i + 1 < len(srcs) and srcs[i + 1][0].get('transition', 'dissolve') == 'dissolve' and t > srcs[i][2] - DISSOLVE / 2:
            k = (t - (srcs[i][2] - DISSOLVE / 2)) / DISSOLVE; fr = Image.blend(fr, shot_img(i + 1, t), ease(k))
        if i > 0 and srcs[i][0].get('transition', 'dissolve') == 'dissolve' and t < srcs[i][1] + DISSOLVE / 2:
            k = (t - (srcs[i][1] - DISSOLVE / 2)) / DISSOLVE; fr = Image.blend(shot_img(i - 1, t), fr, ease(k))
        if srcs[i][0].get('transition') == 'flash' and t - srcs[i][1] < .25:
            fr = Image.blend(fr, Image.new('RGB', (W, H), (255, 250, 240)), .85 * (1 - (t - srcs[i][1]) / .25))
        fr = fr.convert('RGBA')
        if badge and not srcs[i][0].get('hide_badge'): fr.alpha_composite(badge, (0, int(H * spec.get('badge', {}).get('y', .055)) - 30))
        if not srcs[i][0].get('hide_captions'): caps.draw(fr, t)
        if t > total - .6 and spec.get('fade_out', True): fr = Image.blend(fr, Image.new('RGBA', (W, H), (0, 0, 0, 255)), (t - (total - .6)) / .6)
        return fr.convert('RGB')

    if a.stills:
        for s in a.stills.split(','):
            p = os.path.join(d, f'still_{float(s):05.1f}.jpg'); render(float(s)).save(p, quality=90); print('wrote', p)
        return
    fps = 15 if a.preview else FPS; size = '540x960' if a.preview else f'{W}x{H}'
    silent = os.path.join(tmpdir, 'video.mp4')
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(fps), '-i', '-',
                           '-vf', f'scale={size.replace("x", ":")}:flags=lanczos', '-c:v', 'libx264', '-preset', 'veryfast' if a.preview else 'medium',
                           '-crf', '24' if a.preview else '17', '-pix_fmt', 'yuv420p', silent], stdin=subprocess.PIPE)
    n = int(math.ceil(total * fps))
    for f in range(n):
        ff.stdin.write(render(f / fps).tobytes())
        if f % (fps * 5) == 0: print(f'\r{f / fps:5.1f}/{total:.1f}s', end='', flush=True)
    ff.stdin.close(); ff.wait(); print()
    # audio mix: voice on top, music ducked under it, loudness to IG level
    voice = os.path.join(d, 'voice.mp3'); music = os.path.join(d, 'music.wav'); out = os.path.join(d, a.out)
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-i', silent]
    hv, hm = os.path.exists(voice), os.path.exists(music)
    if hv: cmd += ['-i', voice]
    if hm: cmd += ['-stream_loop', '-1', '-i', music]
    if hv and hm:
        fc = '[2:a]volume=0.30[m];[1:a]asplit=2[v1][v2];[m][v1]sidechaincompress=threshold=0.05:ratio=6:attack=30:release=350[md];[md][v2]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5[a]'
    elif hv: fc = '[1:a]loudnorm=I=-14:TP=-1.5[a]'
    elif hm: fc = f'[1:a]afade=t=out:st={max(0, total - 1.5):.2f}:d=1.5,loudnorm=I=-16:TP=-1.5[a]'
    else: fc = None
    if fc: cmd += ['-filter_complex', fc, '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '192k']
    cmd += ['-c:v', 'copy', '-t', f'{total:.3f}', '-movflags', '+faststart', out]
    subprocess.run(cmd, check=True)
    for f in os.listdir(tmpdir): os.remove(os.path.join(tmpdir, f))
    print('wrote', out)


if __name__ == '__main__':
    main()
