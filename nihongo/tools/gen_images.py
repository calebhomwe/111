#!/usr/bin/env python3
"""Generate Michi's illustration set with OpenRouter, then rebuild to embed them.

  OPENROUTER_API_KEY=... python3 nihongo/tools/gen_images.py
  python3 nihongo/tools/gen_images.py --key-file ~/.or_key [--only hero,sensei] [--force] [--list]

Writes nihongo/img/<key>.webp and nihongo/img/manifest.json. Skips images that already
exist (use --force with --only to redo some). Story art comes from each story's `img`
prompt in data/stories.json. Needs Pillow.
"""
import argparse, base64, io, json, os, pathlib, sys, threading, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMG = ROOT / 'img'
FLASH = os.environ.get('IMAGE_MODEL', 'google/gemini-3.1-flash-image')
PRO = os.environ.get('IMAGE_MODEL_HERO', 'google/gemini-3-pro-image')

STYLE = (
    'Style: hand-painted gouache and watercolour illustration on textured cold-press paper, visible soft '
    'brush strokes, subtle film grain, gentle diffused light, warm and calm Studio-Ghibli-inspired mood. '
    'Palette anchored in deep indigo blues (#274a8a family) with small vermilion hanko-red (#c1333f) accents '
    'and soft warm neutrals (cream, oatmeal, muted sage). Full-bleed composition painted edge to edge with no border, frame or white margin. Cohesive storybook look, no harsh outlines, '
    'no photorealism, no 3D render. '
    'IMPORTANT: absolutely no text of any kind: no letters, words, numbers, kana, kanji, logos, captions, '
    'watermarks, signatures or artist seals; every sign, shop banner, noren curtain, label, jar, menu, poster, '
    'notice board, chalkboard, hanging scroll, book page, letter and screen must be completely blank or plain '
    'colour (no pseudo-writing or squiggles that look like script).'
)

# key -> (aspect ratio, output width, subject, options)
SPECS = {
    'hero': ('21:9', 1600, 'A quiet Tokyo backstreet at dusk just after rain: wet stone paving reflecting glowing '
             'paper lanterns, a small red shrine torii gate at the end of the lane, the soft glow of a vending '
             'machine, a cat sitting on a low wall, cherry-blossom petals drifting, indigo evening sky.',
             {'model': PRO, 'size': '2K'}),
    'sensei': ('1:1', 512, 'Portrait of a warm, friendly Japanese woman in her mid-30s, the tutor character: '
               'shoulder-length dark hair loosely tied back, soft kind smile, cream knit cardigan over an indigo '
               'blouse, holding a closed book against her chest, head and shoulders, plain soft cream background '
               'with a faint watercolour wash.', {'model': PRO, 'trim': False}),
    'sensei-think': ('1:1', 512, 'The same woman as in the reference image (same face, hair, cream cardigan, indigo '
                     'blouse), now in a thoughtful pose: one finger resting on her chin, eyes looking up and to the '
                     'side as she thinks, open book held in her other hand, gentle smile, same plain soft cream '
                     'background.', {'model': PRO, 'ref': 'sensei', 'trim': False}),
    # Sensei role-play scenes
    'sc-free': ('4:3', 720, 'A cosy study corner: low wooden desk by a window, a steaming cup of green tea, notebooks '
                'and a pen, a small potted plant, warm lamp light, rain-soft afternoon outside.', {}),
    'sc-intro': ('4:3', 720, 'A bright language-school classroom: a few adult students of different backgrounds '
                 'standing and bowing and smiling as they meet each other for the first time, desks, a blank '
                 'whiteboard, morning sun through the windows, bare walls with no posters or stickers.', {}),
    'sc-cafe': ('4:3', 720, 'A small Tokyo café counter: a friendly barista behind a wooden counter pouring '
                'coffee, a customer ordering, hanging plants, pastries under a glass dome, blank chalkboard menu.', {}),
    'sc-konbini': ('4:3', 720, 'A Japanese convenience store register at night: a young clerk in a uniform '
                   'smiling at a customer, shelves of colourful snacks and onigiri, cool fluorescent light with the '
                   'dark indigo street visible through the glass doors.', {}),
    'sc-directions': ('4:3', 720, 'A busy Shibuya-style street corner at the scramble crossing, crowds with '
                      'umbrellas and bags, a local person kindly pointing the way for a traveller holding a paper map, '
                      'tall buildings with blank screens.', {}),
    'sc-hotel': ('4:3', 720, 'A calm hotel front desk in Japan: a receptionist bowing politely as a traveller with '
                 'a rolling suitcase checks in, a small bell, an ikebana flower arrangement, warm wood panelling, plain walls with no scrolls or signs.', {}),
    'sc-doctor': ('4:3', 720, 'A friendly neighbourhood clinic: a kind middle-aged doctor with a stethoscope '
                  'listening to a patient seated on a chair, a potted plant, soft daylight, clean and reassuring.', {}),
    'sc-weekend': ('4:3', 720, 'Two young friends sitting on a park bench under trees, chatting and laughing while '
                   'making weekend plans, one holding a phone with a blank screen, a pond and cherry trees behind.', {}),
    # Learn tracks
    'tr-kana': ('16:9', 960, 'Still life on a low wooden table: a bamboo calligraphy brush resting on a black ink stone, '
                'a small pool of ink, a sheet of plain untouched washi paper, a ceramic water dropper and a small '
                'vermilion dish, soft window light.', {}),
    'tr-vocab': ('16:9', 960, 'A lively Japanese market street full of everyday objects: stalls of fruit and '
                 'vegetables, fish, bowls, umbrellas, bicycles, lanterns and shoppers, cheerful and busy; plain solid-colour awnings and cloth banners, no price tags or shop signs.', {}),
    'tr-kanji': ('16:9', 960, 'Calligraphy brushes hanging on a rack in the foreground, stone lanterns in a garden, '
                 'layered misty blue mountains in the distance.', {}),
    'tr-grammar': ('16:9', 960, 'A wooden zig-zag bridge path crossing an iris pond through a Japanese garden, '
                   'stepping stones connecting to it, a sense of structure and connection.', {}),
    'tr-read': ('16:9', 960, 'A person curled up reading a book beside a large window on a rainy day, raindrops on '
                'the glass, a cup of tea, a sleeping cat, warm indoor light against the blue-grey rain.', {}),
    'tr-dojo': ('16:9', 960, 'A quiet tatami practice hall with sliding shoji doors, a low writing desk with brush, '
                'paper and ink stone at its centre, afternoon light slanting across the mats, bare plaster walls with no hanging scrolls or pictures.', {}),
    'placement': ('16:9', 960, 'A small traveller with a backpack standing at the foot of a mountain path, a long '
                  'line of vermilion torii gates climbing up the forested slope ahead, morning mist, sense of '
                  'beginning a journey and finding your level.', {}),
}

CATS = {
    'greet': 'two people bowing to each other in greeting at a garden gate in morning light',
    'num': 'a wooden abacus and a row of counting stones and small daruma dolls arranged in a line',
    'time': 'an old wooden wall clock without numerals, a blank paper calendar and an hourglass on a shelf, day turning to dusk',
    'people': 'a family of three generations walking together along a quiet street',
    'body': 'a person stretching in the morning sun on a veranda, gentle and healthy',
    'food': 'a still life of a Japanese meal: rice bowl, miso soup, grilled fish, pickles, chopsticks on a tray',
    'place': 'a tiny Japanese town seen from a hill: post office, shrine, station and houses',
    'transport': 'a small local train crossing a bridge, bicycles and a bus waiting at a crossing below',
    'nature': 'a mountain stream with maple trees, mossy rocks and a distant peak',
    'colour': 'a painter\'s palette with bright pigments beside folded coloured furoshiki cloths and paper',
    'school': 'a school desk with a satchel, notebook, pencils and an eraser, blank chalkboard behind',
    'work': 'a tidy office desk with a laptop showing a blank screen, coffee mug and a briefcase',
    'home': 'a cosy Japanese living room with a low kotatsu table, cushions and a sleeping cat',
    'clothes': 'a folded yukata, a scarf, a hat and shoes arranged neatly by an entrance',
    'animal': 'a shiba dog, a cat, a small bird and koi fish gathered in a garden',
    'verb': 'a lively street with people running, eating, reading, cycling and talking, full of action',
    'adj': 'contrasting pairs: a big and a small teapot, a hot steaming cup and a cold iced drink',
    'adv': 'a snail moving slowly and a swallow flying quickly over a rice field',
    'question': 'a curious child and a cat both tilting their heads at a mysterious wrapped box',
    'pron': 'a group of people pointing at themselves and at each other while smiling in a circle',
    'misc': 'a cabinet of curiosities: assorted small objects, a key, a lantern, a fan, a spinning top',
    'feeling': 'a person smiling while looking at the sunset from a rooftop, warm and emotional',
    'shopping': 'a shopping street with a paper bag of goods, a coin tray and a smiling shopkeeper, plain undecorated indigo noren curtains with no marks',
    'hobby': 'a guitar, a camera, a manga-style sketchbook with blank pages, a tennis racket and a houseplant',
    'health': 'a pharmacy counter with a friendly pharmacist, a thermometer and a cup of tea, plain unlabelled glass bottles and boxes',
}
for slug, subj in CATS.items():
    SPECS[f'cat-{slug}'] = ('4:3', 480, 'Small evocative scene: ' + subj + '.', {})

# extra per-key notes (e.g. to keep writing out of a story prompt that invites it)
NOTES = {
    's4': 'The classroom chalkboard is clean and empty and the notice board holds only blank paper.',
    's5': 'All station notice boards, timetables and signs are blank.',
    's6': 'The food stalls have plain solid-colour awnings only: no hanging paper signs, menus, flags or banners anywhere.',
    's7': 'Shop signs are blank plain boards.',
    's12': 'The miso tub, jars and packets are plain and unlabelled.',
    's13': 'No signs, seat numbers or display screens with writing.',
    's15': 'The police box signboard and the station signs are completely blank.',
    's17': 'The noren curtain, menu boards and wall tags are plain with no writing.',
    's18': 'The letter paper shows only faint wavy grey lines, no readable words or letters.',
    's10': 'The old childhood letter shows only a crayon cat drawing and wavy coloured crayon lines, no words or letters.',
}

TARGET_KB = {480: 45, 512: 60, 720: 110, 960: 110, 1600: 220}
lock = threading.Lock()
spent = [0.0]


def stories():
    try:
        return json.loads((ROOT / 'data' / 'stories.json').read_text(encoding='utf8'))
    except Exception as e:
        print('could not read stories.json:', e)
        return []


def all_specs():
    specs = dict(SPECS)
    for s in stories():
        if s.get('id') and s.get('img'):
            specs[s['id']] = ('16:9', 960, s['img'], {})
    return specs


def call(key, model, aspect, prompt, ref=None, size=None):
    content = [{'type': 'text', 'text': prompt}]
    if ref:
        content.insert(0, {'type': 'image_url', 'image_url': {'url': ref}})
    body = {'model': model, 'modalities': ['image', 'text'], 'messages': [{'role': 'user', 'content': content}],
            'image_config': {'aspect_ratio': aspect, **({'image_size': size} if size else {})}, 'usage': {'include': True}}
    req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=json.dumps(body).encode(),
                                 headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    resp = json.load(urllib.request.urlopen(req, timeout=300))
    cost = float((resp.get('usage') or {}).get('cost') or 0)
    with lock:
        spent[0] += cost
    msg = resp['choices'][0]['message']
    if not msg.get('images'):
        raise RuntimeError(f'{key}: no image returned ({(msg.get("content") or "")[:120]!r}), cost ${cost:.3f}')
    return base64.b64decode(msg['images'][0]['image_url']['url'].split(',', 1)[1]), cost


def trim_margin(im):
    """Remove a plain paper border the model sometimes paints, then restore the original aspect."""
    from PIL import ImageStat
    g, (w, h) = im.convert('L'), im.size

    def paper(box):
        st = ImageStat.Stat(g.crop(box))
        return st.mean[0] > 218 and st.stddev[0] < 14

    l, t, r, b = 0, 0, w, h
    while l < w * .12 and paper((l, 0, l + 1, h)): l += 1
    while r > w * .88 and paper((r - 1, 0, r, h)): r -= 1
    while t < h * .12 and paper((0, t, w, t + 1)): t += 1
    while b > h * .88 and paper((0, b - 1, w, b)): b -= 1
    if (l, t, r, b) == (0, 0, w, h):
        return im
    pad = 6  # eat the ragged painted edge too
    l, t, r, b = l + pad * (l > 0), t + pad * (t > 0), r - pad * (r < w), b - pad * (b < h)
    cw, ch = r - l, b - t
    if cw / ch > w / h:
        nw = round(ch * w / h); l += (cw - nw) // 2; r = l + nw
    else:
        nh = round(cw * h / w); t += (ch - nh) // 2; b = t + nh
    return im.crop((l, t, r, b))


def save(raw, out, width, trim=True):
    im = Image.open(io.BytesIO(raw)).convert('RGB')
    if trim:
        im = trim_margin(im)
    if im.width != width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    limit = TARGET_KB.get(width, 110) * 1024
    for q in (78, 74, 70, 66, 62, 58):
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=q, method=6)
        if buf.tell() <= limit:
            break
    out.write_bytes(buf.getvalue())
    return q


def gen(key, spec, force=False):
    aspect, width, subject, opt = spec
    out = IMG / f'{key}.webp'
    if out.exists() and not force:
        return
    ref = None
    if opt.get('ref'):
        src = IMG / f"{opt['ref']}.webp"
        if not src.exists():
            raise RuntimeError(f'{key}: reference {src.name} missing')
        ref = 'data:image/webp;base64,' + base64.b64encode(src.read_bytes()).decode()
    prompt = ('Wordless illustration with no writing anywhere. ' + subject.strip() + ' ' + NOTES.get(key, '')).strip() + '\n\n' + STYLE
    raw, cost = call(key, opt.get('model', FLASH), aspect, prompt, ref, opt.get('size'))
    q = save(raw, out, width, opt.get('trim', True))
    print(f'{key:16} {out.stat().st_size // 1024:4} KB  q{q}  ${cost:.3f}  {opt.get("model", FLASH)}', flush=True)


def write_manifest(specs):
    man = {k: f'img/{k}.webp' for k in specs if (IMG / f'{k}.webp').exists()}
    (IMG / 'manifest.json').write_text(json.dumps(man, indent=1) + '\n', encoding='utf8')
    print(f'manifest: {len(man)} images, {sum((IMG / f"{k}.webp").stat().st_size for k in man) // 1024} KB total')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--key-file')
    ap.add_argument('--only', help='comma-separated keys')
    ap.add_argument('--force', action='store_true', help='regenerate even if the file exists')
    ap.add_argument('--list', action='store_true', help='list keys and exit')
    ap.add_argument('--jobs', type=int, default=4)
    a = ap.parse_args()
    specs = all_specs()
    if a.list:
        print('\n'.join(f'{k:16} {v[0]:5} {v[1]}  {"ok" if (IMG / f"{k}.webp").exists() else "-"}' for k, v in specs.items()))
        sys.exit()
    KEY = (pathlib.Path(a.key_file).expanduser().read_text().strip() if a.key_file
           else os.environ.get('OPENROUTER_API_KEY', '').strip())
    if not KEY:
        raise SystemExit('Set OPENROUTER_API_KEY or pass --key-file')
    IMG.mkdir(exist_ok=True)
    keys = a.only.split(',') if a.only else list(specs)
    # references must exist before the images that use them
    first = [k for k in keys if not specs[k][3].get('ref')]
    later = [k for k in keys if specs[k][3].get('ref')]
    for batch in (first, later):
        with ThreadPoolExecutor(a.jobs) as ex:
            futs = {ex.submit(gen, k, specs[k], a.force): k for k in batch}
            for f, k in futs.items():
                try:
                    f.result()
                except Exception as e:
                    print(f'failed {k}: {e}', flush=True)
    print(f'spent this run: ${spent[0]:.3f}')
    write_manifest(specs)
