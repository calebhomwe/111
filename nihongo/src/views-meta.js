// ─── Progress, achievements, dictionary, settings, boot ───────────────────
const ACHIEVEMENTS = [
  { id: 'first', g: '初', t: 'First step', d: 'Finish your first lesson', test: () => Object.keys(S.lessons).length >= 1 },
  { id: 'hira', g: 'あ', t: 'Hiragana complete', d: 'Learn all 46 basic hiragana', test: () => HIRA.every(c => S.cards['h:' + c]) },
  { id: 'kata', g: 'ア', t: 'Katakana complete', d: 'Learn all 46 basic katakana', test: () => KATA.every(c => S.cards['k:' + c]) },
  { id: 'v100', g: '百', t: '100 words', d: 'Have 100 words in your reviews', test: () => Object.keys(S.cards).filter(k => k[0] === 'v').length >= 100 },
  { id: 'v500', g: '語', t: '500 words', d: 'Have 500 words in your reviews', test: () => Object.keys(S.cards).filter(k => k[0] === 'v').length >= 500 },
  { id: 'k50', g: '漢', t: '50 kanji', d: 'Learn 50 kanji', test: () => Object.keys(S.cards).filter(k => k[0] === 'j').length >= 50 },
  { id: 's3', g: '三', t: 'Three-day streak', d: 'Study three days in a row', test: () => streak() >= 3 },
  { id: 's7', g: '週', t: 'Week streak', d: 'Study seven days in a row', test: () => streak() >= 7 },
  { id: 's30', g: '月', t: 'Month streak', d: 'Study thirty days in a row', test: () => streak() >= 30 },
  { id: 'r1', g: '読', t: 'First story', d: 'Finish a graded reader', test: () => Object.keys(S.stories).length >= 1 },
  { id: 'r5', g: '本', t: 'Bookworm', d: 'Finish five stories', test: () => Object.keys(S.stories).length >= 5 },
  { id: 'g10', g: '文', t: 'Grammar apprentice', d: 'Complete 10 grammar points', test: () => Object.keys(S.grammar).length >= 10 },
  { id: 'n5g', g: '五', t: 'N5 grammar', d: 'Complete every N5 grammar point', test: () => GRAMMAR_POINTS.filter(p => p.lv === 5).every(p => S.grammar[p.id]) && GRAMMAR_POINTS.length > 0 },
  { id: 'mature', g: '熟', t: 'Deep roots', d: 'Get 50 cards to a 3-week interval', test: () => Object.values(S.cards).filter(c => c.s >= 21).length >= 50 },
  { id: 'xp1k', g: '千', t: '1,000 XP', d: 'Earn 1,000 XP', test: () => S.xp >= 1000 },
  { id: 'blitz', g: '速', t: 'Speed reader', d: 'Score 300 in Kana Blitz', test: () => (S.blitzBest || 0) >= 300 },
];
function checkAchievements() {
  for (const a of ACHIEVEMENTS) if (!S.ach[a.id]) { let ok = false; try { ok = a.test(); } catch (e) {} if (ok) { S.ach[a.id] = now(); save(); toast(`Achievement: ${a.t}`); } }
}

VIEWS.stats = () => {
  const cards = Object.entries(S.cards);
  const counts = { learning: 0, young: 0, mature: 0, mastered: 0 }; cards.forEach(([, c]) => counts[cardStage(c)] = (counts[cardStage(c)] || 0) + 1);
  // retention over the last 30 days
  let rev = 0, ok = 0; for (let i = 0; i < 30; i++) { const d = S.days[dayKey(now() - i * DAY)]; if (d) { rev += d.rev || 0; ok += d.ok || 0; } }
  const ret = rev ? Math.round(ok / rev * 100) : null;
  // forecast next 14 days
  const fc = Array(14).fill(0); const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  cards.forEach(([, c]) => { const d = Math.floor((c.due - t0.getTime()) / DAY); if (d < 14) fc[Math.max(0, d)]++; });
  const max = Math.max(4, ...fc); const W = 560, H = 180, bw = (W - 40) / 14;
  const niceMax = Math.ceil(max / 4) * 4;
  const bars = fc.map((n, i) => `<rect x="${32 + i * bw + 3}" y="${H - 24 - (n / niceMax) * (H - 44)}" width="${bw - 6}" height="${Math.max(n ? 2 : 0, (n / niceMax) * (H - 44))}" rx="3" fill="${i === 0 ? 'var(--seal)' : 'var(--ai)'}"/>` + (n ? `<text x="${32 + i * bw + bw / 2}" y="${H - 28 - (n / niceMax) * (H - 44)}" text-anchor="middle">${n}</text>` : ''));
  const ticks = [0, niceMax / 2, niceMax].map(v => `<line x1="30" x2="${W}" y1="${H - 24 - v / niceMax * (H - 44)}" y2="${H - 24 - v / niceMax * (H - 44)}" stroke="var(--line)" stroke-dasharray="${v ? '3 4' : ''}"/><text x="24" y="${H - 20 - v / niceMax * (H - 44)}" text-anchor="end">${v}</text>`);
  const labels = fc.map((_, i) => i % 2 === 0 ? `<text x="${32 + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${i === 0 ? 'today' : '+' + i + 'd'}</text>` : '');
  const chart = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Reviews due over the next 14 days">${ticks.join('')}${bars.join('')}${labels.join('')}</svg>`;
  // 30-day XP line
  const xs = Array.from({ length: 30 }, (_, i) => S.days[dayKey(now() - (29 - i) * DAY)]?.xp || 0); const xmax = Math.max(10, ...xs);
  const pts = xs.map((v, i) => [30 + i * (W - 40) / 29, H - 24 - v / xmax * (H - 44)]);
  const line = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="XP per day, last 30 days"><line x1="30" x2="${W}" y1="${H - 24}" y2="${H - 24}" stroke="var(--line)"/><text x="24" y="${H - 20}" text-anchor="end">0</text><text x="24" y="24" text-anchor="end">${xmax}</text><line x1="30" x2="${W}" y1="20" y2="20" stroke="var(--line)" stroke-dasharray="3 4"/><path d="M${pts.map(p => p.join(',')).join('L')}L${pts[29][0]},${H - 24}L30,${H - 24}Z" fill="var(--ai)" opacity=".12"/><path d="M${pts.map(p => p.join(',')).join('L')}" fill="none" stroke="var(--ai)" stroke-width="2.5" stroke-linejoin="round"/><circle cx="${pts[29][0]}" cy="${pts[29][1]}" r="4.5" fill="var(--seal)"/><text x="30" y="${H - 6}">30 days ago</text><text x="${W}" y="${H - 6}" text-anchor="end">today</text></svg>`;
  const trackRow = (label, keys) => { const n = keys.length, learned = keys.filter(k => S.cards[k]).length, mat = keys.filter(k => S.cards[k]?.s >= 21).length; return h('div.stack', { style: { gap: '4px' } }, h('div.row.between', h('b', label), h('span.muted.small', `${learned}/${n} learned · ${mat} mature`)), h('div.bar', { style: { height: '10px', position: 'relative' } }, h('i', { style: { width: `${learned / n * 100}%`, opacity: .45 } }), h('i', { style: { width: `${mat / n * 100}%`, position: 'absolute', left: 0, top: 0, background: 'var(--ok)' } }))); };
  const lv = levelInfo();
  return h('div',
    h('div.stack', { style: { gap: '4px' } }, h('div.eyebrow', '進歩 · Progress'), h('h1', 'Your progress')),
    h('section.stat-tiles', h('div.tile', h('b', `Lv ${lv.level}`), h('span', `${S.xp.toLocaleString()} XP total`)), h('div.tile', h('b', String(streak())), h('span', 'day streak')), h('div.tile', h('b', ret == null ? '—' : ret + '%'), h('span', 'first-try accuracy, 30 days')), h('div.tile', h('b', String(cards.length)), h('span', 'cards in rotation'))),
    h('div.grid.g2', h('section.card.stack', h('h3', 'Reviews due, next 14 days'), h('div', { html: chart })), h('section.card.stack', h('h3', 'XP per day'), h('div', { html: line }))),
    h('section.card.stack', h('h3', 'Coverage'), h('div.legend', h('span', h('i', { style: { background: 'var(--ai)', opacity: .45 } }), 'learned'), h('span', h('i', { style: { background: 'var(--ok)' } }), 'mature (3-week+ interval)')),
      trackRow('Hiragana', HIRA.map(c => 'h:' + c)), trackRow('Katakana', KATA.map(c => 'k:' + c)),
      trackRow('JLPT N5 vocabulary', VOCAB.filter(v => v.lv === 5).map(v => 'v:' + v.id)), trackRow('JLPT N4 vocabulary', VOCAB.filter(v => v.lv === 4).map(v => 'v:' + v.id)),
      trackRow('N5 kanji', KANJI.filter(k => k.lv === 5).map(k => 'j:' + k.k)), trackRow('N4 kanji', KANJI.filter(k => k.lv === 4).map(k => 'j:' + k.k))),
    h('section.stat-tiles', Object.entries(counts).map(([s, n]) => h('div.tile', h('b', String(n)), h('span.chip.' + s, s)))),
    h('section.stack', h('h2', '実績 · Achievements'), h('div.ach', ACHIEVEMENTS.map(a => h('div.a' + (S.ach[a.id] ? '' : '.off'), h('span.hanko' + (S.ach[a.id] ? '' : '.off'), { style: { width: '44px', height: '44px', fontSize: '1.2rem' } }, a.g), h('div', h('b', a.t), h('div.muted.small', a.d)))))),
    heatmapCard());
};

VIEWS.dict = (p) => {
  const inp = h('input#dictQ', { type: 'search', placeholder: 'Search English, romaji, kana or kanji', 'aria-label': 'Search the dictionary', value: p.q || '' });
  const out = h('div.results');
  const run = () => {
    const q = inp.value.trim().toLowerCase(); out.innerHTML = '';
    if (!q) { out.append(h('p.muted', `${VOCAB.length.toLocaleString()} words, ${KANJI.length} kanji and ${GRAMMAR_POINTS.length} grammar points. Try “eat”, “taberu”, “たべる” or “食”.`)); return; }
    const qk = /[a-z]/.test(q) && window.wanakana ? wanakana.toHiragana(q) : toHira(q);
    const score = v => { const m = v.m.toLowerCase(); if (v.w === q || v.r === qk) return 0; if (m.split(/;\s*/).some(x => x === q || x === 'to ' + q)) return 1; if (v.r.startsWith(qk) || v.w.startsWith(q)) return 2; if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(m)) return 3; if (v.w.includes(q) || v.r.includes(qk)) return 4; return 9; };
    const words = VOCAB.map(v => [score(v), v]).filter(([s]) => s < 9).sort((a, b) => a[0] - b[0]).slice(0, 40).map(([, v]) => v);
    const kanji = KANJI.filter(k => k.k === q || q.includes(k.k) || k.m.toLowerCase().split(/;\s*/).some(x => x.startsWith(q))).slice(0, 8);
    const gram = GRAMMAR_POINTS.filter(g => g.t.includes(q) || g.sum.toLowerCase().includes(q)).slice(0, 5);
    if (kanji.length) out.append(h('div.row', kanji.map(k => h('button.chip', { style: { fontSize: '.95rem', padding: '6px 12px', cursor: 'pointer', border: 0 }, onclick: () => openKanji(k.k) }, h('b.jp', { style: { fontSize: '1.3rem' } }, k.k), ' ' + shortM(k.m)))));
    gram.forEach(g => out.append(h('button.res', { style: { textAlign: 'left' }, onclick: () => App.go('grammar', { id: g.id }) }, h('span.w', { style: { fontSize: '1rem' } }, g.t), h('div', h('b', 'Grammar'), h('div.muted.small', g.sum)), h('span.chip', `N${g.lv}`))));
    words.forEach(v => { const key = 'v:' + v.id; const c = S.cards[key];
      out.append(h('div.res', h('span.w', { html: ruby(v.w, v.r) }), h('div', { style: { minWidth: 0 } }, h('b', v.m), h('div.muted.small', `${v.r}${S.settings.romaji ? ' · ' + kanaToRomaji(v.r) : ''} · ${POS_NAME[v.pos] || v.pos} · N${v.lv}`), v.ex ? h('div.small.jp', { style: { marginTop: '2px' } }, v.ex) : null),
        h('div.row', { style: { gap: '6px', flexWrap: 'nowrap' } }, speakBtn(v.r), c ? h('span.chip.' + cardStage(c), cardStage(c)) : h('button.btn.sm', { onclick: e => { addCardsFromKeys([key]); e.currentTarget.replaceWith(h('span.chip.learning', 'added')); App.renderNav(); } }, icon('plus'), 'Review')))); });
    if (!words.length && !kanji.length && !gram.length) out.append(h('div.empty', Sensei.available ? h('div.stack', { style: { justifyItems: 'center' } }, h('p', `No match for “${inp.value}” in the built-in list.`), h('button.btn', { onclick: () => { App.go('sensei', { tab: 'ask' }); setTimeout(() => { const t = $('#askQ'); if (t) { t.value = `How do I say "${inp.value}" in Japanese?`; } }, 50); } }, icon('sparkle'), 'Ask Sensei')) : `No match for “${inp.value}”.`));
  };
  inp.addEventListener('input', run); setTimeout(() => { inp.focus(); run(); }, 30);
  const saved = (S.saved || []);
  return h('div', h('div.stack', { style: { gap: '4px' } }, h('div.eyebrow', '辞書 · Dictionary'), h('h1', 'Dictionary')), inp,
    saved.length ? h('div.row', h('span.eyebrow', 'Saved from stories'), saved.slice(-20).map(s => h('button.chip', { style: { cursor: 'pointer', border: 0 }, onclick: () => { inp.value = s; run(); } }, s))) : null, out);
};

VIEWS.settings = () => {
  const st = S.settings;
  const set = (k, v) => { st[k] = v; save(); };
  const row = (label, help, control) => h('div.row.between', { style: { padding: '12px 0', borderBottom: '1px solid var(--line)', flexWrap: 'nowrap', gap: '16px' } }, h('div', { style: { minWidth: 0 } }, h('b', label), help ? h('div.muted.small', help) : null), h('div', { style: { flex: 'none', maxWidth: '55%' } }, control));
  const toggle = (id, k) => h('input', { type: 'checkbox', id, checked: st[k] ? true : null, style: { width: '22px', height: '22px' }, onchange: e => set(k, e.target.checked) });
  const voiceSel = h('select#voice', { onchange: e => { set('voice', e.target.value); Voice.init(); Voice.say('こんにちは、よろしくおねがいします。'); } }, h('option', { value: '' }, 'Best available'), Voice.voices.map(v => h('option', { value: v.name, selected: st.voice === v.name ? true : null }, v.name)));
  const rate = h('input#rate', { type: 'range', min: '0.6', max: '1.2', step: '0.05', value: String(st.rate), oninput: e => set('rate', +e.target.value), onchange: () => Voice.say('ゆっくり はなして ください。') });
  const importInp = h('input#importFile', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const data = JSON.parse(await f.text()); if (!data.cards || !data.settings) throw 0; S = mergeState(data); save(); toast('Progress imported'); App.render(); } catch (err) { toast('That file is not a Michi backup', 'bad'); }
  } });
  let armed = false;
  const reset = h('button.btn.sm', { style: { color: 'var(--bad)' }, onclick: () => { if (!armed) { armed = true; reset.textContent = 'Tap again to erase everything'; setTimeout(() => { armed = false; reset.textContent = 'Reset progress'; }, 4000); return; } S = DEFAULT_STATE(); save(); toast('Progress reset'); App.go('home'); } }, 'Reset progress');
  const exportBtn = h('button.btn.sm', { onclick: async () => {
    const data = JSON.stringify(S); const name = `michi-progress-${dayKey()}.json`;
    const dl = window.claude?.use ? await claude.use('downloads').catch(() => null) : null;
    if (dl) { try { await dl.save({ filename: name, data: new Blob([data], { type: 'application/json' }) }); toast('Backup saved'); } catch (e) { if (e?.code !== 'cancelled' && e?.code !== 'declined') toast('Could not save the file'); } return; }
    try { await navigator.clipboard.writeText(data); toast('Backup copied to clipboard'); } catch (e) { toast('Could not export here'); }
  } }, 'Export backup');
  return h('div', h('div.stack', { style: { gap: '4px' } }, h('div.eyebrow', '設定'), h('h1', 'Settings')),
    h('section.card.pad-lg',
      row('Daily goal', 'XP to earn each day. The ring on Today fills as you go.', h('select#goal', { onchange: e => { set('goal', +e.target.value); } }, [[20, 'Casual · 20'], [50, 'Regular · 50'], [100, 'Serious · 100'], [200, 'Intense · 200']].map(([v, l]) => h('option', { value: v, selected: st.goal === v ? true : null }, l)))),
      row('Show romaji', 'Romaji under words while you are still reading slowly.', toggle('romaji', 'romaji')),
      row('Furigana', 'Readings above kanji. “Auto” hides them once you know a word well.', h('select#furi', { onchange: e => set('furigana', e.target.value) }, [['auto', 'Auto'], ['always', 'Always'], ['never', 'Never']].map(([v, l]) => h('option', { value: v, selected: st.furigana === v ? true : null }, l)))),
      row('Sound effects', null, toggle('sound', 'sound')),
      row('Japanese voice', Voice.ok ? `${Voice.voices.length} Japanese voice${Voice.voices.length === 1 ? '' : 's'} on this device` : 'This browser has no speech voices', voiceSel),
      row('Speaking speed', null, rate),
      row('Theme', null, h('select#theme', { onchange: e => { set('theme', e.target.value); applyTheme(); } }, [['system', 'Match system'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => h('option', { value: v, selected: st.theme === v ? true : null }, l))))),
    h('section.card.pad-lg.stack', h('h3', 'Your data'), h('p.muted', Cloud.ref ? 'Progress is saved to your Claude account, so it follows you to any device where you open Michi. A copy is also kept in this browser.' : 'Progress is saved in this browser. Export a backup to move it to another device.'),
      h('div.row', exportBtn, h('button.btn.sm', { onclick: () => importInp.click() }, 'Import backup'), importInp, reset)),
    h('section.card.pad-lg.stack', h('h3', 'Keyboard'), h('p.muted.small', { html: '<span class="kbd">1</span>–<span class="kbd">4</span> pick an answer · <span class="kbd">Enter</span> check / continue · <span class="kbd">Space</span> replay audio' })),
    h('section.card.pad-lg.stack', h('h3', 'Credits'), h('p.muted.small', { html: 'Stroke order data from <a href="https://kanjivg.tagaini.net" target="_blank" rel="noopener">KanjiVG</a> by Ulrich Apel, CC BY-SA 3.0. Scheduling uses the open FSRS-4.5 algorithm. Romaji input by <a href="https://wanakana.com" target="_blank" rel="noopener">WanaKana</a>.' })));
};
function applyTheme() { const t = S.settings.theme; if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }

// ─── Boot ──────────────────────────────────────────────────────────────────
function boot() {
  applyTheme(); Voice.init();
  const start = (hot = {}) => {
    const r = (location.hash || '').slice(1);
    const route = hot.route || (VIEWS[r] && !['session', 'lesson', 'story', 'grammar'].includes(r) ? r : 'home');
    App.go(route, hot.params || {}, false);
    initCloud();
    checkAchievements();
  };
  window.claude?.hot?.snapshot?.(() => ({ route: ['session'].includes(App.route) ? 'review' : App.route, params: App.route === 'session' ? {} : App.params }));
  window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
  // Refresh "due" counts every minute.
  setInterval(() => App.renderNav(), 60000);
}
boot();
