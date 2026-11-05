#!/usr/bin/env python3
"""Batch worker for open-source Hindi TTS: AI4Bharat Indic Parler-TTS (Apache-2.0), CPU or GPU.

Called by tts.py (provider "parler") with a jobs.json: [{"text", "description", "out", "seed"}].
Loads the model once and writes one WAV per phrase. The voice style (pitch, pace, expressivity,
recording quality) is controlled by the natural-language "description".

Needs its own virtualenv because parler-tts pins transformers==4.46.1:
  python3 -m venv ~/tts && ~/tts/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
  ~/tts/bin/pip install parler-tts soundfile
"""
import json, os, sys, time
import numpy as np
import soundfile as sf
import torch

MODEL = os.environ.get('PARLER_MODEL', 'ai4bharat/indic-parler-tts')


def main():
    jobs = json.load(open(sys.argv[1]))
    from parler_tts import ParlerTTSForConditionalGeneration
    from transformers import AutoTokenizer
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    torch.set_num_threads(os.cpu_count() or 4)
    t0 = time.time()
    model = ParlerTTSForConditionalGeneration.from_pretrained(MODEL).to(dev).eval()
    tok = AutoTokenizer.from_pretrained(MODEL)
    dtok = AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path)
    sr = model.config.sampling_rate
    print(f'parler loaded in {time.time() - t0:.0f}s, sr={sr}', flush=True)
    for i, j in enumerate(jobs):
        if os.path.exists(j['out']) and not j.get('force'): continue
        t = time.time(); torch.manual_seed(j.get('seed', 42))
        d = dtok(j['description'], return_tensors='pt').to(dev); p = tok(j['text'], return_tensors='pt').to(dev)
        with torch.inference_mode():
            g = model.generate(input_ids=d.input_ids, attention_mask=d.attention_mask, prompt_input_ids=p.input_ids,
                               prompt_attention_mask=p.attention_mask, do_sample=True, temperature=j.get('temperature', 0.9))
        audio = g.cpu().float().numpy().squeeze()
        sf.write(j['out'], audio.astype(np.float32), sr)
        print(f"phrase {i + 1}/{len(jobs)} {len(audio) / sr:.1f}s audio in {time.time() - t:.0f}s", flush=True)


if __name__ == '__main__':
    main()
