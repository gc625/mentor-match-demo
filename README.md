# Mentor Match

A dependency-free, client-side mentor/mentee matching workspace. Open `index.html` directly in a modern browser, or serve this directory with any static server. No installation or backend is required. Data is processed only in the browser; nothing is uploaded or saved by the app. The browser or OS may retain downloaded files according to its own settings.

To access on another device, serve the directory on a trusted network, e.g. `python3 -m http.server 8000 --bind 0.0.0.0`, then visit the host's network address and port from the phone. This plain HTTP server does not encrypt traffic; use direct file access or a trusted secure host if privacy matters. This repository does not deploy anything.

## Input

Choose one UTF-8 CSV per side, or click **Load example data**. The example contains 60 mentors and 60 mentees, each with five ranked preferences. The deterministic synthetic example files are also in `samples/` and can be recreated with `node samples/generate.js`. Each row begins with a unique person's name, followed by their ranked choices, in order. A `Name,Preferences` header is optional. Quoted CSV fields and common unquoted separate choice columns both work:

```csv
Name,Preferences
Amira,"Sofia, Julian, Maya"
Daniel,Noah,Priya,Sofia
```

To reference a name containing a comma, encode a nested CSV-quoted name in the preference cell, with quotes escaped for the outer CSV: `Amira,"""Reyes, Sofia"",Julian"`. Names match **exactly**, case-sensitive, after trimming outer whitespace. A person may have an empty list; duplicate people, duplicate choices, empty items within a list, malformed quotes, and references missing from the opposite file are rejected. Blank separate preference columns are ignored. A file must contain at least one person.

## Method and limits

Only mutually ranked pairs are eligible; a one-sided or unranked choice is unacceptable and is never assigned. Both sides have capacity one. Unequal sizes and incomplete lists may leave people unmatched, displayed separately.

The engine exposes two methods (the existing interface defaults to balanced optimization):

```js
MentorMatch.optimize(mentors, mentees, {priority: 'balanced'}); // or 'mentors', 'mentees'
MentorMatch.stableMatch(mentors, mentees, {proposer: 'mentor'}); // or 'mentee'
```

Each argument is an array of `{name, preferences}` objects, with unique names within each side and strictly ordered preference arrays containing names from the opposite side. Both methods validate names and preferences, reject unknown option values, and return `{matches, unmatchedMentors, unmatchedMentees, totalScore}`. Each match has `mentor`, `mentee`, one-based `mentorRank` and `menteeRank`, `mentorScore`, `menteeScore`, and `score`. `score` and `totalScore` always use the **unweighted** mutual score, even when the optimization objective uses weights. Omitting options defaults to balanced optimization or mentor-proposing stability, respectively.

### Global optimum

A rectangular Hungarian assignment with unmatched dummy columns finds the global optimum for this lexicographic objective:

1. Maximize the number of mutually eligible pairs.
2. Among matchings of that size, maximize the sum of weighted pair scores. Each side's contribution is `round(1000 × (L − r) / L)`, where `L` is that person's full list length and `r` is the zero-based rank. Round each contribution before weighting. Weights (mentor:mentee) are **1:1** for `balanced`, **2:1** for `mentors`, and **1:2** for `mentees`. The unweighted pair score is the sum of the two contributions (maximum 2,000).

The cardinality bonus is `1000 × (mentor weight + mentee weight) × min(mentor count, mentee count) + 1`, exceeding the greatest possible total weighted score difference. Equal optima are chosen deterministically for a given input order. Optimizing scores does not guarantee stability, and changing weights is a policy choice, not a guarantee of fairness or of improving every individual outcome.

### Stable matching

`stableMatch` uses Gale–Shapley deferred acceptance: the specified side proposes in preference order, and each recipient tentatively keeps their most preferred acceptable proposal. It returns a stable matching with no blocking pairs and gives every proposer their best partner among stable matchings (with unmatched treated as worse than any mutually acceptable partner). A stable result need not maximize the number of pairs across all feasible matchings or maximize total score. Results are deterministic for a given input order.

`blockingPairs(mentors, mentees, matches)` independently identifies mutually ranked, currently unpaired people who both strictly prefer one another to their current partner, or to being unmatched. It diagnoses a result without altering it.

Export downloads the matched pairs, ranks, and pair score as CSV. Unmatched people remain visible in the dashboard. To mitigate spreadsheet formula injection, exported cells starting with formula-like characters (including whitespace-prefixed ones) receive a leading apostrophe. Thus some exported names intentionally differ from their original value.

## Tests

Run `node --test test/*.test.js` (Node 18+). Tests include CSV edge cases, eligibility, unequal sizes, stability, export safety, all 625 strict incomplete 2×2 preference profiles, and seeded larger small cases checked against exhaustive enumeration. No test dependencies are needed.
