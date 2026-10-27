// The data cards on real page loads of lesson.html (Oct 2026, sf-data.js):
// "The numbers" page in the lesson, Read the table as the 3rd practice
// question, Complete the table / Spot the bad graph as the 6th, each answered
// and graded; nothing on maths or on a day without numbers; hostile text
// never becomes markup. Fails on the code before (no sf-data.js, no cards).
const h = require('./harness');
const fx = require('./fixture');
let fails = 0;
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const NONE = async () => ({ json: { result: '{"type":"none"}' } });

const LUX = { title: 'Oxygen made at each light level', chart: 'line', takeaway: 'More light, more oxygen - until it levels off.',
  notice: 'From 10,000 to 20,000 lux the output barely moves.',
  cols: [{ name: 'Light', unit: 'lux' }, { name: 'O2 made', unit: 'mL/min' }],
  rows: [['1000', '0.8'], ['5000', '3.1'], ['10000', '5.9'], ['20000', '6.2']] };
const PENS = { title: 'Packs of pens', chart: 'bars', rule: { col: 2, op: 'divide', a: 1, b: 0 },
  cols: [{ name: 'Pens' }, { name: 'Total', unit: '$' }, { name: 'Per pen', unit: '$' }],
  rows: [['24', '24.00', '1.00'], ['4', '6.00', '1.50'], ['10', '12.00', '1.20']] };
const SALES = { title: 'Monthly sales', chart: 'bars', cols: [{ name: 'Month' }, { name: 'Sales', unit: '$1,000s' }],
  rows: [['April', 98], ['May', 100], ['June', 102]] };

function planWith(data, subjectType, title) {
  const p = JSON.parse(JSON.stringify(fx.plan));
  p.subjectType = subjectType || 'science';
  if (title) { p.days[0].title = title; p.subject = title; }
  if (data) p.days[0].data = data; else delete p.days[0].data;
  return p;
}
async function session(page) {
  return page.evaluate(() => {
    let n = 0;
    return sessionCards.map((c, i) => {
      const isQ = !!(c && c.q && !c.isPretest);
      if (isQ) n++;
      return { i, type: c.type, qn: isQ ? n : 0, pre: !!c.isPretest };
    });
  });
}
async function goTo(page, type) {
  return page.evaluate((t) => {
    for (let k = 0; k < 60; k++) { const c = window.currentCard; if (c && c.type === t) return true; showNextCard(); }
    return false;
  }, type);
}
async function lessonPanes(page) {
  return page.evaluate(() => {
    for (let k = 0; k < 30; k++) { const c = window.currentCard; if (c && c.type === 'lesson') break; showNextCard(); }
    return sfLesson ? sfLesson.panes.map(p => ({ label: p.label, fig: /sfd-fig/.test(p.html), svg: /<svg class="sfd-svg"/.test(p.html), table: /sfd-dt/.test(p.html) })) : null;
  });
}

(async () => {
  // ── 1. science day with numbers: the page, Read the table at question 3 ──
  {
    const { page, browser, errors } = await h.open({ plan: planWith(LUX, 'science'), mock: NONE });
    console.log('\n## science day with numbers');
    const cards = await session(page);
    const rt = cards.find(c => c.type === 'readtable');
    assert(rt && rt.qn === 3, 'Read the table is the 3rd practice question (' + (rt && rt.qn) + ')');
    assert(cards.filter(c => c.type === 'readtable').length === 1, 'exactly one Read the table');
    assert(!cards.some(c => c.pre && /table|graph/.test(c.type)), 'never in the pre-test');
    assert(!cards.some(c => c.type === 'filltable' || c.type === 'badgraph'), 'no rule and not a data day: no second data card');
    const panes = await lessonPanes(page);
    const num = panes && panes.find(p => p.label === 'The numbers');
    assert(num && num.fig && num.svg && num.table, 'the lesson has "The numbers" with a chart and its table');
    assert(panes && panes.findIndex(p => p.label === 'The numbers') === panes.findIndex(p => p.label === 'How it works') + 1, 'it comes right after "How it works"');
    // the switch
    const sw = await page.evaluate(() => {
      const idx = sfLesson.panes.findIndex(p => p.label === 'The numbers');
      sfLessonJump(idx);
      return new Promise(r => setTimeout(() => {
        const fig = document.querySelector('#session-card .sfd-fig');
        const b = fig && fig.querySelector('.sfd-seg button[data-v="table"]');
        if (!b) return r(null);
        b.click();
        r({ view: fig.getAttribute('data-view'), tableShown: getComputedStyle(fig.querySelector('.sfd-table')).display !== 'none',
            chartHidden: getComputedStyle(fig.querySelector('.sfd-chart')).display === 'none' });
      }, 500));
    });
    assert(sw && sw.view === 'table' && sw.tableShown && sw.chartHidden, 'Chart | Table switches the view');
    // answer it
    assert(await goTo(page, 'readtable'), 'reached the Read the table card');
    const r = await page.evaluate(() => {
      const st = window._dtState, key = st.q.correctIndex;
      const opts = document.querySelectorAll('#session-card .q-option');
      const before = { total: totalAnswered, right: correctCount };
      dtChoose(key === 0 ? 1 : 0);   /* a wrong answer */
      const t = document.getElementById('dt-table');
      return { opts: opts.length, lit: t.classList.contains('is-lit'), litCells: t.querySelectorAll('td.lit').length,
               addShown: t.classList.contains('has-add') === (st.q.mode === 'delta'),
               total: totalAnswered - before.total, right: correctCount - before.right,
               wrong: wrongItems.length && wrongItems[wrongItems.length - 1].userAns,
               fb: document.getElementById('feedback-box').textContent, next: !document.getElementById('btn-next').disabled };
    });
    assert(r.opts >= 2 && r.lit && r.litCells >= 2 && r.addShown, 'after the answer the evidence lights up (' + r.litCells + ' cells)');
    assert(r.total === 1 && r.right === 0 && r.wrong && r.next, 'a wrong answer is graded, logged with the words answered, and Next unlocks');
    assert(/\+2\.3|\+0\.3/.test(r.fb), 'the feedback names the steps from the table');
    assert(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await browser.close();
  }

  // ── 2. economics day with a rule: Complete the table at question 6 ──
  {
    const { page, browser, errors } = await h.open({ plan: planWith(PENS, 'economics', 'Unit price and value for money'), mock: NONE });
    console.log('\n## economics day with a rule');
    const cards = await session(page);
    const rt = cards.find(c => c.type === 'readtable'), ft = cards.find(c => c.type === 'filltable');
    assert(rt && rt.qn === 3 && ft && ft.qn === 6, 'Read the table is question 3, Complete the table question 6 (' + (rt && rt.qn) + ', ' + (ft && ft.qn) + ')');
    assert(ft && rt && ft.i - rt.i >= 3, 'at least three cards apart');
    assert(await goTo(page, 'filltable'), 'reached Complete the table');
    const f = await page.evaluate(() => {
      const ins = document.querySelectorAll('#ft-table .sfd-in');
      const btn = document.getElementById('ft-check-btn');
      const disabledBefore = btn.disabled;
      ins[0].value = '1.5'; ftInput(ins[0]);
      ins[1].value = '1.3'; ftInput(ins[1]);
      const enabled = !btn.disabled;
      ftCheck();
      return { n: ins.length, disabledBefore, enabled, right: ins[0].classList.contains('sel-right'), wrong: ins[1].classList.contains('sel-wrong'),
               fix: (document.querySelector('#ft-table .sfd-fix') || {}).textContent, rule: document.querySelector('.sfd-rule').textContent,
               said: wrongItems.length && wrongItems[wrongItems.length - 1].userAns, correct: correctAnswerText(window._ftState.q) };
    });
    assert(f.n === 2 && f.disabledBefore && f.enabled, 'two blanks; Check waits for both');
    assert(f.right && f.wrong && f.fix === '1.20', '1.5 counts as 1.50; 1.3 is crossed out with 1.20 under it');
    assert(/Per pen = Total ÷ Pens/.test(f.rule), 'the rule is written above the table');
    assert(f.said === '1.5, 1.3' && f.correct === '1.50, 1.20', 'results list: "Your answer 1.5, 1.3", "Correct 1.50, 1.20"');
    assert(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await browser.close();
  }

  // ── 3. a sales day: Spot the bad graph, and the axis falls to zero ──
  {
    const { page, browser, errors } = await h.open({ plan: planWith(SALES, 'economics', 'Reading sales data'), mock: NONE });
    console.log('\n## a sales day');
    const cards = await session(page);
    const bg = cards.find(c => c.type === 'badgraph');
    assert(bg && bg.qn === 6, 'Spot the bad graph is question 6 (' + (bg && bg.qn) + ')');
    assert(await goTo(page, 'badgraph'), 'reached Spot the bad graph');
    await page.waitForTimeout(200);   /* the chart is painted a tick after the card */
    const b = await page.evaluate(() => new Promise(res => {
      const st = window._bgState, ticks0 = Array.from(document.querySelectorAll('#bg-chart text')).map(t => t.textContent);
      bgChoose(st.q.correctIndex);
      setTimeout(() => res({ y0: st.q.y0, ticks0, y: window._bgState.y, title: document.getElementById('bg-title').textContent,
        ok: document.querySelector('#session-card .q-option.correct-ans') !== null, right: correctCount }), 2600);
    }));
    assert(b.ticks0.indexOf(String(b.y0)) !== -1, 'the cut axis prints where it starts (' + b.y0 + ')');
    assert(b.ok && b.y === 0 && b.title === 'Same numbers, axis from 0', 'after the answer the axis falls to 0 and the title says so');
    assert(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await browser.close();
  }

  // ── 4. maths, and a day with no numbers: nothing ──
  for (const [label, plan] of [['maths day with numbers', planWith(LUX, 'math', 'Algebra: linear equations')], ['science day without numbers', planWith(null, 'science')]]) {
    const { page, browser, errors } = await h.open({ plan, mock: NONE });
    console.log('\n## ' + label);
    const cards = await session(page);
    assert(!cards.some(c => /readtable|filltable|badgraph/.test(c.type)), 'no data cards');
    const panes = await lessonPanes(page);
    assert(!panes || !panes.some(p => p.label === 'The numbers'), 'no "The numbers" page');
    assert(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await browser.close();
  }

  // ── 5. hostile text never becomes markup ──
  {
    const evil = JSON.parse(JSON.stringify(SALES));
    evil.title = '<img src=x onerror="window.__pwned=1">Sales';
    evil.notice = '<script>window.__pwned=1</script>';
    evil.takeaway = '"><svg onload="window.__pwned=1">';
    evil.rows[0][0] = '<b onmouseover="window.__pwned=1">April</b>';
    evil.cols[1].name = '<iframe src="javascript:alert(1)">';
    const { page, browser, errors } = await h.open({ plan: planWith(evil, 'economics', 'Reading sales data'), mock: NONE });
    console.log('\n## hostile table');
    await lessonPanes(page);
    const x = await page.evaluate(async () => {
      const idx = sfLesson ? sfLesson.panes.findIndex(p => p.label === 'The numbers') : -1;
      if (idx >= 0) sfLessonJump(idx);
      await new Promise(r => setTimeout(r, 500));
      const a = document.querySelectorAll('#session-card img, #session-card iframe, #session-card script, #session-card [onerror], #session-card [onload], #session-card [onmouseover]').length;
      for (let k = 0; k < 60; k++) { const c = window.currentCard; if (c && /readtable|badgraph/.test(c.type)) break; showNextCard(); }
      const b = document.querySelectorAll('#session-card img, #session-card iframe, #session-card script, #session-card [onerror], #session-card [onload], #session-card [onmouseover]').length;
      return { idx, a, b, pwned: !!window.__pwned };
    });
    assert(x.idx >= 0, 'the page still shows (markup stripped, numbers kept)');
    assert(x.a === 0 && x.b === 0 && !x.pwned, 'no markup or handler reaches the page');
    assert(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await browser.close();
  }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nDATA PAGE OK');
})();
