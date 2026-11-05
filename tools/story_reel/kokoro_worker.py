#!/usr/bin/env python3
"""Batch worker for open-source TTS: Kokoro-82M (Apache-2.0, ungated, fast on CPU), Hindi male voices.

Persona match (measured pitch): hm_omega ~127 Hz = Aakash (127 Hz) · hm_psi ~142 Hz = Ayaan (143 Hz).
Called by tts.py (provider "kokoro") with jobs.json: [{"text", "voice", "speed", "out"}].

Install into the ML virtualenv (spaCy is only needed for English, so it is skipped):
  ~/ml/bin/pip install --no-deps kokoro misaki && ~/ml/bin/pip install loguru soundfile scipy phonemizer-fork espeakng-loader num2words
"""
import json, os, sys, time, types
sys.modules.setdefault('spacy', types.ModuleType('spacy'))   # misaki.en imports spacy at import time; Hindi never uses it
import numpy as np
import soundfile as sf
import espeakng_loader
from phonemizer.backend.espeak.wrapper import EspeakWrapper

EspeakWrapper.set_library(espeakng_loader.get_library_path())   # bundled espeak-ng, no system install needed
os.environ['ESPEAK_DATA_PATH'] = espeakng_loader.get_data_path()
try: EspeakWrapper.set_data_path(espeakng_loader.get_data_path())
except Exception: pass


def main():
    jobs = json.load(open(sys.argv[1]))
    from kokoro import KPipeline
    t0 = time.time(); pipe = KPipeline(lang_code='h'); print(f'kokoro loaded in {time.time() - t0:.0f}s', flush=True)
    for i, j in enumerate(jobs):
        if os.path.exists(j['out']) and not j.get('force'): continue
        t = time.time()
        audio = np.concatenate([r.audio.numpy() for r in pipe(j['text'], voice=j['voice'], speed=j.get('speed', 1.0))])
        sf.write(j['out'], audio.astype(np.float32), 24000)
        print(f"phrase {i + 1}/{len(jobs)} {len(audio) / 24000:.1f}s in {time.time() - t:.1f}s", flush=True)


if __name__ == '__main__':
    main()
