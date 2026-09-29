#!/usr/bin/env python3
"""Pre-generate natural Japanese voice clips for every piece of course Japanese.

    OPENROUTER_API_KEY=... python3 nihongo/tools/gen_audio.py            # generate missing clips, prune, repack
    python3 nihongo/tools/gen_audio.py --pack-only                       # just repack from the cache
    python3 nihongo/tools/gen_audio.py --retry-failed                    # also retry texts that failed QA before

Re-run after ANY edit to data/*.json (vocab, kanji, grammar, stories): new or changed texts are
generated, texts no longer in the data are dropped from the index, and the packs are rebuilt.

TTS: OpenRouter chat completions with openai/gpt-audio-mini (voice "coral", pcm16 24 kHz mono),
falling back to openai/gpt-audio for clips that keep failing QA. Every clip is QA'd: the model's
transcript must match the input text (or its kana reading) after normalisation, and the duration
must be plausible for the number of kana. Clips that never pass are left out of the index so the
app falls back to browser TTS.

Raw clips are cached outside the repo (default: $MICHI_AUDIO_CACHE or ~/.cache/michi-audio), keyed
by sha1 of the text. Output: nihongo/audio/pNN.mp3 packs + nihongo/audio/index.json:
  {"v":1,"packs":["p00.mp3",...],"clips":{"<text>":[pack, byteOffset, byteLength, durationMs]}}
Each clip is a self-contained run of MP3 frames (no ID3/Xing header), so the app can fetch a pack
once and play `new Blob([buf.slice(o, o+l)], {type:'audio/mpeg'})`.
"""
import argparse, audioop, base64, hashlib, json, os, pathlib, re, subprocess, sys, threading, time, random
import urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA, SRC, OUT = ROOT / 'data', ROOT / 'src', ROOT / 'audio'
RATE = 24000
MINI, FULL = 'openai/gpt-audio-mini', 'openai/gpt-audio'
VOICE = 'coral'
PACK_MAX = 1_500_000
ENC_VER = 'mp3-32k-v1'  # bump to force re-encoding

# ─── Text normalisation / QA ───────────────────────────────────────────────
_kks = None
def kks(s):
    global _kks
    if _kks is None:
        import pykakasi
        _kks = pykakasi.kakasi()
    return ''.join(x['hira'] for x in _kks.convert(s))

STRIP = re.compile(r'[「」『』。、，,．.！？!?・\s　…〜~ー―\-"\'“”‘’（）()：:；;]')
def kata2hira(s):
    return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in s)
def norm(s):
    # long-vowel marks are dropped because transcripts render them inconsistently (ー vs vowel)
    return kata2hira(STRIP.sub('', s or '')).replace('ゔ', 'ぶ')

DIG = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう']
def num_reading(n):  # mirror of numReading() in src/engine.js
    if n == 0: return 'ぜろ'
    man, rest = divmod(n, 10000); out = ''
    if man: out += ('いち' if man == 1 else num_reading(man)) + 'まん'
    th, hu, te, on = rest // 1000, rest // 100 % 10, rest // 10 % 10, rest % 10
    if th: out += 'せん' if th == 1 else 'さんぜん' if th == 3 else 'はっせん' if th == 8 else DIG[th] + 'せん'
    if hu: out += 'ひゃく' if hu == 1 else 'さんびゃく' if hu == 3 else 'ろっぴゃく' if hu == 6 else 'はっぴゃく' if hu == 8 else DIG[hu] + 'ひゃく'
    if te: out += ('' if te == 1 else DIG[te]) + 'じゅう'
    if on: out += DIG[on]
    return out

def _variants(s):
    """Plausible kana renderings of a transcript/text."""
    out = {norm(s)}
    t = re.sub(r'[0-9０-９,，]+', lambda m: num_reading(int(m.group().translate(str.maketrans('０１２３４５６７８９', '0123456789')).replace(',', '').replace('，', ''))), s)
    out.add(norm(t))
    try:
        out.add(norm(kks(t)))
    except Exception:
        pass
    # common alternate number readings
    more = set()
    for v in out:
        more |= {v.replace('しち', 'なな'), v.replace('よん', 'し'), v.replace('きゅう', 'く'), v.replace('れい', 'ぜろ'), v.replace('ぜろ', 'れい')}
    return out | more

def qa_ok(text, reading, transcript):
    tr = norm(transcript)
    targets = {norm(text), norm(reading or '')} - {''}
    if tr in targets:
        return True
    tv = _variants(transcript)
    tg = targets | _variants(text) | ({norm(reading)} if reading else set())
    # particle は/へ may be transcribed phonetically
    tg |= {t.replace('は', 'わ') for t in tg}
    tv |= {t.replace('は', 'わ') for t in tv}
    return bool(tv & tg)

def kana_len(text, reading):
    r = norm(reading) if reading else norm(kks(text))
    return max(1, len(r))

def speakable(text):
    """What should actually be spoken for a key: drop dialogue labels / grammar notation."""
    t = re.sub(r'(^|\s)[AB][:：]\s*', r'\1', text)
    t = re.sub(r'\s*\([A-Za-z ]+\)', '', t)
    t = re.sub(r'\s*(→|\+)\s*', '、', t)
    t = re.sub(r'^[〜～~]+|[〜～~]+$', '', t.strip())  # counter/suffix entries like 〜えん
    return t.strip()

# ─── Content collection ────────────────────────────────────────────────────
def collect():
    """Ordered list of dicts {text, reading, group, kind}. First occurrence wins the group."""
    items, seen = [], {}
    def add(text, reading, group, kind='text'):
        text = (text or '').strip()
        if not text: return
        if text in seen: return
        seen[text] = True
        say = speakable(text)
        if say != text: reading = None
        items.append({'text': text, 'say': say, 'reading': (reading or '').strip() or None, 'group': group, 'kind': kind})
    aliases = {}  # alias key -> primary text (e.g. katakana -> hiragana, exr -> ex)

    js = (SRC / 'kana.js').read_text(encoding='utf8')
    for hira, kata, _ in re.findall(r"\['([^']+)','([^']+)','([a-z]+)'\]", js):
        add(hira, hira, 'kana', 'kana')
        aliases[kata] = hira

    vocab = json.loads((DATA / 'vocab.json').read_text(encoding='utf8'))
    cats = []
    for v in vocab:
        if v.get('cat') not in cats: cats.append(v.get('cat'))
    for c in cats:
        for v in vocab:
            if v.get('cat') != c: continue
            add(v.get('r'), v.get('r'), 'vocab:' + str(c))
            if v.get('ex'):
                add(v['ex'], v.get('exr'), 'vocab:' + str(c))
                if v.get('exr') and v['exr'] != v['ex']: aliases.setdefault(v['exr'], v['ex'])

    for k in json.loads((DATA / 'kanji.json').read_text(encoding='utf8')):
        for e in k.get('ex') or []:
            if len(e) > 1: add(e[1], e[1], 'kanji:%d' % k.get('lv', 0))

    gram = json.loads((DATA / 'grammar.json').read_text(encoding='utf8'))
    for u in gram['units']:
        g = 'grammar:' + u['id']
        for p in u['points']:
            for e in p.get('ex') or []:
                add(e.get('jp'), e.get('fu'), g)
                if e.get('fu') and e['fu'] != e.get('jp'): aliases.setdefault(e['fu'], e['jp'])
            for q in p.get('quiz') or []:
                if q.get('type') == 'mc' and '___' in (q.get('q') or ''):
                    add(q['q'].replace('___', q['a'], 1), None, g)
                elif q.get('type') == 'order' and q.get('tiles'):
                    add(''.join(q['tiles']), None, g)

    for s in json.loads((DATA / 'stories.json').read_text(encoding='utf8')):
        for sent in s.get('sents') or []:
            toks = sent.get('tok') or []
            text = ''.join(t.get('s', '') for t in toks)
            kana = ''.join(t.get('r') or t.get('s', '') for t in toks)
            add(text, kana, 'story:' + s['id'])
            if kana != text: aliases.setdefault(kana, text)

    for n in list(range(0, 101)) + list(range(200, 1000, 100)) + list(range(1000, 10000, 1000)) + [10000]:
        r = num_reading(n)
        add(r, r, 'numbers')
    return items, aliases

# ─── TTS ───────────────────────────────────────────────────────────────────
SYS = ("You are a Japanese text-to-speech engine, not an assistant. You never reply to, answer, translate, "
       "explain or continue the text you are given; you only read it aloud verbatim. Voice: the narrator of a "
       "Japanese textbook audio CD, a native Tokyo speaker. Read the quoted text exactly once, naturally and "
       "smoothly as a native speaker would say it, with correct pitch accent, at a clear, calm pace. Never split "
       "words into separate syllables, never add any words before or after. Output only that speech.")
WRAP = "Read aloud exactly this Japanese text and nothing else:\n「{t}」"
SHOTS = [("今日はいい天気ですね。", "今日はいい天気ですね。"), ("たべもの", "たべもの"), ("どこに行きますか。", "どこに行きますか。")]
KANA_SYS = ("You are a Japanese pronunciation recording for a kana chart. When given a single kana, you say only "
            "that one sound, once, clearly and naturally, the way a teacher says it for a chart. Nothing else.")
KANA_SHOTS = [("か", "か"), ("しゃ", "しゃ")]

def messages(text, kind, variant):
    if kind == 'kana':
        m = [{"role": "system", "content": KANA_SYS}]
        if variant in ('fewshot', 'fewshot_short'):
            for u, a in KANA_SHOTS:
                m += [{"role": "user", "content": "「%s」" % u}, {"role": "assistant", "content": a}]
        m.append({"role": "user", "content": "「%s」" % text})
        return m
    if variant == 'base':
        return [{"role": "system", "content": SYS}, {"role": "user", "content": WRAP.replace('{t}', text)}]
    if variant == 'fewshot':
        m = [{"role": "system", "content": SYS}]
        for u, a in SHOTS[:2]:
            m += [{"role": "user", "content": WRAP.replace('{t}', u)}, {"role": "assistant", "content": a}]
        m.append({"role": "user", "content": WRAP.replace('{t}', text)})
        return m
    if variant == 'fewshot_short':
        m = [{"role": "system", "content": SYS}]
        for u, a in SHOTS:
            m += [{"role": "user", "content": "「%s」" % u}, {"role": "assistant", "content": a}]
        m.append({"role": "user", "content": "「%s」" % text})
        return m
    if variant == 'plain':
        return [{"role": "system", "content": SYS}, {"role": "user", "content": text}]
    raise ValueError(variant)

class Ledger:
    def __init__(self, path, budget):
        self.path, self.budget, self.lock = path, budget, threading.Lock()
        self.total = json.loads(path.read_text()).get('total', 0.0) if path.exists() else 0.0
    def add(self, c):
        with self.lock:
            self.total += c or 0.0
            self.path.write_text(json.dumps({'total': round(self.total, 5)}))
    def over(self):
        return self.budget is not None and self.total >= self.budget

def tts(key, text, kind, variant, model=MINI, voice=VOICE):
    body = {"model": model, "modalities": ["text", "audio"], "audio": {"voice": voice, "format": "pcm16"},
            "stream": True, "usage": {"include": True}, "messages": messages(text, kind, variant)}
    delay = 2
    for attempt in range(7):
        req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(),
                                     headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
        pcm, tr, cost, err = bytearray(), '', 0.0, None
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                for line in r:
                    line = line.decode('utf8', 'replace').strip()
                    if not line.startswith('data:') or line.endswith('[DONE]'): continue
                    d = json.loads(line[5:])
                    if d.get('error'): err = str(d['error']); break
                    if d.get('usage'): cost = float(d['usage'].get('cost') or 0)
                    for ch in d.get('choices', []):
                        a = (ch.get('delta') or {}).get('audio') or {}
                        if a.get('data'): pcm += base64.b64decode(a['data'])
                        if a.get('transcript'): tr += a['transcript']
            if err is None:
                return bytes(pcm), tr, cost
        except urllib.error.HTTPError as e:
            if e.code not in (408, 429, 500, 502, 503, 504, 520, 522, 524): raise
            err = 'HTTP %d' % e.code
        except (urllib.error.URLError, TimeoutError, ConnectionError, json.JSONDecodeError) as e:
            err = repr(e)
        time.sleep(delay + random.random() * delay); delay = min(delay * 2, 60)
    raise RuntimeError('TTS failed: %s' % err)

VARIANT_ORDER = ['fewshot', 'fewshot_short', 'base', 'fewshot']  # mini attempts; then FULL with the first

def generate(key, item, ledger, first_variant='fewshot'):
    """Returns (pcm or None, meta)."""
    text, reading, kind = item['say'], item['reading'], item['kind']
    order = [first_variant] + [v for v in VARIANT_ORDER if v != first_variant][:3]
    plan = [(MINI, v) for v in order] + [(FULL, first_variant), (FULL, order[1])]
    log = []
    kl = kana_len(text, reading)
    for model, variant in plan:
        if ledger.over(): log.append('budget'); break
        try:
            pcm, tr, cost = tts(key, text, kind, variant, model)
        except Exception as e:
            log.append('error %s' % e); continue
        ledger.add(cost)
        dur = len(pcm) / 2 / RATE
        ok_tr = qa_ok(text, reading, tr)
        vo = voiced(pcm)
        ok_dur = (dur <= 0.35 * kl + 1.0 + (0.6 if kind == 'kana' else 0) and vo >= max(0.08, 0.04 * kl)
                  and audioop.max(pcm, 2) >= 2500)
        if ok_dur and kind != 'kana' and not re.search(r'[、。？！?!\s　,]', text):
            gp = gaps(pcm)  # a single word/phrase should not contain long pauses
            ok_dur = gp < 2 + text.count('っ') + text.count('ッ')
        log.append({'model': model, 'variant': variant, 'tr': tr, 'dur': round(dur, 2), 'voiced': round(vo, 2), 'ok_tr': ok_tr, 'ok_dur': ok_dur, 'cost': cost})
        if ok_tr and ok_dur:
            return pcm, {'text': text, 'ok': True, 'tries': log}
    return None, {'text': text, 'ok': False, 'tries': log}

# ─── Audio encoding / packing ──────────────────────────────────────────────
def gaps(pcm):
    """Number of internal pauses >= 150 ms inside the speech (catches syllable-by-syllable spelling)."""
    fr = RATE // 100 * 2
    lo = [audioop.rms(pcm[i:i + fr], 2) > 300 for i in range(0, len(pcm) - fr + 1, fr)]
    if True not in lo: return 0
    a, b = lo.index(True), len(lo) - lo[::-1].index(True)
    n = run = 0
    for x in lo[a:b]:
        if not x: run += 1
        else:
            if run >= 15: n += 1
            run = 0
    return n

def voiced(pcm):
    """Seconds of 10 ms frames that are clearly above the noise floor."""
    fr = RATE // 100 * 2
    return sum(1 for i in range(0, len(pcm) - fr + 1, fr) if audioop.rms(pcm[i:i + fr], 2) > 300) / 100

def trim(pcm):
    fr = RATE // 100 * 2  # 10 ms
    frames = [pcm[i:i + fr] for i in range(0, len(pcm) - fr + 1, fr)]
    if not frames: return pcm
    peak = max(audioop.rms(f, 2) for f in frames)
    th = max(120, peak * 0.03)
    loud = [i for i, f in enumerate(frames) if audioop.rms(f, 2) > th]
    if not loud: return pcm
    a, b = max(0, loud[0] - 4), min(len(frames), loud[-1] + 1 + 6)  # 40 ms before onset, 60 ms after tail
    pad = b'\x00\x00' * int(RATE * 0.06)
    return pad + pcm[a * fr:b * fr] + pad

def encode_mp3(ffmpeg, pcm):
    p = subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-f', 's16le', '-ar', str(RATE), '-ac', '1', '-i', 'pipe:0',
                        '-c:a', 'libmp3lame', '-b:a', '32k', '-ar', str(RATE), '-ac', '1', '-write_xing', '0', '-id3v2_version', '0',
                        '-map_metadata', '-1', '-f', 'mp3', 'pipe:1'], input=pcm, capture_output=True, check=True)
    return p.stdout

def sha(text): return hashlib.sha1(text.encode('utf8')).hexdigest()

def pack(items, aliases, cache, ffmpeg):
    OUT.mkdir(exist_ok=True)
    # group-contiguous order, preserving first-seen group order
    groups = {}
    for it in items:
        groups.setdefault(it['group'], []).append(it)
    clips_by_group, first, dup = [], {}, {}
    for g, its in groups.items():
        lst = []
        for it in its:
            h = sha(it['say'])
            if h in first:
                dup[it['text']] = first[h]; continue
            meta = cache / (h + '.json')
            if not meta.exists() or not json.loads(meta.read_text()).get('ok'): continue
            mp3p = cache / (h + '.' + ENC_VER + '.mp3')
            if not mp3p.exists():
                pcm = trim((cache / (h + '.pcm')).read_bytes())
                mp3p.write_bytes(encode_mp3(ffmpeg, pcm))
                (cache / (h + '.' + ENC_VER + '.ms')).write_text(str(round(len(pcm) / 2 / RATE * 1000)))
            ms = int((cache / (h + '.' + ENC_VER + '.ms')).read_text())
            first[h] = it['text']
            lst.append((it['text'], mp3p.read_bytes(), ms))
        if lst: clips_by_group.append((g, lst))
    # bin groups into packs; a group that doesn't fit starts a new pack (split only if itself too big)
    packs, cur = [], []
    size = lambda p: sum(len(b) for _, b, _ in p)
    for g, lst in clips_by_group:
        gsize = sum(len(b) for _, b, _ in lst)
        if cur and size(cur) + gsize > PACK_MAX:
            packs.append(cur); cur = []
        for c in lst:
            if cur and size(cur) + len(c[1]) > PACK_MAX:
                packs.append(cur); cur = []
            cur.append(c)
    if cur: packs.append(cur)
    for old in OUT.glob('p*.mp3'): old.unlink()
    index = {'v': 1, 'packs': [], 'clips': {}}
    for i, p in enumerate(packs):
        name = 'p%02d.mp3' % i
        buf, off = bytearray(), 0
        for text, b, ms in p:
            index['clips'][text] = [i, len(buf), len(b), ms]
            buf += b
        (OUT / name).write_bytes(buf)
        index['packs'].append(name)
    for alias, primary in list(dup.items()) + list(aliases.items()):
        if alias not in index['clips'] and primary in index['clips']:
            index['clips'][alias] = index['clips'][primary]
    (OUT / 'index.json').write_text(json.dumps(index, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
    total = sum((OUT / n).stat().st_size for n in index['packs'])
    print('packed %d clips (+%d aliases) into %d packs, %.2f MB' % (
        sum(len(p) for p in packs), len(index['clips']) - sum(len(p) for p in packs), len(packs), total / 1e6))
    return index

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', default=os.environ.get('MICHI_AUDIO_CACHE', str(pathlib.Path.home() / '.cache' / 'michi-audio')))
    ap.add_argument('--key-file', help='file holding the OpenRouter key (else $OPENROUTER_API_KEY)')
    ap.add_argument('--workers', type=int, default=12)
    ap.add_argument('--budget', type=float, default=None, help='stop generating when the cache ledger total (USD) reaches this')
    ap.add_argument('--limit', type=int, default=None, help='generate at most N missing clips')
    ap.add_argument('--pack-only', action='store_true')
    ap.add_argument('--retry-failed', action='store_true')
    ap.add_argument('--no-prune', action='store_true')
    a = ap.parse_args()
    cache = pathlib.Path(a.cache); cache.mkdir(parents=True, exist_ok=True)
    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    items, aliases = collect()
    print('%d texts in the course data' % len(items))
    ledger = Ledger(cache / 'ledger.json', a.budget)

    if not a.pack_only:
        def need(it):
            m = cache / (sha(it['say']) + '.json')
            if not m.exists(): return True
            return a.retry_failed and not json.loads(m.read_text()).get('ok')
        uniq = {}
        for it in items:
            if need(it): uniq.setdefault(it['say'], it)
        todo = list(uniq.values())[:a.limit]
        print('%d to generate (spent so far $%.3f)' % (len(todo), ledger.total))
        if todo:
            key = (pathlib.Path(a.key_file).read_text().strip() if a.key_file else os.environ.get('OPENROUTER_API_KEY', '')).strip()
            if not key: sys.exit('No API key: set OPENROUTER_API_KEY or pass --key-file')
            done = 0
            with ThreadPoolExecutor(a.workers) as ex:
                futs = {ex.submit(generate, key, it, ledger): it for it in todo}
                for f in as_completed(futs):
                    it = futs[f]; h = sha(it['say'])
                    try:
                        pcm, meta = f.result()
                    except Exception as e:
                        print('ERROR', it['text'], e); continue
                    if pcm is not None: (cache / (h + '.pcm')).write_bytes(pcm)
                    if not (meta['tries'] and meta['tries'][-1] == 'budget'):
                        (cache / (h + '.json')).write_text(json.dumps(meta, ensure_ascii=False))
                    done += 1
                    if not meta['ok']: print('FAIL', it['text'], json.dumps(meta['tries'][-1], ensure_ascii=False))
                    if done % 50 == 0: print('  %d/%d  $%.3f' % (done, len(todo), ledger.total), flush=True)
            print('generation done, total spent $%.3f' % ledger.total)

    if not a.no_prune:
        live = {sha(it['say']) for it in items}
        n = 0
        for p in cache.iterdir():
            h = p.name.split('.')[0]
            if len(h) == 40 and h not in live:
                p.unlink(); n += 1
        if n: print('pruned %d stale cache files' % n)
    failed = []
    for it in items:
        m = cache / (sha(it['say']) + '.json')
        if m.exists() and not json.loads(m.read_text()).get('ok'): failed.append(it['text'])
    (cache / 'failures.json').write_text(json.dumps(failed, ensure_ascii=False, indent=0))
    print('%d texts never passed QA (browser TTS fallback); list in %s' % (len(failed), cache / 'failures.json'))
    pack(items, aliases, cache, ffmpeg)

if __name__ == '__main__':
    main()
