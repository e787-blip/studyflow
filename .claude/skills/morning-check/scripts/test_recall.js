const h = require('./harness');
const plan = { id: 'c1', subject: 'Cell biology', subjectType: 'science', days: [{ day: 1, completed: false, title: 'Inside an animal cell', diagram: { type: 'cell', cellType: 'animal' },
  content: 'An animal cell has a nucleus, mitochondria, ribosomes and a cell membrane.',
  keyTerms: [{ term: 'Nucleus', definition: 'Holds the DNA' }, { term: 'Ribosome', definition: 'Makes proteins' }],
  questions: [
    { type: 'mcq', question: 'What does the mitochondrion do?', options: ['Releases energy from glucose', 'Stores DNA', 'Makes fat', 'Moves the cell'], correctIndex: 0, explanation: 'Respiration happens there.', difficulty: 'Medium' },
    { type: 'fill', question: 'The powerhouse of the cell is the ___.', answer: 'mitochondrion', explanation: 'It releases energy.', difficulty: 'Easy' },
    { type: 'mcq', question: 'Who first saw cells under a microscope?', options: ['Robert Hooke', 'Isaac Newton', 'Marie Curie', 'Charles Darwin'], correctIndex: 0, explanation: 'Hooke in 1665.', difficulty: 'Easy' }
  ] }] };
(async () => {
  const { page, browser, errors } = await h.open({ plan, mock: async () => ({ json: { result: '{"type":"none"}' } }) });
  const r = await page.evaluate(() => {
    const out = {};
    day.questions.forEach(q => { const x = recallFor({ type: cardTypeFor(q), q }); out[q.question.slice(0, 32)] = x ? { before: x.before, afterMiss: x.afterMiss } : null; });
    out.picWords = (lessonPicture() || {}).words;
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  const ok = r['What does the mitochondrion do?'].before === true && r['What does the mitochondrion do?'].afterMiss === true
    && r['The powerhouse of the cell is th'].before === false && r['The powerhouse of the cell is th'].afterMiss === true
    && r['Who first saw cells under a micr'].afterMiss === false;
  console.log(ok ? 'PASS recall: relevant question gets it, answer-label withheld before / shown after, unrelated gets nothing' : 'FAIL recall expectations');
  console.log(errors.join('\n') || 'no page errors');
  await browser.close();
})();
