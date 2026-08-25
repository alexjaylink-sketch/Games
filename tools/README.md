# tools

Everything here reads the real numbers out of `ship_it_rpg.html`. Nothing
restates a constant, so these stay accurate as the game changes.

## Requirements

Node 18+. `playtest.js` also needs Playwright and a Chromium build. In this
project's container both are already present but installed globally, so
Node needs pointing at them:

```sh
NODE_PATH=/opt/node22/lib/node_modules node tools/playtest.js
```

Elsewhere: `npm i -D playwright && npx playwright install chromium`.
Set `CHROME=/path/to/chrome` if the browser isn't found automatically.

## `sim.js` — balance simulator

Plays thousands of fights using the game's own damage formula, enemy stats,
item bonuses, level curve and **actual skill functions** (they're eval'd out
of the source, not reimplemented).

```sh
node tools/sim.js
node tools/sim.js --runs 2000
```

Every line is run twice: a **skilled** player who heals, exploits weaknesses
and manages caffeine, and a **masher** who only ever presses Commit. The gap
between those two columns is the skill gradient — if a fight shows 100% for
both, it has no decisions in it; if the skilled player is also losing, it's
unfair. Watch the round counts too: fights shorter than ~4 rounds don't give
the writing time to land.

It also prints the XP available on the critical path, which is what tells
you what level a player will actually *be* at each gate.

## `playtest.js` — headless playtests

Drives the real game in a browser and asserts on outcomes. Exits non-zero on
any failed check or page error.

```sh
NODE_PATH=/opt/node22/lib/node_modules node tools/playtest.js          # all suites
NODE_PATH=/opt/node22/lib/node_modules node tools/playtest.js chain    # one suite
NODE_PATH=/opt/node22/lib/node_modules node tools/playtest.js --shots /tmp/shots
```

| suite | covers |
|---|---|
| `smoke` | offer letter → cold open → field, movement, collision, a battle, phone-booth save, resume |
| `chain` | the seven-leg progression: reviewers refuse work that doesn't exist, build ceilings hold, the door opens only when both halves are done |
| `side`  | all five side quests end to end, the quest log, and save round-tripping |
| `desk`  | instruments desk mode twice — ignoring every interruption vs handling them — and asserts the difference |

`desk` is slow on purpose (it plays two 40-second sessions in real time).

## `build-artifact.js` — hosted copy

Strips the standalone document wrapper so the game can be embedded in a host
that supplies its own page shell. Verifies the wrapper is gone and that the
title, font import, script and map data survived.

```sh
node tools/build-artifact.js [outfile]   # default: build/ship-it.html
```
