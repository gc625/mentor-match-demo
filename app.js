(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const sample = {
    mentor: `Name,Preferences\nAmira Patel,"Sofia Reyes, Julian Park, Maya Chen"\nDaniel Brooks,"Noah Kim, Priya Shah, Sofia Reyes"\nElena Rossi,"Maya Chen, Leah Morgan, Priya Shah"\nMarcus Lee,"Julian Park, Theo Grant, Noah Kim"\nNadia Okafor,"Priya Shah, Sofia Reyes, Leah Morgan"\nTheo Bennett,"Leah Morgan, Maya Chen, Theo Grant"\n`,
    mentee: `Name,Preferences\nSofia Reyes,"Amira Patel, Nadia Okafor, Daniel Brooks"\nJulian Park,"Marcus Lee, Amira Patel"\nMaya Chen,"Elena Rossi, Amira Patel, Theo Bennett"\nNoah Kim,"Daniel Brooks, Marcus Lee"\nPriya Shah,"Nadia Okafor, Daniel Brooks, Elena Rossi"\nLeah Morgan,"Theo Bennett, Elena Rossi, Nadia Okafor"\nTheo Grant,"Marcus Lee, Theo Bennett"\nAvery Stone,\n`
  };
  const state = {mentor:null, mentee:null, result:null, version:{mentor:0, mentee:0}};
  const say = text => { $('message').textContent = text; };
  function clearResult() {
    state.result = null;
    $('result-content').hidden = true; $('empty').hidden = false;
    $('result-label').textContent = 'AWAITING INPUT'; $('stability-result').textContent = '';
  }
  function setPeople(kind, text, filename) {
    const people = MentorMatch.parsePeople(text);
    if (!people.length) throw new Error(`${filename} has no people. Add at least one row.`);
    state[kind] = people;
    const status = $(kind+'-status');
    status.textContent = `${filename} · ${people.length} ${people.length === 1 ? 'person' : 'people'}`;
    status.classList.add('loaded');
  }
  function updateReady() { $('run').disabled = !(state.mentor && state.mentee); }
  for (const kind of ['mentor','mentee']) {
    $(kind+'-file').addEventListener('change', async event => {
      const file = event.target.files[0];
      if (!file) return;
      const version = ++state.version[kind];
      state[kind] = null; $(kind+'-status').textContent = 'Reading file…'; $(kind+'-status').classList.remove('loaded');
      clearResult(); updateReady(); say('');
      try {
        const text = await file.text();
        if (version !== state.version[kind]) return;
        setPeople(kind, text, file.name);
      } catch (error) {
        if (version !== state.version[kind]) return;
        $(kind+'-status').textContent = 'File could not be loaded';
        say(`${kind === 'mentor' ? 'Mentor' : 'Mentee'} file: ${error.message}`);
      }
      updateReady();
    });
  }
  $('load-sample').addEventListener('click', () => {
    state.version.mentor++; state.version.mentee++; clearResult(); say('');
    $('mentor-file').value = ''; $('mentee-file').value = '';
    setPeople('mentor', sample.mentor, 'Example mentors');
    setPeople('mentee', sample.mentee, 'Example mentees');
    updateReady();
  });
  $('run').addEventListener('click', () => {
    clearResult(); say('');
    try {
      state.result = MentorMatch.optimize(state.mentor, state.mentee);
      render();
    } catch (error) { say(error.message); }
  });
  function render() {
    const r = state.result;
    $('empty').hidden = true; $('result-content').hidden = false; $('result-label').textContent = 'OPTIMAL PAIRING';
    $('paired-count').textContent = r.matches.length;
    $('unmatched-count').textContent = r.unmatchedMentors.length + r.unmatchedMentees.length;
    $('score').textContent = r.totalScore.toLocaleString();
    $('match-rows').replaceChildren();
    for (const match of r.matches) {
      const tr = document.createElement('tr');
      const values = [match.mentor, match.mentee, '#'+match.mentorRank, '#'+match.menteeRank, match.score.toLocaleString()];
      ['Mentor','Mentee','Mentor rank','Mentee rank','Score'].forEach((label,i) => {
        const td = document.createElement('td'); td.dataset.label = label; td.textContent = values[i]; tr.appendChild(td);
      });
      $('match-rows').appendChild(tr);
    }
    $('no-matches').hidden = r.matches.length !== 0;
    $('unmatched-mentor-count').textContent = `(${r.unmatchedMentors.length})`;
    $('unmatched-mentee-count').textContent = `(${r.unmatchedMentees.length})`;
    $('unmatched-mentors').textContent = r.unmatchedMentors.join(', ') || 'None';
    $('unmatched-mentees').textContent = r.unmatchedMentees.join(', ') || 'None';
  }
  $('check-stability').addEventListener('click', () => {
    if (!state.result) return;
    const pairs = MentorMatch.blockingPairs(state.mentor,state.mentee,state.result.matches);
    const target = $('stability-result'); target.replaceChildren();
    const summary = document.createElement('strong');
    summary.textContent = pairs.length ? `${pairs.length} blocking ${pairs.length === 1 ? 'pair' : 'pairs'} found` : 'No blocking pairs found · stable';
    target.appendChild(summary);
    if (pairs.length) {
      const description = document.createElement('p'); description.textContent = 'These people both prefer each other to their current outcome. The optimized matching has not changed.'; target.appendChild(description);
      const list = document.createElement('ul');
      for (const pair of pairs) { const li = document.createElement('li'); li.textContent = `${pair.mentor} + ${pair.mentee}`; list.appendChild(li); }
      target.appendChild(list);
    }
  });
  $('export').addEventListener('click', () => {
    if (!state.result) return;
    const blob = new Blob(['\uFEFF',MentorMatch.exportCSV(state.result.matches)],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'mentor-pairings.csv'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  });
})();
