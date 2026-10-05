#!/usr/bin/env python3
"""Bundle Michi into one self-contained page.

  python3 nihongo/build.py            -> nihongo/index.html (standalone, open in any browser)
  python3 nihongo/build.py --artifact  -> also writes the skeleton-less body used for the claude.ai artifact
  python3 nihongo/build.py --site DIR  -> assemble a deployable static site (GitHub Pages) in DIR

Images (img/*.webp) and recorded audio (audio/index.json + packs) are loaded by relative path,
so publish or serve them alongside the page.
"""
import hashlib, json, pathlib, shutil, sys

ROOT = pathlib.Path(__file__).parent
SRC, DATA, IMG = ROOT / 'src', ROOT / 'data', ROOT / 'img'
JS = ['kana.js', 'core.js', 'engine.js', 'views-main.js', 'fun.js', 'views-practice.js', 'register.js', 'views-read.js', 'views-ai.js', 'placement.js', 'views-meta.js']
CSS = ['fun.css', 'register.css']  # optional extra stylesheets appended after shell.html's own
VENDOR = ROOT / 'vendor'


def load(name):
    return json.loads((DATA / name).read_text(encoding='utf8'))


def main():
    data = {
        'vocab': load('vocab.json'), 'kanji': load('kanji.json'), 'grammar': load('grammar.json'),
        'stories': load('stories.json'), 'kanaStrokes': load('kana_strokes.json'), 'kanjiStrokes': load('kanji_strokes.json'),
        'images': {},
    }
    for opt in ('register.json', 'placement.json'):  # optional content packs
        if (DATA / opt).exists():
            data[opt[:-5]] = load(opt)
    # Images and audio ship as files next to the page (img/, audio/) and are referenced by relative path.
    for p in sorted(IMG.glob('*.webp')) if IMG.exists() else []:
        data['images'][p.stem] = f'img/{p.name}'
    blob = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    js = '\n'.join((SRC / f).read_text(encoding='utf8') for f in JS if (SRC / f).exists())
    css = '\n'.join((SRC / f).read_text(encoding='utf8') for f in CSS if (SRC / f).exists())
    wk = (VENDOR / 'wanakana.min.js').read_text(encoding='utf8').replace('</script', '<\\/script')
    body = (SRC / 'shell.html').read_text(encoding='utf8')
    if css:
        body += f'\n<style>\n{css}\n</style>'
    body += f'\n<script>{wk}</script>\n<script>window.MICHI_DATA={blob};</script>\n<script>\n{js}\n</script>\n'
    audio_idx = ROOT / 'audio' / 'index.json'
    audio_v = hashlib.md5(audio_idx.read_bytes()).hexdigest()[:10] if audio_idx.exists() else '0'
    build_v = hashlib.md5(body.encode()).hexdigest()[:10]
    # The standalone page (own domain, installable) knows its build and audio versions; the claude.ai artifact body does not.
    head = ('<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            '<meta name="theme-color" content="#274a8a" media="(prefers-color-scheme: light)">\n'
            '<meta name="theme-color" content="#0e1218" media="(prefers-color-scheme: dark)">\n'
            '<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n'
            '<meta name="apple-mobile-web-app-status-bar-style" content="default">\n<meta name="apple-mobile-web-app-title" content="Michi">\n'
            '<meta name="description" content="Michi: Japanese from your first kana to JLPT N4, with native voice, stroke-checked writing and spaced repetition.">\n'
            '<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n<link rel="icon" href="icons/icon-192.png">\n'
            f'<script>window.MICHI_STANDALONE={{v:"{audio_v}",b:"{build_v}"}};</script>\n')
    full = ('<!doctype html>\n<html lang="en">\n<head>\n' + head + '</head>\n<body>\n' + body + '</body>\n</html>\n')
    (ROOT / 'index.html').write_text(full, encoding='utf8')
    print('index.html', len(full.encode()) // 1024, 'KB', 'build', build_v, 'audio', audio_v)
    if '--artifact' in sys.argv:
        i = sys.argv.index('--artifact'); out = pathlib.Path(sys.argv[i + 1]) if len(sys.argv) > i + 1 and not sys.argv[i + 1].startswith('--') else ROOT / 'artifact.html'
        out.write_text(body, encoding='utf8')
        print(out, len(body.encode()) // 1024, 'KB')
    if '--site' in sys.argv:
        site = pathlib.Path(sys.argv[sys.argv.index('--site') + 1]); site.mkdir(parents=True, exist_ok=True)
        for d in ('img', 'audio', 'icons'):
            if (ROOT / d).exists():
                shutil.rmtree(site / d, ignore_errors=True); shutil.copytree(ROOT / d, site / d, ignore=shutil.ignore_patterns('manifest.json'))
        shutil.copy(ROOT / 'index.html', site / 'index.html'); shutil.copy(ROOT / 'index.html', site / '404.html')
        (site / 'manifest.webmanifest').write_text(json.dumps({
            'name': 'Michi Japanese', 'short_name': 'Michi', 'description': 'Japanese from kana to JLPT N4',
            'start_url': './', 'scope': './', 'display': 'standalone', 'orientation': 'any',
            'background_color': '#0e1218', 'theme_color': '#274a8a', 'lang': 'en',
            'icons': [{'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
                      {'src': 'icons/icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}]}, indent=1))
        (site / 'sw.js').write_text((SRC / 'sw.js').read_text(encoding='utf8').replace('__BUILD__', build_v).replace('__AUDIO__', audio_v))
        (site / '.nojekyll').write_text('')
        print('site ->', site)


if __name__ == '__main__':
    main()
