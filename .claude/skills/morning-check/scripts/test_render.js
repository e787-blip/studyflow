// Pictures drawn by code (sf-render.js): the model supplies figures or dates, the file draws them
// to scale. Checks: it is on the page; each picture draws and puts every mark where its number
// says; it declines (null) on data that would not make an honest picture; hostile text never
// becomes markup; the lesson card picks it up from day.diagram, day.visual and the day's own dated
// steps, and falls back when it declines; the labelling card refuses it; it audits clean at phone
// width; it draws itself and is handed back unchanged; the plan builder validates and prompts it.
const h = require('./harness');
const fs = require('fs');
const AUDIT = fs.readFileSync(__dirname + '/../../diagram/scripts/audit.js', 'utf8');
const APP = fs.readFileSync(__dirname + '/../../../../app.html', 'utf8');
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const none = async () => ({ json: { result: '{"type":"none"}' } });

(async () => {
  const env = await h.open({ mock: none, settle: 1200 });
  const page = env.page;
  await page.addScriptTag({ content: AUDIT });

  // 1. Loaded, with its three pictures.
  let r = await page.evaluate(() => ({ on: !!window.SFRender, types: window.SFRender ? Object.keys(SFRender.types).sort().join(',') : '' }));
  assert(r.on && r.types === 'bars,chart,numberline,timeline', 'sf-render.js is on the lesson page (' + r.types + ')');

  // 2. Every mark is where its number says.
  r = await page.evaluate(() => {
    const host = document.createElement('div'); host.style.width = '343px'; document.body.appendChild(host);
    const put = (svg) => { host.innerHTML = svg || ''; return host.querySelector('svg'); };
    const out = {};
    // A line: dots in x order, heights in proportion to the values.
    let s = put(SFRender.fromSpec({ type: 'chart', kind: 'line', title: 'Bean plant', xLabel: 'Day', yUnit: 'cm',
      points: [[8, 10], [0, 0], [4, 5], [12, 20]], highlight: 2 }));
    const dots = s ? [...s.querySelectorAll('circle')].map(c => ({ x: +c.getAttribute('cx'), y: +c.getAttribute('cy') })) : [];
    out.lineKind = s && s.getAttribute('data-sf-render');
    out.lineSorted = dots.length === 4 && dots.every((d, i) => !i || d.x > dots[i - 1].x);
    // values 0, 5, 10, 20 -> heights above the zero dot in ratio 0 : 1 : 2 : 4
    const base = dots.length ? dots[0].y : 0, u = dots.length ? (base - dots[1].y) : 0;
    out.lineRatio = dots.length === 4 && u > 0 && Math.abs((base - dots[2].y) / u - 2) < 0.02 && Math.abs((base - dots[3].y) / u - 4) < 0.02;
    out.lineLabel = s ? [...s.querySelectorAll('text')].map(t => t.textContent).join('|') : '';
    // Bars: lengths in proportion, and the axis starts at zero.
    s = put(SFRender.fromSpec({ type: 'bars', title: 'Air', items: ['Nitrogen: 78', 'Oxygen: 21', 'Argon: 1'] }));
    const bars = s ? [...s.querySelectorAll('rect')].map(b => +b.getAttribute('height')) : [];
    out.barRatio = bars.length === 3 && Math.abs(bars[0] / bars[1] - 78 / 21) < 0.08;
    out.barZero = s ? [...s.querySelectorAll('text')].some(t => t.textContent === '0') : false;
    // Changing a number changes the picture.
    const a = SFRender.fromSpec({ type: 'bars', items: ['A: 10', 'B: 20', 'C: 30'] });
    const b = SFRender.fromSpec({ type: 'bars', items: ['A: 10', 'B: 25', 'C: 30'] });
    out.changes = !!a && !!b && a.replace(/sfr\d+/g, '') !== b.replace(/sfr\d+/g, '');
    // A timeline is to scale: 1900 and 1901 sit close, 2000 far below.
    s = put(SFRender.fromSpec({ type: 'timeline', items: ['2000: C happens', '1900: A happens', '1901: B happens'] }));
    const rail = s ? [...s.querySelectorAll('circle[r="6"]')].map(c => +c.getAttribute('cy')) : [];
    out.tlScale = rail.length === 3 && Math.abs((rail[1] - rail[0]) / (rail[2] - rail[0]) - 0.01) < 0.005;
    out.tlOrder = s ? /A happens[\s\S]*B happens[\s\S]*C happens/.test(s.textContent) : false;
    s = put(SFRender.fromSpec({ type: 'timeline', items: ['753 BCE: Rome founded', '44 BCE: Caesar killed', '476: Western empire falls'] }));
    out.bce = s ? /753 BCE/.test(s.textContent) && /44 BCE/.test(s.textContent) : false;
    // A number line: marks where their value is, fractions stacked.
    s = put(SFRender.fromSpec({ type: 'numberline', min: 0, max: 1, denominator: 4, marks: [{ at: '3/4', label: 'three quarters' }] }));
    const m = s && s.querySelector('circle'), line = s && s.querySelector('line');
    out.nlAt = !!m && !!line && Math.abs((+m.getAttribute('cx') - +line.getAttribute('x1')) / (+line.getAttribute('x2') - +line.getAttribute('x1')) - 0.75) < 0.01;
    out.example = /not taken from your notes/.test(SFRender.fromSpec({ type: 'chart', points: [[1, 1], [2, 2], [3, 4]], example: true }) || '');
    out.noExample = !/not taken from your notes/.test(SFRender.fromSpec({ type: 'chart', points: [[1, 1], [2, 2], [3, 4]] }) || '');
    host.remove();
    return out;
  });
  assert(r.lineKind === 'chart' && r.lineSorted, 'a line chart draws, its points in x order whatever order they came in');
  assert(r.lineRatio, 'each dot sits at its value: heights 0 : 5 : 10 : 20 come out 0 : 1 : 2 : 4');
  assert(/Day 4: 5 cm/.test(r.lineLabel), 'the highlighted point is labelled with its own value (' + r.lineLabel.slice(0, 80) + ')');
  assert(r.barRatio && r.barZero, 'bar lengths are in proportion and the axis starts at zero');
  assert(r.changes, 'changing one number changes the picture');
  assert(r.tlScale && r.tlOrder, 'a timeline is to scale (1900-1901 is 1% of 1900-2000) and sorted');
  assert(r.bce, 'BCE years are read and printed as BCE');
  assert(r.nlAt, 'a number-line mark at 3/4 sits three quarters along the line');
  assert(r.example && r.noExample, '"example":true prints that the numbers are not from the notes, and only then');

  // 3. It declines rather than drawing a dishonest picture.
  r = await page.evaluate(() => {
    const no = [
      { type: 'chart', points: [] }, { type: 'chart', points: [[1, 2]] }, { type: 'chart', points: [[1, 2], [2, 3]] },
      { type: 'chart', points: [[1, 2], [2, 'abc'], [3, 4]] }, { type: 'chart', points: [[1, 5], [2, 5], [3, 5]] },
      { type: 'chart', points: [[1, 2], [1, 3], [2, 4]] }, { type: 'chart', points: [[1, 2], [2, Infinity], [3, 4]] },
      { type: 'chart', points: 'lots' }, { type: 'bars', items: ['Nitrogen', 'Oxygen', 'Argon'] },
      { type: 'numberline', min: 5, max: 1, marks: [{ at: 2 }] }, { type: 'numberline', min: 0, max: 10, marks: [{ at: 12 }] },
      { type: 'numberline', min: 0, max: 10 }, { type: 'timeline', items: ['1914: war', '1918: peace'] },
      { type: 'timeline', items: ['War begins', 'Armistice', 'Treaty'] }, { type: 'timeline', items: 'x' },
      { type: 'timeline', items: ['1914: a', '1914: b', '1914: c'] }, null, 'chart', { type: 'drawing', shapes: [] }
    ];
    const drew = []; no.forEach((s, i) => { let v; try { v = SFRender.fromSpec(s); } catch (e) { v = 'THREW ' + e.message; } if (v) drew.push(i); });
    return drew;
  });
  assert(r.length === 0, 'declines all 19 bad specs - too few points, not-a-number, flat, repeated x, no numbers, out of range, no years, wrong types (drew: ' + r.join(',') + ')');

  // 4. Nothing the model wrote becomes markup.
  r = await page.evaluate(() => {
    const evil = '<script>alert(1)</script><img src=x onerror=alert(1)>';
    const specs = [
      { type: 'chart', title: evil, xLabel: evil, yLabel: '" onload="alert(1)', yUnit: evil, points: [[1, 1], [2, 3], [3, 2]], highlight: 1 },
      { type: 'bars', title: evil, items: [{ label: evil, value: 3 }, { label: '"><svg onload=alert(1)>', value: 4 }, { label: 'ok', value: 5 }] },
      { type: 'timeline', title: evil, items: ['1914: ' + evil, '1916: "onmouseover="alert(1)', '1918: fine'] },
      { type: 'numberline', title: evil, min: 0, max: 4, step: 1, marks: [{ at: 2, label: evil }], jumps: [{ from: 0, to: 2, label: evil }] },
      JSON.parse('{"type":"chart","__proto__":{"polluted":1},"points":[[1,1],[2,2],[3,3]]}')
    ];
    const d = document.createElement('div'); document.body.appendChild(d);
    const bad = []; let drawn = 0;
    specs.forEach(s => { const v = SFRender.fromSpec(s); if (v) drawn++; d.innerHTML = v || '';
      d.querySelectorAll('*').forEach(e => { if (/^(script|img|foreignobject|iframe)$/i.test(e.localName)) bad.push(e.localName);
        for (const a of e.attributes) if (/^on/i.test(a.name)) bad.push(a.name); }); });
    d.remove();
    return { bad, drawn, polluted: ({}).polluted };
  });
  assert(r.drawn === 5 && r.bad.length === 0 && r.polluted === undefined, 'hostile titles, labels and keys draw as plain text - no script, img or on* attribute reaches the DOM (' + r.bad.join(',') + ')');

  // 5. The lesson card picks it up, and falls back when it declines.
  r = await page.evaluate(() => {
    const kind = (o) => { const m = o && /data-sf-render="(\w+)"/.exec(o.svg); return m ? m[1] : (o ? 'kit' : 'none'); };
    const base = { subject: 'science', content: 'x', steps: [{ action: 'One' }, { action: 'Two' }, { action: 'Three' }] };
    const day = (extra) => Object.assign({}, base, extra);
    return {
      visualChart: kind(diagramForDay(day({ title: 'Growth', visual: { type: 'chart', points: [[0, 0], [4, 3], [8, 10]], yUnit: 'cm' } }))),
      visualBars: kind(diagramForDay(day({ title: 'Air', visual: { type: 'bars', items: [{ label: 'Nitrogen', value: 78 }, { label: 'Oxygen', value: 21 }, { label: 'Argon', value: 1 }] } }))),
      visualNL: kind(diagramForDay(day({ title: 'Quarters', visual: { type: 'numberline', min: 0, max: 1, denominator: 4, marks: [{ at: '1/4' }] } }))),
      diagramBars: kind(diagramForDay(day({ title: 'Air', diagram: { type: 'custom', layout: 'bars', title: 'Air', items: ['Nitrogen: 78', 'Oxygen: 21', 'Argon: 1'] } }))),
      dated: kind(diagramForDay({ subject: 'history', title: 'Causes of the American Revolution', content: 'x',
        steps: [{ action: '1763: The French and Indian War ends with Britain in debt' }, { action: '1765: The Stamp Act taxes printed paper' }, { action: '1773: The Boston Tea Party protests the tea tax' }] })),
      badChart: kind(diagramForDay(day({ title: 'Growth', visual: { type: 'chart', points: [[0, 1], [1, 1], [2, 1]] } }))),
      undated: kind(diagramForDay(day({ title: 'Timeline of events', visual: { type: 'timeline', items: ['War begins', 'Armistice', 'Treaty signed'] } }))),
      noFile: (() => { const keep = window.SFRender; window.SFRender = undefined;
        const k = kind(diagramForDay(day({ title: 'Growth', visual: { type: 'chart', points: [[0, 0], [4, 3], [8, 10]] } }))); window.SFRender = keep; return k; })()
    };
  });
  assert(r.visualChart === 'chart' && r.visualBars === 'chart' && r.visualNL === 'numberline', 'day.visual chart, bars and numberline are drawn by sf-render (' + [r.visualChart, r.visualBars, r.visualNL] + ')');
  assert(r.diagramBars === 'chart', 'the model\'s day.diagram bars layout is drawn by sf-render (' + r.diagramBars + ')');
  assert(r.dated === 'timeline', 'a day whose own steps carry years gets a timeline to scale (' + r.dated + ')');
  assert(r.badChart !== 'chart' && r.badChart !== 'none' && r.undated !== 'timeline' && r.undated !== 'none', 'a declined spec falls back to a picture, not to nothing (' + r.badChart + ', ' + r.undated + ')');
  assert(r.noFile !== 'chart' && r.noFile !== 'none', 'with sf-render.js missing the lesson still gets a picture (' + r.noFile + ')');

  // 6. The labelling card refuses a chart: where a mark sits is data, not anatomy.
  r = await page.evaluate(() => {
    const keep = window.lessonPicture;
    const svg = SFRender.fromSpec({ type: 'timeline', items: ['1914: Archduke assassinated', '1916: Battle of the Somme', '1918: Armistice signed'] });
    try { window.lessonPicture = () => ({ svg: svg, caption: 'x' }); return typeof lessonLabelQuestion === 'function' ? lessonLabelQuestion() : 'missing'; }
    finally { window.lessonPicture = keep; }
  });
  assert(r === null, 'the labelling card is not built from a chart or timeline (' + JSON.stringify(r).slice(0, 60) + ')');

  // 6b. A picture sf-render can draw beats a model drawing, and no call is made for one.
  const callsBefore = env.calls.length;
  r = await page.evaluate(async () => {
    const dated = { subject: 'history', title: 'Five Key Events of the American Revolution', content: 'x',
      steps: [{ action: '1765: The Stamp Act taxes printed paper' }, { action: '1770: The Boston Massacre' }, { action: '1773: The Boston Tea Party' }, { action: '1774: The Intolerable Acts' }, { action: '1775: Lexington and Concord' }],
      generatedArt: { type: 'drawing', w: 400, h: 250, shapes: [{ s: 'poly', pts: [[10, 10], [60, 10], [30, 50]] }, { s: 'poly', pts: [[100, 10], [160, 10], [130, 50]] }, { s: 'path', d: 'M10 100 L200 120' }, { s: 'text', x: 200, y: 200, t: 'Boston Massacre' }] } };
    const keepDay = window.day, keepArt = Object.assign({}, window.lessonArt);
    window.day = dated; window.lessonArt.spec = null; window.lessonArt.state = 'idle'; try { window.recallCache = { key: '', pic: null }; } catch (e) { }
    requestLessonArt(dated);
    await new Promise(res => setTimeout(res, 300));
    const pic = lessonPicture();
    const out = { kind: pic && /data-sf-render="(\w+)"/.exec(pic.svg) ? /data-sf-render="(\w+)"/.exec(pic.svg)[1] : 'other', artSpec: !!window.lessonArt.spec, state: window.lessonArt.state };
    window.day = keepDay; Object.assign(window.lessonArt, keepArt); try { window.recallCache = { key: '', pic: null }; } catch (e) { }
    return out;
  });
  assert(r.kind === 'timeline' && !r.artSpec && r.state === 'done', 'a dated lesson shows the to-scale timeline even when a model drawing was already stored (' + JSON.stringify(r) + ')');
  assert(env.calls.length === callsBefore, 'and asks the model for no drawing (' + (env.calls.length - callsBefore) + ' calls)');

  // 7. Audits clean at phone width.
  r = await page.evaluate(() => {
    const host = document.createElement('div'); host.style.width = '343px'; host.style.background = '#f7f9fe'; document.body.appendChild(host);
    const specs = {
      line: { type: 'chart', title: 'World population', xLabel: 'Year', yLabel: 'People', yUnit: 'billion', points: [[1950, 2.5], [1970, 3.7], [1990, 5.3], [2010, 6.9], [2020, 7.8]], highlight: 4 },
      vbars: { type: 'bars', title: 'What air is made of', yUnit: '%', items: ['Nitrogen: 78', 'Oxygen: 21', 'Argon: 1'] },
      hbars: { type: 'chart', kind: 'bar', title: 'Island populations', points: [['Oahu', 1016000], ['Hawaii Island', 200629], ['Maui', 164754], ['Kauai', 73298], ['Molokai', 7345], ['Lanai', 3367]] },
      nl: { type: 'numberline', title: '7 + 5', min: 0, max: 14, step: 1, marks: [{ at: 12, label: '12' }], jumps: [{ from: 0, to: 7, label: '7' }, { from: 7, to: 12, label: '+5' }] },
      tl: { type: 'timeline', title: 'The road to World War I', items: ['1879: Germany and Austria-Hungary sign the Dual Alliance', '1894: France and Russia form an alliance', '1904: Britain and France agree the Entente Cordiale', '1914: Archduke Franz Ferdinand is assassinated', '1918: Armistice ends the fighting'] }
    };
    const out = {};
    Object.keys(specs).forEach(k => { host.innerHTML = SFRender.fromSpec(specs[k], { subject: 'history' }) || '';
      const el = host.querySelector('svg'); if (!el) { out[k] = ['not drawn']; return; }
      out[k] = (SFAudit(el)[0].findings || []).filter(f => f.level === 'fail').map(f => f.code); });
    host.remove();
    return out;
  });
  const auditFails = Object.keys(r).filter(k => r[k].length).map(k => k + ':' + r[k].join('+'));
  assert(auditFails.length === 0, 'all five audit with no failures at 343px (' + auditFails.join(' ') + ')');

  // 8. It draws itself like every other picture, and is handed back unchanged.
  r = await page.evaluate(async () => {
    let art = document.querySelector('#lesson-art');
    const made = !art;
    if (made) { art = document.createElement('div'); art.id = 'lesson-art'; document.querySelector('#session-card, body').appendChild(art); }
    art.scrollIntoView();
    const svg = SFRender.fromSpec({ type: 'chart', title: 'Bean plant', points: [[0, 0], [4, 3], [8, 10], [12, 19]], highlight: 2, xLabel: 'Day', yUnit: 'cm' });
    art.innerHTML = svg;
    const before = art.querySelector('svg').outerHTML;
    await new Promise(res => setTimeout(res, 120));
    const anims = document.getAnimations().length;
    await new Promise(res => setTimeout(res, 5200));
    const after = art.querySelector('svg') ? art.querySelector('svg').outerHTML : '';
    if (made) art.remove();
    return { anims, same: before === after };
  });
  assert(r.anims > 0, 'the chart draws itself when shown (' + r.anims + ' animations)');
  assert(r.same, 'and the DOM is handed back byte-identical when it has finished');

  // 9. The plan builder knows it: loads the file, accepts and validates the types, and prompts them.
  assert(/<script src="\/sf-render\.js"><\/script>/.test(APP), 'app.html loads sf-render.js');
  assert(/chart:1, numberline:1/.test(APP) && /window\.SFRender\.check\(v\)/.test(APP), 'app.html accepts chart and numberline visuals and drops one SFRender would decline');
  assert(/\{"type":"chart","kind":"line"/.test(APP) && /\{"type":"numberline"/.test(APP) && /"example":true/.test(APP), 'the plan prompt shows both, and says how to mark invented numbers');

  assert(env.errors.length === 0, 'no page errors (' + env.errors.slice(0, 3).join(' | ') + ')');
  console.log(fails ? fails + ' FAILED' : 'RENDER OK');
  await env.browser.close();
})().catch(e => { console.log('FAIL threw ' + (e && e.stack || e)); process.exitCode = 1; });
