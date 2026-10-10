// The flashcard deck: EVERY card turns over, not just the first. Moving to a
// card replayed fadeUp with fill-mode "both", which pinned transform at
// translateY(0) over .is-flipped's rotateY - card 1 turned, the rest never did.
const h = require('./harness');
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const env = await h.open({ mock: () => ({ json: { result: '{"type":"none"}' } }) }); const p = env.page;
  for (let i = 0; i < 8; i++) { if (await p.evaluate(() => !!document.getElementById('fc-card'))) break; await p.evaluate(() => showNextCard()); await p.waitForTimeout(200); }
  const n = await p.evaluate(() => sfDeck ? sfDeck.items.length : 0);
  assert(n >= 3, 'the deck has cards to turn (' + n + ')');
  // A rotateY of 180deg puts -1 in the matrix's first cell.
  const turned = () => p.evaluate(() => { const m = getComputedStyle(document.getElementById('fc-card')).transform; return /^matrix3d\(-0\.9/.test(m); });
  const res = [];
  for (let k = 0; k < n; k++) {
    if (k) { await p.evaluate(() => sfDeckGo(sfDeck.at + 1)); await p.waitForTimeout(450); }
    await p.click('#fc-card'); await p.waitForTimeout(750);
    const on = await turned();
    await p.click('#fc-card'); await p.waitForTimeout(750);
    res.push(on && !(await turned()));
  }
  assert(res.length === n && res.every(Boolean), 'every card turns over and back, after moving to it with the arrow (' + res.map(x => x ? 'ok' : 'STUCK').join(' ') + ')');
  await p.evaluate(() => sfDeckGo(0)); await p.waitForTimeout(450); await p.click('#fc-card'); await p.waitForTimeout(750);
  assert(await turned(), 'going back to the first card, it still turns');
  assert(env.errors.length === 0, 'no page errors ' + env.errors.join('|'));
  await env.browser.close();
  console.log(fails ? fails + ' FAILED' : 'DECK OK');
})();
