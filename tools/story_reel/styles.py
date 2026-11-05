"""Style presets measured from the reference (analysis/ranger_alex_analysis.md section 3).

Every image prompt = STYLE[style].prefix + character sheet lines + shot prompt + STYLE.suffix
so that all shots of one reel look like one hand-drawn book.
"""

STYLES = {
    'A': {
        'name': 'Vintage Storybook Ink',
        'prefix': ('Vintage 1970s graphic-novel storybook illustration, detailed hand-inked linework with fine '
                   'cross-hatching, muted warm palette of burnt orange, rust, sepia, olive and cream, soft golden-hour '
                   'light, subtle aged paper grain, expressive anthropomorphic animal acting, cinematic composition. '),
        'suffix': (' Vertical 9:16 frame, main subject in the middle third, empty calm area at the bottom quarter, '
                   'no text, no letters, no watermark, no border.'),
        'music_mood': 'warm',
    },
    'B': {
        'name': 'Retro Pulp Comic',
        'prefix': ('Retro pulp comic-book illustration, bold black ink outlines, halftone shading, saturated vintage '
                   'print colours (deep blue, burnt orange, crimson, mustard), dramatic lighting and angles, speed '
                   'lines where there is motion, highly detailed expressive characters, cinematic comic panel. '),
        'suffix': (' Vertical 9:16 frame, main subject in the middle third, empty calm area at the bottom quarter, '
                   'no text, no letters, no speech bubbles, no watermark, no border.'),
        'music_mood': 'dramatic',
    },
}

# Image-to-video motion prompt template (Meta AI / Grok Imagine / Kling / Hailuo)
MOTION_SUFFIX = (' Keep the exact art style and character design of the image. Subtle natural motion only, slow '
                 'cinematic camera {camera}, no morphing, no new characters, no text.')
CAMERA_WORDS = {
    'push_in': 'push-in', 'pull_out': 'pull-out', 'pan_left': 'pan to the left', 'pan_right': 'pan to the right',
    'tilt_up': 'tilt up', 'tilt_down': 'tilt down', 'push_eyes': 'push-in towards the eyes', 'still': 'hold, almost static',
}


def image_prompt(spec, shot):
    st = STYLES[spec.get('style', 'A')]
    chars = spec.get('characters', {})
    sheet = ' '.join(f"{k}: {chars[k]['look']}." for k in shot.get('chars', []) if k in chars)
    return (st['prefix'] + (sheet + ' ' if sheet else '') + shot['image_prompt'].strip() + st['suffix']).strip()


def motion_prompt(shot):
    return shot.get('motion_prompt', 'Gentle breathing and blinking, light wind.').strip() + \
        MOTION_SUFFIX.format(camera=CAMERA_WORDS.get(shot.get('camera', 'push_in'), 'push-in'))
