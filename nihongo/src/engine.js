// ─── Content registry, romaji, question generation, conjugation, numbers ───
const DATA = window.MICHI_DATA || {};
const VOCAB = DATA.vocab || [], KANJI = DATA.kanji || [], GRAMMAR = DATA.grammar || { units: [] }, STORIES = DATA.stories || [];
const STROKES = Object.assign({}, DATA.kanaStrokes || {}, DATA.kanjiStrokes || {});
const VOCAB_BY_ID = Object.fromEntries(VOCAB.map(v => [v.id, v]));
const KANJI_BY = Object.fromEntries(KANJI.map(k => [k.k, k]));
const GRAMMAR_POINTS = GRAMMAR.units.flatMap(u => u.points.map(p => Object.assign(p, { unit: u.id, unitTitle: u.title })));

// ─── Kana ⇄ romaji ─────────────────────────────────────────────────────────
const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const toKata = s => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
const EXTRA_ROMA = { 'ぁ': 'a', 'ぃ': 'i', 'ぅ': 'u', 'ぇ': 'e', 'ぉ': 'o', 'ゔ': 'vu', 'ゎ': 'wa' };
function kanaToRomaji(s) {
  s = toHira(s); let out = '';
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2), c = s[i];
    if (c === 'っ') { const nx = s.slice(i + 1, i + 3); const r = KANA_ROMAJI[nx] || KANA_ROMAJI[s[i + 1]] || ''; out += r.startsWith('ch') ? 't' : (r[0] || ''); continue; }
    if (c === 'ー') { out += out.slice(-1); continue; }
    if (c === 'ん') { const nx = KANA_ROMAJI[s[i + 1]] || ''; out += /^[aiueoy]/.test(nx) ? "n'" : 'n'; continue; }
    if (KANA_ROMAJI[two] && two.length === 2) { out += KANA_ROMAJI[two]; i++; continue; }
    out += KANA_ROMAJI[c] || EXTRA_ROMA[c] || c;
  }
  return out;
}
// Normalise alternative spellings so "si", "tu", "hu", "zya" all count.
function normRomaji(s) {
  return s.toLowerCase().replace(/[\s'’\-]/g, '')
    .replace(/sy([aueo])/g, 'sh$1').replace(/si/g, 'shi').replace(/ty([aueo])/g, 'ch$1').replace(/cy([aueo])/g, 'ch$1').replace(/ti/g, 'chi').replace(/tu/g, 'tsu')
    .replace(/hu/g, 'fu').replace(/z?jy([aueo])/g, 'j$1').replace(/zy([aueo])/g, 'j$1').replace(/zi/g, 'ji').replace(/di/g, 'ji').replace(/du/g, 'zu').replace(/nn/g, 'n')
    .replace(/shhi/g, 'shi').replace(/chhi/g, 'chi');
}
function kanaAnswerMatches(input, kana) {
  const i = input.trim(); if (!i) return false;
  if (/[぀-ヿ]/.test(i)) return toHira(i.replace(/\s/g, '')) === toHira(kana);
  const r = normRomaji(kanaToRomaji(kana)); const n = normRomaji(i);
  if (n === r) return true;
  if (kana === 'を' && n === 'o') return true; if (kana === 'ヲ' && n === 'o') return true;
  return false;
}
// Live IME on an input: wanakana when available; otherwise leave romaji (still accepted).
function bindIME(input) { if (window.wanakana) { try { wanakana.bind(input, { IMEMode: true }); input.dataset.ime = '1'; } catch (e) {} } }

// ─── Item registry ─────────────────────────────────────────────────────────
function item(key) {
  const [t, id] = [key[0], key.slice(2)];
  if (t === 'h' || t === 'k') return { key, type: 'kana', ch: id, script: t, romaji: KANA_ROMAJI[id] };
  if (t === 'v') { const v = VOCAB_BY_ID[id]; return v && Object.assign({ key, type: 'vocab' }, v); }
  if (t === 'j') { const k = KANJI_BY[id]; return k && Object.assign({ key, type: 'kanji' }, k); }
  return null;
}
const itemLabel = it => it.type === 'kana' ? it.ch : it.type === 'vocab' ? it.w : it.k;

// ─── Lessons (the learning path) ───────────────────────────────────────────
const CAT_ORDER = ['greet', 'num', 'pron', 'people', 'question', 'time', 'food', 'place', 'home', 'school', 'verb', 'adj', 'colour', 'body', 'clothes', 'transport', 'nature', 'animal', 'shopping', 'hobby', 'work', 'feeling', 'health', 'adv', 'misc'];
const CAT_NAME = { greet: 'Greetings & set phrases', num: 'Numbers & counters', pron: 'Pronouns & pointing words', people: 'People & family', question: 'Question words', time: 'Time & calendar', food: 'Food & drink', place: 'Places & town', home: 'Home & things', school: 'School & study', verb: 'Everyday verbs', adj: 'Describing words', colour: 'Colours', body: 'Body', clothes: 'Clothes', transport: 'Getting around', nature: 'Weather & nature', animal: 'Animals', shopping: 'Shopping', hobby: 'Free time', work: 'Work', feeling: 'Feelings', health: 'Health', adv: 'Adverbs', misc: 'Useful extras' };
const LESSONS = (() => {
  const out = [];
  for (const l of KANA_LESSONS) out.push({ id: 'kana-' + l.id, track: 'kana', title: (l.script === 'h' ? 'Hiragana · ' : 'Katakana · ') + l.label, sub: l.chars.join(' '), keys: l.chars.map(c => `${l.script}:${c}`), level: 'kana' });
  for (const lv of [5, 4]) {
    const byCat = {};
    for (const v of VOCAB.filter(v => v.lv === lv)) (byCat[v.cat] = byCat[v.cat] || []).push(v);
    const cats = Object.keys(byCat).sort((a, b) => (CAT_ORDER.indexOf(a) + 99) % 124 - (CAT_ORDER.indexOf(b) + 99) % 124);
    for (const cat of cats) {
      const list = byCat[cat]; const n = Math.ceil(list.length / 8);
      for (let i = 0; i < n; i++) {
        const chunk = list.slice(Math.floor(i * list.length / n), Math.floor((i + 1) * list.length / n));
        out.push({ id: `voc-${lv}-${cat}-${i + 1}`, track: 'vocab', title: `${CAT_NAME[cat] || cat}${n > 1 ? ' ' + (i + 1) : ''}`, sub: chunk.slice(0, 4).map(v => v.w).join('・'), keys: chunk.map(v => 'v:' + v.id), level: 'N' + lv, cat });
      }
    }
    const kj = KANJI.filter(k => k.lv === lv);
    for (let i = 0; i < kj.length; i += 6) {
      const chunk = kj.slice(i, i + 6);
      out.push({ id: `kj-${lv}-${i / 6 + 1}`, track: 'kanji', title: `Kanji N${lv} · Set ${i / 6 + 1}`, sub: chunk.map(k => k.k).join(' '), keys: chunk.map(k => 'j:' + k.k), level: 'N' + lv });
    }
  }
  return out;
})();
const LESSON_BY = Object.fromEntries(LESSONS.map(l => [l.id, l]));
function lessonProgress(l) { const n = l.keys.filter(k => S.cards[k]).length; return n / l.keys.length; }
function nextLesson(track) {
  if (track) return LESSONS.find(l => l.track === track && !S.lessons[l.id]);
  // Recommended path: hiragana first, then interleave katakana, vocabulary and kanji by relative progress.
  const hira = LESSONS.find(l => l.id.startsWith('kana-h') && !S.lessons[l.id]); if (hira) return hira;
  const c = ['kana', 'vocab', 'kanji'].map(t => { const all = LESSONS.filter(l => l.track === t); const d = all.filter(l => S.lessons[l.id]).length; return { n: nextLesson(t), f: all.length ? d / all.length * (t === 'kanji' ? 1.5 : 1) : 1 }; }).filter(x => x.n);
  c.sort((a, b) => a.f - b.f); return c[0]?.n;
}

const Session = { lessonChars: null };
// ─── Distractors ───────────────────────────────────────────────────────────
function kanaDistractors(ch, script, n = 3) {
  const pool = script === 'h' ? HIRA : KATA;
  const confuse = KANA_CONFUSE.find(s => s.includes(ch)) || '';
  // Prefer kana the learner has met (plus this lesson's), then look-alikes, then the basic rows.
  const known = pool.filter(c => S.cards[`${script}:${c}`] || (Session.lessonChars || []).includes(c));
  const basic = pool.slice(0, 46);
  const seen = new Set([KANA_ROMAJI[ch]]); const out = [];
  for (const c of shuffle(known).concat(shuffle([...confuse].filter(c => c !== ch)), shuffle(basic), shuffle(pool))) {
    if (out.length >= n) break; const r = KANA_ROMAJI[c]; if (!r || seen.has(r) || c === ch) continue; seen.add(r); out.push(c);
  }
  return out;
}
function vocabDistractors(v, n = 3) {
  const same = VOCAB.filter(x => x.id !== v.id && x.m !== v.m && x.w !== v.w && (x.cat === v.cat || x.pos === v.pos));
  const pool = same.length >= n ? same : VOCAB.filter(x => x.id !== v.id);
  const out = [], seenM = new Set([v.m]);
  for (const x of shuffle(pool)) { if (out.length >= n) break; if (seenM.has(x.m)) continue; seenM.add(x.m); out.push(x); }
  return out;
}
function kanjiDistractors(k, n = 3) {
  const pool = KANJI.filter(x => x.k !== k.k && Math.abs(x.s - k.s) <= 3);
  return shuffle(pool.length >= n ? pool : KANJI.filter(x => x.k !== k.k)).slice(0, n);
}
const shortM = m => m.split(/;\s*/).slice(0, 2).join('; ');

// ─── Question factory ──────────────────────────────────────────────────────
// Returns {kind:'mc'|'type', prompt:{big, sub, audio, hint}, opts:[{label, sub, correct}], check(str), answer, reveal}
function makeQuestion(key, forceMode) {
  const it = item(key); if (!it) return null;
  const c = S.cards[key]; const stage = cardStage(c);
  const typing = stage === 'young' || stage === 'mature' || stage === 'mastered';
  if (it.type === 'kana') {
    const modes = typing ? ['k2r-type', 'k2r-type', 'a2k', 'r2k'] : ['k2r', 'k2r', 'a2k', 'r2k'];
    const mode = forceMode || pick(modes);
    const ds = kanaDistractors(it.ch, it.script);
    if (mode === 'k2r') return { key, mode, kind: 'mc', q: 'What sound is this?', big: it.ch, bigClass: 'kana', opts: shuffle([it.ch, ...ds].map(ch => ({ label: KANA_ROMAJI[ch], correct: ch === it.ch }))), answer: it.romaji, say: it.ch };
    if (mode === 'k2r-type') return { key, mode, kind: 'type', q: 'Type the romaji', big: it.ch, bigClass: 'kana', answer: it.romaji, check: s => kanaAnswerMatches(s, it.ch), say: it.ch, ime: false };
    if (mode === 'a2k') return { key, mode, kind: 'mc', q: 'Which one do you hear?', audio: it.ch, big: null, opts: shuffle([it.ch, ...ds].map(ch => ({ label: ch, big: true, correct: ch === it.ch }))), answer: `${it.ch} · ${it.romaji}`, say: it.ch };
    return { key, mode: 'r2k', kind: 'mc', q: `Pick “${it.romaji}”`, big: it.romaji, bigClass: 'roma', opts: shuffle([it.ch, ...ds].map(ch => ({ label: ch, big: true, correct: ch === it.ch }))), answer: it.ch, say: it.ch };
  }
  if (it.type === 'vocab') {
    const readable = hasKanji(it.w);
    let modes = typing ? ['v2m', 'm2v-type', 'a2m', readable ? 'v2r-type' : 'm2v'] : ['v2m', 'v2m', 'a2m', 'm2v'];
    const mode = forceMode || pick(modes);
    const ds = vocabDistractors(it);
    const showFuri = S.settings.furigana === 'always' || (S.settings.furigana === 'auto' && (!c || c.st !== 2 || c.s < 7));
    const wordHTML = showFuri ? ruby(it.w, it.r) : esc(it.w);
    if (mode === 'v2m') return { key, mode, kind: 'mc', q: 'What does this mean?', bigHTML: wordHTML, bigClass: 'word', sub: S.settings.romaji && !hasKanji(it.w) ? kanaToRomaji(it.r) : '', opts: shuffle([it, ...ds].map(x => ({ label: shortM(x.m), correct: x.id === it.id }))), answer: `${it.w} (${it.r}) — ${it.m}`, say: it.r };
    if (mode === 'a2m') return { key, mode, kind: 'mc', q: 'Listen. What does it mean?', audio: it.r, opts: shuffle([it, ...ds].map(x => ({ label: shortM(x.m), correct: x.id === it.id }))), answer: `${it.w} (${it.r}) — ${it.m}`, say: it.r };
    if (mode === 'm2v') return { key, mode, kind: 'mc', q: 'Which word means…', big: shortM(it.m), bigClass: 'en', opts: shuffle([it, ...ds].map(x => ({ labelHTML: ruby(x.w, x.r), big: true, correct: x.id === it.id }))), answer: `${it.w} (${it.r})`, say: it.r };
    if (mode === 'v2r-type') return { key, mode, kind: 'type', q: 'Type the reading', bigHTML: esc(it.w), bigClass: 'word', hint: shortM(it.m), answer: it.r, check: s => kanaAnswerMatches(s, it.r), say: it.r, ime: true };
    return { key, mode: 'm2v-type', kind: 'type', q: 'Say it in Japanese (type the reading)', big: shortM(it.m), bigClass: 'en', hint: CAT_NAME[it.cat] || '', answer: `${it.r}${it.w !== it.r ? ' · ' + it.w : ''}`, check: s => kanaAnswerMatches(s, it.r) || s.trim() === it.w, say: it.r, ime: true };
  }
  if (it.type === 'kanji') {
    const modes = typing ? ['j2m', 'jex', 'm2j', 'jex-type'] : ['j2m', 'j2m', 'jex', 'm2j'];
    let mode = forceMode || pick(modes);
    const ds = kanjiDistractors(it);
    const ex = pick(it.ex || []);
    if ((mode === 'jex' || mode === 'jex-type') && !ex) mode = 'j2m';
    if (mode === 'j2m') return { key, mode, kind: 'mc', q: 'What does this kanji mean?', big: it.k, bigClass: 'kanji', opts: shuffle([it, ...ds].map(x => ({ label: shortM(x.m), correct: x.k === it.k }))), answer: `${it.k} — ${it.m}`, say: (it.ex?.[0] || [])[1] };
    if (mode === 'm2j') return { key, mode, kind: 'mc', q: 'Which kanji means…', big: shortM(it.m), bigClass: 'en', opts: shuffle([it, ...ds].map(x => ({ label: x.k, big: true, correct: x.k === it.k }))), answer: it.k, say: (it.ex?.[0] || [])[1] };
    if (mode === 'jex-type') return { key, mode, kind: 'type', q: 'Type the reading of this word', big: ex[0], bigClass: 'word', hint: ex[2], answer: ex[1], check: s => kanaAnswerMatches(s, ex[1]), say: ex[1], ime: true };
    const others = shuffle(KANJI.flatMap(k => k.ex || []).filter(e => e[1] !== ex[1] && e[1].length >= ex[1].length - 2 && e[1].length <= ex[1].length + 2)).slice(0, 3);
    return { key, mode: 'jex', kind: 'mc', q: 'How is this word read?', big: ex[0], bigClass: 'word', hint: ex[2], opts: shuffle([ex, ...others].map(e => ({ label: e[1], big: true, correct: e[1] === ex[1] }))), answer: `${ex[0]} (${ex[1]}) — ${ex[2]}`, say: ex[1] };
  }
}

// ─── Conjugation engine ────────────────────────────────────────────────────
const GODAN_ROW = { u: 'わいうえお', ku: 'かきくけこ', gu: 'がぎぐげご', su: 'さしすせそ', tsu: 'たちつてと', nu: 'なにぬねの', bu: 'ばびぶべぼ', mu: 'まみむめも', ru: 'らりるれろ' };
const U_TO_VT = { 'う': 'u', 'く': 'ku', 'ぐ': 'gu', 'す': 'su', 'つ': 'tsu', 'ぬ': 'nu', 'ぶ': 'bu', 'む': 'mu', 'る': 'ru' };
const HONORIFIC_GODAN = ['いらっしゃる', 'おっしゃる', 'くださる', 'なさる', 'ござる'];
const CONJ_FORMS = [
  { id: 'masu', label: 'polite', jp: '〜ます', lv: 5 }, { id: 'masen', label: 'polite negative', jp: '〜ません', lv: 5 },
  { id: 'mashita', label: 'polite past', jp: '〜ました', lv: 5 }, { id: 'masendeshita', label: 'polite past negative', jp: '〜ませんでした', lv: 5 },
  { id: 'te', label: 'te-form', jp: '〜て', lv: 5 }, { id: 'nai', label: 'plain negative', jp: '〜ない', lv: 5 },
  { id: 'ta', label: 'plain past', jp: '〜た', lv: 5 }, { id: 'nakatta', label: 'plain past negative', jp: '〜なかった', lv: 5 },
  { id: 'tai', label: 'want to', jp: '〜たい', lv: 5 }, { id: 'mashou', label: 'let\'s', jp: '〜ましょう', lv: 5 },
  { id: 'pot', label: 'potential (can)', jp: '〜れる / える', lv: 4 }, { id: 'vol', label: 'volitional', jp: '〜よう / おう', lv: 4 },
  { id: 'ba', label: 'conditional', jp: '〜ば', lv: 4 }, { id: 'pass', label: 'passive', jp: '〜られる', lv: 4 },
  { id: 'caus', label: 'causative', jp: '〜させる', lv: 4 }, { id: 'imp', label: 'command', jp: '命令形', lv: 4 },
];
const ADJ_FORMS = [
  { id: 'a-neg', label: 'negative', jp: '〜くない / じゃない' }, { id: 'a-past', label: 'past', jp: '〜かった / だった' },
  { id: 'a-pastneg', label: 'past negative', jp: '〜くなかった / じゃなかった' }, { id: 'a-te', label: 'te-form (and…)', jp: '〜くて / で' },
  { id: 'a-adv', label: 'adverb', jp: '〜く / に' }, { id: 'a-pol', label: 'polite negative', jp: '〜くないです / じゃありません' },
];
// Conjugate a reading (kana). Returns string or null if unsupported.
function conjugate(v, form) {
  const r = v.r; let pos = v.pos;
  if (pos === 'vs') return conjugate({ r: r + 'する', pos: 'vsi' }, form);
  if (pos === 'vsi' || r.endsWith('する') && pos === 'vs') {
    const b = r.slice(0, -2);
    const m = { masu: 'します', masen: 'しません', mashita: 'しました', masendeshita: 'しませんでした', te: 'して', nai: 'しない', ta: 'した', nakatta: 'しなかった', tai: 'したい', mashou: 'しましょう', pot: 'できる', vol: 'しよう', ba: 'すれば', pass: 'される', caus: 'させる', imp: 'しろ' }[form];
    return m ? b + m : null;
  }
  if (pos === 'vk') {
    const b = r.slice(0, -2);
    const m = { masu: 'きます', masen: 'きません', mashita: 'きました', masendeshita: 'きませんでした', te: 'きて', nai: 'こない', ta: 'きた', nakatta: 'こなかった', tai: 'きたい', mashou: 'きましょう', pot: 'こられる', vol: 'こよう', ba: 'くれば', pass: 'こられる', caus: 'こさせる', imp: 'こい' }[form];
    return m ? b + m : null;
  }
  if (pos === 'v1') {
    const b = r.slice(0, -1);
    const m = { masu: 'ます', masen: 'ません', mashita: 'ました', masendeshita: 'ませんでした', te: 'て', nai: 'ない', ta: 'た', nakatta: 'なかった', tai: 'たい', mashou: 'ましょう', pot: 'られる', vol: 'よう', ba: 'れば', pass: 'られる', caus: 'させる', imp: 'ろ' }[form];
    return m ? b + m : null;
  }
  if (pos === 'v5') {
    if (HONORIFIC_GODAN.some(x => r.endsWith(x))) return null;
    const last = r.slice(-1), vt = v.vt || U_TO_VT[last]; if (!vt || !GODAN_ROW[vt]) return null;
    const b = r.slice(0, -1), row = GODAN_ROW[vt];
    const iku = v.ex5 === 'iku' || /^(い|ゆ)く$/.test(r) || r.endsWith('いく') && /行/.test(v.w || '');
    const aru = r === 'ある';
    const teTa = t => { // t: 'て' | 'た'
      if (iku && vt === 'ku') return b + 'っ' + t;
      if (['u', 'tsu', 'ru'].includes(vt)) return b + 'っ' + t;
      if (['mu', 'bu', 'nu'].includes(vt)) return b + 'ん' + (t === 'て' ? 'で' : 'だ');
      if (vt === 'ku') return b + 'い' + t; if (vt === 'gu') return b + 'い' + (t === 'て' ? 'で' : 'だ');
      if (vt === 'su') return b + 'し' + t;
    };
    const i = b + row[1], a = aru ? '' : b + row[0], e = b + row[3], o = b + row[4];
    const m = {
      masu: i + 'ます', masen: i + 'ません', mashita: i + 'ました', masendeshita: i + 'ませんでした', te: teTa('て'), ta: teTa('た'),
      nai: aru ? 'ない' : a + 'ない', nakatta: aru ? 'なかった' : a + 'なかった', tai: i + 'たい', mashou: i + 'ましょう',
      pot: aru ? null : e + 'る', vol: o + 'う', ba: e + 'ば', pass: aru ? null : a + 'れる', caus: aru ? null : a + 'せる', imp: e,
    }[form];
    return m || null;
  }
  if (pos === 'adj-i') {
    const irr = v.irr || r === 'いい' || r.endsWith('いい') && v.w?.endsWith('いい');
    const b = irr ? r.slice(0, -2) + 'よ' : r.slice(0, -1);
    return { 'a-neg': b + 'くない', 'a-past': b + 'かった', 'a-pastneg': b + 'くなかった', 'a-te': b + 'くて', 'a-adv': b + 'く', 'a-pol': b + 'くないです' }[form] || null;
  }
  if (pos === 'adj-na') {
    return { 'a-neg': r + 'じゃない', 'a-past': r + 'だった', 'a-pastneg': r + 'じゃなかった', 'a-te': r + 'で', 'a-adv': r + 'に', 'a-pol': r + 'じゃありません' }[form] || null;
  }
  return null;
}
// Accept common alternates (では for じゃ, ないです for ません).
function conjAccepts(v, form, input) {
  const ans = conjugate(v, form); if (!ans) return false;
  const i = toHira(input.replace(/\s/g, '')); if (!i) return false;
  const writtenVariant = writtenConj(v, ans);
  const alts = [ans, ans.replace('じゃ', 'では'), writtenVariant, writtenVariant && writtenVariant.replace('じゃ', 'では')];
  if (form === 'a-pol' && v.pos === 'adj-i') alts.push(ans.replace(/くないです$/, 'くありません'));
  if (form === 'a-pol' && v.pos === 'adj-na') alts.push(ans.replace(/じゃありません$/, 'じゃないです'), ans.replace(/じゃありません$/, 'ではありません'));
  if (form === 'pot' && v.pos === 'v1') alts.push(ans.replace(/られる$/, 'れる')); // ら抜き is common in speech
  if (form === 'pot' && v.pos === 'vk') alts.push(ans.replace(/こられる$/, 'これる'));
  if (!/[぀-ヿ一-龯]/.test(i)) return alts.filter(Boolean).some(a => normRomaji(kanaToRomaji(a)) === normRomaji(i));
  return alts.filter(Boolean).includes(i);
}
// Map a conjugated reading back onto the written form (keep the kanji stem).
function writtenConj(v, conjReading) {
  const w = v.pos === 'vs' ? v.w + 'する' : v.w, r = v.pos === 'vs' ? v.r + 'する' : v.r;
  if (!w || !hasKanji(w)) return conjReading;
  if (v.pos === 'vk') { const m = { 'き': '来', 'こ': '来', 'く': '来' }; return w.replace(/来る$/, '') + '来' + conjReading.slice(r.length - 1); }
  // longest common kana suffix between w and r = okurigana; stem is w minus it
  let k = 0; while (k < w.length && k < r.length && w[w.length - 1 - k] === r[r.length - 1 - k] && !hasKanji(w[w.length - 1 - k])) k++;
  const stemW = w.slice(0, w.length - k), stemR = r.slice(0, r.length - k);
  if (!conjReading.startsWith(stemR)) return conjReading;
  return stemW + conjReading.slice(stemR.length);
}
const CONJ_VERBS = () => VOCAB.filter(v => ['v1', 'v5', 'vk', 'vsi', 'vs'].includes(v.pos) && conjugate(v, 'te'));
// Stative verbs whose will/ability/command forms are unnatural; skip them for those drills.
const NO_WILL = new Set(['ある', 'わかる', 'できる', 'しる', 'いる', 'みえる', 'きこえる', 'こまる', 'ちがう', 'すぎる', 'なる', 'かかる', 'いる']);
const WILL_FORMS = new Set(['pot', 'vol', 'imp', 'pass', 'caus', 'tai', 'mashou']);
const conjNatural = (v, form) => !(WILL_FORMS.has(form) && (NO_WILL.has(v.r) || /(まる|がる|わる|まる)$/.test(v.r) && v.pos === 'v5' && ['pot', 'vol', 'imp', 'caus'].includes(form)));
const CONJ_ADJS = () => VOCAB.filter(v => ['adj-i', 'adj-na'].includes(v.pos) && conjugate(v, 'a-neg'));
function conjRule(v, form) {
  const t = { v1: 'Ichidan (る-verb): drop る, add the ending.', v5: 'Godan (う-verb): shift the final kana along its row.', vk: '来る is irregular: く→き/こ.', vsi: 'する is irregular: し/さ/すれ.', vs: 'Noun + する: conjugate する.', 'adj-i': 'い-adjective: drop い, add the ending.', 'adj-na': 'な-adjective: attach the copula.' }[v.pos] || '';
  let extra = '';
  if (v.pos === 'v5' && (form === 'te' || form === 'ta')) extra = ' て/た: う・つ・る→って, む・ぶ・ぬ→んで, く→いて, ぐ→いで, す→して (行く→行って).';
  if (v.r === 'ある' && ['nai', 'nakatta'].includes(form)) extra = ' ある is special: its negative is simply ない.';
  if (v.pos === 'adj-i' && (v.irr || v.r === 'いい')) extra = ' いい conjugates from よい: よくない, よかった.';
  return t + extra;
}

// ─── Numbers & counters ────────────────────────────────────────────────────
const DIG = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
function numReading(n) {
  if (n === 0) return 'ぜろ';
  const man = Math.floor(n / 10000), rest = n % 10000; let out = '';
  if (man) out += (man === 1 ? 'いち' : numReading(man)) + 'まん';
  const th = Math.floor(rest / 1000), hu = Math.floor(rest / 100) % 10, te = Math.floor(rest / 10) % 10, on = rest % 10;
  if (th) out += th === 1 ? 'せん' : th === 3 ? 'さんぜん' : th === 8 ? 'はっせん' : DIG[th] + 'せん';
  if (hu) out += hu === 1 ? 'ひゃく' : hu === 3 ? 'さんびゃく' : hu === 6 ? 'ろっぴゃく' : hu === 8 ? 'はっぴゃく' : DIG[hu] + 'ひゃく';
  if (te) out += (te === 1 ? '' : DIG[te]) + 'じゅう';
  if (on) out += DIG[on];
  return out;
}
const numKanji = n => { const d = '〇一二三四五六七八九'; if (n === 0) return '〇'; const f = (x) => { let s = ''; const p = [[1000, '千'], [100, '百'], [10, '十']]; for (const [v, c] of p) { const q = Math.floor(x / v) % 10; if (q) s += (q === 1 ? '' : d[q]) + c; } if (x % 10) s += d[x % 10]; return s; }; const man = Math.floor(n / 10000); return (man ? f(man) + '万' : '') + f(n % 10000); };
const COUNTERS = {
  tsu: { label: '〜つ (things)', glyph: 'つ', r: [null, 'ひとつ', 'ふたつ', 'みっつ', 'よっつ', 'いつつ', 'むっつ', 'ななつ', 'やっつ', 'ここのつ', 'とお'], max: 10, what: 'general things (apples, ideas)' },
  nin: { label: '〜人 (people)', glyph: '人', r: [null, 'ひとり', 'ふたり', 'さんにん', 'よにん', 'ごにん', 'ろくにん', 'ななにん', 'はちにん', 'きゅうにん', 'じゅうにん'], alt: { 7: ['しちにん'] }, max: 10, what: 'people' },
  hon: { label: '〜本 (long things)', glyph: '本', r: [null, 'いっぽん', 'にほん', 'さんぼん', 'よんほん', 'ごほん', 'ろっぽん', 'ななほん', 'はっぽん', 'きゅうほん', 'じゅっぽん'], alt: { 10: ['じっぽん'] }, max: 10, what: 'pens, bottles, umbrellas' },
  mai: { label: '〜枚 (flat things)', glyph: '枚', r: [null, 'いちまい', 'にまい', 'さんまい', 'よんまい', 'ごまい', 'ろくまい', 'ななまい', 'はちまい', 'きゅうまい', 'じゅうまい'], max: 10, what: 'paper, tickets, shirts' },
  hiki: { label: '〜匹 (small animals)', glyph: '匹', r: [null, 'いっぴき', 'にひき', 'さんびき', 'よんひき', 'ごひき', 'ろっぴき', 'ななひき', 'はっぴき', 'きゅうひき', 'じゅっぴき'], alt: { 10: ['じっぴき'] }, max: 10, what: 'cats, dogs, fish' },
  hai: { label: '〜杯 (cups)', glyph: '杯', r: [null, 'いっぱい', 'にはい', 'さんばい', 'よんはい', 'ごはい', 'ろっぱい', 'ななはい', 'はっぱい', 'きゅうはい', 'じゅっぱい'], alt: { 10: ['じっぱい'] }, max: 10, what: 'cups, glasses, bowls' },
  ko: { label: '〜個 (small objects)', glyph: '個', r: [null, 'いっこ', 'にこ', 'さんこ', 'よんこ', 'ごこ', 'ろっこ', 'ななこ', 'はっこ', 'きゅうこ', 'じゅっこ'], alt: { 10: ['じっこ'] }, max: 10, what: 'eggs, candies, small items' },
  sai: { label: '〜歳 (age)', glyph: '歳', r: [null, 'いっさい', 'にさい', 'さんさい', 'よんさい', 'ごさい', 'ろくさい', 'ななさい', 'はっさい', 'きゅうさい', 'じゅっさい'], alt: { 10: ['じっさい'] }, max: 10, what: 'age (20 is はたち)' },
  ji: { label: '〜時 (o\'clock)', glyph: '時', r: [null, 'いちじ', 'にじ', 'さんじ', 'よじ', 'ごじ', 'ろくじ', 'しちじ', 'はちじ', 'くじ', 'じゅうじ', 'じゅういちじ', 'じゅうにじ'], max: 12, what: 'clock hours' },
  gatsu: { label: '〜月 (months)', glyph: '月', r: [null, 'いちがつ', 'にがつ', 'さんがつ', 'しがつ', 'ごがつ', 'ろくがつ', 'しちがつ', 'はちがつ', 'くがつ', 'じゅうがつ', 'じゅういちがつ', 'じゅうにがつ'], max: 12, what: 'months of the year' },
  nichi: { label: '〜日 (dates)', glyph: '日', r: [null, 'ついたち', 'ふつか', 'みっか', 'よっか', 'いつか', 'むいか', 'なのか', 'ようか', 'ここのか', 'とおか', 'じゅういちにち', 'じゅうににち', 'じゅうさんにち', 'じゅうよっか', 'じゅうごにち', 'じゅうろくにち', 'じゅうしちにち', 'じゅうはちにち', 'じゅうくにち', 'はつか', 'にじゅういちにち', 'にじゅうににち', 'にじゅうさんにち', 'にじゅうよっか', 'にじゅうごにち', 'にじゅうろくにち', 'にじゅうしちにち', 'にじゅうはちにち', 'にじゅうくにち', 'さんじゅうにち', 'さんじゅういちにち'], max: 31, what: 'days of the month' },
  fun: { label: '〜分 (minutes)', glyph: '分', gen: n => { const ones = n % 10, tens = Math.floor(n / 10); const tail = [null, 'いっぷん', 'にふん', 'さんぷん', 'よんぷん', 'ごふん', 'ろっぷん', 'ななふん', 'はっぷん', 'きゅうふん']; if (ones === 0) return (tens === 1 ? '' : DIG[tens]) + 'じゅっぷん'; return (tens ? (tens === 1 ? '' : DIG[tens]) + 'じゅう' : '') + tail[ones]; }, max: 59, what: 'minutes' },
};
function counterReading(key, n) { const c = COUNTERS[key]; const main = c.gen ? c.gen(n) : c.r[n]; const alts = [main, ...((c.alt || {})[n] || [])]; if (key === 'fun' && n % 10 === 0) alts.push(main.replace('じゅっぷん', 'じっぷん')); return alts; }
