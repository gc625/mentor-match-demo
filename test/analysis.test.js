'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
let analysis;
try { analysis = require('../analysis.js'); } catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}

test('counts mutual first-choice matches', () => {
  assert.ok(analysis, 'analysis module must exist');
  const result = analysis.analyzeMatches([
    {mentor: 'Ada', mentee: 'Bea', mentorRank: 1, menteeRank: 1},
    {mentor: 'Cal', mentee: 'Dee', mentorRank: 1, menteeRank: 2}
  ]);
  assert.equal(result.mutualFirst, 1);
});

test('splits first/second and first/third by which side ranked first', () => {
  const result = analysis.analyzeMatches([
    {mentorRank: 1, menteeRank: 2}, {mentorRank: 1, menteeRank: 2},
    {mentorRank: 2, menteeRank: 1}, {mentorRank: 1, menteeRank: 3},
    {mentorRank: 3, menteeRank: 1}, {mentorRank: 3, menteeRank: 1},
    {mentorRank: 2, menteeRank: 3}
  ]);
  assert.deepEqual(result.firstSecond, {mentorFirst: 2, menteeFirst: 1});
  assert.deepEqual(result.firstThird, {mentorFirst: 1, menteeFirst: 2});
});

test('matrix uses mentor rows, mentee columns and counts every observed rank', () => {
  const result = analysis.analyzeMatches([
    {mentorRank: 1, menteeRank: 3}, {mentorRank: 1, menteeRank: 3},
    {mentorRank: 4, menteeRank: 1}, {mentorRank: 2, menteeRank: 1}
  ]);
  assert.deepEqual(result.matrix, {
    mentorRanks: [1, 2, 4], menteeRanks: [1, 3],
    counts: [[0, 2], [1, 0], [1, 0]]
  });
});

test('distributions count each side independently', () => {
  const result = analysis.analyzeMatches([
    {mentorRank: 1, menteeRank: 3}, {mentorRank: 1, menteeRank: 2},
    {mentorRank: 5, menteeRank: 2}
  ]);
  assert.deepEqual(result.mentorDistribution, [{rank: 1, count: 2}, {rank: 5, count: 1}]);
  assert.deepEqual(result.menteeDistribution, [{rank: 2, count: 2}, {rank: 3, count: 1}]);
  assert.equal(result.total, 3);
});

test('empty matching yields zero counts and empty visualizations', () => {
  const result = analysis.analyzeMatches([]);
  assert.equal(result.total, 0);
  assert.equal(result.mutualFirst, 0);
  assert.deepEqual(result.firstSecond, {mentorFirst: 0, menteeFirst: 0});
  assert.deepEqual(result.firstThird, {mentorFirst: 0, menteeFirst: 0});
  assert.deepEqual(result.matrix, {mentorRanks: [], menteeRanks: [], counts: []});
  assert.deepEqual(result.mentorDistribution, []);
  assert.deepEqual(result.menteeDistribution, []);
});

test('analyzes real optimized match objects without counting unmatched people', () => {
  const matching = require('../match.js');
  const mentors = matching.parsePeople('Name,Preferences\nAda,Bea\nCal,Dee\nEve,\n');
  const mentees = matching.parsePeople('Name,Preferences\nBea,Ada\nDee,Cal\nFay,\n');
  const result = matching.optimize(mentors, mentees);
  const stats = analysis.analyzeMatches(result.matches);
  assert.equal(result.unmatchedMentors.length, 1);
  assert.equal(result.unmatchedMentees.length, 1);
  assert.equal(stats.total, 2);
  assert.equal(stats.mutualFirst, 2);
  assert.deepEqual(stats.matrix.counts, [[2]]);
});
