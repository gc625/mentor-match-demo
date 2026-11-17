'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {parsePeople, optimize} = require('../match.js');
const root = path.join(__dirname, '..');

test('sample generation reproduces all shipped files', () => {
  const os = require('node:os');
  const {execFileSync} = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentor-sample-'));
  try {
    fs.mkdirSync(path.join(dir, 'samples'));
    fs.copyFileSync(path.join(root, 'samples/generate.js'), path.join(dir, 'samples/generate.js'));
    execFileSync(process.execPath, [path.join(dir, 'samples/generate.js')]);
    for (const file of ['samples/mentors.csv', 'samples/mentees.csv', 'sample.js']) {
      assert.equal(fs.readFileSync(path.join(dir, file), 'utf8'), fs.readFileSync(path.join(root, file), 'utf8'));
    }
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('browser and CommonJS sample exports equal the downloadable CSV files', () => {
  const file = path.join(root, 'sample.js');
  assert.ok(fs.existsSync(file), 'sample.js must exist');
  const sample = require(file);
  const context = {};
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
  for (const side of ['mentors', 'mentees']) {
    const expected = fs.readFileSync(path.join(root, 'samples', `${side}.csv`), 'utf8');
    assert.equal(sample[`${side}CSV`], expected);
    assert.equal(context.MentorMatchSample[`${side}CSV`], expected);
  }
});

test('sample gives contested choices and valid mutual, one-to-one optimized matches', () => {
  const mentors = parsePeople(fs.readFileSync(path.join(root, 'samples/mentors.csv'), 'utf8'));
  const mentees = parsePeople(fs.readFileSync(path.join(root, 'samples/mentees.csv'), 'utf8'));
  const mentorMap = new Map(mentors.map(person => [person.name, person]));
  const menteeMap = new Map(mentees.map(person => [person.name, person]));
  let mutual = 0, oneSided = 0;
  for (const mentor of mentors) for (const name of mentor.preferences) {
    if (menteeMap.get(name).preferences.includes(mentor.name)) mutual++;
    else oneSided++;
  }
  assert.ok(mutual > 100, `only ${mutual} mutual preferences`);
  assert.ok(oneSided > 0, 'sample should contain some ineligible choices');
  assert.ok(new Set(mentors.map(p => p.preferences[0])).size < 50, 'mentor first choices should compete');
  assert.ok(new Set(mentees.map(p => p.preferences[0])).size < 50, 'mentee first choices should compete');
  const result = optimize(mentors, mentees);
  assert.equal(new Set(result.matches.map(pair => pair.mentor)).size, result.matches.length);
  assert.equal(new Set(result.matches.map(pair => pair.mentee)).size, result.matches.length);
  for (const pair of result.matches) {
    assert.equal(mentorMap.get(pair.mentor).preferences[pair.mentorRank - 1], pair.mentee);
    assert.equal(menteeMap.get(pair.mentee).preferences[pair.menteeRank - 1], pair.mentor);
  }
});
