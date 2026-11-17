/* Pure, dependency-free matching engine; also usable in Node tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MentorMatch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function parseCSV(text) {
    text = String(text).replace(/^\uFEFF/, '');
    const rows = []; let row = [], field = '', quoted = false, closed = false, start = true;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
        else field += c;
      } else if (c === '"' && start) { quoted = true; start = false; }
      else if (c === ',') { row.push(field); field = ''; start = true; closed = false; }
      else if (c === '\n' || c === '\r') { row.push(field); rows.push(row); row = []; field = ''; start = true; closed = false; if (c === '\r' && text[i+1] === '\n') i++; }
      else { if (closed || c === '"') throw new Error('Malformed CSV: unexpected character after quote or quote inside unquoted field.'); field += c; start = false; }
    }
    if (quoted) throw new Error('Malformed CSV: unclosed quoted field.');
    if (field !== '' || row.length || closed) { row.push(field); rows.push(row); }
    return rows;
  }
  function parsePeople(text) {
    const rows = parseCSV(text).filter(row => row.some(cell => cell.trim()));
    if (rows.length && /^(name|person|mentor|mentee)$/i.test(rows[0][0].trim()) && /^(preferences?|ranked preferences?|choices?)$/i.test((rows[0][1] || '').trim())) rows.shift();
    const names = new Set();
    return rows.map((row, i) => {
      const name = row[0].trim();
      if (!name) throw new Error(`Row ${i+1}: name is required.`);
      if (names.has(name)) throw new Error(`Duplicate person: ${name}.`);
      names.add(name);
      const preferences = [];
      for (const cell of row.slice(1)) {
        if (!cell.trim()) continue;
        const nested = parseCSV(cell);
        if (nested.length !== 1) throw new Error(`Invalid preference list for ${name}.`);
        for (const item of nested[0]) { const value = item.trim(); if (!value) throw new Error(`Empty preference for ${name}.`); if (preferences.includes(value)) throw new Error(`Duplicate preference ${value} for ${name}.`); preferences.push(value); }
      }
      return {name, preferences};
    });
  }
  function validate(mentors, mentees) {
    for (const [people, other, label] of [[mentors, mentees, 'mentor'], [mentees, mentors, 'mentee']]) {
      const names = new Set(), valid = new Set(other.map(p => p.name));
      for (const p of people) {
        if (!p.name || names.has(p.name)) throw new Error(`Invalid or duplicate ${label} name: ${p.name}.`);
        names.add(p.name);
        const seen = new Set();
        for (const pref of p.preferences) {
          if (!valid.has(pref)) throw new Error(`${p.name} lists unknown person: ${pref}. Check spelling and both files.`);
          if (seen.has(pref)) throw new Error(`Duplicate preference ${pref} for ${p.name}.`);
          seen.add(pref);
        }
      }
    }
  }
  // Hungarian algorithm for rectangular matrices (rows <= columns), minimizing cost.
  function assignment(cost) {
    const n = cost.length; if (!n) return [];
    const m = cost[0].length, u = Array(n+1).fill(0), v = Array(m+1).fill(0), p = Array(m+1).fill(0), way = Array(m+1).fill(0);
    for (let i=1; i<=n; i++) {
      p[0] = i; let j0 = 0; const min = Array(m+1).fill(Infinity), used = Array(m+1).fill(false);
      do {
        used[j0] = true; const i0 = p[j0]; let delta = Infinity, j1 = 0;
        for (let j=1; j<=m; j++) if (!used[j]) {
          const cur = cost[i0-1][j-1] - u[i0] - v[j];
          if (cur < min[j]) { min[j] = cur; way[j] = j0; }
          if (min[j] < delta) { delta = min[j]; j1 = j; }
        }
        for (let j=0; j<=m; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else min[j] -= delta;
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0 !== 0);
    }
    const result = Array(n).fill(-1); for (let j=1; j<=m; j++) if (p[j]) result[p[j]-1] = j-1;
    return result;
  }
  function optimize(mentors, mentees) {
    validate(mentors, mentees);
    const bonus = 2000 * Math.min(mentors.length, mentees.length) + 1;
    const edges = mentees.map(mentee => mentors.map(mentor => {
      const mi = mentor.preferences.indexOf(mentee.name), ti = mentee.preferences.indexOf(mentor.name);
      if (mi < 0 || ti < 0) return null;
      const mentorScore = Math.round(1000 * (mentor.preferences.length - mi) / mentor.preferences.length);
      const menteeScore = Math.round(1000 * (mentee.preferences.length - ti) / mentee.preferences.length);
      return {mentor: mentor.name, mentee: mentee.name, mentorRank: mi+1, menteeRank: ti+1, mentorScore, menteeScore, score: mentorScore+menteeScore};
    }));
    const cost = edges.map(row => row.map(edge => edge ? -(bonus + edge.score) : 1).concat(Array(mentees.length).fill(0)));
    const chosen = assignment(cost), matches = [];
    chosen.forEach((j,i) => { if (j < mentors.length && edges[i][j]) matches.push(edges[i][j]); });
    const usedM = new Set(matches.map(p => p.mentor)), usedT = new Set(matches.map(p => p.mentee));
    return {matches, unmatchedMentors: mentors.filter(p => !usedM.has(p.name)).map(p => p.name), unmatchedMentees: mentees.filter(p => !usedT.has(p.name)).map(p => p.name), totalScore: matches.reduce((sum,p) => sum+p.score, 0)};
  }
  function blockingPairs(mentors, mentees, matches) {
    validate(mentors, mentees);
    const assignedM = new Map(matches.map(p => [p.mentor,p.mentee]));
    const assignedT = new Map(matches.map(p => [p.mentee,p.mentor]));
    const result = [];
    for (const mentor of mentors) for (const mentee of mentees) {
      const mi = mentor.preferences.indexOf(mentee.name), ti = mentee.preferences.indexOf(mentor.name);
      if (mi < 0 || ti < 0 || assignedM.get(mentor.name) === mentee.name) continue;
      const currentM = assignedM.has(mentor.name) ? mentor.preferences.indexOf(assignedM.get(mentor.name)) : Infinity;
      const currentT = assignedT.has(mentee.name) ? mentee.preferences.indexOf(assignedT.get(mentee.name)) : Infinity;
      if (mi < currentM && ti < currentT) result.push({mentor: mentor.name, mentee: mentee.name});
    }
    return result;
  }
  function exportCSV(matches) {
    const cell = value => {
      let s = String(value);
      if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    return [['Mentor','Mentee','Mentor rank','Mentee rank','Pair score'], ...matches.map(p => [p.mentor,p.mentee,p.mentorRank,p.menteeRank,p.score])].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
  }
  return {parseCSV, parsePeople, optimize, blockingPairs, exportCSV};
});
