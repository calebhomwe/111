#!/usr/bin/env python3
"""Bundle Michi into one self-contained page.

  python3 nihongo/build.py            -> nihongo/index.html (standalone, open in any browser)
  python3 nihongo/build.py --artifact  -> also writes the skeleton-less body used for the claude.ai artifact

Images in nihongo/img/<story-id>.webp are embedded as data URIs when present.
"""
import base64, json, pathlib, sys

ROOT = pathlib.Path(__file__).parent
SRC, DATA, IMG = ROOT / 'src', ROOT / 'data', ROOT / 'img'
JS = ['kana.js', 'core.js', 'engine.js', 'views-main.js', 'views-practice.js', 'views-read.js', 'views-ai.js', 'views-meta.js']
WANAKANA = 'https://cdn.jsdelivr.net/npm/wanakana@5.3.1/wanakana.min.js'


def load(name):
    return json.loads((DATA / name).read_text(encoding='utf8'))


def main():
    data = {
        'vocab': load('vocab.json'), 'kanji': load('kanji.json'), 'grammar': load('grammar.json'),
        'stories': load('stories.json'), 'kanaStrokes': load('kana_strokes.json'), 'kanjiStrokes': load('kanji_strokes.json'),
        'images': {},
    }
    for p in sorted(IMG.glob('*.webp')) if IMG.exists() else []:
        data['images'][p.stem] = 'data:image/webp;base64,' + base64.b64encode(p.read_bytes()).decode()
    blob = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    js = '\n'.join((SRC / f).read_text(encoding='utf8') for f in JS)
    body = (SRC / 'shell.html').read_text(encoding='utf8')
    body += f'\n<script src="{WANAKANA}"></script>\n<script>window.MICHI_DATA={blob};</script>\n<script>\n{js}\n</script>\n'
    full = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            '</head>\n<body>\n' + body + '</body>\n</html>\n')
    (ROOT / 'index.html').write_text(full, encoding='utf8')
    print('index.html', len(full.encode()) // 1024, 'KB')
    if '--artifact' in sys.argv:
        out = pathlib.Path(sys.argv[sys.argv.index('--artifact') + 1]) if len(sys.argv) > sys.argv.index('--artifact') + 1 else ROOT / 'artifact.html'
        out.write_text(body, encoding='utf8')
        print(out, len(body.encode()) // 1024, 'KB')


if __name__ == '__main__':
    main()
