const h = require('./harness');
const fs = require('fs');
const AUDIT = fs.readFileSync(require('path').join(__dirname, '../../diagram/scripts/audit.js'), 'utf8');
const CURATED = ['brain','neuron','atom','cell','supply-demand','dna','ecosystem','water-cycle','mitosis','memory-model','plate-tectonics','photosynthesis','forces','wave','circuit','number-line','fractions','place-value','area-model','triangle','states-of-matter','solar-system','rock-cycle'];
const L = (layout, extra) => Object.assign({ type: 'custom', layout, title: 'Test ' + layout }, extra);
const SPECS = [].concat(
  CURATED.map(n => ({ name: 'curated/' + n, spec: { type: n } })),
  [
    { name: 'flow', spec: L('flow', { items: ['Light absorbed', 'Water split', 'Glucose made'] }) },
    { name: 'cycle', spec: L('cycle', { items: ['Evaporation', 'Condensation', 'Precipitation', 'Collection'] }) },
    { name: 'timeline', spec: L('timeline', { items: ['1789: Bastille', '1793: Terror', '1799: Napoleon'] }) },
    { name: 'hierarchy', spec: L('hierarchy', { items: ['Apex predator', 'Carnivores', 'Herbivores', 'Producers'] }) },
    { name: 'parts', spec: L('parts', { title: '', center: 'Flower', items: ['Petal', 'Stamen', 'Pistil', 'Sepal'] }) },
    { name: 'concept', spec: L('concept', { title: '', center: 'Democracy', items: ['Voting', 'Rights', 'Courts', 'Press'] }) },
    { name: 'compare', spec: L('compare', { left: { title: 'Mitosis', items: ['2 cells', 'Identical'] }, right: { title: 'Meiosis', items: ['4 cells', 'Varied'] } }) },
    { name: 'graph', spec: L('graph', { xLabel: 'Time', yLabel: 'Population', shape: 'scurve', items: ['Slow start', 'Rapid growth', 'Levels off'] }) },
    { name: 'bars', spec: L('bars', { items: ['Nitrogen: 78', 'Oxygen: 21', 'Argon: 0.9'] }) },
    { name: 'bars-fallback', spec: L('bars', { items: ['Nitrogen', 'Oxygen', 'Argon'] }) },
    { name: 'venn', spec: L('venn', { left: { title: 'Mitosis', items: ['2 cells'] }, right: { title: 'Meiosis', items: ['4 cells'] }, shared: ['Division'] }) },
    { name: 'venn-fallback', spec: L('venn', { left: { title: 'Mitosis', items: ['2 cells'] } }) },
    { name: 'matrix', spec: L('matrix', { xLabel: 'Firms', yLabel: 'Barriers', items: ['Monopoly', 'Oligopoly', 'Monopolistic', 'Perfect'] }) },
    { name: 'matrix-fallback', spec: L('matrix', { items: ['A', 'B'] }) },
    { name: 'long-flow', spec: L('flow', { items: ['Choose a clear position you can defend with evidence', 'Gather three pieces of evidence from reliable sources', 'Write a topic sentence for every paragraph'] }) },
    { name: 'long-cycle', spec: L('cycle', { items: ['Blood returns to the right atrium', 'Right ventricle pumps it to the lungs', 'Oxygen-rich blood enters the left atrium', 'Left ventricle pumps it out'] }) }
  ]);
const SUBJ = ['math','science','psychology','geography','economics','cs','history','english','language','general'];
(async () => {
  const { page, browser, errors } = await h.open({ mock: async () => ({ json: { result: '{"type":"none"}' } }) });
  await page.addScriptTag({ content: AUDIT });
  const res = await page.evaluate(({ SPECS, SUBJ }) => {
    const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:0;top:0;width:343px'; document.body.appendChild(host);
    const out = {};
    SPECS.forEach(e => {
      let svg = null; try { svg = generateDiagramSVG(e.spec); } catch (x) { out[e.name] = 'THREW ' + x.message; return; }
      if (!svg) { out[e.name] = 'NULL'; return; }
      host.innerHTML = svg;
      const a = SFAudit(host.querySelector('svg'), {})[0];
      const ell = Array.from(host.querySelectorAll('text')).filter(t => /…/.test(t.textContent)).length;
      out[e.name] = a.findings.filter(f => f.level !== 'info').map(f => f.level + ':' + f.code).join(',') + (ell ? ' ELLIPSIS×' + ell : '') || 'clean';
    });
    SUBJ.forEach(sj => {
      const d = { title: 'A ' + sj + ' lesson', content: 'Some content about ' + sj, steps: [{ action: 'First do this thing' }, { action: 'Then do the next thing' }, { action: 'Finally check the result' }], concepts: [{ name: 'Idea one', definition: 'x' }, { name: 'Idea two', definition: 'y' }], keyTerms: [{ term: 'Term', definition: 'z' }] };
      let dg = null; try { dg = diagramForDay(d); } catch (x) { out['day/' + sj] = 'THREW'; return; }
      out['day/' + sj] = dg && dg.svg ? 'ok' : 'NULL';
    });
    return out;
  }, { SPECS, SUBJ });
  fs.writeFileSync(process.argv[2], JSON.stringify(res, null, 1));
  console.log(errors.join('\n') || 'no page errors');
  await browser.close();
})();
