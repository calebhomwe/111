// ─── Core: utilities, state, persistence, FSRS, speech ──────────────────────
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const DAY = 864e5, MIN = 6e4;
const now = () => Date.now();
const rand = n => Math.floor(Math.random() * n);
const pick = a => a[rand(a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dayKey = (t = now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const hasKanji = s => /[一-龯㐀-䶿々]/.test(s);
const isKana = s => /^[぀-ヿー・、。\s]+$/.test(s);

// h('div.card#x', {onclick}, children...)
function h(tag, attrs, ...kids) {
  const m = tag.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
  const el = document.createElement(m[1] || 'div');
  for (const part of (m[2] || '').match(/[.#][\w-]+/g) || []) part[0] === '.' ? el.classList.add(part.slice(1)) : (el.id = part.slice(1));
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = k => { if (k == null || k === false) return; if (Array.isArray(k)) k.forEach(add); else el.append(k instanceof Node ? k : document.createTextNode(k)); };
  kids.forEach(add);
  return el;
}

// Ruby text: word + reading → <ruby> markup (furigana only over kanji runs when possible).
function ruby(word, reading) {
  if (!reading || !hasKanji(word) || reading === word) return esc(word);
  // Split okurigana: match leading/trailing kana shared between word and reading.
  let pre = 0; while (pre < word.length && !hasKanji(word[pre]) && word[pre] === reading[pre]) pre++;
  let suf = 0; while (suf < word.length - pre && !hasKanji(word[word.length - 1 - suf]) && word[word.length - 1 - suf] === reading[reading.length - 1 - suf]) suf++;
  const core = word.slice(pre, word.length - suf), coreR = reading.slice(pre, reading.length - suf);
  // Inner kana inside the core (e.g. 食べ物): try to align on each inner kana run.
  const parts = core.split(/([぀-ゟ]+)/).filter(Boolean);
  if (parts.length > 1) {
    let rx = '^' + parts.map(p => hasKanji(p) ? '(.+?)' : `(${p})`).join('') + '$';
    const mm = coreR.match(new RegExp(rx));
    if (mm) return esc(word.slice(0, pre)) + parts.map((p, i) => hasKanji(p) ? `<ruby>${esc(p)}<rt>${esc(mm[i + 1])}</rt></ruby>` : esc(p)).join('') + esc(word.slice(word.length - suf));
  }
  return esc(word.slice(0, pre)) + `<ruby>${esc(core)}<rt>${esc(coreR)}</rt></ruby>` + esc(word.slice(word.length - suf));
}

// ─── State ─────────────────────────────────────────────────────────────────
const LS_KEY = 'michi.v1';
const DEFAULT_STATE = () => ({
  v: 1, created: now(), updated: 0,
  cards: {},          // itemKey -> {s,d,due,last,reps,lapses,st}
  lessons: {},        // lessonId -> {done:ts, best:pct}
  grammar: {},        // pointId -> {done:ts, score}
  stories: {},        // storyId -> {read:ts, score}
  days: {},           // 'YYYY-MM-DD' -> {xp, rev, new, min}
  xp: 0,
  ach: {},            // achievementId -> ts
  saved: [],          // words saved from reader (surface strings)
  aiStories: [],      // generated stories
  settings: { romaji: true, furigana: 'auto', goal: 50, rate: 0.9, voice: '', newPerDay: 15, sound: true, theme: 'system', level: 'beginner' },
});
let S = DEFAULT_STATE();
function loadLocal() { try { const raw = localStorage.getItem(LS_KEY); if (raw) return JSON.parse(raw); } catch (e) {} return null; }
function mergeState(base, extra) { const out = Object.assign(DEFAULT_STATE(), base); out.settings = Object.assign(DEFAULT_STATE().settings, base.settings || {}); return out; }
{ const l = loadLocal(); if (l) S = mergeState(l); }

// Cloud sync through the artifact's per-viewer db subtree; localStorage stays as the fast mirror.
const Cloud = { db: null, uid: null, ref: null, status: 'local', timer: 0 };
async function initCloud() {
  if (!window.claude?.use) return;
  try {
    const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
    if (!db || !user) return;
    const uid = await user.id();
    if (!uid) return;
    Cloud.db = db; Cloud.uid = uid; Cloud.ref = db.doc(`data/users/${uid}/progress`);
    const snap = await Cloud.ref.get();
    const remote = snap.exists ? snap.data()?.state : null;
    if (remote) {
      const r = typeof remote === 'string' ? JSON.parse(remote) : remote;
      if ((r.updated || 0) > (S.updated || 0)) { S = mergeState(r); saveLocal(); App.render(); toast('Progress synced from your account'); }
      else if ((S.updated || 0) > (r.updated || 0)) pushCloud(true);
    } else if (S.updated) pushCloud(true);
    Cloud.status = 'synced'; updateSyncBadge();
  } catch (e) { Cloud.status = 'local'; updateSyncBadge(); }
}
function pushCloud(immediate) {
  if (!Cloud.ref) return;
  clearTimeout(Cloud.timer);
  Cloud.timer = setTimeout(async () => {
    try { Cloud.status = 'saving'; updateSyncBadge(); await Cloud.ref.set({ state: JSON.stringify(S), at: now() }); Cloud.status = 'synced'; }
    catch (e) { Cloud.status = e?.code === 'invalid_argument' ? 'local' : 'error'; }
    updateSyncBadge();
  }, immediate ? 50 : 4000);
}
function saveLocal() { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {} }
function save() { S.updated = now(); saveLocal(); pushCloud(); }
function updateSyncBadge() {
  const b = $('#sync'); if (!b) return;
  const map = { local: ['This device', 'Progress is saved in this browser'], saving: ['Saving…', 'Saving to your account'], synced: ['Synced', 'Progress is saved to your Claude account'], error: ['Sync paused', 'Could not reach the store; saved on this device'] };
  const [t, tip] = map[Cloud.status] || map.local; b.textContent = t; b.title = tip; b.dataset.s = Cloud.status;
}

// ─── Daily stats, XP, streak ──────────────────────────────────────────────
function today() { const k = dayKey(); return S.days[k] || (S.days[k] = { xp: 0, rev: 0, new: 0, ok: 0 }); }
function addXP(n, reason) {
  S.xp += n; today().xp += n; save();
  const pill = $('#xpPill'); if (pill) { pill.textContent = `${S.xp.toLocaleString()} XP`; pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump'); }
  checkAchievements();
}
function streak() {
  let n = 0, t = now();
  if (!(S.days[dayKey(t)]?.xp > 0)) t -= DAY; // today not done yet: count from yesterday
  while (S.days[dayKey(t)]?.xp > 0) { n++; t -= DAY; }
  return n;
}
const LEVEL_XP = l => Math.round(60 * Math.pow(l, 1.6));
function levelInfo(xp = S.xp) { let l = 1, acc = 0; while (xp >= acc + LEVEL_XP(l)) { acc += LEVEL_XP(l); l++; } return { level: l, into: xp - acc, need: LEVEL_XP(l) }; }

// ─── FSRS-4.5 scheduler ───────────────────────────────────────────────────
const FSRS = (() => {
  const w = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
  const DECAY = -0.5, FACTOR = 19 / 81, RET = 0.9;
  const R = (t, s) => Math.pow(1 + FACTOR * t / s, DECAY);
  const ivl = s => clamp(Math.round(s / FACTOR * (Math.pow(RET, 1 / DECAY) - 1)), 1, 3650);
  const D0 = g => clamp(w[4] - (g - 3) * w[5], 1, 10);
  const nextD = (d, g) => clamp(w[7] * D0(3) + (1 - w[7]) * (d - w[6] * (g - 3)), 1, 10);
  const sRecall = (d, s, r, g) => s * (Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * (g === 2 ? w[15] : 1) * (g === 4 ? w[16] : 1) + 1);
  const sForget = (d, s, r) => Math.min(s, w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r)));
  // g: 1 again, 2 hard, 3 good, 4 easy
  function review(c, g, t = now()) {
    c = Object.assign({ s: 0, d: 0, due: t, last: 0, reps: 0, lapses: 0, st: 0 }, c);
    if (c.st === 0) { // first exposure (after the lesson)
      c.s = w[g - 1]; c.d = D0(g);
      c.st = g === 1 ? 1 : 2;
      c.due = t + (g === 1 ? 5 * MIN : g === 2 ? 12 * 60 * MIN : ivl(c.s) * DAY);
    } else {
      const elapsed = Math.max(0, (t - c.last) / DAY);
      const r = R(elapsed, c.s);
      c.d = nextD(c.d, g);
      if (g === 1) { c.s = sForget(c.d, c.s, r); c.lapses++; c.st = 1; c.due = t + 10 * MIN; }
      else if (elapsed < 0.5 && c.st === 1) { // same-day relearning step
        c.s = Math.max(c.s, w[g - 1] * 0.8); c.st = 2; c.due = t + (g === 2 ? 0.5 : ivl(c.s)) * DAY;
      } else { c.s = sRecall(c.d, c.s, r, g); c.st = 2; c.due = t + ivl(c.s) * DAY; }
    }
    c.last = t; c.reps++;
    return c;
  }
  const retrievability = (c, t = now()) => c && c.st ? R(Math.max(0, (t - c.last) / DAY), c.s) : 0;
  return { review, retrievability, ivl };
})();

function cardStage(c) { if (!c) return 'new'; if (c.st === 1 || c.s < 3) return 'learning'; if (c.s < 21) return 'young'; if (c.s < 90) return 'mature'; return 'mastered'; }
function dueCards(t = now()) { return Object.entries(S.cards).filter(([, c]) => c.due <= t).sort((a, b) => a[1].due - b[1].due).map(([k]) => k); }
function fmtIvl(ms) { const d = ms / DAY; if (d < 1 / 24) return `${Math.max(1, Math.round(ms / MIN))}m`; if (d < 1) return `${Math.round(d * 24)}h`; if (d < 30) return `${Math.round(d)}d`; if (d < 365) return `${Math.round(d / 30)}mo`; return `${(d / 365).toFixed(1)}y`; }

// ─── Speech ────────────────────────────────────────────────────────────────
const Voice = {
  voices: [], ja: null,
  init() {
    if (!('speechSynthesis' in window)) return;
    const load = () => {
      this.voices = speechSynthesis.getVoices().filter(v => /^ja/i.test(v.lang));
      const pref = ['Google 日本語', 'Nanami', 'Kyoko', 'O-ren', 'Otoya', 'Haruka', 'Ayumi'];
      this.ja = this.voices.find(v => v.name === S.settings.voice) || pref.map(p => this.voices.find(v => v.name.includes(p))).find(Boolean) || this.voices[0] || null;
    };
    load(); speechSynthesis.onvoiceschanged = load;
  },
  get ok() { return 'speechSynthesis' in window || !!Clips.index; },
  seq: 0, audio: null,
  stop() { this.seq++; if (this.audio) { this.audio.pause(); this.audio = null; } if ('speechSynthesis' in window) speechSynthesis.cancel(); },
  // text: the lookup key for recorded audio (exact course text). opts.tts: what the browser voice reads if no recording exists.
  async say(text, opts = {}) {
    if (!text) return;
    this.stop(); const my = this.seq;
    const keys = [text, ...(opts.alt || [])];
    let url = null;
    if (Clips.index || Clips.loading) { await Clips.load(); for (const k of keys) { url = await Clips.url(k); if (url) break; } }
    if (my !== this.seq) return;
    if (url) {
      return new Promise(res => {
        const a = new Audio(url); this.audio = a;
        a.playbackRate = opts.slow ? 0.72 : (S.settings.clipRate || 1); a.preservesPitch = true;
        a.onended = a.onerror = () => { if (this.audio === a) this.audio = null; res(); };
        a.play().catch(() => { this.audio = null; this.tts(opts.tts || text, opts).then(res); });
      });
    }
    return this.tts(opts.tts || text, opts);
  },
  tts(text, opts = {}) {
    if (!('speechSynthesis' in window)) return Promise.resolve();
    speechSynthesis.cancel();
    return new Promise(res => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP'; if (this.ja) u.voice = this.ja;
      u.rate = opts.slow ? 0.6 : (opts.rate || S.settings.rate); u.onend = u.onerror = res;
      speechSynthesis.speak(u);
    });
  },
};
// Recorded native audio: audio/index.json maps exact text → [pack, offset, length, ms]; packs are MP3 byte ranges.
const Clips = {
  index: null, loading: null, packs: new Map(), urls: new Map(),
  load() {
    if (!this.loading) this.loading = fetch('audio/index.json').then(r => r.ok ? r.json() : null).catch(() => null).then(j => { this.index = j && j.clips ? j : null; return this.index; });
    return this.loading;
  },
  has(t) { return !!this.index?.clips?.[t]; },
  pack(p) {
    let pk = this.packs.get(p);
    if (!pk) { pk = fetch('audio/' + this.index.packs[p]).then(r => { if (!r.ok) throw new Error('pack'); return r.arrayBuffer(); }); pk.catch(() => this.packs.delete(p)); this.packs.set(p, pk); }
    return pk;
  },
  async url(t) {
    const c = this.index?.clips?.[t]; if (!c) return null;
    if (this.urls.has(t)) return this.urls.get(t);
    try { const buf = await this.pack(c[0]); const u = URL.createObjectURL(new Blob([buf.slice(c[1], c[1] + c[2])], { type: 'audio/mpeg' })); this.urls.set(t, u); return u; } catch (e) { return null; }
  },
  prefetch(texts) { if (!this.index) return; const ps = new Set(); for (const t of texts) { const c = this.index.clips[t]; if (c) ps.add(c[0]); } [...ps].slice(0, 4).forEach(p => this.pack(p).catch(() => {})); },
};
// speakBtn(key, label, tts): plays the recording for `key`, else reads `tts` (or key) with the browser voice. Right-click / long-press plays slowly.
function speakBtn(text, label = 'Play audio', tts) {
  const b = h('button.icon-btn.speak', { type: 'button', 'aria-label': label, title: label + ' (right-click: slow)', onclick: e => { e.stopPropagation(); Voice.say(text, { tts }); }, oncontextmenu: e => { e.preventDefault(); e.stopPropagation(); Voice.say(text, { tts, slow: true }); } }, icon('speaker'));
  return b;
}

// ─── Sound effects (WebAudio, generated) ──────────────────────────────────
const Sfx = (() => {
  let ctx;
  const tone = (f, t0, dur, type = 'sine', vol = 0.12) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
    const t = ctx.currentTime + t0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  };
  const play = fn => { if (!S.settings.sound) return; try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); fn(); } catch (e) {} };
  return {
    ok: () => play(() => { tone(880, 0, 0.12, 'triangle'); tone(1318.5, 0.07, 0.18, 'triangle'); }),
    bad: () => play(() => { tone(220, 0, 0.18, 'sine', 0.1); tone(196, 0.09, 0.22, 'sine', 0.1); }),
    done: () => play(() => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.09, 0.3, 'triangle', 0.1))),
    tick: () => play(() => tone(1500, 0, 0.04, 'square', 0.03)),
  };
})();

// ─── Toast, icons, confetti ───────────────────────────────────────────────
function toast(msg, kind = '') {
  const t = h('div.toast' + (kind ? '.' + kind : ''), { role: 'status' }, msg);
  $('#toasts').append(t); setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3100);
}
const ICONS = {
  speaker: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none"/>',
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  learn: '<path d="M4 5h7a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-7a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h7z"/>',
  review: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5" fill="none"/>',
  brush: '<path d="M14 4l6 6-8.5 8.5a3 3 0 0 1-4.2 0l-1.8-1.8a3 3 0 0 1 0-4.2z" fill="none"/><path d="M5 19c-1 1-2 1-3 1 0-1 0-2 1-3" fill="none"/>',
  read: '<path d="M4 4h12l4 4v12H4z" fill="none"/><path d="M8 11h8M8 15h8M8 7h5" fill="none"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z" fill="none"/><circle cx="9" cy="10.5" r="1"/><circle cx="12" cy="10.5" r="1"/><circle cx="15" cy="10.5" r="1"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none"/>',
  gear: '<circle cx="12" cy="12" r="3" fill="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" fill="none"/>',
  search: '<circle cx="11" cy="11" r="6.5" fill="none"/><path d="M16 16l5 5" fill="none"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8 0 4 3 7 7 7z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none"/>',
  x: '<path d="M6 6l12 12M18 6L6 18" fill="none"/>',
  play: '<path d="M7 4.5v15l13-7.5z"/>',
  back: '<path d="M15 5l-7 7 7 7" fill="none"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  gym: '<path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" fill="none"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" fill="none"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14" fill="none"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z" fill="none"/>',
  undo: '<path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" fill="none"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none"/>',
};
function icon(name, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'ic ' + cls);
  s.innerHTML = ICONS[name] || ''; return s;
}
function petals(n = 28) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = h('div.petals', { 'aria-hidden': 'true' });
  for (let i = 0; i < n; i++) {
    const p = h('i', { style: { left: `${rand(100)}%`, animationDelay: `${Math.random() * 0.6}s`, animationDuration: `${2.2 + Math.random() * 1.8}s`, '--dx': `${rand(160) - 80}px`, '--r': `${rand(720) - 360}deg`, transform: `scale(${0.6 + Math.random() * 0.8})` } });
    layer.append(p);
  }
  document.body.append(layer); setTimeout(() => layer.remove(), 4500);
}
