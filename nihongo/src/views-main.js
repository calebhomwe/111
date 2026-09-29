// ─── App shell, router, home, learn path, lessons, reviews ────────────────
const NAV = [
  { id: 'home', label: 'Today', icon: 'home', count: () => window.Fun?.questBadge?.() || 0 },
  { id: 'learn', label: 'Learn', icon: 'learn' },
  { id: 'review', label: 'Review', icon: 'review', count: () => dueCards().length },
  { id: 'practice', label: 'Dojo', icon: 'brush' },
  { id: 'read', label: 'Read', icon: 'read' },
  { id: 'sensei', label: 'Sensei', icon: 'chat' },
  { id: 'dict', label: 'Dictionary', icon: 'search', more: true },
  { id: 'stats', label: 'Progress', icon: 'stats', more: true },
  { id: 'stamps', label: 'Stamp book', icon: 'star', more: true },
  { id: 'settings', label: 'Settings', icon: 'gear', more: true },
];
const App = {
  route: 'home', params: {}, cleanup: null,
  go(route, params = {}, push = true) {
    if (this.cleanup) { try { this.cleanup(); } catch (e) {} this.cleanup = null; }
    Voice.stop(); $$('.pop').forEach(p => p.remove());
    this.route = route; this.params = params;
    if (push) { try { history.replaceState(null, '', '#' + route); } catch (e) {} }
    this.render(); window.scrollTo({ top: 0 });
  },
  render() {
    const main = $('#main'); main.innerHTML = '';
    const top = h('div.topbar', h('div.brand', h('span.mark', { 'aria-hidden': 'true' }, '道'), h('div', h('b', 'Michi'))), h('div.row', { style: { gap: '6px' } },
      h('span.pill.fire', icon('flame'), String(streak())),
      h('button.icon-btn', { 'aria-label': 'Dictionary', onclick: () => App.go('dict') }, icon('search')),
      h('button.icon-btn', { 'aria-label': 'Progress', onclick: () => App.go('stats') }, icon('stats')),
      h('button.icon-btn', { 'aria-label': 'Settings', onclick: () => App.go('settings') }, icon('gear'))));
    main.append(top);
    const fn = VIEWS[this.route] || VIEWS.home;
    const v = fn(this.params) || h('div');
    v.classList.add('view'); main.append(v);
    this.renderNav();
  },
  renderNav() {
    const nav = $('#nav'); nav.innerHTML = '';
    const tabRoute = { lesson: 'learn', session: 'review', kana: 'practice', write: 'practice', blitz: 'practice', conj: 'practice', numbers: 'practice', listen: 'practice', kanji: 'learn', grammar: 'learn', story: 'read', welcome: 'home', placement: 'home', styles: 'learn', style: 'learn', styleswitch: 'practice', readroom: 'practice' }[this.route] || this.route;
    for (const n of NAV) {
      const c = n.count ? n.count() : 0;
      nav.append(h('button' + (n.more ? '.more-only' : ''), { 'aria-current': tabRoute === n.id ? 'page' : null, onclick: () => App.go(n.id) }, icon(n.icon), h('span', n.label), c ? h('span.count', c > 99 ? '99+' : String(c)) : null));
    }
    $('#streakPill').replaceChildren(icon('flame'), `${streak()} day streak`);
    $('#xpPill').textContent = `${S.xp.toLocaleString()} XP`;
  },
};
const VIEWS = {};
const art = (key, cls = '', alt = '') => DATA.images?.[key] ? h('img' + cls, { src: DATA.images[key], alt, loading: 'lazy', decoding: 'async' }) : null;
function banner(key, eyebrow, title, text, extra) {
  const im = art(key, '.banner-img');
  return h('section.banner' + (im ? '' : '.plain'), im, h('div.banner-body', h('div.eyebrow', eyebrow), h('h1', title), text ? h('p', text) : null, extra || null));
}

// ─── Generative scenery (story covers, hero) ──────────────────────────────
function seeded(seed) { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const SCENES = [
  { sky: ['#f6c28b', '#e27d60', '#6d4c7d'], sun: '#fff1d6', m: ['#6d4c7d', '#4b3a63', '#2d2a45'] },   // dusk
  { sky: ['#bfe3f2', '#8cc6e7', '#5b8fc7'], sun: '#ffffff', m: ['#6f9cc4', '#4d77a3', '#2e4f7a'] },   // clear day
  { sky: ['#1b2447', '#2d3a6b', '#4c5a8f'], sun: '#f4efd8', m: ['#27325c', '#1c2547', '#121935'] },   // night
  { sky: ['#fde2e4', '#f7b9c4', '#c98ba6'], sun: '#fffaf0', m: ['#a8779a', '#7e5a7e', '#57405e'] },   // sakura
  { sky: ['#d6ead0', '#a9d0a0', '#6c9a73'], sun: '#fdf8e8', m: ['#6c9a73', '#4f7a5a', '#335840'] },   // summer green
  { sky: ['#ffd9a8', '#ffb877', '#e0605a'], sun: '#fff5de', m: ['#b0465a', '#7c3150', '#4a2242'] },   // sunrise
];
function drawScene(canvas, seed, opts = {}) {
  const r = seeded(seed), P = opts.palette != null ? SCENES[opts.palette % SCENES.length] : SCENES[Math.floor(r() * SCENES.length)];
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = canvas.width = (opts.w || 640) * dpr, H = canvas.height = (opts.h || 260) * dpr;
  const g = canvas.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, P.sky[2]); sky.addColorStop(.55, P.sky[1]); sky.addColorStop(1, P.sky[0]); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // sun / moon
  const sx = W * (.2 + r() * .6), sy = H * (.25 + r() * .2), sr = H * (.12 + r() * .06);
  const glow = g.createRadialGradient(sx, sy, sr * .5, sx, sy, sr * 3.2); glow.addColorStop(0, P.sun + 'aa'); glow.addColorStop(1, P.sun + '00'); g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.fillStyle = P.sun; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
  // stars at night
  if (P === SCENES[2]) { g.fillStyle = '#ffffffcc'; for (let i = 0; i < 60; i++) g.fillRect(r() * W, r() * H * .6, dpr * (r() < .1 ? 2 : 1), dpr * (r() < .1 ? 2 : 1)); }
  // mountains: three layers of smoothed ridges (one may be a Fuji cone)
  const fuji = r() < .45;
  P.m.forEach((col, li) => {
    const base = H * (.52 + li * .14), amp = H * (.16 - li * .03);
    g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
    if (li === 0 && fuji) {
      const cx = W * (.3 + r() * .4), top = H * .22;
      g.lineTo(0, base + amp * .3); g.lineTo(cx - W * .09, top + H * .07); g.quadraticCurveTo(cx, top - H * .01, cx + W * .09, top + H * .07); g.lineTo(W, base + amp * .3);
      g.lineTo(W, H); g.fill();
      g.fillStyle = '#ffffffdd'; g.beginPath(); g.moveTo(cx - W * .09, top + H * .07); g.quadraticCurveTo(cx, top - H * .01, cx + W * .09, top + H * .07);
      for (let k = 0; k <= 6; k++) g.lineTo(cx + W * .09 - k * W * .03, top + H * (.1 + (k % 2) * .03)); g.fill();
      return;
    }
    let y = base, p = [];
    for (let x = 0; x <= W + 40; x += W / 14) { y = base - amp * (.3 + r() * .7); p.push([x, y]); }
    g.lineTo(0, p[0][1]);
    for (let i = 0; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; g.quadraticCurveTo(p[i][0], p[i][1], mx, my); }
    g.lineTo(W, H); g.fill();
  });
  // water band with seigaiha-like strokes
  if (r() < .5) {
    const wy = H * .82; g.fillStyle = P.m[2]; g.fillRect(0, wy, W, H - wy);
    g.strokeStyle = P.sun + '55'; g.lineWidth = dpr * 1.5;
    for (let i = 0; i < 26; i++) { const x = r() * W, y = wy + 6 * dpr + r() * (H - wy - 10 * dpr), l = 20 + r() * 50; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l * dpr, y); g.stroke(); }
  }
  // torii silhouette
  if (r() < .4 && !opts.noTorii) {
    const tx = W * (.12 + r() * .76), ty = H * .6, tw = H * .26, th = H * .3; g.fillStyle = '#c1333f';
    g.fillRect(tx - tw / 2 - tw * .08, ty, tw * 1.16, th * .08); g.fillRect(tx - tw / 2, ty + th * .2, tw, th * .06);
    g.fillRect(tx - tw * .36, ty, tw * .08, th); g.fillRect(tx + tw * .28, ty, tw * .08, th);
  }
}
function sceneEl(seed, opts) { const c = h('canvas', { 'aria-hidden': 'true' }); requestAnimationFrame(() => drawScene(c, seed, opts)); return c; }
function storyArt(story, opts = {}) {
  const src = (DATA.images || {})[story.id];
  if (src) return h('img', { src, alt: story.titleEn || '', loading: 'lazy' });
  return sceneEl(story.id + story.title, Object.assign({ w: 640, h: 260 }, opts));
}

// ─── Stroke-order SVG ─────────────────────────────────────────────────────
function strokeSVG(ch, { animate = true, numbers = false, speed = 0.55, cls = 'strokes' } = {}) {
  const paths = STROKES[ch]; if (!paths) return null;
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 109 109'); svg.setAttribute('class', cls); svg.setAttribute('aria-hidden', 'true');
  let t = 0;
  paths.forEach((d, i) => {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d); p.setAttribute('pathLength', '1');
    p.setAttribute('style', `fill:none;stroke:var(--ink);stroke-width:4.2;stroke-linecap:round;stroke-linejoin:round;${animate ? `stroke-dasharray:1;stroke-dashoffset:1;animation:draw ${speed}s ease ${t}s forwards` : ''}`);
    svg.append(p); t += speed + 0.12;
    if (numbers) {
      const m = d.match(/^M\s*([\d.]+)[ ,]([\d.]+)/);
      if (m) { const tx = document.createElementNS(ns, 'text'); tx.setAttribute('x', +m[1] - 5); tx.setAttribute('y', +m[2] - 2); tx.setAttribute('style', 'font-size:8px;fill:var(--seal);font-weight:700;font-family:var(--f-body)'); tx.textContent = i + 1; svg.append(tx); }
    }
  });
  svg.dataset.dur = t;
  return svg;
}
const drawStyle = document.createElement('style'); drawStyle.textContent = '@keyframes draw{to{stroke-dashoffset:0}}'; document.head.append(drawStyle);
function strokeBox(ch, big = false) {
  const box = h('div.teach-glyph.gridpaper', { style: big ? {} : {} });
  const draw = () => { box.innerHTML = ''; const s = strokeSVG(ch, { numbers: true }); if (s) box.append(h('span.under.jp', { 'aria-hidden': 'true' }, ch), s); else box.append(h('span.jp', ch)); };
  draw();
  const replay = h('button.btn.sm.ghost', { onclick: draw }, icon('play'), 'Replay strokes');
  return { box, replay };
}

// ─── Home ──────────────────────────────────────────────────────────────────
VIEWS.home = () => {
  const due = dueCards().length, t = today(), goal = S.settings.goal, pct = clamp(t.xp / goal, 0, 1);
  const nxt = nextLesson(); const lv = levelInfo();
  const circ = 2 * Math.PI * 52;
  const ring = h('div.ring', { html: `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="rgb(255 255 255 / .2)" stroke-width="10"/><circle cx="60" cy="60" r="52" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - pct)}"/></svg><div class="num"><div><b>${t.xp}</b><small>/ ${goal} XP</small></div></div>` });
  const hour = new Date().getHours();
  const greet = hour < 5 ? 'こんばんは' : hour < 11 ? 'おはようございます' : hour < 18 ? 'こんにちは' : 'こんばんは';
  const greetEn = hour < 5 || hour >= 18 ? 'Good evening' : hour < 11 ? 'Good morning' : 'Good afternoon';
  const hero = h('section.hero',
    h('div.stack', { style: { gap: '14px' } },
      h('div', h('div.eyebrow', { style: { color: 'rgb(255 255 255 / .75)' } }, greetEn), h('h1.jp', { style: { fontFamily: 'var(--f-jp-hand)', fontWeight: 600 } }, greet)),
      t.new >= S.settings.newPerDay ? h('p', { style: { fontWeight: 700 } }, `You've added ${t.new} new items today (your limit is ${S.settings.newPerDay}). More now means a heavier review pile tomorrow.`) : null,
      h('p', due ? `${due} card${due === 1 ? '' : 's'} ready for review. Clear them first while they're fresh, then learn something new.` : nxt ? `Nothing to review right now. Next up: ${nxt.title}.` : 'You have finished every lesson. Keep your reviews going and read a story.'),
      h('div.row', due ? h('button.btn.primary', { onclick: () => startReview() }, icon('review'), `Review ${due}`) : null,
        nxt ? h('button.btn' + (due ? '.light' : '.primary'), { onclick: () => App.go('lesson', { id: nxt.id }) }, icon('learn'), due ? 'New lesson' : `Start: ${nxt.title}`) : null)),
    ring);
  const hs = sceneEl('home', { w: 1100, h: 300, palette: [2, 0, 1, 1, 5, 0, 2][Math.floor(hour / 3.5) % 7], noTorii: false }); hs.className = 'scene'; hs.style.cssText = 'width:100%;height:100%;object-fit:cover;opacity:.28;mix-blend-mode:luminosity';
  const heroArt = art('hero', '.scene'); if (heroArt) { heroArt.style.cssText = 'width:100%;height:100%;object-fit:cover;opacity:.42'; hero.prepend(heroArt); } else hero.prepend(hs);

  const learned = Object.keys(S.cards).length;
  const vocabN = Object.keys(S.cards).filter(k => k[0] === 'v').length, kanjiN = Object.keys(S.cards).filter(k => k[0] === 'j').length, kanaN = Object.keys(S.cards).filter(k => k[0] === 'h' || k[0] === 'k').length;
  const tiles = h('section.stat-tiles',
    h('div.tile', h('b', String(streak())), h('span', 'day streak')),
    h('div.tile', h('b', `Lv ${lv.level}`), h('div.bar', { style: { margin: '6px 0 2px' } }, h('i', { style: { width: `${lv.into / lv.need * 100}%` } })), h('span', `${lv.need - lv.into} XP to next`)),
    h('div.tile', h('b', `${kanaN}/${HIRA.length + KATA.length}`), h('span', 'kana learned')),
    h('div.tile', h('b', `${vocabN} · ${kanjiN}`), h('span', 'words · kanji')));

  // word of the day: deterministic by date, prefer something not learned yet
  const pool = VOCAB.filter(v => v.lv === 5); const dseed = seeded(dayKey())();
  const wotd = pool.length ? pool[Math.floor(dseed * pool.length)] : null;
  const wotdCard = wotd && h('section.card.pad-lg.wotd',
    h('div.teach-glyph.word.gridpaper', { style: { minWidth: '160px' } }, h('span', { html: ruby(wotd.w, wotd.r) })),
    h('div.stack', h('div.eyebrow', '今日の言葉 · Word of the day'), h('div.row', h('h2', wotd.m), speakBtn(wotd.r)),
      showRomaji() ? h('div.muted', kanaToRomaji(wotd.r)) : null,
      wotd.ex ? h('div.example', h('div.row.between', h('span.jp', wotd.ex), speakBtn(wotd.ex, 'Play sentence', wotd.exr)), h('span.muted.small', wotd.exm)) : null,
      h('div.row', h('button.btn.sm', { onclick: () => { addCardsFromKeys(['v:' + wotd.id]); toast('Added to your reviews'); App.render(); }, disabled: S.cards['v:' + wotd.id] ? true : null }, icon('plus'), S.cards['v:' + wotd.id] ? 'In your reviews' : 'Add to reviews'))));

  // continue tracks
  const tracks = ['kana', 'vocab', 'kanji'].map(tr => {
    const all = LESSONS.filter(l => l.track === tr), done = all.filter(l => S.lessons[l.id]).length, n = nextLesson(tr);
    const name = { kana: 'Kana', vocab: 'Vocabulary', kanji: 'Kanji' }[tr];
    return h('div.card.stack', h('div.row.between', h('h3', name), h('span.muted.small', `${done}/${all.length} lessons`)), h('div.bar.ok', h('i', { style: { width: `${all.length ? done / all.length * 100 : 0}%` } })),
      n ? h('div.path-next', h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { style: { fontWeight: 700 } }, n.title), h('div.muted.jp', { style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, n.sub)), h('button.btn.sm.primary', { onclick: () => App.go('lesson', { id: n.id }) }, 'Start')) : h('div.muted', 'Track complete. 見事！'));
  });
  const gp = GRAMMAR_POINTS.find(p => !S.grammar[p.id]);
  const extra = h('div.grid.g2',
    gp ? h('button.card.scenario', { onclick: () => App.go('grammar', { id: gp.id }) }, h('div.eyebrow', 'Next grammar point'), h('div.jp', { style: { fontSize: '1.3rem' } }, gp.t), h('div.muted', gp.sum)) : null,
    h('button.card.scenario', { onclick: () => App.go('sensei') }, h('div.eyebrow', 'Talk it out'), h('div', { style: { fontWeight: 700 } }, 'Practise a real conversation with Sensei'), h('div.muted', 'Order at a café, ask for directions, introduce yourself. Your sentences get corrected as you go.')));

  const fun = window.Fun ? [Fun.streakBanner(), h('div.grid.g2', Fun.questsCard(), Fun.weekCard())] : [];
  return h('div', fun[0] || null, hero, fun[1] || null, tiles, wotdCard, h('section.grid.g3', tracks), extra, heatmapCard());
};
function heatmapCard() {
  const weeks = 20, cells = [], start = new Date(); start.setHours(12, 0, 0, 0); start.setDate(start.getDate() - (weeks * 7 - 1) - start.getDay());
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start.getTime() + i * DAY); const k = dayKey(d.getTime()); const xp = S.days[k]?.xp || 0;
    const l = xp === 0 ? 0 : xp < 20 ? 1 : xp < 50 ? 2 : xp < 100 ? 3 : 4;
    cells.push(h('i', { 'data-l': l, title: `${k}: ${xp} XP` }));
  }
  const total = Object.values(S.days).reduce((a, d) => a + (d.rev || 0), 0);
  return h('section.card.stack', h('div.row.between', h('h3', 'Study calendar'), h('span.muted.small', `${total.toLocaleString()} reviews all time`)), h('div.heat', cells));
}

// ─── Learn: the path ───────────────────────────────────────────────────────
VIEWS.learn = (p) => {
  const track = p.track || sessionStorageGet('learnTrack') || 'kana';
  const tabs = h('div.tabs', { role: 'tablist' }, [['kana', 'Kana'], ['vocab', 'Vocabulary'], ['kanji', 'Kanji'], ['grammar', 'Grammar']].map(([id, label]) =>
    h('button', { role: 'tab', 'aria-selected': track === id ? 'true' : 'false', onclick: () => { sessionStorageSet('learnTrack', id); App.go('learn', { track: id }); } }, label)));
  const intro = {
    kana: ['Hiragana & katakana', 'The two phonetic scripts. Every lesson teaches one row with stroke order, a memory trick and audio, then drills it.'],
    vocab: ['Vocabulary', 'JLPT N5 then N4 words, grouped by theme. Each word comes with a natural example sentence.'],
    kanji: ['Kanji', 'N5 then N4 kanji with animated stroke order, readings, example words and a memory trick for each.'],
    grammar: ['Grammar', 'From です to the passive. Short explanations, patterns, examples you can hear, and a quick check for each point.'],
  }[track];
  const head = h('div.stack', banner('tr-' + track, 'Learn', intro[0], intro[1]), tabs);
  if (track === 'grammar') return h('div', head, grammarList());
  const list = LESSONS.filter(l => l.track === track);
  const groups = {};
  for (const l of list) { const g = l.track === 'kana' ? (l.id.startsWith('kana-h') ? 'Hiragana' : 'Katakana') : `JLPT ${l.level}`; (groups[g] = groups[g] || []).push(l); }
  const body = Object.entries(groups).map(([g, ls]) => h('section.stack',
    h('div.level-sep', h('h2', g), h('span.muted.small', `${ls.filter(l => S.lessons[l.id]).length}/${ls.length}`)),
    h('div.lesson-list', ls.map(l => lessonTile(l)))));
  if (track === 'kanji') body.push(h('div.row', h('button.btn', { onclick: () => App.go('kanji') }, 'Browse all kanji')));
  if (!list.length) body.push(h('div.empty', 'This track is loading its content.'));
  return h('div', head, body);
};
function lessonTile(l) {
  const done = S.lessons[l.id], prog = lessonProgress(l);
  const thumb = l.cat ? art('cat-' + l.cat, '.thumb') : null;
  return h('button.lesson' + (thumb ? '.has-thumb' : ''), { onclick: () => App.go('lesson', { id: l.id }) },
    thumb, done ? h('span.hanko.round.done', '済') : null,
    h('div.t', l.title, window.Fun?.lessonCrown?.(l.id) || null), h('div.s', l.sub),
    h('div.bar' + (prog >= 1 ? '.ok' : ''), h('i', { style: { width: `${prog * 100}%` } })));
}
function sessionStorageGet(k) { try { return sessionStorage.getItem('michi.' + k); } catch (e) { return null; } }
function sessionStorageSet(k, v) { try { sessionStorage.setItem('michi.' + k, v); } catch (e) {} }

// ─── Lesson flow: teach → quiz → cards ────────────────────────────────────
function addCardsFromKeys(keys, gradeFor = () => 3, learningStep = false) {
  let n = 0;
  for (const k of keys) if (!S.cards[k]) {
    const g = gradeFor(k), c = FSRS.review(null, g);
    // Learning step: first check-in within a day (sooner if it was shaky), then FSRS takes over.
    if (learningStep) c.due = now() + (g <= 2 ? 6 : 20) * 3600e3;
    S.cards[k] = c; n++;
  }
  if (n) { today().new += n; save(); }
  return n;
}
function teachCard(key) {
  const it = item(key); const wrap = h('div.teach');
  if (it.type === 'kana') {
    const { box, replay } = strokeBox(it.ch);
    const exWord = VOCAB.find(v => toHira(v.r).startsWith(toHira(it.ch)) && v.lv === 5 && (it.script === 'k' ? /[゠-ヿ]/.test(v.w) : true));
    wrap.append(h('div.teach-hero', h('div.stack', { style: { justifyItems: 'center' } }, box, replay),
      h('div.stack',
        h('div.row', h('span', { style: { font: '400 3rem/1 var(--f-display)' } }, it.romaji), speakBtn(it.ch)),
        h('div.muted', it.script === 'h' ? 'Hiragana' : 'Katakana', ` · ${(STROKES[it.ch] || []).length || '?'} strokes`),
        KANA_MN[it.ch] ? h('div.mnemonic', KANA_MN[it.ch]) : null,
        exWord ? h('div.example', h('div.row.between', h('span.jp', { html: ruby(exWord.w, exWord.r) }), speakBtn(exWord.r)), h('span.muted.small', exWord.m)) : null)));
    setTimeout(() => Voice.say(it.ch), 250);
  } else if (it.type === 'vocab') {
    wrap.append(h('div.teach-hero',
      h('div.teach-glyph.word.gridpaper', h('span', { html: ruby(it.w, it.r) })),
      h('div.stack',
        h('div.row', h('h2', { style: { fontSize: '1.5rem' } }, it.m), speakBtn(it.r)),
        h('dl.kv', h('dt', 'Reading'), h('dd.jp', it.r), showRomaji() ? [h('dt', 'Romaji'), h('dd', kanaToRomaji(it.r))] : null, h('dt', 'Type'), h('dd', POS_NAME[it.pos] || it.pos), h('dt', 'Level'), h('dd', `JLPT N${it.lv}`)),
        it.ex ? h('div.example', h('div.row.between', h('span.jp', it.ex), speakBtn(it.ex, 'Play sentence', it.exr)), h('span.muted.small', it.exm)) : null,
        kanjiIn(it.w).length ? h('div.row.small.muted', 'Kanji: ', kanjiIn(it.w).map(k => h('button.chip', { onclick: () => openKanji(k.k) }, `${k.k} ${shortM(k.m)}`))) : null)));
    setTimeout(() => Voice.say(it.r), 250);
  } else {
    const { box, replay } = strokeBox(it.k);
    wrap.append(h('div.teach-hero', h('div.stack', { style: { justifyItems: 'center' } }, box, replay),
      h('div.stack',
        h('h2', { style: { fontSize: '1.5rem' } }, it.m),
        h('dl.kv', h('dt', 'On'), h('dd.jp', (it.on || []).join('、') || '—'), h('dt', 'Kun'), h('dd.jp', (it.kun || []).join('、') || '—'), h('dt', 'Strokes'), h('dd', String(it.s))),
        it.mn ? h('div.mnemonic', it.mn) : null,
        h('div.stack', { style: { gap: '6px' } }, (it.ex || []).map(e => h('div.row.between.example', { style: { padding: '8px 12px' } }, h('span', h('span.jp', { style: { fontSize: '1.2rem' }, html: ruby(e[0], e[1]) }), h('span.muted.small', ' ' + e[2])), speakBtn(e[1])))))));
  }
  return wrap;
}
const POS_NAME = { n: 'Noun', v1: 'Ichidan verb (る-verb)', v5: 'Godan verb (う-verb)', vs: 'Noun · takes する', vk: 'Irregular verb (来る)', vsi: 'Irregular verb (する)', 'adj-i': 'い-adjective', 'adj-na': 'な-adjective', adv: 'Adverb', pron: 'Pronoun', exp: 'Expression', ctr: 'Counter', num: 'Number', conj: 'Conjunction', int: 'Interjection', pn: 'Pre-noun adjectival' };
const kanjiIn = w => [...new Set(w)].map(c => KANJI_BY[c]).filter(Boolean);

VIEWS.lesson = ({ id }) => {
  const l = LESSON_BY[id]; if (!l) return VIEWS.learn({});
  const keys = l.keys; let i = 0;
  Clips.load().then(() => Clips.prefetch(keys.map(k => { const it = item(k); return it.type === 'kana' ? it.ch : it.type === 'vocab' ? it.r : (it.ex?.[0] || [])[1]; })));
  const wrap = h('div.study');
  const bar = h('i', { style: { width: '0%' } });
  const top = h('div.study-top', h('button.icon-btn', { 'aria-label': 'Leave lesson', onclick: () => App.go('learn', { track: l.track }) }, icon('x')), h('div.bar', bar), h('span.muted.small', { style: { fontVariantNumeric: 'tabular-nums' } }, ''));
  const stage = h('div');
  wrap.append(h('div.stack', { style: { gap: '4px' } }, h('div.eyebrow', `${l.track === 'kana' ? 'Kana' : l.track === 'vocab' ? 'Vocabulary · ' + l.level : 'Kanji · ' + l.level} lesson`), h('h1', { style: { fontSize: '1.6rem' } }, l.title)), top, stage);
  const total = keys.length * 2;
  const showTeach = () => {
    bar.style.width = `${i / total * 100}%`; top.lastChild.textContent = `${i + 1} / ${keys.length}`;
    const next = h('button.btn.primary', { onclick: () => { i++; i < keys.length ? showTeach() : quiz(); } }, i < keys.length - 1 ? 'Next' : 'Start the check', h('span.kbd', 'Enter'));
    const back = i > 0 ? h('button.btn.ghost', { onclick: () => { i--; showTeach(); } }, icon('back'), 'Back') : null;
    stage.replaceChildren(h('div.qcard', teachCard(keys[i]), h('div.row.between', back || h('span'), next)));
    next.focus();
  };
  const quiz = () => {
    Session.lessonChars = l.track === 'kana' ? keys.map(k => k.slice(2)) : null;
    runSession({
      host: stage, keys: shuffle(keys).concat(shuffle(keys)), lesson: true, progress: (d, n) => { bar.style.width = `${(keys.length + d / n * keys.length) / total * 100}%`; top.lastChild.textContent = `Check ${Math.min(d + 1, n)} / ${n}`; },
      done: (res) => {
        const firstTry = res.firstTry;
        const added = addCardsFromKeys(keys, k => firstTry[k] === false ? 2 : 3, true);
        const was = S.lessons[id];
        S.lessons[id] = { done: now(), best: Math.max(was?.best || 0, res.pct) };
        addXP((was ? 5 : 20) + added * 3);
        save(); petals(); Sfx.done(); bar.style.width = '100%';
        const nx = nextLesson(l.track);
        stage.replaceChildren(h('div.qcard', h('div.result-hero',
          h('span.hanko.stamp', '合格'), h('h2', 'Lesson complete'),
          h('p.muted', `${Math.round(res.pct * 100)}% on the first try · ${added} new item${added === 1 ? '' : 's'} added to your reviews`),
          h('div.row', { style: { justifyContent: 'center' } }, ([...new Set(keys)].map(k => h('span.chip', { html: esc(itemLabel(item(k))) })))),
          h('div.row', { style: { justifyContent: 'center' } },
            nx ? h('button.btn.primary', { onclick: () => App.go('lesson', { id: nx.id }) }, `Next: ${nx.title}`) : null,
            l.track === 'kana' || l.track === 'kanji' ? h('button.btn', { onclick: () => App.go('write', { chars: keys.map(k => k.slice(2)).join('') }) }, icon('brush'), 'Practise writing') : null,
            h('button.btn', { onclick: () => App.go('learn', { track: l.track }) }, 'Back to path')))));
        checkAchievements(); window.Fun?.event?.('lesson', { id, perfect: res.correct === res.total });
      },
    });
  };
  showTeach();
  const onKey = e => { if (e.key === 'Enter' && document.activeElement?.tagName !== 'INPUT') { const b = stage.querySelector('.btn.primary'); if (b) { e.preventDefault(); b.click(); } } };
  document.addEventListener('keydown', onKey); App.cleanup = () => document.removeEventListener('keydown', onKey);
  return wrap;
};

// ─── Review ────────────────────────────────────────────────────────────────
VIEWS.review = () => {
  const due = dueCards(); const all = Object.keys(S.cards);
  const byStage = { learning: 0, young: 0, mature: 0, mastered: 0 };
  for (const k of all) { const s = cardStage(S.cards[k]); if (byStage[s] != null) byStage[s]++; }
  const soon = all.filter(k => S.cards[k].due > now() && S.cards[k].due < now() + DAY).length;
  const nextDue = all.map(k => S.cards[k].due).filter(d => d > now()).sort((a, b) => a - b)[0];
  const weak = all.filter(k => S.cards[k].lapses >= 2).sort((a, b) => S.cards[b].lapses - S.cards[a].lapses);
  return h('div',
    h('div.stack', { style: { gap: '4px' } }, h('div.eyebrow', 'Spaced repetition · FSRS'), h('h1', 'Reviews')),
    h('section.card.pad-lg.row.between',
      h('div.stack', { style: { gap: '4px' } }, h('div', { style: { font: '400 3rem/1 var(--f-display)' } }, String(due.length)), h('div.muted', due.length ? 'cards due now' : nextDue ? `Next review in ${fmtIvl(nextDue - now())}` : 'Learn a lesson to start reviewing'), soon ? h('div.muted.small', `${soon} more due in the next 24 hours`) : null),
      h('div.row', due.length ? h('button.btn.primary', { onclick: () => startReview() }, icon('play'), due.length > 50 ? 'Review 50' : 'Start review') : null,
        all.length ? h('button.btn', { onclick: () => startReview({ cram: true }) }, icon('bolt'), 'Extra practice') : null)),
    h('section.stat-tiles', Object.entries(byStage).map(([s, n]) => h('div.tile', h('b', String(n)), h('span.chip.' + s, s)))),
    weak.length ? h('section.card.stack', h('div.row.between', h('h3', 'Leeches'), h('button.btn.sm', { onclick: () => startReview({ keys: weak.slice(0, 20) }) }, 'Drill these')), h('p.muted.small', 'Items you have forgotten two or more times. A focused drill helps them stick.'),
      h('div.row', weak.slice(0, 24).map(k => h('span.chip.seal', { html: `${esc(itemLabel(item(k) || { type: 'kana', ch: '?' }))} ×${S.cards[k].lapses}` })))) : null,
    h('section.card.stack', h('h3', 'How reviews work'), h('p.muted', 'Michi schedules each card with FSRS, a memory model that predicts when you are about to forget. Answer quickly and correctly and the gap grows (days, weeks, months). Miss one and it comes back in minutes. Early cards are multiple choice; once a card is stable you type the answer, so you practise recall as well as recognition.')));
};
function startReview(opts = {}) {
  let keys = opts.keys || (opts.cram ? shuffle(Object.keys(S.cards)).sort((a, b) => FSRS.retrievability(S.cards[a]) - FSRS.retrievability(S.cards[b])).slice(0, 20) : dueCards().slice(0, 50));
  if (!keys.length) { toast('Nothing due right now'); return; }
  App.go('session', { keys: opts.cram || opts.keys ? keys : shuffle(keys), cram: !!(opts.cram || opts.keys) });
}
VIEWS.session = ({ keys, cram }) => {
  if (!keys) return VIEWS.review();
  const wrap = h('div.study'); const bar = h('i'); const count = h('span.combo');
  const stage = h('div');
  wrap.append(h('div.study-top', h('button.icon-btn', { 'aria-label': 'End review', onclick: () => App.go('review') }, icon('x')), h('div.bar', bar), count), stage);
  runSession({
    host: stage, keys, review: !cram,
    progress: (d, n, combo) => { bar.style.width = `${d / n * 100}%`; window.Fun?.combo ? Fun.combo(count, combo, `${d}/${n}`) : (count.textContent = combo >= 3 ? `${combo} combo` : `${d}/${n}`); },
    done: res => {
      Sfx.done(); if (res.pct >= 0.9) petals(18);
      stage.replaceChildren(h('div.qcard', h('div.result-hero',
        h('span.hanko.stamp', res.pct >= .9 ? '優' : res.pct >= .7 ? '良' : '可'), h('h2', cram ? 'Practice done' : 'Review done'),
        window.Fun?.sessionSummary ? Fun.sessionSummary(res) : h('p.muted', `${res.correct}/${res.total} correct on the first try · best combo ${res.bestCombo} · +${res.xp} XP`),
        res.missed.length ? h('div.stack', h('div.eyebrow', 'Missed'), h('div.row', { style: { justifyContent: 'center' } }, res.missed.map(k => h('span.chip.seal', { html: esc(itemLabel(item(k))) })))) : null,
        h('div.row', { style: { justifyContent: 'center' } }, dueCards().length ? h('button.btn.primary', { onclick: () => startReview() }, `Keep going (${dueCards().length})`) : null, h('button.btn', { onclick: () => App.go('home') }, 'Done')))));
      App.renderNav(); if (!cram) window.Fun?.event?.('review-done', { correct: res.correct, total: res.total });
    },
  });
  return wrap;
};

// Shared quiz runner. First attempt per key is graded; misses are re-queued.
function runSession({ host, keys, review = false, lesson = false, progress, done }) {
  // Every original entry in `keys` is one scored question (lessons list each item twice: recognition, then recall).
  // A miss re-queues the item as an unscored retry. An item counts as "first try" only if none of its scored questions was missed.
  const queue = keys.map(key => ({ key, scored: true })); const total = queue.length;
  let doneN = 0, combo = 0, bestCombo = 0, correct = 0, xp = 0;
  const missedKey = {}, graded = {}, missed = []; const seenCount = {};
  const next = () => {
    if (!queue.length) {
      Session.lessonChars = null;
      const firstTry = Object.fromEntries(keys.map(k => [k, !missedKey[k]]));
      return done({ pct: total ? correct / total : 1, correct, total, bestCombo, xp, firstTry, missed: [...new Set(missed)] });
    }
    const entry = queue.shift(), key = entry.key; seenCount[key] = (seenCount[key] || 0) + 1;
    let force; if (lesson) { const it = item(key); force = seenCount[key] === 1 ? { kana: 'k2r', vocab: 'v2m', kanji: 'j2m' }[it.type] : { kana: pick(['a2k', 'r2k']), vocab: pick(['m2v', 'a2m']), kanji: pick(['m2j', 'jex']) }[it.type]; }
    const q = makeQuestion(key, force); if (!q) return next();
    progress && progress(doneN, total, combo);
    let t0 = now(); if (q.audio) t0 += 1500; // don't count listening time against the answer
    const prevCard = S.cards[key] ? Object.assign({}, S.cards[key]) : null; let scoredMiss = false, requeued = null, fsrsHere = false;
    renderQuestion(host, q, (ok, typed, override) => {
      if (override) { // learner flagged a typo: undo the miss
        if (requeued) { const qi = queue.indexOf(requeued); if (qi >= 0) queue.splice(qi, 1); }
        if (scoredMiss) {
          correct++; combo++; bestCombo = Math.max(bestCombo, combo); missedKey[key] = false; const mi = missed.lastIndexOf(key); if (mi >= 0) missed.splice(mi, 1);
          if (fsrsHere && prevCard) { S.cards[key] = FSRS.review(prevCard, 3); const d = today(); d.ok = (d.ok || 0) + 1; }
          addXP(2);
        }
        return;
      }
      const dt = (now() - t0) / 1000;
      if (entry.scored) {
        doneN++;
        if (ok) { correct++; combo++; bestCombo = Math.max(bestCombo, combo); window.Fun?.event?.('answer', { ok: true, combo }); }
        else { combo = 0; missedKey[key] = true; missed.push(key); scoredMiss = true; window.Fun?.event?.('answer', { ok: false, combo: 0 }); }
        if (review && !graded[key]) {
          graded[key] = fsrsHere = true;
          const g = !ok ? 1 : dt > (typed ? 14 : 9) ? 2 : (typed && dt < 4 && S.cards[key]?.s > 5) ? 4 : 3;
          S.cards[key] = FSRS.review(S.cards[key], g); today().rev++; if (ok) today().ok = (today().ok || 0) + 1;
        }
        const gain = ok ? (lesson ? 1 : 2) + (combo > 0 && combo % 10 === 0 ? 5 : 0) : 0; xp += gain; if (gain) { addXP(gain); window.Fun?.floatXP?.(gain, host); } else save();
      } else if (!ok) combo = 0;
      if (!ok) { requeued = { key, scored: false }; queue.splice(Math.min(queue.length, 3 + rand(3)), 0, requeued); } // see it again soon
      progress && progress(doneN, total, combo);
    }, next);
  };
  next();
}
// Render one question; answer(ok, typed) fires once, then continueFn when the learner moves on.
function renderQuestion(host, q, answer, continueFn) {
  const card = h('div.qcard'); let answered = false;
  const big = h('div.qbig' + (q.bigClass === 'kana' || q.bigClass === 'kanji' ? '.gridpaper' : ''));
  if (q.big) big.append(h('div.' + (q.bigClass || 'word'), q.big)); else if (q.bigHTML) big.append(h('div.' + (q.bigClass || 'word'), { html: q.bigHTML }));
  if (q.audio) { const b = h('button.btn.primary', { style: { width: '84px', height: '84px', borderRadius: '50%' }, 'aria-label': 'Play again', onclick: () => Voice.say(q.audio) }, icon('speaker')); b.querySelector('svg').style.cssText = 'width:34px;height:34px'; big.append(b); setTimeout(() => Voice.say(q.audio), 200); }
  if (q.sub) big.append(h('div.hint', q.sub)); if (q.hint) big.append(h('div.hint', q.hint));
  const fb = h('div');
  const finish = (ok, typed) => {
    if (answered) return; answered = true; ok ? Sfx.ok() : Sfx.bad(); answer(ok, typed);
    if (q.say && !q.audio) Voice.say(q.say);
    const cont = h('button.btn.primary', { onclick: () => { cleanup(); continueFn(); } }, 'Continue', h('span.kbd', 'Enter'));
    const extra = [];
    if (typed && !ok) extra.push(h('button.btn.sm.ghost', { onclick: () => { cleanup(); answeredOverride(); } }, icon('undo'), 'I made a typo'));
    const it = !ok && q.key ? item(q.key) : null; const lapses = it ? (S.cards[q.key]?.lapses || 0) : 0;
    const aid = it && lapses >= 2 ? (it.type === 'kana' ? KANA_MN[it.ch] : it.type === 'kanji' ? it.mn : it.ex ? `${it.ex} — ${it.exm}` : '') : '';
    fb.replaceChildren(h('div.feedback.' + (ok ? 'ok' : 'no'), h('div.row.between', h('strong', ok ? pick(['正解！ Correct', 'いいね！ Nice', 'すごい！ Great', 'その通り！ Exactly']) : 'Not quite'), h('div.row', q.say ? speakBtn(q.say) : null)), h('div.ans', { html: esc(q.answer) }), aid ? h('div.mnemonic', { style: { color: 'var(--ink)' } }, h('b', `Tricky one (missed ${lapses}×): `), aid) : null, h('div.row.between', h('div', extra), cont)));
    setTimeout(() => { cont.focus({ preventScroll: true }); fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 30);
  };
  const answeredOverride = () => { answer(true, true, true); continueFn(); };
  if (q.kind === 'mc') {
    const opts = h('div.opts', q.opts.map((o, i) => {
      const b = h('button.opt' + (o.big ? '.bigopt' : ''), { type: 'button', onclick: () => {
        if (answered) return;
        b.classList.add(o.correct ? 'right' : 'wrong');
        if (!o.correct) opts.querySelectorAll('.opt').forEach((x, j) => { if (q.opts[j].correct) x.classList.add('right'); });
        opts.querySelectorAll('.opt').forEach(x => x.setAttribute('disabled', ''));
        finish(o.correct, false);
      } }, h('span.k', String(i + 1)), o.labelHTML ? h('span', { html: o.labelHTML }) : o.label);
      return b;
    }));
    card.append(h('div.q', q.q), big, opts, fb);
  } else {
    const inp = h('input#answer', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', lang: q.ime ? 'ja' : 'en', placeholder: q.ime ? 'type romaji → かな' : 'romaji', 'aria-label': 'Your answer' });
    if (q.ime) bindIME(inp);
    const go = h('button.btn.primary', { type: 'submit' }, 'Check');
    let retried = false;
    const form = h('form.typein', { onsubmit: e => { e.preventDefault(); if (answered) return; const v = inp.value; if (!v.trim()) return; const ok = q.check(v);
      if (!ok && !retried && q.kana) { const inK = toHira(/[a-z]/i.test(v) && window.wanakana ? wanakana.toHiragana(v) : v).replace(/\s/g, ''); if (editDistance(inK, toHira(q.kana)) === 1) { retried = true; inp.classList.add('wrong'); setTimeout(() => inp.classList.remove('wrong'), 400); fb.replaceChildren(h('div.feedback.no', h('strong', 'Almost! One kana is off. Try again.'))); inp.select(); return; } } inp.classList.add(ok ? 'right' : 'wrong'); inp.readOnly = true; go.remove(); finish(ok, true); } }, inp, go);
    card.append(h('div.q', q.q), big, form, fb);
    setTimeout(() => inp.focus(), 60);
  }
  const onKey = e => {
    if (e.target.tagName === 'INPUT' && !answered) return;
    if (/^[1-4]$/.test(e.key) && q.kind === 'mc' && !answered) { const b = card.querySelectorAll('.opt')[+e.key - 1]; b && b.click(); }
    else if (e.key === 'Enter' && answered) { e.preventDefault(); const c = fb.querySelector('.btn.primary'); c && c.click(); }
    else if (e.key === ' ' && q.audio && !answered) { e.preventDefault(); Voice.say(q.audio); }
  };
  const cleanup = () => document.removeEventListener('keydown', onKey);
  document.addEventListener('keydown', onKey);
  const prevCleanup = App.cleanup; App.cleanup = () => { cleanup(); prevCleanup && prevCleanup(); };
  host.replaceChildren(card);
}
