'use strict';
/* api/illustration.js - a real illustration for a lesson, found on Wikimedia
   Commons and chosen by a model that LOOKS at the candidates.

   Why: the model cannot draw (every picture it placed by coordinates looked
   like a guess), but it can judge. Commons holds tens of thousands of
   human-made diagrams under free licences; the work is finding the right one
   and refusing the wrong ones. A survey of twelve real lesson topics set the
   rules below: language copies swamp results (the nitrogen cycle came back
   in seven languages before English), searches return noise (a llama and two
   flags for "parts of the ear"), near-misses look right by title (the
   atmosphere's layers for "layers of the earth"), and some files are strips
   a phone cannot show (a 1:5 solar system).

     GET ?topic=&broad=&subject=   -> { picks: [{file, credit, author, license,
                                        licenseUrl, source, w, h, why}] }  (0-3, best first)
     GET ?file=File:Name.svg        -> { svg, file, credit, author, license, licenseUrl, source }

   Both are cached at the CDN for 30 days: a topic is judged once, for every
   learner. Errors are never cached. The file endpoint re-checks the licence
   and size itself and never trusts the caller; its output is cleaned here
   and sanitised again in the browser (sf-illustrate.js) before it is drawn.

   Open, like api/generate.js: the cost per new topic is one small vision call,
   far below a day prompt. */

const UA = 'StudyFlow/1.0 (+https://studyflow-ten-vert.vercel.app; lesson illustrations)';
const API = 'https://commons.wikimedia.org/w/api.php';
const MIN_BYTES = 3 * 1024;
const MAX_BYTES = 1200 * 1024;
const MAX_CANDIDATES = 5;          // images the judge sees
const MAX_PICKS = 3;
const COMMONS_TIMEOUT_MS = 10000;
const JUDGE_TIMEOUT_MS = 30000;
const MODEL = 'claude-haiku-4-5-20251001';
const SUBJECTS = { science: 1, math: 1, history: 1, english: 1, language: 1, geography: 1,
                   psychology: 1, economics: 1, cs: 1, general: 1 };

/* ── small helpers ──────────────────────────────────────────────────────── */

function clip(s, n) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n); }
function stripTags(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

function fetchT(url, opts, ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, Object.assign({}, opts || {}, { signal: ctrl.signal })).finally(() => clearTimeout(id));
}

/* Commons asks API clients to identify themselves; a browser may not set
   User-Agent, so Api-User-Agent says the same thing there. */
async function commons(params, tries) {
  const q = Object.assign({ format: 'json', formatversion: 2, origin: '*' }, params);
  const url = API + '?' + new URLSearchParams(q).toString();
  let last;
  for (let i = 0; i < (tries || 2); i++) {
    try {
      const r = await fetchT(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } }, COMMONS_TIMEOUT_MS);
      if (r.status === 429 || r.status >= 500) { last = new Error('commons ' + r.status); await sleep(1500 * (i + 1)); continue; }
      if (!r.ok) throw new Error('commons ' + r.status);
      return await r.json();
    } catch (e) { last = e; if (e.name === 'AbortError') break; }
  }
  throw last || new Error('commons failed');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ── licences ───────────────────────────────────────────────────────────── */

/* Free to show with a credit. Not GFDL alone (it wants its whole text
   reproduced), never NC or ND. A port suffix ("CC BY-SA 3.0 nl") is fine. */
function licenceOk(name) {
  const n = clip(name, 60).toLowerCase();
  if (!n || /\bnc\b|\bnd\b|non-?commercial|no-?deriv/.test(n)) return false;
  return /^(public domain|pd|cc0(?: 1\.0)?|cc[ -]by(?:-sa)?[ -]\d(?:\.\d)?(?:[ -][a-z]{2,3})?)$/.test(n);
}

function shortAuthor(a) {
  let s = stripTags(a);
  /* A translated or derived file lists its sources as "Name_xx.svg: *Name_yy.svg:
     Johann Dréo (User:Nojhan), traduction de ..." - file names are not people.
     The nitrogen cycle was credited to "Cicle_del_nitrogen_de.svg : *". */
  const chain = /\.(svg|png|jpe?g|gif)\b/i.test(s) || /derivative work/i.test(s);
  s = s.replace(/(?:Image:|File:)?[^\s:*]+\.(?:svg|png|jpe?g|gif)\s*:?\s*\*?\s*/gi, '').replace(/^[\s:*]+/, '');
  s = s.replace(/^(this (svg|image|file) (image )?was created by|created by|own work by|drawn by)\s*/i, '');
  s = s.split(/[.;]\s|\s\(|,\s?(?:traduction|translation|derivative|modified|vectori[sz]ed)\b/i)[0];
  s = s.replace(/\s*\b(own work|talk|contribs?)\b.*$/i, '').trim();
  if (!s || /^(unknown|anonymous|see below|own work|derivative work:?)$/i.test(s)) return 'Unknown author';
  return chain && s.length <= 36 ? s + ' and others' : s.slice(0, 48);
}

function creditFor(meta) {
  const lic = meta.license || '';
  return 'Illustration: ' + meta.author + ', Wikimedia Commons' + (/public domain|^pd$|cc0/i.test(lic) ? '' : ', ' + lic);
}

/* ── languages ──────────────────────────────────────────────────────────── */

/* A Commons file and its translations differ by a language code at the end
   of the name: "Nitrogen Cycle-eu", "Nitrogen Cycle hu", "Acoustic guitar
   (mul)", "Electric guitar parts alt uz cyrl". Short English words that are
   also codes ("in", "is", "to") only count after - or _ or in brackets. */
const LANGS = new Set(('aa ab af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu ' +
  'ast bxr smn arz azb bcl bjn ckb crh csb diq dsb frr fur gom hak hif hsb ilo jbo kab kbd koi krc ksh lez lij lmo ltg mai mhr min mrj mwl mzn nah nap nds new nov pam pap pcd pdc pfl pms pnb rmy rue sah scn sco sgs shn srn stq szl tcy tet tpi tum tyv udm vec vep vls war wuu xal xmf yue zea ' +
  'nan cdo gan lzh ary ace als ang arc bar bpy ceb frp gag gsw hyw kaa kbp krl lad lfn lld lrc mnw myv nqo nrm olo pnt rup sat skr tly vro zgh ' +
  'esp rus mul ger fra spa ita por chi jpn kor ukr hrv ces slk pol nld swe nor dan fin hun ron bul ell tur heb ara per hin ben').split(' '));
const SCRIPT = /^(cyrl|latn|hans|hant|arab|deva)$/i;
/* Codes that look like English words ("no", "it", "as") are NOT exempt: the
   survey met "Nitrogen Cycle no", "Human skeleton front it" and "...back as"
   (Assamese). An English file whose title really ends in " it" is lost to
   the shortlist, which costs nothing - there are always others. */
const NAMES = 'hrvatski espanol español spanish german deutsch french francais français italian italiano portuguese portugues português ' +
  'russian chinese japanese korean arabic hebrew polish polski dutch nederlands swedish svenska norwegian norsk danish dansk finnish ' +
  'suomi hungarian magyar turkish turkce türkçe greek catalan català galego galician euskara basque welsh cymraeg czech cesky česky ' +
  'slovak romanian romana română ukrainian bulgarian serbian srpski vietnamese thai hindi bengali indonesian malay persian farsi ' +
  'esperanto latin latina';
const NAME_RE = new RegExp('^(.*?)[\\s_-]*\\(?(' + NAMES.split(' ').join('|') + '|english)\\)?$', 'i');
/* A title written in another language, with no code at all ("Ciclo de
   Krebs", "Alavanca de terceira clase"): its small words give it away. */
const FOREIGN_WORDS = /\b(de|la|el|los|las|del|der|die|das|und|le|les|des|du|et|da|do|dos|och|og|och|von|zu|il|della|di|y|ou|na|ze|ve)\b/i;
const ENGLISH_WORDS = /\b(the|of|and|with|in|to|for|from|on|how|what|parts?)\b/i;

function langOf(title) {
  let base = String(title).replace(/^File:/i, '').replace(/\.svg$/i, '');
  const n = base.match(NAME_RE);
  if (n && n[1]) return { lang: /^english$/i.test(n[2]) ? 'en' : n[2].toLowerCase(), base: n[1].replace(/[\s_(-]+$/, '') };
  const m = base.match(/^(.*?)(?:([\s_-])\(?([A-Za-z]{2,3})\)?(?:[\s_-]([A-Za-z]{4}))?|\(([A-Za-z]{2,3})\))$/);
  if (m && !(m[4] && !SCRIPT.test(m[4]))) {
    const code = (m[3] || m[5] || '').toLowerCase();
    if (LANGS.has(code)) return { lang: code, base: m[1].replace(/[\s_-]+$/, '') };
  }
  const words = base.replace(/[_-]+/g, ' ');
  if (FOREIGN_WORDS.test(words) && !ENGLISH_WORDS.test(words)) return { lang: 'xx', base: base };
  return { lang: '', base: base };
}

/* ── relevance ──────────────────────────────────────────────────────────── */

const STOP = new Set(('the a an and or of in on to for with from into onto how what why when where which who does do is are ' +
  'was were be been its it this that these those their our your vs versus about between during after before over under ' +
  'part parts structure structures function functions introduction intro basics basic overview lesson unit chapter day ' +
  'week types type kinds simple process processes main key important review guide notes study learning understanding ' +
  'explained explain example examples using use uses role effect effects').split(' '));

/* A topic's content words as patterns: a long word by its first five
   letters ("volca" finds volcano and volcanic), a short one whole, with its
   plural - "ear" must not find "early" or "earth". */
function stems(text) {
  const out = [];
  String(text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/).forEach(w => {
    if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) return;
    const s = w.length <= 4 ? '\\b' + w.replace(/s$/, '') + '(?:s|es)?\\b' : '\\b' + w.slice(0, 5);
    if (out.indexOf(s) < 0) out.push(s);
  });
  return out;
}

const NOISE = /\b(flag|flags|coat of arms|coa|logo|icon|icons|emblem|seal|blason|wappen|escudo|insignia|badge|button|signature|stamp|banknote|coin|font|glyph|cursor|emoji|userbox|barnstar|wikiproject|qr code|barcode|medal|ribbon|sleeve|patch|epaulette|uniform|totenkopf|swastika|rune|tattoo|fist|white power|aryan|hate symbol|meme)\b/i;
const TEACHING = /\b(diagram|structure|anatomy|parts|cross[- ]?section|section|cycle|labell?ed|layers|map|schema|scheme|model|illustration|overview|process|life cycle|stages)\b/i;

function score(c, topicStems, topic) {
  const title = c.title.toLowerCase(), desc = String(c.desc || '').toLowerCase();
  let hits = 0, inTitle = 0, inDesc = 0;
  topicStems.forEach(s => {
    const re = new RegExp(s), t = re.test(title), d = re.test(desc);
    if (t || d) hits++; if (t) inTitle++; if (d) inDesc++;
  });
  /* Two of the topic's words when it has three or more: "Causes of World
     War I" matched a Vietnam War poster and worse on the one word "war".
     Not two of two - "Structure of the Earth" is the picture for "layers of
     the earth", and it does not say "layers". And the match must be in the
     TITLE, or strong in the description (two words): "Map Europe alliances
     1914" names the war only in its description, and is the right map. */
  if (hits < (topicStems.length >= 3 ? 2 : 1)) return -1;
  if (!inTitle && inDesc < 2) return -1;
  if (NOISE.test(c.title) && !NOISE.test(topic)) return -1;
  let sc = inTitle * 3 + hits + Math.max(0, 12 - c.rank) / 4;
  if (TEACHING.test(c.title)) sc += 2;
  if (c.lang === 'en') sc += 1;
  if (/\b(numbered|numbers|nummeriert|numerot)\b/i.test(c.title)) sc -= 3;
  if (/\b(blank|unlabell?ed|without text|no labels|empty)\b/i.test(c.title)) sc -= 1;
  return sc;
}

/* ── search ─────────────────────────────────────────────────────────────── */

function toCandidate(p, rank) {
  const ii = p.imageinfo && p.imageinfo[0];
  if (!ii) return null;
  const m = ii.extmetadata || {};
  const v = k => (m[k] && m[k].value) || '';
  const lic = clip(stripTags(v('LicenseShortName')), 60);
  const L = langOf(p.title);
  return { title: p.title, rank: rank, url: ii.url, thumb: ii.thumburl || '', mime: ii.mime, size: ii.size || 0,
           w: ii.width || 0, h: ii.height || 0, license: lic, licenseUrl: clip(v('LicenseUrl'), 200),
           author: shortAuthor(v('Artist')), desc: clip(stripTags(v('ImageDescription')), 300),
           lang: L.lang, base: L.base.toLowerCase() };
}

const II_PROPS = { prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: 500,
                   iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|ImageDescription' };

async function search(q) {
  const d = await commons(Object.assign({ action: 'query', generator: 'search', gsrnamespace: 6,
    gsrsearch: q + ' filetype:drawing', gsrlimit: 40 }, II_PROPS));
  const pages = (d.query && d.query.pages) || [];
  return pages.map(p => toCandidate(p, p.index || 99)).filter(Boolean).sort((a, b) => a.rank - b.rank);
}

/* Files a learner can be shown at all. */
function usable(c) {
  if (!c || c.mime !== 'image/svg+xml' || !c.thumb) return false;
  if (c.size < MIN_BYTES || c.size > MAX_BYTES) return false;
  if (!licenceOk(c.license)) return false;
  if (!c.w || !c.h) return false;
  const ar = c.w / c.h;
  return ar >= 0.45 && ar <= 2.4;
}

/* One file per family, in English or with no language. A family that came
   back only in other languages is asked for its English copy by name - in
   one query, by the spellings Commons uses. */
async function collapseLanguages(cands) {
  const fam = new Map();
  cands.forEach(c => { if (!fam.has(c.base)) fam.set(c.base, []); fam.get(c.base).push(c); });
  const keep = [], missing = [];
  fam.forEach(list => {
    const en = list.find(c => c.lang === 'en') || list.find(c => !c.lang);
    if (en) keep.push(Object.assign({}, en, { rank: Math.min.apply(null, list.map(c => c.rank)) }));
    else missing.push(list);
  });
  const tries = [];
  missing.slice(0, 8).forEach(list => {
    const stem = langOf(list[0].title).base;
    [stem + '.svg', stem + '-en.svg', stem + ' en.svg', stem + '_en.svg', stem + ' (en).svg', stem + '-EN.svg']
      .forEach(t => tries.push({ t: 'File:' + t, rank: Math.min.apply(null, list.map(c => c.rank)) }));
  });
  if (tries.length) {
    try {
      const d = await commons(Object.assign({ action: 'query', titles: tries.map(x => x.t).join('|') }, II_PROPS));
      ((d.query && d.query.pages) || []).forEach(p => {
        if (p.missing || !p.imageinfo) return;
        const t = tries.find(x => x.t.toLowerCase() === String(p.title).toLowerCase());
        const c = toCandidate(p, t ? t.rank : 50);
        if (c && (c.lang === 'en' || !c.lang) && !keep.some(k => k.title === c.title)) keep.push(c);
      });
    } catch (e) { /* the English copies are a bonus; the rest still stands */ }
  }
  return keep;
}

async function shortlist(topic) {
  const st = stems(topic);
  if (!st.length) return [];
  const raw = await search(topic);
  const fam = await collapseLanguages(raw);
  /* One file per series: "DNA structure infographic-1, -2, -3, -5" took four
     of five places the judge sees. */
  const series = {};
  function fresh(c) {
    const k = c.base.replace(/([\s_-]*(\d+|vert|horiz|horizontal|vertical|alt|v\d+|new|old|simple|simplified))+$/i, '');
    if (series[k]) return false;
    series[k] = 1;
    return true;
  }
  const ok = fam.filter(usable).filter(c => !(NOISE.test(c.title) && !NOISE.test(topic)) && c.lang !== 'xx' && (!c.lang || c.lang === 'en'));
  const strict = ok.map(c => Object.assign(c, { score: score(c, st, topic) }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score || a.rank - b.rank)
    .filter(fresh);
  /* Too few by our words: top up with what Commons' own search ranked
     highest, through every other filter. "Map Europe alliances 1914-en" is
     the right map for "causes of world war i" and names none of its words;
     search ranked it first. The judge decides, as for every candidate. */
  const list = strict.slice(0, MAX_CANDIDATES + 2);
  list.topUp = function () {
    if (list.length < 3) {
      ok.filter(c => c.rank <= 6 && list.indexOf(c) < 0).sort((a, b) => a.rank - b.rank)
        .forEach(c => { if (list.length < 4 && fresh(c)) list.push(Object.assign(c, { weak: true })); });
    }
    return list;
  };
  return list;
}

/* ── the files themselves ───────────────────────────────────────────────── */

/* The words a file actually prints, English copy of a <switch> preferred. */
function labelsOf(svg) {
  const out = [];
  const re = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
  let m;
  while ((m = re.exec(svg)) && out.length < 60) {
    const lang = /systemLanguage\s*=\s*"([^"]*)"/i.exec(m[1]);
    if (lang && !/(^|[\s,])en\b/i.test(lang[1])) continue;
    const t = stripTags(m[2]);
    if (t && out.indexOf(t) < 0) out.push(t.slice(0, 60));
  }
  return out;
}

/* Text in a script other than Latin is not English, whatever the title says. */
function nonLatinShare(labels) {
  /* Every number (NH₄⁺'s subscript 4 is not a plain digit), mark and symbol
     is left out: CO₂ and NH₄⁺ are English labels. */
  const s = labels.join(' ').replace(/[\s\p{N}\p{P}\p{S}\p{M}]/gu, '');
  if (!s.length) return 0;
  const latin = (s.match(/[A-Za-z\u00C0-\u024F]/g) || []).length;
  return 1 - latin / s.length;
}

/* Counted per LABEL, not per letter: "Biochemical nitrogen cycle" is
   labelled in Cyrillic, and its NO₃ and NH₄ formulas diluted a per-letter
   share below any sensible line. Two labels in another script, or a fifth
   of them, and the file is not English. */
function foreignScript(labels) {
  const n = labels.filter(l => (String(l).match(/[^\u0000-\u024F\s\p{N}\p{P}\p{S}\p{M}]/gu) || []).length >= 2).length;
  return n >= 2 || (labels.length > 0 && n / labels.length >= 0.2);
}

/* A Latin-alphabet language that is not English: "Vrstvy atmosféry" was the
   pick for the layers of the atmosphere, labelled EXOSFÉRA, TERMOSFÉRA,
   výška, teplota - the script check cannot see it. Accented letters on 30%
   of the word labels, and not two English small words among them. A map of
   place names (Zürich, São Paulo) can trip it; losing one is cheaper than a
   chart the learner cannot read. */
const EN_SMALL = /\b(the|of|and|to|in|into|from|by|with|for|on|is|are|at|out)\b/gi;
function foreignLatin(labels) {
  const words = labels.filter(l => /\p{L}{3,}/u.test(l));
  if (words.length < 3) return false;
  const marked = words.filter(l => /[\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F]/.test(l)).length;
  const english = (words.join(' ').match(EN_SMALL) || []).length;
  return marked >= 2 && marked / words.length >= 0.3 && english < 2;
}

/* A picture needs words to teach from, and the labelling card needs them to
   pin. The Atom TEXT EDITOR's logo was the pick for "Parts of an atom", and
   an unlabelled pink brain for "The brain". */
function fewWords(labels) {
  return labels.filter(l => /\p{L}{3,}/u.test(l)).length < 3;
}

async function getText(url, max) {
  const r = await fetchT(url, { headers: { 'User-Agent': UA } }, COMMONS_TIMEOUT_MS);
  if (!r.ok) throw new Error('fetch ' + r.status);
  const t = await r.text();
  if (t.length > max) throw new Error('too big');
  return t;
}

async function getBase64(url) {
  const r = await fetchT(url, { headers: { 'User-Agent': UA } }, COMMONS_TIMEOUT_MS);
  if (!r.ok) throw new Error('thumb ' + r.status);
  const type = (r.headers.get('content-type') || '').split(';')[0];
  if (!/^image\/(png|jpeg|gif|webp)$/.test(type)) throw new Error('thumb type ' + type);
  const buf = await r.arrayBuffer();
  if (buf.byteLength > 1500 * 1024) throw new Error('thumb too big');
  return { type: type, data: Buffer.from(buf).toString('base64') };
}

async function inParallel(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (e) { out[k] = null; } } }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

/* ── the judge ──────────────────────────────────────────────────────────── */

function judgePrompt(topic, subject, cands) {
  const content = [{ type: 'text', text:
    'You choose ONE illustration for a lesson in a study app for students aged 12-15.\n' +
    'Lesson topic: "' + topic + '"' + (subject ? ' (subject: ' + subject + ')' : '') + '.\n' +
    'Below are ' + cands.length + ' candidate drawings from Wikimedia Commons, each with its title, description and the text labels inside the file.' }];
  cands.forEach((c, i) => {
    content.push({ type: 'text', text: '\nCandidate ' + (i + 1) + ': ' + c.title.replace(/^File:/, '') +
      '\nDescription: ' + (c.desc || '(none)') +
      '\nText in the file: ' + (c.labels.length ? c.labels.slice(0, 30).join(' | ') : '(no text, or text drawn as shapes)') });
    content.push({ type: 'image', source: { type: 'base64', media_type: c.img.type, data: c.img.data } });
  });
  content.push({ type: 'text', text:
    '\nInclude a candidate ONLY if ALL of these are true:\n' +
    '1. It shows "' + topic + '" itself - the thing this lesson teaches - not a related or neighbouring topic ' +
    '(the layers of the atmosphere are not the layers of the Earth; a plant cell is not an animal cell). ' +
    'One part of it, one event in it or one document from it is a neighbouring topic too, unless the lesson is about that part ' +
    '(one nephron is not "the kidney"; the constitution of 1793 is not "the French Revolution").\n' +
    '2. Nothing in it looks scientifically, historically or factually wrong.\n' +
    '3. A 12-15 year old could learn from it, and its words would still be readable shrunk to 340 pixels wide. Reject dense research figures, pages of tiny print, and anything made for university or medical students (drug names, receptor and enzyme detail).\n' +
    '4. Every word in it is English (numbers, units, symbols and chemical formulas are fine). Reject any with labels in another language, including Latin and spellings like "Citrat" or "atmosféra".\n' +
    '5. It is a diagram, cross-section, map or illustration that teaches - not a logo, flag, icon, photo collage or decoration, and not numbers-only labels with no key.\n' +
    'Judge EVERY candidate against each rule, true or false, then rank the ones that pass all five, best first (rank 1 = best; 0 for a candidate that fails any). ' +
    'A wrong picture is worse than none, so answer false whenever a rule is in doubt.\n' +
    'Output ONLY JSON: {"verdicts":[{"n":<candidate number>,"topic":<rule 1>,"accurate":<rule 2>,"readable":<rule 3>,"english":<rule 4>,"teaches":<rule 5>,"rank":<number>,"why":"<under 100 characters>"}]}' });
  return content;
}

const JUDGE_RULES = ['topic', 'accurate', 'readable', 'english', 'teaches'];

function parseJudge(text, n) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  let d;
  try { d = JSON.parse(m[0]); } catch (e) { return null; }
  if (!d) return null;
  /* Verdicts, one per candidate and rule: the CODE keeps only a picture that
     passes all five. Asked for a list of picks, Haiku read the rules and
     still picked a brainstem labelled in Latin for "The brain". A plain
     picks list is still read, for an answer in the older shape. */
  if (Array.isArray(d.verdicts)) {
    d.picks = d.verdicts.filter(v => v && JUDGE_RULES.every(k => v[k] === true) && Number(v.rank) >= 1)
      .sort((a, b) => Number(a.rank) - Number(b.rank));
  }
  if (!Array.isArray(d.picks)) return null;
  const seen = {}, out = [];
  d.picks.forEach(p => {
    const k = p && Number(p.n);
    if (!Number.isInteger(k) || k < 1 || k > n || seen[k] || out.length >= MAX_PICKS) return;
    seen[k] = 1;
    out.push({ n: k, why: clip(p.why, 140) });
  });
  return out;
}

async function judge(topic, subject, cands, apiKey) {
  const r = await fetchT('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 900,
      system: 'You select accurate, readable teaching illustrations. Output only the JSON asked for.',
      messages: [{ role: 'user', content: judgePrompt(topic, subject, cands) }] })
  }, JUDGE_TIMEOUT_MS);
  if (!r.ok) throw new Error('judge ' + r.status);
  const data = await r.json();
  const text = data && data.content && data.content[0] && data.content[0].text;
  const picks = parseJudge(text, cands.length);
  if (!picks) throw new Error('judge said nothing usable');
  return picks;
}

/* ── cleaning a file for the browser ────────────────────────────────────── */

/* The same cleaning prep_illustration.py does, minus the parts that need a
   layout (those happen in the browser). <style> stays - classes colour most
   files - but nothing in it may reach outside the file. */
function cleanSvg(s) {
  s = String(s);
  const ents = {};
  s.replace(/<!ENTITY\s+(\w+)\s+"([^"]*)"\s*>/g, (m, k, v) => { ents[k] = v; return m; });
  Object.keys(ents).forEach(k => { s = s.split('&' + k + ';').join(ents[k]); });
  s = s.replace(/<\?xml[^>]*\?>|<!DOCTYPE[\s\S]*?\]>\s*|<!DOCTYPE[^>]*>|<!--[\s\S]*?-->/g, '');
  ['metadata', 'script', 'foreignObject', 'title', 'desc', 'sodipodi:namedview', 'iframe', 'audio', 'video', 'animate', 'set'].forEach(tag => {
    s = s.replace(new RegExp('<' + tag + '\\b[\\s\\S]*?</' + tag + '>', 'gi'), '');
    s = s.replace(new RegExp('<' + tag + '\\b[^>]*/>', 'gi'), '');
  });
  s = s.replace(/<image\b[\s\S]*?(\/>|<\/image>)/gi, '');
  s = s.replace(/<((?!svg:|xlink:)[a-z]+:[\w-]+)\b[^>]*\/>/gi, '');
  s = s.replace(/<((?!svg:|xlink:)[a-z]+:[\w-]+)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/\s(?:inkscape|sodipodi|i|x|graph|a|dc|cc|rdf):[\w-]+="[^"]*"/gi, '');
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/((?:xlink:)?href)\s*=\s*("|')(?!#)[^"']*\2/gi, '');
  s = s.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (m, a, css) =>
    '<style' + a + '>' + css.replace(/@import[^;]*;?/gi, '').replace(/url\(\s*(?!['"]?\s*#)[^)]*\)/gi, 'none')
      .replace(/expression\s*\(|javascript:|behavior\s*:|-moz-binding/gi, '') + '</style>');
  s = s.replace(/url\(\s*(?!['"]?\s*#)[^)]*\)/gi, 'none');
  s = s.replace(/javascript:|data:text\/html/gi, '');
  const start = s.search(/<svg\b/i);
  return start >= 0 ? s.slice(start).trim() : '';
}

/* ── handlers ───────────────────────────────────────────────────────────── */

const CACHE_OK = 'public, max-age=3600, s-maxage=2592000, stale-while-revalidate=86400';

async function pick(req, res) {
  const q = req.query || {};
  const topic = clip(q.topic, 120), broad = clip(q.broad, 120);
  const subject = SUBJECTS[clip(q.subject, 20).toLowerCase()] ? clip(q.subject, 20).toLowerCase() : '';
  if (!topic) return res.status(400).json({ error: 'topic is required' });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server misconfiguration' });

  /* Strict matches for the lesson's own topic; failing that, for the broader
     one; only then topped up from whichever search was used. */
  let list = await shortlist(topic);
  let used = topic;
  if (!list.length && broad && broad.toLowerCase() !== topic.toLowerCase()) {
    const wide = await shortlist(broad);
    if (wide.length) { list = wide; used = broad; }
  }
  list = list.topUp ? list.topUp() : list;

  /* Read each file's words and fetch Commons' own PNG render of it, which is
     what the judge looks at. A file whose words are in another script is out
     before it costs an image slot. */
  const files = await inParallel(list, 4, async c => {
    const svg = await getText(c.url, MAX_BYTES);
    const labels = labelsOf(svg);
    if (foreignScript(labels) || foreignLatin(labels) || fewWords(labels)) return null;
    if (labels.length >= 3 && labels.every(l => /^[\d\s.,()-]+$/.test(l))) return null;  // numbers with no key
    return Object.assign(c, { labels: labels });
  });
  const ready = (await inParallel(files.filter(Boolean).slice(0, MAX_CANDIDATES), 4, async c =>
    Object.assign(c, { img: await getBase64(c.thumb) }))).filter(Boolean);

  let picks = [];
  if (ready.length) {
    const chosen = await judge(used, subject, ready, apiKey);
    picks = chosen.map(p => {
      const c = ready[p.n - 1];
      return { file: c.title, credit: creditFor(c), author: c.author, license: c.license, licenseUrl: c.licenseUrl,
               source: 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(c.title.replace(/ /g, '_')).replace(/%3A/g, ':'),
               w: c.w, h: c.h, why: p.why };
    });
  }
  res.setHeader('Cache-Control', CACHE_OK);
  return res.status(200).json({ topic: used, picks: picks });
}

const FILE_RE = /^File:[^|#<>[\]{}\n\r\t\\]{1,200}\.svg$/i;

async function file(req, res) {
  const title = clip((req.query || {}).file, 240);
  if (!FILE_RE.test(title) || /\.\.|\/\//.test(title)) return res.status(400).json({ error: 'not a Commons SVG file' });
  const d = await commons(Object.assign({ action: 'query', titles: title }, II_PROPS));
  const p = ((d.query && d.query.pages) || [])[0];
  if (!p || p.missing || !p.imageinfo) return res.status(404).json({ error: 'no such file' });
  const c = toCandidate(p, 1);
  if (!c || c.mime !== 'image/svg+xml' || c.size > MAX_BYTES || !licenceOk(c.license)) {
    return res.status(422).json({ error: 'file not usable' });
  }
  const svg = cleanSvg(await getText(c.url, MAX_BYTES));
  if (!/^<svg\b/i.test(svg)) return res.status(422).json({ error: 'not an SVG' });
  res.setHeader('Cache-Control', CACHE_OK);
  return res.status(200).json({ svg: svg, file: c.title, credit: creditFor(c), author: c.author, license: c.license,
    licenseUrl: c.licenseUrl, source: 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(c.title.replace(/ /g, '_')).replace(/%3A/g, ':') });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  try {
    if ((req.query || {}).file) return await file(req, res);
    return await pick(req, res);
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    if (e && e.name === 'AbortError') return res.status(504).json({ error: 'timeout' });
    console.error('[illustration.js]', e && e.message);
    return res.status(503).json({ error: 'illustration search failed' });
  }
};

module.exports._internal = { licenceOk, shortAuthor, creditFor, langOf, stems, score, usable, collapseLanguages,
  shortlist, labelsOf, nonLatinShare, foreignScript, foreignLatin, fewWords, judgePrompt, parseJudge, cleanSvg, toCandidate };
