#!/usr/bin/env python3
"""Animate every still into a clip (clips/<id>.mp4) with open-source models, so stills MOVE like
the reference (heads turn, flames rage, eyes blink), not only zoom.

Engines
  ltx       AI image-to-video: Lightricks LTX-Video 2B 0.9.6 distilled (8 steps), prompted with the
            shot's motion_prompt. T5-XXL (bf16) encodes all prompts first, then is freed, so it fits in
            ~15 GB RAM on CPU. ~512x896, upscaled + frame-interpolated to 1080x1920 @ 30 fps.
  parallax  2.5D: Depth-Anything-V2 depth map -> layered 3D camera move (foreground moves more than
            the background) + ambient life chosen from the prompt (embers/fire flicker, dust, rain,
            light shimmer, breathing). Fast (~20 s per shot), never morphs. Used as fallback.
  auto      ltx where the shot asks for character motion, parallax otherwise / on failure.

Usage (ML virtualenv):
  ~/ml/bin/python tools/story_reel/animate.py reels/<slug> [--engine auto|ltx|parallax] [--only s01,s03] [--force]
Per shot in shots.json you can set  "animate": "ltx" | "parallax" | "none".
"""
import argparse, gc, json, math, os, subprocess, sys, time
import numpy as np
import torch
from PIL import Image

W, H, FPS = 1080, 1920, 30
LTX_W, LTX_H = 512, 896
T5_REPO = 'city96/t5-v1_1-xxl-encoder-bf16'
LTX_CFG_REPO = 'Lightricks/LTX-Video-0.9.5'
LTX_FILE = ('Lightricks/LTX-Video', 'ltxv-2b-0.9.6-distilled-04-25.safetensors')
STYLE_HINT = {'A': 'vintage storybook ink illustration, hand-drawn, warm colors', 'B': 'retro comic book illustration, bold ink, halftone'}


def ffmpeg_write(frames, out, fps_in, dur, interpolate=True):
    """frames: list of HxWx3 uint8 (any size). Cover-fit to 1080x1920, conform to dur, smooth to 30 fps."""
    h, w = frames[0].shape[:2]
    vf = [f'scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos', f'crop={W}:{H}']
    if interpolate and fps_in < FPS: vf.insert(0, f"minterpolate=fps={FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1")
    p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', str(fps_in), '-i', '-',
                          '-vf', ','.join(vf), '-r', str(FPS), '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', out],
                         stdin=subprocess.PIPE)
    for f in frames: p.stdin.write(np.ascontiguousarray(f).tobytes())
    p.stdin.close(); p.wait()


# ------------------------------------------------------------------ parallax engine
class Parallax:
    def __init__(self):
        from transformers import pipeline
        self.depth = pipeline('depth-estimation', model='depth-anything/Depth-Anything-V2-Small-hf', device='cpu')

    def depth_map(self, img):
        d = np.array(self.depth(img)['depth'].resize(img.size, Image.BICUBIC)).astype(np.float32)
        d = (d - d.min()) / (d.max() - d.min() + 1e-6)          # 1 = near
        import cv2
        return cv2.GaussianBlur(d, (0, 0), 6)

    def render(self, img_path, shot, dur):
        import cv2
        img = Image.open(img_path).convert('RGB')
        s = max(W / img.width, H / img.height) * 1.12; img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
        src = np.array(img).astype(np.float32); d = self.depth_map(img)
        h, w = d.shape; yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        cam = shot.get('camera', 'push_in'); n = int(math.ceil(dur * FPS)) + 8
        txt = (shot.get('motion_prompt', '') + ' ' + shot.get('image_prompt', '')).lower()
        fx = {'fire': any(k in txt for k in ('fire', 'flame', 'ember', 'burn')), 'rain': 'rain' in txt,
              'dust': any(k in txt for k in ('dust', 'sand', 'desert', 'dusty')), 'light': any(k in txt for k in ('sunrise', 'sun', 'glow', 'light', 'lantern'))}
        rng = np.random.default_rng(abs(hash(shot['id'])) % 2**32)
        parts = rng.random((60, 4)).tolist()
        frames = []
        for f in range(n):
            k = f / max(1, n - 1); e = k * k * (3 - 2 * k)
            amp = 0.022 * w                                        # max parallax shift in px
            dx = {'pan_left': amp * (1 - 2 * e), 'pan_right': -amp * (1 - 2 * e)}.get(cam, amp * 0.25 * math.sin(e * math.pi))
            dy = {'tilt_up': amp * (1 - 2 * e), 'tilt_down': -amp * (1 - 2 * e)}.get(cam, 0)
            zoom = {'pull_out': 0.06 * (1 - e), 'push_in': 0.06 * e, 'push_eyes': 0.10 * e}.get(cam, 0.03 * e)
            near = d - 0.5
            # foreground moves/zooms more than the background -> 3D feel; tiny breathing on the subject
            breath = 0.004 * math.sin(2 * math.pi * f / (FPS * 2.6)) * (d > 0.55)
            sc = 1 + zoom * (0.5 + d) + breath
            mx = (xx - w / 2) / sc + w / 2 - dx * near * 2
            my = (yy - h * 0.45) / sc + h * 0.45 - dy * near * 2
            fr = cv2.remap(src, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
            t = f / FPS
            if fx['fire']:                                         # flicker warm light + rising embers
                fl = 1 + 0.06 * math.sin(t * 13) * math.sin(t * 7.3)
                fr[..., 0] *= fl; fr[..., 1] *= 1 + (fl - 1) * 0.6
                for px, py, sp, sz in parts:
                    y = (py * h - t * (120 + 160 * sp)) % h; x = px * w + 25 * math.sin(t * 2 + px * 9)
                    cv2.circle(fr, (int(x), int(y)), int(2 + sz * 4), (255, 170 + 60 * sp, 60), -1, cv2.LINE_AA)
            if fx['dust'] or not any(fx.values()):                 # slow floating motes give life
                for px, py, sp, sz in parts[:35]:
                    y = (py * h - t * 18 * sp) % h; x = (px * w + t * 12 * (sp - .5)) % w
                    a = 0.25 + 0.25 * math.sin(t * 1.5 + px * 20)
                    cv2.circle(fr, (int(x), int(y)), int(1 + sz * 2.5), tuple(float(c) for c in (255 * a + fr[int(y), int(x), 0] * (1 - a), 235 * a + fr[int(y), int(x), 1] * (1 - a), 200 * a + fr[int(y), int(x), 2] * (1 - a))), -1, cv2.LINE_AA)
            if fx['rain']:
                for px, py, sp, sz in parts:
                    y = (py * h + t * 1400 * (0.7 + sp)) % h; x = px * w
                    cv2.line(fr, (int(x), int(y)), (int(x - 6), int(y + 30)), (200, 210, 230), 1, cv2.LINE_AA)
            if fx['light']:
                fr *= 1 + 0.035 * math.sin(t * 1.7)
            frames.append(np.clip(fr, 0, 255).astype(np.uint8))
        # crop centre to 9:16 output size
        out = [f[(h - H) // 2:(h - H) // 2 + H, (w - W) // 2:(w - W) // 2 + W] for f in frames]
        return out


# ------------------------------------------------------------------ LTX engine
def encode_prompts(texts):
    """Phase 1: T5-XXL bf16 alone (9.5 GB), same tokenisation as the LTX pipeline (max 128 tokens)."""
    from transformers import T5EncoderModel, T5TokenizerFast
    tok = T5TokenizerFast.from_pretrained(LTX_CFG_REPO, subfolder='tokenizer')
    enc = T5EncoderModel.from_pretrained(T5_REPO, torch_dtype=torch.bfloat16).eval()
    out = []
    with torch.inference_mode():
        for t in texts:
            ids = tok(t, padding='max_length', max_length=128, truncation=True, add_special_tokens=True, return_tensors='pt')
            emb = enc(ids.input_ids, attention_mask=ids.attention_mask)[0]
            out.append((emb.to(torch.bfloat16), ids.attention_mask))
    del enc; gc.collect()
    return out


def load_ltx():
    from diffusers import LTXConditionPipeline, LTXVideoTransformer3DModel, AutoencoderKLLTXVideo
    from huggingface_hub import hf_hub_download
    f = hf_hub_download(*LTX_FILE)
    tr = LTXVideoTransformer3DModel.from_single_file(f, torch_dtype=torch.bfloat16)
    vae = AutoencoderKLLTXVideo.from_single_file(f, torch_dtype=torch.bfloat16)
    pipe = LTXConditionPipeline.from_pretrained(LTX_CFG_REPO, transformer=tr, vae=vae, text_encoder=None, tokenizer=None, torch_dtype=torch.bfloat16)
    pipe.set_progress_bar_config(disable=True); torch.set_num_threads(os.cpu_count() or 4)
    return pipe


def run_ltx(pipe, img_path, emb, frames, seed):
    from diffusers.pipelines.ltx.pipeline_ltx_condition import LTXVideoCondition
    img = Image.open(img_path).convert('RGB')
    s = max(LTX_W / img.width, LTX_H / img.height); img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    l, t = (img.width - LTX_W) // 2, (img.height - LTX_H) // 2; img = img.crop((l, t, l + LTX_W, t + LTX_H))
    pe, pm = emb
    vid = pipe(conditions=[LTXVideoCondition(image=img, frame_index=0)], prompt_embeds=pe, prompt_attention_mask=pm,
               width=LTX_W, height=LTX_H, num_frames=frames, num_inference_steps=8, guidance_scale=1.0,
               decode_timestep=0.05, decode_noise_scale=0.025, image_cond_noise_scale=0.0,
               generator=torch.Generator('cpu').manual_seed(seed), output_type='np').frames[0]
    return [(np.clip(f, 0, 1) * 255).astype(np.uint8) for f in vid]


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('reel'); ap.add_argument('--engine', default='auto')
    ap.add_argument('--only'); ap.add_argument('--force', action='store_true'); ap.add_argument('--frames', type=int, default=0, help='0 = from shot length (49-97 frames)')
    a = ap.parse_args(); d = os.path.abspath(a.reel); spec = json.load(open(os.path.join(d, 'shots.json')))
    tm = json.load(open(os.path.join(d, 'timing.json'))) if os.path.exists(os.path.join(d, 'timing.json')) else None
    durs = {s['id']: s['end'] - s['start'] for s in tm['shots']} if tm else {}
    os.makedirs(os.path.join(d, 'clips'), exist_ok=True)
    only = set(a.only.split(',')) if a.only else None
    shots = [s for s in spec['shots'] if (not only or s['id'] in only) and s.get('animate') != 'none'
             and (a.force or not os.path.exists(os.path.join(d, 'clips', s['id'] + '.mp4')))]

    def img_of(s):
        for e in ('.png', '.jpg', '.webp'):
            p = os.path.join(d, 'images', s['id'] + e)
            if os.path.exists(p): return p

    def engine_of(s):
        e = s.get('animate') or a.engine
        if e == 'auto': e = 'ltx'
        return e
    ltx_shots = [s for s in shots if engine_of(s) == 'ltx']
    failed = []
    if ltx_shots:
        st = STYLE_HINT.get(spec.get('style', 'A'), '')
        texts = [f"{s.get('motion_prompt', '')} {s.get('sdxl_prompt') or s.get('image_prompt', '')} {st}. Smooth natural motion, consistent character, no morphing." for s in ltx_shots]
        t0 = time.time(); embs = encode_prompts(texts); print(f'prompts encoded in {time.time() - t0:.0f}s', flush=True)
        t0 = time.time(); pipe = load_ltx(); print(f'LTX loaded in {time.time() - t0:.0f}s', flush=True)
        for i, s in enumerate(ltx_shots):
            t0 = time.time()
            try:
                n = a.frames or int(min(97, max(49, math.ceil(durs.get(s['id'], 3) * 24 * 0.8 / 8) * 8 + 1)))   # <=1.25x slow-mo
                fr = run_ltx(pipe, img_of(s), embs[i], n, s.get('seed', 7) + 101)
                ffmpeg_write(fr, os.path.join(d, 'clips', s['id'] + '.mp4'), 24, durs.get(s['id'], 3))
                print(f"ltx {s['id']} {len(fr)} frames in {time.time() - t0:.0f}s", flush=True)
            except Exception as ex:
                print(f"ltx {s['id']} failed: {ex}", flush=True); failed.append(s)
        del pipe; gc.collect()
    par = [s for s in shots if engine_of(s) == 'parallax'] + failed
    if par:
        P = Parallax()
        for s in par:
            t0 = time.time(); fr = P.render(img_of(s), s, durs.get(s['id'], 3.5) + 0.6)
            ffmpeg_write(fr, os.path.join(d, 'clips', s['id'] + '.mp4'), FPS, durs.get(s['id'], 3.5), interpolate=False)
            print(f"parallax {s['id']} in {time.time() - t0:.0f}s", flush=True)


if __name__ == '__main__':
    main()
