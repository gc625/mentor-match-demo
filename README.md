# Mentor Match

A dependency-free, client-side mentor/mentee matching workspace. Open `index.html` directly in a modern browser, or serve this directory with any static server. No installation or backend is required. Data is processed only in the browser; nothing is uploaded or saved by the app. The browser or OS may retain downloaded files according to its own settings.

To access on another device, serve the directory on a trusted network, e.g. `python3 -m http.server 8000 --bind 0.0.0.0`, then visit the host's network address and port from the phone. This plain HTTP server does not encrypt traffic; use direct file access or a trusted secure host if privacy matters. This repository does not deploy anything.

## Input

Choose one UTF-8 CSV per side, or click **Load example data**. The example files are also in `samples/`. Each row begins with a unique person's name, followed by their ranked choices, in order. A `Name,Preferences` header is optional. Quoted CSV fields and common unquoted separate choice columns both work:

```csv
Name,Preferences
Amira,"Sofia, Julian, Maya"
Daniel,Noah,Priya,Sofia
```

To reference a name containing a comma, encode a nested CSV-quoted name in the preference cell, with quotes escaped for the outer CSV: `Amira,"""Reyes, Sofia"",Julian"`. Names match **exactly**, case-sensitive, after trimming outer whitespace. A person may have an empty list; duplicate people, duplicate choices, empty items within a list, malformed quotes, and references missing from the opposite file are rejected. Blank separate preference columns are ignored. A file must contain at least one person.

## Method and limits

Only mutually ranked pairs are eligible; a one-sided or unranked choice is unacceptable and is never assigned. Both sides have capacity one. Unequal sizes and incomplete lists may leave people unmatched, displayed separately. A rectangular Hungarian assignment with unmatched dummy columns finds the global optimum for this lexicographic objective:

1. Maximize the number of eligible pairs.
2. Among matchings of that size, maximize summed mutual score. For each side, the contribution is `round(1000 × (L − r) / L)`, where `L` is that person's list length and `r` is the zero-based rank. Pair score is the sum (maximum 2,000). Scores are rounded individually before adding.

The cardinality bonus is `2000 × min(mentor count, mentee count) + 1`, exceeding the greatest possible total score difference. Equal optima are chosen deterministically for a given input order; no fairness or stability guarantee is implied. The optional stability check identifies *blocking pairs*: mutually ranked, currently unpaired people who both strictly prefer one another to their current partner, or to being unmatched. This is a diagnosis, not a stable matching algorithm, and does not alter the score-optimized result.

Export downloads the matched pairs, ranks, and pair score as CSV. Unmatched people remain visible in the dashboard. To mitigate spreadsheet formula injection, exported cells starting with formula-like characters (including whitespace-prefixed ones) receive a leading apostrophe. Thus some exported names intentionally differ from their original value.

## Tests

Run `node --test test/*.test.js` (Node 18+). Tests include CSV edge cases, eligibility, unequal sizes, stability, export safety, and 250 seeded small cases checked against exhaustive enumeration. No test dependencies are needed.
