// ─── Welcome + adaptive placement test ─────────────────────────────────────
// Sections run in order; a section ends early after 4 misses, and later sections only run when the
// foundations below them were passed. Results skip lessons you already know and trickle those items
// into reviews over the next weeks so the placement is confirmed by real recall.
const PLACEMENT_SECTIONS = [
  { id: 'hira', name: 'Hiragana', n: 8, needs: null },
  { id: 'kata', name: 'Katakana', n: 8, needs: 'hira' },
  { id: 'v5', name: 'N5 vocabulary', n: 10, needs: 'hira' },
  { id: 'j5', name: 'N5 kanji', n: 8, needs: 'v5' },
  { id: 'g5', name: 'N5 grammar', n: 8, needs: 'v5' },
  { id: 'reading', name: 'Reading comprehension', n: 4, needs: 'hira', skill: true },
  { id: 'listening', name: 'Listening comprehension', n: 4, needs: 'hira', skill: true },
  { id: 'speaking', name: 'Speaking & interaction', n: 4, needs: 'hira', skill: true },
  { id: 'writing', name: 'Writing', n: 3, needs: 'hira', skill: true },
  { id: 'v4', name: 'N4 vocabulary', n: 8, needs: 'g5' },
  { id: 'j4', name: 'N4 kanji', n: 6, needs: 'j5' },
  { id: 'g4', name: 'N4 grammar', n: 6, needs: 'g5' },
];
const PASS = 0.75;

function placementItems(sec) {
  const n = sec.n;
  if (sec.id === 'hira' || sec.id === 'kata') {
    const script = sec.id === 'hira' ? 'h' : 'k', base = sec.id === 'hira' ? HIRA : KATA;
    // mostly basic rows, a couple of voiced and combo sounds
    const yoon = YOON_ROWS.flatMap(([, c]) => c.map(x => script === 'h' ? x[0] : x[1]));
    const pool = shuffle(base.slice(0, 46)).slice(0, n - 3).concat(shuffle(base.slice(46)).slice(0, 2), shuffle(yoon).slice(0, 1));
    return shuffle(pool).map(ch => {
      const romaji = KANA_ROMAJI[ch];
      const same = (ch.length > 1 ? YOON_ROWS.flatMap(([, c]) => c.map(x => script === 'h' ? x[0] : x[1])) : base).filter(c => c !== ch && KANA_ROMAJI[c] !== romaji);
      const conf = (KANA_CONFUSE.find(s => s.includes(ch)) || '').split('').filter(c => c !== ch && KANA_ROMAJI[c] && KANA_ROMAJI[c] !== romaji);
      const ds = [...new Set(shuffle(conf).concat(shuffle(same)).map(c => KANA_ROMAJI[c]))].filter(r => r !== romaji).slice(0, 3);
      return { q: 'What sound is this?', big: ch, cls: 'kana', opts: shuffle([romaji, ...ds]), a: romaji, say: ch };
    });
  }
  if (sec.id === 'v5' || sec.id === 'v4') {
    const lv = sec.id === 'v5' ? 5 : 4;
    // sample across categories, skipping counters and set phrases that give themselves away
    const pool = shuffle(VOCAB.filter(v => v.lv === lv && !v.w.startsWith('〜') && v.cat !== 'greet'));
    const seenCat = new Set(), pickd = [];
    for (const v of pool) { if (pickd.length >= n) break; if (seenCat.has(v.cat) && pickd.length < 8) continue; seenCat.add(v.cat); pickd.push(v); }
    return pickd.map(v => ({ q: 'What does this mean?', bigHTML: ruby(v.w, v.r), cls: 'word', opts: shuffle([v, ...vocabDistractors(v)].map(x => shortM(x.m))), a: shortM(v.m), say: v.r, reveal: `${v.w}（${v.r}）` }));
  }
  if (sec.id === 'j5' || sec.id === 'j4') {
    const lv = sec.id === 'j5' ? 5 : 4;
    return shuffle(KANJI.filter(k => k.lv === lv)).slice(0, n).map((k, i) => {
      const ex = (k.ex || [])[0];
      if (i % 2 && ex) { // reading of a real word
        const others = shuffle(KANJI.flatMap(x => x.ex || []).filter(e => e[1] !== ex[1] && Math.abs(e[1].length - ex[1].length) <= 1)).slice(0, 3).map(e => e[1]);
        return { q: 'How is this word read?', big: ex[0], cls: 'word', hint: ex[2], opts: shuffle([ex[1], ...others]), a: ex[1], say: ex[1] };
      }
      return { q: 'What does this kanji mean?', big: k.k, cls: 'kanji', opts: shuffle([k, ...kanjiDistractors(k)].map(x => shortM(x.m))), a: shortM(k.m), say: ex?.[1] };
    });
  }
  // grammar: multiple-choice items from the grammar quizzes of that level
  const lv = sec.id === 'g5' ? 5 : 4;
  const items = GRAMMAR_POINTS.filter(p => p.lv === lv).flatMap(p => (p.quiz || []).filter(q => q.type === 'mc' && q.q.includes('___')).map(q => ({ p, q })));
  const byPoint = new Map(); for (const it of shuffle(items)) if (!byPoint.has(it.p.id)) byPoint.set(it.p.id, it);
  return shuffle([...byPoint.values()]).slice(0, n).map(({ p, q }) => ({ q: q.en ? `Fill the gap · ${q.en}` : 'Fill the gap', big: q.q.replace('___', '＿＿'), cls: 'sentence', opts: shuffle(q.opts.slice()), a: q.a, say: q.q.replace('___', q.a), point: p.id }));
}

VIEWS.welcome = () => {
  const art = DATA.images?.placement || DATA.images?.hero;
  return h('div',
    h('section.hero.welcome', art ? h('img.scene', { src: art, alt: '', style: { opacity: .55 } }) : null,
      h('div.stack', { style: { gap: '14px', maxWidth: '560px' } },
        h('div.eyebrow', { style: { color: 'rgb(255 255 255 / .8)' } }, 'ようこそ · Welcome to Michi'),
        h('h1', { style: { fontFamily: 'var(--f-jp-hand)', fontWeight: 600, fontSize: 'clamp(2rem, 6vw, 3rem)' } }, '日本語の道へ'),
        h('p', 'The path to Japanese, from your first あ to reading short stories and talking with Sensei. Tell us where you are and Michi builds your route.'))),
    h('div.grid.g3',
      h('button.scenario.start-opt', { onclick: () => { S.placement = { at: now(), level: 'new', skipped: true }; save(); App.go('home'); } },
        h('span.hanko', 'あ'), h('h3', 'I\'m brand new'), h('p.muted.small', 'Start at the very beginning with hiragana. About 10 minutes a day gets you reading in two weeks.')),
      h('button.scenario.start-opt', { onclick: () => App.go('placement') },
        h('span.hanko', '試'), h('h3', 'I know some Japanese'), h('p.muted.small', 'Take the placement test: 5–10 minutes, adapts as you go, and skips everything you already know.')),
      h('button.scenario.start-opt', { onclick: () => App.go('placement', { quick: 'kana' }) },
        h('span.hanko', 'か'), h('h3', 'I only know kana'), h('p.muted.small', 'A 2-minute kana check, then straight into vocabulary and kanji.'))),
    h('p.muted.small', { style: { textAlign: 'center' } }, 'You can retake the placement test any time from Settings.'));
};

const SKILL_LV = ['k', 'n5a', 'n5b', 'n4'];
const SKILL_LV_NAME = ['Kana', 'Early N5', 'Solid N5', 'N4'];
const normJa = s => toHira(String(s || '')).replace(/[\s　。、．，,.!?！？「」『』・ー〜~]/g, '').replace(/は(?=$)/, 'は');
// Adaptive skill section: start near the learner's estimated level, step up after a success, down after a miss.
function skillPicker(skill, startIdx) {
  const bank = (DATA.placement?.[skill] || []).slice(); const used = new Set(); let lv = startIdx;
  return {
    get lv() { return lv; },
    next() {
      for (const d of [0, -1, 1, -2, 2, -3, 3]) { const i = lv + d; if (i < 0 || i > 3) continue; const pool = shuffle(bank.filter(x => x.lv === SKILL_LV[i] && !used.has(x.id))); if (pool.length) { used.add(pool[0].id); return Object.assign({ _lv: i }, pool[0]); } }
      return null;
    },
    step(score) { lv = clamp(lv + (score >= 1 ? 1 : score > 0 ? 0 : -1), 0, 3); },
  };
}
function skillValue(log) { // log: [{lv, score}] → 0..4
  let best = 0;
  for (const e of log) if (e.score >= 1) best = Math.max(best, e.lv + 1); else if (e.score > 0) best = Math.max(best, e.lv + 0.5);
  const fails = log.filter(e => e.score === 0 && e.lv + 1 <= best).length;
  return clamp(best - fails * 0.5, 0, 4);
}
function gradeWriting(it, input) {
  const v = normJa(input); if (!v) return 0;
  if ((it.answers || []).some(a => normJa(a) === v)) return 1;
  const keys = (it.keys || []).map(normJa); const hit = keys.filter(k => v.includes(k)).length;
  return keys.length && hit === keys.length ? 0.75 : hit / Math.max(1, keys.length) >= 0.5 ? 0.4 : 0;
}

VIEWS.placement = (p) => {
  const hasBank = !!DATA.placement;
  const secs = p.quick === 'kana' ? PLACEMENT_SECTIONS.slice(0, 2) : PLACEMENT_SECTIONS.filter(s => !s.skill || hasBank);
  const results = {}; let si = -1, items = [], qi = 0, misses = 0, right = 0, picker = null, log = [];
  const wrap = h('div.study'); const bar = h('i'); const label = h('span.muted.small');
  const stage = h('div');
  const totalQ = secs.reduce((a, s) => a + s.n, 0); let answeredQ = 0;
  wrap.append(h('div.stack', { style: { gap: '4px' } }, h('div.eyebrow', '実力テスト · Placement test'), h('h1', { style: { fontSize: '1.6rem' } }, 'Find your level')),
    h('div.study-top', h('button.icon-btn', { 'aria-label': 'Leave the test', onclick: () => App.go(Object.keys(S.cards).length ? 'settings' : 'welcome') }, icon('x')), h('div.bar', bar), label), stage);
  const estimate = () => (results.v5?.pct >= PASS && results.g5?.pct >= PASS) ? 2 : (results.v5?.pct >= 0.5 || results.g5?.pct >= 0.5) ? 1 : 0;
  const sec = () => secs[si];
  const nextSection = () => {
    if (si >= 0) {
      const S0 = sec();
      results[S0.id] = S0.skill ? { right: log.filter(e => e.score >= 1).length, n: log.length, pct: log.length ? log.reduce((a, e) => a + e.score, 0) / log.length : 0, level: skillValue(log), log } : { right, n: qi, pct: qi ? right / qi : 0, stoppedEarly: qi < items.length };
    }
    do { si++; } while (si < secs.length && secs[si].needs && !(results[secs[si].needs]?.pct >= PASS));
    if (si >= secs.length) return p.quick ? finish() : canDo();
    qi = 0; misses = 0; right = 0; log = [];
    if (sec().skill) { picker = skillPicker(sec().id, estimate()); items = []; }
    else { items = placementItems(sec()); if (!items.length) return nextSection(); }
    stage.replaceChildren(h('div.qcard', h('div.result-hero', h('div.eyebrow', `Section ${si + 1} of ${secs.length}`), h('h2', sec().name), h('p.muted', { style: { maxWidth: '46ch' } }, sectionBlurb(sec().id)), h('button.btn.primary', { onclick: ask }, 'Begin', h('span.kbd', 'Enter')))));
    setTimeout(() => stage.querySelector('.btn.primary')?.focus(), 30);
  };
  const progress = () => { bar.style.width = `${Math.min(99, answeredQ / totalQ * 100)}%`; label.textContent = `${sec().name} · ${qi + 1}/${sec().skill ? sec().n : items.length}`; };
  const idk = fn => h('div.row', { style: { justifyContent: 'center' } }, h('button.btn.ghost.sm.idk', { onclick: fn }, 'I don\'t know'));
  const ask = () => {
    if (sec().skill) return askSkill();
    if (qi >= items.length || misses >= 4) { answeredQ += items.length - qi; return nextSection(); }
    const it = items[qi]; progress();
    const big = h('div.qbig' + (it.cls === 'kana' || it.cls === 'kanji' ? '.gridpaper' : ''), it.bigHTML ? h('div.word', { html: it.bigHTML }) : h('div.' + (it.cls === 'sentence' ? 'word' : it.cls), { style: it.cls === 'sentence' ? { fontSize: 'clamp(1.4rem, 4.5vw, 2rem)' } : null }, it.big), it.hint ? h('div.hint', it.hint) : null);
    let done = false;
    const choose = (opt, btn) => {
      if (done) return; done = true;
      const ok = opt === it.a; qi++; answeredQ++;
      if (ok) right++; else misses++;
      $$('.opt', stage).forEach(b => { b.disabled = true; if (b.dataset.v === it.a) b.classList.add('right'); });
      if (btn && !ok) btn.classList.add('wrong');
      setTimeout(ask, ok ? 350 : 900); // keep the test brisk
    };
    const opts = h('div.opts', it.opts.map((o, i) => { const b = h('button.opt' + (it.cls === 'kanji' || it.q.startsWith('How') || it.cls === 'sentence' ? '.bigopt' : ''), { 'data-v': o, style: it.cls === 'sentence' ? { fontSize: '1.3rem' } : null, onclick: () => choose(o, b) }, h('span.k', String(i + 1)), o); return b; }));
    stage.replaceChildren(h('div.qcard', h('div.q', it.q), big, opts, idk(() => choose(null, null))));
  };
  // Reading / listening / speaking / writing items (adaptive).
  const askSkill = () => {
    if (log.length >= sec().n) return nextSection();
    const it = picker.next(); if (!it) { answeredQ += sec().n - log.length; return nextSection(); }
    progress();
    let done = false; const fb = h('div');
    const record = (score, detail) => {
      if (done) return; done = true; qi++; answeredQ++; log.push({ lv: it._lv, score }); picker.step(score);
      score >= 1 ? Sfx.ok() : score > 0 ? Sfx.tick() : Sfx.bad();
      const nb = h('button.btn.primary', { onclick: askSkill }, 'Next', h('span.kbd', 'Enter'));
      fb.replaceChildren(h('div.feedback.' + (score >= 1 ? 'ok' : 'no'), h('strong', score >= 1 ? '正解！' : score > 0 ? 'Partly there' : 'Not quite'), detail || null, h('div.row', { style: { justifyContent: 'flex-end' } }, nb)));
      setTimeout(() => nb.focus(), 30);
    };
    const mc = (opts, a, render = o => o) => {
      const box = h('div.opts', opts.map((o, i) => { const b = h('button.opt', { onclick: () => { if (done) return; box.querySelectorAll('.opt').forEach((x, j) => { x.disabled = true; if (j === a) x.classList.add('right'); }); if (i !== a) b.classList.add('wrong'); record(i === a ? 1 : 0, null); } }, h('span.k', String(i + 1)), render(o, i)); return b; }));
      return box;
    };
    const kind = sec().id; let body;
    if (kind === 'reading') {
      const passage = h('div.passage.jp', { lang: 'ja' }, it.text);
      const reveal = h('div.muted.small.jp', { hidden: true }, it.fu);
      body = [h('div.eyebrow', it.kind || 'Read'), passage, h('button.btn.sm.ghost', { onclick: e => { reveal.hidden = false; e.currentTarget.remove(); } }, 'Show readings'), reveal, h('div.q', { style: { textAlign: 'left' } }, it.q), mc(it.opts, it.a)];
    } else if (kind === 'listening') {
      let plays = 0; const playBtn = h('button.btn.primary', { style: { width: '84px', height: '84px', borderRadius: '50%' }, 'aria-label': 'Play the conversation' }, icon('speaker'));
      const count = h('div.muted.small', 'Listen (you can replay twice)');
      const play = async () => { if (plays >= 3) return; plays++; playBtn.disabled = true; for (const l of it.lines) { await Voice.say(l.jp, { tts: l.fu }); await new Promise(r => setTimeout(r, 350)); } playBtn.disabled = plays >= 3; count.textContent = plays >= 3 ? 'No replays left' : `Replays left: ${3 - plays}`; };
      playBtn.onclick = play; setTimeout(play, 300);
      body = [h('div.qbig', playBtn, count), h('div.q', it.q), mc(it.opts, it.a)];
    } else if (kind === 'speaking') {
      const a = it.opts.findIndex(o => o.ok);
      body = [h('div.scene-line', h('span.hanko', { style: { width: '40px', height: '40px', fontSize: '1.1rem' } }, '話'), h('div', it.scene)),
        it.prompt ? h('div.example', h('div.row.between', { style: { flexWrap: 'nowrap' } }, h('span.jp', { style: { fontSize: '1.3rem' } }, it.prompt.jp), speakBtn(it.prompt.jp, 'Play', it.prompt.fu))) : null,
        h('div.q', 'What do you say?'),
        mc(it.opts, a, o => h('span.jp', { style: { fontSize: '1.15rem' } }, o.jp))];
      if (it.prompt) setTimeout(() => Voice.say(it.prompt.jp, { tts: it.prompt.fu }), 250);
      // after the choice, show why each reply fits or doesn't
      setTimeout(() => { const box = stage.querySelector('.opts'); box && box.querySelectorAll('.opt').forEach((b, i) => b.addEventListener('click', () => { const why = it.opts.map(o => h('div.small', h('b', o.ok ? '✓ ' : '✗ '), h('span.jp', o.jp), ' — ', o.why)); fb.querySelector('.feedback')?.insertBefore(h('div.stack', { style: { gap: '4px', color: 'var(--ink)' } }, why), fb.querySelector('.feedback .row')); })); }, 0);
    } else { // writing
      const inp = h('input#placeWrite', { type: 'text', autocomplete: 'off', spellcheck: 'false', lang: 'ja', placeholder: 'type romaji → かな', 'aria-label': 'Your Japanese' }); bindIME(inp);
      const regChip = h('span.chip' + (it.reg === 'casual' ? '.learning' : '.new'), it.reg === 'casual' ? 'casual' : 'polite');
      body = [h('div.row', h('span.hanko', { style: { width: '40px', height: '40px', fontSize: '1.1rem' } }, '書'), regChip), h('div', { style: { fontSize: '1.2rem', fontWeight: 700 } }, it.prompt),
        h('form.typein', { onsubmit: e => { e.preventDefault(); if (done || !inp.value.trim()) return; const sc = gradeWriting(it, inp.value); inp.readOnly = true; inp.classList.add(sc >= 1 ? 'right' : sc > 0 ? 'right' : 'wrong'); record(sc, h('div.ans', h('span', 'Model answer: '), h('span.jp', { html: it.model?.jp ? esc(it.model.jp) : esc(it.answers[0]) }), ' ', speakBtn(it.model?.jp || it.answers[0], 'Play', it.model?.fu))); } }, inp, h('button.btn.primary', 'Check')),
        h('p.muted.small', 'Type in romaji; it turns into kana. Kanji are not needed.')];
      setTimeout(() => inp.focus(), 50);
    }
    stage.replaceChildren(h('div.qcard.skill-q', body, idk(() => { if (done) return; stage.querySelectorAll('.opt').forEach(b => b.disabled = true); record(0, null); }), fb));
  };
  // Self-assessment: "I can…" statements refine the four skill scores.
  const canDo = () => {
    const bank = DATA.placement?.cando || []; if (!bank.length) return finish();
    const est = SKILL_LV[Math.max(0, estimate())];
    const chosen = ['reading', 'listening', 'speaking', 'writing'].map(sk => shuffle(bank.filter(c => c.skill === sk)).sort((x, y) => (x.lv === est ? -1 : 0) - (y.lv === est ? -1 : 0))[0]).filter(Boolean);
    const answers = {};
    const render = () => stage.replaceChildren(h('div.qcard.stack', h('div.eyebrow', 'Last step · 30 seconds'), h('h2', 'How do these feel?'), h('p.muted', 'Be honest. This fine-tunes your speaking and writing scores, which a quiz can only partly measure.'),
      chosen.map(c => h('div.cando', h('div', c.text), h('div.tabs', [['yes', 'I can'], ['some', 'Sort of'], ['no', 'Not yet']].map(([v, l]) => h('button', { 'aria-selected': answers[c.id] === v ? 'true' : 'false', onclick: () => { answers[c.id] = v; render(); } }, l))))),
      h('div.row', { style: { justifyContent: 'flex-end' } }, h('button.btn.primary', { disabled: Object.keys(answers).length < chosen.length ? true : null, onclick: () => { chosen.forEach(c => { const r = results[c.skill]; if (r) r.level = clamp(r.level + ({ yes: 0.4, some: 0, no: -0.4 })[answers[c.id]], 0, 4); }); finish(); } }, 'See my results'))));
    render();
  };
  const onKey = e => {
    if (e.target.tagName === 'INPUT') return;
    if (/^[1-4]$/.test(e.key)) { const b = $$('.opt', stage)[+e.key - 1]; b && !b.disabled && b.click(); }
    else if (e.key === 'Enter') { const b = stage.querySelector('.result-hero .btn.primary, .feedback .btn.primary'); if (b) { e.preventDefault(); b.click(); } }
    else if (e.key === '0' || e.key === '?') { const b = stage.querySelector('.idk'); b && b.click(); }
  };
  document.addEventListener('keydown', onKey); App.cleanup = () => document.removeEventListener('keydown', onKey);
  const finish = () => {
    bar.style.width = '100%'; label.textContent = 'Done';
    const place = applyPlacement(results, p.quick);
    Sfx.done(); petals(20);
    const rows = secs.filter(s => !s.skill).map(s => { const r = results[s.id]; return h('div.stack', { style: { gap: '4px' } }, h('div.row.between', h('b', s.name), h('span.muted.small', r ? `${r.right}/${r.n}${r.stoppedEarly ? ' · stopped early' : ''}` : 'not tested')), h('div.bar' + (r?.pct >= PASS ? '.ok' : ''), h('i', { style: { width: `${(r?.pct || 0) * 100}%` } }))); });
    stage.replaceChildren(h('div.qcard', h('div.result-hero',
      h('span.hanko.stamp', place.glyph), h('div.eyebrow', 'Your level'), h('h2', { style: { fontSize: '1.6rem' } }, place.title), h('p.muted', { style: { maxWidth: '48ch' } }, place.text)),
      skillProfileCard(S.placement.profile),
      h('details', h('summary', { style: { cursor: 'pointer', fontWeight: 700 } }, 'Section scores'), h('div.stack', { style: { marginTop: '10px' } }, rows)),
      place.placed.length ? h('div.mnemonic', h('b', 'Skipped for you: '), place.placed.join(', '), '. Those items will appear in your reviews over the next few weeks so we can confirm you really know them.') : null,
      h('div.row', { style: { justifyContent: 'center' } }, place.next ? h('button.btn.primary', { onclick: () => App.go('lesson', { id: place.next.id }) }, `Start: ${place.next.title}`) : null, h('button.btn', { onclick: () => App.go('home') }, 'Go to Today'))));
    window.Fun?.event?.('placement', { level: S.placement.level });
  };
  nextSection();
  return wrap;
};
// Radar chart of the eight skills on a 0–4 scale (kana · early N5 · solid N5 · N4).
const PROFILE_AXES = [['kana', 'Kana'], ['vocab', 'Vocabulary'], ['grammar', 'Grammar'], ['kanji', 'Kanji'], ['reading', 'Reading'], ['listening', 'Listening'], ['speaking', 'Speaking'], ['writing', 'Writing']];
function buildProfile(r) {
  const pc = id => r[id]?.pct || 0;
  const two = (a, b) => clamp((r[a] ? pc(a) * 3 : 0) + (r[b] ? pc(b) : 0), 0, 4);
  const lv = id => r[id]?.level;
  return { kana: clamp((pc('hira') + pc('kata')) * 2, 0, 4), vocab: two('v5', 'v4'), grammar: two('g5', 'g4'), kanji: two('j5', 'j4'), reading: lv('reading'), listening: lv('listening'), speaking: lv('speaking'), writing: lv('writing') };
}
function skillProfileCard(pr) {
  if (!pr) return null;
  const axes = PROFILE_AXES.filter(([k]) => pr[k] != null); if (axes.length < 3) return null;
  const W = 320, cx = 160, cy = 150, R = 105, n = axes.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * R * v / 4, cy + Math.sin(a) * R * v / 4]; };
  let g = '';
  for (let ring = 1; ring <= 4; ring++) g += `<polygon points="${axes.map((_, i) => pt(i, ring).join(',')).join(' ')}" fill="none" stroke="var(--line)" stroke-width="${ring === 4 ? 1.2 : .8}"/>`;
  axes.forEach((_, i) => { const [x, y] = pt(i, 4); g += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line)" stroke-width=".8"/>`; });
  const poly = axes.map(([k], i) => pt(i, Math.max(0.15, pr[k])).join(',')).join(' ');
  g += `<polygon points="${poly}" fill="var(--ai)" fill-opacity=".22" stroke="var(--ai)" stroke-width="2.2" stroke-linejoin="round"/>`;
  axes.forEach(([k, label], i) => { const [x, y] = pt(i, Math.max(0.15, pr[k])); g += `<circle cx="${x}" cy="${y}" r="3.6" fill="var(--seal)"/>`; const [lx, ly] = pt(i, 4.75); g += `<text x="${lx}" y="${ly + 4}" text-anchor="${Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end'}">${label}</text>`; });
  const lvName = v => v >= 3.5 ? 'N4' : v >= 2.5 ? 'Solid N5' : v >= 1.5 ? 'Early N5' : v >= 0.75 ? 'Kana' : 'Starting';
  return h('div.profile', h('div.radar-wrap', { html: `<svg class="chart radar" viewBox="-40 -10 ${W + 80} 300" role="img" aria-label="Skill profile radar chart">${g}</svg>` }),
    h('div.profile-list', axes.map(([k, label]) => h('div.row.between', h('span', label), h('span.chip' + (pr[k] >= 2.5 ? '.young' : pr[k] >= 1 ? '.learning' : ''), lvName(pr[k]))))));
}
function sectionBlurb(id) {
  return {
    hira: 'Read each hiragana. Guessing hurts your placement, so use “I don\'t know” freely.', kata: 'Now katakana, the script for loanwords like コーヒー.', v5: 'Everyday words from JLPT N5.', j5: 'Meanings and readings of basic kanji.', g5: 'Pick the particle or form that completes the sentence.', v4: 'Harder vocabulary from JLPT N4.', j4: 'N4 kanji.', g4: 'N4 grammar: conditionals, giving and receiving, the passive.',
    reading: 'Real-life Japanese: signs, messages, menus and short notes. Read, then answer in English. Questions get harder as you get them right.',
    listening: 'Short conversations read by a native voice, with no text on screen. You can replay each one twice.',
    speaking: 'Pick what you would actually say. It checks meaning and also register: casual with friends, polite with staff and strangers.',
    writing: 'Write short sentences in Japanese. Romaji turns into kana as you type, and partial answers get partial credit.',
  }[id] || '';
}
// Mark known material as done and schedule it to resurface gradually.
function applyPlacement(r, quick) {
  const ok = id => r[id]?.pct >= PASS, t = now(); const placed = [];
  const seed = (keys, spreadDays) => {
    spreadDays = Math.max(spreadDays, keys.length / 12); let n = 0; for (const k of keys) if (!S.cards[k]) {
      const c = FSRS.review(null, 3, t); c.s = Math.max(c.s, 6); c.due = t + (1 + Math.random() * spreadDays) * DAY; S.cards[k] = c; n++;
    } return n;
  };
  const markLessons = pred => LESSONS.filter(pred).forEach(l => { if (!S.lessons[l.id]) S.lessons[l.id] = { done: t, best: 1, placed: true }; });
  if (ok('hira')) { markLessons(l => l.id.startsWith('kana-h')); seed(HIRA.map(c => 'h:' + c).concat(YOON_ROWS.flatMap(([, c]) => c.map(x => 'h:' + x[0]))), 10); placed.push('hiragana'); }
  if (ok('kata')) { markLessons(l => l.id.startsWith('kana-k')); seed(KATA.map(c => 'k:' + c).concat(YOON_ROWS.flatMap(([, c]) => c.map(x => 'k:' + x[1]))), 14); placed.push('katakana'); }
  if (ok('v5')) { markLessons(l => l.track === 'vocab' && l.level === 'N5'); seed(VOCAB.filter(v => v.lv === 5).map(v => 'v:' + v.id), 35); placed.push('N5 vocabulary'); }
  if (ok('j5')) { markLessons(l => l.track === 'kanji' && l.level === 'N5'); seed(KANJI.filter(k => k.lv === 5).map(k => 'j:' + k.k), 30); placed.push('N5 kanji'); }
  if (ok('g5')) { GRAMMAR_POINTS.filter(p => p.lv === 5).forEach(p => { if (!S.grammar[p.id]) S.grammar[p.id] = { done: t, score: 0, placed: true }; }); placed.push('N5 grammar'); }
  if (ok('v4')) { markLessons(l => l.track === 'vocab' && l.level === 'N4'); seed(VOCAB.filter(v => v.lv === 4).map(v => 'v:' + v.id), 45); placed.push('N4 vocabulary'); }
  if (ok('j4')) { markLessons(l => l.track === 'kanji' && l.level === 'N4'); seed(KANJI.filter(k => k.lv === 4).map(k => 'j:' + k.k), 40); placed.push('N4 kanji'); }
  if (ok('g4')) { GRAMMAR_POINTS.filter(p => p.lv === 4).forEach(p => { if (!S.grammar[p.id]) S.grammar[p.id] = { done: t, score: 0, placed: true }; }); placed.push('N4 grammar'); }
  const lvl = ok('g4') && ok('v4') ? 'n4+' : ok('v5') && ok('g5') ? 'n4' : ok('v5') || ok('g5') ? 'n5b' : ok('kata') ? 'n5' : ok('hira') ? 'kana' : 'new';
  const info = {
    new: ['入', 'Starting fresh', 'Hiragana first. Each lesson takes about five minutes, and you will be reading words within days.'],
    kana: ['仮', 'Hiragana reader', 'Your hiragana is solid. Katakana is next, alongside your first words.'],
    n5: ['五', 'Ready for N5', 'Both kana scripts are down. Time to build vocabulary, kanji and grammar together.'],
    n5b: ['五', 'N5 in progress', 'You know a good part of N5. Your path fills the gaps first.'],
    n4: ['四', 'N5 complete, heading to N4', 'N5 is solid. Your path now focuses on N4 vocabulary, kanji and grammar.'],
    'n4+': ['四', 'Upper N4', 'Strong across the board. Keep your reviews up, read the N4 stories and push your speaking with Sensei.'],
  }[lvl];
  const profile = buildProfile(r);
  S.placement = { at: t, level: lvl, results: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { right: v.right, n: v.n, pct: v.pct, level: v.level }])), profile }; S.settings.level = lvl;
  save(); addXP(20); App.renderNav();
  return { glyph: info[0], title: info[1], text: info[2], placed, next: nextLesson() };
}
