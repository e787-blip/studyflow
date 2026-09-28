// Walk every card of a real session, answering WRONG wherever possible. Any page
// error, any blank card, any offer before answering, or an offer on an excluded
// type is a failure.
const h = require('./harness');
const FX = require('./fixtures_more');
let fails = 0;
const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  for (const plan of FX) {
    const env = await h.open({ plan, mock: async (p) => ({ json: { result: '{"type":"none"}' } }) });
    const { page, errors } = env;
    const log = [];
    for (let i = 0; i < 45; i++) {
      const info = await page.evaluate(() => {
        const c = window.currentCard, sc = document.getElementById('session-card');
        const res = document.getElementById('results-wrap');
        return { type: c && c.type, qt: c && c.q && c.q.type, pre: !!(c && c.isPretest), rep: !!(c && c.isSpacedRepeat),
                 blank: !sc || sc.innerText.trim().length < 5, offerBefore: !!document.querySelector('#session-card .sf-moment'),
                 done: !!(res && res.classList.contains('show')) };
      });
      if (info.done) break;
      if (info.blank && info.type && !/^sfwb/.test(info.type)) assert(false, plan.subjectType + ' card ' + i + ' (' + info.type + ') is blank');
      let offered = null;
      if (info.qt) {
        if (info.offerBefore) assert(false, plan.subjectType + ' ' + info.type + ': drawing offered BEFORE answering');
        const acted = await page.evaluate(() => {
          const wrongOpt = Array.from(document.querySelectorAll('.q-option')).find(x => { const m = /answerMCQ\(this,(\d+),(\d+)/.exec(x.getAttribute('onclick') || ''); return m && m[1] !== m[2]; });
          if (wrongOpt) { wrongOpt.click(); return 'mcq'; }
          const tf = Array.from(document.querySelectorAll('.tf-btn')).find(x => { const n = /answerTF\(this,'(\w+)','(\w+)'/.exec(x.getAttribute('onclick') || ''); return n && n[1] !== n[2]; });
          if (tf) { tf.click(); return 'tf'; }
          const fi = document.getElementById('fill-input');
          if (fi) { fi.value = 'zzzz'; const b = document.getElementById('fill-btn'); if (b) b.click(); if (b) b.click(); return 'fill'; }
          const sw = document.getElementById('seq-wrap');
          if (sw) { Array.from(sw.querySelectorAll('.seq-item')).reverse().forEach(x => sw.appendChild(x)); const b = document.getElementById('seq-check-btn'); if (b) b.click(); return 'seq'; }
          const es = document.querySelector('.error-step-btn');
          if (es) { const w = Array.from(document.querySelectorAll('.error-step-btn')).find(b => (b.getAttribute('onclick') || '').indexOf('false') !== -1); (w || es).click(); return 'errorspot'; }
          return 'skip';
        });
        await page.waitForTimeout(150);
        offered = await page.evaluate(() => { const hh = document.querySelector('#session-card .sf-moment'); return hh ? hh.getAttribute('data-state') : null; });
        log.push(info.type + '/' + info.qt + (info.pre ? '(pre)' : '') + (info.rep ? '(retry)' : '') + ':' + acted + '->' + (offered || '-'));
        if (offered && (info.pre || ['write', 'bigequation', 'sentence', 'labeldiagram', 'graph', 'matchpairs', 'match', 'tracetable'].indexOf(info.qt) !== -1 || ['write', 'bigequation', 'sentence', 'labeldiagram'].indexOf(info.type) !== -1))
          assert(false, plan.subjectType + ' offered on excluded ' + info.type + '/' + info.qt);
      } else log.push(info.type);
      await page.evaluate(() => { try { showNextCard(); } catch (e) { console.error('showNextCard threw ' + e.message); } });
      await page.waitForTimeout(120);
    }
    await page.evaluate(() => { if (!document.getElementById('results-wrap').classList.contains('show')) endSession(); });
    await page.waitForTimeout(400);
    const res = await page.evaluate(() => ({ items: document.querySelectorAll('#results-wrap .wrong-item').length, missed: wrongItems.length, slots: document.querySelectorAll('#results-wrap .sf-moment').length }));
    console.log('\n[' + plan.subjectType + '] ' + log.join('  '));
    console.log('   results: ' + JSON.stringify(res));
    assert(errors.length === 0, plan.subjectType + ': no page errors' + (errors.length ? ' -> ' + errors.join(' | ') : ''));
    await env.browser.close();
  }
  console.log(fails ? fails + ' FAILED' : 'WALK CLEAN');
})();
