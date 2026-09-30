// ─── Dojo: kana chart, writing, blitz, conjugation gym, numbers, listening ─
VIEWS.practice = () => {
  const tiles = [
    ['kana', 'あ', 'Kana chart', 'Every hiragana and katakana with sound, stroke order and your progress on each.'],
    ['write', '書', 'Writing', 'Draw kana and kanji on manuscript paper. Each stroke is checked for order and direction.'],
    ['blitz', '速', 'Kana Blitz', '60 seconds, as many kana as you can read. Chase your high score.'],
    ['conj', '変', 'Conjugation Gym', 'Verbs and adjectives into て, ない, た, potential, passive and more, with the rule when you slip.'],
    ['numbers', '数', 'Numbers & counters', 'Big numbers, prices, dates, times and the counters that change their sounds: 一本, 三匹, 六杯.'],
    ['styleswitch', '替', 'Style Switch', 'Say the same sentence casually, politely or in keigo, then hear all three.'],
    ['readroom', '場', 'Read the Room', 'Pick the reply that fits a boss, a clerk, a friend or a child. Sound natural, never rude.'],
    ['listen', '聞', 'Listening drill', 'Hear a word or a number, answer what you heard. Trains your ear without the kanji crutch.'],
  ];
  const hs = S.blitzBest || 0;
  return h('div',
    banner('tr-dojo', '道場 · Dojo', 'Practice', 'Drills for the skills reviews can\'t reach: handwriting, speed, conjugation, numbers and listening.'),
    h('div.grid.g3', tiles.map(([id, glyph, title, desc]) => h('button.scenario', { onclick: () => App.go(id) },
      h('div.row', h('span.hanko', { style: { width: '46px', height: '46px', fontSize: '1.3rem' } }, glyph), h('h3', title)),
      h('p.muted.small', desc), id === 'blitz' && hs ? h('span.chip.seal', `Best: ${hs}`) : null))));
};

// Kana chart
VIEWS.kana = (p) => {
  const script = p.script || 'h';
  const tabs = h('div.tabs', { role: 'tablist' }, [['h', 'Hiragana ひらがな'], ['k', 'Katakana カタカナ']].map(([id, l]) => h('button', { role: 'tab', 'aria-selected': script === id ? 'true' : 'false', onclick: () => App.go('kana', { script: id }) }, l)));
  const cell = (c) => {
    if (!c) return h('div.kcell.empty-cell', { 'aria-hidden': 'true' });
    const ch = script === 'h' ? c[0] : c[1]; const st = cardStage(S.cards[`${script}:${ch}`]);
    return h('button.kcell', { onclick: () => kanaModal(ch, script), 'aria-label': `${ch} ${c[2]}` }, st !== 'new' ? h('span.dot', { 'data-s': st }) : null, h('b', ch), h('span', c[2]));
  };
  const grid = h('div.kgrid');
  KANA_ROWS.forEach(([id, label, cells], i) => { if (i === 10) grid.append(h('div.krow-label.eyebrow', 'Voiced sounds · dakuten ゛ and handakuten ゜')); cells.forEach(c => grid.append(cell(c))); });
  const yoon = h('div.grid', { style: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' } });
  YOON_ROWS.forEach(([, cells]) => cells.forEach(c => yoon.append(cell(c))));
  const learnedN = (script === 'h' ? HIRA : KATA).filter(ch => S.cards[`${script}:${ch}`]).length;
  return h('div',
    h('div.track-head', h('div.stack', { style: { gap: '4px' } }, h('div.eyebrow', 'Dojo'), h('h1', 'Kana chart'), h('p.muted', `${learnedN} of ${HIRA.length} learned. Tap any character to hear it and watch its strokes.`)), tabs),
    h('div.legend', h('span', h('i', { style: { background: 'var(--gold)' } }), 'learning'), h('span', h('i', { style: { background: 'color-mix(in srgb, var(--ok) 60%, transparent)' } }), 'young'), h('span', h('i', { style: { background: 'var(--ok)' } }), 'mature')),
    h('section.card', grid), h('section.card.stack', h('h3', 'Combinations (yōon)'), h('p.muted.small', 'A small ゃ ゅ ょ after an i-column kana merges the two sounds into one beat: き + ゃ → きゃ (kya).'), yoon),
    h('section.card.stack', h('h3', 'Two more rules'), h('p', h('b', 'Small っ/ッ'), ' doubles the next consonant with a tiny pause: きって (kitte, stamp). ', h('b', 'ー'), ' in katakana lengthens the vowel: コーヒー (kōhī, coffee). In hiragana a long vowel is written with a vowel kana: おかあさん, がくせい (sei is read sē).')));
};
function kanaModal(ch, script) {
  const romaji = KANA_ROMAJI[ch]; const key = `${script}:${ch}`; const c = S.cards[key];
  const { box, replay } = strokeBox(ch);
  let close = () => {};
  const dlg = h('div.modal', { role: 'dialog', 'aria-label': ch },
    h('div.row.between', h('h2', `${ch} · ${romaji}`), h('button.icon-btn', { 'aria-label': 'Close', onclick: close }, icon('x'))),
    h('div.teach-hero', h('div.stack', { style: { justifyItems: 'center' } }, box, replay), h('div.stack',
      h('div.row', speakBtn(ch), h('span.chip.' + cardStage(c), cardStage(c)), c ? h('span.muted.small', `next review ${c.due <= now() ? 'now' : 'in ' + fmtIvl(c.due - now())}`) : null),
      KANA_MN[ch] ? h('div.mnemonic', KANA_MN[ch]) : null,
      h('div.muted.small', `Pair: ${script === 'h' ? toKata(ch) : toHira(ch)}`),
      h('div.row', h('button.btn.sm', { onclick: () => { close(); App.go('write', { chars: ch }); } }, icon('brush'), 'Write it'), !c ? h('button.btn.sm', { onclick: () => { addCardsFromKeys([key]); toast('Added to reviews'); close(); App.render(); } }, icon('plus'), 'Add to reviews') : null))));
  close = openModal(dlg); Voice.say(ch);
}

// ─── Writing practice ─────────────────────────────────────────────────────
VIEWS.write = (p) => {
  const sets = {
    'Hiragana': HIRA.join(''), 'Katakana': KATA.join(''),
    'Kanji N5': KANJI.filter(k => k.lv === 5).map(k => k.k).join(''), 'Kanji N4': KANJI.filter(k => k.lv === 4).map(k => k.k).join(''),
    'My learned kana & kanji': Object.keys(S.cards).filter(k => /^[hkj]:/.test(k)).map(k => k.slice(2)).join(''),
  };
  let chars = [...(p.chars || sets.Hiragana)].filter(c => STROKES[c]); if (!chars.length) chars = [...sets.Hiragana];
  let idx = 0, mode = 'trace';
  const host = h('div');
  const setPick = h('select#writeSet', { 'aria-label': 'Character set', onchange: e => { const v = sets[e.target.value]; if (v) App.go('write', { chars: v }); } },
    h('option', { value: '' }, 'Choose a set…'), Object.entries(sets).filter(([, v]) => v).map(([k]) => h('option', { value: k }, k)));
  const render = () => {
    const ch = chars[idx]; const refs = STROKES[ch] || [];
    const info = KANJI_BY[ch]; const romaji = KANA_ROMAJI[ch];
    const pad = writingPad(ch, mode, (res) => {
      list.replaceChildren(...refs.map((_, i) => h('i', { class: res.strokes[i] == null ? '' : res.strokes[i] ? 'ok' : 'no' }, String(i + 1))));
      if (res.complete) {
        const score = Math.round(res.score * 100);
        verdict.replaceChildren(h('div.feedback.' + (res.score >= .8 ? 'ok' : 'no'), h('strong', res.score === 1 ? '完璧！ Perfect strokes' : res.score >= .8 ? `Good — ${score}%` : `${score}%. Watch the red strokes`), h('span.ans', res.extra || (res.score < 1 ? 'Red numbers mark strokes drawn in the wrong place, order or direction.' : 'Order and direction all correct.'))));
        if (res.score >= .8) { addXP(res.score === 1 ? 4 : 2); Sfx.ok(); } else Sfx.bad();
        window.Fun?.event?.('write', { ok: res.score >= .8 });
        aiBtn.hidden = !Sensei.available;
      }
    });
    const list = h('div.stroke-list', refs.map((_, i) => h('i', String(i + 1))));
    const verdict = h('div');
    const aiBtn = h('button.btn.sm', { hidden: true, onclick: async () => {
      aiBtn.disabled = true; aiBtn.textContent = 'Sensei is looking…';
      try { const blob = await pad.snapshot(); const t = await Sensei.gradeHandwriting(ch, blob); verdict.append(h('div.card.md', { style: { marginTop: '10px' }, html: md(t) })); }
      catch (e) { verdict.append(h('p.muted.small', Sensei.errorText(e))); }
      aiBtn.remove();
    } }, icon('sparkle'), 'Ask Sensei to critique my writing');
    const { box, replay } = strokeBox(ch);
    host.replaceChildren(h('div.writer',
      h('div.stack', pad.el, h('div.row.between', h('div.tabs', [['trace', 'Trace'], ['recall', 'From memory']].map(([id, l]) => h('button', { 'aria-selected': mode === id ? 'true' : 'false', onclick: () => { mode = id; render(); } }, l))),
        h('div.row', h('button.btn.sm', { onclick: () => pad.undo() }, icon('undo'), 'Undo'), h('button.btn.sm', { onclick: () => render() }, 'Clear')))),
      h('div.stack',
        h('div.row.between', h('div', h('div', { style: { font: '600 2.2rem/1.2 var(--f-jp-hand)' } }, ch), h('div.muted', romaji ? `${romaji} · ${refs.length} strokes` : info ? `${info.m} · ${refs.length} strokes` : '')), h('div.row', speakBtn(romaji ? ch : (info?.ex?.[0]?.[1] || ch)))),
        list, verdict, aiBtn,
        h('details', h('summary', { style: { cursor: 'pointer', fontWeight: 700 } }, 'Show stroke order'), h('div.stack', { style: { marginTop: '10px', justifyItems: 'start' } }, box, replay)),
        h('div.row.between', h('button.btn', { disabled: idx === 0 ? true : null, onclick: () => { idx--; render(); } }, icon('back'), 'Prev'), h('span.muted.small', `${idx + 1} / ${chars.length}`), h('button.btn.primary', { onclick: () => { idx = (idx + 1) % chars.length; render(); } }, 'Next')))));
  };
  render();
  return h('div', h('div.track-head', h('div.stack', { style: { gap: '4px' } }, h('div.eyebrow', 'Dojo'), h('h1', 'Writing'), h('p.muted', 'Draw with a finger, stylus or mouse. Trace first, then write from memory.')), h('div', { style: { minWidth: '220px' } }, setPick)), h('section.card.pad-lg', host));
};
// Hidden SVG used to sample reference stroke paths.
let _sampler;
function samplePath(d, n = 8) {
  if (!_sampler) { _sampler = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); _sampler.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden'); document.body.append(_sampler); }
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); _sampler.append(p);
  const L = p.getTotalLength(), pts = []; for (let i = 0; i < n; i++) { const q = p.getPointAtLength(L * i / (n - 1)); pts.push([q.x, q.y]); }
  p.remove(); return pts;
}
function resample(pts, n = 8) {
  if (pts.length < 2) return Array(n).fill(pts[0] || [0, 0]);
  const d = [0]; for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = d[d.length - 1] || 1, out = []; let j = 0;
  for (let i = 0; i < n; i++) { const t = L * i / (n - 1); while (j < d.length - 2 && d[j + 1] < t) j++; const seg = (d[j + 1] - d[j]) || 1, f = (t - d[j]) / seg; out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f]); }
  return out;
}
function writingPad(ch, mode, onUpdate) {
  const refs = STROKES[ch] || []; const refPts = refs.map(d => samplePath(d));
  const el = h('div.pad'); const cv = h('canvas'); el.append(h('div.ghost', mode === 'trace' ? ch : ''), cv);
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 109 109'); el.append(svg);
  const strokes = []; let cur = null; const results = [];
  const ctx = cv.getContext('2d');
  const size = () => { const r = el.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; cv.width = r.width * dpr; cv.height = r.height * dpr; redraw(); };
  const toUnit = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 109, (e.clientY - r.top) / r.height * 109]; };
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#17202e';
  const redraw = () => {
    ctx.clearRect(0, 0, cv.width, cv.height); const k = cv.width / 109;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    strokes.concat(cur ? [cur] : []).forEach((s, i) => {
      ctx.strokeStyle = results[i] === false ? getComputedStyle(document.documentElement).getPropertyValue('--bad').trim() : ink;
      ctx.lineWidth = 5 * k; ctx.beginPath(); s.forEach(([x, y], j) => j ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k)); ctx.stroke();
    });
    // hint: in trace mode show the next reference stroke faintly with a start dot
    svg.innerHTML = '';
    const nx = strokes.length;
    if (mode === 'trace' && nx < refs.length) {
      const p = document.createElementNS(ns, 'path'); p.setAttribute('d', refs[nx]); p.setAttribute('style', 'fill:none;stroke:var(--ai);stroke-width:3;stroke-dasharray:3 3;opacity:.7;stroke-linecap:round'); svg.append(p);
      const [sx, sy] = refPts[nx][0]; const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', sx); c.setAttribute('cy', sy); c.setAttribute('r', 3.2); c.setAttribute('style', 'fill:var(--seal)'); svg.append(c);
    }
    results.forEach((ok, i) => { if (ok === false && refs[i]) { const p = document.createElementNS(ns, 'path'); p.setAttribute('d', refs[i]); p.setAttribute('style', 'fill:none;stroke:var(--ok);stroke-width:2.2;opacity:.9;stroke-linecap:round'); svg.append(p); } });
  };
  const judge = (i) => {
    const ref = refPts[i]; if (!ref) return false;
    const u = resample(strokes[i]); let sum = 0; for (let j = 0; j < u.length; j++) sum += Math.hypot(u[j][0] - ref[j][0], u[j][1] - ref[j][1]);
    const avg = sum / u.length, startD = Math.hypot(u[0][0] - ref[0][0], u[0][1] - ref[0][1]), endD = Math.hypot(u[u.length - 1][0] - ref[ref.length - 1][0], u[u.length - 1][1] - ref[ref.length - 1][1]);
    return avg < 17 && startD < 24 && endD < 26;
  };
  const report = () => {
    const complete = strokes.length >= refs.length;
    const okN = results.filter(Boolean).length;
    onUpdate({ strokes: refs.map((_, i) => results[i] ?? null), complete, score: complete ? okN / Math.max(refs.length, strokes.length) : 0, extra: strokes.length > refs.length ? `You drew ${strokes.length} strokes; ${ch} has ${refs.length}.` : '' });
  };
  let pid = null;
  cv.addEventListener('pointerdown', e => { if (cur || strokes.length >= refs.length + 2) return; pid = e.pointerId; cv.setPointerCapture(e.pointerId); cur = [toUnit(e)]; redraw(); });
  cv.addEventListener('pointermove', e => { if (!cur || e.pointerId !== pid) return; const pts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; pts.forEach(pe => cur.push(toUnit(pe))); redraw(); });
  const end = e => { if (!cur || (e && e.pointerId !== pid)) return; if (cur.length < 2) cur.push([cur[0][0] + .5, cur[0][1] + .5]); strokes.push(cur); cur = null; const i = strokes.length - 1; results[i] = i < refs.length ? judge(i) : false; redraw(); report(); };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  const ro = new ResizeObserver(size); ro.observe(el);
  return {
    el,
    undo() { strokes.pop(); results.pop(); redraw(); report(); },
    snapshot() { // white background PNG for Claude
      const c2 = document.createElement('canvas'); c2.width = 436; c2.height = 436; const g = c2.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 436, 436);
      g.strokeStyle = '#111'; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 18; strokes.forEach(s => { g.beginPath(); s.forEach(([x, y], j) => j ? g.lineTo(x * 4, y * 4) : g.moveTo(x * 4, y * 4)); g.stroke(); });
      return new Promise(r => c2.toBlob(r, 'image/png'));
    },
  };
}

// ─── Kana Blitz ───────────────────────────────────────────────────────────
VIEWS.blitz = () => {
  let pool = 'h';
  const host = h('div');
  const intro = () => host.replaceChildren(h('div.qcard', h('div.result-hero',
    h('span.hanko', { style: { width: '80px', height: '80px', fontSize: '2.2rem' } }, '速'), h('h2', 'Kana Blitz'),
    h('p.muted', 'Type the romaji for each kana. 60 seconds. Streaks of correct answers multiply your score.'),
    h('div.tabs', [['h', 'Hiragana'], ['k', 'Katakana'], ['hk', 'Both']].map(([id, l]) => h('button', { 'aria-selected': pool === id ? 'true' : 'false', onclick: () => { pool = id; intro(); } }, l))),
    h('div', `High score: ${S.blitzBest || 0}`),
    h('button.btn.primary', { onclick: start }, icon('play'), 'Start'))));
  const start = () => {
    const chars = (pool.includes('h') ? HIRA : []).concat(pool.includes('k') ? KATA : []);
    let score = 0, streak = 0, n = 0, right = 0, end = now() + 60000, cur = pick(chars); const misses = {};
    const big = h('div.kana', cur); const inp = h('input#blitzIn', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Romaji' });
    const timer = h('i', { style: { width: '100%', transition: 'none' } }); const sc = h('b', '0'); const mult = h('span.chip', '×1');
    host.replaceChildren(h('div.qcard', h('div.row.between', h('div', 'Score ', sc), mult), h('div.bar', timer), h('div.qbig.gridpaper', big), h('div.typein', inp)));
    inp.focus();
    inp.addEventListener('input', () => {
      const v = normRomaji(inp.value); const r = normRomaji(KANA_ROMAJI[cur]);
      if (v === r || (cur === 'を' || cur === 'ヲ') && v === 'o') {
        n++; right++; streak++; const m = 1 + Math.floor(streak / 5); score += 10 * m; sc.textContent = score; mult.textContent = `×${m}`; Sfx.tick();
        let nx; do { nx = pick(chars); } while (nx === cur); cur = nx; big.textContent = cur; inp.value = '';
      } else if (v.length >= r.length + 1 || (v.length >= r.length && !r.startsWith(v.slice(0, r.length)))) {
        misses[cur] = (misses[cur] || 0) + 1; streak = 0; mult.textContent = '×1'; n++; inp.classList.add('wrong'); setTimeout(() => inp.classList.remove('wrong'), 250);
        big.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], 250);
        inp.value = ''; const shown = h('div.hint', `${cur} = ${KANA_ROMAJI[cur]}`); big.parentElement.append(shown); setTimeout(() => shown.remove(), 900);
        let nx; do { nx = pick(chars); } while (nx === cur); cur = nx; big.textContent = cur;
      }
    });
    const tick = setInterval(() => {
      const left = end - now(); timer.style.width = `${Math.max(0, left / 600)}%`;
      if (left <= 0) {
        clearInterval(tick); const best = S.blitzBest || 0; const rec = score > best; if (rec) S.blitzBest = score; addXP(Math.round(score / 20));
        const missList = Object.entries(misses).sort((a, b) => b[1] - a[1]);
        Sfx.done(); if (rec) petals();
        host.replaceChildren(h('div.qcard', h('div.result-hero', h('span.hanko.stamp', rec ? '新' : '終'), h('h2', rec ? 'New high score!' : 'Time!'),
          h('div', { style: { font: '400 3rem/1 var(--f-display)' } }, String(score)), h('p.muted', `${right} correct · ${n ? Math.round(right / n * 100) : 0}% accuracy · ${n - right} missed`),
          missList.length ? h('div.row', { style: { justifyContent: 'center' } }, missList.slice(0, 12).map(([c, k]) => h('span.chip.seal', `${c} ${KANA_ROMAJI[c]} ×${k}`))) : null,
          h('div.row', { style: { justifyContent: 'center' } }, h('button.btn.primary', { onclick: start }, 'Again'), h('button.btn', { onclick: intro }, 'Change set')))));
      }
    }, 100);
    App.cleanup = () => clearInterval(tick);
  };
  intro();
  return h('div', h('div.stack', { style: { gap: '4px' } }, h('div.eyebrow', 'Dojo'), h('h1', 'Kana Blitz')), h('div.study', host));
};

// ─── Conjugation Gym ──────────────────────────────────────────────────────
VIEWS.conj = () => {
  const cfg = Object.assign({ kind: 'verb', forms: ['masu', 'te', 'nai', 'ta'], learnedOnly: CONJ_VERBS().filter(v => S.cards['v:' + v.id]).length >= 10 }, (() => { try { return JSON.parse(localStorage.getItem('michi.conj') || 'null'); } catch (e) { return null; } })() || {});
  const saveCfg = () => { try { localStorage.setItem('michi.conj', JSON.stringify(cfg)); } catch (e) {} };
  const host = h('div'); let score = 0, n = 0;
  const formsFor = () => cfg.kind === 'verb' ? CONJ_FORMS : ADJ_FORMS;
  const settings = () => h('section.card.stack',
    h('div.row.between', h('div.tabs', [['verb', 'Verbs'], ['adj', 'Adjectives']].map(([id, l]) => h('button', { 'aria-selected': cfg.kind === id ? 'true' : 'false', onclick: () => { cfg.kind = id; cfg.forms = id === 'verb' ? ['masu', 'te', 'nai', 'ta'] : ['a-neg', 'a-past']; saveCfg(); App.render(); } }, l))),
      h('label.row.small', { style: { gap: '6px' } }, h('input', { type: 'checkbox', id: 'conjLearned', checked: cfg.learnedOnly ? true : null, onchange: e => { cfg.learnedOnly = e.target.checked; saveCfg(); ask(); } }), 'Only words I have learned')),
    h('details', h('summary', { style: { cursor: 'pointer', fontWeight: 700 } }, `Forms: ${cfg.forms.map(id => formsFor().find(f => f.id === id)?.jp).filter(Boolean).join(' ')}`), h('div.row', { style: { gap: '6px', marginTop: '10px' } }, formsFor().map(f => h('button.chip' + (cfg.forms.includes(f.id) ? '.new' : ''), { style: { cursor: 'pointer', border: 0, padding: '6px 11px' }, onclick: () => { cfg.forms = cfg.forms.includes(f.id) ? cfg.forms.filter(x => x !== f.id) : cfg.forms.concat(f.id); if (!cfg.forms.length) cfg.forms = [f.id]; saveCfg(); App.render(); } }, `${f.jp} ${f.label}`)))));
  const ask = () => {
    let pool = cfg.kind === 'verb' ? CONJ_VERBS() : CONJ_ADJS();
    if (cfg.learnedOnly) { const l = pool.filter(v => S.cards['v:' + v.id]); if (l.length >= 3) pool = l; }
    if (!pool.length) { host.replaceChildren(h('div.empty', 'No words available yet.')); return; }
    let v, f, ans;
    for (let t = 0; t < 60; t++) { v = pick(pool); const fid = pick(cfg.forms); f = formsFor().find(x => x.id === fid) || formsFor()[0]; ans = conjugate(v, f.id); if (ans && conjNatural(v, f.id)) break; }
    if (!ans) { f = formsFor()[0]; ans = conjugate(v, f.id); }
    const inp = h('input#conjIn', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', lang: 'ja', placeholder: 'type romaji → かな', 'aria-label': 'Conjugated form' }); bindIME(inp);
    const fb = h('div');
    const submit = e => {
      e.preventDefault(); if (inp.readOnly || !inp.value.trim()) return;
      const ok = conjAccepts(v, f.id, inp.value); n++; if (ok) { score++; addXP(2); Sfx.ok(); } else Sfx.bad();
      inp.readOnly = true; inp.classList.add(ok ? 'right' : 'wrong');
      const wr = writtenConj(v, ans);
      Voice.say(ans);
      const nextB = h('button.btn.primary', { type: 'button', onclick: ask }, 'Next', h('span.kbd', 'Enter'));
      fb.replaceChildren(h('div.feedback.' + (ok ? 'ok' : 'no'), h('strong', ok ? '正解！' : 'Not quite'), h('div.ans', { html: `${wr !== ans ? ruby(wr, ans) + ' · ' : ''}${esc(ans)}` }), h('div.ans.small', conjRule(v, f.id)), h('div.row.between', h('span.muted.small', `${score}/${n} this session`), nextB)));
      setTimeout(() => nextB.focus(), 30);
    };
    host.replaceChildren(h('div.qcard',
      h('div.q', `Make the ${f.label} form`, h('span.chip', { style: { marginLeft: '8px' } }, f.jp)),
      h('div.qbig', h('div.word', { html: ruby(v.w, v.r) }), h('div.hint', `${v.m} · ${POS_NAME[v.pos] || v.pos}`)),
      h('form.typein', { onsubmit: submit }, inp, h('button.btn.primary', 'Check')), fb));
    setTimeout(() => inp.focus(), 50);
  };
  ask();
  return h('div', h('div.stack', { style: { gap: '4px' } }, h('div.eyebrow', 'Dojo'), h('h1', 'Conjugation Gym'), h('p.muted', 'Type in kana (romaji converts as you type). Pick the forms you want to drill.')), settings(), h('div.study', host));
};

// ─── Numbers & counters ───────────────────────────────────────────────────
VIEWS.numbers = () => {
  let mode = 'read';
  const host = h('div'); const modeTabs = h('div.tabs');
  const modes = [['read', 'Read numbers'], ['listen', 'Hear → digits'], ['price', 'Prices'], ['counters', 'Counters'], ['time', 'Time & dates']];
  const drawTabs = () => modeTabs.replaceChildren(...modes.map(([id, l]) => h('button', { 'aria-selected': mode === id ? 'true' : 'false', onclick: () => { mode = id; drawTabs(); ask(); } }, l)));
  const ask = () => {
    let prompt, answers, say, hint = '', digits = false;
    if (mode === 'read' || mode === 'listen') {
      const mag = pick([10, 100, 1000, 10000, 100000]); const n = 1 + rand(mag * (mag > 1000 ? 1 : 1)) + (mag >= 100 ? rand(9) * mag / 10 : 0);
      const num = Math.min(n, 999999); const r = numReading(num);
      if (mode === 'read') { prompt = h('div.en', { style: { fontSize: 'clamp(2rem,7vw,3rem)', fontVariantNumeric: 'tabular-nums' } }, num.toLocaleString()); hint = numKanji(num); answers = [r, r.replace(/なな/g, 'しち')]; }
      else { prompt = h('button.btn.primary', { style: { width: '84px', height: '84px', borderRadius: '50%' }, onclick: () => Voice.say(r), 'aria-label': 'Play again' }, icon('speaker')); digits = String(num); setTimeout(() => Voice.say(r), 200); }
      say = r;
    } else if (mode === 'price') {
      const n = pick([rand(10) * 10 + 100, rand(90) * 10 + 100, rand(9) * 1000 + rand(10) * 100 + 80, rand(50) * 100 + 1000, 300, 600, 800, 3000, 8000]);
      const r = numReading(n) + 'えん'; prompt = h('div.en', { style: { fontSize: 'clamp(2rem,7vw,3rem)' } }, `¥${n.toLocaleString()}`); hint = `${numKanji(n)}円 — how do you say the price?`; answers = [r, r.replace(/なな/g, 'しち')]; say = r;
    } else if (mode === 'counters') {
      const keys = ['tsu', 'nin', 'hon', 'mai', 'hiki', 'hai', 'ko', 'sai']; const k = pick(keys); const c = COUNTERS[k]; const n = 1 + rand(c.max);
      answers = counterReading(k, n); say = answers[0];
      prompt = h('div.word', `${n}${k === 'tsu' ? 'つ' : c.glyph}`); hint = `Counter for ${c.what}`;
      if (k === 'tsu') prompt = h('div.word', `${n} × (${c.what.split(' ')[0]} things)`);
    } else {
      const k = pick(['ji', 'fun', 'gatsu', 'nichi']); const c = COUNTERS[k]; const n = 1 + rand(c.max);
      answers = counterReading(k, n); say = answers[0]; prompt = h('div.word', `${n}${c.glyph}`); hint = c.what;
    }
    const inp = h('input#numIn', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', lang: digits ? 'en' : 'ja', inputmode: digits ? 'numeric' : null, placeholder: digits ? 'digits, e.g. 3500' : 'type romaji → かな', 'aria-label': 'Answer' });
    if (!digits) bindIME(inp);
    const fb = h('div');
    host.replaceChildren(h('div.qcard', h('div.q', digits ? 'Type the number you hear' : 'Read it aloud, then type the reading'), h('div.qbig', prompt, hint ? h('div.hint.jp', hint) : null),
      h('form.typein', { onsubmit: e => {
        e.preventDefault(); if (inp.readOnly || !inp.value.trim()) return;
        const v = inp.value.trim(); const ok = digits ? v.replace(/[,\s]/g, '') === digits : answers.some(a => kanaAnswerMatches(v, a));
        inp.readOnly = true; inp.classList.add(ok ? 'right' : 'wrong'); ok ? (Sfx.ok(), addXP(2)) : Sfx.bad(); Voice.say(say);
        const nb = h('button.btn.primary', { type: 'button', onclick: ask }, 'Next', h('span.kbd', 'Enter'));
        fb.replaceChildren(h('div.feedback.' + (ok ? 'ok' : 'no'), h('strong', ok ? '正解！' : 'Not quite'), h('div.ans.jp', { style: { fontSize: '1.2rem' } }, digits ? `${Number(digits).toLocaleString()} — ${say}` : answers.filter((a, i, arr) => arr.indexOf(a) === i).join(' / ')), h('div.row', { style: { justifyContent: 'flex-end' } }, nb)));
        setTimeout(() => nb.focus(), 30);
      } }, inp, h('button.btn.primary', 'Check')), fb));
    setTimeout(() => inp.focus(), 50);
  };
  drawTabs(); ask();
  const ref = h('details.card', h('summary', { style: { cursor: 'pointer', fontWeight: 700 } }, 'Sound-change cheat sheet'),
    h('div.stack.small', { style: { marginTop: '12px' } },
      h('p', h('b', 'Hundreds: '), h('span.jp', 'さんびゃく (300) · ろっぴゃく (600) · はっぴゃく (800)')),
      h('p', h('b', 'Thousands: '), h('span.jp', 'さんぜん (3000) · はっせん (8000)')),
      h('p', h('b', 'h-counters (本・匹・杯・分): '), h('span.jp', '1, 6, 8, 10 → っぷ/っぴ/っぱ; 3 → ぶ/び/ば (本 ぼん, 匹 びき, 杯 ばい; 分 is さんぷん)')),
      h('p', h('b', 'k-counters (個・回・階): '), h('span.jp', '1, 6, 8, 10 double: いっこ, ろっこ, はっこ, じゅっこ')),
      h('p', h('b', 'Irregulars: '), h('span.jp', 'ひとり・ふたり, よじ (4時), くじ (9時), しがつ (4月), はつか (20日), はたち (20歳)'))));
  return h('div', h('div.stack', { style: { gap: '4px' } }, h('div.eyebrow', 'Dojo'), h('h1', 'Numbers & counters')), modeTabs, h('div.study', host), ref);
};

// ─── Listening drill ──────────────────────────────────────────────────────
VIEWS.listen = () => {
  const learned = Object.keys(S.cards).filter(k => k[0] === 'v');
  const keys = (learned.length >= 8 ? shuffle(learned) : shuffle(VOCAB.filter(v => v.lv === 5)).map(v => 'v:' + v.id)).slice(0, 15);
  const stage = h('div'); const bar = h('i');
  const wrap = h('div', h('div.stack', { style: { gap: '4px' } }, h('div.eyebrow', 'Dojo'), h('h1', 'Listening drill'), h('p.muted', learned.length >= 8 ? 'Words from your reviews, audio only.' : 'Common N5 words, audio only. Learn a few vocabulary lessons to drill your own words.')),
    h('div.study', h('div.study-top', h('div.bar', bar)), stage));
  if (!Voice.ok) { stage.append(h('div.empty', 'Your browser has no speech voice, so audio drills are unavailable here.')); return wrap; }
  let i = 0, right = 0;
  const next = () => {
    if (i >= keys.length) { Sfx.done(); stage.replaceChildren(h('div.qcard', h('div.result-hero', h('span.hanko.stamp', '聞'), h('h2', `${right}/${keys.length}`), h('button.btn.primary', { onclick: () => App.go('listen') }, 'Another round')))); return; }
    bar.style.width = `${i / keys.length * 100}%`;
    const q = makeQuestion(keys[i], 'a2m'); i++;
    renderQuestion(stage, q, ok => { if (ok) { right++; addXP(1); } }, next);
  };
  next();
  return wrap;
};
