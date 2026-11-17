const test = require('node:test');
const assert = require('node:assert/strict');
const {parseCSV, parsePeople, optimize, blockingPairs} = require('../match.js');

test('handles BOM, escaped quotes, CRLF and nested quoted comma names', () => {
  const rows = parsePeople('\uFEFFName,Preferences\r\n"O""Neil, Pat","""Lee, Alex"",Morgan"\r\n');
  assert.deepEqual(rows, [{name:'O"Neil, Pat', preferences:['Lee, Alex','Morgan']}]);
});
test('rejects malformed and duplicate input', () => {
  assert.throws(() => parseCSV('"unclosed'), /unclosed/);
  assert.throws(() => parseCSV('"ok"x'), /Malformed/);
  assert.throws(() => parsePeople('A,X\nA,Y'), /Duplicate person/);
  assert.throws(() => parsePeople('A,X,X'), /Duplicate preference/);
  assert.throws(() => parsePeople('A,"X,,Y"'), /Empty preference/);
});
test('unknown references are errors, not silently ignored', () => {
  assert.throws(() => optimize([{name:'A',preferences:['missing']}], [{name:'X',preferences:['A']}]), /unknown person/);
});
test('unranked or one-sided choices are never matched and empty sides work', () => {
  const a = [{name:'A',preferences:['X']},{name:'B',preferences:[]}];
  const b = [{name:'X',preferences:[]},{name:'Y',preferences:['B']}];
  const r = optimize(a,b);
  assert.deepEqual(r.matches, []);
  assert.deepEqual(r.unmatchedMentors, ['A','B']);
  assert.deepEqual(r.unmatchedMentees, ['X','Y']);
  assert.deepEqual(optimize([],[{name:'X',preferences:[]},{name:'Y',preferences:[]}]).unmatchedMentees, ['X','Y']);
  assert.deepEqual(optimize([],[]).matches, []);
});
test('detects no blocking pairs for a stable result', () => {
  const a = [{name:'A',preferences:['X']},{name:'B',preferences:[]}];
  const b = [{name:'X',preferences:['A']}];
  const r = optimize(a,b);
  assert.deepEqual(blockingPairs(a,b,r.matches), []);
});
test('maximizes rank score when cardinality is tied', () => {
  const a = [{name:'A',preferences:['X','Y']},{name:'B',preferences:['Y','X']}];
  const b = [{name:'X',preferences:['A','B']},{name:'Y',preferences:['B','A']}];
  const r = optimize(a,b);
  assert.equal(r.totalScore, 4000);
  assert.deepEqual(r.matches.map(x=>x.mentor+'-'+x.mentee).sort(), ['A-X','B-Y']);
});
test('shipped sample files contain 60 people with five distinct ranked choices on each side', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const mentors = parsePeople(fs.readFileSync(path.join(__dirname,'../samples/mentors.csv'),'utf8'));
  const mentees = parsePeople(fs.readFileSync(path.join(__dirname,'../samples/mentees.csv'),'utf8'));
  assert.equal(mentors.length, 60);
  assert.equal(mentees.length, 60);
  for (const person of [...mentors, ...mentees]) {
    assert.equal(person.preferences.length, 5, person.name);
    assert.equal(new Set(person.preferences).size, 5, person.name);
  }
  const result = optimize(mentors, mentees); // also checks every preference names a real person
  assert.ok(result.matches.length > 40);
  assert.ok(result.matches.some(pair => pair.mentorRank > 1 && pair.menteeRank > 1));
  assert.ok(result.matches.filter(pair => pair.mentorRank === 1 && pair.menteeRank === 1).length < 30);
});
test('Hungarian output agrees with exhaustive search across 250 seeded small instances', () => {
  let seed = 12345; const rnd = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
  function shuffle(a) { return a.map(x=>[rnd(),x]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]); }
  for (let run=0; run<250; run++) {
    const nm = Math.floor(rnd()*5), nt = Math.floor(rnd()*5);
    const namesM = Array.from({length:nm},(_,i)=>'M'+i), namesT = Array.from({length:nt},(_,i)=>'T'+i);
    const mentors = namesM.map(name=>({name,preferences:shuffle(namesT).filter(()=>rnd()>.35)}));
    const mentees = namesT.map(name=>({name,preferences:shuffle(namesM).filter(()=>rnd()>.35)}));
    let best = [-1,-1];
    function search(i, used, count, score) {
      if (i===nt) { if (count>best[0] || count===best[0] && score>best[1]) best=[count,score]; return; }
      search(i+1,used,count,score);
      for (let j=0;j<nm;j++) {
        if (used.has(j)) continue;
        const x=mentors[j].preferences.indexOf(mentees[i].name), y=mentees[i].preferences.indexOf(mentors[j].name);
        if (x<0 || y<0) continue;
        const s=Math.round(1000*(mentors[j].preferences.length-x)/mentors[j].preferences.length)+Math.round(1000*(mentees[i].preferences.length-y)/mentees[i].preferences.length);
        used.add(j); search(i+1,used,count+1,score+s); used.delete(j);
      }
    }
    search(0,new Set(),0,0);
    const result=optimize(mentors,mentees);
    assert.deepEqual([result.matches.length,result.totalScore],best,`instance ${run}`);
    assert.equal(new Set(result.matches.map(x=>x.mentor)).size,result.matches.length);
    assert.equal(new Set(result.matches.map(x=>x.mentee)).size,result.matches.length);
  }
});
