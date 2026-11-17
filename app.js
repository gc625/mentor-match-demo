(() => {
  'use strict';
  const $ = id => document.getElementById(id);

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
    try {
      // Accept the shared contract and the generated sample's legacy export.
      const legacy = window.MentorMatchSample;
      const sample = window.MentorSample || (legacy && {mentor: legacy.mentorsCSV, mentee: legacy.menteesCSV});
      if (!sample || typeof sample.mentor !== 'string' || typeof sample.mentee !== 'string') throw new Error('Example data is unavailable. You can still upload your own CSV files.');
      const mentors = MentorMatch.parsePeople(sample.mentor), mentees = MentorMatch.parsePeople(sample.mentee);
      if (!mentors.length || !mentees.length) throw new Error('Example data is empty.');
      state.version.mentor++; state.version.mentee++; clearResult(); say('');
      $('mentor-file').value = ''; $('mentee-file').value = '';
      setPeople('mentor', sample.mentor, 'Example mentors');
      setPeople('mentee', sample.mentee, 'Example mentees');
      updateReady();
    } catch (error) { say(error.message); }
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
    renderAnalysis(r.matches);
  }
  function renderAnalysis(matches) {
    const stats = MentorAnalysis.analyzeMatches(matches);
    $('analysis-total').textContent = `${stats.total} matched ${stats.total === 1 ? 'pair' : 'pairs'}`;
    $('mutual-first').textContent = stats.mutualFirst;
    for (const [id, data, otherRank] of [['first-second', stats.firstSecond, 2], ['first-third', stats.firstThird, 3]]) {
      $(id).textContent = data.mentorFirst + data.menteeFirst;
      $(id+'-split').textContent = `Mentor #1 / mentee #${otherRank}: ${data.mentorFirst} · Mentor #${otherRank} / mentee #1: ${data.menteeFirst}`;
    }
    $('analysis-visuals').hidden = !stats.total;
    $('analysis-empty').hidden = !!stats.total;
    const matrix = $('rank-matrix'); matrix.replaceChildren();
    if (!stats.total) return;
    const caption = document.createElement('caption');
    caption.textContent = 'Number of pairs by mentor rank (rows) and mentee rank (columns)';
    matrix.appendChild(caption);
    const thead = document.createElement('thead'), header = document.createElement('tr');
    const corner = document.createElement('th'); corner.scope = 'col'; corner.textContent = 'Mentor ↓ / Mentee →'; header.appendChild(corner);
    for (const rank of stats.matrix.menteeRanks) {
      const th = document.createElement('th'); th.scope = 'col'; th.textContent = `#${rank}`; header.appendChild(th);
    }
    thead.appendChild(header); matrix.appendChild(thead);
    const tbody = document.createElement('tbody');
    stats.matrix.mentorRanks.forEach((rank, i) => {
      const row = document.createElement('tr'), th = document.createElement('th');
      th.scope = 'row'; th.textContent = `#${rank}`; row.appendChild(th);
      stats.matrix.counts[i].forEach(value => {
        const td = document.createElement('td'); td.textContent = value; if (value) td.classList.add('has-pairs'); row.appendChild(td);
      });
      tbody.appendChild(row);
    });
    matrix.appendChild(tbody);
    for (const [id, distribution] of [['mentor-distribution', stats.mentorDistribution], ['mentee-distribution', stats.menteeDistribution]]) {
      const target = $(id); target.replaceChildren();
      for (const item of distribution) {
        const row = document.createElement('div'); row.className = 'distribution-row';
        const label = document.createElement('span'); label.textContent = `#${item.rank}`;
        const track = document.createElement('span'); track.className = 'bar-track'; track.setAttribute('aria-hidden', 'true');
        const bar = document.createElement('span'); bar.className = 'bar-fill'; bar.style.width = `${item.count / stats.total * 100}%`; track.appendChild(bar);
        const count = document.createElement('span'); count.textContent = `${item.count} / ${stats.total}`;
        row.append(label, track, count); target.appendChild(row);
      }
    }
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
