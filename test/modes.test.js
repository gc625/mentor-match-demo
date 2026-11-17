const test = require('node:test');
const assert = require('node:assert/strict');
const {optimize, stableMatch, blockingPairs} = require('../match.js');

const mentors = [{name:'A',preferences:['X','Y']},{name:'B',preferences:['Y','X']}];
const mentees = [{name:'X',preferences:['B','A']},{name:'Y',preferences:['A','B']}];
const pairs = result => result.matches.map(p => `${p.mentor}-${p.mentee}`).sort();

test('weighted priority chooses the favored side without changing displayed mutual scores', () => {
  const m = optimize(mentors, mentees, {priority:'mentors'});
  const t = optimize(mentors, mentees, {priority:'mentees'});
  assert.deepEqual(pairs(m), ['A-X','B-Y']);
  assert.deepEqual(pairs(t), ['A-Y','B-X']);
  assert.equal(m.totalScore, 3000);
  assert.equal(t.totalScore, 3000);
  for (const p of [...m.matches,...t.matches]) assert.equal(p.score, p.mentorScore+p.menteeScore);
});

test('deferred acceptance returns the proposer-optimal stable matching with existing result fields', () => {
  const m = stableMatch(mentors, mentees, {proposer:'mentor'});
  const t = stableMatch(mentors, mentees, {proposer:'mentee'});
  assert.deepEqual(pairs(m), ['A-X','B-Y']);
  assert.deepEqual(pairs(t), ['A-Y','B-X']);
  for (const r of [m,t]) {
    assert.deepEqual(blockingPairs(mentors,mentees,r.matches), []);
    assert.deepEqual(r.unmatchedMentors, []);
    assert.deepEqual(r.unmatchedMentees, []);
    assert.equal(r.totalScore, 3000);
    for (const p of r.matches) {
      assert.equal(p.score, p.mentorScore + p.menteeScore);
      assert.equal(p.mentorRank, mentors.find(x=>x.name===p.mentor).preferences.indexOf(p.mentee)+1);
      assert.equal(p.menteeRank, mentees.find(x=>x.name===p.mentee).preferences.indexOf(p.mentor)+1);
    }
  }
});

test('unknown mode values are rejected rather than silently changing the objective', () => {
  assert.throws(() => optimize(mentors, mentees, {priority:'mentor'}), /priority/i);
  assert.throws(() => stableMatch(mentors, mentees, {proposer:'mentors'}), /proposer/i);
});
