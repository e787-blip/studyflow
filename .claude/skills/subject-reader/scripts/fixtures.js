// Hand-written model answers, in the NEW format (parts -> ideas). Not what a
// real model said - what a good one could say - so the tests pin the code's
// behaviour, not the model's. Real answers come from run_models.py.
const I = (claim, nature, confusedWith, core) => ({ claim, nature, confusedWith: confusedWith || '', core: !!core });
const P = (name, parent, picture, ideas) => ({ name, parent, picture, ideas });

module.exports = [
  { name: 'music theory', ctx: { localType: 'general', days: 5, subject: 'Intervals, triads and rhythm' },
    raw: { subject: 'Intervals, triads and time signatures', field: 'Music', family: 'general', tip: 'Name it, count it, then play it.', parts: [
      P('Intervals', 'Harmony', 'drawing', [
        I('An interval is the distance between two notes, counted in half steps', 'term'),
        I('A major third is four half steps and a minor third is three', 'distinction', 'That major and minor thirds are the same size', true),
        I('A perfect fifth is seven half steps', 'quantity'),
        I('To name an interval, count letter names first and then half steps', 'step', '', true)]),
      P('Triads', 'Harmony', 'parts', [
        I('A triad stacks a root, a third and a fifth', 'composition', '', true),
        I('A major triad has a major third under a minor third; a minor triad is the reverse', 'distinction', 'That major and minor triads differ in their fifth'),
        I('To build a triad, start on the root and add a third and a fifth above it', 'step')]),
      P('Time signatures', 'Rhythm', 'concept', [
        I('The top number says how many beats are in a measure', 'term'),
        I('The bottom number says which note value gets one beat', 'term'),
        I('4/4 and 3/4 feel different because the beats group differently', 'cause', '', true)])] } },

  { name: 'contract law', ctx: { localType: 'general', days: 4, subject: 'Contract formation and remedies' },
    raw: { subject: 'Contract formation and remedies', field: 'Law', family: 'general', parts: [
      P('Offer and acceptance', 'Formation', 'flow', [
        I('A contract needs an offer that is accepted on the offer\'s own terms', 'rule', '', true),
        I('An advertisement is usually an invitation to treat, not an offer', 'distinction', 'That every advertisement is a binding offer', true),
        I('A counter-offer ends the original offer', 'rule', 'That a counter-offer leaves the first offer open'),
        I('Acceptance takes effect when it is posted, under the postal rule', 'cause')]),
      P('Consideration', 'Formation', 'concept', [
        I('Consideration is something of value each side gives', 'term', '', true),
        I('Past consideration is no consideration', 'rule'),
        I('A promise to do what you are already bound to do is not consideration', 'rule', 'That any promise counts as consideration')]),
      P('Remedies', 'Breach', 'compare', [
        I('Damages aim to put the injured party where they would have been', 'cause', '', true),
        I('Specific performance orders the promise be carried out', 'term'),
        I('Damages that are too remote cannot be recovered', 'rule')])] } },

  { name: 'nursing pharmacology', ctx: { localType: 'general', days: 5, subject: 'Pharmacology basics' },
    raw: { subject: 'Nursing pharmacology', field: 'Nursing', family: 'science', parts: [
      P('Routes and absorption', 'Pharmacokinetics', 'flow', [
        I('Intravenous drugs reach the blood at once, so absorption is skipped', 'cause', '', true),
        I('Oral drugs pass through the liver first, which lowers how much arrives', 'cause', 'That an oral dose reaches the blood in full'),
        I('Bioavailability is the share of a dose that reaches the blood unchanged', 'term'),
        I('Sublingual drugs bypass the liver', 'distinction')]),
      P('Dose calculation', 'Safe administration', 'concept', [
        I('Dose ordered divided by dose on hand, times the volume, gives the amount to give', 'step', '', true),
        I('Convert units before calculating: 1 g is 1000 mg', 'step', 'That grams and milligrams can be mixed in one calculation'),
        I('Always check the answer is a sensible amount for the route', 'step')]),
      P('Drug classes', 'Safe administration', 'compare', [
        I('Beta blockers slow the heart and lower blood pressure', 'cause', '', true),
        I('ACE inhibitors end in -pril and beta blockers end in -olol', 'distinction'),
        I('Diuretics increase urine output and can lower potassium', 'cause')])] } },

  { name: 'cooking', ctx: { localType: 'general', days: 3, subject: 'Kitchen fundamentals' },
    raw: { subject: 'Kitchen fundamentals', field: 'Cooking', family: 'general', parts: [
      P('Knife cuts', 'Technique', 'drawing', [
        I('A dice is a cube cut, a julienne is a matchstick cut', 'distinction', 'That julienne and dice are the same cut', true),
        I('Even pieces cook at the same speed', 'cause', '', true),
        I('Claw grip keeps fingertips behind the knuckles', 'step'),
        I('Brunoise is the smallest dice', 'term')]),
      P('Heat methods', 'Technique', 'compare', [
        I('Dry heat methods such as roasting brown food; moist heat methods such as steaming do not', 'distinction', '', true),
        I('Browning comes from the Maillard reaction above about 140 degrees Celsius', 'cause', 'That browning is the same as burning'),
        I('A crowded pan steams food instead of browning it', 'cause'),
        I('Braising is browning first, then slow cooking in liquid', 'step')]),
      P('Seasoning', 'Flavour', 'concept', [
        I('Salt added early seasons the inside of food; salt added last seasons the surface', 'cause'),
        I('Acid brightens a dish that tastes flat', 'cause', '', true),
        I('Taste and adjust before serving', 'step')])] } },

  { name: 'driving test', ctx: { localType: 'general', days: 3, subject: 'Road rules' },
    raw: { subject: 'Road rules for the driving test', field: 'Driving', family: 'general', parts: [
      P('Right of way', 'Rules of the road', 'flow', [
        I('At a four-way stop, the vehicle that arrived first goes first', 'rule', '', true),
        I('If two vehicles arrive together, the one on the right goes first', 'rule', 'That the larger vehicle always goes first'),
        I('Pedestrians in a crosswalk always have right of way', 'rule', '', true),
        I('A flashing red light is treated as a stop sign', 'distinction', 'That a flashing red light means slow down')]),
      P('Road signs', 'Signs and signals', 'concept', [
        I('Octagonal signs mean stop', 'term'),
        I('Triangular signs mean yield', 'term'),
        I('Yellow diamond signs warn of hazards ahead', 'term'),
        I('Regulatory signs state laws; warning signs advise caution', 'distinction')]),
      P('Stopping distance', 'Speed and space', 'graph', [
        I('Stopping distance is reaction distance plus braking distance', 'composition', '', true),
        I('At 60 km/h the total stopping distance is about 36 metres on a dry road', 'quantity'),
        I('Doubling speed roughly quadruples braking distance', 'quantity', 'That doubling speed doubles braking distance', true),
        I('Wet roads lengthen braking distance', 'cause')])] } },

  { name: 'astronomy', ctx: { localType: 'general', days: 4, subject: 'The Moon, stars and planets' },
    raw: { subject: 'Intro astronomy', field: 'Astronomy', family: 'science', parts: [
      P('Phases of the Moon', 'The Moon', 'cycle', [
        I('The Moon\'s phases come from how much of its lit half we can see', 'cause', 'That the phases are caused by Earth\'s shadow', true),
        I('The phases go new, crescent, quarter, gibbous, full and back again', 'step', '', true),
        I('A lunar cycle takes about 29.5 days', 'quantity'),
        I('A lunar eclipse is the only time Earth\'s shadow falls on the Moon', 'distinction')]),
      P('Life of a star', 'Stars', 'flow', [
        I('A star forms from a collapsing cloud of gas and dust', 'step', '', true),
        I('Fusion of hydrogen into helium powers a main-sequence star', 'cause'),
        I('A star much bigger than the Sun ends as a supernova', 'cause'),
        I('The Sun will become a red giant in about five billion years', 'event')]),
      P('Planets', 'The Solar System', 'parts', [
        I('There are four rocky inner planets and four giant outer planets', 'composition', '', true),
        I('Jupiter is the largest planet, more than 300 times Earth\'s mass', 'quantity'),
        I('Venus is hotter than Mercury because its thick atmosphere traps heat', 'cause', 'That the closest planet is the hottest')])] } },

  { name: 'photosynthesis (science, local type stands)', ctx: { localType: 'science', days: 3, subject: 'Photosynthesis' },
    raw: { subject: 'Photosynthesis', field: 'Biology', family: 'history', parts: [
      P('Light reactions', 'Photosynthesis', 'drawing', [
        I('Light reactions happen in the thylakoid membranes', 'composition', '', true),
        I('Water is split to release oxygen, electrons and hydrogen ions', 'cause', 'That the oxygen comes from carbon dioxide', true),
        I('The light reactions make ATP and NADPH', 'term'),
        I('Chlorophyll absorbs red and blue light and reflects green', 'cause', 'That plants are green because they absorb green light')]),
      P('Calvin cycle', 'Photosynthesis', 'cycle', [
        I('The Calvin cycle happens in the stroma', 'composition'),
        I('Carbon dioxide is fixed into sugar using ATP and NADPH', 'step', '', true),
        I('Rubisco is the enzyme that captures carbon dioxide', 'term'),
        I('Six turns of the cycle make one glucose', 'quantity')])] } },

  { name: 'Spanish preterite', ctx: { localType: 'language', days: 3, subject: 'Spanish preterite' },
    raw: { subject: 'Spanish preterite tense', field: 'Spanish', family: 'language', parts: [
      P('Regular endings', 'Preterite', 'compare', [
        I('Regular -ar verbs take -e, -aste, -o, -amos, -aron in the preterite', 'usage', '', true),
        I('Regular -er and -ir verbs take -i, -iste, -io, -imos, -ieron', 'usage', '', true),
        I('The accent on hablo (I speak) against hablo with an accent (he spoke) changes the tense', 'distinction', 'That habló and hablo mean the same thing'),
        I('The preterite is for finished actions', 'term')]),
      P('Irregular verbs', 'Preterite', 'concept', [
        I('Ir and ser share the same preterite forms', 'usage', 'That ir and ser have different preterite forms'),
        I('Tener becomes tuv- in the preterite', 'usage')]),
      P('Time words', 'Vocabulary', 'timeline', [
        I('Ayer means yesterday and anoche means last night', 'term'),
        I('Words like ayer signal the preterite', 'cause')])] } },

  { name: 'French Revolution (history)', ctx: { localType: 'history', days: 3, subject: 'The French Revolution' },
    raw: { subject: 'The French Revolution', field: 'History', family: 'history', parts: [
      P('Causes', 'The Revolution', 'flow', [
        I('Debt from wars and a poor harvest left the crown unable to pay its bills', 'cause', '', true),
        I('The Estates General met in 1789 for the first time in 175 years', 'event', '', true),
        I('The Third Estate paid most taxes but had the least say', 'cause'),
        I('The Declaration of the Rights of Man (1789) states that all men are born free and equal', 'source', 'That the Declaration included women')]),
      P('The Terror', 'The Revolution', 'timeline', [
        I('The Committee of Public Safety ruled France from 1793', 'event'),
        I('About 17,000 people were officially executed during the Terror', 'quantity'),
        I('Robespierre fell in July 1794 and was himself guillotined', 'event', '', true),
        I('Revolutionaries justified the Terror as defending the republic', 'source')])] } }
];
