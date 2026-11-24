// One button in the lesson too (Nov 23, sf-buttons.css). The lesson's Next, Checks, Hint and
// Flag each had their own size, corners, glow and press (a blue pill with a soft glow that
// sank 2px). This walks a real session and measures EVERY .btn on EVERY card: 48px with 12px
// corners (40px with 10px for .btn-sm), DM Sans 15/600 (14/600 small), no shadow. It counts
// what it saw, because "no button was wrong" is also what a card with no buttons looks like.
// The answer tiles (.q-option, .tf-btn...) are not .btn on purpose and are not measured.
const h = require('./harness');
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const env = await h.open({ mock: () => ({ json: { result: '{"type":"none"}' } }) }); const p = env.page;
  const seen = {}; let cards = 0;
  for (let i = 0; i < 45; i++) {
    await p.waitForTimeout(250);
    const rows = await p.evaluate(() => [].slice.call(document.querySelectorAll('.session-card .btn')).filter(b => b.offsetWidth > 10 && b.offsetHeight > 10).map(b => {
      const cs = getComputedStyle(b);
      return { cls: b.className, h: b.offsetHeight, rad: cs.borderTopLeftRadius, fs: cs.fontSize, fw: cs.fontWeight, sh: cs.boxShadow, small: b.classList.contains('btn-sm') };
    }));
    cards++; rows.forEach(r => { seen[r.cls] = r; });
    if (await p.evaluate(() => cardIndex >= sessionCards.length - 1)) break;
    await p.evaluate(() => showNextCard());
  }
  const all = Object.keys(seen).map(k => seen[k]);
  assert(cards >= 12, 'walked ' + cards + ' cards');
  const has = c => all.some(r => r.cls.indexOf(c) > -1);
  assert(['btn-next', 'fill-submit', 'write-submit', 'hint-btn', 'btn-flag'].every(has), 'the Next, Check, Write, Hint and Flag buttons were all measured (' + all.length + ' kinds)');
  const badSize = all.filter(r => r.small ? (r.h !== 40 || r.rad !== '10px') : (r.h !== 48 || r.rad !== '12px'));
  assert(badSize.length === 0, 'every button is 48px / 12px corners, or 40px / 10px for .btn-sm' + (badSize.length ? ' - ' + badSize.map(r => r.cls + ' ' + r.h + 'px ' + r.rad).join('; ') : ''));
  const badType = all.filter(r => r.fw !== '600' || r.fs !== (r.small ? '14px' : '15px'));
  assert(badType.length === 0, 'type is 600, 15px (14px small)' + (badType.length ? ' - ' + badType.map(r => r.cls + ' ' + r.fs + '/' + r.fw).join('; ') : ''));
  assert(all.every(r => r.sh === 'none'), 'flat: no glow or shadow on any button');
  assert(all.some(r => r.cls.indexOf('fill-submit') > -1 && r.small), 'the Check inside the fill-in box is the small button');
  assert(env.errors.length === 0, 'no page errors ' + env.errors.join('|'));
  await env.browser.close();
  console.log(fails ? fails + ' FAILED' : 'BUTTONS LESSON OK');
})();
