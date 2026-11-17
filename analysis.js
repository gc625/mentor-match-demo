/* Pure match analytics, shared by the browser and Node tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MentorAnalysis = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function analyzeMatches(matches) {
    const pairs = new Map();
    for (const match of matches) {
      const key = `${match.mentorRank}:${match.menteeRank}`;
      pairs.set(key, (pairs.get(key) || 0) + 1);
    }
    const count = (mentorRank, menteeRank) => pairs.get(`${mentorRank}:${menteeRank}`) || 0;
    const mentorRanks = [...new Set(matches.map(m => m.mentorRank))].sort((a, b) => a - b);
    const menteeRanks = [...new Set(matches.map(m => m.menteeRank))].sort((a, b) => a - b);
    return {
      total: matches.length,
      mutualFirst: count(1, 1),
      firstSecond: {mentorFirst: count(1, 2), menteeFirst: count(2, 1)},
      firstThird: {mentorFirst: count(1, 3), menteeFirst: count(3, 1)},
      matrix: {mentorRanks, menteeRanks, counts: mentorRanks.map(m => menteeRanks.map(t => count(m, t)))},
      mentorDistribution: mentorRanks.map(rank => ({rank, count: menteeRanks.reduce((sum, t) => sum + count(rank, t), 0)})),
      menteeDistribution: menteeRanks.map(rank => ({rank, count: mentorRanks.reduce((sum, m) => sum + count(m, rank), 0)}))
    };
  }
  return {analyzeMatches};
});
