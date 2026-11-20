# Felt Lab

A GTO poker trainer built with React, Tailwind and framer-motion.

- Drills: pot odds, expected value, outs and the 4-2 rule, pre-flop (6-max, 100bb charts), and everything mixed
- Timed challenge: 1, 2.5 or 5 minutes, per topic or mixed; a wrong answer costs a 3-second penalty
- Range builder: paint a 13x13 chart, save presets, practise them
- My stats: 1 day / 1 week / 1 month / total, accuracy over time (auto-scaled axis), accuracy by topic, timed records with leaderboard rank
- Leaderboard: shared when opened as a claude.ai artifact (db capability); falls back to this-device storage elsewhere

## Build

```bash
pnpm install
./build-bundle.sh      # -> bundle.html (single self-contained file)
python3 to-artifact.py # -> artifact.html (claude.ai artifact page format)
```

`bundle.html` in this folder is the latest build.
