const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCSV, parsePeople, optimize, blockingPairs, exportCSV } = require('../match.js');

test('imports quoted CSV lists and unquoted preference columns in order', () => {
  const people = parsePeople('Name,Preferences\r\n"Lee, Jordan","Morgan, Sam"\r\nPat,Morgan,Sam\r\n');
  assert.deepEqual(people, [{name:'Lee, Jordan', preferences:['Morgan','Sam']}, {name:'Pat', preferences:['Morgan','Sam']}]);
});

test('global optimization prioritizes cardinality over tempting first choices', () => {
  const mentors = [{name:'A', preferences:['X','Y']},{name:'B',preferences:['X']}];
  const mentees = [{name:'X',preferences:['A','B']},{name:'Y',preferences:['A']}];
  const result = optimize(mentors, mentees);
  assert.deepEqual(result.matches.map(p => `${p.mentor}-${p.mentee}`).sort(), ['A-Y','B-X']);
  assert.equal(result.matches.length, 2);
});

test('stability analysis reports mutually preferred blocking pairs without changing the optimum', () => {
  const mentors = [{name:'A', preferences:['X','Y']},{name:'B',preferences:['X']}];
  const mentees = [{name:'X',preferences:['A','B']},{name:'Y',preferences:['A']}];
  const result = optimize(mentors, mentees);
  assert.deepEqual(blockingPairs(mentors, mentees, result.matches), [{mentor:'A',mentee:'X'}]);
  assert.equal(result.matches.length, 2);
});

test('exports quoted cells and neutralizes spreadsheet formulas', () => {
  const csv = exportCSV([{mentor:'=danger', mentee:'Lee, Sam', mentorRank:1, menteeRank:2, score:1500}]);
  assert.deepEqual(parseCSV(csv), [['Mentor','Mentee','Mentor rank','Mentee rank','Pair score'],["'=danger",'Lee, Sam','1','2','1500']]);
});
