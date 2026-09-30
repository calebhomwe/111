// ─── Reading library, story reader, grammar, kanji browser ────────────────
const LV_ORDER = { kana: 0, N5: 1, N4: 2 };
VIEWS.read = () => {
  const all = STORIES.concat(S.aiStories || []);
  const groups = [['kana', 'Kana only'], ['N5', 'JLPT N5'], ['N4', 'JLPT N4']];
  return h('div',
    banner('tr-read', '読み物 · Graded readers', 'Read', 'Short stories written for your level. Tap any word for its meaning, switch furigana on or off, and listen to every sentence read by a native voice.', Sensei.available ? h('button.btn.seal', { onclick: () => App.go('sensei', { tab: 'story' }) }, icon('sparkle'), 'Write me a new story') : null),
    groups.map(([lv, label]) => {
      const list = all.filter(s => s.lv === lv); if (!list.length) return null;
      return h('section.stack', h('div.level-sep', h('h2', label)), h('div.grid.g3', list.map(storyCard)));
    }));
};
function storyKnown(s) {
  const toks = s.sents.flatMap(x => x.tok).filter(t => t.g && !t.p); if (!toks.length) return null;
  const known = toks.filter(t => { const r = toHira(t.r || t.s); const v = VOCAB.find(v => v.w === t.s || v.r === r || (hasKanji(v.w) && v.w.length > 1 && t.s.startsWith(v.w.slice(0, -1)))); return v && S.cards['v:' + v.id]; }).length;
  return Math.round(known / toks.length * 100);
}
function storyCard(s) {
  const st = S.stories[s.id]; const kn = Object.keys(S.cards).some(k => k[0] === 'v') ? storyKnown(s) : null;
  return h('button.story-card', { onclick: () => App.go('story', { id: s.id }) },
    h('div.art', storyArt(s, { w: 480, h: 190 })),
    h('div.meta', h('div.row.between', h('span.chip' + (st ? '.young' : ''), st ? `Read · ${st.score != null ? st.score + '/' + (s.qs || []).length : ''}` : s.lv === 'kana' ? 'Kana' : s.lv), s.ai ? h('span.chip.seal', 'Sensei') : null),
      h('b', s.title), h('span.muted.small', s.titleEn), h('span.muted.small', `${(s.sents || []).length} sentences${kn != null ? ` · you know ${kn}% of the words` : ''}`)));
}
VIEWS.story = ({ id }) => {
  const s = STORIES.concat(S.aiStories || []).find(x => x.id === id); if (!s) return VIEWS.read();
  let furi = S.settings.furigana !== 'never', showEn = false;
  const reader = h('div.reader' + (furi ? '' : '.nofuri'), { lang: 'ja' });
  const sentEls = s.sents.map((sent, si) => {
    const el = h('span.sent');
    const en = h('span.en', { hidden: true }, sent.en);
    const toks = sent.tok.map(t => {
      if (t.p || (!t.g && !t.r)) return h('span', { html: t.r ? ruby(t.s, t.r) : esc(t.s) });
      const saved = (S.saved || []).includes(t.s);
      return h('span.tok' + (saved ? '.saved' : ''), { 'data-s': t.s, tabindex: '0', role: 'button', html: t.r ? ruby(t.s, t.r) : esc(t.s), onclick: e => wordPop(e.currentTarget, t, sent), onkeydown: e => { if (e.key === 'Enter') wordPop(e.currentTarget, t, sent); } });
    });
    el.append(en, ...toks, ' ');
    const play = h('button.icon-btn.speak', { style: { width: '30px', height: '30px', verticalAlign: 'middle', marginLeft: '6px' }, 'aria-label': 'Play sentence', onclick: () => speakSent(si) }, icon('speaker'));
    play.oncontextmenu = e => { e.preventDefault(); Voice.say(plain(sent), { tts: kanaOf(sent), slow: true }); };
    el.append(play);
    return el;
  });
  reader.append(...sentEls);
  const plain = sent => sent.tok.map(t => t.s).join('');
  const kanaOf = sent => sent.tok.map(t => t.r || t.s).join('');
  let playing = false;
  const speakSent = async (i, chain = false) => {
    sentEls.forEach(e => e.classList.remove('speaking')); sentEls[i].classList.add('speaking');
    await Voice.say(plain(s.sents[i]), { tts: kanaOf(s.sents[i]), rate: S.settings.rate * 0.95 });
    sentEls[i].classList.remove('speaking');
    if (chain && playing && i + 1 < sentEls.length) speakSent(i + 1, true); else { playing = false; playAll.replaceChildren(icon('play'), 'Read aloud'); }
  };
  const playAll = h('button.btn', { onclick: () => { if (playing) { playing = false; Voice.stop(); playAll.replaceChildren(icon('play'), 'Read aloud'); return; } playing = true; playAll.replaceChildren(icon('x'), 'Stop'); speakSent(0, true); } }, icon('play'), 'Read aloud');
  const furiBtn = h('button.btn', { 'aria-pressed': String(furi), onclick: () => { furi = !furi; reader.classList.toggle('nofuri', !furi); furiBtn.setAttribute('aria-pressed', String(furi)); furiBtn.lastChild.textContent = furi ? 'Hide furigana' : 'Show furigana'; } }, icon('eye'), h('span', furi ? 'Hide furigana' : 'Show furigana'));
  const enBtn = h('button.btn', { onclick: () => { showEn = !showEn; reader.querySelectorAll('.en').forEach(e => e.hidden = !showEn); enBtn.lastChild.textContent = showEn ? 'Hide English' : 'Show English'; } }, icon('learn'), h('span', 'Show English'));
  const explain = Sensei.available ? h('button.btn', { onclick: () => explainText(s.sents.map(plain).join(''), `Story: ${s.titleEn}`) }, icon('sparkle'), 'Explain the grammar') : null;

  // comprehension quiz
  const quiz = h('section.card.stack');
  if (s.qs?.length) {
    let answered = 0, right = 0;
    quiz.append(h('h3', '読解 · Check your understanding'));
    s.qs.forEach((q, qi) => {
      const box = h('div.stack', h('div', h('div.jp', { style: { fontSize: '1.15rem' } }, q.q), h('div.muted.small', q.qen)));
      const opts = h('div.opts', q.opts.map((o, oi) => h('button.opt', { style: { fontFamily: 'var(--f-jp-hand)', fontSize: '1.05rem' }, onclick: e => {
        if (opts.dataset.done) return; opts.dataset.done = 1; const ok = oi === q.a; e.currentTarget.classList.add(ok ? 'right' : 'wrong'); if (!ok) opts.children[q.a].classList.add('right');
        answered++; if (ok) { right++; Sfx.ok(); } else Sfx.bad();
        if (answered === s.qs.length) { const prev = S.stories[s.id]; S.stories[s.id] = { read: now(), score: Math.max(prev?.score || 0, right) }; addXP(prev ? 5 : 15 + right * 5); if (right === s.qs.length) petals(); window.Fun?.event?.('story', { id: s.id }); quiz.append(h('div.feedback.ok', h('strong', `${right}/${s.qs.length} correct · story complete`))); checkAchievements(); }
      } }, o)));
      box.append(opts); quiz.append(box);
    });
  }
  const savedHere = s.sents.flatMap(x => x.tok).filter(t => (S.saved || []).includes(t.s));
  return h('div',
    h('div.row', h('button.btn.ghost', { onclick: () => App.go('read') }, icon('back'), 'Library')),
    h('div.story-art', storyArt(s, { w: 1060, h: 260 })),
    h('div.stack', { style: { gap: '4px' } }, h('div.eyebrow', s.lv === 'kana' ? 'Kana reader' : `${s.lv} reader`), h('h1.jp', { style: { fontFamily: 'var(--f-jp-hand)', fontWeight: 600 } }, s.title), h('p.muted', s.titleEn)),
    h('div.row', playAll, furiBtn, enBtn, explain),
    h('section.card.pad-lg', reader),
    h('p.muted.small', 'Tap a word to see what it means and save it. Saved words are underlined in red and can go into your reviews.'),
    quiz);
};
function wordPop(el, t, sent) {
  $$('.pop').forEach(p => p.remove()); $$('.tok.sel').forEach(x => x.classList.remove('sel')); el.classList.add('sel');
  const reading = t.r || t.s;
  // look for a dictionary match to offer "add to reviews"
  const dictHit = VOCAB.find(v => v.w === t.s || v.r === toHira(t.s)) || VOCAB.find(v => t.s.startsWith(v.w.replace(/[るうくぐすつぬぶむい]$/, '')) && hasKanji(v.w) && v.w.length > 1);
  const saved = (S.saved || []).includes(t.s);
  const pop = h('div.pop', { role: 'dialog' },
    h('div.row.between', h('span.w', { html: ruby(t.s, t.r) }), speakBtn(reading)),
    showRomaji() ? h('div.muted.small', kanaToRomaji(reading)) : null,
    h('div', t.g || ''),
    dictHit && dictHit.w !== t.s ? h('div.muted.small', { html: `Dictionary form: ${ruby(dictHit.w, dictHit.r)} — ${esc(dictHit.m)}` }) : null,
    kanjiIn(t.s).length ? h('div.row.small', kanjiIn(t.s).map(k => h('button.chip', { onclick: () => openKanji(k.k) }, `${k.k} ${shortM(k.m)}`))) : null,
    h('div.row',
      dictHit ? h('button.btn.sm' + (S.cards['v:' + dictHit.id] ? '' : '.primary'), { disabled: S.cards['v:' + dictHit.id] ? true : null, onclick: e => { addCardsFromKeys(['v:' + dictHit.id]); e.currentTarget.disabled = true; e.currentTarget.textContent = 'In reviews'; toast(`${dictHit.w} added to reviews`); App.renderNav(); } }, S.cards['v:' + dictHit.id] ? 'In reviews' : 'Add to reviews') : null,
      h('button.btn.sm', { onclick: () => { S.saved = S.saved || []; if (saved) S.saved = S.saved.filter(x => x !== t.s); else S.saved.push(t.s); save(); $$('.tok').forEach(x => { if (x.dataset.s === t.s) x.classList.toggle('saved', !saved); }); toast(saved ? 'Removed from saved words' : 'Saved'); pop.remove(); } }, icon('bookmark'), saved ? 'Unsave' : 'Save word')));
  document.body.append(pop);
  const r = el.getBoundingClientRect(); const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = clamp(r.left + r.width / 2 - pw / 2, 16, innerWidth - pw - 16), top = r.bottom + 8; if (top + ph > innerHeight - 16) top = r.top - ph - 8;
  pop.style.left = left + 'px'; pop.style.top = Math.max(8, top) + 'px';
  Voice.say(reading);
  setTimeout(() => { const off = e => { if (!pop.contains(e.target) && e.target !== el) { pop.remove(); el.classList.remove('sel'); document.removeEventListener('pointerdown', off); } }; document.addEventListener('pointerdown', off); }, 0);
}

// ─── Grammar ───────────────────────────────────────────────────────────────
function grammarList() {
  if (!GRAMMAR.units.length) return h('div.empty', 'Grammar lessons are loading.');
  return GRAMMAR.units.map(u => h('section.stack',
    h('div.level-sep', h('h2', u.title), h('span.muted.small', `${u.points.filter(p => S.grammar[p.id]).length}/${u.points.length}`)),
    h('div.lesson-list', u.points.map(p => h('button.lesson', { onclick: () => App.go('grammar', { id: p.id }) },
      S.grammar[p.id] ? h('span.hanko.round.done', '済') : null,
      h('div.t.jp', { style: { fontSize: '1.15rem' } }, p.t), h('div.muted.small', p.sum), h('span.chip', `N${p.lv}`))))));
}
function inlineMd(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); }
function exampleRow(e) {
  const kana = e.fu || e.jp;
  return h('div.example', h('div.row.between', { style: { flexWrap: 'nowrap', alignItems: 'flex-start' } }, h('span.jp', e.jp), h('div.row', { style: { flexWrap: 'nowrap', gap: '6px' } }, speakBtn(e.jp, 'Play sentence', kana), Sensei.available ? h('button.icon-btn', { title: 'Break it down', 'aria-label': 'Break down this sentence', onclick: () => explainText(e.jp, e.en) }, icon('sparkle')) : null)),
    e.fu && e.fu !== e.jp ? h('span.muted.small.jp', e.fu) : null, h('span.muted.small', e.en));
}
VIEWS.grammar = ({ id }) => {
  const p = GRAMMAR_POINTS.find(x => x.id === id); if (!p) return VIEWS.learn({ track: 'grammar' });
  const idx = GRAMMAR_POINTS.indexOf(p), prev = GRAMMAR_POINTS[idx - 1], next = GRAMMAR_POINTS[idx + 1];
  const quizHost = h('div.stack');
  let qi = 0, right = 0; const qs = p.quiz || [];
  const renderQ = () => {
    if (qi >= qs.length) {
      const was = S.grammar[p.id]; S.grammar[p.id] = { done: now(), score: Math.max(was?.score || 0, right) }; window.Fun?.event?.('grammar', { id: p.id });
      addXP(was ? 3 : 12 + right * 2); Sfx.done(); if (right === qs.length) petals(16);
      quizHost.replaceChildren(h('div.result-hero', h('span.hanko.stamp', right === qs.length ? '満点' : '済'), h('h3', `${right}/${qs.length} correct`),
        h('div.row', { style: { justifyContent: 'center' } }, next ? h('button.btn.primary', { onclick: () => App.go('grammar', { id: next.id }) }, `Next: ${next.t}`) : null, h('button.btn', { onclick: () => { qi = 0; right = 0; renderQ(); } }, 'Retry'))));
      checkAchievements(); return;
    }
    const q = qs[qi]; const fb = h('div');
    const after = ok => {
      if (ok) { right++; Sfx.ok(); } else Sfx.bad();
      const nb = h('button.btn.primary', { onclick: () => { qi++; renderQ(); } }, 'Continue');
      fb.replaceChildren(h('div.feedback.' + (ok ? 'ok' : 'no'), h('strong', ok ? '正解！' : 'Not quite'), h('div.ans.jp', q.type === 'mc' ? (q.q.includes('___') ? q.q.replace('___', q.a) : q.a) : q.tiles.join('')), h('div.row.between', q.en ? h('span.small', q.en) : h('span'), nb)));
      Voice.say(q.type === 'mc' ? (q.q.includes('___') ? q.q.replace('___', q.a) : q.a) : q.tiles.join('')); setTimeout(() => nb.focus(), 30);
    };
    if (q.type === 'mc') {
      const opts = h('div.opts', q.opts.map(o => h('button.opt.bigopt', { 'data-v': o, style: { fontSize: o.length > 12 ? '1.1rem' : '1.4rem' }, onclick: e => { if (opts.dataset.done) return; opts.dataset.done = 1; const ok = o === q.a; e.currentTarget.classList.add(ok ? 'right' : 'wrong'); if (!ok) [...opts.children].find(c => c.dataset.v === q.a)?.classList.add('right'); after(ok); } }, o)));
      quizHost.replaceChildren(h('div.eyebrow', `Question ${qi + 1} of ${qs.length}`), h('div' + (q.q.includes('___') ? '.jp' : ''), { style: { fontSize: q.q.includes('___') ? '1.5rem' : '1.1rem', textAlign: 'center', fontWeight: q.q.includes('___') ? 400 : 700 } }, q.q.replace('___', '＿＿')), q.en ? h('div.muted.small', { style: { textAlign: 'center' } }, q.en) : null, opts, fb);
    } else {
      const pool = shuffle(q.tiles.map((t, i) => ({ t, i }))); const chosen = [];
      const ans = h('div.tiles.answer'), bank = h('div.tiles');
      const draw = () => {
        ans.replaceChildren(...chosen.map((c, k) => h('button', { onclick: () => { chosen.splice(k, 1); pool.push(c); draw(); } }, c.t)));
        bank.replaceChildren(...pool.map((c, k) => h('button', { onclick: () => { pool.splice(k, 1); chosen.push(c); draw(); if (!pool.length) { const ok = chosen.map(c => c.t).join('') === q.tiles.join(''); ans.style.borderColor = ok ? 'var(--ok)' : 'var(--bad)'; bank.remove(); ans.querySelectorAll('button').forEach(b => b.disabled = true); after(ok); } } }, c.t)));
      };
      draw();
      quizHost.replaceChildren(h('div.eyebrow', `Question ${qi + 1} of ${qs.length} · Put the words in order`), h('div', { style: { fontWeight: 700, textAlign: 'center' } }, q.en), ans, bank, fb);
    }
  };
  renderQ();
  return h('div',
    h('div.row.between', h('button.btn.ghost', { onclick: () => App.go('learn', { track: 'grammar' }) }, icon('back'), 'All grammar'), h('span.chip', `${p.unitTitle} · N${p.lv}`)),
    h('div.stack', { style: { gap: '6px' } }, h('div.eyebrow', 'Grammar point'), h('h1.jp', { style: { fontFamily: 'var(--f-jp-hand)', fontWeight: 600 } }, p.t), h('p', { style: { fontSize: '1.1rem' } }, p.sum)),
    h('div.grid.gram-grid', { style: { gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: '18px' } },
      h('section.card.pad-lg.stack', h('div', { html: inlineMd(p.exp) }), (p.form || []).length ? h('div.stack', { style: { gap: '6px' } }, h('div.eyebrow', 'Pattern'), (p.form || []).map(f => h('div.pattern', f))) : null, p.tip ? h('div.mnemonic', h('b', 'Watch out: '), p.tip) : null),
      h('section.stack', h('div.eyebrow', 'Examples'), (p.ex || []).map(exampleRow))),
    qs.length ? h('section.card.pad-lg.stack', h('h3', 'Quick check'), quizHost) : null,
    h('div.row.between', prev ? h('button.btn', { onclick: () => App.go('grammar', { id: prev.id }) }, icon('back'), prev.t) : h('span'), next ? h('button.btn', { onclick: () => App.go('grammar', { id: next.id }) }, next.t) : null));
};

// ─── Kanji browser ─────────────────────────────────────────────────────────
VIEWS.kanji = (p) => {
  const lv = p.lv || 5;
  const tabs = h('div.tabs', [[5, 'N5'], [4, 'N4']].map(([id, l]) => h('button', { 'aria-selected': lv === id ? 'true' : 'false', onclick: () => App.go('kanji', { lv: id }) }, `${l} · ${KANJI.filter(k => k.lv === id).length}`)));
  const grid = h('div.grid', { style: { gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: '8px' } },
    KANJI.filter(k => k.lv === lv).map(k => { const st = cardStage(S.cards['j:' + k.k]); return h('button.kcell', { onclick: () => openKanji(k.k), 'aria-label': `${k.k} ${k.m}` }, st !== 'new' ? h('span.dot', { 'data-s': st }) : null, h('b', k.k), h('span', { style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' } }, shortM(k.m).split(';')[0])); }));
  return h('div', h('div.track-head', h('div.stack', { style: { gap: '4px' } }, h('button.btn.ghost.sm', { style: { justifySelf: 'start' }, onclick: () => App.go('learn', { track: 'kanji' }) }, icon('back'), 'Kanji path'), h('h1', 'Kanji'), h('p.muted', 'Tap any kanji for stroke order, readings and example words.')), tabs), h('section.card', grid));
};
function openKanji(ch) {
  const k = KANJI_BY[ch]; if (!k) return;
  $$('.pop').forEach(p => p.remove());
  const { box, replay } = strokeBox(ch); const key = 'j:' + ch; const c = S.cards[key];
  const words = VOCAB.filter(v => v.w.includes(ch)).slice(0, 6);
  let close = () => {};
  const dlg = h('div.modal', { role: 'dialog', 'aria-label': ch },
    h('div.row.between', h('h2', `${ch} · ${k.m}`), h('button.icon-btn', { 'aria-label': 'Close', onclick: close }, icon('x'))),
    h('div.teach-hero', h('div.stack', { style: { justifyItems: 'center' } }, box, replay), h('div.stack',
      h('dl.kv', h('dt', 'On'), h('dd.jp', (k.on || []).join('、') || '—'), h('dt', 'Kun'), h('dd.jp', (k.kun || []).join('、') || '—'), h('dt', 'Strokes'), h('dd', String(k.s)), h('dt', 'Level'), h('dd', `N${k.lv}`)),
      h('span.chip.' + cardStage(c), cardStage(c)))),
    k.mn ? h('div.mnemonic', k.mn) : null,
    h('div.stack', { style: { gap: '6px' } }, (k.ex || []).map(e => h('div.row.between.example', { style: { padding: '8px 12px' } }, h('span', h('span.jp', { style: { fontSize: '1.2rem' }, html: ruby(e[0], e[1]) }), h('span.muted.small', ' ' + e[2])), speakBtn(e[1])))),
    words.length ? h('div.stack', { style: { gap: '6px' } }, h('div.eyebrow', 'In your vocabulary list'), h('div.row', words.map(v => h('span.chip', { html: `${ruby(v.w, v.r)} ${esc(shortM(v.m))}` })))) : null,
    h('div.row', h('button.btn.sm', { onclick: () => { close(); App.go('write', { chars: ch }); } }, icon('brush'), 'Write it'), !c ? h('button.btn.sm', { onclick: () => { addCardsFromKeys([key]); toast('Added to reviews'); close(); App.renderNav(); } }, icon('plus'), 'Add to reviews') : null));
  close = openModal(dlg);
}
