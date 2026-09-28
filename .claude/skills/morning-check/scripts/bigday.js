const F = require('./fixtures_more');
const plan = JSON.parse(JSON.stringify(F[0]));
const d = plan.days[0];
const extra = [
  ['Which vessel carries blood away from the heart?', ['Vein','Artery','Capillary','Venule'], 1, 'Arteries carry blood away from the heart under high pressure.'],
  ['What does the right atrium receive?', ['Oxygen-rich blood from the lungs','Oxygen-poor blood from the body','Blood from the aorta','Lymph'], 1, 'The right atrium receives oxygen-poor blood from the body via the vena cava.'],
  ['Where does blood pick up oxygen?', ['In the lungs','In the liver','In the stomach','In the kidneys'], 0, 'In the lung capillaries oxygen diffuses into the blood.'],
  ['Which valve stops blood flowing back into the left atrium?', ['Tricuspid','Mitral','Pulmonary','Aortic'], 1, 'The mitral (bicuspid) valve sits between the left atrium and left ventricle.'],
  ['Why are capillary walls one cell thick?', ['To hold blood pressure','So substances diffuse quickly','To pump blood','To store oxygen'], 1, 'Thin walls give a short diffusion distance.'],
  ['What does the aorta do?', ['Carries oxygen-rich blood to the body','Carries blood to the lungs','Returns blood to the heart','Pumps blood'], 0, 'The aorta is the main artery leaving the left ventricle.'],
];
extra.forEach(e => d.questions.push({ type: 'mcq', question: e[0], options: e[1], correctIndex: e[2], explanation: e[3], difficulty: 'Medium' }));
d.questions.push({ type: 'truefalse', question: 'Veins carry blood at lower pressure than arteries.', correct: 'True', explanation: 'By the time blood reaches the veins the pressure has dropped.', difficulty: 'Easy' });
d.questions.push({ type: 'fill', question: 'The ___ is the largest artery in the body.', answer: 'aorta', explanation: 'The aorta leaves the left ventricle.', difficulty: 'Easy' });
module.exports = [plan];
