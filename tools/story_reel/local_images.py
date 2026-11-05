#!/usr/bin/env python3
"""Open-source, key-free image generation on CPU: SDXL base + ByteDance SDXL-Lightning (4-step UNet).

License: SDXL (CreativeML Open RAIL++-M) and SDXL-Lightning (openrail++), commercial use allowed
under the RAIL terms. Runs in ~3-6 min per 768x1344 image on a 4-core CPU (no GPU needed); a GPU
makes it ~100x faster automatically.

Run with the ML virtualenv:  ~/ml/bin/python tools/story_reel/local_images.py reels/<slug> [--only s01,s02] [--steps 4]
Prompts come from styles.py (same as gen_images.py). Seeds are fixed per shot so re-runs are stable;
character consistency comes from the identical character sheet text in every prompt.
"""
import argparse, json, os, sys, time
import torch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from styles import image_prompt

BASE = 'stabilityai/stable-diffusion-xl-base-1.0'
LIGHTNING = ('ByteDance/SDXL-Lightning', 'sdxl_lightning_4step_unet.safetensors')
NEG = ('photo, photorealistic, 3d render, text, letters, watermark, signature, logo, frame, border, blurry, '
       'deformed, extra limbs, extra heads, bad anatomy, cropped, lowres, jpeg artifacts')


def load():
    from diffusers import StableDiffusionXLPipeline, UNet2DConditionModel, EulerDiscreteScheduler
    from huggingface_hub import hf_hub_download
    from safetensors.torch import load_file
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    dt = torch.float16 if dev == 'cuda' else torch.bfloat16
    unet = UNet2DConditionModel.from_config(BASE, subfolder='unet').to(dt)
    unet.load_state_dict(load_file(hf_hub_download(*LIGHTNING), device='cpu'))
    pipe = StableDiffusionXLPipeline.from_pretrained(BASE, unet=unet, torch_dtype=dt, variant='fp16', use_safetensors=True)
    pipe.scheduler = EulerDiscreteScheduler.from_config(pipe.scheduler.config, timestep_spacing='trailing')
    pipe.vae.to(torch.float32); pipe.vae.config.force_upcast = True   # avoid bf16 VAE artefacts
    pipe.to(dev); pipe.set_progress_bar_config(disable=True)
    torch.set_num_threads(os.cpu_count() or 4)
    return pipe


def short(prompt, limit=70):
    """CLIP reads 77 tokens: keep the subject first, style words after (they are repeated per shot)."""
    return prompt


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('reel'); ap.add_argument('--only'); ap.add_argument('--force', action='store_true')
    ap.add_argument('--steps', type=int, default=4); ap.add_argument('--w', type=int, default=768); ap.add_argument('--h', type=int, default=1344)
    a = ap.parse_args(); d = os.path.abspath(a.reel); spec = json.load(open(os.path.join(d, 'shots.json')))
    os.makedirs(os.path.join(d, 'images'), exist_ok=True)
    only = set(a.only.split(',')) if a.only else None
    todo = [s for s in spec['shots'] if (not only or s['id'] in only) and (a.force or not os.path.exists(os.path.join(d, 'images', s['id'] + '.png')))]
    if not todo: print('nothing to do'); return
    t0 = time.time(); pipe = load(); print(f'model loaded in {time.time() - t0:.0f}s', flush=True)
    for i, s in enumerate(spec['shots']):
        if s not in todo: continue
        # SDXL has two text encoders: prompt (subject, CLIP-L) and prompt_2 (style, OpenCLIP-G)
        full = image_prompt(spec, s)
        chars = spec.get('characters', {})
        subject = ' '.join(f"{chars[k]['look']}." for k in s.get('chars', []) if k in chars) + ' ' + s['image_prompt']
        t = time.time()
        img = pipe(prompt=subject.strip(), prompt_2=full, negative_prompt=NEG, num_inference_steps=a.steps, guidance_scale=0,
                   width=a.w, height=a.h, generator=torch.Generator('cpu').manual_seed(1000 + i)).images[0]
        img.save(os.path.join(d, 'images', s['id'] + '.png'))
        print(f"image {s['id']} {time.time() - t:.0f}s", flush=True)


if __name__ == '__main__':
    main()
