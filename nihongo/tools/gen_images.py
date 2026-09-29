#!/usr/bin/env python3
"""Generate story illustrations with OpenRouter, then rebuild to embed them.

  OPENROUTER_API_KEY=... python3 nihongo/tools/gen_images.py && python3 nihongo/build.py

Writes nihongo/img/<story-id>.webp (960px wide, WebP q78) for each story's `img` prompt.
Needs Pillow. Skips images that already exist.
"""
import base64, io, json, os, pathlib, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
KEY = (os.environ.get('OPENROUTER_API_KEY') or os.environ.get('API_KEY') or '').strip()
MODEL = os.environ.get('IMAGE_MODEL', 'google/gemini-3.1-flash-image')


def gen(story):
    out = ROOT / 'img' / f"{story['id']}.webp"
    if out.exists():
        return
    body = {'model': MODEL, 'modalities': ['image', 'text'], 'image_config': {'aspect_ratio': '16:9'},
            'messages': [{'role': 'user', 'content': story['img']}]}
    req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=json.dumps(body).encode(),
                                 headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    msg = json.load(urllib.request.urlopen(req, timeout=240))['choices'][0]['message']
    raw = base64.b64decode(msg['images'][0]['image_url']['url'].split(',', 1)[1])
    im = Image.open(io.BytesIO(raw)).convert('RGB')
    if im.width > 960:
        im = im.resize((960, round(im.height * 960 / im.width)), Image.LANCZOS)
    im.save(out, 'WEBP', quality=78, method=6)
    print(out.name, out.stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    if not KEY:
        raise SystemExit('Set OPENROUTER_API_KEY')
    (ROOT / 'img').mkdir(exist_ok=True)
    stories = json.loads((ROOT / 'data' / 'stories.json').read_text(encoding='utf8'))
    with ThreadPoolExecutor(4) as ex:
        for f in [ex.submit(gen, s) for s in stories]:
            try:
                f.result()
            except Exception as e:
                print('failed:', e)
