const base = require('./fixture').plan;
function plan(id, subject, subjectType, day) { return { id, subject, subjectType, createdAt: Date.now(), days: [Object.assign({ day: 1, completed: false }, day)] }; }
module.exports = [
  base,
  plan('m1', 'Algebra', 'math', {
    title: 'Solving two-step equations', content: 'To solve 2x + 3 = 11, undo the addition first, then the multiplication.',
    steps: [{ action: 'Subtract 3 from both sides' }, { action: 'Divide both sides by 2' }],
    keyTerms: [{ term: 'Variable', definition: 'A letter standing for a number' }],
    questions: [
      { type: 'bigequation', question: 'Solve for x', equation: '2x + 3 = 11', answer: '4', explanation: 'Subtract 3, then divide by 2.', difficulty: 'Medium' },
      { type: 'bigequation', question: 'Solve for x', equation: '3x - 4 = 11', answer: '5', explanation: 'Add 4, then divide by 3.', difficulty: 'Medium' },
      { type: 'wordproblem', scenario: 'A taxi charges $3 plus $2 per mile. The fare was $11.', question: 'How many miles?', steps: [{ prompt: 'Subtract the fixed charge', answer: '8', unit: '$' }, { prompt: 'Now use {1} to find the miles', answer: '4', unit: 'miles' }], answer: '4', explanation: '11 - 3 = 8, 8 / 2 = 4.', difficulty: 'Medium' },
      { type: 'errorspot', question: 'Find the mistake:', steps: [{ text: '2x + 3 = 11', hasError: false }, { text: '2x = 14', hasError: true }, { text: 'x = 7', hasError: false }], explanation: 'Subtracting 3 gives 8, not 14.', difficulty: 'Hard' }
    ] }),
  plan('h1', 'The French Revolution', 'history', {
    title: 'Causes of the French Revolution', content: 'Debt, hunger and the ideas of the Enlightenment pushed France to revolution in 1789.',
    concepts: [{ name: 'Third Estate', definition: 'Everyone who was not clergy or nobility', why: 'They paid most of the taxes' }],
    keyTerms: [{ term: 'Estates-General', definition: 'An assembly of the three estates' }],
    questions: [
      { type: 'mcq', question: 'Which estate paid most of the taxes?', options: ['First', 'Second', 'Third', 'None'], correctIndex: 2, explanation: 'The Third Estate carried the tax burden.', difficulty: 'Easy' },
      { type: 'passage', questionType: 'sourcing', passage: 'A pamphlet from 1789: What is the Third Estate? Everything. What has it been until now? Nothing.', question: 'What is the author arguing?', options: ['The Third Estate deserves power', 'The king is wise', 'Taxes are fair', 'Nobles work hardest'], correctIndex: 0, explanation: 'Sieyes argues the Third Estate is the nation.', difficulty: 'Medium' },
      { type: 'truefalse', question: 'The Bastille was stormed in 1789.', correct: 'True', explanation: 'On 14 July 1789.', difficulty: 'Easy' },
      { type: 'sequence', question: 'Put these in the order they happen:', items: ['Estates-General meets', 'Tennis Court Oath', 'Storming of the Bastille', 'Declaration of the Rights of Man'], explanation: 'May, June, July, August 1789.', difficulty: 'Medium' }
    ] }),
  plan('l1', 'Spanish food words', 'language', {
    title: 'Food and the kitchen', content: 'Spanish words for food and kitchen objects.',
    keyTerms: [{ term: 'la cocina', definition: 'the kitchen' }, { term: 'el pan', definition: 'bread' }],
    questions: [
      { type: 'sentence', question: 'Build: I eat bread', words: ['Yo', 'como', 'pan'], translation: 'Yo como pan', explanation: 'Subject, verb, object.', difficulty: 'Easy' },
      { type: 'fill', question: 'The kitchen is la ___.', answer: 'cocina', explanation: 'la cocina = the kitchen', difficulty: 'Easy' },
      { type: 'mcq', question: 'What does "el pan" mean?', options: ['bread', 'kitchen', 'milk', 'apple'], correctIndex: 0, explanation: 'el pan is bread.', difficulty: 'Easy' }
    ] })
];
