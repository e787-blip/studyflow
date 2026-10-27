// The study tutor (VIP chat), redesigned Oct 2026. What it must never do:
// show a raw asterisk (the model writes Markdown however it is asked not to,
// and "**Photosynthesis**" was printed with its stars), leak the right answer
// before the question is answered, or let Enter in the chat box advance the
// session behind it.
const h = require('./harness');
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const MD = '**Great question!** The *left ventricle* pushes blood out.\n\n### How it works\n* Blood enters the **left atrium**\n- It drops into the ventricle\n1. The valve shuts\n2) Force = 3 * 4 newtons\n\n---\nStray * here and *** there. **Unclosed bold\n> a quote\nSee [the notes](http://x.y).';
(async () => {
  const sent = []; let fail = false;
  const env = await h.open({
    mock: () => ({ json: { result: '{"type":"none"}' } }),
    routes: [['**/api/chat', async route => {
      sent.push(JSON.parse(route.request().postData() || '{}'));
      if (fail) return route.abort();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: MD }) });
    }]]
  });
  const p = env.page;

  // 1. The renderer, on its own: no star, no hash, no live markup, ever.
  const rich = await p.evaluate(() => {
    const cases = ['**bold**', '**unclosed', '*it*', '* a\n* b', '## Head', '3 * 4 and 2*x and (a+b) * c',
      'Stray * here ***', 'A\n---\nB', '[t](u)', '<img src=x onerror=alert(1)> **<script>x</script>**',
      '> q', '```\ncode * here\n```', '', '***', '**3 * 4**', '# * #'];
    return cases.map(c => {
      const d = document.createElement('div'); d.innerHTML = chatRich(c);
      const code = [].map.call(d.querySelectorAll('code'), x => x.textContent).join('');
      let txt = d.textContent; if (code) txt = txt.replace(code, '');
      return { c, txt, star: /\*/.test(txt), hash: /#/.test(txt), live: !!d.querySelector('img,script,[onerror]') };
    });
  });
  const bad = rich.filter(r => r.star || r.hash || r.live);
  assert(bad.length === 0, 'chatRich leaves no asterisk, hash or live markup in ' + rich.length + ' cases' + (bad.length ? ' - ' + JSON.stringify(bad) : ''));
  const times = rich.find(r => /^3 \* 4/.test(r.c));
  assert(times && /3 × 4/.test(times.txt) && /2 × x/.test(times.txt) && /\(a\+b\) × c/.test(times.txt), 'a times sign between operands: ' + (times && times.txt));
  const prose = rich.find(r => /^Stray/.test(r.c));
  assert(prose && !/×/.test(prose.txt), 'a stray star in prose is dropped, not made a times sign: ' + (prose && prose.txt));

  // 2. Reach a multiple-choice question that has not been answered.
  for (let i = 0; i < 14; i++) {
    const ok = await p.evaluate(() => !!(window.currentCard && window.currentCard.q && document.querySelector('#session-card .q-option')) && !currentAnswered);
    if (ok) break;
    await p.evaluate(() => showNextCard()); await p.waitForTimeout(250);
  }
  const q = await p.evaluate(() => { const q = window.currentCard.q; return { question: q.question, right: q.options[q.correctIndex] }; });
  await p.evaluate(() => toggleChat(true)); await p.waitForTimeout(500);
  const before = await p.evaluate(() => ({
    open: chatOpen, empty: document.getElementById('chat-panel').classList.contains('is-empty'),
    ctx: chatScene().label, chips: [].map.call(document.querySelectorAll('.chat-chip'), b => b.textContent)
  }));
  assert(before.open && before.empty, 'the panel opens on its empty state');
  assert(before.chips.some(c => /hint/i.test(c)), 'an unanswered question offers a hint: ' + before.chips.join(' | '));
  assert(!before.chips.some(c => c.toLowerCase().indexOf(q.right.toLowerCase()) >= 0), 'no suggestion names the right answer before it is answered');

  // 3. Send by Enter in the box: the card behind does not move, and the
  //    request carries the question but never its answer.
  const cardBefore = await p.evaluate(() => cardIndex);
  await p.evaluate(() => { const i = document.getElementById('chat-input'); i.focus(); i.value = 'help'; i.dispatchEvent(new Event('input')); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); });
  await p.waitForTimeout(900);
  const afterEnter = await p.evaluate(() => ({ at: cardIndex, answered: currentAnswered, sent: chatHistory.length }));
  assert(afterEnter.at === cardBefore && !afterEnter.answered && afterEnter.sent >= 1, 'Enter in the chat box sends, and does not answer or advance the card');
  const c0 = sent[0] && sent[0].context;
  assert(c0 && c0.screen === 'question' && c0.currentQuestion === q.question, 'the request names the question on screen');
  assert(c0 && c0.answered === false && !c0.rightAnswer && JSON.stringify(c0).toLowerCase().indexOf(q.right.toLowerCase()) < 0, 'and carries no answer before it is answered');
  const shown = await p.evaluate(() => { const m = document.querySelectorAll('.chat-msg.ai:not(.chat-thinking)'); const l = m[m.length - 1]; return { txt: l.textContent, lists: l.querySelectorAll('ul li, ol li').length, strong: l.querySelectorAll('strong').length }; });
  assert(!/\*/.test(shown.txt) && !/#/.test(shown.txt), 'a Markdown reply is shown with no asterisk or hash');
  assert(shown.lists >= 4 && shown.strong >= 2, 'its bullets, numbers and bold become real markup (' + shown.lists + ' items, ' + shown.strong + ' bold)');

  // 4. Answer it wrong: the next request knows what was answered and what was right.
  await p.evaluate(() => {
    const conf = document.querySelector('#session-card .conf-btn'); if (conf) conf.click();
    const q = window.currentCard.q;
    const opts = [].slice.call(document.querySelectorAll('#session-card .q-option'));
    const wrong = opts.filter(b => b.textContent.indexOf(q.options[q.correctIndex]) < 0)[0];
    wrong.click();
  });
  await p.waitForTimeout(900);
  const after = await p.evaluate(() => [].map.call(document.querySelectorAll('.chat-chip'), b => b.textContent));
  assert(after.some(c => /wrong/i.test(c)), 'after a miss it offers to explain it: ' + after.join(' | '));
  await p.evaluate(() => sendChat('Why was my answer wrong?')); await p.waitForTimeout(900);
  const c1 = sent[sent.length - 1].context;
  assert(c1.answered === true && c1.correct === false && c1.rightAnswer === q.right && c1.yourAnswer && c1.yourAnswer !== q.right, 'after a miss the request has their answer and the right one (' + c1.yourAnswer + ' / ' + c1.rightAnswer + ')');
  assert(!(await p.evaluate(() => [].map.call(document.querySelectorAll('.chat-chip'), b => b.textContent))).includes('Why was my answer wrong?'), 'a suggestion just asked is not offered again');

  // 5. A failed call says so, offers Try again, and the retry works.
  fail = true;
  await p.evaluate(() => sendChat('One more')); await p.waitForTimeout(800);
  assert(await p.evaluate(() => !!document.querySelector('.chat-msg.err .chat-retry')), 'a failed call shows Try again');
  fail = false;
  await p.evaluate(() => document.querySelector('.chat-retry').click()); await p.waitForTimeout(900);
  assert(await p.evaluate(() => !document.querySelector('.chat-msg.err') && chatHistory[chatHistory.length - 1].role === 'assistant'), 'Try again sends it and the reply arrives');

  // 6. Escape closes and hands focus back; dark mode keeps legible text.
  await p.evaluate(() => { document.getElementById('chat-input').focus(); document.getElementById('chat-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  await p.waitForTimeout(300);
  assert(await p.evaluate(() => !chatOpen && !document.getElementById('chat-panel').contains(document.activeElement)), 'Escape closes it and focus leaves the panel');
  const dark = await p.evaluate(() => { document.body.classList.add('dark'); toggleChat(true); const m = document.querySelector('.chat-msg.ai:not(.chat-thinking)'); const c = getComputedStyle(m).color.match(/\d+/g).map(Number); return (c[0] + c[1] + c[2]) / 3; });
  assert(dark > 200, 'dark mode: reply text is light (' + Math.round(dark) + ')');
  assert(env.errors.length === 0, 'no page errors ' + env.errors.join('|'));
  await env.browser.close();
  console.log(fails ? fails + ' FAILED' : 'CHAT OK');
})();
