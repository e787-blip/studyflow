// No word on a diagram is cut off (Nov 2026, the owner: "make sure that the words
// aren't cut off halfway ANYMORE"). The lesson card's converge diagram printed
// "American Revolution begins at Le…": the kit's wrap() ran out of lines and cut
// with an ellipsis, and several places chopped labels at 28, 46 or 80 letters
// first. Now every layout grows its box instead. This renders every layout with
// long labels at phone width and checks: no "…" anywhere, every word that went
// in comes out, and the audit finds no overlap or clipping.
const h = require('./harness');
const fs = require('fs');
const AUDIT = fs.readFileSync(__dirname + '/../../diagram/scripts/audit.js', 'utf8');
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const none = async () => ({ json: { result: '{"type":"none"}' } });

(async () => {
  const env = await h.open({ mock: none, settle: 1200 });
  const page = env.page;
  await page.addScriptTag({ content: AUDIT });

  const r = await page.evaluate(() => {
    const L = (layout, extra) => Object.assign({ type: 'custom', layout, title: 'T' }, extra);
    const long = 'Oxygen-rich blood leaves the left ventricle through the aorta and travels to every organ of the body before it returns';
    const cases = {
      'converge (the screenshot)': L('converge', { title: 'Five Events Leading to War', outcome: 'American Revolution begins at Lexington and Concord',
        items: ['Stamp Act (1765): direct tax without representation', 'Boston Massacre (1770): British soldiers kill colonists',
                'Boston Tea Party (1773): colonists destroy tea cargo', 'Intolerable Acts (1774): Britain punishes Massachusetts',
                'Lexington and Concord (1775): first military battle'] }),
      'converge, long causes': L('converge', { outcome: 'The French Revolution and the end of the absolute monarchy',
        items: [long, 'Bread prices doubled after two failed harvests in a row', 'Enlightenment writers questioned the divine right of kings'] }),
      'flow, sentences': L('flow', { items: [long, 'The right ventricle pumps deoxygenated blood to the lungs', 'Carbon dioxide leaves and oxygen enters'] }),
      'cycle, sentences': L('cycle', { title: 'How blood moves round the whole body and back to the heart', items: [long, 'Blood returns to the right atrium through the veins', 'The right ventricle pumps it to the lungs', 'Oxygen-rich blood enters the left atrium'] }),
      'concept, long hub': L('concept', { title: '', center: 'The causes and consequences of the Industrial Revolution in Britain', items: ['Steam engines replaced water wheels in factories', 'Cities grew as workers left farms', 'Child labour laws', 'Railways'] }),
      'concept, long hub, 5 ideas': L('concept', { title: '', center: 'The causes and consequences of the Industrial Revolution in Britain', items: ['Steam engines', 'Cities grew as workers left farms', 'Child labour laws', 'Railways', 'Coal mining'] }),
      'concept, long hub, 6 ideas': L('concept', { title: '', center: 'The causes and consequences of the Industrial Revolution in Britain', items: ['Steam engines', 'Cities grew', 'Child labour laws', 'Railways', 'Coal', 'Cotton mills'] }),
      'concept, long hub, 3 ideas': L('concept', { title: '', center: 'The causes and consequences of the Industrial Revolution in Britain', items: ['Steam engines', 'Cities grew as workers left farms', 'Railways'] }),
      'parts': L('parts', { title: '', center: 'Plant cell', items: ['Chloroplast, where photosynthesis happens', 'Cell wall made of cellulose', 'Large central vacuole', 'Nucleus'] }),
      'timeline, long events': L('timeline', { items: ['1939: Germany invades Poland and Britain and France declare war two days later', '1941: Japan attacks Pearl Harbor and the United States enters the war', '1944: Allied troops land on the beaches of Normandy', '1945: The war ends in Europe and then in the Pacific'] }),
      'compare': { type: 'custom', layout: 'compare', title: 'Mitosis and meiosis compared side by side',
        left: { title: 'Mitosis, for growth and repair of body cells', items: ['Two daughter cells identical to the parent cell', 'One division of the nucleus'] },
        right: { title: 'Meiosis, for making sex cells', items: ['Four daughter cells, each with half the chromosomes', 'Two divisions and crossing over'] } },
      'hierarchy': L('hierarchy', { items: ['Apex predators such as hawks and eagles', 'Secondary consumers that eat other animals', 'Primary consumers that eat plants', 'Producers that make their own food from sunlight'] }),
      'matrix': L('matrix', { items: ['High importance and high urgency: do it now', 'High importance, low urgency: plan it', 'Low importance, high urgency: hand it off', 'Neither: drop it'] }),
      'one huge word': L('flow', { items: ['Photophosphorylationismsuperlongwordthatnevers', 'Then', 'Done'] })
    };
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:0;top:0;width:343px';
    document.body.appendChild(host);
    const words = s => String(s).toLowerCase().replace(/[^a-z0-9()' ]+/g, ' ').split(/\s+/).filter(w => w.length > 1);
    const out = {};
    Object.keys(cases).forEach(k => {
      const sp = cases[k];
      host.innerHTML = generateDiagramSVG(sp) || '';
      const svg = host.querySelector('svg');
      if (!svg) { out[k] = { none: true }; return; }
      const texts = [...svg.querySelectorAll('text')].map(t => t.textContent);
      /* A word broken with a hyphen at a line end is joined back. */
      const all = texts.join(' ').replace(/-\s+/g, '').toLowerCase();
      const want = [].concat(sp.items || [], sp.outcome || [], sp.center || [],
        sp.left ? [sp.left.title].concat(sp.left.items) : [], sp.right ? [sp.right.title].concat(sp.right.items) : []);
      const lost = [];
      want.forEach(s => words(s).forEach(w => { if (all.indexOf(w.replace(/-/g, '')) < 0 && all.replace(/-/g, '').indexOf(w.replace(/-/g, '')) < 0) lost.push(w); }));
      const audit = SFAudit(svg, {})[0].findings.filter(f => f.level === 'fail').map(f => f.code);
      /* No label outside the blue hub may touch it (a long hub ran into its
         side ideas' names once it was allowed to grow). */
      const hub = [...svg.querySelectorAll('rect')].find(x => /^#3563e9$/i.test(x.getAttribute('fill') || ''));
      const touch = [];
      if (!hub && /concept|parts/.test(sp.layout)) touch.push('no hub found');
      if (hub && /concept|parts/.test(sp.layout)) {
        const hb = hub.getBoundingClientRect();
        svg.querySelectorAll('text').forEach(t => {
          const b = t.getBoundingClientRect();
          const inside = b.left >= hb.left - 1 && b.right <= hb.right + 1 && b.top >= hb.top - 1 && b.bottom <= hb.bottom + 1;
          if (!inside && b.right > hb.left && b.left < hb.right && b.bottom > hb.top && b.top < hb.bottom) touch.push(t.textContent);
        });
        svg.querySelectorAll('circle').forEach(c => {
          const b = c.getBoundingClientRect();
          if (b.width > 20 && b.right > hb.left && b.left < hb.right && b.bottom > hb.top && b.top < hb.bottom) touch.push('a disc');
        });
      }
      out[k] = { ell: texts.filter(t => /…|\.\.\./.test(t)), lost, audit, touch };
    });
    return out;
  });
  Object.keys(r).forEach(k => {
    const v = r[k];
    if (v.none) { assert(false, k + ': drew nothing'); return; }
    assert(!v.ell.length, k + ': no label ends in "…" ' + JSON.stringify(v.ell));
    assert(!v.lost.length, k + ': every word that went in is on the picture ' + JSON.stringify(v.lost));
    assert(!v.audit.length, k + ': audit finds no overlap or clipping ' + JSON.stringify(v.audit));
    assert(!v.touch.length, k + ': nothing runs into the hub ' + JSON.stringify(v.touch));
  });

  // The lesson card itself, built from a day like the one in the owner's screenshot.
  const d = await page.evaluate(() => {
    const day = { title: 'Evaluating the Most Important Cause of the American Revolution',
      steps: [{ title: 'Stamp Act (1765): direct tax without representation' }, { title: 'Boston Massacre (1770): British soldiers kill colonists' },
              { title: 'Boston Tea Party (1773): colonists destroy tea cargo' }, { title: 'Intolerable Acts (1774): Britain punishes Massachusetts' },
              { title: 'Lexington and Concord (1775): first military battle' }],
      diagram: { type: 'custom', layout: 'converge', title: 'Five Events Leading to War', outcome: 'American Revolution begins at Lexington and Concord',
                items: ['Stamp Act (1765): direct tax without representation', 'Boston Massacre (1770): British soldiers kill colonists',
                        'Boston Tea Party (1773): colonists destroy tea cargo', 'Intolerable Acts (1774): Britain punishes Massachusetts',
                        'Lexington and Concord (1775): first military battle'] } };
    const got = diagramForDay(day);
    const svgStr = (got && got.svg) || '';
    const host = document.createElement('div'); host.innerHTML = svgStr;
    const tx = [...host.querySelectorAll('text')].map(t => t.textContent);
    return tx;
  });
  assert(d.length > 0, 'the lesson card draws a picture for the Revolution day');
  assert(!d.some(t => /…/.test(t)), 'the lesson card prints no "…": ' + JSON.stringify(d.filter(t => /…/.test(t))));
  assert(/lexington/i.test(d.join(' ')) && /concord/i.test(d.join(' ')), 'the outcome is printed whole ' + JSON.stringify(d).slice(0, 700));

  // The whiteboard walkthrough a missed question opens: long explanations wrap, never cut.
  const wb = await page.evaluate(() => {
    const day = { title: 'Causes of the American Revolution', content: 'x' };
    const q = { type: 'mcq', question: 'Which event most directly led Parliament to pass the Intolerable Acts against the colony of Massachusetts in 1774?',
      options: ['The Boston Tea Party, when colonists destroyed a shipment of East India Company tea in Boston Harbor', 'The Stamp Act riots', 'The Boston Massacre', 'The Battle of Lexington'],
      correctIndex: 0, answer: 'The Boston Tea Party, when colonists destroyed a shipment of East India Company tea in Boston Harbor',
      explanation: 'Parliament passed the Intolerable Acts in 1774 to punish Massachusetts for the Boston Tea Party, closing Boston Harbor until the tea was paid for, cancelling the colony\'s charter, letting royal officials be tried in Britain instead, and allowing soldiers to be housed in colonists\' buildings. The Stamp Act riots and the Massacre came years earlier, and Lexington came after.' };
    const mount = document.createElement('div'); mount.style.width = '343px'; document.body.appendChild(mount);
    let ok = false;
    try { ok = !!SFWhiteboard.render(mount, SFWhiteboard.fromWrongAnswer(q, day), function () {}); } catch (e) { return { err: e.message }; }
    const texts = [...mount.querySelectorAll('text')].map(t => t.textContent);
    const all = texts.join(' ').replace(/-\s+/g, '').toLowerCase();
    return { ok, ell: texts.filter(t => /\u2026/.test(t)), harbor: /royal officials be tried in britain/.test(all) && /housed in colonists' buildings/.test(all) };
  });
  assert(wb.ok, 'the walkthrough board renders ' + JSON.stringify(wb.err || ''));
  assert(wb.ok && !wb.ell.length, 'the walkthrough prints no "…" ' + JSON.stringify(wb.ell));
  assert(wb.harbor, 'the whole "Why" sentence is on the board');

  assert(env.errors.length === 0, 'no page errors ' + env.errors.join(' | '));
  await env.browser.close();
  console.log(fails ? fails + ' FAILED' : 'NO CUT OK');
})();
