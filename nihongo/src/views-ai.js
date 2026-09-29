// ─── Sensei: conversation partner, story writer, explainer (Claude via `sample`) ─
const Sensei = {
  fn: null, available: false, images: false,
  async init() {
    if (!window.claude?.use) return;
    try {
      const s = await claude.use('sample'); if (!s) return;
      this.fn = s; this.available = true;
      try { const lim = await s.limits(); this.images = !!lim?.images; } catch (e) {}
      if (['read', 'story', 'grammar', 'sensei', 'write'].includes(App.route)) App.render();
    } catch (e) {}
  },
  errorText(e) {
    const c = e?.code;
    if (c === 'not_granted' || c === 'sampling_disabled' || c === 'not_declared' || c === 'capability_disabled' || c === 'capability_removed') { this.available = false; return 'Sensei is not available in this view. Everything else in Michi still works.'; }
    if (c === 'rate_limited') return 'Sensei needs a short break (usage limit). Try again in a little while.';
    if (c === 'session_expired') return 'Your Claude session expired. Sign in again to keep talking.';
    if (c === 'invalid_json') return 'Sensei answered in an unexpected format. Try again.';
    if (c === 'refused') return 'Sensei could not help with that one. Try asking another way.';
    if (c === 'cancelled') return 'Stopped.';
    return 'Sensei could not be reached. Try again.';
  },
  learnerProfile() {
    const n = k => Object.keys(S.cards).filter(x => x[0] === k).length;
    const kana = n('h') + n('k'), vocab = n('v'), kanji = n('j'), gram = Object.keys(S.grammar).length;
    let level = 'absolute beginner who is still learning kana';
    if (kana >= 60 && vocab < 80) level = 'beginner (knows kana and a few dozen words, early JLPT N5)';
    else if (vocab >= 80 && vocab < 400) level = 'JLPT N5 learner';
    else if (vocab >= 400) level = 'upper N5 / N4 learner';
    const known = Object.keys(S.cards).filter(k => k[0] === 'v').map(k => VOCAB_BY_ID[k.slice(2)]?.w).filter(Boolean);
    const knownGrammar = GRAMMAR_POINTS.filter(p => S.grammar[p.id]).map(p => p.t);
    return { level, kana, vocab, kanji, gram, known: shuffle(known).slice(0, 120), knownGrammar: knownGrammar.slice(-30), kanjiKnown: Object.keys(S.cards).filter(k => k[0] === 'j').map(k => k.slice(2)).join('') };
  },
  async gradeHandwriting(ch, blob) {
    const { text } = await this.fn(`You are a Japanese calligraphy teacher. The image shows a learner's handwritten attempt at the character 「${ch}」 drawn with a mouse or finger on a square grid. In 3 to 5 short bullet points (plain English, Markdown), say what is good, what is off (proportions, stroke lengths, angles, where strokes touch or cross, balance), and one concrete tip. Be encouraging and specific. Do not restate the stroke order.`, { images: blob, modelTier: 'default' });
    return text;
  },
};
Sensei.init();

function md(s) {
  const lines = esc(s).split('\n'); let out = '', list = null;
  const inline = t => t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<i>$2</i>').replace(/`(.+?)`/g, '<code>$1</code>');
  for (const l of lines) {
    const m = l.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (m) { if (!list) { list = /^\s*\d/.test(l) ? 'ol' : 'ul'; out += `<${list}>`; } out += `<li>${inline(m[1])}</li>`; continue; }
    if (list) { out += `</${list}>`; list = null; }
    const hd = l.match(/^#{1,4}\s+(.*)/); if (hd) { out += `<p><b>${inline(hd[1])}</b></p>`; continue; }
    if (l.trim()) out += `<p>${inline(l)}</p>`;
  }
  if (list) out += `</${list}>`;
  return out;
}

// Streaming explanation in a modal.
function explainText(text, context = '') {
  if (!Sensei.available) return;
  const body = h('div.md', h('span.typing', h('i'), h('i'), h('i')));
  const ctl = new AbortController();
  const close = () => { ctl.abort(); back.remove(); };
  const back = h('div.modal-back', { onclick: e => { if (e.target === back) close(); } }, h('div.modal', { role: 'dialog', 'aria-label': 'Sentence breakdown' },
    h('div.row.between', h('h2', 'Sensei explains'), h('button.icon-btn', { 'aria-label': 'Close', onclick: close }, icon('x'))),
    h('div.example', h('span.jp', text.length > 160 ? text.slice(0, 160) + '…' : text), context ? h('span.muted.small', context) : null), body));
  document.body.append(back);
  const p = Sensei.learnerProfile();
  Sensei.fn(`You are a warm, precise Japanese teacher. The learner is a ${p.level}. Break down this Japanese text for them.\n\nText: ${text}\n${context ? 'Context/translation: ' + context + '\n' : ''}\nFormat (Markdown, English explanations, concise):\n- For a single sentence: list each word or chunk as "**word** (reading) — meaning / role", then a short "Grammar" section naming each grammar pattern used and what it does, then one extra example sentence using the main pattern (Japanese, reading, English).\n- For a longer text: pick the 4–6 most useful grammar points and explain each with the exact phrase from the text.\nKeep it under 300 words.`, { signal: ctl.signal, modelTier: 'default', onText: ({ text: t }) => { body.innerHTML = md(t); } })
    .catch(e => { if (e.code !== 'cancelled') body.innerHTML = (e.text ? md(e.text) : '') + `<p class="muted">${esc(Sensei.errorText(e))}</p>`; });
}

// ─── Sensei view ──────────────────────────────────────────────────────────
const SCENARIOS = [
  { id: 'free', jp: '自由に話そう', en: 'Free conversation', role: 'a friendly Japanese tutor chatting casually about the learner\'s day, hobbies and plans', open: 'こんにちは！今日は何をしましたか？' },
  { id: 'intro', jp: '自己紹介', en: 'Introduce yourself', role: 'a new classmate at a Japanese language school meeting the learner for the first time', open: 'はじめまして！わたしはユキです。お名前は？' },
  { id: 'cafe', jp: 'カフェで注文', en: 'Order at a café', role: 'a barista at a small Tokyo café taking the learner\'s order (menu: コーヒー 400円, 紅茶 380円, 抹茶ラテ 520円, ケーキ 450円, サンドイッチ 600円)', open: 'いらっしゃいませ！ご注文はお決まりですか？' },
  { id: 'konbini', jp: 'コンビニで', en: 'At the convenience store', role: 'a convenience-store clerk at the register (asks about a bag, heating a bento, points card, paying by card)', open: 'いらっしゃいませ。お弁当、温めますか？' },
  { id: 'directions', jp: '道を聞く', en: 'Ask for directions', role: 'a kind local near 渋谷駅 who helps the learner find places (the station, a post office, a bookstore); describe routes with まっすぐ, 右, 左, 角, 信号', open: 'どうしましたか？何かお探しですか？' },
  { id: 'hotel', jp: 'ホテルのチェックイン', en: 'Hotel check-in', role: 'a hotel front-desk clerk checking the learner in (name, nights, breakfast time, wifi password)', open: 'いらっしゃいませ。チェックインでございますか？' },
  { id: 'doctor', jp: '病院で', en: 'At the doctor', role: 'a clinic doctor asking about symptoms (どこが痛いですか, 熱, いつから) and giving simple advice', open: 'こんにちは。今日はどうしましたか？' },
  { id: 'weekend', jp: '週末の予定（タメ口）', en: 'Weekend plans, casual speech', role: 'a close Japanese friend making weekend plans using casual plain-form speech (タメ口), not です/ます', open: 'ねえ、週末ひま？なにかする？' },
];
VIEWS.sensei = (p) => {
  const tab = p.tab || 'talk';
  const tabs = h('div.tabs', [['talk', 'Conversation'], ['story', 'Story writer'], ['ask', 'Ask anything']].map(([id, l]) => h('button', { 'aria-selected': tab === id ? 'true' : 'false', onclick: () => App.go('sensei', { tab: id }) }, l)));
  const head = h('div.stack', h('div.sensei-head', art('sensei', '.avatar-lg', 'Sensei'), h('div.stack', { style: { gap: '4px' } }, h('div.eyebrow', '先生 · Sensei'), h('h1', 'Practise with Sensei'), h('p.muted', { style: { maxWidth: '62ch' } }, 'Sensei is Claude, set up as your Japanese tutor. It adapts to what you have learned in Michi, corrects your sentences (including speech style: casual vs polite) and suggests what to say next.'))), tabs);
  if (!Sensei.available) return h('div', head, h('section.card.pad-lg.empty.stack', { style: { justifyItems: 'center' } }, h('span.hanko', '先'), h('h3', 'Sensei is waking up…'), h('p.muted', { style: { maxWidth: '52ch' } }, 'Sensei runs on your Claude account and only works while Michi is open in Claude. If this message stays, AI features are not available in this view. Lessons, reviews, writing and reading all work without it.')));
  if (tab === 'story') return h('div', head, storyWriter());
  if (tab === 'ask') return h('div', head, askAnything());
  return h('div', head, p.scenario ? chatView(SCENARIOS.find(s => s.id === p.scenario) || SCENARIOS[0]) : h('div.grid.g4', SCENARIOS.map(sc => h('button.scenario.scene-card', { onclick: () => App.go('sensei', { tab: 'talk', scenario: sc.id }) }, art('sc-' + sc.id, '.scene-img'), h('div.scene-meta', h('div.jp', sc.jp), h('div.muted.small', sc.en))))));
};
function chatView(sc) {
  const turns = []; // {role, content} for Claude; plus display data
  const msgs = h('div.msgs', { 'aria-live': 'polite' });
  let showKana = S.settings.furigana !== 'never', ctl = null;
  // Service scenes are always polite (that's how Japan works); free talk and introductions can switch.
  let reg = sc.id === 'weekend' ? 'casual' : ['free', 'intro'].includes(sc.id) ? (S.settings.senseiReg || 'polite') : 'polite';
  const prof = Sensei.learnerProfile();
  const regRule = () => reg === 'casual' ? 'This is a casual relationship (friends/peers). Speak natural casual Japanese: plain forms, contractions like 〜てる/〜ちゃう, sentence-final よ/ね/じゃん where natural, dropped particles as friends do. The learner should also speak casually.' : sc.id === 'free' ? 'Speak polite です/ます Japanese as a friendly teacher would.' : 'Speak the way this role really speaks in Japan: staff and service workers use polite speech and set keigo phrases (いらっしゃいませ, かしこまりました, 〜でございます, 少々お待ちください); strangers and doctors use です/ます. The learner should use です/ます.';
  const rulesFor = () => `You are role-playing as ${sc.role} to help an English-speaking learner practise Japanese. The learner is a ${prof.level}. Words they have studied include: ${prof.known.slice(0, 80).join('、') || '(mostly kana so far)'}. Kanji they know: ${prof.kanjiKnown || 'none yet'}.
Rules:
- Stay in character and keep the conversation moving with ONE short reply (1–2 sentences) that ends with something the learner can respond to.
- Use Japanese the learner can handle: ${prof.vocab < 80 ? 'very simple words, mostly hiragana' : 'N5–N4 grammar and vocabulary'}.
- SPEECH STYLE: ${regRule()}
- Register mistakes count as mistakes: if the learner is too casual for the situation (plain form or 〜てる/じゃん to a clerk, doctor or stranger) or oddly stiff with a close friend, put the natural version in "fix" and say who talks that way.${window.REGISTER_SCENARIO_HINT ? '\n- ' + window.REGISTER_SCENARIO_HINT : ''}
- If the learner writes in English or mixes English, gently give them the Japanese way to say it in "fix".
- If the learner's Japanese has a mistake (particle, conjugation, word choice, politeness), set "fix" with the corrected sentence and a one-sentence English reason. If it is natural and correct, set "fix" to null.
Reply ONLY with a JSON object: {"jp": "your reply in natural Japanese (kanji allowed only if common)", "kana": "the same reply written entirely in hiragana/katakana", "en": "English translation of your reply", "fix": null or {"better": "corrected Japanese", "why": "short English reason"}, "hints": ["2 or 3 short Japanese replies the learner could say next"], "hints_en": ["their English meanings"]}`;
  const add = (who, node) => { msgs.append(node); msgs.scrollTop = msgs.scrollHeight; };
  const aiBubble = (r) => {
    const kana = h('div.muted.jp', { hidden: !showKana || r.kana === r.jp }, r.kana);
    const en = h('div.en', { hidden: true }, r.en);
    const b = h('div.msg.ai',
      art('sensei', '.avatar'),
      h('div.row.between', { style: { flexWrap: 'nowrap', alignItems: 'flex-start' } }, h('div.jp', r.jp), speakBtn(r.kana || r.jp)),
      kana, en,
      h('div.row', { style: { gap: '6px' } }, h('button.btn.sm.ghost', { onclick: () => { en.hidden = !en.hidden; } }, 'Translate'), h('button.btn.sm.ghost', { onclick: () => explainText(r.jp, r.en) }, icon('sparkle'), 'Break down')));
    return b;
  };
  const suggest = h('div.suggest');
  const setHints = (hints = [], hintsEn = []) => suggest.replaceChildren(...hints.map((t, i) => h('button', { title: hintsEn[i] || '', onclick: () => { input.value = t; input.focus(); } }, t)));
  const input = h('input#chatIn', { type: 'text', autocomplete: 'off', placeholder: 'Reply in Japanese (romaji converts) or ask in English', 'aria-label': 'Your message', lang: 'ja' });
  let ime = true; bindIME(input);
  const imeBtn = h('button.btn.sm', { type: 'button', title: 'Toggle romaji→kana conversion', onclick: () => { ime = !ime; if (window.wanakana) { try { ime ? wanakana.bind(input, { IMEMode: true }) : wanakana.unbind(input); } catch (e) {} } imeBtn.textContent = ime ? 'あ' : 'A'; input.focus(); } }, 'あ');
  const sendBtn = h('button.btn.primary', { type: 'submit' }, 'Send');
  const send = async (text) => {
    turns.push({ role: 'user', content: text }); window.Fun?.event?.('sensei', {});
    add('me', h('div.msg.me', h('div.jp', text)));
    const typing = h('div.msg.ai', h('span.typing', h('i'), h('i'), h('i'))); add('ai', typing);
    sendBtn.disabled = true; ctl = new AbortController();
    try {
      const recent = turns.slice(-16);
      const input = [{ role: 'user', content: rulesFor() }, { role: 'assistant', content: JSON.stringify({ jp: sc.open, kana: sc.open, en: '', fix: null, hints: [], hints_en: [] }) }, ...recent];
      if (input[2]?.role === 'assistant') input.splice(2, 1);
      const r = await Sensei.fn.json(input, { signal: ctl.signal, cache: false, modelTier: 'default' });
      typing.remove();
      if (r.fix && r.fix.better) add('ai', h('div.msg.ai', h('div.fix', h('b', '直し · Better: '), h('span.jp', r.fix.better), h('div.small', r.fix.why || '')), h('div.row', speakBtn(r.fix.better))));
      const bubble = aiBubble({ jp: String(r.jp || ''), kana: String(r.kana || r.jp || ''), en: String(r.en || '') }); add('ai', bubble);
      turns.push({ role: 'assistant', content: JSON.stringify({ jp: r.jp, en: r.en }) });
      Voice.say(r.kana || r.jp); setHints(r.hints, r.hints_en);
      addXP(r.fix ? 2 : 4);
    } catch (e) { typing.remove(); add('ai', h('div.msg.ai', h('span.muted', Sensei.errorText(e)))); turns.pop(); }
    sendBtn.disabled = false; input.focus();
  };
  const form = h('form.composer', { onsubmit: e => { e.preventDefault(); const t = input.value.trim(); if (!t || sendBtn.disabled) return; input.value = ''; send(t); } }, imeBtn, input, sendBtn);
  add('ai', aiBubble({ jp: sc.open, kana: sc.open, en: '' }));
  setHints(sc.id === 'intro' ? ['はじめまして。', 'わたしは〜です。', 'よろしくおねがいします。'] : sc.id === 'cafe' ? ['コーヒーをください。', 'おすすめは何ですか？', 'ケーキもおねがいします。'] : ['はい。', 'すみません、もう一度おねがいします。', 'ゆっくりおねがいします。']);
  App.cleanup = () => ctl?.abort();
  setTimeout(() => { Voice.say(sc.open); input.focus(); }, 300);
  return h('section.card.pad-lg.chat',
    h('div.chat-head', art('sc-' + sc.id, '.chat-scene'), h('div.row.between', h('div', h('div.jp', { style: { fontSize: '1.3rem', fontWeight: 600 } }, sc.jp), h('div.muted.small', sc.en)), h('div.row', { style: { gap: '8px' } }, !['free', 'intro'].includes(sc.id) ? h('span.chip' + (reg === 'casual' ? '.learning' : '.new'), reg === 'casual' ? 'casual · タメ口' : 'polite · 丁寧語') : h('div.tabs', { title: 'Speech style' }, [['polite', 'Polite です/ます'], ['casual', 'Casual タメ口']].map(([v, l]) => h('button', { 'aria-selected': reg === v ? 'true' : 'false', onclick: e => { reg = v; S.settings.senseiReg = v; save(); e.currentTarget.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', b === e.currentTarget ? 'true' : 'false')); toast(v === 'casual' ? 'Sensei will talk like a friend' : 'Sensei will speak politely'); } }, l))), h('button.btn.sm', { onclick: () => App.go('sensei', { tab: 'talk' }) }, 'Change scene')))),
    msgs, h('div.stack', { style: { gap: '8px' } }, h('div.eyebrow', 'You could say'), suggest), form);
}
function storyWriter() {
  const themes = ['a day at the beach', 'a ghost in the school library', 'cooking ramen for the first time', 'a lost dog in Osaka', 'a rainy day on a train', 'meeting a robot at the park', 'New Year at a shrine', 'a mystery at the ramen shop'];
  const prof = Sensei.learnerProfile();
  const lvl = h('select#storyLevel', { 'aria-label': 'Level' }, [['kana', 'Kana only'], ['N5', 'N5'], ['N4', 'N4']].map(([v, l]) => h('option', { value: v, selected: (prof.vocab >= 400 ? 'N4' : prof.kana >= 60 ? 'N5' : 'kana') === v ? true : null }, l)));
  const theme = h('input#storyTheme', { type: 'text', placeholder: 'Theme (optional), e.g. ' + pick(themes), 'aria-label': 'Story theme' });
  const useWords = h('input', { type: 'checkbox', id: 'useMine', checked: true });
  const out = h('div.stack');
  const btn = h('button.btn.seal', { onclick: async () => {
    btn.disabled = true; out.replaceChildren(h('div.card.row', h('span.typing', h('i'), h('i'), h('i')), h('span.muted', 'Sensei is writing your story. This takes about a minute.')));
    const lv = lvl.value; const th = theme.value.trim() || pick(themes);
    const words = useWords.checked ? prof.known.slice(0, 60).join('、') : '';
    try {
      const st = await Sensei.fn.json(`Write an original, charming graded reader story in Japanese for a learner. Level: ${lv === 'kana' ? 'hiragana and katakana only, no kanji at all, very simple N5 words' : lv + ' grammar and vocabulary, kanji only at ' + lv + ' level or below'}. Theme: ${th}. Length: ${lv === 'kana' ? '6–8' : lv === 'N5' ? '8–10' : '10–12'} short sentences with a small twist at the end.${words ? ' Reuse some of these words the learner knows: ' + words + '.' : ''}
Return ONLY JSON: {"title": "Japanese title", "titleEn": "English title", "sents": [{"en": "English translation", "tok": [{"s": "surface", "r": "hiragana reading, ONLY if s contains kanji", "g": "short English gloss for content words", "p": 1 for particles and grammatical endings (omit g)}]}], "qs": [{"q": "Japanese comprehension question", "qen": "English", "opts": ["4 options in Japanese"], "a": index of correct option}]}
Tokens: split each sentence into words and particles in order; concatenating every "s" must reproduce the sentence exactly, including punctuation (「」、。 are their own tokens with no g). Conjugated verbs are one token glossed with the conjugated meaning. Exactly 3 questions.`, { modelTier: 'default', cache: false });
      if (!st || !Array.isArray(st.sents) || !st.sents.length) throw { code: 'invalid_json' };
      st.sents = st.sents.filter(x => Array.isArray(x.tok)).map(x => ({ en: String(x.en || ''), tok: x.tok.filter(t => t && t.s).map(t => ({ s: String(t.s), r: t.r && hasKanji(t.s) ? String(t.r) : undefined, g: t.g ? String(t.g) : undefined, p: t.p ? 1 : undefined })) }));
      st.qs = (st.qs || []).filter(q => Array.isArray(q.opts) && q.opts.length >= 2 && Number.isInteger(q.a) && q.a < q.opts.length);
      Object.assign(st, { id: 'ai' + now().toString(36), lv, ai: true, theme: th });
      S.aiStories = [st, ...(S.aiStories || [])].slice(0, 12); save(); addXP(5);
      App.go('story', { id: st.id });
    } catch (e) { out.replaceChildren(h('div.feedback.no', Sensei.errorText(e))); btn.disabled = false; }
  } }, icon('sparkle'), 'Write my story');
  const mine = (S.aiStories || []);
  return h('div.stack',
    h('section.card.pad-lg.stack', h('h3', 'A new story, written for you'), h('p.muted', 'Sensei writes a short graded story at your level, using words you have already studied, with tap-to-translate on every word and a comprehension check.'),
      h('div.grid.g3', h('label.stack', { style: { gap: '4px' } }, h('span.eyebrow', 'Level'), lvl), h('label.stack', { style: { gap: '4px', gridColumn: 'span 2' } }, h('span.eyebrow', 'Theme'), theme)),
      h('label.row.small', { style: { gap: '8px' } }, useWords, `Use words from my reviews (${prof.vocab})`), h('div.row', btn), out),
    mine.length ? h('section.stack', h('div.level-sep', h('h2', 'Your stories')), h('div.grid.g3', mine.map(storyCard))) : null);
}
function askAnything() {
  const out = h('div.card.md', { hidden: true });
  const q = h('textarea#askQ', { rows: 3, placeholder: 'e.g. What is the difference between は and が? · How do I say "I\'m looking for the station"? · Why is 行って spelled with っ?', 'aria-label': 'Your question' });
  let ctl;
  const stop = h('button.btn', { hidden: true, onclick: () => ctl?.abort() }, 'Stop');
  const go = h('button.btn.primary', { onclick: async () => {
    const text = q.value.trim(); if (!text) return; go.disabled = true; stop.hidden = false; out.hidden = false; out.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    ctl = new AbortController(); const p = Sensei.learnerProfile();
    try { await Sensei.fn(`You are a clear, encouraging Japanese teacher. The learner is a ${p.level}. Answer their question in English with Japanese examples (always give the reading in hiragana in parentheses after any kanji, and an English translation). Use short sections and bullet points; keep it under 350 words.\n\nQuestion: ${text}`, { signal: ctl.signal, modelTier: 'default', onText: ({ text: t }) => { out.innerHTML = md(t); } }); addXP(2); }
    catch (e) { if (e.code !== 'cancelled') out.innerHTML = (e.text ? md(e.text) : '') + `<p class="muted">${esc(Sensei.errorText(e))}</p>`; }
    go.disabled = false; stop.hidden = true;
  } }, icon('sparkle'), 'Ask');
  const chips = ['は vs が', 'When do I use に vs で?', 'How does keigo work?', 'Explain the て-form rules', 'How do I count things?', 'What does よね mean at the end?'];
  return h('div.stack', h('section.card.pad-lg.stack', q, h('div.suggest', chips.map(c => h('button', { onclick: () => { q.value = c; go.click(); } }, c))), h('div.row', go, stop)), out);
}
