// Pictures in the diagrams (sf-icons.js) and everything built on them: the matcher's truth rules,
// the model's icon shape behind SFSceneKit's guard, the redesigned kit layouts, which picture a
// lesson gets, the flowchart gate on model drawings, flashcard icons, and icons popping in.
const h = require('./harness');
const fs = require('fs');
const fx = require('./fixture');
const AUDIT = fs.readFileSync(__dirname + '/../../diagram/scripts/audit.js', 'utf8');
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const none = async () => ({ json: { result: '{"type":"none"}' } });

(async () => {
  const env = await h.open({ mock: none, settle: 1200 });
  const page = env.page;
  await page.addScriptTag({ content: AUDIT });

  // 1. The file: loaded on the page, every icon draws something.
  let r = await page.evaluate(() => {
    const I = window.SFIcons; if (!I) return { loaded: false };
    const host = document.createElement('div'); document.body.appendChild(host);
    const empty = [];
    I.names().forEach(n => {
      host.innerHTML = '<svg viewBox="0 0 64 64" width="64" height="64">' + I.markup(n, 32, 32, 40, '#1e40af', '#4a7cf6', 0.3) + '</svg>';
      const b = host.querySelector('svg g').getBBox(); if (!(b.width > 10 && b.height > 10)) empty.push(n);
    });
    host.remove();
    return { loaded: true, n: I.names().length, empty, bad: I.markup('nope', 1, 1, 10), ids: /\sid=/.test(I.markup('sun', 1, 1, 10)) };
  });
  assert(r.loaded && r.n >= 120, 'sf-icons.js is on the lesson page with ' + r.n + ' icons');
  assert(r.empty && r.empty.length === 0, 'every icon draws a real shape (empty: ' + (r.empty || []).join(',') + ')');
  assert(r.bad === '' && !r.ids, 'an unknown name draws nothing, and no icon carries an id');

  // 2. The matcher answers only when a word names the picture.
  r = await page.evaluate(() => {
    const I = SFIcons;
    return {
      water: I.pick(['Sun heats water and it evaporates', 'Water vapour cools and condenses into clouds', 'Water falls as rain, snow or hail', 'Water collects in oceans, lakes and groundwater']).join(','),
      memory: I.pick(['Information enters sensory memory', 'Attention moves it to short-term memory', 'Rehearsal moves it to long-term memory', 'Retrieval brings it back when needed']).join(','),
      nucleus: I.match('Nucleus'), french: I.match('French'), powers: I.match('Separation of powers'),
      csMemory: I.match('Memory', 'cs'), psyMemory: I.match('Memory', 'psychology'), condensation: I.match('condensation'),
      heart: I.depicts('Heart'), artery: I.depicts('Artery'), chloro: I.depicts('Chlorophyll'), volcanoes: I.depicts('Volcanoes')
    };
  });
  assert(r.water === 'sun,cloud,rain,waves', 'water cycle steps: ' + r.water);
  assert(r.memory === 'eye,hourglass,repeat,search', 'memory steps: ' + r.memory);
  assert(r.nucleus === '' && r.french === '' && r.powers !== 'lightning', 'no picture for an ambiguous word (nucleus "' + r.nucleus + '", French "' + r.french + '", powers "' + r.powers + '")');
  assert(r.csMemory === 'chip' && r.psyMemory === 'brain', 'memory is a chip in CS and a brain in psychology');
  assert(r.heart === 'heart' && r.volcanoes === 'volcano' && r.artery === '' && r.chloro === '', 'a single term gets a picture only of itself (Artery and Chlorophyll get none)');

  // 3. The model's icon shape, behind SFSceneKit's guard.
  r = await page.evaluate(() => {
    const base = [{ s: 'rect', x: 10, y: 40, w: 100, h: 60 }, { s: 'circle', x: 200, y: 100, r: 30 }, { s: 'text', x: 200, y: 200, t: 'Label' }];
    const good = SFSceneKit.fromSpec({ type: 'drawing', w: 400, h: 250, shapes: base.concat([{ s: 'icon', name: 'sun', x: 50, y: 50, size: 900, color: 'amber' }]) });
    const hostile = SFSceneKit.fromSpec({ type: 'drawing', w: 400, h: 250, shapes: base.concat([
      { s: 'icon', name: '<script>alert(1)</script>', x: 1, y: 1 }, { s: 'icon', name: 'sun" onload="alert(1)', x: 1, y: 1 },
      { s: 'icon', name: '__proto__', x: 1, y: 1 }, { s: 'icon', name: 'constructor', x: 1, y: 1 }, { s: 'icon', name: 'nope', x: 1, y: 1 },
      { s: 'icon', name: 'cloud', x: 1, y: 1, color: 'url(#evil)' }]) });
    const d = document.createElement('div'); d.innerHTML = hostile; document.body.appendChild(d);
    const bad = []; d.querySelectorAll('*').forEach(e => { if (/^(script|foreignobject|image|iframe)$/i.test(e.localName)) bad.push(e.localName); for (const a of e.attributes) { if (/^on/i.test(a.name)) bad.push(a.name); if (/url\(#evil/.test(a.value)) bad.push('url'); } });
    const icons = d.querySelectorAll('.sf-ico').length; d.remove();
    const m = /scale\(([\d.]+)\)/.exec(good || '');
    return { good: !!good && /sf-ico/.test(good), amber: /#92400e/.test(good || ''), scale: m ? +m[1] : 0, bad, icons };
  });
  assert(r.good && r.amber, 'a named icon draws, in its hue\'s ink');
  assert(r.scale > 0 && r.scale * 256 <= 250 * 0.6 + 0.5, 'its size is clamped to the canvas (' + Math.round(r.scale * 256) + ' units)');
  assert(r.bad.length === 0 && r.icons === 1, 'hostile icon names draw nothing - only the real "cloud" survives, colour coerced (' + r.icons + ' icons; ' + r.bad.join(',') + ')');

  // 4. The kit's layouts, on real lesson days.
  r = await page.evaluate(() => {
    const S = (a) => ({ action: a });
    const photo = { subject: 'science', title: 'Photosynthesis: the light reactions', content: 'Chlorophyll absorbs light. The energy splits water, and the Calvin cycle then uses ATP and NADPH to build glucose.',
      steps: [S('Chlorophyll in the thylakoid absorbs light'), S('Water is split, releasing oxygen'), S('ATP and NADPH are made'), S('The Calvin cycle fixes carbon dioxide into glucose')] };
    const water = { subject: 'science', title: 'How water moves', microTopic: 'Earth science › The water cycle', content: 'x',
      steps: [S('Sun heats water and it evaporates'), S('Water vapour condenses into clouds'), S('Water falls as rain'), S('Water collects in oceans')] };
    const hist = { subject: 'history', title: 'Causes of the American Revolution', content: 'x',
      steps: [S('1763: The French and Indian War ends with Britain in debt'), S('1765: The Stamp Act taxes printed paper'), S('1773: The Boston Tea Party protests the tea tax')] };
    const econ = { subject: 'economics', title: 'Supply and demand', content: 'x', concepts: [{ name: 'Demand', definition: 'x' }, { name: 'Supply', definition: 'y' }, { name: 'Equilibrium', definition: 'z' }] };
    const market = { subject: 'history', title: 'The Market Revolution', content: 'x', concepts: [{ name: 'Canals', definition: 'x' }, { name: 'Factories', definition: 'y' }, { name: 'Railroads', definition: 'z' }] };
    const out = {};
    out.photoLoop = /marker-end[^>]*\/>\s*$/.test('') ;
    const p = diagramForDay(photo); out.photoSvg = p && p.svg;
    out.photoIsLoop = !!(p && /<path d="M[\d.]+ [\d.]+ H[\d.]+ Q/.test(p.svg));
    const w = diagramForDay(water); out.waterIsLoop = !!(w && /<path d="M[\d.]+ [\d.]+ H[\d.]+ Q/.test(w.svg));
    const t = diagramForDay(hist); out.histText = !!(t && /French and Indian War/.test(t.svg) && /Stamp Act/.test(t.svg));
    const e = diagramForDay(econ); out.econGraph = !!(e && /Quantity/.test(e.svg));
    const mk = diagramForDay(market); out.marketNotSD = !!(mk && !/Quantity/.test(mk.svg));
    out.photoIcons = p ? (p.svg.match(/class="sf-ico"/g) || []).length : 0;
    return out;
  });
  assert(r.photoSvg && !r.photoIsLoop && r.photoIcons >= 3, 'the light reactions are a sequence, not a loop, with a picture on each step (' + r.photoIcons + ')');
  assert(r.waterIsLoop, 'a lesson the micro-topic calls a cycle is drawn as a loop');
  assert(r.histText, 'a dated step keeps its event: "1763: The French and Indian War ends..." is not cut to "1763"');
  assert(r.econGraph, '"Supply and demand" gets the hand-drawn graph, not a web of three words');
  assert(r.marketNotSD, '"The Market Revolution" (history) does not get the supply and demand graph');

  // 5. Every layout audits clean of failures; no hub label is struck by its own spoke.
  r = await page.evaluate(() => {
    const L = (layout, extra) => Object.assign({ type: 'custom', layout, title: 'T' }, extra);
    const specs = [
      L('flow', { items: ['Light absorbed', 'Water split', 'Glucose made'] }),
      L('flow', { items: ['Choose a clear position you can defend with evidence', 'Gather three pieces of evidence', 'Write a topic sentence', 'Answer the counterargument', 'Conclude'] }),
      L('cycle', { title: 'The water cycle', items: ['Evaporation', 'Condensation', 'Precipitation', 'Collection'] }),
      L('cycle', { items: ['Fixation', 'Nitrification', 'Denitrification'] }),
      L('cycle', { items: ['Blood returns to the right atrium', 'Right ventricle pumps it to the lungs', 'Oxygen-rich blood enters the left atrium', 'Left ventricle pumps it out'] }),
      L('concept', { title: '', center: 'Democracy', items: ['Voting', 'Rights', 'Courts', 'Press'] }),
      L('concept', { title: '', center: 'Climate change', items: ['Burning fuel', 'Deforestation', 'Rising seas', 'Heatwaves', 'Melting ice', 'Wildfires'] }),
      L('parts', { title: '', center: 'Flower', items: ['Petal', 'Stamen', 'Pistil', 'Sepal'] }),
      L('timeline', { items: ['1939: Germany invades Poland', '1941: Japan attacks Pearl Harbor', '1944: Allied troops land in Normandy', '1945: The war ends'] }),
      L('converge', { title: '', outcome: 'The Revolution', items: ['Debt from wars', 'Unfair taxes', 'Bread prices'] })];
    const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:0;top:0;width:343px'; document.body.appendChild(host);
    const fails = [], struck = [];
    specs.forEach((sp, k) => {
      host.innerHTML = generateDiagramSVG(sp) || '';
      const svg = host.querySelector('svg'); if (!svg) { fails.push(k + ':null'); return; }
      SFAudit(svg, {})[0].findings.filter(f => f.level === 'fail').forEach(f => fails.push(k + ':' + f.code));
      const texts = [...svg.querySelectorAll('text')].map(t => t.getBoundingClientRect());
      svg.querySelectorAll('line:not([marker-end])').forEach(l => {
        const a = l.getBoundingClientRect();
        texts.forEach(t => { if (a.width < 3 && a.left > t.left + 2 && a.left < t.right - 2 && a.top < t.bottom - 3 && a.bottom > t.top + 3) struck.push(k); });
      });
    });
    host.remove();
    return { fails, struck };
  });
  assert(r.fails.length === 0, 'ten layouts audit with no failures (' + r.fails.join(',') + ')');
  assert(r.struck.length === 0, 'no spoke runs through a label (' + r.struck.join(',') + ')');

  // 6. A model drawing that is a flowchart is not shown over the lesson's own diagram.
  r = await page.evaluate(() => {
    const boxes = { type: 'drawing', shapes: [{ s: 'rect' }, { s: 'rect' }, { s: 'rect' }, { s: 'line', arrow: true }, { s: 'text', t: 'Light' }] };
    const circles = { type: 'drawing', shapes: [{ s: 'circle' }, { s: 'circle' }, { s: 'circle' }, { s: 'text', t: 'PSII' }] };
    const leaf = JSON.parse(SFDraw.lessonPrompt({ title: 'x', content: 'x' }).match(/\{"type":"drawing","title":"A leaf[\s\S]*?\]\}/)[0]);
    return { boxes: artWorthShowing(boxes), circles: artWorthShowing(circles), leaf: artWorthShowing(leaf), leafDraws: !!drawSpec(leaf) };
  });
  assert(!r.boxes && !r.circles, 'boxes with nouns, and acronyms in circles, are not shown as the lesson\'s drawing');
  assert(r.leaf && r.leafDraws, 'the prompt\'s own example passes the gate and draws');
  await env.browser.close();

  // 7. The prompt teaches icons as props, with every name, and its example audits clean.
  const env2 = await h.open({ mock: none, settle: 900 });
  await env2.page.addScriptTag({ content: AUDIT });
  r = await env2.page.evaluate(() => {
    const lp = SFDraw.lessonPrompt({ title: 'x', content: 'x' }), mp = SFDraw.momentPrompt({ lesson: 'x', question: 'q', answer: 'a' });
    const names = ((lp.match(/Names: (.*)/) || [])[1] || '').trim().split(' ');
    const leaf = JSON.parse(lp.match(/\{"type":"drawing","title":"A leaf[\s\S]*?\]\}/)[0]);
    const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:0;top:0;width:343px'; document.body.appendChild(host);
    host.innerHTML = drawSpec(leaf);
    const f = SFAudit(host.querySelector('svg'), {})[0].findings.filter(x => x.level !== 'info').map(x => x.code);
    return { around: /AROUND your subject/.test(lp) && /never INSTEAD/.test(lp), all: names.length === SFIcons.names().length,
             moment: /"s":"icon"/.test(mp), leafPaths: leaf.shapes.filter(s => s.s === 'path' || s.s === 'poly').length, audit: f, len: lp.length };
  });
  assert(r.around && r.all && r.moment, 'both prompts offer icons as props, never instead of the subject, with all ' + SFIcons_count() + ' names');
  assert(r.leafPaths >= 6 && r.audit.length === 0, 'the leaf example has ' + r.leafPaths + ' drawn parts and audits clean (' + r.audit.join(',') + ')');
  assert(r.len < 12000, 'the lesson prompt is still short (' + r.len + ' chars)');
  await env2.browser.close();

  // 8. Flashcards: a picture of the term itself, never of what it is about; never on a trap.
  const p = JSON.parse(JSON.stringify(fx.plan)); p.days[0].generatedArt = null;
  p.days[0].keyTerms = [{ term: 'Heart', definition: 'The muscle that pumps blood' }, { term: 'Artery', definition: 'A vessel carrying blood away from the heart' }];
  const env3 = await h.open({ plan: p, mock: none, settle: 1500 });
  r = await env3.page.evaluate(async () => {
    for (let i = 0; i < 20; i++) { if (window.currentCard && currentCard.type === 'flashcards') break; showNextCard(); }
    const seen = [];
    for (let k = 0; k < 8; k++) {
      const c = document.getElementById('fc-card'); if (!c) break;
      seen.push({ term: (c.querySelector('.fc-term, .fc-myth') || {}).textContent, trap: c.classList.contains('is-trap'), ico: !!c.querySelector('.fc-ico'),
                  fits: c.querySelector('.fc-front').scrollHeight <= c.querySelector('.fc-front').clientHeight + 1 });
      const b = document.getElementById('fc-next'); if (!b || b.disabled) break; b.click(); await new Promise(r => setTimeout(r, 420));
    }
    return seen;
  });
  const heart = r.find(x => x.term === 'Heart'), artery = r.find(x => x.term === 'Artery');
  assert(heart && heart.ico && heart.fits, 'the "Heart" card shows a heart, and fits');
  assert(artery && !artery.ico, 'the "Artery" card shows no heart');
  assert(r.filter(x => x.trap).every(x => !x.ico), 'no trap card has a picture');

  // 9. Icons arrive whole: popped in after their disc, and the diagram handed back identical.
  r = await env3.page.evaluate(async () => {
    const d = { title: 'How memory works', content: 'x', steps: [{ action: 'Information enters sensory memory' }, { action: 'Attention moves it to short-term memory' }, { action: 'Rehearsal moves it to long-term memory' }] };
    const dg = diagramForDay(d);
    const host = document.createElement('div'); host.id = 'lesson-art'; host.innerHTML = dg.svg;
    document.body.insertBefore(host, document.body.firstChild);
    const before = host.querySelector('svg').outerHTML;
    await new Promise(r => setTimeout(r, 30));
    const pops = [...host.querySelectorAll('.sf-ico')].map(g => g.getAnimations().map(a => a.animationName).join('+'));
    const traced = host.querySelectorAll('.sf-ico path').length && [...host.querySelectorAll('.sf-ico path')].some(p => p.getAnimations().length);
    await new Promise(r => setTimeout(r, 5200));
    const same = host.querySelector('svg').outerHTML === before; host.remove();
    return { pops, traced, same };
  });
  assert(r.pops.length === 3 && r.pops.every(x => x === 'sfdPop'), 'each icon pops in as one piece (' + r.pops.join(',') + ')');
  assert(!r.traced, 'an icon\'s own outline is never traced');
  assert(r.same, 'the diagram is handed back byte-identical');
  assert(!env3.errors.length && !env2.errors.length && !env.errors.length, 'no page errors ' + env.errors.concat(env2.errors, env3.errors).join(' | '));
  await env3.browser.close();
  console.log(fails ? fails + ' FAILED' : 'ICONS OK');
  function SFIcons_count() { return '120+'; }
})();
