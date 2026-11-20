# Felt Lab

A GTO poker trainer built with React, Tailwind and framer-motion.

- Drills: pot odds, expected value, outs and the 4-2 rule, pre-flop (6-max, 100bb charts), and everything mixed
- Timed challenge: 1, 2.5 or 5 minutes, per topic or mixed; a wrong answer costs a 3-second penalty
- Range builder: paint a 13x13 chart, save presets, practise them
- My stats: 1 day / 1 week / 1 month / total, accuracy over time (auto-scaled axis), accuracy by topic, timed records with leaderboard rank
- Leaderboard: shared when opened as a claude.ai artifact (db capability); falls back to this-device storage elsewhere
- Learn: 10 lessons with formulas, worked examples, common mistakes and live calculators; a "How to solve this" help sheet on every question
- Post-flop strategy (c-bet by texture, MDF, bluff ratio, SPR), range equity (value/check/bluff, equity vs range, all-in matchups), implied odds
- Difficulty levels, mixed pre-flop strategies, 6-max and 9-handed tables, stack depth
- Daily challenge (same 20 hands for everyone), mistake review with spaced repetition, weak-spot drills, speed tracking
- Streaks, daily goal, practice calendar, badges, nicknames and clubs, shareable hand links, calculators page
- Head-to-head races (needs the artifact `room` capability; shows a notice without it)

## Build

```bash
pnpm install
./build-bundle.sh      # -> bundle.html (single self-contained file)
python3 to-artifact.py # -> artifact.html (claude.ai artifact page format)
```

`bundle.html` in this folder is the latest build.
