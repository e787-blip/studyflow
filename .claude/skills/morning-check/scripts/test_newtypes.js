// The five formats of Oct 2026 - recall, selfcheck, conceptmap, whosright,
// readchart - on real page loads with api/generate mocked: the queue, each
// card answered right and wrong, the walkthroughs, the teach-it-back wording,
// escaping, skipping a malformed card, dark mode, and the plan builder's
// validators and prompt. Prints "NEWTYPES OK" when everything holds.
const h = require('./harness');
const fx = require('./fixture');
let fails = 0;
const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };

const RECALL = { type: 'recall', question: 'Name the four chambers of the heart.',
  items: ['Right atrium', 'Right ventricle', 'Left atrium', 'Left ventricle'], need: 4,
  explanation: 'Two atria receive blood; two ventricles pump it out.', difficulty: 'easy' };
const SELF = { type: 'selfcheck', question: 'In your own words: why do veins need valves?',
  ideas: ['Blood in veins is at low pressure', 'Valves close behind the blood', 'So it cannot flow backwards'],
  modelAnswer: 'Blood in veins is at low pressure, so valves shut behind it to stop it flowing backwards.',
  explanation: '', difficulty: 'medium' };
const MAP = { type: 'conceptmap', question: 'Complete the map of the circulatory system.',
  nodes: ['Heart', 'Arteries', 'Veins', 'Capillaries', 'Lungs'],
  links: [{ from: 0, to: 1, label: 'pumps blood into' }, { from: 2, to: 0, label: 'return blood to' },
          { from: 1, to: 3, label: 'branch into' }, { from: 3, to: 2, label: 'join up into' },
          { from: 0, to: 4, label: 'sends blood to' }],
  blanks: [1, 3], extra: 'Valves', explanation: 'Blood leaves in arteries and comes back in veins.', difficulty: 'medium' };
const WHO = { type: 'whosright', question: 'Why do veins look blue through your skin?',
  claims: [
    { says: 'Because blood without oxygen is blue.', right: false, why: 'Blood is always red - darker red when it carries less oxygen.' },
    { says: 'Because of how light scatters in skin; the blood itself is dark red.', right: true, why: 'Skin sends back more blue light than red from that depth.' },
    { says: 'Because vein walls are made of blue tissue.', right: false, why: 'Vein walls are not blue; light and depth change the colour you see.' }],
  explanation: 'Blood is never blue.', difficulty: 'medium' };
const CHART = { type: 'readchart',
  chart: { kind: 'line', title: 'Heart rate during a run', x: 'Minutes', y: 'Heart rate', unit: 'beats/min', data: 'example',
    points: [{ label: '0', value: 70 }, { label: '2', value: 110 }, { label: '4', value: 140 }, { label: '6', value: 155 }, { label: '8', value: 158 }, { label: '10', value: 120 }] },
  find: 'Tap the minute when the heart rate was highest.', findIndex: 4,
  question: 'Why does the heart rate rise in the first minutes of the run?',
  options: ['Working muscles need more oxygen, so the heart pumps faster', 'The blood gets thicker', 'The lungs stop working', 'The heart gets smaller'],
  correctIndex: 0, explanation: 'Muscles use more oxygen, and blood carries it.', difficulty: 'medium' };
const NEW = [RECALL, SELF, MAP, WHO, CHART];

function planWith(qs, extra) {
  const p = JSON.parse(JSON.stringify(fx.plan));
  p.id = 'nt' + Math.random();
  p.days[0].questions = p.days[0].questions.slice(0, 3).concat(JSON.parse(JSON.stringify(qs)));
  /* What a plan made today carries (app.html: subjectPalette + the schema). */
  p.days[0].allowedTypes = ['mcq', 'truefalse', 'fill', 'write', 'recall', 'selfcheck', 'conceptmap', 'whosright', 'readchart'];
  return Object.assign(p, extra || {});
}
/* Jump straight to the first practice card of a type (not a pre-test copy). */
async function toCard(page, type) {
  const ok = await page.evaluate((t) => {
    const i = sessionCards.findIndex(c => c.type === t && !c.isPretest);
    if (i < 0) return false;
    cardIndex = i;
    showNextCard();
    return !!(window.currentCard && window.currentCard.type === t);
  }, type);
  await page.waitForTimeout(60);
  return ok;
}

(async () => {
  // 1. The queue: every new question once outside the pre-test, and in the practice run.
  {
    const env = await h.open({ plan: planWith(NEW), mock: async () => ({ json: { result: '{"type":"none"}' } }) });
    const r = await env.page.evaluate(() => {
      const out = {}, pre = {};
      let practice = -1;
      sessionCards.forEach((c, i) => {
        if (!c.q) return;
        const t = c.q.type;
        if (c.isPretest) { pre[t] = (pre[t] || 0) + 1; return; }
        if (!c.isSpacedRepeat && !c.isReview) out[t] = (out[t] || 0) + 1;
      });
      const types = sessionCards.map(c => c.type);
      const firstQ = types.findIndex((t, i) => sessionCards[i].q && !sessionCards[i].isPretest);
      const lesson = types.indexOf('lesson');
      return { out, pre, firstQ, lesson, ct: sessionCards.map(c => c.type + (c.isPretest ? '(pre)' : '')).join(' > ') };
    });
    const once = ['recall', 'selfcheck', 'conceptmap', 'whosright', 'readchart'].every(t => r.out[t] === 1);
    assert(once, 'each new question is queued exactly once outside the pre-test: ' + JSON.stringify(r.out));
    assert(!r.pre.recall && !r.pre.selfcheck && !r.pre.conceptmap && !r.pre.readchart && r.pre.whosright === 1,
      'whosright is in the pre-test (it rides the main loop), the four injected formats never are: ' + JSON.stringify(r.pre));
    assert(r.firstQ > r.lesson, 'practice cards come after the lesson card');
    const types = await env.page.evaluate(() => [RECALL_WHOLE.recall, RECALL_NEVER.conceptmap, RECALL_NEVER.readchart, MOMENT_NEVER.conceptmap, MOMENT_NEVER.readchart].every(Boolean));
    assert(types, 'conceptmap and readchart are never given a second picture; recall withholds the lesson picture on any overlap');
    assert(env.errors.length === 0, 'queue: no page errors ' + env.errors.join('|'));
    await env.browser.close();
  }

  // 2. RECALL: slots, Enter moves on, a plural and a slip still count, a repeat does not.
  {
    const env = await h.open({ plan: planWith(NEW), mock: async () => ({ json: { result: '{"type":"none"}' } }) });
    const page = env.page;
    assert(await toCard(page, 'recall'), 'reached the recall card');
    const st = await page.evaluate(() => ({ slots: document.querySelectorAll('.rc-in').length, dis: document.getElementById('rc-check-btn').disabled,
      text: document.getElementById('session-card').innerText }));
    assert(st.slots === 4 && st.dis && /from memory/.test(st.text), 'four empty slots, Check waits for an answer');
    await page.fill('#rc-in-0', 'right atria');
    const moved = await page.evaluate(() => { const el = document.getElementById('rc-in-0'); el.focus();
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); return document.activeElement && document.activeElement.id; });
    assert(moved === 'rc-in-1' && !(await page.evaluate(() => currentAnswered)), 'Enter in a slot moves to the next empty slot instead of checking');
    await page.fill('#rc-in-1', 'Left Ventricles');
    await page.fill('#rc-in-2', 'leftt atrium');
    await page.fill('#rc-in-3', 'Right Atrium');
    await page.evaluate(() => checkRecall());
    const g = await page.evaluate(() => ({
      right: document.querySelectorAll('.rc-in.sel-right').length, wrong: document.querySelectorAll('.rc-in.sel-wrong').length,
      fix: Array.from(document.querySelectorAll('.rc-fix')).map(e => e.textContent), missed: document.getElementById('rc-missed').innerText,
      fb: document.getElementById('feedback-box').className, ans: wrongItems.length ? wrongItems[wrongItems.length - 1].userAns : '', next: document.getElementById('btn-next').disabled }));
    assert(g.right === 3 && g.wrong === 1, 'a plural (atria/atrium, ventricles) and a one-letter slip count; the repeat does not (' + g.right + ' right)');
    assert(g.fix.indexOf('already named') !== -1 && g.fix.some(f => /Left atrium/.test(f)), 'the repeat says "already named"; the slip shows its spelling: ' + JSON.stringify(g.fix));
    assert(/Still to learn:.*Right ventricle/.test(g.missed), 'the missed one is listed: ' + g.missed);
    assert(/wrong-fb/.test(g.fb) && /right atria/.test(g.ans) && !g.next, '3 of 4 is a miss, "Your answer" is what was typed, Next opens');
    await env.browser.close();
  }

  // 2b. RECALL on a Spanish day: accents are part of the word - one prompt, then graded.
  {
    const sp = { type: 'recall', question: 'Name three foods from the lesson, in Spanish.', items: ['el pan', 'la leche', 'el queso / queso', 'la manzana'], need: 3, explanation: '', difficulty: 'easy' };
    const plan = { id: 'es', subject: 'Spanish vocabulary: food words', subjectType: 'language', createdAt: Date.now(),
      days: [{ day: 1, title: 'La comida', content: 'el pan, la leche, el queso, la manzana', keyTerms: [], steps: [], concepts: [], questions: [sp, fx.plan.days[0].questions[0]], completed: false }] };
    const env = await h.open({ plan, mock: async () => ({ json: { result: '{"type":"none"}' } }) });
    const page = env.page;
    assert(await toCard(page, 'recall'), 'reached the Spanish recall card');
    const keys = await page.evaluate(() => document.querySelectorAll('.accent-key').length);
    await page.fill('#rc-in-0', 'pan'); await page.fill('#rc-in-1', 'la manzána'); await page.fill('#rc-in-2', 'queso');
    await page.evaluate(() => checkRecall());
    const a = await page.evaluate(() => ({ fb: document.getElementById('feedback-box').innerText, done: currentAnswered, almost: document.querySelectorAll('.rc-in.is-almost').length }));
    assert(keys > 0 && /look at the accents/i.test(a.fb) && !a.done && a.almost === 1, 'accent keys are there; an accent-only miss is one prompt, ungraded (articles optional)');
    await page.fill('#rc-in-1', 'la manzana');
    await page.evaluate(() => checkRecall());
    const b = await page.evaluate(() => ({ right: document.querySelectorAll('.rc-in.sel-right').length, fb: document.getElementById('feedback-box').className }));
    assert(b.right === 3 && /correct-fb/.test(b.fb), 'fixed, all three count');
    assert(env.errors.length === 0, 'recall: no page errors ' + env.errors.join('|'));
    await env.browser.close();
  }

  // 3. SELFCHECK: write first, then the full answer, then a yes/no per idea, with the note.
  {
    const env = await h.open({ plan: planWith(NEW), mock: async () => ({ json: { result: '{"type":"none"}' } }) });
    const page = env.page;
    assert(await toCard(page, 'selfcheck'), 'reached the selfcheck card');
    await page.fill('#sc-text', 'veins');
    const early = await page.evaluate(() => ({ dis: document.getElementById('sc-check-btn').disabled, judge: document.getElementById('sc-judge').innerHTML }));
    assert(early.dis && !early.judge, 'one word is not an explanation: Check stays off, nothing revealed');
    await page.fill('#sc-text', 'The blood in veins has low pressure so it could flow backwards without them.');
    await page.evaluate(() => scReveal(false));
    const s1 = await page.evaluate(() => ({ model: (document.querySelector('.sc-model') || {}).innerText, ideas: document.querySelectorAll('.sc-idea').length,
      ro: document.getElementById('sc-text').readOnly, done: document.getElementById('sc-done-btn').disabled }));
    assert(/low pressure/.test(s1.model) && s1.ideas === 3 && s1.ro && s1.done, 'the full answer and three ideas appear; the answer is kept, read-only; Done waits');
    await page.evaluate(() => { scMark(0, 1); scMark(1, 1); });
    const nudge = await page.evaluate(() => [document.getElementById('sc-nudge-0').textContent, document.getElementById('sc-nudge-1').textContent]);
    assert(!nudge[0] && /Valves|close|behind/.test(nudge[1]), 'a yes to an idea the answer never words gets the note, a yes to one it does gets none: ' + JSON.stringify(nudge));
    await page.evaluate(() => { scMark(1, 0); scMark(2, 1); scDone(); });
    const s2 = await page.evaluate(() => ({ fb: document.getElementById('feedback-box').innerText, cls: document.getElementById('feedback-box').className,
      had: document.querySelectorAll('.sc-idea.is-had').length, t: totalAnswered }));
    assert(/2 of 3 ideas/.test(s2.fb) && /Valves close behind/.test(s2.fb) && /wrong-fb/.test(s2.cls) && s2.had === 2, 'scored 2 of 3, a miss, naming the idea to learn');
    await env.browser.close();
    const env2 = await h.open({ plan: planWith(NEW), mock: async () => ({ json: { result: '{"type":"none"}' } }) });
    await toCard(env2.page, 'selfcheck');
    await env2.page.evaluate(() => scReveal(true));
    const g = await env2.page.evaluate(() => ({ cls: document.getElementById('feedback-box').className, yn: document.querySelectorAll('.sc-yn').length, miss: document.querySelectorAll('.sc-idea.is-missed').length, ans: wrongItems[wrongItems.length - 1].userAns }));
    assert(/wrong-fb/.test(g.cls) && g.yn === 0 && g.miss === 3 && /did not remember/.test(g.ans), '"I don\'t remember" shows the answer and the ideas, counts as a miss, no self-judging');
    assert(env.errors.length === 0 && env2.errors.length === 0, 'selfcheck: no page errors ' + env.errors.concat(env2.errors).join('|'));
    await env2.browser.close();
  }

  // 4. CONCEPTMAP: drawn, filled by tapping, graded, corrected in place, legible on a phone.
  {
    const env = await h.open({ plan: planWith(NEW), mock: async () => ({ json: { result: '{"type":"none"}' } }), width: 375 });
    const page = env.page;
    assert(await toCard(page, 'conceptmap'), 'reached the concept map');
    await page.waitForTimeout(50);
    const m = await page.evaluate(() => {
      const svg = document.querySelector('#cm-fig svg');
      const texts = Array.from(svg.querySelectorAll('text')).map(t => t.textContent);
      const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      const sizes = Array.from(svg.querySelectorAll('text')).map(t => parseFloat(t.getAttribute('font-size')) * scale);
      const boxes = Array.from(svg.querySelectorAll('rect.cm-box')).map(r => r.getBBox());
      let overlap = 0;
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height) overlap++;
      }
      const vb = svg.viewBox.baseVal, out = Array.from(svg.querySelectorAll('text')).filter(t => { const b = t.getBBox(); return b.x < -1 || b.x + b.width > vb.width + 1 || b.y < -1 || b.y + b.height > vb.height + 1; }).length;
      return { blanks: svg.querySelectorAll('.cm-blank').length, chips: document.querySelectorAll('.cm-chip').length, texts, min: Math.min.apply(null, sizes), overlap, out, w: svg.getBoundingClientRect().width };
    });
    assert(m.blanks === 2 && m.chips === 3, 'two numbered blanks and three words (two answers and the extra)');
    assert(m.texts.indexOf('Arteries') === -1 && m.texts.indexOf('Capillaries') === -1, 'the answers are not printed on the map before it is filled');
    assert(m.min >= 10.9 && m.overlap === 0 && m.out === 0, 'on a 375px phone: smallest type ' + m.min.toFixed(2) + 'px (floor 11), boxes overlapping: ' + m.overlap + ', text off the drawing: ' + m.out + ' (drawing ' + Math.round(m.w) + 'px)');
    // Fill it the wrong way round, then check.
    await page.evaluate(() => { const st = _cmState; const iC = st.bank.indexOf('Capillaries'), iA = st.bank.indexOf('Arteries'); cmPlace(iC); cmPlace(iA); });
    const filled = await page.evaluate(() => ({ dis: document.getElementById('cm-check-btn').disabled, texts: Array.from(document.querySelectorAll('#cm-fig text')).map(t => t.textContent) }));
    assert(!filled.dis && filled.texts.indexOf('Capillaries') !== -1, 'placed words show in the map, and Check opens once every blank is filled');
    await page.evaluate(() => cmCheck());
    const c = await page.evaluate(() => ({ fb: document.getElementById('feedback-box').innerText, texts: Array.from(document.querySelectorAll('#cm-fig text')).map(t => t.textContent),
      ans: wrongItems[wrongItems.length - 1].userAns, chipsOff: Array.from(document.querySelectorAll('.cm-chip')).every(b => b.disabled) }));
    assert(/0 of 2 in place/.test(c.fb) && /Heart pumps blood into Arteries/.test(c.fb), 'a wrong map is a miss and says the sentence each blank makes');
    assert(c.texts.indexOf('Arteries') !== -1 && c.texts.some(t => /not .Capillaries./.test(t)), 'each wrong blank is corrected in place, with what was put there: ' + c.texts.filter(t => /not/.test(t)).join(' | '));
    assert(/1 Capillaries/.test(c.ans) && c.chipsOff, '"Your answer" lists the placements; the bank is closed');
    // The card before it may be a whiteboard card with no .card-body to measure
    // (the walkthrough after a miss): the map must still come out 1:1.
    const after = await page.evaluate(() => new Promise(res => {
      document.getElementById('session-card').innerHTML = '<div>a whiteboard card</div>';
      cardIndex = sessionCards.findIndex(c => c.type === 'conceptmap' && !c.isPretest); showNextCard();
      setTimeout(() => { const svg = document.querySelector('#cm-fig svg'); const sc = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
        res(Math.min.apply(null, Array.from(svg.querySelectorAll('text')).map(t => parseFloat(t.getAttribute('font-size')) * sc))); }, 120);
    }));
    assert(after >= 10.9, 'after a card with nothing to measure, the map is still laid out at its real width: smallest type ' + after.toFixed(2) + 'px');
    assert(env.errors.length === 0, 'conceptmap: no page errors ' + env.errors.join('|'));
    await env.browser.close();
  }

  // 5. WHOSRIGHT: names from the app, a refutation under every bubble after the choice.
  {
    const env = await h.open({ plan: planWith(NEW), mock: async () => ({ json: { result: '{"type":"none"}' } }) });
    const page = env.page;
    assert(await toCard(page, 'whosright'), 'reached who\'s right');
    const w = await page.evaluate(() => ({ n: document.querySelectorAll('.who-say').length, names: Array.from(document.querySelectorAll('.who-name')).map(e => e.textContent),
      hidden: Array.from(document.querySelectorAll('.who-why')).every(e => e.hidden), conf: !!document.getElementById('confidence-row') }));
    assert(w.n === 3 && new Set(w.names.map(x => x[0])).size === 3 && w.hidden && w.conf, 'three classmates with different initials, refutations hidden, the confidence tap is there: ' + w.names.join(', '));
    await page.evaluate(() => whoPick(0));
    const r = await page.evaluate(() => ({ shown: Array.from(document.querySelectorAll('.who-why')).filter(e => !e.hidden).map(e => e.innerText),
      right: document.querySelectorAll('.who-say.is-right').length, wrong: document.querySelectorAll('.who-say.is-wrong').length, fb: document.getElementById('feedback-box').innerText,
      ans: wrongItems[wrongItems.length - 1].userAns, names: _whoState.names }));
    assert(r.shown.length === 3 && r.shown.some(s => /always red/.test(s)) && r.right === 1 && r.wrong === 1, 'every bubble is answered, the right one and the chosen wrong one marked');
    assert(r.fb.indexOf(r.names[1] + ' is right') !== -1 && r.ans.indexOf(r.names[0] + ':') === 0, 'the feedback names who was right; "Your answer" names who you agreed with');
    await env.browser.close();
  }

  // 6. READCHART: Part B waits for Part A; credit needs both; the values appear after.
  {
    const env = await h.open({ plan: planWith(NEW), mock: async () => ({ json: { result: '{"type":"none"}' } }), width: 375 });
    const page = env.page;
    assert(await toCard(page, 'readchart'), 'reached the chart');
    await page.waitForTimeout(50);
    const c = await page.evaluate(() => {
      const svg = document.querySelector('#rch-svg svg'), sc = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      return { pts: svg.querySelectorAll('.rch-bar').length, bHidden: document.getElementById('rch-b').hidden, ex: /Example data/.test(document.querySelector('.rch-fig').innerText),
        min: Math.min.apply(null, Array.from(svg.querySelectorAll('text')).map(t => parseFloat(t.getAttribute('font-size')) * sc)),
        vals: Array.from(svg.querySelectorAll('text')).map(t => t.textContent).indexOf('158') };
    });
    assert(c.pts === 6 && c.bHidden && c.ex && c.vals === -1, 'six tappable points, Part B hidden, labelled example data, no values printed before the tap');
    assert(c.min >= 10.5, 'chart type at 375px: smallest ' + c.min.toFixed(1) + 'px');
    await page.evaluate(() => rchTap(3));
    const a = await page.evaluate(() => ({ bHidden: document.getElementById('rch-b').hidden, vals: Array.from(document.querySelectorAll('#rch-svg text')).map(t => t.textContent), done: currentAnswered }));
    assert(!a.bHidden && a.vals.indexOf('158') !== -1 && a.vals.indexOf('155') !== -1 && !a.done, 'a wrong tap shows both values and opens Part B, still ungraded');
    await page.evaluate(() => rchChoose(0));
    const b = await page.evaluate(() => ({ fb: document.getElementById('feedback-box').innerText, cls: document.getElementById('feedback-box').className, ok: document.querySelectorAll('#rch-b .correct-ans').length }));
    assert(/wrong-fb/.test(b.cls) && /Part A: it was 8 \(158 beats\/min\)/.test(b.fb) && b.ok === 1, 'credit needs both parts; the feedback says what Part A was');
    assert(env.errors.length === 0, 'readchart: no page errors ' + env.errors.join('|'));
    await env.browser.close();
  }

  // 7. Teach-it-back wording, answers for the results list, drawings, walkthroughs.
  {
    const env = await h.open({ plan: planWith(NEW), mock: async () => ({ json: { result: '{"type":"none"}' } }) });
    const r = await env.page.evaluate((qs) => qs.map(q => {
      const mount = document.createElement('div'); document.body.appendChild(mount);
      let rendered = false, spec = null;
      try { spec = SFWhiteboard.fromWrongAnswer(q, day); rendered = !!SFWhiteboard.render(mount, spec, function () {}); } catch (e) { rendered = 'threw ' + e.message; }
      mount.remove();
      const walk = sfPicWalkFor(q);
      return { t: q.type, feyn: feynmanConcept(q), ans: correctAnswerText(q), draw: momentCanDraw(q), mAns: momentAnswer(q), rendered,
        walkRows: walk ? walk.rows.map(x => x.label) : null, walkKind: walk && walk.kind };
    }), NEW);
    const by = {}; r.forEach(x => by[x.t] = x);
    assert(by.recall.feyn === 'The chambers of the heart, and how they connect', 'recall teach-it-back is a concept: "' + by.recall.feyn + '"');
    assert(/^Why do veins need valves/.test(by.selfcheck.feyn), 'selfcheck teach-it-back drops "In your own words": "' + by.selfcheck.feyn + '"');
    assert(by.conceptmap.feyn === 'How Heart connects to the ideas around it' && !/Arteries|Capillaries/.test(by.conceptmap.feyn), 'concept map teach-it-back never names a blank: "' + by.conceptmap.feyn + '"');
    assert(/look blue/.test(by.whosright.feyn) && /Heart rate during a run/.test(by.readchart.feyn), 'whosright and readchart teach-it-backs are their concept');
    assert(/Right atrium, Right ventricle/.test(by.recall.ans) && /^1 Arteries, 2 Capillaries$/.test(by.conceptmap.ans) && /: Because of how light/.test(by.whosright.ans) && /^8 — Working muscles/.test(by.readchart.ans),
      'the results list states each answer: ' + r.map(x => x.t + '=' + x.ans).join(' | '));
    assert(!by.conceptmap.draw && !by.readchart.draw && by.recall.draw && by.selfcheck.draw && by.whosright.draw && by.whosright.mAns, '"Draw it for me" is offered on recall/selfcheck/whosright, never on the map or the chart');
    assert(r.every(x => x.rendered === true), 'every walkthrough board renders: ' + r.map(x => x.t + ':' + x.rendered).join(' '));
    assert(r.every(x => x.walkRows && x.walkRows.some(l => /answer/i.test(l)) && new Set(x.walkRows).size === x.walkRows.length),
      'every walkthrough states the answer, and no row twice: ' + r.map(x => x.t + '[' + (x.walkRows || []).join('/') + ']').join(' '));
    assert(env.errors.length === 0, 'helpers: no page errors ' + env.errors.join('|'));
    await env.browser.close();
  }

  // 8. Hostile text is text; a malformed card is skipped, not drawn broken.
  {
    const evil = '<img src=x onerror="window.__pwned=1">';
    const bad = [
      Object.assign({}, WHO, { question: 'Who? ' + evil, claims: WHO.claims.map((c, i) => Object.assign({}, c, { says: c.says + evil, why: evil })) }),
      Object.assign({}, MAP, { nodes: ['Heart' + evil, 'Arteries', 'Veins', 'Capillaries', 'Lungs'], links: MAP.links.map(l => Object.assign({}, l, { label: l.label + evil })) }),
      Object.assign({}, RECALL, { question: 'Name them ' + evil, items: RECALL.items.map(x => x + evil) }),
      { type: 'conceptmap', question: 'Broken', nodes: ['A'], links: [], blanks: [] },
      { type: 'whosright', question: 'Two right?', claims: [{ says: 'one one one', right: true }, { says: 'two two two', right: true }] },
      { type: 'readchart', chart: { points: [] }, question: '', options: [] },
      Object.assign({}, CHART, { chart: Object.assign({}, CHART.chart, { title: 'T' + evil, points: CHART.chart.points.map(p => Object.assign({}, p, { label: p.label + '<b>' })) }) })
    ];
    const env = await h.open({ plan: planWith(bad), mock: async () => ({ json: { result: '{"type":"none"}' } }) });
    const page = env.page;
    const seen = await page.evaluate(() => {
      const out = [];
      for (let i = 0; i < 60; i++) {
        const c = window.currentCard;
        if (c && c.q && /recall|conceptmap|whosright|readchart/.test(c.type)) {
          out.push(c.type + ':' + (c.q.question || '').slice(0, 10));
          try { if (c.type === 'whosright') whoPick(0); if (c.type === 'readchart') { rchTap(0); rchChoose(1); } } catch (e) { out.push('threw ' + e.message); }
        }
        if (document.getElementById('results-wrap') && document.getElementById('results-wrap').classList.contains('show')) break;
        showNextCard();
      }
      return { out, pwned: !!window.__pwned, imgs: document.querySelectorAll('#session-card img').length };
    });
    assert(!seen.pwned && seen.imgs === 0, 'model markup never runs or renders (claims, refutations, map labels, recall items, chart labels)');
    assert(!seen.out.some(x => /Broken|Two right/.test(x)) && seen.out.some(x => /^conceptmap:Complete/.test(x)) && !seen.out.some(x => /threw/.test(x)),
      'the broken map, the two-right "who\'s right" and the empty chart are skipped; the good ones are shown: ' + seen.out.join(', '));
    assert(env.errors.length === 0, 'hostile: no page errors ' + env.errors.join('|'));
    await env.browser.close();
  }

  // 9. Dark mode: the drawn cards keep a paper ground, the bubbles stay readable.
  {
    const env = await h.open({ plan: planWith(NEW), mock: async () => ({ json: { result: '{"type":"none"}' } }), dark: true });
    const page = env.page;
    await toCard(page, 'conceptmap');
    const lum = (rgb) => { const m = (rgb.match(/\d+(\.\d+)?/g) || []).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
    const fig = await page.evaluate(() => getComputedStyle(document.querySelector('.cm-fig')).backgroundColor);
    await toCard(page, 'whosright');
    const who = await page.evaluate(() => { const b = document.querySelector('.who-bub'); return [getComputedStyle(b).backgroundColor, getComputedStyle(b.querySelector('.who-txt')).color]; });
    assert(lum(fig) > 0.9, 'dark mode: the concept map sits on paper (' + lum(fig).toFixed(2) + ')');
    assert(lum(who[0]) < 0.25 && lum(who[1]) > 0.75, 'dark mode: a bubble is a dark surface with light type (' + lum(who[0]).toFixed(2) + ' / ' + lum(who[1]).toFixed(2) + ')');
    assert(env.errors.length === 0, 'dark: no page errors ' + env.errors.join('|'));
    await env.browser.close();
  }

  // 10. The plan builder: the prompt asks for them where the mixes say, the validators keep
  //     only what can be graded, and the prompt stays inside its budget.
  {
    const { chromium } = require('./pw');
    const b = await chromium.launch(); const pg = await b.newPage(); const errs = []; let pr = '';
    pg.on('pageerror', e => errs.push(e.message));
    await pg.route(/cdnjs|gstatic|googleapis|jsdelivr/, r => r.abort());
    const RAW = [
      RECALL,
      Object.assign({}, RECALL, { question: 'Name the chambers: right atrium and the rest.', items: ['Right atrium', 'Left atrium'] }),         // given away -> one left -> dropped
      Object.assign({}, RECALL, { question: 'Name three chambers of the heart.', need: 4 }),                                                  // "three" wins
      Object.assign({}, RECALL, { question: 'Name five chambers of the heart.', need: 5 }),                                                   // more than the key -> dropped
      SELF, Object.assign({}, SELF, { ideas: ['Only one idea'] }),
      MAP,
      Object.assign({}, MAP, { links: [{ from: 0, to: 1, label: 'makes' }, { from: 0, to: 3, label: 'makes' }, { from: 0, to: 2, label: 'uses' }, { from: 0, to: 4, label: 'uses' }] }), // twin blanks
      Object.assign({}, MAP, { question: 'Complete the map: arteries carry blood.' }),                                                         // leak
      Object.assign({}, MAP, { links: [{ from: 0, to: 1, label: 'pumps into' }, { from: 1, to: 3, label: 'branch into' }] }),                  // not connected
      WHO, Object.assign({}, WHO, { claims: WHO.claims.map(c => Object.assign({}, c, { right: true })) }),
      Object.assign({}, WHO, { question: 'Named?', claims: WHO.claims.map((c, i) => Object.assign({}, c, { says: ['Maya: ', 'Leo says: ', ''][i] + c.says })) }),
      Object.assign({}, CHART, { findIndex: 1 }),                                                                                             // "highest" -> re-pointed at the maximum
      Object.assign({}, CHART, { find: 'Tap the minute where the rate rose the most.' }),                                                     // a change: Part A dropped
      Object.assign({}, CHART, { chart: Object.assign({}, CHART.chart, { points: CHART.chart.points.map(p => ({ label: p.label, value: 5 })) }) }) // flat -> dropped
    ];
    await pg.route('**/api/generate', r => {
      const x = JSON.parse(r.request().postData()).prompt;
      if (/^Draw ONE/.test(x)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: '{"type":"none"}' }) });
      pr = x; const d = JSON.parse(JSON.stringify(fx.plan.days[0])); delete d.completed; d.questions = JSON.parse(JSON.stringify(RAW));
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: JSON.stringify(d) }) });
    });
    await pg.goto((process.env.SF_BASE || 'http://localhost:8765/') + 'favicon.png');
    await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('studyflow_user', JSON.stringify({ email: 'nt@t.com', tier: 'vip', grade: '7' })); });
    await pg.goto((process.env.SF_BASE || 'http://localhost:8765/') + 'app.html?cb=' + Date.now(), { waitUntil: 'load' }); await pg.waitForTimeout(300);
    await pg.evaluate(() => { document.getElementById('subject-input').value = 'Biology: the heart and circulation'; selectedGoal = 'exam'; selectedDifficulty = 'Medium';
      startGeneration('The heart has four chambers. Arteries carry blood away, veins bring it back, capillaries link them.', 1, new Date(Date.now() + 86400000).toISOString().slice(0, 10), 'vip'); });
    let qs = null;
    for (let i = 0; i < 100 && !qs; i++) { await pg.waitForTimeout(150); qs = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('sfu:nt@t.com|studyflow_plan')).days[0].questions; } catch (e) { return null; } }).catch(() => null); }
    qs = qs || [];
    const of = t => qs.filter(q => q.type === t);
    const schema = pr.slice(pr.indexOf('"completed":false,"questions":['));
    assert(/"type":"recall"/.test(schema) && /"type":"whosright"/.test(schema) && !/"type":"truefalse"/.test(schema), 'a life-science day asks for a recall and a who\'s right (in place of the true/false)');
    assert(/recall \("Name them all"\)/.test(pr) && /whosright \("Who.s right\?"\)/.test(pr) && !/conceptmap \("Complete the map"\)/.test(pr) && !/readchart \("Read the chart"\)/.test(pr),
      'the prompt explains only the new formats this day asks for');
    assert(pr.length < 50000, 'prompt ' + pr.length + ' chars, inside the 60 000 cap with room');
    const rc = of('recall');
    assert(rc.length === 2 && rc.some(q => q.need === 3 && q.items.length === 4) && rc.every(q => q.need <= q.items.length), 'recall: the given-away and the impossible are dropped; "Name three" sets need to 3');
    assert(of('selfcheck').length === 1, 'selfcheck: one idea is not a checklist - dropped');
    assert(of('conceptmap').length === 1 && of('conceptmap')[0].blanks.join() === '1,3', 'conceptmap: twin blanks, a leaked answer and a broken map are dropped; the good one kept');
    const wr = of('whosright');
    assert(wr.length === 2 && wr.every(q => q.claims.every(c => !/^(Maya|Leo)/.test(c.says))), 'whosright: two right answers are dropped; names written by the model are stripped');
    const ch = of('readchart');
    assert(ch.length === 2 && ch.some(q => q.findIndex === 4 && /highest/.test(q.find)) && ch.some(q => q.find === '' && q.question),
      'readchart: a "highest" tap is re-pointed at the real maximum; a "rose the most" tap is dropped (no single point); a flat chart is dropped');
    assert(errs.length === 0, 'plan builder: no page errors ' + errs.join('|'));
    await b.close();
  }

  console.log(fails ? fails + ' FAILED' : 'NEWTYPES OK');
})();
