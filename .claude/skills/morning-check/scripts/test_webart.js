// A real illustration found for a lesson (lesson.html webArtFor + sf-illustrate.js), on real page
// loads with api/illustration answered from fixtures. Checks: a lesson no checked picture covers
// gets the judged pick, credited, made ready for a phone; an illegible pick is skipped for the
// next; the choice is saved on the day and a reopen spends no pick; "none fits" is remembered and
// a failure is not; the library, sf-render and maths still come first; tomorrow is picked during
// today; key terms become the labelling card's pins; and a hostile file - script, handlers, outside
// image, a <style> aimed at the page - never touches the page.
const h = require('./harness');
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const none = async () => ({ json: { result: '{"type":"none"}' } });

const GOOD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" onload="window.__pwned=1">' +
  '<script>window.__pwned=1</script><foreignObject width="10" height="10"><div onclick="x()">x</div></foreignObject>' +
  '<image href="http://evil.example/x.png" width="10" height="10"/><a href="javascript:window.__pwned=1"><rect x="1" y="1" width="2" height="2"/></a>' +
  '<style>.session-card{display:none!important} body{background:rgb(255,0,0)!important} .ring{stroke:#3563e9}</style>' +
  '<circle class="ring" cx="200" cy="150" r="90" fill="none" stroke-width="6"/>' +
  '<path d="M200 60 L290 150 L200 240 L110 150 Z" fill="#e9f0ff" stroke="#1a1d2e"/>' +
  '<text x="200" y="40" text-anchor="middle" font-size="14">Citrate</text>' +
  '<text x="320" y="150" text-anchor="start" font-size="14">Isocitrate</text>' +
  '<text x="200" y="275" text-anchor="middle" font-size="14">Succinate</text>' +
  '<text x="80" y="150" text-anchor="end" font-size="14">Malate</text>' +
  '<text x="300" y="60" text-anchor="start" font-size="14">Oxaloacetate</text></svg>';
const PILED = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect x="10" y="10" width="380" height="280" fill="#eee"/>' +
  ['Citrate', 'Isocitrate', 'Succinate', 'Malate', 'Fumarate', 'Oxaloacetate'].map(t => '<text x="150" y="150" font-size="14">' + t + '</text>').join('') + '</svg>';

function krebsDay(n, extra) {
  return Object.assign({ day: n, title: 'The Krebs cycle', content: 'The Krebs cycle turns acetyl-CoA into carbon dioxide inside the mitochondrion.',
    steps: [{ action: 'Acetyl-CoA joins oxaloacetate' }, { action: 'Citrate is rearranged' }, { action: 'Carbon dioxide is released' }],
    keyTerms: [{ term: 'Citrate', definition: 'x' }, { term: 'Oxaloacetate', definition: 'y' }, { term: 'Succinate', definition: 'z' }, { term: 'Malate', definition: 'w' }],
    questions: [{ type: 'mcq', question: 'Where does the Krebs cycle happen?', options: ['Mitochondrion', 'Nucleus', 'Ribosome', 'Vacuole'], correctIndex: 0, explanation: 'x' }] }, extra || {});
}
const before = { day: 1, title: 'Before', content: 'x', questions: [], completed: true };
const planOf = (days, type) => ({ id: 'wa', subject: 'Biology', subjectType: type || 'science', days });

/* api/illustration, answered from fixtures; every call is recorded. */
function endpoint(o) {
  const calls = { pick: [], file: [] };
  const handler = async route => {
    const u = new URL(route.request().url());
    const file = u.searchParams.get('file');
    if (file) {
      calls.file.push(file);
      if (o.fileStatus) return route.fulfill({ status: o.fileStatus, contentType: 'application/json', body: '{"error":"x"}' });
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ svg: /Piled/.test(file) ? PILED : GOOD, file, credit: 'Illustration: Tester, Wikimedia Commons, CC BY-SA 4.0' }) });
    }
    calls.pick.push(Object.fromEntries(u.searchParams));
    if (o.pickStatus) return route.fulfill({ status: o.pickStatus, contentType: 'application/json', body: '{"error":"x"}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ topic: u.searchParams.get('topic'), picks: o.picks || [] }) });
  };
  return { calls, routes: [['**/api/illustration*', handler]] };
}
const PICKS = [{ file: 'File:Piled labels.svg', credit: 'Illustration: Tester, Wikimedia Commons, CC BY-SA 4.0' },
               { file: 'File:Good Krebs.svg', credit: 'Illustration: Tester, Wikimedia Commons, CC BY-SA 4.0' }];

async function toLesson(page) {
  for (let i = 0; i < 12; i++) {
    if (await page.evaluate(() => window.currentCard && window.currentCard.type) === 'lesson') break;
    await page.evaluate(() => showNextCard()); await page.waitForTimeout(80);
  }
  for (let i = 0; i < 60; i++) { if (await page.evaluate(() => window.lessonArt && lessonArt.state === 'done')) break; await page.waitForTimeout(100); }
  await page.waitForTimeout(150);
}
const saved = page => page.evaluate(() => { const p = JSON.parse(SFStore.getItem('studyflow_plan') || '{}'); return (p.days || []).map(d => d.webArt === undefined ? 'unset' : d.webArt); });

(async () => {
  // 1. A lesson no checked picture covers: the judged pick, ready for a phone, saved.
  let ep = endpoint({ picks: PICKS });
  let env = await h.open({ plan: planOf([before, krebsDay(2)]), day: 1, mock: none, settle: 900, modelArt: false, routes: ep.routes });
  await toLesson(env.page);
  let r = await env.page.evaluate(() => {
    const host = document.querySelector('#lesson-art'), svg = host && host.querySelector('svg');
    const bad = []; if (host) host.querySelectorAll('*').forEach(e => { if (/^(script|foreignobject|image|iframe|a)$/i.test(e.localName)) bad.push(e.localName);
      for (const a of e.attributes) { if (/^on/i.test(a.name)) bad.push(a.name); if (/javascript:|evil\.example/.test(a.value)) bad.push(a.value.slice(0, 20)); } });
    const card = document.getElementById('session-card');
    return { lib: lessonArt.lib && lessonArt.lib.id, web: !!(svg && svg.getAttribute('data-sf-lib') === 'web'),
             credit: svg ? ((svg.querySelector('.sf-credit') || {}).textContent || '') : '', bad, pwned: window.__pwned === 1,
             cardShown: !!card && getComputedStyle(card).display !== 'none', bodyRed: getComputedStyle(document.body).backgroundColor === 'rgb(255, 0, 0)',
             styleLeft: !!(svg && svg.querySelector('style')), ring: svg ? !!svg.querySelector('circle[stroke="#3563e9"], circle[stroke="rgb(53, 99, 233)"]') : false,
             anim: svg ? document.getAnimations().filter(a => a.effect && a.effect.target && svg.contains(a.effect.target)).length : -1 };
  });
  assert(r.lib === 'web' && r.web, 'a lesson nothing in the library covers shows the picture found for it (' + r.lib + ')');
  assert(ep.calls.pick.length === 1 && ep.calls.pick[0].topic === 'the krebs cycle' && ep.calls.pick[0].subject === 'science',
         'one pick is asked for, by the lesson\'s own topic, lower-cased so learners share it (' + JSON.stringify(ep.calls.pick[0]) + ')');
  assert(ep.calls.file.join() === 'File:Piled labels.svg,File:Good Krebs.svg', 'a pick whose labels pile up at phone width is skipped for the next (' + ep.calls.file.join(' > ') + ')');
  assert(/Illustration: Tester, Wikimedia Commons, CC BY-SA 4.0/.test(r.credit), 'its credit is inside the picture: "' + r.credit + '"');
  assert(r.bad.length === 0 && !r.pwned, 'no script, handler, foreignObject, outside image or javascript: link reaches the page (' + r.bad.join(',') + ')');
  assert(r.cardShown && !r.bodyRed && !r.styleLeft, 'the file\'s <style> aimed at the page touched nothing, and is gone from the picture');
  assert(r.ring, 'but what its <style> said about its OWN drawing was kept (the ring is blue)');
  assert(r.anim === 0, 'a person\'s drawing is not traced line by line');
  let s = await saved(env.page);
  assert(s[1] && s[1].file === 'File:Good Krebs.svg', 'the choice is saved on the day (' + JSON.stringify(s[1]) + ')');
  r = await env.page.evaluate(() => { const q = lessonLabelQuestion(); return q ? { n: q.pins.length, a: q.pins.map(p => p.answer) } : null; });
  assert(r && r.n >= 3 && r.a.every(a => /^(Citrate|Oxaloacetate|Succinate|Malate)$/.test(a)), 'the day\'s key terms printed on it become the labelling card\'s pins (' + (r ? r.a.join(', ') : 'none') + ')');
  assert(env.errors.length === 0, 'no page errors (' + env.errors.slice(0, 2).join(' | ') + ')');
  await env.browser.close();

  // 1b. Labels written as bare text then a tspan per line (Commons' ear): every line kept, each its own word.
  env = await h.open({ plan: planOf([before, krebsDay(2)]), day: 1, mock: none, settle: 600, modelArt: false, routes: endpoint({ picks: [] }).routes });
  r = await env.page.evaluate(async () => {
    const src = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><path d="M40 40 L360 40 L360 260 L40 260 Z" fill="#e9f0ff" stroke="#1a1d2e"/>' +
      '<g transform="translate(60 80)"><text font-size="14">Stapes<tspan x="0" y="20">(attached to</tspan><tspan x="0" y="40">oval window)</tspan></text></g>' +
      '<g transform="translate(240 80)"><text font-size="14">Semicircular<tspan x="0" y="20">canals</tspan></text></g>' +
      '<text x="60" y="220" font-size="14">H<tspan dy="3" font-size="10">2</tspan><tspan dy="-3">O</tspan></text>' +
      '<text x="240" y="220" font-size="14"><tspan x="240" y="220">Round</tspan><tspan x="240" y="238">window</tspan></text></svg>';
    const out = await SFIllustrate.prepare(src, { credit: 'Illustration: T, Wikimedia Commons' }, { finalize: true });
    const d = new DOMParser().parseFromString(out.svg, 'image/svg+xml');
    return Array.from(d.querySelectorAll('text')).filter(t => !t.classList.contains('sf-credit'))
      .map(t => { const sp = t.querySelectorAll('tspan'); return sp.length ? Array.from(sp).map(x => x.textContent).join('/') : t.textContent; }).sort();
  });
  assert(JSON.stringify(r) === JSON.stringify(['H2O', 'Round/window', 'Semicircular/canals', 'Stapes/(attached to/oval window)']),
         'bare text then tspan lines: "Stapes" kept, "Semicircular canals" two words, H2O one line - ' + JSON.stringify(r));
  await env.browser.close();

  // 2. Reopening: the saved file, no new pick.
  ep = endpoint({ picks: PICKS });
  env = await h.open({ plan: planOf([before, krebsDay(2, { webArt: { file: 'File:Good Krebs.svg', credit: 'x' } })]), day: 1, mock: none, settle: 900, modelArt: false, routes: ep.routes });
  await toLesson(env.page);
  r = await env.page.evaluate(() => lessonArt.lib && lessonArt.lib.id);
  assert(r === 'web' && ep.calls.pick.length === 0 && ep.calls.file.join() === 'File:Good Krebs.svg', 'a reopened lesson fetches its saved file and asks for no pick');
  await env.browser.close();

  // 3. "None fits" is remembered; a failure is not.
  ep = endpoint({ picks: [] });
  env = await h.open({ plan: planOf([before, krebsDay(2)]), day: 1, mock: none, settle: 900, modelArt: false, routes: ep.routes });
  await toLesson(env.page);
  s = await saved(env.page);
  r = await env.page.evaluate(() => { const svg = document.querySelector('#lesson-art svg'); return { svg: !!svg, web: !!(svg && svg.hasAttribute('data-sf-lib')) }; });
  assert(s[1] === null && r.svg && !r.web, '"none fits" is saved as null, and the card keeps the diagram built from the day\'s steps');
  await env.browser.close();
  ep = endpoint({ picks: PICKS });
  env = await h.open({ plan: planOf([before, krebsDay(2, { webArt: null })]), day: 1, mock: none, settle: 900, modelArt: false, routes: ep.routes });
  await toLesson(env.page);
  assert(ep.calls.pick.length === 0 && ep.calls.file.length === 0, 'and a day saved as null is never asked about again');
  await env.browser.close();
  ep = endpoint({ pickStatus: 503 });
  env = await h.open({ plan: planOf([before, krebsDay(2)]), day: 1, mock: none, settle: 900, modelArt: false, routes: ep.routes });
  await toLesson(env.page);
  s = await saved(env.page);
  r = await env.page.evaluate(() => ({ state: lessonArt.state, svg: !!document.querySelector('#lesson-art svg') }));
  assert(s[1] === 'unset' && r.state === 'done' && r.svg, 'a 503 saves nothing (the next open asks again) and the card is whole');
  await env.browser.close();
  ep = endpoint({ picks: PICKS, fileStatus: 404 });
  env = await h.open({ plan: planOf([before, krebsDay(2, { webArt: { file: 'File:Gone.svg' } })]), day: 1, mock: none, settle: 900, modelArt: false, routes: ep.routes });
  await toLesson(env.page);
  s = await saved(env.page);
  assert(s[1] === 'unset', 'a saved file Commons no longer has is forgotten, to be picked again');
  await env.browser.close();

  // 4. What comes first: the library, sf-render, and maths never ask.
  ep = endpoint({ picks: PICKS });
  env = await h.open({ plan: planOf([before, krebsDay(2, { title: 'The heart and blood vessels' })]), day: 1, mock: none, settle: 900, modelArt: false, routes: ep.routes });
  await toLesson(env.page);
  r = await env.page.evaluate(() => lessonArt.lib && lessonArt.lib.id);
  assert(r === 'heart' && ep.calls.pick.length === 0, 'a lesson the library covers gets the checked picture and no search (' + r + ')');
  await env.browser.close();
  ep = endpoint({ picks: PICKS });
  env = await h.open({ plan: planOf([before, krebsDay(2, { title: 'Causes of the American Revolution', steps: [{ action: '1763: The French and Indian War ends' }, { action: '1765: The Stamp Act' }, { action: '1773: The Boston Tea Party' }] })], 'history'),
                       day: 1, mock: none, settle: 900, modelArt: false, routes: ep.routes });
  await toLesson(env.page);
  r = await env.page.evaluate(() => { const s = document.querySelector('#lesson-art svg'); return s && s.getAttribute('data-sf-render'); });
  assert(r === 'timeline' && ep.calls.pick.length === 0, 'a dated lesson gets its timeline drawn by code and no search');
  await env.browser.close();
  ep = endpoint({ picks: PICKS });
  env = await h.open({ plan: planOf([before, krebsDay(2, { title: 'Solving two-step equations' })], 'math'), day: 1, mock: none, settle: 900, modelArt: false, routes: ep.routes });
  await toLesson(env.page);
  assert(ep.calls.pick.length === 0, 'a maths lesson does not search Commons');
  await env.browser.close();
  ep = endpoint({ picks: PICKS });
  env = await h.open({ plan: planOf([before, krebsDay(2)]), day: 1, mock: none, settle: 900, routes: ep.routes });
  await toLesson(env.page);
  assert(ep.calls.pick.length === 0, 'with the old model-drawing path switched on, nothing is searched (that path is unchanged)');
  await env.browser.close();

  // 5. Tomorrow is picked while today is studied.
  ep = endpoint({ picks: PICKS });
  env = await h.open({ plan: planOf([before, krebsDay(2, { title: 'The heart and blood vessels' }), krebsDay(3)]), day: 1, mock: none, settle: 900, modelArt: false, routes: ep.routes });
  await toLesson(env.page);
  for (let i = 0; i < 40; i++) { s = await saved(env.page); if (s[2] !== 'unset') break; await env.page.waitForTimeout(150); }
  assert(ep.calls.pick.length === 1 && s[2] && s[2].file === 'File:Good Krebs.svg', 'tomorrow\'s picture is picked during today\'s lesson and saved on tomorrow (' + JSON.stringify(s[2]) + ')');
  await env.browser.close();

  // 6. Dark mode keeps paper under it.
  ep = endpoint({ picks: PICKS });
  env = await h.open({ plan: planOf([before, krebsDay(2)]), day: 1, dark: true, mock: none, settle: 900, modelArt: false, routes: ep.routes });
  await toLesson(env.page);
  r = await env.page.evaluate(() => { const m = /(\d+), (\d+), (\d+)/.exec(getComputedStyle(document.querySelector('#lesson-art')).backgroundColor); return m ? (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 : 0; });
  assert(r > 0.85, 'in dark mode the picture sits on paper (luminance ' + r.toFixed(2) + ')');
  await env.browser.close();

  console.log(fails ? fails + ' FAILED' : 'WEBART OK');
})().catch(e => { console.log('FAIL threw ' + (e && e.stack || e)); process.exitCode = 1; });
