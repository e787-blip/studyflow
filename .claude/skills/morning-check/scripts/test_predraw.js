const h = require('./harness');
const fs = require('fs');
const fx = require('./fixture');
const VALVES = JSON.parse(fs.readFileSync(__dirname + '/valves.json', 'utf8'))[0].spec;
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
function twoDayPlan() {
  const p = JSON.parse(JSON.stringify(fx.plan));
  const d2 = JSON.parse(JSON.stringify(p.days[0])); d2.day = 2; d2.title = 'Blood and the lungs'; d2.microTopic = ''; p.days.push(d2);
  return p;
}
(async () => {
  // 1. today's picture first, then tomorrow's - never both at once
  let inflight = 0, maxInflight = 0;
  const env = await h.open({ plan: twoDayPlan(), mock: async (p) => {
    inflight++; maxInflight = Math.max(maxInflight, inflight);
    await new Promise(r => setTimeout(r, 400)); inflight--;
    return /^Draw ONE illustration/.test(p) ? { json: { result: JSON.stringify(VALVES) } } : { json: { result: '{"type":"none"}' } };
  }, settle: 2500 });
  const { page, calls, errors } = env;
  assert(calls.length === 2, 'two art calls: today, then tomorrow (' + calls.length + ')');
  assert(/LESSON: The heart and blood vessels/.test(calls[0] || '') && /LESSON: Blood and the lungs/.test(calls[1] || ''), 'in that order');
  assert(maxInflight === 1, 'never two drawings in flight at once (max ' + maxInflight + ')');
  const saved = await page.evaluate(() => { const p = JSON.parse(SFStore.getItem('studyflow_plan')); return { d1: !!p.days[0].generatedArt, d2: !!(p.days[1].generatedArt && p.days[1].generatedArt.shapes) }; });
  assert(saved.d1 && saved.d2, 'both saved into the plan: ' + JSON.stringify(saved));
  // 2. open tomorrow: its picture is already there, no call spent
  const planNow = await page.evaluate(() => SFStore.getItem('studyflow_plan'));
  await env.browser.close();
  const p2 = JSON.parse(planNow); p2.days[0].completed = true;
  const env2 = await h.open({ plan: p2, mock: async () => ({ json: { result: '{"type":"none"}' } }), settle: 1500 });
  await env2.page.evaluate(() => { SFStore.setItem('studyflow_current_day', '1'); });
  await env2.page.reload(); await env2.page.waitForTimeout(1500);
  const r = await env2.page.evaluate(() => ({ di: dayIndex, art: !!lessonArt.spec }));
  assert(r.di === 1 && r.art && env2.calls.filter(c => /^Draw ONE illustration/.test(c)).length === 0, 'day 2 opens with its drawing and spends no call: ' + JSON.stringify(r) + ' calls=' + env2.calls.length);
  assert(errors.length === 0 && env2.errors.length === 0, 'no page errors ' + errors.concat(env2.errors).join(' | '));
  await env2.browser.close();
  // 3. tomorrow's call fails: nothing cached, it will be asked on entry
  let n = 0;
  const env3 = await h.open({ plan: twoDayPlan(), mock: async () => { n++; return n === 1 ? { json: { result: JSON.stringify(VALVES) } } : { abort: true }; }, settle: 2000 });
  const r3 = await env3.page.evaluate(() => { const p = JSON.parse(SFStore.getItem('studyflow_plan')); return 'generatedArt' in p.days[1]; });
  assert(r3 === false, 'a failed pre-draw caches nothing');
  await env3.browser.close();
  // 4. the skill file missing: lesson still works, local diagram stays
  const env4 = await h.open({ plan: twoDayPlan(), mock: async () => ({ json: { result: JSON.stringify(VALVES) } }) });
  await env4.page.route('**/sf-draw.js', r => r.abort());
  await env4.page.reload(); await env4.page.waitForTimeout(1200);
  const r4 = await env4.page.evaluate(() => { for (let i = 0; i < 20; i++) { if (window.currentCard && window.currentCard.type === 'lesson') break; showNextCard(); } return { sfdraw: !!window.SFDraw, art: !!document.querySelector('#lesson-art svg') }; });
  assert(!r4.sfdraw && r4.art && env4.errors.length === 0, 'without sf-draw.js the lesson card still has its local diagram: ' + JSON.stringify(r4) + ' ' + env4.errors.join('|'));
  await env4.browser.close();
  console.log(fails ? fails + ' FAILED' : 'PREDRAW OK');
})();
