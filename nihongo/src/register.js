// ─── Speech styles: casual ↔ polite ↔ keigo (hub, lessons, Style Switch, Read the Room) ───
const REGISTER = DATA.register || { lessons: [], pairs: [], situations: [] };
const REG_ORDER = ['casual', 'polite', 'keigo'];
const REG_INFO = {
  casual: { en: 'Casual', jp: 'タメ口', who: 'Friends, family, partners, children', ex: ['行く？', 'いく？'] },
  polite: { en: 'Polite', jp: 'です・ます', who: 'Strangers, coworkers, teachers, shop staff: the safe default', ex: ['行きますか。', 'いきますか。'] },
  keigo: { en: 'Keigo', jp: '敬語', who: 'Customers, clients, senior people, formal email', ex: ['いらっしゃいますか。', 'いらっしゃいますか。'] },
};
const REG_WHO = {
  friend: ['友', 'A friend'], family: ['家', 'Family'], child: ['子', 'A child'], stranger: ['人', 'A stranger'],
  clerk: ['店', 'Shop staff'], teacher: ['先', 'Your teacher'], boss: ['上', 'Your boss'], customer: ['客', 'A customer or client'],
};
// Added by the host to Sensei's role-play prompt: how to correct register slips in "fix".
const REGISTER_SCENARIO_HINT = 'Register (speech style) check: judge every learner line against who you are playing. If it is too casual for the role (plain forms or dropped です/ます, ちょうだい, bare 〜て requests, 俺, うん with a clerk, stranger, teacher or boss), or too formal for the role (です/ます or keigo with a close friend, family member or small child), or uses keigo the wrong way round (尊敬語 like 召し上がる, いらっしゃる, おっしゃる for their own actions; 謙譲語 like 拝見する, 参る, 申す for yours), set "fix" even when the grammar is fine: "better" = the same sentence in the right register, "why" = one short English sentence naming the problem, e.g. "Too casual for a shop clerk: use です/ます." Customers only need polite です/ます (keigo is the staff\'s job), and a boss may speak casually downward while the learner still answers politely. Do not flag natural choices.';

const regState = () => { if (!S.register || typeof S.register !== 'object') S.register = {}; const r = S.register; r.lessons = r.lessons || {}; r.best = r.best || {}; return r; };
const regChip = (reg, extra = '') => h('span.reg-chip', { 'data-reg': reg }, REG_INFO[reg].en + (extra ? ' · ' + extra : ''));
const regCfgGet = () => { try { return JSON.parse(localStorage.getItem('michi.regcfg') || 'null') || {}; } catch (e) { return {}; } };
const regCfgSet = c => { try { localStorage.setItem('michi.regcfg', JSON.stringify(c)); } catch (e) {} };
const regFuri = () => S.settings.furigana !== 'never';

// ─── Flexible answer matching ─────────────────────────────────────────────
// Ignores punctuation/spaces, accepts kana or kanji (or a mix, aligned via the reading), and romaji.
const regNorm = s => String(s || '').normalize('NFKC').replace(/[\s。、，,．.？?！!…‥・「」『』()（）〜~"'“”]/g, '');
const regEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function regMatch(input, jp, fu) {
  const a0 = regNorm(input); if (!a0) return false;
  if (regMatch1(a0, jp, fu)) return true;
  const idx = [...a0].map((c, i) => c === 'わ' ? i : -1).filter(i => i >= 0).slice(0, 3); // particle は typed as わ
  for (let m = 1; m < (1 << idx.length); m++) { const ch = [...a0]; idx.forEach((i, b) => { if (m & (1 << b)) ch[i] = 'は'; }); if (regMatch1(ch.join(''), jp, fu)) return true; }
  return false;
}
function regMatch1(a, jp, fu) {
  const J = regNorm(jp), F = toHira(regNorm(fu || jp));
  const ah = toHira(a);
  if (a === J || ah === F || ah === toHira(J)) return true;
  if (!/[぀-ヿ一-龯々]/.test(a)) return normRomaji(a) === normRomaji(kanaToRomaji(F));
  // Mixed kanji/kana: align each non-kana run of jp with its reading, then allow either spelling per run.
  const runs = J.match(/[぀-ヿー]+|[^぀-ヿー]+/g) || [];
  if (runs.length < 2 && !/[^぀-ヿー]/.test(J)) return false;
  const isK = r => /^[぀-ヿー]+$/.test(r);
  const m = F.match(new RegExp('^' + runs.map(r => isK(r) ? regEsc(toHira(r)) : '(.+?)').join('') + '$'));
  if (!m) return false;
  // A kanji run like 明日行 (あしたい) may be typed as 明日行, あしたい, or part kana: あした行, 明日い.
  const alts = (r, rr) => {
    const out = new Set([r, rr]);
    for (let k = 1; k < r.length; k++) for (let j = 1; j < rr.length; j++) { out.add(rr.slice(0, j) + r.slice(k)); out.add(r.slice(0, k) + rr.slice(j)); }
    return [...out].map(regEsc).join('|');
  };
  let gi = 0;
  const rx = '^' + runs.map(r => isK(r) ? regEsc(toHira(r)) : `(?:${alts(r, m[++gi])})`).join('') + '$';
  return new RegExp(rx).test(ah);
}
// targets: [{jp, fu}] or plain strings (kanji or kana). Kanji strings are also tried against each kana string.
function regAccepts(input, targets) {
  const objs = targets.filter(t => t && typeof t === 'object');
  const strs = targets.filter(t => typeof t === 'string');
  if (objs.some(t => regMatch(input, t.jp, t.fu))) return true;
  const kana = strs.filter(s => !/[^぀-ヿー。、？！…\s]/.test(s)), withK = strs.filter(s => !kana.includes(s));
  if (strs.some(s => regMatch(input, s, isKana(s) ? s : null))) return true;
  for (const k of withK) for (const r of kana) if (regMatch(input, k, r)) return true;
  return false;
}

// ─── Shared bits ──────────────────────────────────────────────────────────
function regSent(x, { big = false, audio = true } = {}) {
  return h('div.rg-sent' + (big ? '.big' : ''),
    h('div.row', { style: { gap: '8px', flexWrap: 'nowrap', justifyContent: big ? 'center' : 'flex-start', alignItems: 'flex-start' } },
      h('span.jp', x.jp), audio ? speakBtn(x.jp, 'Play sentence', x.fu) : null),
    regFuri() && x.fu && x.fu !== x.jp ? h('div.rg-fu.jp', x.fu) : null);
}
// All registers of a pair side by side; `hi` highlights one column.
function regCompare(p, hi) {
  return h('div.rg-compare', REG_ORDER.map(r => {
    const x = p[r];
    return h('div.rg-col' + (r === hi ? '.hi' : '') + (x ? '' : '.none'), { 'data-reg': r },
      h('div.row.between', { style: { gap: '6px' } }, regChip(r), x ? speakBtn(x.jp, `Play ${REG_INFO[r].en.toLowerCase()} version`, x.fu) : null),
      x ? h('div.jp.rg-cjp', x.jp) : h('div.muted.small', r === 'keigo' ? 'No special keigo: polite です/ます is already right for this.' : '—'),
      x && regFuri() && x.fu !== x.jp ? h('div.rg-fu.jp', x.fu) : null,
      h('div.muted.small', REG_INFO[r].who));
  }));
}
function regStudyTop(onExit, label) {
  const bar = h('i', { style: { width: '0%' } }), combo = h('span.combo', '');
  const top = h('div.study-top', h('button.icon-btn', { 'aria-label': label, onclick: onExit }, icon('x')), h('div.bar', bar), combo);
  return { top, set: (d, n, c) => { bar.style.width = `${d / n * 100}%`; combo.textContent = c >= 3 ? `${c} combo` : `${d}/${n}`; } };
}
// One keydown listener per view. Enter continues; the returned setter installs the per-question 1–4 picker.
function regKeys(host) {
  let pickFn = null;
  const typing = () => { const a = document.activeElement; return a && ((a.tagName === 'INPUT' && !a.readOnly) || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT'); };
  const onKey = e => {
    if (typing() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter') { const b = host.querySelector('.feedback .btn.primary, .rg-next'); if (b) { e.preventDefault(); b.click(); } }
    else if (/^[1-4]$/.test(e.key) && pickFn) pickFn(+e.key - 1);
  };
  document.addEventListener('keydown', onKey);
  const prev = App.cleanup; App.cleanup = () => { document.removeEventListener('keydown', onKey); prev && prev(); };
  return fn => { pickFn = fn; };
}
function regResult({ pct, title, sub, missed, again, extra }) {
  Sfx.done(); if (pct >= 0.9) petals(18);
  return h('div.qcard', h('div.result-hero',
    h('span.hanko.stamp', pct >= .9 ? '優' : pct >= .7 ? '良' : '可'), h('h2', title), h('p.muted', sub),
    missed && missed.length ? h('div.stack', { style: { gap: '6px', width: '100%', maxWidth: '520px' } }, h('div.eyebrow', 'Worth another look'), missed) : null,
    h('div.row', { style: { justifyContent: 'center' } }, h('button.btn.primary.rg-next', { onclick: again }, icon('review'), 'Go again'), h('button.btn', { onclick: () => App.go('styles') }, 'Speech styles'))),
    extra || null);
}

// ─── Hub ──────────────────────────────────────────────────────────────────
VIEWS.styles = () => {
  const st = regState(); const L = REGISTER.lessons;
  if (!L.length && !REGISTER.pairs.length) return h('div', h('div.empty', 'Speech styles content is not loaded.'));
  const ladder = h('div.rg-ladder', { role: 'list' }, REG_ORDER.map((r, i) => h('div.rg-step', { role: 'listitem', 'data-reg': r, style: { '--i': i } },
    h('div.row.between', { style: { gap: '6px' } }, h('span.rg-step-jp', REG_INFO[r].jp), h('span.rg-step-n', `${i + 1}`)),
    h('b', REG_INFO[r].en),
    h('div.row', { style: { gap: '6px', flexWrap: 'nowrap' } }, h('span.jp.rg-step-ex', REG_INFO[r].ex[0]), speakBtn(REG_INFO[r].ex[0], `Play ${REG_INFO[r].en}`, REG_INFO[r].ex[1])),
    h('div.small.muted', REG_INFO[r].who))));
  const intro = h('section.card.pad-lg.stack',
    h('div.row.between', h('h2', 'One question, three ways'), h('span.muted.small', '"Are you going?"')),
    h('p.muted', { style: { maxWidth: '70ch' } }, 'Japanese changes the end of the sentence depending on who you are talking to. Too stiff and friends feel pushed away; too casual and a clerk or your boss hears rudeness. Climb the ladder as the distance grows.'),
    ladder,
    h('div.rg-axis', { 'aria-hidden': 'true' }, h('span', 'closer'), h('i'), h('span', 'more distance / respect')));
  const bs = st.best || {};
  const drills = h('div.grid.g2',
    h('button.scenario', { onclick: () => App.go('styleswitch') },
      h('div.row', h('span.hanko', { style: { width: '46px', height: '46px', fontSize: '1.3rem' } }, '替'), h('h3', 'Style Switch')),
      h('p.muted.small', 'See a sentence in one style, say it in another. Pick from four at first, then type it. Every answer shows all three styles side by side.'),
      bs.switch != null ? h('span.chip.seal', `Best: ${Math.round(bs.switch * 100)}%`) : null),
    h('button.scenario', { onclick: () => App.go('readroom') },
      h('div.row', h('span.hanko', { style: { width: '46px', height: '46px', fontSize: '1.3rem' } }, '場'), h('h3', 'Read the Room')),
      h('p.muted.small', 'A boss, a clerk, a child, an old friend: pick the reply that fits the person. Each option explains why it works or why it lands badly.'),
      bs.room != null ? h('span.chip.seal', `Best: ${Math.round(bs.room * 100)}%`) : null));
  const doneN = L.filter(l => st.lessons[l.id]).length;
  const lessons = h('section.stack',
    h('div.level-sep', h('h2', 'Lessons'), h('span.muted.small', `${doneN}/${L.length}`)),
    h('div.lesson-list', L.map((l, i) => h('button.lesson', { onclick: () => App.go('style', { id: l.id }) },
      st.lessons[l.id] ? h('span.hanko.round.done', '済') : null,
      h('div.t', `${i + 1}. ${l.t}`), h('div.muted.small', l.sum)))));
  return h('div',
    banner('tr-grammar', '話し方 · Speech styles', 'Casual, polite, keigo', 'Sound right to everyone you talk to: friends, shop staff, teachers and bosses.'),
    intro, drills, lessons, Sensei.available ? regCheckerCard() : null);
};

// ─── Lesson page ──────────────────────────────────────────────────────────
VIEWS.style = ({ id } = {}) => {
  const L = REGISTER.lessons; const idx = L.findIndex(l => l.id === id); const l = L[idx];
  if (!l) return VIEWS.styles();
  const prev = L[idx - 1], next = L[idx + 1];
  const cols = l.cols || ['', 'Polite', 'Casual', 'Note'];
  const hasNote = l.table.some(r => r[3]) && cols.length > 3;
  const table = h('div.rg-table-wrap', h('table.rg-table',
    h('thead', h('tr', cols.slice(0, hasNote ? 4 : 3).map(c => h('th', c)))),
    h('tbody', l.table.map(r => h('tr', [0, 1, 2, ...(hasNote ? [3] : [])].map(i => h(i === 0 ? 'th' : 'td', { 'data-label': cols[i] || '', class: i === 1 || i === 2 ? 'jp' : i === 0 ? 'rg-rowlabel' : 'muted small', scope: i === 0 ? 'row' : null }, r[i] || '')))))));
  const exRow = e => h('div.example.rg-ex', { 'data-reg': e.reg },
    h('div.row.between', { style: { flexWrap: 'nowrap', alignItems: 'flex-start' } }, h('span.jp', e.jp), speakBtn(e.jp, 'Play sentence', e.fu)),
    regFuri() && e.fu !== e.jp ? h('span.rg-fu.jp', e.fu) : null,
    h('span.small', e.en),
    h('div.row', { style: { gap: '6px' } }, regChip(e.reg), h('span.muted.small', e.who)));
  // quiz
  const quizHost = h('div.stack'); const qs = l.quiz || []; let qi = 0, right = 0;
  const renderQ = () => {
    if (qi >= qs.length) {
      const st = regState(); const was = st.lessons[l.id];
      st.lessons[l.id] = { done: now(), score: Math.max(was?.score || 0, right) };
      addXP(was ? 3 : 12 + right * 2); Sfx.done(); if (right === qs.length) petals(16); save();
      quizHost.replaceChildren(h('div.result-hero', h('span.hanko.stamp', right === qs.length ? '満点' : '済'), h('h3', `${right}/${qs.length} correct`),
        h('div.row', { style: { justifyContent: 'center' } }, next ? h('button.btn.primary.rg-next', { onclick: () => App.go('style', { id: next.id }) }, `Next: ${next.t}`) : h('button.btn.primary.rg-next', { onclick: () => App.go('readroom') }, 'Try Read the Room'),
          h('button.btn', { onclick: () => { qi = 0; right = 0; renderQ(); } }, 'Retry'))));
      return;
    }
    const q = qs[qi]; const fb = h('div');
    const after = (ok, shown, say) => {
      if (ok) { right++; Sfx.ok(); } else Sfx.bad();
      const nb = h('button.btn.primary', { onclick: () => { qi++; renderQ(); } }, 'Continue', h('span.kbd', 'Enter'));
      fb.replaceChildren(h('div.feedback.' + (ok ? 'ok' : 'no'), h('div.row.between', h('strong', ok ? '正解！' : 'Not quite'), say ? speakBtn(say.jp, 'Play', say.fu) : null), shown, h('div.row.between', q.en ? h('span.small', q.en) : h('span'), nb)));
      if (say) Voice.say(say.jp, { tts: say.fu }); setTimeout(() => nb.focus(), 30);
    };
    const head = h('div.eyebrow', `Question ${qi + 1} of ${qs.length}`);
    if (q.type === 'mc') {
      const jpQ = /[぀-ヿ一-龯]/.test(q.a) && !/[A-Za-z]/.test(q.a);
      const opts = h('div.opts', q.opts.map(o => h('button.opt' + (jpQ ? '.rg-jpopt' : ''), { type: 'button', onclick: e => {
        if (opts.dataset.done) return; opts.dataset.done = 1; const ok = o === q.a;
        e.currentTarget.classList.add(ok ? 'right' : 'wrong'); if (!ok) [...opts.children].find(c => c.textContent === q.a)?.classList.add('right');
        [...opts.children].forEach(c => c.setAttribute('disabled', ''));
        const seg = (q.q.match(/[^\sA-Za-z0-9().:,'"!?]*___[^\sA-Za-z(]*/) || [])[0];
        const full = seg ? seg.replace('___', q.a) : null;
        after(ok, h('div.ans' + (jpQ ? '.jp' : ''), full && jpQ ? full : q.a), jpQ ? { jp: full || q.a } : null);
      } }, o)));
      quizHost.replaceChildren(head, h('div.rg-q', { html: esc(q.q).replace('___', '<span class="rg-blank">＿＿</span>') }), opts, fb);
    } else {
      const inp = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', lang: 'ja', placeholder: 'type romaji → かな (kanji also accepted)', 'aria-label': `Your ${q.to} version` });
      bindIME(inp);
      const go = h('button.btn.primary', { type: 'submit' }, 'Check');
      const form = h('form.typein', { onsubmit: e => {
        e.preventDefault(); if (inp.readOnly || !inp.value.trim()) return;
        const ok = regAccepts(inp.value, q.answers); inp.readOnly = true; inp.classList.add(ok ? 'right' : 'wrong'); go.remove();
        const best = q.answers.find(a => /[一-龯]/.test(a)) || q.answers[0], bestK = q.answers.find(a => isKana(a));
        after(ok, h('div.stack', { style: { gap: '4px' } }, h('div.ans.jp', best), bestK && bestK !== best ? h('div.muted.small.jp', bestK) : null,
          q.answers.length > 2 ? h('div.muted.small', 'Also accepted: ', h('span.jp', q.answers.filter(a => a !== best && a !== bestK).slice(0, 4).join('、'))) : null), { jp: best, fu: bestK });
      } }, inp, go);
      quizHost.replaceChildren(head,
        h('div.row', { style: { justifyContent: 'center', gap: '8px' } }, regChip(q.from), h('span.muted', '→'), regChip(q.to)),
        h('div.rg-q', `Say it ${REG_INFO[q.to].en.toLowerCase()}`), regSent(q.src, { big: true }), form, fb);
    }
  };
  renderQ();
  const view = h('div',
    h('div.row.between', h('button.btn.ghost', { onclick: () => App.go('styles') }, icon('back'), 'Speech styles'), h('span.chip', `Lesson ${idx + 1} of ${L.length}`)),
    h('div.stack', { style: { gap: '6px' } }, h('div.eyebrow', '話し方 · Speech styles'), h('h1', l.t), h('p', { style: { fontSize: '1.1rem' } }, l.sum)),
    h('div.grid.gram-grid', { style: { gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: '18px' } },
      h('section.card.pad-lg.stack', h('div.rg-exp', l.exp.split('\n').filter(Boolean).map(t => h('p', { html: inlineMd(t) })))),
      h('section.stack', h('div.eyebrow', 'Examples'), l.ex.map(exRow))),
    h('section.card.stack', h('h3', 'Side by side'), table),
    qs.length ? h('section.card.pad-lg.stack', h('h3', 'Quick check'), quizHost) : null,
    h('div.row.between', prev ? h('button.btn', { onclick: () => App.go('style', { id: prev.id }) }, icon('back'), prev.t) : h('span'), next ? h('button.btn', { onclick: () => App.go('style', { id: next.id }) }, next.t) : null));
  regKeys(view);
  return view;
};

// ─── Style Switch drill ───────────────────────────────────────────────────
VIEWS.styleswitch = () => {
  const P = REGISTER.pairs; if (!P.length) return VIEWS.styles();
  const st = regState(); const cfg = Object.assign({ dir: 'mix', mode: (st.best.switchRuns || 0) >= 2 ? 'type' : 'pick' }, regCfgGet());
  const N = 10;
  const dirs = { mix: 'Mixed', casual: '→ Casual', polite: '→ Polite', keigo: '→ Keigo' };
  const settings = h('section.card.row.between', { style: { gap: '10px' } },
    h('div.tabs.rg-dirtabs', { role: 'tablist', 'aria-label': 'Direction' }, Object.entries(dirs).map(([k, l]) => h('button', { role: 'tab', 'aria-selected': cfg.dir === k ? 'true' : 'false', onclick: () => { cfg.dir = k; regCfgSet(cfg); App.go('styleswitch'); } }, l))),
    h('div.tabs', { role: 'tablist', 'aria-label': 'Answer mode' }, [['pick', 'Pick'], ['type', 'Type']].map(([k, l]) => h('button', { role: 'tab', 'aria-selected': cfg.mode === k ? 'true' : 'false', onclick: () => { cfg.mode = k; regCfgSet(cfg); App.go('styleswitch'); } }, l))));
  const legOK = (p, from, to) => p[from] && p[to];
  const legsFor = p => {
    if (cfg.dir === 'casual') return [['polite', 'casual']];
    if (cfg.dir === 'polite') return [['casual', 'polite']];
    if (cfg.dir === 'keigo') return [['polite', 'keigo']];
    return [['polite', 'casual'], ['casual', 'polite'], ['polite', 'casual'], ['casual', 'polite'], ['polite', 'keigo'], ['keigo', 'polite']];
  };
  const items = [];
  for (const p of shuffle(P)) { const legs = legsFor(p).filter(([f, t]) => legOK(p, f, t)); if (legs.length) items.push({ p, leg: pick(legs) }); if (items.length >= N) break; }
  const { top, set } = regStudyTop(() => App.go('styles'), 'End drill');
  const stage = h('div');
  let i = 0, correct = 0, combo = 0, bestCombo = 0, xp = 0; const missed = [];
  const ask = () => {
    if (i >= items.length) return finish();
    set(i, items.length, combo);
    const { p, leg: [from, to] } = items[i]; const src = p[from], tgt = p[to];
    const targets = [tgt, ...((p.alt || {})[to] || [])];
    const fb = h('div'); let answered = false;
    const card = h('div.qcard');
    const onAnswer = (ok, typed) => {
      if (answered) return; answered = true;
      if (ok) { correct++; combo++; bestCombo = Math.max(bestCombo, combo); const g = 2 + (combo % 5 === 0 ? 3 : 0); xp += g; addXP(g); Sfx.ok(); }
      else { combo = 0; missed.push(items[i]); Sfx.bad(); save(); }
      set(i + 1, items.length, combo);
      Voice.say(tgt.jp, { tts: tgt.fu });
      const cont = h('button.btn.primary', { onclick: () => { i++; ask(); } }, 'Continue', h('span.kbd', 'Enter'));
      const oops = typed && !ok ? h('button.btn.sm.ghost', { onclick: () => { oops.remove(); correct++; missed.pop(); combo = 1; xp += 2; addXP(2); fb.querySelector('.feedback').className = 'feedback ok'; fb.querySelector('strong').textContent = 'Counted as correct'; } }, icon('undo'), 'I was right') : null;
      fb.replaceChildren(h('div.feedback.' + (ok ? 'ok' : 'no'),
        h('strong', ok ? pick(['正解！ Correct', 'ぴったり！ Spot on', 'いいね！ Nice']) : 'Not quite'),
        h('div.ans', h('span.jp', { style: { fontSize: '1.2rem' } }, tgt.jp), regFuri() && tgt.fu !== tgt.jp ? h('span.muted.small.jp', '  ' + tgt.fu) : null),
        regCompare(p, to),
        p.ctx ? h('div.small.rg-ctx', p.ctx) : null,
        h('div.row.between', h('div', oops), cont)));
      setTimeout(() => cont.focus(), 30);
    };
    const qhead = h('div.row', { style: { justifyContent: 'center', gap: '8px' } }, regChip(from), h('span.muted', '→'), regChip(to));
    const big = h('div.qbig.rg-qbig', regSent(src, { big: true }), h('div.hint', `“${p.en}”`), h('div.hint.small', `Now say it for: ${REG_INFO[to].who.split(':')[0].toLowerCase()}`));
    setTimeout(() => Voice.say(src.jp, { tts: src.fu }), 200);
    if (cfg.mode === 'pick') {
      const pool = [];
      for (const r of REG_ORDER) if (r !== to && r !== from && p[r]) pool.push({ x: p[r], note: r });
      // Look-alikes: other sentences in the target style that share the most characters with the answer.
      const chars = new Set(regNorm(tgt.jp));
      const sim = o => [...new Set(regNorm(o[to].jp))].filter(c => chars.has(c)).length + Math.random();
      const near = P.filter(o => o.id !== p.id && o[to] && o[to].jp !== tgt.jp).map(o => [sim(o), o]).sort((a, b) => b[0] - a[0]).slice(0, 5).map(x => x[1]);
      for (const o of shuffle(near)) { if (pool.length >= 3) break; pool.push({ x: o[to], note: 'other' }); }
      const sig = x => String(x.jp || '').normalize('NFKC').replace(/[\s、，,．.。！!…‥・「」『』()（）〜~"'“”]/g, '').replace(/\?/g, '？');
      const seen = new Set([sig(tgt)]), uniq = [];
      for (const o of pool) { const k = sig(o.x); if (!seen.has(k)) { seen.add(k); uniq.push(o); } }
      const opts = shuffle([{ x: tgt, correct: true }, ...uniq.slice(0, 3)]);
      const box = h('div.opts.rg-opts', opts.map((o, k) => {
        const b = h('button.opt.rg-jpopt', { type: 'button', onclick: () => {
          if (answered) return; b.classList.add(o.correct ? 'right' : 'wrong');
          [...box.children].forEach((x, j) => { if (opts[j].correct) x.classList.add('right'); x.setAttribute('disabled', ''); });
          onAnswer(!!o.correct, false);
        } }, h('span.k', String(k + 1)), h('span', o.x.jp));
        return b;
      }));
      card.append(qhead, big, box, fb);
      setPick(k => { if (!answered) box.children[k]?.click(); });
    } else {
      const inp = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', lang: 'ja', placeholder: 'type romaji → かな (kanji also accepted)', 'aria-label': `The ${to} version` });
      bindIME(inp);
      const go = h('button.btn.primary', { type: 'submit' }, 'Check');
      const skip = h('button.btn.sm.ghost', { type: 'button', onclick: () => { if (answered) return; inp.readOnly = true; go.remove(); skip.remove(); onAnswer(false, false); } }, 'Show me');
      const form = h('form.typein', { onsubmit: e => { e.preventDefault(); if (answered || !inp.value.trim()) return; const ok = regAccepts(inp.value, targets); inp.readOnly = true; inp.classList.add(ok ? 'right' : 'wrong'); go.remove(); skip.remove(); onAnswer(ok, true); } }, inp, go);
      setPick(null);
      card.append(qhead, big, form, h('div.row', { style: { justifyContent: 'center' } }, skip), fb);
      setTimeout(() => inp.focus(), 60);
    }
    stage.replaceChildren(card);
  };
  const finish = () => {
    const pct = items.length ? correct / items.length : 1;
    st.best.switch = Math.max(st.best.switch || 0, pct); st.best.switchRuns = (st.best.switchRuns || 0) + 1;
    const bonus = pct === 1 ? 10 : 5; addXP(bonus); xp += bonus; save(); set(items.length, items.length, 0);
    const missedEls = missed.map(({ p, leg: [, to] }) => h('div.rg-miss', h('span.small.muted', p.en), h('span.jp', p[to].jp), regChip(to)));
    setPick(null);
    stage.replaceChildren(regResult({ pct, title: 'Style Switch done', sub: `${correct}/${items.length} correct · best combo ${bestCombo} · +${xp} XP`, missed: missedEls, again: () => App.go('styleswitch'), extra: Sensei.available ? regCheckerCard(true) : null }));
    stage.querySelector('.rg-next')?.focus();
  };
  const view = h('div', h('div.stack', { style: { gap: '4px' } }, h('div.eyebrow', '話し方 · Speech styles'), h('h1', 'Style Switch'), h('p.muted', 'Same meaning, different listener. Change the sentence into the style asked for.')), settings, h('div.study', top, stage));
  const setPick = regKeys(stage);
  ask();
  return view;
};

// ─── Read the Room drill ──────────────────────────────────────────────────
VIEWS.readroom = () => {
  const SIT = REGISTER.situations; if (!SIT.length) return VIEWS.styles();
  const st = regState(); const items = shuffle(SIT).slice(0, 10);
  const { top, set } = regStudyTop(() => App.go('styles'), 'End drill');
  const stage = h('div');
  let i = 0, score = 0, bests = 0, combo = 0, bestCombo = 0, xp = 0; const missed = [];
  const ask = () => {
    if (i >= items.length) return finish();
    set(i, items.length, combo);
    const s = items[i]; const [glyph, whoLabel] = REG_WHO[s.who] || ['人', s.who];
    let answered = false; const fb = h('div');
    const opts = shuffle(s.options);
    const verdictLabel = { best: 'Best', ok: 'OK', off: 'Off' };
    const box = h('div.rg-choices', opts.map((o, k) => {
      const why = h('div.rg-why', { hidden: true }, h('span.rg-verdict', { 'data-v': o.verdict }, verdictLabel[o.verdict]), h('span', o.why));
      const b = h('button.rg-choice', { type: 'button', 'data-v': o.verdict, onclick: () => {
        if (answered) return; answered = true;
        b.classList.add('picked');
        [...box.children].forEach(c => { c.classList.add('revealed'); c.setAttribute('aria-disabled', 'true'); c.querySelector('.rg-why').hidden = false; });
        const v = o.verdict;
        if (v === 'best') { score += 1; bests++; combo++; bestCombo = Math.max(bestCombo, combo); const g = 3 + (combo % 5 === 0 ? 3 : 0); xp += g; addXP(g); Sfx.ok(); }
        else { if (v === 'ok') { score += 0.5; xp += 1; addXP(1); } else save(); combo = 0; missed.push(s); Sfx.bad(); }
        set(i + 1, items.length, combo);
        const best = s.options.find(x => x.verdict === 'best');
        Voice.say(best.jp, { tts: best.fu });
        const cont = h('button.btn.primary', { onclick: () => { i++; ask(); } }, 'Continue', h('span.kbd', 'Enter'));
        fb.replaceChildren(h('div.feedback.' + (v === 'best' ? 'ok' : v === 'ok' ? 'meh' : 'no'),
          h('div.row.between', h('strong', v === 'best' ? pick(['ぴったり！ Just right', '正解！ Perfect fit', 'いいね！ Nice read']) : v === 'ok' ? 'Works, but not the best fit' : 'That would land badly'), speakBtn(best.jp, 'Play the best reply', best.fu)),
          h('div.row.between', h('span.small', v === 'best' ? '' : h('span', 'Best: ', h('span.jp', best.jp))), cont)));
        setTimeout(() => cont.focus(), 30);
      } }, h('span.k', String(k + 1)), h('div.rg-choice-body', h('span.jp', o.jp), regFuri() && o.fu !== o.jp ? h('span.rg-fu.jp', o.fu) : null, why));
      return b;
    }));
    const scene = h('div.rg-scene',
      h('span.hanko.rg-who', { 'aria-hidden': 'true' }, glyph),
      h('div.stack', { style: { gap: '4px' } }, h('div.eyebrow', `Talking to: ${whoLabel}`), h('div.rg-scene-t', s.scene)));
    const bubble = s.prompt ? h('div.rg-bubble', h('div.row', { style: { gap: '8px', flexWrap: 'nowrap', alignItems: 'flex-start' } }, h('span.jp', s.prompt.jp), speakBtn(s.prompt.jp, 'Play their line', s.prompt.fu)), regFuri() && s.prompt.fu !== s.prompt.jp ? h('div.rg-fu.jp', s.prompt.fu) : null) : null;
    if (s.prompt) setTimeout(() => Voice.say(s.prompt.jp, { tts: s.prompt.fu }), 200);
    stage.replaceChildren(h('div.qcard', scene, bubble, h('div.q', s.prompt ? 'How do you reply?' : 'What do you say?'), box, fb));
    setPick(k => { if (!answered) box.children[k]?.click(); });
  };
  const finish = () => {
    const pct = items.length ? score / items.length : 1;
    st.best.room = Math.max(st.best.room || 0, pct);
    const bonus = pct === 1 ? 10 : 5; addXP(bonus); xp += bonus; save(); set(items.length, items.length, 0);
    const missedEls = missed.map(s => { const b = s.options.find(o => o.verdict === 'best'); return h('div.rg-miss', h('span.small.muted', s.scene), h('span.jp', b.jp), h('span.hanko.rg-who.sm', { 'aria-hidden': 'true' }, (REG_WHO[s.who] || ['人'])[0])); });
    setPick(null);
    stage.replaceChildren(regResult({ pct, title: 'Read the Room done', sub: `${bests}/${items.length} best replies · best combo ${bestCombo} · +${xp} XP`, missed: missedEls, again: () => App.go('readroom') }));
    stage.querySelector('.rg-next')?.focus();
  };
  const view = h('div', h('div.stack', { style: { gap: '4px' } }, h('div.eyebrow', '話し方 · Speech styles'), h('h1', 'Read the Room'), h('p.muted', 'Who are you talking to? Pick the reply that fits the person, not just the grammar.')), h('div.study', top, stage));
  const setPick = regKeys(stage);
  ask();
  return view;
};

// ─── Sensei: check my own sentence ────────────────────────────────────────
function regCheckerCard(inResults) {
  const inp = h('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', lang: 'ja', placeholder: 'e.g. ashita nanji ni kuru? → 明日何時に来る？', 'aria-label': 'Your sentence' });
  bindIME(inp);
  const sel = h('select', { 'aria-label': 'Who are you talking to?' }, Object.entries(REG_WHO).map(([k, [, l]]) => h('option', { value: k }, l)));
  const out = h('div.stack'); let ctl = null;
  const btn = h('button.btn.seal', { type: 'submit' }, icon('sparkle'), 'Check');
  const form = h('form.rg-checker', { onsubmit: async e => {
    e.preventDefault(); const text = inp.value.trim(); if (!text || btn.disabled) return;
    if (!Sensei.available) { out.replaceChildren(h('div.feedback.no', 'Sensei is not available here.')); return; }
    btn.disabled = true; ctl?.abort(); ctl = new AbortController();
    out.replaceChildren(h('div.row', h('span.typing', h('i'), h('i'), h('i')), h('span.muted', 'Sensei is reading the room…')));
    const who = REG_WHO[sel.value][1]; const prof = Sensei.learnerProfile();
    const prompt = `You are a precise, encouraging Japanese teacher who specialises in speech styles (registers). The learner is a ${prof.level}. They want to say this to ${who.toLowerCase()}:\n\n${text}\n\n(If it is in romaji or English, work out what they meant.) Decide whether the register fits that listener: casual (plain form) for friends, family and children; polite (です/ます) for strangers, coworkers, teachers and shop staff; keigo (尊敬語/謙譲語) for customers, clients and very senior people. Also catch grammar mistakes and keigo used the wrong way round.\nReply ONLY with JSON: {"verdict": "fits" | "too casual" | "too formal" | "mixed" | "has a mistake", "casual": {"jp": "natural casual version", "kana": "same in kana only"}, "polite": {"jp": "natural です/ます version", "kana": "..."}, "keigo": {"jp": "natural keigo version, or empty string if keigo would be unnatural here", "kana": "..."}, "best": "casual" | "polite" | "keigo" (which one fits ${who.toLowerCase()}), "note": "1–3 short English sentences: what to change and why"}`;
    try {
      const r = await Sensei.fn.json(prompt, { signal: ctl.signal, modelTier: 'default' });
      const norm = x => typeof x === 'string' ? { jp: x, fu: x } : x && x.jp ? { jp: String(x.jp), fu: String(x.kana || x.fu || x.jp) } : null;
      const p = { casual: norm(r.casual), polite: norm(r.polite), keigo: norm(r.keigo) };
      if (p.keigo && !p.keigo.jp.trim()) p.keigo = null;
      const best = REG_ORDER.includes(r.best) ? r.best : null;
      const good = /^fits/i.test(String(r.verdict || ''));
      out.replaceChildren(h('div.feedback.' + (good ? 'ok' : 'meh'), h('strong', good ? `Fits ${who.toLowerCase()}` : String(r.verdict || 'Check the note').replace(/^./, c => c.toUpperCase())), r.note ? h('div.ans', String(r.note)) : null),
        regCompare(p, best));
      addXP(2);
    } catch (err) { if (err?.code !== 'cancelled') out.replaceChildren(h('div.feedback.no', Sensei.errorText(err))); }
    btn.disabled = false;
  } }, h('div.rg-checker-row', inp, sel, btn));
  return h('section.card.pad-lg.stack' + (inResults ? '.rg-checker-card' : ''),
    h('div.row', { style: { gap: '10px' } }, h('span.hanko', { style: { width: '42px', height: '42px', fontSize: '1.15rem' } }, '先'), h('div', h('h3', 'Check my own sentence'), h('p.muted.small', 'Write something you want to say and pick who it is for. Sensei says whether it fits and shows it in all three styles.'))),
    form, out);
}
