// api/illustration.js - the server half of "a real illustration for any lesson". The real file,
// with Wikimedia Commons and the judge answered from fixtures shaped like the responses the
// Oct 2026 survey of twelve real topics recorded. Runs under Node 18+ or the browser shim.
// Checks: language copies collapse to one and a missing English copy is looked up by name; noise,
// licence, size, shape, script and numbers-only filters; the judge sees at most 5 pictures, each
// named, and its bad answers are ignored; picks come back credited and cached; failures are never
// cached; the file endpoint re-checks what it is given and strips anything unsafe.
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '../../../../api/illustration.js'), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; if (typeof process !== 'undefined') process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };

const B64 = { from: buf => ({ toString: () => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); } }) };
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]).buffer;

function reply(status, body, type) {
  return { ok: status >= 200 && status < 300, status, headers: { get: k => (/content-type/i.test(k) ? (type || 'application/json') : null) },
           json: async () => (typeof body === 'string' ? JSON.parse(body) : body), text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
           arrayBuffer: async () => body };
}
function page(title, o) {
  o = o || {};
  return { title, index: o.rank || 1, missing: o.missing, imageinfo: o.missing ? undefined : [{
    url: 'https://upload.wikimedia.org/x/' + encodeURIComponent(title.slice(5)), thumburl: o.thumb === false ? undefined : 'https://upload.wikimedia.org/thumb/' + encodeURIComponent(title.slice(5)) + '.png',
    mime: o.mime || 'image/svg+xml', size: o.size || 60000, width: o.w || 800, height: o.h || 600,
    extmetadata: { LicenseShortName: { value: o.license || 'CC BY-SA 3.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/3.0' },
                   Artist: { value: o.artist || '<a href="//commons.wikimedia.org/wiki/User:Someone">Someone</a>' },
                   ImageDescription: { value: o.desc || '' } } }] };
}
const LABELLED = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="1" y="9">Nitrogen fixation</text><text x="1" y="19">Ammonium</text><text x="1" y="29">Nitrates</text><text x="1" y="39">Denitrifying bacteria</text></svg>';

/* A Commons + judge stand-in. `script` sets what each call answers. */
function world(script) {
  const calls = { api: [], files: [], thumbs: [], judge: [] };
  async function fetchMock(url, opts) {
    url = String(url);
    if (/api\.anthropic\.com/.test(url)) { const body = JSON.parse(opts.body); calls.judge.push(body); return script.judge ? script.judge(body, calls) : reply(200, { content: [{ text: '{"picks":[]}' }] }); }
    if (/commons\.wikimedia\.org\/w\/api\.php/.test(url)) {
      const q = Object.fromEntries(new URL(url).searchParams); calls.api.push(q);
      return script.api(q, calls);
    }
    if (/upload\.wikimedia\.org\/thumb\//.test(url)) { calls.thumbs.push(url); return script.thumb ? script.thumb(url) : reply(200, PNG, 'image/png'); }
    if (/upload\.wikimedia\.org\//.test(url)) { calls.files.push(url); return script.file ? script.file(url) : reply(200, LABELLED, 'image/svg+xml'); }
    throw new Error('unexpected fetch ' + url);
  }
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'fetch', 'Buffer', 'process', 'console', SRC)(
    () => ({}), module, module.exports, fetchMock, B64, { env: script.env || { ANTHROPIC_API_KEY: 'k' } },
    { log() {}, warn() {}, error() {} });
  async function call(query, method) {
    const res = { code: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
                  status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
    await module.exports({ method: method || 'GET', query }, res);
    return res;
  }
  return { call, calls, I: module.exports._internal };
}

(async () => {
  // 1. The pieces, on the shapes the survey met.
  const I = world({ api: async () => reply(200, {}) }).I;
  const L = t => I.langOf(t).lang;
  ok(L('File:Nitrogen Cycle-eu.svg') === 'eu' && L('File:Nitrogen Cycle hu.svg') === 'hu' && L('File:Acoustic guitar (mul).svg') === 'mul' &&
     L('File:Electric guitar parts alt uz cyrl.svg') === 'uz' && L('File:Map Europe alliances 1914-no.svg') === 'no' &&
     L('File:Classical guitar parts colored rus.svg') === 'rus' && L('File:Human skeleton front en.svg') === 'en',
     'language copies are recognised by their endings (-eu, " hu", (mul), "uz cyrl", -no, rus, en)');
  ok(L('File:Solar-System-White-Sun.svg') === '' && L('File:Roman Empire 125 political map.svg') === '' && L('File:Atmosphere layers edu.svg') === '' &&
     L('File:Citric acid cycle with aconitate 2.svg') === '' && L('File:Layers of the atmosphere.svg') === '',
     'English endings that only look like codes are not languages (Sun, map, edu, a number)');
  ok(L('File:Nitrogen Cycle no.svg') === 'no' && L('File:Human skeleton front it.svg') === 'it' && L('File:Human skeleton back as.svg') === 'as',
     'codes that are also English words still count (the survey met " no", " it", " as")');
  ok(L('File:Citric Acid Cycle (Hrvatski).svg') === 'hrvatski' && L('File:Carbon cycle-cute diagram-espanol.svg') === 'espanol' &&
     L('File:French constitution of 1793 german.svg') === 'german' && L('File:Water cycle (English).svg') === 'en',
     'language NAMES count too, English as English');
  ok(L('File:Ciclo de Krebs.svg') === 'xx' && L('File:Alavanca de terceira clase.svg') === 'xx' && L('File:Parts of the flower de.svg') === 'de' &&
     L('File:Causes of the French Revolution Text.svg') === '', 'a title written in another language is caught by its small words, an English one is not');
  const st = I.stems('parts of the ear');
  ok(st.length === 1 && new RegExp(st[0]).test('the human ear diagram') && !new RegExp(st[0]).test('early earth'), 'a short topic word matches whole: "ear" is not "early" or "earth"');
  ok(I.score({ title: 'File:Vietnam War Yin-Yang Symbol.svg', desc: '', rank: 1 }, I.stems('causes of world war i'), 'causes of world war i') < 0 &&
     I.score({ title: 'File:Map Europe alliances 1914.svg', desc: 'Europe before World War I, alliances', rank: 3 }, I.stems('causes of world war i'), 'causes of world war i') > 0,
     'a topic with three words needs two: one shared "war" is not enough');
  ok(I.score({ title: 'File:Structure of the Earth and lithosphere.svg', desc: 'Earth interior', rank: 2 }, I.stems('layers of the earth'), 'layers of the earth') > 0,
     'a two-word topic needs one, in the title: "Structure of the Earth" is a picture of the Earth\'s layers');
  ok(I.score({ title: 'File:Llama with numbers.svg', desc: 'a farm cycle', rank: 1 }, I.stems('the nitrogen cycle'), 'the nitrogen cycle') < 0,
     'one topic word in the description alone is not enough');
  ok(I.score({ title: 'File:World War I Totenkopf.svg', desc: '', rank: 1 }, I.stems('world war i'), 'world war i') < 0 &&
     I.score({ title: 'File:France-Navy-OF-D Sleeve (World War I).svg', desc: '', rank: 1 }, I.stems('world war i'), 'world war i') < 0,
     'insignia and uniform parts are noise, like flags');
  ok(L('File:Human skeleton back nan.svg') === 'nan', 'Min Nan and the other codes the survey met are languages');
  ok(I.langOf('File:Nitrogen Cycle-eu.svg').base === 'Nitrogen Cycle', 'and the family name is the title without the code');
  ok(I.licenceOk('CC BY-SA 3.0') && I.licenceOk('CC BY 4.0') && I.licenceOk('CC0') && I.licenceOk('Public domain') && I.licenceOk('CC BY-SA 3.0 nl'),
     'free licences pass, with a port suffix');
  ok(!I.licenceOk('CC BY-NC 4.0') && !I.licenceOk('CC BY-ND 3.0') && !I.licenceOk('GFDL') && !I.licenceOk('') && !I.licenceOk('All rights reserved'),
     'NC, ND, GFDL alone, none and all-rights-reserved fail');
  ok(I.shortAuthor('This SVG image was created by Medium69. Cette image...') === 'Medium69' && I.shortAuthor('<a href="x">LadyofHats</a> (Mariana Ruiz)') === 'LadyofHats' &&
     I.shortAuthor('Own work') === 'Unknown author', 'authors are shortened to a name, never "Own work"');
  ok(I.parseJudge('{"picks":[{"n":2,"why":"a"},{"n":2},{"n":9},{"n":"x"},{"n":1}]}', 3).map(p => p.n).join() === '2,1', 'the judge\'s repeats, out-of-range and non-numbers are ignored');
  const V = (n, o) => Object.assign({ n: n, topic: true, accurate: true, readable: true, english: true, teaches: true, rank: n, why: 'w' }, o || {});
  ok(I.parseJudge(JSON.stringify({ verdicts: [V(1, { english: false, rank: 1 }), V(2, { rank: 2 }), V(3, { rank: 1 }), V(4, { topic: 'true' }), V(5, { rank: 0 })] }), 5).map(p => p.n).join() === '3,2',
     'verdicts: only a picture passing all five rules is kept, by rank - one false, a "true" string or rank 0 is out');
  ok(I.parseJudge(JSON.stringify({ verdicts: [V(1, { caption: 'The ear, <b>cut</b> open from the side.' })] }), 1)[0].caption === 'The ear, bcut/b open from the side' &&
     I.parseJudge(JSON.stringify({ verdicts: [V(1)] }), 1)[0].caption === '', 'the judge\'s caption comes back as plain text with no markup, or empty');
  ok(I.shortCaption('Eukaryotic DNA replication showing both strands copying with primase, polymerases, and ligase at work') === 'Eukaryotic DNA replication showing both strands copying with primase' &&
     I.shortCaption('A forest food web showing how energy flows from plants through herbivores and omnivores to the top predators') === 'A forest food web showing how energy flows from plants through herbivores' &&
     I.shortCaption('A human skeleton from the front.') === 'A human skeleton from the front', 'a long caption is cut at a comma or a whole word, never mid-word');
  ok(I.parseJudge('{"verdicts":[]}', 3).length === 0, 'verdicts with nothing passing is an answer of none, not a failure');
  ok(I.parseJudge('no json here', 3) === null && I.parseJudge('{"nope":1}', 3) === null, 'an answer with no picks list is no answer');
  ok(I.nonLatinShare(['Атмосфера', 'Земля', 'вода']) > 0.9 && I.nonLatinShare(['Nitrogen', 'NH₄⁺', 'CO₂']) < 0.1, 'labels in another script are measured as such');
  ok(I.foreignScript(['Денітриф', 'Нітриф', 'NO₃⁻', 'NH₄⁺', 'NO₂⁻', 'N₂', 'NO', 'N₂O', 'NH₃', 'O₂']) &&
     !I.foreignScript(['Nitrogen fixation', 'NH₄⁺', 'NO₃⁻', 'Denitrifying bacteria', 'N₂']) && !I.foreignScript(['Café', 'Señor', 'Zürich']),
     'a file with Cyrillic labels among many formulas is caught; English with formulas, and Latin accents, are not');
  // Oct 20 2026, the first run with the real judge: a Czech chart, a logo and an unlabelled brain got through.
  ok(I.foreignLatin(['EXOSFÉRA', 'TERMOSFÉRA', 'MEZOSFÉRA', 'STRATOSFÉRA', 'TROPOSFÉRA', 'výška [km]', 'teplota [°C]', 'termopauza', 'mezopauza']) &&
     !I.foreignLatin(['Troposphere', 'Stratosphere', 'Ozone layer', 'Mesosphere', 'Thermosphere']) &&
     !I.foreignLatin(['Paris', 'Zürich', 'Berlin', 'Rome', 'Madrid', 'Vienna', 'London']) &&
     !I.foreignLatin(['Café de Flore', 'Movement of the crowd', 'Storming of the Bastille', 'Sans-culottes']),
     'labels in another Latin-alphabet language are caught; English, a map with one accented city, and English with a French name are not');
  ok(I.fewWords([]) && I.fewWords(['12', '40', 'NO₃']) && I.fewWords(['Atom', '1']) && !I.fewWords(['Malleus', 'Incus', 'Stapes']),
     'a file with fewer than three word labels is too few words to teach from');
  ok(I.shortAuthor('<ul><li><a href="x">Cicle_del_nitrogen_de.svg</a>: *<a href="y">Cicle_del_nitrogen_ca.svg</a>: Johann Dréo (<a href="z">User:Nojhan</a>), traduction de Joanjoc</li><li>derivative work: Burkhard (talk)</li></ul>') === 'Johann Dréo and others',
     'a chain of translations credits the person, never a file name: "' + I.shortAuthor('<a>Cicle_del_nitrogen_de.svg</a>: *<a>Cicle_del_nitrogen_ca.svg</a>: Johann Dréo (User:Nojhan)') + '"');
  ok(I.shortAuthor('<style>.mw-parser-output .messagebox{margin:4px 0;width:80%}</style><table><tr><td>This image has been created during "<a>DensityDesign Studio</a>" at Politecnico di Milano, in 2015. Credits goes to Roberta Rosina</td></tr></table>') === 'Roberta Rosina',
     'a notice box\'s style sheet never becomes the credit, and "Credits goes to" names the person');
  const jp = JSON.stringify(I.judgePrompt('The kidney', 'science', [{ title: 'File:A.svg', desc: '', labels: ['a'], img: { type: 'image/png', data: '' } }]));
  ok(/verdicts/.test(jp) && /one nephron is not/.test(jp) && /medical students/.test(jp) && /constitution of 1793/.test(jp), 'the judge is told a part is a neighbour, and to refuse medical-school detail');
  const dirty = '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY ns "x">]><!-- c --><svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">' +
    '<script>alert(1)</script><foreignObject><div>x</div></foreignObject><image href="http://evil/x.png"/><a href="javascript:alert(1)"><rect/></a>' +
    '<use xlink:href="http://evil/#a"/><style>@import url(http://evil/x.css); .a{fill:url(http://evil/#g)} .b{fill:url(#ok)} .c{fill:url("#ok2")}</style>' +
    '<rect style="fill:url(http://evil/#g)" onclick="alert(1)"/><path fill="url(#grad)"/><inkscape:path-effect id="e"/><metadata><rdf:RDF/></metadata></svg>';
  const clean = I.cleanSvg(dirty);
  ok(/^<svg\b/.test(clean) && !/<script|onload|onclick|foreignObject|<image|javascript:|evil|@import|<metadata|inkscape:/i.test(clean),
     'cleaning removes scripts, handlers, foreignObject, images, javascript:, outside URLs, @import, metadata, editor elements');
  ok(/url\(#ok\)/.test(clean) && /url\("#ok2"\)/.test(clean) && /url\(#grad\)/.test(clean) && /<style>/.test(clean), 'and keeps the file\'s own #references (quoted too) and its <style>');

  // 2. A full pick, on the survey's nitrogen-cycle shape.
  let w = world({
    api: async q => {
      if (q.generator === 'search') return reply(200, { query: { pages: [
        page('File:Nitrogen Cycle-eu.svg', { rank: 1, license: 'CC BY 3.0' }), page('File:Nitrogen Cycle hu.svg', { rank: 2, license: 'CC0' }),
        page('File:Nitrogen Cycle.svg', { rank: 8 }), page('File:Nitrogen Cycle 2.svg', { rank: 6 }),
        page('File:Llama with numbers.svg', { rank: 3 }), page('File:Nitrogen flag of somewhere.svg', { rank: 4 }),
        page('File:Nitrogen fixation NC.svg', { rank: 5, license: 'CC BY-NC 4.0' }), page('File:Nitrogen cycle huge.svg', { rank: 7, size: 3000000 }),
        page('File:Nitrogen cycle strip.svg', { rank: 9, w: 5000, h: 500 }), page('File:Nitrogen cycle photo.jpg', { rank: 10, mime: 'image/jpeg' }),
        page('File:Nitrogen cycle budget-de.svg', { rank: 11 }), page('File:Nitrogen cycle budget-fr.svg', { rank: 12 }),
        page('File:Nitrogen cycle cyrillic labels.svg', { rank: 13 }), page('File:Nitrogen cycle numbered.svg', { rank: 14 }),
        page('File:Nitrogen cycle infographic-1.svg', { rank: 15 }), page('File:Nitrogen cycle infographic-2.svg', { rank: 16 }), page('File:Nitrogen cycle infographic-3.svg', { rank: 17 })
      ] } });
      if (q.titles) return reply(200, { query: { pages: q.titles.split('|').map(t => t === 'File:Nitrogen cycle budget-en.svg' ? page(t, { rank: 11 }) : { title: t, missing: true }) } });
      return reply(400, {});
    },
    file: async url => /cyrillic/.test(url) ? reply(200, '<svg><text>Азот</text><text>Аммоний</text><text>Нитраты</text></svg>', 'image/svg+xml')
                    : /numbered/.test(url) ? reply(200, '<svg><text>1</text><text>2</text><text>3</text></svg>', 'image/svg+xml')
                    : reply(200, LABELLED, 'image/svg+xml'),
    judge: async body => {
      const n = body.messages[0].content.filter(c => c.type === 'image').length;
      return reply(200, { content: [{ text: '```json\n{"picks":[{"n":2,"why":"clear cycle"},{"n":1,"why":"also good"},{"n":' + (n + 3) + '}]}\n```' }] });
    }
  });
  let r = await w.call({ topic: 'the nitrogen cycle', subject: 'science' });
  const shown = w.calls.judge[0] ? w.calls.judge[0].messages[0].content : [];
  const shownTitles = shown.filter(c => c.type === 'text' && /^\nCandidate \d+:/.test(c.text)).map(c => c.text.split('\n')[1].replace(/^Candidate \d+: /, ''));
  ok(r.code === 200 && Array.isArray(r.body.picks), 'a pick answers 200 with a list (' + r.code + ')');
  ok(shownTitles.indexOf('Nitrogen Cycle.svg') >= 0 && !shownTitles.some(t => /-eu|hu\.svg/.test(t)),
     'the family\'s English copy is shown, not the Basque or Hungarian one (' + shownTitles.join(', ') + ')');
  ok(w.calls.api.some(q => q.titles && /File:Nitrogen cycle budget-en\.svg/.test(q.titles)) && shownTitles.indexOf('Nitrogen cycle budget-en.svg') >= 0,
     'a family that came back only in German and French is asked for its English copy by name, in one query');
  ok(!shownTitles.some(t => /Llama|flag|NC|huge|strip|photo/i.test(t)), 'noise, a flag, an NC licence, 3 MB, a 10:1 strip and a JPEG never reach the judge');
  // A thin strict list is topped up from Commons' own ranking - through every other filter.
  w = world({
    api: async q => q.generator ? reply(200, { query: { pages: [
      page('File:Map Europe alliances 1914-no.svg', { rank: 1 }), page('File:Map Europe alliances 1914-tr.svg', { rank: 2 }),
      page('File:White Aryan Fist.svg', { rank: 3 }), page('File:WWIchartX.svg', { rank: 4, desc: 'Causes of World War I chart' }),
      page('File:Some poster NC.svg', { rank: 5, license: 'CC BY-NC 4.0' }), page('File:Far down the list.svg', { rank: 30 })] } })
      : reply(200, { query: { pages: q.titles.split('|').map(t => t === 'File:Map Europe alliances 1914-en.svg' ? page(t, { rank: 1, desc: 'Map of military alliances of Europe in 1914' }) : { title: t, missing: true }) } }),
    judge: async () => reply(200, { content: [{ text: '{"picks":[]}' }] })
  });
  await w.call({ topic: 'causes of world war i' });
  const topped = (w.calls.judge[0] ? w.calls.judge[0].messages[0].content : []).filter(c => c.type === 'text' && /^\nCandidate/.test(c.text)).map(c => c.text.split('\n')[1]);
  ok(topped.some(t => /Map Europe alliances 1914-en/.test(t)) && topped.some(t => /WWIchartX/.test(t)),
     'a thin list is topped up with Commons\' best-ranked files: the English alliances map reaches the judge (' + topped.join(' | ') + ')');
  ok(!topped.some(t => /Fist|NC|Far down/.test(t)), 'but never noise, a non-free licence, or something far down the ranking');
  ok(!shownTitles.some(t => /cyrillic|numbered/.test(t)), 'nor a file labelled in Cyrillic, nor one labelled only with numbers');
  ok(shownTitles.filter(t => /infographic/.test(t)).length <= 1, 'one file per series reaches the judge (' + shownTitles.filter(t => /infographic/.test(t)).length + ' infographics)');
  ok(shown.filter(c => c.type === 'image').length <= 5 && shown.filter(c => c.type === 'image').length >= 2, 'the judge sees 2-5 pictures (' + shown.filter(c => c.type === 'image').length + ')');
  ok(shown.length > 2 && shown.every((c, i) => c.type !== 'image' || (shown[i - 1].type === 'text' && /Candidate \d+:/.test(shown[i - 1].text))),
     'every picture is named just before it');
  const allText = shown.filter(c => c.type === 'text').map(c => c.text).join(' ');
  ok(/"the nitrogen cycle"/.test(allText) && /12-15/.test(allText) && /English/.test(allText) && /340 pixels/.test(allText) && /worse than none/.test(allText),
     'its instructions carry the topic, the age, English only, phone width, and "none is better than wrong"');
  ok(r.body.picks.length === 2 && r.body.picks[0].file === 'File:' + shownTitles[1] && r.body.picks[1].file === 'File:' + shownTitles[0],
     'the picks come back in the judge\'s order, its out-of-range one dropped, despite a ``` fence');
  const p0 = r.body.picks[0] || {};
  ok(/^Illustration: Someone, Wikimedia Commons(, CC BY-SA 3\.0)?$/.test(p0.credit) && /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(p0.source) && p0.why === 'clear cycle',
     'each pick carries its credit, its source page and the judge\'s reason (' + p0.credit + ')');
  ok(/s-maxage=\d{6,}/.test(r.headers['cache-control'] || ''), 'and the answer is cached at the CDN (' + r.headers['cache-control'] + ')');

  // 3. "Nothing fits" is an answer and is cached; failures are not.
  w = world({ api: async q => reply(200, { query: { pages: q.generator ? [page('File:Nitrogen Cycle.svg'), page('File:Nitrogen Cycle 2.svg')] : [] } }) });
  r = await w.call({ topic: 'the nitrogen cycle' });
  ok(r.code === 200 && r.body.picks.length === 0 && /s-maxage/.test(r.headers['cache-control']), '"none fits" is 200, empty, and cached');
  w = world({ api: async q => reply(200, { query: { pages: q.generator ? [page('File:Nitrogen Cycle.svg'), page('File:Nitrogen Cycle 2.svg')] : [] } }),
              judge: async () => reply(200, { content: [{ text: 'I think the second one is nice.' }] }) });
  r = await w.call({ topic: 'the nitrogen cycle' });
  ok(r.code === 503 && r.headers['cache-control'] === 'no-store', 'a judge answer with no JSON is a failure, never cached (' + r.code + ')');
  w = world({ api: async q => reply(200, { query: { pages: q.generator ? [page('File:Nitrogen Cycle.svg'), page('File:Nitrogen Cycle 2.svg')] : [] } }),
              judge: async () => reply(529, { error: 'overloaded' }) });
  r = await w.call({ topic: 'the nitrogen cycle' });
  ok(r.code === 503 && r.headers['cache-control'] === 'no-store', 'a judge error is a failure, never cached');
  w = world({ api: async () => reply(429, {}) });
  r = await w.call({ topic: 'the nitrogen cycle' });
  ok(r.code === 503 && r.headers['cache-control'] === 'no-store' && w.calls.api.length === 2, 'Commons answering 429 is retried once, then a 503 that is not cached (' + w.calls.api.length + ' tries)');
  w = world({ api: async () => reply(200, {}), env: {} });
  r = await w.call({ topic: 'the nitrogen cycle' });
  ok(r.code === 500 && w.calls.api.length === 0, 'with no API key nothing is searched');
  r = await w.call({});
  ok(r.code === 400, 'no topic is a 400');
  r = await w.call({ topic: 'x' }, 'POST');
  ok(r.code === 405, 'only GET is served');
  r = await w.call({}, 'OPTIONS');
  ok(r.code === 200, 'and the preflight answers');

  // 4. The broad topic, when the specific one finds nothing usable.
  w = world({ api: async q => reply(200, { query: { pages: /light reactions/.test(q.gsrsearch || '') ? [page('File:Llama.svg')] : [page('File:Photosynthesis diagram.svg'), page('File:Photosynthesis en.svg')] } }),
              judge: async () => reply(200, { content: [{ text: '{"picks":[{"n":1,"why":"x"}]}' }] }) });
  r = await w.call({ topic: 'the light reactions', broad: 'photosynthesis' });
  ok(r.code === 200 && r.body.topic === 'photosynthesis' && r.body.picks.length === 1, 'nothing usable for "the light reactions" falls back to "photosynthesis"');
  ok(/"photosynthesis"/.test(w.calls.judge[0].messages[0].content.map(c => c.text || '').join(' ')), 'and the judge is told the topic actually searched');

  // 5. The file endpoint.
  const fileWorld = (o) => world({
    api: async q => reply(200, { query: { pages: [o.missing ? { title: q.titles, missing: true } : page(q.titles, o)] } }),
    file: async () => reply(200, dirty, 'image/svg+xml')
  });
  w = fileWorld({});
  r = await w.call({ file: 'File:Nitrogen Cycle.svg' });
  ok(r.code === 200 && /^<svg\b/.test(r.body.svg) && !/<script|onload|javascript:|evil/i.test(r.body.svg) && /url\(#ok\)/.test(r.body.svg),
     'a file comes back cleaned, its own references intact');
  ok(/^Illustration: /.test(r.body.credit) && r.body.file === 'File:Nitrogen Cycle.svg' && /s-maxage/.test(r.headers['cache-control']), 'with its credit, and cached');
  r = await fileWorld({ license: 'CC BY-NC 4.0' }).call({ file: 'File:Nitrogen Cycle.svg' });
  ok(r.code === 422, 'a file whose licence is not free is refused, whatever the caller says (' + r.code + ')');
  r = await fileWorld({ size: 5000000 }).call({ file: 'File:Nitrogen Cycle.svg' });
  ok(r.code === 422, 'an oversized one too');
  r = await fileWorld({ mime: 'image/png' }).call({ file: 'File:Nitrogen Cycle.svg' });
  ok(r.code === 422, 'and one that is not an SVG');
  r = await fileWorld({ missing: true }).call({ file: 'File:Nitrogen Cycle.svg' });
  ok(r.code === 404, 'a file Commons does not have is a 404');
  w = fileWorld({});
  const bad = ['Nitrogen Cycle.svg', 'File:x.png', 'File:../../etc.svg', 'File:a|File:b.svg', 'File:<script>.svg', 'File:a#b.svg', 'File:' + 'x'.repeat(260) + '.svg'];
  const codes = []; for (const b of bad) codes.push((await w.call({ file: b })).code);
  ok(codes.every(c => c === 400) && w.calls.api.length === 0, 'a name that is not a plain Commons SVG title is refused before anything is fetched (' + codes.join(',') + ')');

  console.log(fails ? fails + ' FAILED' : 'WEBART API OK');
})().catch(e => { console.log('FAIL threw ' + (e && e.stack || e)); if (typeof process !== 'undefined') process.exitCode = 1; });
