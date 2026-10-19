// Real illustrations (sf-library.js): a lesson whose TITLE names a leaf, a heart, a plant cell, a
// volcano or the water cycle shows a person's drawing with its credit, instead of anything the
// model draws. Checks: the matcher is truth-first; the sanitiser strips hostile SVG; the picture
// lands on the lesson card with its credit; no model drawing is asked for, with or without a match;
// a failed file leaves the kit's diagram; the labelling card turns the bold labels into pins; the
// draw-on animation leaves it alone; dark mode keeps paper under it; the files are within budget.
const h = require('./harness');
const fs = require('fs');
const zlib = (() => { try { return require('zlib'); } catch (e) { return null; } })();
const ROOT = __dirname + '/../../../../';
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const none = async () => ({ json: { result: '{"type":"none"}' } });

const lessonDay = (title, subject, extra) => Object.assign({
  day: 2, title, content: 'Notes about ' + title + '.', microTopic: '',
  steps: [{ action: 'One thing happens' }, { action: 'Then another' }, { action: 'Then a third' }],
  keyTerms: [{ term: 'Chlorophyll', definition: 'x' }, { term: 'Glucose', definition: 'y' }],
  questions: [{ type: 'mcq', question: 'Which is right?', options: ['a', 'b', 'c', 'd'], correctIndex: 0, explanation: 'x' }]
}, extra || {});
const planFor = (day, subjectType) => ({ id: 'lib', subject: day.title, subjectType, days: [{ day: 1, title: 'Before', content: 'x', questions: [], completed: true }, day] });

async function toLessonCard(page) {
  for (let i = 0; i < 12; i++) {
    const t = await page.evaluate(() => window.currentCard && window.currentCard.type);
    if (t === 'lesson') break;
    await page.evaluate(() => showNextCard());
    await page.waitForTimeout(80);
  }
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => window.lessonArt && lessonArt.state === 'done')) break;
    await page.waitForTimeout(100);
  }
}

(async () => {
  // 1. The matcher, and the sanitiser, on any page that loads the file.
  let env = await h.open({ mock: none, settle: 900, modelArt: false });
  let r = await env.page.evaluate(() => {
    const L = window.SFLibrary; if (!L) return { loaded: false };
    const m = (title, subject, micro) => { const e = L.match({ title, microTopic: micro || '' }, subject); return e ? e.id : ''; };
    const evil = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10" onload="alert(1)">' +
      '<script>alert(1)</script><foreignObject><div>x</div></foreignObject><image href="http://evil/x.png"/>' +
      '<a href="javascript:alert(1)"><rect width="5" height="5"/></a><use xlink:href="http://evil/#a"/>' +
      '<rect width="4" height="4" fill="url(http://evil/#g)" onclick="alert(1)" style="fill:url(javascript:alert(1))"/>' +
      '<path d="M0 0 L5 5" fill="url(#ok)"/><text x="1" y="5">fine</text></svg>';
    const clean = L.sanitize(evil) || '';
    return {
      loaded: true, n: L.all.length,
      leaf: m('Photosynthesis: inside a leaf', 'science'), heart: m('The heart and blood vessels', 'science'),
      cell: m('Parts of a plant cell', 'science'), volcano: m('How volcanoes erupt', 'geography'),
      water: m('The water cycle', 'science'), viaMicro: m('Biology week 3', 'science', 'Plants › Leaf structure'),
      prose: L.match({ title: 'Cell division', microTopic: '', content: 'A leaf and a heart and a volcano' }, 'science'),
      heartHistory: m('The heart of the Industrial Revolution', 'history'), heartOf: m('The heart of the matter: cells', 'science'),
      evap: m('Evaporation and condensation', 'science'), market: m('The Market Revolution', 'history'),
      clean, bad: /<script|onload|onclick|foreignObject|<image|javascript:|evil/i.test(clean), keeps: /url\(#ok\)/.test(clean) && /fine/.test(clean),
      notSvg: L.sanitize('<html><body>x</body></html>'), broken: L.sanitize('<svg><path></svg')
    };
  });
  assert(r.loaded && r.n === 5, 'sf-library.js is on the lesson page with ' + r.n + ' illustrations');
  assert(r.leaf === 'leaf-cross-section' && r.heart === 'heart' && r.cell === 'plant-cell' && r.volcano === 'volcano' && r.water === 'water-cycle',
    'a title that names it gets it (' + [r.leaf, r.heart, r.cell, r.volcano, r.water].join(', ') + ')');
  assert(r.viaMicro === 'leaf-cross-section', 'the micro-topic counts as a title');
  assert(r.prose === null && r.heartHistory === '' && r.heartOf === '' && r.evap === '' && r.market === '',
    'prose words, other subjects, "the heart of", and near-misses get nothing');
  assert(!r.bad && r.keeps, 'the sanitiser drops script, handlers, foreignObject, images, javascript: and outside URLs, and keeps local ones');
  assert(r.notSvg === null && r.broken === null, 'a non-SVG or broken file is refused');
  r = await env.page.evaluate(() => {
    plan.subjectType = 'science';
    const html = String(renderFill({ type: 'fill', question: 'The ___ controls the cell and holds its DNA.', answer: 'nucleus', explanation: 'x' }) || '');
    return { clip: /simplified|Mito\./.test(html), leak: /<svg[\s\S]*Nucleus[\s\S]*<\/svg>/i.test(html), svgs: (html.match(/<svg/g) || []).length };
  });
  assert(!r.clip && !r.leak && r.svgs === 0, 'a science fill-in about the cell carries no clip-art picture, so no answer printed above the blank (' + JSON.stringify(r) + ')');
  await env.browser.close();

  // 2. A lesson that names one: the picture, its credit, no model call, the labelling card.
  const leafDay = lessonDay('Photosynthesis: inside a leaf', 'science');
  env = await h.open({ plan: planFor(leafDay, 'science'), day: 1, mock: none, settle: 900, modelArt: false });
  await toLessonCard(env.page);
  r = await env.page.evaluate(() => {
    const host = document.querySelector('#lesson-art'), svg = host && host.querySelector('svg');
    const bg = host ? getComputedStyle(host).backgroundColor : '';
    return { lib: window.lessonArt.lib && lessonArt.lib.id, isLib: !!(svg && svg.hasAttribute('data-sf-lib')),
             credit: svg ? (svg.querySelector('.sf-credit') || {}).textContent || '' : '', bg,
             animating: svg ? document.getAnimations().filter(a => a.effect && a.effect.target && svg.contains(a.effect.target)).length : -1,
             bytes: svg ? svg.outerHTML.length : 0 };
  });
  assert(r.lib === 'leaf-cross-section' && r.isLib, 'the leaf lesson card shows the real leaf (' + r.lib + ')');
  assert(/H McKenna/.test(r.credit) && /Wikimedia Commons/.test(r.credit) && /CC BY-SA/.test(r.credit), 'its credit is in the picture: "' + r.credit + '"');
  assert(r.animating === 0, 'the draw-on animation leaves a person\'s drawing alone (' + r.animating + ' animations)');
  assert(env.calls.length === 0, 'and the model was asked for no drawing (' + env.calls.length + ' calls)');
  r = await env.page.evaluate(() => {
    const q = lessonLabelQuestion();
    return q ? { n: q.pins.length, answers: q.pins.map(p => p.answer), hasSvg: /data-sf-lib/.test(q.svg), labelsLeft: q.pins.every(p => q.svg.indexOf(p.orig) < 0) } : null;
  });
  assert(r && r.n >= 3 && r.n <= 5 && r.hasSvg && r.labelsLeft, 'the labelling card pins the leaf\'s own key labels: ' + (r ? r.answers.join(', ') : 'none'));
  assert(r && r.answers.indexOf('Palisade mesophyll') === 0, 'in the order the catalogue chose, key part first');
  await env.browser.close();

  // 3. Dark mode: the picture keeps a paper ground.
  env = await h.open({ plan: planFor(lessonDay('The heart and blood vessels', 'science'), 'science'), day: 1, dark: true, mock: none, settle: 900, modelArt: false });
  await toLessonCard(env.page);
  r = await env.page.evaluate(() => {
    const host = document.querySelector('#lesson-art');
    const m = host && /(\d+), (\d+), (\d+)/.exec(getComputedStyle(host).backgroundColor);
    const lum = m ? (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 : 0;
    return { lib: window.lessonArt.lib && lessonArt.lib.id, dark: document.body.classList.contains('dark'), lum };
  });
  assert(r.lib === 'heart' && r.dark && r.lum > 0.85, 'in dark mode the heart sits on paper (luminance ' + r.lum.toFixed(2) + ')');
  await env.browser.close();

  // 4. No match: the kit's diagram, still no model call. A missing file: the kit's diagram stays.
  env = await h.open({ plan: planFor(lessonDay('Supply chains in Asia', 'economics'), 'economics'), day: 1, mock: none, settle: 900, modelArt: false });
  await toLessonCard(env.page);
  r = await env.page.evaluate(() => { const s = document.querySelector('#lesson-art svg'); return { lib: !!(window.lessonArt.lib), svg: !!s, isLib: !!(s && s.hasAttribute('data-sf-lib')) }; });
  assert(!r.lib && r.svg && !r.isLib, 'a lesson nothing names keeps the diagram built from its own steps');
  assert(env.calls.length === 0, 'and still asks the model for no drawing (' + env.calls.length + ' calls)');
  await env.browser.close();

  env = await h.open({ plan: planFor(lessonDay('How volcanoes erupt', 'geography'), 'geography'), day: 1, mock: none, settle: 300, modelArt: false });
  await env.page.evaluate(() => { window.SFLibrary.load = () => Promise.reject(new Error('offline')); });
  await env.page.evaluate(() => { lessonArt.state = 'idle'; lessonArt.svg = null; lessonArt.lib = null; requestLessonArt(day); });
  await toLessonCard(env.page);
  r = await env.page.evaluate(() => { const s = document.querySelector('#lesson-art svg'); return { lib: !!lessonArt.lib, svg: !!s, state: lessonArt.state }; });
  assert(!r.lib && r.svg && r.state === 'done', 'a file that fails to load leaves the kit\'s diagram, and the card is whole');
  assert(env.errors.length === 0, 'no page errors (' + env.errors.slice(0, 3).join(' | ') + ')');
  await env.browser.close();

  // 5. The files: every catalogue entry has one, credited, sanitised, and small on the wire.
  const lib = fs.readFileSync(ROOT + 'sf-library.js', 'utf8');
  const ids = (lib.match(/\{ id: '([a-z-]+)'/g) || []).map(s => s.replace(/.*'([a-z-]+)'/, '$1'));
  const sizes = [], problems = [];
  ids.forEach(id => {
    let s = '';
    try { s = fs.readFileSync(ROOT + 'illustrations/' + id + '.svg', 'utf8'); } catch (e) { problems.push(id + ': missing'); return; }
    if (!/class="sf-credit"/.test(s)) problems.push(id + ': no credit');
    if (/<script|\son\w+=|javascript:|<image|foreignObject/i.test(s)) problems.push(id + ': unsafe');
    if (!new RegExp('"' + id + '"').test(lib.split('END CREDITS')[0])) problems.push(id + ': not in CREDITS');
    const gz = zlib ? zlib.gzipSync(s).length : s.length / 4;
    sizes.push(id + ' ' + Math.round(gz / 1024) + 'KB');
    if (gz > 80 * 1024) problems.push(id + ': ' + Math.round(gz / 1024) + 'KB gzipped');
  });
  assert(ids.length === 5 && problems.length === 0, 'every illustration is present, credited, safe and under 80KB gzipped (' + (problems.join('; ') || sizes.join(', ')) + ')');

  console.log(fails ? fails + ' FAILED' : 'LIBRARY OK');
})().catch(e => { console.log('FAIL threw ' + (e && e.stack || e)); process.exitCode = 1; });
