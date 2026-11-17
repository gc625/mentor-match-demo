const test = require('node:test');
const assert = require('node:assert/strict');
const {optimize, stableMatch, blockingPairs} = require('../match.js');

function enumerate(mentors, mentees) {
  const all = [];
  function visit(i, used, matches) {
    if (i === mentees.length) { all.push(matches.slice()); return; }
    visit(i+1, used, matches);
    const t = mentees[i];
    for (const m of mentors) {
      if (used.has(m.name) || !m.preferences.includes(t.name) || !t.preferences.includes(m.name)) continue;
      used.add(m.name); matches.push({mentor:m.name, mentee:t.name});
      visit(i+1, used, matches);
      matches.pop(); used.delete(m.name);
    }
  }
  visit(0, new Set(), []);
  return all;
}
function score(m, t, matches, wm, wt) {
  return matches.reduce((sum, p) => {
    const a = m.find(x=>x.name===p.mentor), b = t.find(x=>x.name===p.mentee);
    const s = (person, name) => Math.round(1000*(person.preferences.length-person.preferences.indexOf(name))/person.preferences.length);
    return sum + wm*s(a,p.mentee) + wt*s(b,p.mentor);
  }, 0);
}
function rank(person, partner) {
  return partner === undefined ? Infinity : person.preferences.indexOf(partner);
}
function isStable(m, t, matches) {
  const ma = new Map(matches.map(p=>[p.mentor,p.mentee]));
  const ta = new Map(matches.map(p=>[p.mentee,p.mentor]));
  return !m.some(a=>t.some(b=>{
    const ar=a.preferences.indexOf(b.name), br=b.preferences.indexOf(a.name);
    return ar>=0 && br>=0 && ar<rank(a,ma.get(a.name)) && br<rank(b,ta.get(b.name));
  }));
}
function compareAll(mentors, mentees, label) {
  const all = enumerate(mentors,mentees);
  const stable = all.filter(x=>isStable(mentors,mentees,x));
  assert.ok(stable.length, label);
  for (const [priority, wm, wt] of [['balanced',1,1],['mentors',2,1],['mentees',1,2]]) {
    const r = optimize(mentors,mentees,{priority});
    const bestCount = Math.max(...all.map(x=>x.length));
    const bestScore = Math.max(...all.filter(x=>x.length===bestCount).map(x=>score(mentors,mentees,x,wm,wt)));
    assert.deepEqual([r.matches.length,score(mentors,mentees,r.matches,wm,wt)], [bestCount,bestScore], `${label} ${priority}`);
    assert.deepEqual(r,optimize(mentors,mentees,{priority}), `${label} deterministic ${priority}`);
    assert.equal(r.totalScore,score(mentors,mentees,r.matches,1,1));
  }
  for (const proposer of ['mentor','mentee']) {
    const r = stableMatch(mentors,mentees,{proposer});
    assert.ok(isStable(mentors,mentees,r.matches), `${label} ${proposer} stability`);
    assert.deepEqual(blockingPairs(mentors,mentees,r.matches), []);
    assert.deepEqual(r,stableMatch(mentors,mentees,{proposer}));
    const key = proposer, other = proposer === 'mentor' ? 'mentee' : 'mentor';
    const people = proposer === 'mentor' ? mentors : mentees;
    const actual = new Map(r.matches.map(p=>[p[key],p[other]]));
    for (const candidate of stable) {
      const alternative = new Map(candidate.map(p=>[p[key],p[other]]));
      for (const person of people) assert.ok(rank(person,actual.get(person.name)) <= rank(person,alternative.get(person.name)), `${label} ${proposer} optimality`);
    }
    assert.equal(r.totalScore,score(mentors,mentees,r.matches,1,1));
  }
}

test('exhausts every strict incomplete 2x2 preference profile against every feasible matching', () => {
  const lists = ([a,b]) => [[],[a],[b],[a,b],[b,a]];
  const ml=lists(['X','Y']), tl=lists(['A','B']); let count=0;
  for (const a of ml) for (const b of ml) for (const x of tl) for (const y of tl) {
    compareAll([{name:'A',preferences:a},{name:'B',preferences:b}], [{name:'X',preferences:x},{name:'Y',preferences:y}], `profile ${count++}`);
  }
  assert.equal(count,625);
});

test('enumerates matchings in seeded unequal and empty random profiles', () => {
  let seed=317; const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
  const shuffled = values => { const v=values.slice(); for(let i=v.length-1;i>0;i--){const j=Math.floor(rand()*(i+1)); [v[i],v[j]]=[v[j],v[i]];} return v.filter(()=>rand()>.35); };
  for (let i=0;i<400;i++) {
    const m=Array.from({length:Math.floor(rand()*5)},(_,j)=>'M'+j);
    const t=Array.from({length:Math.floor(rand()*5)},(_,j)=>'T'+j);
    compareAll(m.map(name=>({name,preferences:shuffled(t)})),t.map(name=>({name,preferences:shuffled(m)})),`random ${i}`);
  }
});

test('stable match can have fewer pairs than cardinality-first optimization', () => {
  const m=[{name:'A',preferences:['X','Y']},{name:'B',preferences:['X']}];
  const t=[{name:'X',preferences:['A','B']},{name:'Y',preferences:['A']}];
  for (const proposer of ['mentor','mentee']) {
    const r=stableMatch(m,t,{proposer});
    assert.deepEqual(r.matches.map(p=>p.mentor+'-'+p.mentee),['A-X']);
    assert.deepEqual(r.unmatchedMentors,['B']);
    assert.deepEqual(r.unmatchedMentees,['Y']);
  }
  for (const priority of ['balanced','mentors','mentees']) assert.equal(optimize(m,t,{priority}).matches.length,2);
});

test('both stable modes reject invalid lists and never match one-sided edges', () => {
  for (const proposer of ['mentor','mentee']) {
    assert.throws(()=>stableMatch([{name:'A',preferences:['missing']}],[],{proposer}),/unknown person/);
    assert.throws(()=>stableMatch([{name:'A',preferences:['X','X']}],[{name:'X',preferences:['A']}],{proposer}),/Duplicate preference/);
    const r=stableMatch([{name:'A',preferences:['X']},{name:'B',preferences:[]}],[{name:'X',preferences:[]}],{proposer});
    assert.deepEqual(r.matches,[]);
    assert.deepEqual(r.unmatchedMentors,['A','B']);
    assert.deepEqual(r.unmatchedMentees,['X']);
  }
});
