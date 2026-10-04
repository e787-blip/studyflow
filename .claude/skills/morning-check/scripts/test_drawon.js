// Pictures draw themselves (SFDrawOn in lesson.html, block 1).
// Real page loads: the lesson card's model drawing and its kit diagram, once-per-session,
// reduced motion, pins, a picture below the fold, and the DOM handed back identical.
const h = require('./harness');
const fs = require('fs');
const fx = require('./fixture');
const VALVES = JSON.parse(fs.readFileSync(__dirname + '/valves.json', 'utf8'))[0].spec;
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const none = async () => ({ json: { result: '{"type":"none"}' } });
function plan(art) { const p = JSON.parse(JSON.stringify(fx.plan)); if (art !== undefined) p.days[0].generatedArt = art; return p; }
const wait = ms => new Promise(r => setTimeout(r, ms));

// Opens the lesson card, records the picture's markup BEFORE the observer runs (same
// synchronous turn), then reports what the observer did to it.
async function openLesson(page) {
  return page.evaluate(async () => {
    for (let i = 0; i < 20; i++) { if (window.currentCard && currentCard.type === 'lesson') break; showNextCard(); }
    const heads = s => [...s.querySelectorAll('*')].filter(e => getComputedStyle(e).markerEnd !== 'none').length;
    const svg0 = document.querySelector('#lesson-art svg');
    window.__before = svg0 ? svg0.outerHTML : '';
    window.__markers = svg0 ? heads(svg0) : -1;
    await new Promise(r => setTimeout(r, 30));
    const svg = document.querySelector('#lesson-art svg');
    const anims = svg ? svg.getAnimations({ subtree: true }) : [];
    const timing = anims.map(a => ({ name: a.animationName, el: a.effect.target.localName,
      start: a.effect.getTiming().delay, end: a.effect.getTiming().delay + a.effect.getTiming().duration }));
    return { has: !!svg, held: svg ? svg.classList.contains('sfd-hold') : null, timing,
             markersNow: svg ? heads(svg) : -1, markersBefore: window.__markers };
  });
}
async function afterDrawing(page) {
  return page.evaluate(() => {
    const svg = document.querySelector('#lesson-art svg');
    if (!svg) return { has: false };
    const left = [...svg.querySelectorAll('*')].filter(e => /sfd|animation/.test(e.getAttribute('style') || '')).length;
    return { has: true, same: svg.outerHTML === window.__before, left,
             flows: svg.querySelectorAll('.sfd-flow').length,
             markers: [...svg.querySelectorAll('*')].filter(e => getComputedStyle(e).markerEnd !== 'none').length,
             markersBefore: window.__markers,
             running: svg.getAnimations({ subtree: true }).length };
  });
}

(async () => {
  // 1. The lesson card's model drawing draws itself, in order, and hands the DOM back.
  let env = await h.open({ plan: plan(VALVES), mock: none, settle: 1500 });
  let r = await openLesson(env.page);
  const t = r.timing;
  const by = n => t.filter(x => x.name === n);
  assert(r.has && r.held === false, 'lesson picture on screen and drawing at once (not held)');
  assert(by('sfdTrace').length >= 6, 'shapes are traced: ' + by('sfdTrace').length);
  assert(by('sfdWash').length >= 4, 'filled outlines wash in behind the line: ' + by('sfdWash').length);
  assert(by('sfdWrite').length === 6, 'every word is written (the title + 5 labels): ' + by('sfdWrite').length);
  const firstTrace = Math.min(...by('sfdTrace').map(x => x.start));
  const writes = by('sfdWrite').map(x => x.start).sort((a, b) => a - b);
  assert(writes[0] < firstTrace, 'the title is written first (' + writes[0] + 'ms < ' + firstTrace + 'ms)');
  assert(writes[writes.length - 1] > firstTrace + 500, 'labels come after the drawing (' + writes.slice(1).join(',') + ')');
  const endAll = Math.max(...t.filter(x => x.name !== 'sfdFlow').map(x => x.end));
  assert(endAll <= 3000, 'the whole drawing takes at most 3s: ' + Math.round(endAll) + 'ms');
  assert(r.markersNow === r.markersBefore - 1, 'the solid arrow\'s head waits for its line (' + r.markersBefore + ' -> ' + r.markersNow + '); the dashed one keeps its head');
  await wait(Math.max(0, endAll - 400));
  const mid = await env.page.evaluate(() => document.querySelectorAll('#lesson-art svg .sfd-flow').length);
  await wait(900);
  const mid2 = await env.page.evaluate(() => document.querySelectorAll('#lesson-art svg .sfd-flow').length);
  assert(mid + mid2 >= 1, 'the arrow sends its pulse after the drawing (' + mid + ', ' + mid2 + ' clones seen)');
  await wait(4500);
  let a = await afterDrawing(env.page);
  assert(a.same, 'afterwards the picture is byte-identical to what was inserted');
  assert(a.left === 0 && a.flows === 0 && a.running === 0, 'nothing left behind: styles ' + a.left + ', pulses ' + a.flows + ', running ' + a.running);
  assert(a.markers === a.markersBefore, 'every arrowhead is back: ' + a.markers + '/' + a.markersBefore);

  // 1b. "Draw it again": a chip appears once everything has stopped, replays the drawing,
  // is disabled while it runs, and the picture is handed back identical again.
  r = await env.page.evaluate(async () => {
    const chip = document.querySelector('#lesson-art > .sfd-replay');
    if (!chip) return { chip: false };
    chip.click();
    await new Promise(r => setTimeout(r, 40));
    const svg = document.querySelector('#lesson-art > svg');
    return { chip: true, label: chip.getAttribute('aria-label'), busy: chip.disabled, running: svg.getAnimations({ subtree: true }).length };
  });
  assert(r.chip && r.label === 'Draw it again', 'a "Draw it again" chip sits on the lesson picture once it has finished');
  assert(r.busy && r.running > 5, 'tapping it draws the picture again (' + r.running + ' animations), chip disabled meanwhile');
  await wait(6500);
  r = await env.page.evaluate(() => ({ same: document.querySelector('#lesson-art > svg').outerHTML === window.__before,
    busy: document.querySelector('#lesson-art > .sfd-replay').disabled }));
  assert(r.same && !r.busy, 'after the replay the picture is identical again and the chip is ready (' + JSON.stringify(r) + ')');

  // 1c. "Draw it for me": the blue part is the answer - drawn last, its label written last,
  // then ringed once; the chip goes in the panel's header, not over the drawing.
  r = await env.page.evaluate(async () => {
    const txt = SFDraw.momentPrompt({ lesson: 'x', question: 'q', answer: 'a' });
    const i = txt.indexOf('{"type":"drawing","title":"Why a small push');
    let depth = 0, j = i;
    for (; j < txt.length; j++) { if (txt[j] === '{') depth++; if (txt[j] === '}') { depth--; if (!depth) break; } }
    const spec = JSON.parse(txt.slice(i, j + 1));
    const panel = document.createElement('div'); panel.className = 'sf-moment-panel'; panel.id = '__mp';
    panel.innerHTML = '<div class="sf-moment-head"><span>Drawn for this question</span></div><div class="sf-moment-art">' + drawSpec(spec) + '</div>';
    document.body.insertBefore(panel, document.body.firstChild);
    window.__mbefore = panel.querySelector('svg').outerHTML;
    await new Promise(r => setTimeout(r, 30));
    const svg = panel.querySelector('svg');
    const BL = { 'rgb(74, 124, 246)': 1, 'rgb(234, 241, 255)': 1, 'rgb(30, 64, 175)': 1 };
    const rows = svg.getAnimations({ subtree: true }).filter(x => x.animationName === 'sfdTrace' || x.animationName === 'sfdWrite' || (x.animationName === 'sfdShow' && x.effect.getTiming().duration > 100))
      .map(x => { const e = x.effect.target, cs = getComputedStyle(e); return { t: x.effect.getTiming().delay, blue: !!(BL[cs.stroke] || BL[cs.fill]), text: e.localName === 'text' }; });
    const shapes = rows.filter(x => !x.text), words = rows.filter(x => x.text);
    return { lastPlain: Math.max(...shapes.filter(x => !x.blue).map(x => x.t)), firstBlue: Math.min(...shapes.filter(x => x.blue).map(x => x.t)),
             nBlue: shapes.filter(x => x.blue).length, lastWord: words.sort((a, b) => b.t - a.t)[0] };
  });
  assert(r.nBlue >= 2 && r.firstBlue >= r.lastPlain, 'the blue answer part is drawn after everything else (' + r.nBlue + ' blue parts from ' + r.firstBlue + 'ms, rest by ' + r.lastPlain + 'ms)');
  assert(r.lastWord && r.lastWord.blue, 'and its label is the last word written');
  // The ring must be invisible until its turn: a clone that holds its first (brightest)
  // keyframe through the delay outlined the answer before anything had been drawn.
  const early = await env.page.evaluate(() => [...document.querySelectorAll('#__mp .sfd-halo')]
    .map(e => +getComputedStyle(e).strokeOpacity).filter(o => o > 0.01).length);
  assert(early === 0, 'the ring is invisible until the answer has been drawn (' + early + ' showing early)');
  let halos = 0;
  for (let k = 0; k < 14; k++) { await wait(250); halos = Math.max(halos, await env.page.evaluate(() => [...document.querySelectorAll('#__mp .sfd-halo')].filter(e => +getComputedStyle(e).strokeOpacity > 0.05).length)); }
  assert(halos >= 2, 'then the answer is ringed once (' + halos + ' rings seen glowing)');
  await wait(4000);
  r = await env.page.evaluate(() => { const p = document.getElementById('__mp'); const o = { same: p.querySelector('.sf-moment-art > svg').outerHTML === window.__mbefore,
    fx: p.querySelectorAll('.sfd-halo, .sfd-flow').length, chipInHead: !!p.querySelector('.sf-moment-head > .sfd-replay'), chipOnArt: !!p.querySelector('.sf-moment-art > .sfd-replay') }; p.remove(); return o; });
  assert(r.same && r.fx === 0, 'the drawing is handed back identical, rings and sparks gone (' + JSON.stringify(r) + ')');
  assert(r.chipInHead && !r.chipOnArt, 'its "Draw it again" chip is in the panel header, not over the drawing');

  // 2. Once per session: the lesson's picture shown again under a question is simply there.
  r = await env.page.evaluate(async () => {
    const p = recallPanel(lessonPicture(), 'Look at it again');
    document.body.insertBefore(p, document.body.firstChild);
    await new Promise(r => setTimeout(r, 30));
    const svg = p.querySelector('svg');
    const n = svg.getAnimations({ subtree: true }).length;
    p.remove();
    return n;
  });
  assert(r === 0, 'the lesson picture is not drawn a second time (' + r + ' animations)');

  // 3. A labelling card: a new picture, drawn quicker, then its pins pop in 1, 2, 3.
  r = await env.page.evaluate(async () => {
    const spec = { type: 'drawing', title: 'Parts of a flower', w: 400, h: 240, shapes: [
      { s: 'path', d: 'M200 230 L200 120', stroke: 'green', sw: 4, fill: 'none' },
      { s: 'ellipse', x: 200, y: 100, rx: 34, ry: 26, fill: 'pinkFill', stroke: 'pink' },
      { s: 'circle', x: 200, y: 100, r: 10, fill: 'amberFill', stroke: 'amber' },
      { s: 'path', d: 'M200 200 Q160 180 150 196 Q170 214 200 206 Z', fill: 'greenFill', stroke: 'green' },
      { s: 'text', x: 300, y: 60, t: 'Petal' } ] };
    const pins = [{ x: 230, y: 92, answer: 'Petal' }, { x: 200, y: 100, answer: 'Centre' }, { x: 165, y: 196, answer: 'Leaf' }];
    const d = document.createElement('div'); d.className = 'ld-fig';
    d.innerHTML = labelPinsSvg(SFSceneKit.fromSpec(spec), pins);
    document.body.insertBefore(d, document.body.firstChild);
    await new Promise(r => setTimeout(r, 30));
    const svg = d.querySelector('svg');
    const pinAnims = [...svg.querySelectorAll('.ld-pin')].map(g => { const x = g.getAnimations()[0]; return x ? x.effect.getTiming().delay : -1; });
    const shapeEnd = Math.max(...svg.getAnimations({ subtree: true }).filter(x => x.animationName === 'sfdTrace').map(x => x.effect.getTiming().delay + x.effect.getTiming().duration));
    const before = d.innerHTML;
    window.__ldfig = d;
    return { pinAnims, shapeEnd, box: getComputedStyle(svg.querySelector('.ld-pin')).transformBox };
  });
  assert(r.pinAnims.length === 3 && r.pinAnims.every(x => x >= 0), 'all three pins pop in: ' + r.pinAnims.join(','));
  assert(r.pinAnims[0] < r.pinAnims[1] && r.pinAnims[1] < r.pinAnims[2], 'in order, 1 then 2 then 3');
  assert(r.pinAnims[0] >= r.shapeEnd - 200, 'after the picture is drawn (' + r.pinAnims[0] + 'ms vs ' + Math.round(r.shapeEnd) + 'ms)');
  assert(r.box === 'fill-box', 'a pin grows from its own centre');
  await wait(3500);
  r = await env.page.evaluate(() => { const g = window.__ldfig.querySelector('.ld-pin'); const out = { style: g.getAttribute('style'), n: window.__ldfig.querySelector('svg').getAnimations({ subtree: true }).length }; window.__ldfig.remove(); return out; });
  assert(r.style === null && r.n === 0, 'pins handed back clean: style ' + r.style + ', running ' + r.n);

  // 4. Below the fold: held hidden until it scrolls in, then drawn; no trace left after.
  r = await env.page.evaluate(async () => {
    const spec = { type: 'drawing', title: 'A lever', w: 400, h: 200, shapes: [
      { s: 'poly', points: '150,180 170,150 190,180', fill: 'faint', stroke: 'ink' },
      { s: 'line', x1: 40, y1: 150, x2: 360, y2: 120, stroke: 'ink', sw: 3 },
      { s: 'path', d: 'M340 40 L340 110', stroke: 'ink', sw: 2, fill: 'none', arrow: true },
      { s: 'text', x: 340, y: 30, t: 'Push' } ] };
    const spacer = document.createElement('div'); spacer.style.height = '3000px'; spacer.id = '__spacer';
    const d = document.createElement('div'); d.className = 'sf-moment-art'; d.id = '__low';
    d.innerHTML = SFSceneKit.fromSpec(spec);
    document.body.appendChild(spacer); document.body.appendChild(d);
    await new Promise(r => setTimeout(r, 30));
    const svg = d.querySelector('svg');
    return { held: svg.classList.contains('sfd-hold'), n: svg.getAnimations({ subtree: true }).length, op: getComputedStyle(svg).opacity };
  });
  assert(r.held && r.n === 0 && r.op === '0', 'a picture below the fold waits, hidden: ' + JSON.stringify(r));
  await env.page.evaluate(() => document.getElementById('__low').scrollIntoView());
  await wait(400);
  r = await env.page.evaluate(() => { const svg = document.querySelector('#__low svg'); return { held: svg.classList.contains('sfd-hold'), n: svg.getAnimations({ subtree: true }).length }; });
  assert(!r.held && r.n > 0, 'and draws itself when it scrolls in: ' + JSON.stringify(r));
  await wait(5000);
  r = await env.page.evaluate(() => { const svg = document.querySelector('#__low svg'); const o = { cls: svg.getAttribute('class'), n: svg.getAnimations({ subtree: true }).length, flows: svg.querySelectorAll('.sfd-flow').length }; document.getElementById('__low').remove(); document.getElementById('__spacer').remove(); return o; });
  assert(r.cls === null && r.n === 0 && r.flows === 0, 'leaving no class, animation or pulse behind: ' + JSON.stringify(r));
  assert(env.errors.length === 0, 'no page errors: ' + env.errors.join(' | '));
  await env.browser.close();

  // 5. A day with no drawing: the kit diagram draws itself, box by box, and is handed back.
  env = await h.open({ plan: plan(null), mock: none, settle: 1500 });
  r = await openLesson(env.page);
  assert(r.has && r.timing.length > 4, 'the local diagram draws itself too: ' + r.timing.length + ' animations');
  // The kit writes every connector before every box; drawn in that order a cycle was arrows
  // joining nothing. Each arrow must now follow a box: box, arrow, box, arrow.
  const order = await env.page.evaluate(() => {
    const svg = document.querySelector('#lesson-art svg');
    return svg.getAnimations({ subtree: true }).filter(a => a.animationName === 'sfdTrace')
      .map(a => ({ k: a.effect.target.localName === 'rect' ? 'B' : (getComputedStyle(a.effect.target).markerEnd !== 'none' || a.effect.target.style.getPropertyValue('marker-end') === 'none' ? 'A' : 'o'), t: a.effect.getTiming().delay }))
      .filter(x => x.k !== 'o').sort((x, y) => x.t - y.t).map(x => x.k).join('');
  });
  assert(/^B/.test(order) && /BA/.test(order) && !/AA/.test(order), 'the chart is dealt box, arrow, box, arrow: ' + order);
  await wait(8000);
  a = await afterDrawing(env.page);
  assert(a.same && a.left === 0 && a.running === 0, 'and is byte-identical afterwards (same=' + a.same + ', left=' + a.left + ')');
  assert(env.errors.length === 0, 'no page errors: ' + env.errors.join(' | '));
  await env.browser.close();

  // 6. prefers-reduced-motion: nothing moves, nothing waits.
  env = await h.open({ plan: plan(VALVES), mock: none, settle: 300 });
  await env.page.emulateMedia({ reducedMotion: 'reduce' });
  await env.page.reload(); await wait(1500);
  r = await openLesson(env.page);
  assert(r.has && r.timing.length === 0 && r.held === false, 'reduced motion: the picture is simply there (' + r.timing.length + ' animations)');
  assert(!(await env.page.$('#lesson-art .sfd-replay')), 'and offers no replay');
  assert(env.errors.length === 0, 'no page errors: ' + env.errors.join(' | '));
  await env.browser.close();

  // 7. The worked example: each step's own picture draws itself as its panel arrives,
  // once - walking back to a panel does not redraw it.
  const FX = require('./fixtures_more');
  env = await h.open({ plan: FX[1], mock: none, settle: 1500 });
  await env.page.evaluate(() => { for (let i = 0; i < 12; i++) { if (window.currentCard && currentCard.type === 'sfwb-brief') return; showNextCard(); } });
  await wait(250);
  const seenSteps = [];
  for (let k = 0; k < 4; k++) {
    seenSteps.push(await env.page.evaluate(() => {
      const now = document.querySelector('.sfb-wp.is-now'), pic = now && now.querySelector('.sfb-wvis svg');
      // a withheld closing line ("Work it out - then tap to check") keeps its picture back too
      const held = !!now && /has-pred/.test(now.getAttribute('class')) && !/is-told/.test(now.getAttribute('class'));
      return { beat: now && now.getAttribute('data-beat'), pic: !!pic, held, anims: pic ? pic.getAnimations({ subtree: true }).filter(x => /^sfd/.test(x.animationName)).length : 0 };
    }));
    const next = env.page.locator('#session-card .sfb-btn.is-primary').first();
    if (await next.count()) { await next.click(); await wait(250); }
  }
  const withPic = seenSteps.filter(x => x.pic && !x.held);
  assert(withPic.length >= 2 && withPic.every(x => x.anims > 0), 'every step picture draws itself on arrival, the first panel included: ' + JSON.stringify(seenSteps));
  assert(seenSteps.filter(x => x.held).every(x => x.anims === 0), 'a withheld answer keeps its picture back until tapped');
  await wait(2500);
  r = await env.page.evaluate(async () => {
    const prev = document.querySelector('#session-card .sfb-btn:not(.is-primary)');
    if (prev) prev.click();
    await new Promise(r => setTimeout(r, 250));
    const now = document.querySelector('.sfb-wp.is-now'), pic = now && now.querySelector('.sfb-wvis svg');
    return { pic: !!pic, anims: pic ? pic.getAnimations({ subtree: true }).filter(x => /^sfd/.test(x.animationName)).length : -1 };
  });
  assert(!r.pic || r.anims === 0, 'walking back to a step: its picture is simply there (' + JSON.stringify(r) + ')');
  assert(env.errors.length === 0, 'no page errors: ' + env.errors.join(' | '));
  await env.browser.close();

  // 8. Dark mode: every place a drawing sits keeps a paper ground, and so does the chip.
  // The lesson frame was var(--soft) - near-black in dark mode - and the labelling card
  // #1e2336, so a drawing's title and thin lines vanished; the themed chip was a dark disc.
  env = await h.open({ plan: plan(VALVES), mock: none, settle: 1500, dark: true });
  await openLesson(env.page);
  await wait(7000);
  r = await env.page.evaluate(() => {
    const lum = c => { const m = c.match(/[\d.]+/g).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
    const host = document.getElementById('session-card') || document.body;
    const d = document.createElement('div'); d.className = 'ld-fig'; host.appendChild(d);
    const panel = document.createElement('div'); panel.className = 'sf-moment-panel';
    panel.innerHTML = '<div class="sf-moment-head"><button class="sfd-replay is-inline"></button></div>'; host.appendChild(panel);
    const chip = document.querySelector('#lesson-art .sfd-replay');
    const o = { dark: document.body.classList.contains('dark'),
      art: lum(getComputedStyle(document.getElementById('lesson-art')).backgroundColor),
      ld: lum(getComputedStyle(d).backgroundColor),
      chip: chip ? lum(getComputedStyle(chip).backgroundColor) : -1,
      mchip: lum(getComputedStyle(panel.querySelector('.sfd-replay')).backgroundColor) };
    d.remove(); panel.remove(); return o;
  });
  assert(r.dark && r.art > 0.85 && r.ld > 0.85, 'dark mode: the lesson picture and the labelling card sit on paper (' + r.art.toFixed(2) + ', ' + r.ld.toFixed(2) + ')');
  assert(r.chip > 0.85 && r.mchip > 0.85, 'dark mode: "Draw it again" stays a light chip on both (' + r.chip.toFixed(2) + ', ' + r.mchip.toFixed(2) + ')');
  assert(!env.errors.length, 'dark mode: no page errors ' + env.errors.join(' | '));
  await env.browser.close();

  console.log(fails ? fails + ' FAILED' : 'DRAWON OK');
})();
