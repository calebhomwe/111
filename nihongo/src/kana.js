// Kana tables, romaji, mnemonics and look-alike sets.
const KANA_ROWS = [
  // [row id, label, [ [hira, kata, romaji], ... ] ]  null = empty grid cell
  ['a', 'Vowels', [['あ','ア','a'],['い','イ','i'],['う','ウ','u'],['え','エ','e'],['お','オ','o']]],
  ['k', 'K-row', [['か','カ','ka'],['き','キ','ki'],['く','ク','ku'],['け','ケ','ke'],['こ','コ','ko']]],
  ['s', 'S-row', [['さ','サ','sa'],['し','シ','shi'],['す','ス','su'],['せ','セ','se'],['そ','ソ','so']]],
  ['t', 'T-row', [['た','タ','ta'],['ち','チ','chi'],['つ','ツ','tsu'],['て','テ','te'],['と','ト','to']]],
  ['n', 'N-row', [['な','ナ','na'],['に','ニ','ni'],['ぬ','ヌ','nu'],['ね','ネ','ne'],['の','ノ','no']]],
  ['h', 'H-row', [['は','ハ','ha'],['ひ','ヒ','hi'],['ふ','フ','fu'],['へ','ヘ','he'],['ほ','ホ','ho']]],
  ['m', 'M-row', [['ま','マ','ma'],['み','ミ','mi'],['む','ム','mu'],['め','メ','me'],['も','モ','mo']]],
  ['y', 'Y-row', [['や','ヤ','ya'],null,['ゆ','ユ','yu'],null,['よ','ヨ','yo']]],
  ['r', 'R-row', [['ら','ラ','ra'],['り','リ','ri'],['る','ル','ru'],['れ','レ','re'],['ろ','ロ','ro']]],
  ['w', 'W-row + ん', [['わ','ワ','wa'],null,['ん','ン','n'],null,['を','ヲ','wo']]],
  ['g', 'G (dakuten)', [['が','ガ','ga'],['ぎ','ギ','gi'],['ぐ','グ','gu'],['げ','ゲ','ge'],['ご','ゴ','go']]],
  ['z', 'Z (dakuten)', [['ざ','ザ','za'],['じ','ジ','ji'],['ず','ズ','zu'],['ぜ','ゼ','ze'],['ぞ','ゾ','zo']]],
  ['d', 'D (dakuten)', [['だ','ダ','da'],['ぢ','ヂ','ji'],['づ','ヅ','zu'],['で','デ','de'],['ど','ド','do']]],
  ['b', 'B (dakuten)', [['ば','バ','ba'],['び','ビ','bi'],['ぶ','ブ','bu'],['べ','ベ','be'],['ぼ','ボ','bo']]],
  ['p', 'P (handakuten)', [['ぱ','パ','pa'],['ぴ','ピ','pi'],['ぷ','プ','pu'],['ぺ','ペ','pe'],['ぽ','ポ','po']]],
];
const YOON_ROWS = [
  ['ky', [['きゃ','キャ','kya'],['きゅ','キュ','kyu'],['きょ','キョ','kyo']]],
  ['sh', [['しゃ','シャ','sha'],['しゅ','シュ','shu'],['しょ','ショ','sho']]],
  ['ch', [['ちゃ','チャ','cha'],['ちゅ','チュ','chu'],['ちょ','チョ','cho']]],
  ['ny', [['にゃ','ニャ','nya'],['にゅ','ニュ','nyu'],['にょ','ニョ','nyo']]],
  ['hy', [['ひゃ','ヒャ','hya'],['ひゅ','ヒュ','hyu'],['ひょ','ヒョ','hyo']]],
  ['my', [['みゃ','ミャ','mya'],['みゅ','ミュ','myu'],['みょ','ミョ','myo']]],
  ['ry', [['りゃ','リャ','rya'],['りゅ','リュ','ryu'],['りょ','リョ','ryo']]],
  ['gy', [['ぎゃ','ギャ','gya'],['ぎゅ','ギュ','gyu'],['ぎょ','ギョ','gyo']]],
  ['j',  [['じゃ','ジャ','ja'],['じゅ','ジュ','ju'],['じょ','ジョ','jo']]],
  ['by', [['びゃ','ビャ','bya'],['びゅ','ビュ','byu'],['びょ','ビョ','byo']]],
  ['py', [['ぴゃ','ピャ','pya'],['ぴゅ','ピュ','pyu'],['ぴょ','ピョ','pyo']]],
];

// Memory tricks. Hiragana first, katakana second.
const KANA_MN = {
  'あ':'An Apple with a cross cut through it — "a!"', 'い':'Two eels side by side: "ii" (eel)', 'う':'A person bent over, going "oof" — u', 'え':'An exotic bird with a feathered crest — "eh?"', 'お':'A UFO landing with an antenna — "oh!"',
  'か':'A karate chop with a blade — "ka!"', 'き':'A key with two teeth — "ki"', 'く':'A cuckoo bird\'s open beak — "ku"', 'け':'A keg next to a spout — "ke"', 'こ':'Two coins stacked — "ko"',
  'さ':'A samurai\'s face, cross on top — "sa"', 'し':'A shepherd\'s crook / fishhook — "shi"', 'す':'A swing with a loop — "su"', 'せ':'Say "se" to a mouth with a big tooth', 'そ':'A zig-zag sewing thread — "so"',
  'た':'"ta" looks like the letters t and a', 'ち':'A cheerleader flipping — "chi"', 'つ':'A tsunami wave — "tsu"', 'て':'A tail — "te"', 'と':'A toe with a splinter — "to"',
  'な':'A nun praying at a cross — "na"', 'に':'A knee next to two lines — "ni"', 'ぬ':'Noodles on chopsticks — "nu"', 'ね':'A nest-building cat with its tail curled — "ne"', 'の':'A "no" sign: a slash in a circle — "no"',
  'は':'"Ha!" — an H next to an a', 'ひ':'A big grin: "hee hee" — "hi"', 'ふ':'Mount Fuji with a peak — "fu"', 'へ':'A mountain peak — "he" climbs it', 'ほ':'A holy man next to a ladder — "ho"',
  'ま':'Mama with long hair and a loop — "ma"', 'み':'A music note 21 — "mi"', 'む':'A cow going "moo" — "mu"', 'め':'An eye (me = eye) — "me"', 'も':'A fishhook with two worms: more bait — "mo"',
  'や':'A yak with horns — "ya"', 'ゆ':'A unique fish swimming — "yu"', 'よ':'A yo-yo on a string — "yo"',
  'ら':'A rabbit sitting up — "ra"', 'り':'Reeds swaying — "ri"', 'る':'A route with a loop at the end — "ru"', 'れ':'A ray of light hitting a corner — "re"', 'ろ':'A road with no loop — "ro"',
  'わ':'A wasp with a stinger tail — "wa"', 'を':'A person going "whoa!" — "wo"', 'ん':'A lowercase n in cursive — "n"',
  'ア':'An axe — "a"', 'イ':'An easel — "i"', 'ウ':'う with a roof: "u"', 'エ':'An elevator shaft — "e"', 'オ':'An opera singer, arms out — "o"',
  'カ':'Same as か without the extra tick — "ka"', 'キ':'A key — "ki"', 'ク':'A cool beak — "ku"', 'ケ':'A letter K tilted — "ke"', 'コ':'A corner — "ko"',
  'サ':'A saddle hanging — "sa"', 'シ':'She smiles: eyes look UP the face — "shi"', 'ス':'A swan\'s leg — "su"', 'セ':'Like せ — "se"', 'ソ':'A needle sewing downward — "so"',
  'タ':'A taco / ク with a line — "ta"', 'チ':'A cheerleader with pom-poms — "chi"', 'ツ':'Tsunami: marks look DOWN on the wave — "tsu"', 'テ':'A telephone pole — "te"', 'ト':'A totem pole — "to"',
  'ナ':'A knife, cutting — "na"', 'ニ':'Two lines = "ni" (two)', 'ヌ':'Noodles with a chopstick — "nu"', 'ネ':'A nest on a branch — "ne"', 'ノ':'A single "no" slash — "no"',
  'ハ':'Two lines laughing "ha ha" — "ha"', 'ヒ':'A heel kicking — "hi"', 'フ':'A foot kicking — "fu"', 'ヘ':'Same shape as へ — "he"', 'ホ':'A holy cross — "ho"',
  'マ':'A mama\'s face — "ma"', 'ミ':'Three lines = "mi" (3)', 'ム':'A moo-ing cow\'s nose — "mu"', 'メ':'An X marks a mess — "me"', 'モ':'More lines than ニ — "mo"',
  'ヤ':'A yak\'s horn — "ya"', 'ユ':'A U-turn — "yu"', 'ヨ':'A yo-yo trick in three lines — "yo"',
  'ラ':'A rabbit with a flat head — "ra"', 'リ':'Reeds, like り — "ri"', 'ル':'Two roots — "ru"', 'レ':'A raised hand — "re"', 'ロ':'A road block (square) — "ro"',
  'ワ':'A wine glass — "wa"', 'ヲ':'A "whoa" horse — "wo"', 'ン':'"n": the mark looks UP like シ but only once',
};
// Easily-confused sets for harder distractors.
const KANA_CONFUSE = [
  'ぬめ','ねれわ','はほ','るろ','さち','きさ','いり','こに','シツ','ソンリ','クタ','ウワフ','コユロ','ノメ','チテ','アマ','ヌス','セサ','ぼぽ','ばぱ',
];

const HIRA = [], KATA = [], KANA_ROMAJI = {};
for (const [, , cells] of KANA_ROWS) for (const c of cells) if (c) { HIRA.push(c[0]); KATA.push(c[1]); KANA_ROMAJI[c[0]] = c[2]; KANA_ROMAJI[c[1]] = c[2]; }
for (const [, cells] of YOON_ROWS) for (const c of cells) { KANA_ROMAJI[c[0]] = c[2]; KANA_ROMAJI[c[1]] = c[2]; }
// Kana lessons: one per row, split hiragana and katakana, plus yoon.
const KANA_LESSONS = [];
for (const script of ['h', 'k']) {
  KANA_ROWS.forEach(([id, label, cells], i) => {
    KANA_LESSONS.push({ id: `${script}-${id}`, script, label, chars: cells.filter(Boolean).map(c => script === 'h' ? c[0] : c[1]) });
    // every three rows: a mixed review weighted to look-alikes
    if (i % 3 === 2 && i < 10) { const rows = KANA_ROWS.slice(i - 2, i + 1); KANA_LESSONS.push({ id: `${script}-mix${i}`, script, label: `Review: ${rows.map(r => r[0].toUpperCase()).join(' · ')} rows`, chars: rows.flatMap(r => r[2].filter(Boolean).map(c => script === 'h' ? c[0] : c[1])).filter((_, j) => j % 3 !== 1), review: true }); }
  });
  const yo = YOON_ROWS.flatMap(([, cells]) => cells.map(c => script === 'h' ? c[0] : c[1]));
  for (let i = 0; i < 3; i++) KANA_LESSONS.push({ id: `${script}-yoon${i ? i + 1 : ''}`, script, label: `Combos (yōon) ${i + 1}`, chars: yo.slice(Math.round(i * yo.length / 3), Math.round((i + 1) * yo.length / 3)) });
}
