// ─── Fun: quests, chests, streak freezes, stamps, celebrations, juice ─────
// Everything lives under S.fun (created lazily). The app reports activity through Fun.event(type, data).
const Fun = (() => {
  const DEF = { quests: null, chests: 0, opened: 0, sinceRare: 0, freezes: 0, multUntil: 0, stamps: {}, seen: {}, bests: {}, ms: {}, level: 0, bestStreak: 0, maxCombo: 0, perfects: 0, questDays: 0, haptics: true, seeded: false };
  const F = () => { const f = S.fun || (S.fun = {}); for (const k in DEF) if (f[k] === undefined) f[k] = JSON.parse(JSON.stringify(DEF[k])); return f; };
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hash = s => { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) | 0; return Math.abs(x); };
  const MAX_FREEZE = 2, MULT_MIN = 15, MILESTONES = [3, 7, 14, 30, 50, 100];
  const dayOn = k => S.days[k]?.xp > 0 || !!S.days[k]?.frozen;
  const streakN = () => { let n = 0, t = now(); if (!dayOn(dayKey(t))) t = dayBefore(t); while (dayOn(dayKey(t))) { n++; t = dayBefore(t); } return n; };

  ICONS.snow = '<path d="M12 2v20M4 7l16 10M20 7L4 17M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5" fill="none"/>';
  ICONS.crown = '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>';

  // ── Haptics & sounds ────────────────────────────────────────────────────
  const buzz = p => { if (!F().haptics) return; try { navigator.vibrate?.(p); } catch (e) {} };
  const HAPTIC = { ok: 12, bad: [28, 40, 28], stamp: 22, cheer: [18, 50, 18, 50, 70] };
  const Snd = (() => {
    let ctx;
    const tone = (f, t0, dur, type = 'triangle', vol = 0.1, slide) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + t0;
      o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.02);
    };
    const play = fn => { if (!S.settings.sound) return; try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); fn(); } catch (e) {} };
    return {
      stamp: () => play(() => { tone(140, 0, 0.16, 'sine', 0.22, 60); tone(2400, 0, 0.03, 'square', 0.02); }),
      quest: () => play(() => { tone(140, 0, 0.14, 'sine', 0.2, 60); [784, 1046.5].forEach((f, i) => tone(f, 0.08 + i * 0.08, 0.22)); }),
      chest: () => play(() => [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => tone(f, i * 0.06, 0.35, 'triangle', 0.08))),
      fanfare: () => play(() => { [392, 523.25, 659.25].forEach((f, i) => tone(f, i * 0.11, 0.2)); [783.99, 1046.5].forEach(f => tone(f, 0.36, 0.7, 'triangle', 0.09)); }),
    };
  })();

  // ── Celebration queue: big moments wait until the learner is not mid-question ──
  const BUSY = ['lesson', 'session', 'blitz', 'kana', 'write', 'conj', 'numbers', 'listen', 'placement', 'grammar', 'story', 'register'];
  const busy = () => BUSY.includes(App.route) && !$('.result-hero');
  const queue = []; let pumpT = 0;
  function pump(force) {
    clearTimeout(pumpT);
    if (!queue.length) return;
    if ($('.fun-back') || (!force && busy())) { pumpT = setTimeout(pump, 1200); return; }
    queue.shift()();
  }
  const enqueue = (fn, force) => { queue.push(fn); setTimeout(() => pump(force), force ? 900 : 60); };

  function modal(body, { label = 'Celebration', cls = '', onClose } = {}) {
    const prev = document.activeElement;
    const box = h('div.fun-modal' + cls, body);
    const back = h('div.fun-back', { role: 'dialog', 'aria-modal': 'true', 'aria-label': label, onclick: e => { if (e.target === back) close(); } }, box);
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Tab') { const f = $$('button, [href], input', box).filter(x => !x.disabled); if (!f.length) return; const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
      e.stopPropagation(); // keep the lesson's own Enter / 1–4 shortcuts from firing underneath
    };
    let closed = false;
    function close() {
      if (closed) return; closed = true; window.removeEventListener('keydown', onKey, true);
      back.classList.add('out'); setTimeout(() => { back.remove(); pump(); }, reduced() ? 0 : 180);
      try { prev?.focus?.({ preventScroll: true }); } catch (e) {}
      onClose && onClose();
    }
    window.addEventListener('keydown', onKey, true);
    document.body.append(back);
    setTimeout(() => $('.btn.primary, .btn.seal, button', box)?.focus(), 40);
    return { close, box };
  }

  // ── Stamps: catalog ─────────────────────────────────────────────────────
  const SEASONS = [['spring', '春', 'Spring', [3, 4, 5], 'Study on any day in March–May'], ['summer', '夏', 'Summer', [6, 7, 8], 'Study on any day in June–August'], ['autumn', '秋', 'Autumn', [9, 10, 11], 'Study on any day in September–November'], ['winter', '冬', 'Winter', [12, 1, 2], 'Study on any day in December–February']];
  const RARE = [['crane', '鶴', 'Crane'], ['dragon', '龍', 'Dragon'], ['koi', '鯉', 'Koi'], ['fox', '狐', 'Fox'], ['turtle', '亀', 'Turtle'], ['rabbit', '兎', 'Moon rabbit'], ['phoenix', '鳳', 'Phoenix'], ['cat', '招', 'Lucky cat']];
  let CAT = null;
  function catalog() {
    if (CAT) return CAT;
    const md = () => { const d = new Date(); return [d.getMonth() + 1, d.getDate()]; };
    const studied = () => (S.days[dayKey()]?.xp || 0) > 0;
    const all = (list, fn) => list.length > 0 && list.every(fn);
    const kanaRows = s => [...KANA_ROWS.map(([id, label, cells]) => [id, label, cells.filter(Boolean).map(c => s === 'h' ? c[0] : c[1])]), ['yoon', 'Combos', YOON_ROWS.flatMap(([, c]) => c.map(x => s === 'h' ? x[0] : x[1]))]]
      .map(([id, label, chars]) => ({ id: `row-${s}-${id}`, sec: s === 'h' ? 'hira' : 'kata', kind: 'round', g: chars[0], t: `${s === 'h' ? 'Hiragana' : 'Katakana'} · ${label}`, short: label, hint: 'Keep every character in this row stable for 7+ days', test: () => all(chars, c => S.cards[`${s}:${c}`]?.s >= 7) }));
    const jl = (lv, what, g) => {
      const t = { v: `N${lv} vocabulary`, j: `N${lv} kanji`, g: `N${lv} grammar` }[what];
      const test = what === 'g' ? () => all(GRAMMAR_POINTS.filter(p => p.lv === lv), p => S.grammar[p.id]) : what === 'v' ? () => all(VOCAB.filter(v => v.lv === lv), v => S.cards['v:' + v.id] && !S.cards['v:' + v.id].placed) : () => all(KANJI.filter(k => k.lv === lv), k => S.cards['j:' + k.k] && !S.cards['j:' + k.k].placed);
      return { id: `jlpt-${what}${lv}`, sec: 'jlpt', kind: 'seal', g, tag: 'N' + lv, t, hint: what === 'g' ? `Complete every ${t} point` : `Learn every ${t} item`, test };
    };
    CAT = [
      ...SEASONS.map(([id, g, t, months, hint]) => ({ id: 'season-' + id, sec: 'season', kind: 'ai', g, t, hint, test: () => studied() && months.includes(md()[0]) })),
      { id: 'season-shogatsu', sec: 'season', kind: 'ai', g: '正月', t: 'New Year', hint: 'Study on January 1–3', test: () => studied() && md()[0] === 1 && md()[1] <= 3 },
      { id: 'season-tanabata', sec: 'season', kind: 'ai', g: '七夕', t: 'Tanabata', hint: 'Study on July 7', test: () => studied() && md()[0] === 7 && md()[1] === 7 },
      { id: 'season-tsukimi', sec: 'season', kind: 'ai', g: '月見', t: 'Moon viewing', hint: 'Study between Sept 10 and Oct 10', test: () => { const [m, d] = md(); return studied() && (m === 9 && d >= 10 || m === 10 && d <= 10); } },
      ...MILESTONES.map(n => ({ id: 'streak-' + n, sec: 'streak', kind: 'seal', g: numKanji(n), tag: '日', t: `${n}-day streak`, hint: `Study ${n} days in a row`, test: () => F().bestStreak >= n })),
      jl(5, 'v', '語'), jl(5, 'j', '漢'), jl(5, 'g', '文'), jl(4, 'v', '語'), jl(4, 'j', '漢'), jl(4, 'g', '文'),
      { id: 'feat-first', sec: 'feat', kind: 'round', g: '初', t: 'First lesson', hint: 'Finish any lesson', test: () => Object.values(S.lessons).some(l => !l.placed) },
      { id: 'feat-perfect', sec: 'feat', kind: 'round', g: '満', t: 'Flawless', hint: 'Finish a lesson with no mistakes', test: () => F().perfects > 0 },
      { id: 'feat-c25', sec: 'feat', kind: 'round', g: '連', t: 'Combo 25', hint: 'Answer 25 in a row correctly', test: () => F().maxCombo >= 25 },
      { id: 'feat-c50', sec: 'feat', kind: 'round', g: '極', t: 'Combo 50', hint: 'Answer 50 in a row correctly', test: () => F().maxCombo >= 50 },
      { id: 'feat-placed', sec: 'feat', kind: 'round', g: '試', t: 'Placed', hint: 'Take the placement test', test: () => !!(S.placement && !S.placement.skipped) },
      { id: 'feat-chest', sec: 'feat', kind: 'round', g: '宝', t: 'First chest', hint: 'Open a quest chest', test: () => F().opened > 0 },
      { id: 'feat-q7', sec: 'feat', kind: 'round', g: '勤', t: 'Diligent', hint: 'Clear all daily quests on 7 days', test: () => F().questDays >= 7 },
      { id: 'feat-lv10', sec: 'feat', kind: 'round', g: '十', tag: '級', t: 'Level 10', hint: 'Reach level 10', test: () => levelInfo().level >= 10 },
      ...RARE.map(([id, g, t]) => ({ id: 'rare-' + id, sec: 'rare', kind: 'gold', g, t, hint: 'Found only in quest chests', rare: true, quiet: true })),
      ...kanaRows('h'), ...kanaRows('k'),
    ];
    return CAT;
  }
  const SECTIONS = [['season', '季節', 'Seasonal', 'Earned by studying at the right time of year'], ['streak', '連続', 'Streaks', 'Consecutive days of study'], ['jlpt', '試験', 'JLPT', 'Every item of a level learned'], ['feat', '技', 'Feats', 'Moments worth remembering'], ['rare', '珍', 'Rare', 'Only found in quest chests'], ['hira', 'ひらがな', 'Hiragana rows', 'One stamp per row, once every character in it stays stable for 7+ days'], ['kata', 'カタカナ', 'Katakana rows', 'One stamp per row, once every character in it stays stable for 7+ days']];
  const stampDef = id => catalog().find(d => d.id === id);

  function stampEl(d, owned = true, size = '') {
    const g = String(d.g), vert = [...g].length > 1;
    return h(`span.fun-stamp.k-${d.kind}${owned ? '' : '.locked'}${vert ? '.vert' : ''}${size ? '.' + size : ''}`, { style: `--rot:${(hash(d.id) % 15) - 9}deg`, 'aria-hidden': 'true' }, h('b', g), d.tag && !vert ? h('small', d.tag) : null);
  }
  function award(id, quiet) {
    const f = F(); if (f.stamps[id]) return false;
    f.stamps[id] = now();
    const d = stampDef(id);
    if (!quiet && d) { richToast(stampEl(d, true, 'mini'), 'New stamp', d.t); Snd.stamp(); buzz(HAPTIC.stamp); }
    return true;
  }
  function checkStamps(quiet) {
    let n = 0;
    for (const d of catalog()) if (d.test && !F().stamps[d.id]) { let ok = false; try { ok = d.test(); } catch (e) {} if (ok && award(d.id, quiet)) n++; }
    return n;
  }
  const tq = []; let tBusy = false;
  function richToast(visual, eyebrow, text) { if (tq.length < 6) tq.push([visual, eyebrow, text]); if (!tBusy) nextToast(); }
  function nextToast() { // one at a time, so a burst (quest + stamp + combo) reads as a sequence, not a pile
    const x = tq.shift(); if (!x) { tBusy = false; return; } tBusy = true;
    const t = h('div.toast.fun-toast', { role: 'status' }, x[0], h('span', h('small', x[1]), h('b', x[2])));
    $('#toasts')?.append(t); setTimeout(() => t.classList.add('out'), 2200); setTimeout(() => t.remove(), 2700);
    setTimeout(nextToast, tq.length ? 1100 : 0);
  }

  // ── Daily quests ────────────────────────────────────────────────────────
  const nCards = () => Object.keys(S.cards).length;
  const QUESTS = {
    xp: { grp: 'easy', g: '力', t: n => `Earn ${n} XP`, goal: () => S.settings.goal || 50, val: () => today().xp },
    rev: { grp: 'easy', g: '復', t: n => `Review ${n} cards`, goal: () => clamp(Math.round(nCards() / 15) * 5, 10, 20), val: () => today().rev, ok: () => nCards() >= 10 },
    right: { grp: 'answers', g: '正', t: n => `Get ${n} answers right`, goal: () => 30, val: q => q.c.right || 0 },
    combo: { grp: 'answers', g: '連', t: n => `Reach a ${n}-answer combo`, goal: () => 10, val: q => q.c.combo || 0 },
    lesson: { grp: 'lesson', g: '習', t: () => 'Finish a lesson', goal: () => 1, val: q => q.c.lesson || 0 },
    perfect: { grp: 'lesson', g: '満', t: () => 'Finish a lesson with no mistakes', goal: () => 1, val: q => q.c.perfect || 0 },
    acc: { grp: 'review', g: '精', t: () => 'Finish a review at 90%+ accuracy', goal: () => 1, val: q => q.c.acc || 0, ok: () => nCards() >= 10 },
    story: { grp: 'read', g: '読', t: () => 'Read a story', goal: () => 1, val: q => q.c.story || 0, ok: () => STORIES.length > 0 },
    grammar: { grp: 'read', g: '文', t: () => 'Study a grammar point', goal: () => 1, val: q => q.c.grammar || 0, ok: () => GRAMMAR_POINTS.length > 0 },
    write: { grp: 'write', g: '書', t: n => `Write ${n} characters`, goal: () => 5, val: q => q.c.write || 0 },
    sensei: { grp: 'talk', g: '話', t: () => 'Talk to Sensei', goal: () => 1, val: q => q.c.sensei || 0, ok: () => !!window.claude?.use },
  };
  function rollQuests() {
    const f = F(), k = dayKey();
    if (f.quests?.day === k) return f.quests;
    const r = seeded('quests:' + k), ok = id => !QUESTS[id].ok || QUESTS[id].ok();
    const pickR = a => a[Math.floor(r() * a.length)];
    const easy = pickR(['xp', 'rev'].filter(ok));
    const used = new Set([QUESTS[easy].grp]), list = [easy];
    while (list.length < 3) {
      const opts = Object.keys(QUESTS).filter(id => ok(id) && !used.has(QUESTS[id].grp));
      if (!opts.length) break;
      const id = pickR(opts); list.push(id); used.add(QUESTS[id].grp);
    }
    f.quests = { day: k, list: list.map(id => ({ id, goal: QUESTS[id].goal(), done: 0 })), c: {}, all: 0 };
    save();
    return f.quests;
  }
  const qProg = (q, x) => Math.min(x.goal, QUESTS[x.id].val(q));
  const fresh = new Set(); // quests completed this page-load, stamped with animation on next render
  function checkQuests() {
    const q = rollQuests(); let changed = false;
    for (const x of q.list) if (!x.done && qProg(q, x) >= x.goal) {
      x.done = now(); changed = true; fresh.add(x.id);
      richToast(h('span.fun-stamp.k-seal.mini', { style: '--rot:-8deg', 'aria-hidden': 'true' }, h('b', '済')), 'Quest complete', QUESTS[x.id].t(x.goal));
      Snd.quest(); buzz(HAPTIC.stamp);
    }
    if (changed && !q.all && q.list.every(x => x.done)) {
      q.all = now(); const f = F(); f.chests++; f.questDays++;
      enqueue(() => showChest(true));
    }
    if (changed) { save(); refresh(); }
  }
  const questsLeft = () => { const q = rollQuests(); return q.list.filter(x => !x.done).length; };

  // ── Chest ───────────────────────────────────────────────────────────────
  const chestSVG = () => h('div.fun-chest', { 'aria-hidden': 'true', html: '<svg viewBox="0 0 64 58"><g class="lid"><path d="M7 25v-8a9 9 0 0 1 9-9h32a9 9 0 0 1 9 9v8z"/><path class="band" d="M20 8v17M44 8v17"/></g><rect class="box" x="7" y="25" width="50" height="28" rx="3"/><path class="band" d="M20 25v28M44 25v28"/><rect class="clasp" x="27" y="21" width="10" height="12" rx="2"/></svg>' });
  const ODDS = 'Chest odds: 60% bonus XP (20–60) · 25% streak freeze · 15% rare stamp. A rare stamp is guaranteed at least every 6 chests while any remain.';
  function rollChest() {
    const f = F(); f.sinceRare++;
    const unowned = RARE.filter(([id]) => !f.stamps['rare-' + id]);
    const r = Math.random();
    let kind = unowned.length && (f.sinceRare >= 6 || r < 0.15) ? 'rare' : r < 0.40 ? 'freeze' : 'xp', note = '';
    if (kind === 'freeze' && f.freezes >= MAX_FREEZE) { kind = 'xp'; note = 'Your freeze slots are full, so it turned into XP.'; }
    if (kind === 'rare') { const [id] = unowned[Math.floor(Math.random() * unowned.length)]; f.stamps['rare-' + id] = now(); f.sinceRare = 0; return { kind, id: 'rare-' + id }; }
    if (kind === 'freeze') { f.freezes++; return { kind }; }
    const base = note ? 40 : 20 + rand(5) * 10, before = S.xp; addXP(base); const n = S.xp - before || base; return { kind, n, note };
  }
  function showChest(auto) {
    const f = F(); if (f.chests <= 0) return pump();
    const chest = chestSVG(), prize = h('div.fun-prize'), foot = h('div.row', { style: { justifyContent: 'center' } });
    const title = h('h2#funChestT', 'All three quests cleared'), sub = h('p.muted', 'Your chest is ready. Opening it also starts 15 minutes of double XP.');
    let m;
    const open = () => {
      const res = rollChest(); f.chests--; f.opened++; f.multUntil = now() + MULT_MIN * MIN; save();
      chest.classList.add('open'); Snd.chest(); buzz(HAPTIC.cheer); petals(24);
      if (res.kind === 'rare') { const d = stampDef(res.id); prize.replaceChildren(stampEl(d, true, 'big'), h('b', d.t), h('span.chip.seal', 'Rare stamp')); title.textContent = 'A rare stamp!'; }
      else if (res.kind === 'freeze') { prize.replaceChildren(h('span.fun-freeze', icon('snow')), h('b', 'Streak freeze'), h('span.muted.small', `${f.freezes}/${MAX_FREEZE} equipped · covers one missed day automatically`)); title.textContent = 'A streak freeze'; }
      else { prize.replaceChildren(...[h('b.fun-bigxp', `+${res.n} XP`), res.note && h('span.muted.small', res.note)].filter(Boolean)); title.textContent = 'Bonus XP'; }
      prize.classList.add('show');
      sub.replaceChildren(h('span.chip.gold', icon('bolt'), `Double XP for ${MULT_MIN} minutes`));
      foot.replaceChildren(h('button.btn.primary', { onclick: () => m.close() }, f.chests > 0 ? 'Next chest' : 'Collect'));
      if (f.chests > 0) foot.firstChild.onclick = () => { m.close(); enqueue(() => showChest(), true); };
      checkStamps(); refresh(); tickMult();
    };
    foot.append(h('button.btn.seal', { onclick: open }, 'Open chest'), h('button.btn.ghost', { onclick: () => m.close() }, 'Later'));
    m = modal(h('div.fun-cel', chest, title, sub, prize, foot, h('p.fun-odds', ODDS)), { label: 'Quest chest' });
    if (!auto) m.box.querySelector('.btn.seal').focus();
  }

  // ── XP multiplier ───────────────────────────────────────────────────────
  const mult = () => now() < F().multUntil ? 2 : 1;
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  let multT = 0;
  function tickMult() {
    clearTimeout(multT);
    let pill = $('#funMult'); const left = F().multUntil - now();
    if (left <= 0) { pill?.remove(); return; }
    if (!pill) { pill = h('div.fun-mult#funMult', { role: 'status', title: 'Double XP is active' }, icon('bolt'), h('b', '2× XP'), h('span')); document.body.append(pill); }
    pill.lastChild.textContent = mmss(left);
    multT = setTimeout(tickMult, 1000);
  }

  // ── Streak: freezes & milestones ────────────────────────────────────────
  function applyFreezes() {
    const f = F(); if (!f.freezes) return;
    const missed = []; let t = dayBefore(now());
    while (!dayOn(dayKey(t)) && missed.length <= f.freezes) { missed.push(dayKey(t)); t = dayBefore(t); }
    if (!missed.length || missed.length > f.freezes || !dayOn(dayKey(t))) return; // nothing missed, or too many to save
    for (const k of missed) (S.days[k] || (S.days[k] = { xp: 0, rev: 0, new: 0, ok: 0 })).frozen = true;
    f.freezes -= missed.length; save();
    enqueue(() => showCelebrate({ eyebrow: 'Streak protected', glyph: '氷', kind: 'ai', title: `Streak freeze used`, text: `You missed ${missed.length === 1 ? 'a day' : missed.length + ' days'}, so ${missed.length === 1 ? 'a freeze' : 'your freezes'} kept your ${streakN()}-day streak alive. ${f.freezes ? `${f.freezes} left.` : 'Clear your daily quests to win more.'}` }));
  }
  function checkStreak() {
    const f = F(), s = streakN(); if (s > f.bestStreak) f.bestStreak = s;
    if (!(S.days[dayKey()]?.xp > 0)) return;
    const start = dayKey(now() - (s - 1) * DAY);
    const hit = MILESTONES.filter(m => s >= m && !(f.ms[m] >= start));
    if (!hit.length) return;
    hit.forEach(m => f.ms[m] = dayKey());
    const m = hit[hit.length - 1]; let bonus = '';
    if ((m === 7 || m === 30 || m === 100) && f.freezes < MAX_FREEZE) { f.freezes++; bonus = ' You earned a streak freeze.'; }
    save();
    enqueue(() => showCelebrate({ eyebrow: 'Streak milestone', glyph: numKanji(m), tag: '日', title: `${m}-day streak`, text: `${m} days in a row. Habits like this are how Japanese sticks.${bonus}` }));
  }

  // ── Celebration modals ──────────────────────────────────────────────────
  function showCelebrate({ title, glyph = '祝', text = '', eyebrow = '', kind = 'seal', tag, action }) {
    Snd.fanfare(); buzz(HAPTIC.cheer); petals(26);
    let m;
    const foot = h('div.row', { style: { justifyContent: 'center' } }, action ? h('button.btn.primary', { onclick: () => { m.close(); action.fn(); } }, action.label) : null, h('button.btn' + (action ? '' : '.primary'), { onclick: () => m.close() }, 'Continue'));
    m = modal(h('div.fun-cel', stampEl({ id: title, g: glyph, kind, tag }, true, 'big'), eyebrow ? h('div.eyebrow', eyebrow) : null, h('h2', title), text ? h('p.muted', text) : null, foot), { label: title });
  }
  function showLevelUp(level) {
    Snd.fanfare(); buzz(HAPTIC.cheer); petals(40);
    const words = Object.keys(S.cards).filter(k => k[0] === 'v').length, kanji = Object.keys(S.cards).filter(k => k[0] === 'j').length;
    const stat = (b, s) => h('div', h('b', b), h('span', s));
    let m;
    const card = h('div.fun-share.gridpaper',
      h('div.fun-share-top', h('span.fun-brand', '道'), h('span', 'Michi'), h('span.muted', new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }))),
      stampEl({ id: 'lv' + level, g: numKanji(level), kind: 'seal', tag: '級' }, true, 'huge'),
      h('div.eyebrow', 'Level up · 昇級'), h('h2.fun-lv', `Level ${level}`),
      h('div.fun-share-stats', stat(String(streakN()), 'day streak'), stat(String(words), 'words'), stat(String(kanji), 'kanji'), stat(S.xp.toLocaleString(), 'XP')));
    m = modal(h('div.fun-cel', card, h('div.row', { style: { justifyContent: 'center' } }, h('button.btn.primary', { onclick: () => m.close() }, 'Keep going'))), { label: `Level ${level}`, cls: '.wide' });
  }
  function stampDetail(d) {
    const at = F().stamps[d.id]; let m;
    m = modal(h('div.fun-cel', stampEl(d, !!at, 'big'), h('h2', d.t), h('p.muted', at ? `Collected ${new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}` : d.hint), h('button.btn.primary', { onclick: () => m.close() }, 'Close')), { label: d.t });
  }

  // ── XP floater & combo meter ────────────────────────────────────────────
  function floatXP(n, anchor) {
    if (!n) return;
    const a = anchor?.isConnected ? anchor : ($('#xpPill')?.offsetParent ? $('#xpPill') : null);
    const r = a ? a.getBoundingClientRect() : { left: innerWidth / 2, width: 0, top: innerHeight / 2 };
    const el = h('div.fun-float' + (mult() > 1 ? '.x2' : ''), { 'aria-hidden': 'true', style: `left:${clamp(r.left + r.width / 2, 40, innerWidth - 40)}px;top:${clamp(r.top, 60, innerHeight - 40)}px` }, `+${n} XP`, mult() > 1 ? h('small', '×2') : null);
    document.body.append(el); setTimeout(() => el.remove(), reduced() ? 700 : 1100);
  }
  function combo(el, c, fallback = '') {
    if (!el) return;
    const prev = +el.dataset.c || 0; el.dataset.c = c;
    el.classList.add('fun-combo');
    if (c < 3) { el.dataset.heat = 0; el.replaceChildren(fallback); el.removeAttribute('title'); return; }
    el.dataset.heat = c >= 20 ? 4 : c >= 10 ? 3 : c >= 5 ? 2 : 1;
    el.title = `${10 - c % 10} more for a +5 XP combo bonus`;
    el.replaceChildren(icon('flame'), h('b', String(c)), h('span.fun-meter', h('i', { style: `width:${(c % 10) * 10}%` })));
    if (c > prev) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
  }

  // ── Components ──────────────────────────────────────────────────────────
  function questsCard() {
    const q = rollQuests(), f = F(), done = q.list.filter(x => x.done).length;
    const mid = new Date(); mid.setHours(24, 0, 0, 0); const left = mid - now();
    const rows = q.list.map(x => {
      const Q = QUESTS[x.id], p = qProg(q, x), anim = fresh.delete(x.id);
      return h('li.fun-q' + (x.done ? '.done' : ''),
        h('span.fun-slot-sm', x.done ? h('span.fun-stamp.k-seal.mini' + (anim ? '.stamp' : ''), { style: `--rot:${(hash(x.id) % 12) - 8}deg` }, h('b', '済')) : h('span.jp', Q.g)),
        h('div.fun-q-body', h('div.fun-q-t', Q.t(x.goal)), h('div.bar' + (x.done ? '.ok' : ''), h('i', { style: `width:${p / x.goal * 100}%` }))),
        h('span.fun-q-n', `${p}/${x.goal}`));
    });
    const chestState = f.chests > 0 ? 'ready' : q.all ? 'open' : 'locked';
    const chest = h('button.fun-chestbtn.' + chestState, { type: 'button', disabled: chestState !== 'ready' ? true : null, onclick: () => showChest(), 'aria-label': chestState === 'ready' ? 'Open your quest chest' : chestState === 'open' ? 'Chest opened today' : 'Chest opens when all three quests are done' },
      chestSVG(), h('span', chestState === 'ready' ? 'Open chest' : chestState === 'open' ? 'Opened' : `${done}/3`));
    const m = mult();
    return h('section.card.fun-quests',
      h('div.fun-quests-head', h('div', h('div.eyebrow', '今日の任務 · Daily quests'), h('h3', done === 3 ? 'All clear. お疲れさま！' : `${3 - done} quest${3 - done === 1 ? '' : 's'} left today`)), chest),
      h('ul.fun-qlist', rows),
      h('div.fun-quests-foot', m > 1 ? h('span.chip.gold', icon('bolt'), `2× XP · ${mmss(f.multUntil - now())} left`) : h('span.muted.small', `Resets in ${Math.floor(left / 3600000)}h ${Math.floor(left / 60000) % 60}m`),
        h('button.btn.sm.ghost', { onclick: () => App.go('stamps') }, h('span.fun-stamp.k-seal.micro', { style: '--rot:-6deg' }, h('b', '印')), `Stamp book · ${Object.keys(f.stamps).length}`)));
  }
  function streakBanner() {
    const s = streakN(), hr = new Date().getHours(), f = F();
    if (hr < 18 || (S.days[dayKey()]?.xp || 0) > 0 || s < 1) return null;
    const mid = new Date(); mid.setHours(24, 0, 0, 0); const left = mid - now();
    const go = () => { if (dueCards().length) startReview(); else { const n = nextLesson(); n ? App.go('lesson', { id: n.id }) : App.go('practice'); } };
    return h('section.fun-risk', { role: 'status' },
      h('span.fun-stamp.k-seal', { style: '--rot:-7deg', 'aria-hidden': 'true' }, h('b', '火')),
      h('div.fun-risk-body', h('b', `Your ${s}-day streak ends at midnight`),
        h('span', `${Math.floor(left / 3600000)}h ${Math.floor(left / 60000) % 60}m left. Any XP keeps it going${f.freezes ? ` — and you have ${f.freezes} freeze${f.freezes > 1 ? 's' : ''} as backup.` : '.'}`)),
      h('button.btn.seal.sm', { onclick: go }, dueCards().length ? 'Quick review' : 'Quick lesson'));
  }
  function weekCard() {
    const d0 = new Date(); d0.setHours(12, 0, 0, 0); const dow = (d0.getDay() + 6) % 7, mon = d0.getTime() - dow * DAY;
    const xpOf = t => S.days[dayKey(t)]?.xp || 0;
    let thisW = 0, lastW = 0; for (let i = 0; i < 7; i++) { thisW += i <= dow ? xpOf(mon + i * DAY) : 0; lastW += xpOf(mon + (i - 7) * DAY); }
    const max = Math.max(thisW, lastW, 1), f = F();
    const dots = 'MTWTFSS'.split('').map((L, i) => { const k = dayKey(mon + i * DAY), st = i > dow ? 'future' : S.days[k]?.xp > 0 ? 'on' : S.days[k]?.frozen ? 'frozen' : i === dow ? 'today' : 'off';
      return h('div.fun-dot', { 'data-s': st, title: `${k}: ${st === 'frozen' ? 'streak freeze' : (S.days[k]?.xp || 0) + ' XP'}` }, h('i', st === 'on' ? icon('check') : st === 'frozen' ? icon('snow') : null), h('span', L)); });
    const msg = thisW >= lastW ? (lastW ? `${Math.round((thisW / lastW - 1) * 100)}% ahead of last week` : 'Your best start in two weeks') : `${lastW - thisW} XP to beat last week`;
    const bar = (label, n, cls) => h('div.fun-wbar', h('span', label), h('div.bar' + cls, h('i', { style: `width:${n / max * 100}%` })), h('b', n.toLocaleString()));
    return h('section.card.fun-week',
      h('div.row.between', h('h3', 'This week'), h('span.chip', { title: 'Streak freezes cover a missed day automatically' }, icon('snow'), `${f.freezes}/${MAX_FREEZE} freezes`)),
      h('div.fun-dots', dots), bar('This week', thisW, ''), bar('Last week', lastW, '.fun-last'), h('div.muted.small', msg));
  }
  function lessonCrown(id) {
    const l = LESSON_BY[id]; if (!l) return null;
    const cs = l.keys.map(k => S.cards[k]); if (!cs.some(Boolean) && !S.lessons[id]) return null;
    // tier t when ≥80% of the lesson's cards reach that stability (one stubborn card shouldn't block it)
    const need = Math.ceil(l.keys.length * 0.8), at = d => cs.filter(c => c && c.s >= d).length >= need;
    const t = at(45) ? 3 : at(14) ? 2 : at(3) ? 1 : 0;
    const tip = ['Mastery 0/3 — keep reviewing to earn a crown', 'Mastery 1/3 — most cards stable for 3+ days', 'Mastery 2/3 — most cards stable for 2+ weeks', 'Mastery 3/3 — most cards stable for 6+ weeks'][t];
    return h('span.fun-crown', { 'data-t': t, title: tip, 'aria-label': tip, role: 'img' }, icon('crown'), t ? h('b', String(t)) : null);
  }
  function sessionSummary({ correct = 0, total = 0, bestCombo = 0, xp = 0 } = {}) {
    const f = F(), b = f.bests, acc = total ? correct / total : 0;
    const pb = { acc: total >= 10 && b.acc > 0 && acc > b.acc, combo: b.combo > 0 && bestCombo > b.combo, xp: b.xp > 0 && xp > b.xp };
    if (total >= 10) b.acc = Math.max(b.acc || 0, acc); b.combo = Math.max(b.combo || 0, bestCombo); b.xp = Math.max(b.xp || 0, xp); save();
    const C = 2 * Math.PI * 44, col = acc >= 0.9 ? 'var(--ok)' : acc >= 0.7 ? 'var(--ai)' : 'var(--gold)';
    const ring = h('div.fun-ring', { html: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="var(--paper-2)" stroke-width="9"/><circle class="arc" cx="50" cy="50" r="44" fill="none" stroke="${col}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - acc)}" style="--full:${C}"/></svg>` },
      h('div', h('b', { 'data-to': Math.round(acc * 100), 'data-suf': '%' }, '0%'), h('span', 'accuracy')), pb.acc ? h('span.fun-pb.stamp', 'Best') : null);
    const stat = (n, label, isPb, pre = '') => h('div.fun-sstat', h('b', { 'data-to': n, 'data-pre': pre }, pre + '0'), h('span', label), isPb ? h('span.fun-pb.stamp', 'New best') : null);
    const el = h('div.fun-summary', ring, h('div.fun-sstats', stat(correct, `of ${total} right`), stat(bestCombo, 'best combo', pb.combo), stat(xp, 'XP earned', pb.xp, '+')));
    const run = () => {
      const nums = $$('[data-to]', el), t0 = performance.now(), dur = reduced() ? 0 : 900;
      const step = t => { const k = dur ? Math.min(1, (t - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3); nums.forEach(n => n.textContent = (n.dataset.pre || '') + Math.round(+n.dataset.to * e) + (n.dataset.suf || '')); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    };
    let tries = 0; const wait = () => el.isConnected ? run() : ++tries < 120 && requestAnimationFrame(wait); requestAnimationFrame(wait);
    if (pb.acc || pb.combo || pb.xp) setTimeout(() => { Snd.stamp(); buzz(HAPTIC.stamp); }, reduced() ? 0 : 950);
    return el;
  }
  function settingsSection() {
    const f = F();
    return h('section.card.pad-lg.stack', h('h3', 'Motivation'),
      h('div.row.between', { style: { flexWrap: 'nowrap', gap: '16px' } }, h('div', h('b', 'Vibration'), h('div.muted.small', 'A short buzz on answers and celebrations, on phones that support it.')),
        h('input#funHaptics', { type: 'checkbox', checked: f.haptics ? true : null, style: { width: '22px', height: '22px', flex: 'none' }, onchange: e => { f.haptics = e.target.checked; save(); if (f.haptics) buzz(HAPTIC.ok); } })),
      h('div.row.between', h('span.muted.small', `${f.freezes}/${MAX_FREEZE} streak freezes · ${Object.keys(f.stamps).length} stamps collected`), h('button.btn.sm', { onclick: () => App.go('stamps') }, 'Open stamp book')));
  }

  VIEWS.stamps = () => {
    const f = F(), cat = catalog(), got = cat.filter(d => f.stamps[d.id]).length;
    const unseen = new Set(Object.keys(f.stamps).filter(id => !f.seen[id]));
    Object.keys(f.stamps).forEach(id => f.seen[id] = 1); save();
    const secs = SECTIONS.map(([id, jp, name, blurb]) => {
      const ds = cat.filter(d => d.sec === id), n = ds.filter(d => f.stamps[d.id]).length;
      return h('section.stack',
        h('div.level-sep', h('h2', h('span.jp', jp), ' ', name), h('span.muted.small', `${n}/${ds.length}`)),
        h('p.muted.small', { style: { marginTop: '-6px' } }, blurb),
        h('div.fun-book.gridpaper', ds.map(d => { const own = !!f.stamps[d.id];
          return h('button.fun-cell' + (own ? '' : '.locked'), { type: 'button', onclick: () => stampDetail(d), 'aria-label': `${d.t}: ${own ? 'collected' : 'locked. ' + d.hint}` },
            unseen.has(d.id) ? h('span.fun-new', 'New') : null, stampEl(d, own), h('b', d.short || d.t), own || d.short || d.quiet ? null : h('span', d.hint)); })));
    });
    const left = RARE.filter(([id]) => !f.stamps['rare-' + id]).length;
    return h('div',
      h('div.stack', { style: { gap: '4px' } }, h('div.eyebrow', '御朱印帳 · Stamp book'), h('h1', 'Stamp book')),
      h('section.card.pad-lg.fun-bookhead',
        h('div', h('div.fun-big', `${got}`, h('small', ` / ${cat.length}`)), h('div.muted.small', 'stamps collected')),
        h('div.stack', { style: { gap: '8px', flex: '1', minWidth: '200px' } }, h('div.bar', { style: { height: '10px' } }, h('i', { style: `width:${got / cat.length * 100}%;background:var(--seal)` })),
          h('div.muted.small', `Like the goshuin a pilgrim collects at each temple: every stamp marks something you did. ${left ? `${left} rare stamp${left > 1 ? 's' : ''} still hidden in quest chests${f.sinceRare ? ` · one guaranteed within ${Math.max(1, 6 - f.sinceRare)} chest${6 - f.sinceRare > 1 ? 's' : ''}` : ''}.` : 'Every rare stamp found.'}`))),
      secs);
  };

  // ── Events ──────────────────────────────────────────────────────────────
  function event(type, d = {}) {
    const f = F(), q = rollQuests(), c = q.c;
    const inc = (k, n = 1) => c[k] = (c[k] || 0) + n;
    switch (type) {
      case 'answer':
        buzz(d.ok ? HAPTIC.ok : HAPTIC.bad);
        if (d.ok) { inc('right'); c.combo = Math.max(c.combo || 0, d.combo || 0); f.maxCombo = Math.max(f.maxCombo, d.combo || 0);
          if ([10, 25, 50, 100].includes(d.combo)) { richToast(h('span.fun-stamp.k-gold.mini', { style: '--rot:-6deg' }, h('b', '連')), `${d.combo} in a row`, d.combo === 10 ? '+5 XP combo bonus' : 'Unstoppable'); buzz(HAPTIC.stamp); } }
        break;
      case 'lesson': inc('lesson'); if (d.perfect) { inc('perfect'); f.perfects++; } break;
      case 'review-done': if (d.total >= 10 && d.correct / d.total >= 0.9) inc('acc'); break;
      case 'story': inc('story'); break;
      case 'grammar': inc('grammar'); break;
      case 'write': if (d.ok !== false) inc('write'); break;
      case 'sensei': inc('sensei'); break;
      case 'xp': { const L = levelInfo().level; if (L > f.level) { f.level = L; enqueue(() => showLevelUp(L)); } checkStreak(); break; }
      case 'placement': enqueue(() => showCelebrate({ eyebrow: 'Placement', glyph: { new: '入', kana: '仮', n5: '五', n5b: '五', n4: '四', 'n4+': '四' }[d.level] || '試', title: 'You are placed', text: 'Your path now starts at the right spot. Everything you already know has been marked and added to your reviews.' }), true); break;
    }
    save();
    checkQuests();
    if (type !== 'answer') checkStamps();
    if (['lesson', 'review-done', 'story', 'grammar'].includes(type)) setTimeout(() => pump(true), 900);
  }

  function refresh() {
    $$('.fun-quests').forEach(el => el.replaceWith(questsCard()));
    try { App.renderNav(); } catch (e) {}
  }

  function init() {
    const f = F();
    applyFreezes();
    if (!f.seeded) { // existing learners: don't replay milestones they already passed
      f.seeded = true; f.level = levelInfo().level; f.bestStreak = streakN();
      MILESTONES.filter(m => streakN() >= m).forEach(m => f.ms[m] = dayKey());
      checkStamps(true); Object.keys(f.stamps).forEach(id => f.seen[id] = 1);
    }
    rollQuests(); checkStamps(); tickMult(); saveLocal();
    let day = dayKey();
    setInterval(() => { if (dayKey() !== day) { day = dayKey(); rollQuests(); refresh(); } }, 60000);
    if (f.chests > 0) enqueue(() => showChest(true));
  }

  return {
    init, event, mult, floatXP, combo, levelUp: l => enqueue(() => showLevelUp(l)), celebrate: o => enqueue(() => showCelebrate(o)),
    questsCard, questBadge: () => questsLeft() + (F().chests > 0 ? 1 : 0), streakBanner, weekCard, lessonCrown, sessionSummary, settingsSection,
    openChest: () => showChest(), dayOn, stampCount: () => Object.keys(F().stamps).length,
  };
})();

window.Fun = Fun;
