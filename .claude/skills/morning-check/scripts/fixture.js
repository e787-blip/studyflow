// A science day (the heart and circulation), realistic shapes, used by every harness run.
module.exports.plan = {
  id: 'fx1', subject: 'Biology: the circulatory system', subjectType: 'science', createdAt: Date.now(),
  days: [{
    day: 1, title: 'The heart and blood vessels', microTopic: 'Biology › Circulation › How blood moves',
    content: 'The heart is a muscular pump with four chambers. The right side pumps blood to the lungs to pick up oxygen; the left side pumps oxygen-rich blood to the body. Arteries carry blood away from the heart under high pressure and have thick, elastic walls. Veins carry blood back at low pressure and have valves that stop it flowing backwards. Capillaries are one cell thick, so oxygen and nutrients can pass into the tissues.',
    steps: [
      { action: 'Blood returns to the right atrium through the veins', why: 'Veins carry blood back to the heart' },
      { action: 'The right ventricle pumps it to the lungs', why: 'It picks up oxygen and drops carbon dioxide' },
      { action: 'Oxygen-rich blood enters the left atrium', why: 'From the pulmonary veins' },
      { action: 'The left ventricle pumps it out through the aorta', why: 'Its thick wall makes the most pressure' }
    ],
    concepts: [
      { name: 'Artery', definition: 'A vessel carrying blood away from the heart', why: 'Its thick elastic wall copes with high pressure', misconception: 'All arteries carry oxygen-rich blood' },
      { name: 'Vein', definition: 'A vessel carrying blood back to the heart', why: 'Valves stop blood flowing backwards at low pressure', misconception: 'Blood in veins is blue' },
      { name: 'Capillary', definition: 'A vessel one cell thick', why: 'Thin walls let oxygen pass into tissues', misconception: '' }
    ],
    keyTerms: [
      { term: 'Atrium', definition: 'An upper chamber of the heart that receives blood' },
      { term: 'Ventricle', definition: 'A lower chamber of the heart that pumps blood out' },
      { term: 'Valve', definition: 'A flap that lets blood flow one way only' },
      { term: 'Aorta', definition: 'The largest artery, leaving the left ventricle' }
    ],
    misconceptions: [ { believe: 'Blood in your veins is blue', actually: 'It is always red; darker red when it carries less oxygen', why: 'Veins look blue through skin because of how light scatters' } ],
    questions: [
      { type: 'mcq', question: 'Why do veins need valves?', options: ['To speed blood up', 'To stop blood flowing backwards', 'To add oxygen to blood', 'To filter the blood'], correctIndex: 1, hint: 'Think about pressure in veins', explanation: 'Blood in veins is at low pressure, so valves shut behind it and stop it sliding back.', difficulty: 'medium' },
      { type: 'truefalse', question: 'The left ventricle has a thicker wall than the right ventricle.', correct: 'True', hint: '', explanation: 'The left ventricle pumps blood around the whole body, so it needs more muscle.', difficulty: 'medium' },
      { type: 'fill', question: 'The smallest blood vessels, one cell thick, are called ___.', answer: 'capillaries', hint: '', explanation: 'Capillary walls are one cell thick so oxygen can pass through.', difficulty: 'easy' },
      { type: 'sequence', question: 'Put these in the order they happen:', items: ['Right atrium', 'Right ventricle', 'Lungs', 'Left atrium'], hint: '', explanation: 'Blood goes through the right side, then the lungs, then the left side.', difficulty: 'medium' },
      { type: 'classify', question: 'Sort:', categoryA: 'Artery', categoryB: 'Vein', itemsA: ['Thick wall', 'High pressure', 'Away from heart'], itemsB: ['Has valves', 'Low pressure', 'Towards heart'], hint: '', explanation: 'Arteries carry high-pressure blood away; veins bring it back.', difficulty: 'medium' },
      { type: 'mcq', question: 'Which chamber pumps blood to the lungs?', options: ['Left atrium', 'Right ventricle', 'Left ventricle', 'Right atrium'], correctIndex: 1, hint: '', explanation: 'The right ventricle sends blood through the pulmonary artery to the lungs.', difficulty: 'medium' },
      { type: 'write', question: 'Explain how the structure of a capillary suits its job.', modelAnswer: 'Its wall is one cell thick so substances diffuse quickly.', hint: '', explanation: '', difficulty: 'hard' },
      { type: 'estimate', question: 'Roughly how many times does a resting adult heart beat in one minute?', answer: 70, tolerance: 15, unit: 'beats', hint: '', explanation: 'A resting heart rate is about 60 to 100 beats per minute.', difficulty: 'easy' }
    ],
    completed: false
  }]
};
module.exports.user = { email: 'harness@example.com', name: 'Harness', tier: 'free' };
