# Michi Japanese

A complete beginner-to-N4 Japanese course in a single HTML file. Open `index.html` in a browser.

| | |
| --- | --- |
| **Learn** | 242 lessons: hiragana and katakana row by row, 1,145 JLPT N5/N4 words by theme, 278 kanji, and 64 grammar points with quizzes. The path puts hiragana first, then mixes the other tracks. |
| **Review** | FSRS-4.5 spaced repetition. New cards are multiple choice. Once a card is stable you type the answer, with live romaji→kana input. |
| **Dojo** | Kana chart, writing practice that checks each stroke's position, order and direction against KanjiVG, Kana Blitz, a Conjugation Gym (16 verb forms and 6 adjective forms), a numbers and counters drill, and a listening drill. |
| **Read** | 10 graded stories (kana, N5, N4). Tap any word to see its meaning, turn furigana on or off, listen sentence by sentence, and answer comprehension questions. |
| **Sensei** | Runs only when opened as a claude.ai artifact. It role-plays eight real-life scenes and corrects your Japanese, writes new stories at your level from words you know, explains sentences, and critiques your handwriting. |

Progress is saved in the browser. As an artifact, it is also saved to your Claude account. The standalone site is installable and works offline.

## Testing and hosting

See [TESTING.md](TESTING.md) for how to open it on an iPhone, the Home Screen install, and a 10-minute test script.

## Building

```
python3 nihongo/build.py                 # bundles src/ + data/ into index.html
python3 nihongo/build.py --site DIR      # deployable static site (page, manifest, service worker, icons, img, audio)
bash nihongo/tools/deploy_pages.sh       # publish that site to the gh-pages branch
python3 nihongo/tools/gen_images.py      # optional: story art via OpenRouter (OPENROUTER_API_KEY)
```

`src/` holds the app (vanilla JS, no framework). `data/` holds the content. Stroke data comes from [KanjiVG](https://kanjivg.tagaini.net) (CC BY-SA 3.0). The vocabulary, kanji, grammar and story content was written with AI and checked automatically. It has not yet been reviewed by a native teacher.
