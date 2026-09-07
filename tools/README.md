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
| `store` | no network requests, bundled fonts, manifest, versioned saves, save-code round trip, pre-rename save migration, settings |
| `desk`  | plays all five build tools with in-page bots, and checks that interruptions take you off the keyboard, snooze costs caffeine, and meetings keep the work running |

`desk` is slow on purpose (it plays several tool sessions in real time, about six minutes).

## `embed-fonts.js` — remove the network dependency

Replaces the Google Fonts `@import` with self-hosted base64 woff2 `@font-face`
rules, keeping only the `latin` subset. A store build has to render correctly
offline and must not call a third party at runtime.

```sh
node tools/embed-fonts.js --dry-run   # report sizes, change nothing
node tools/embed-fonts.js             # rewrite the game file in place
```

Only needed again if the set of faces changes.

## `build-artifact.js` — hosted copy

Strips the standalone document wrapper so the game can be embedded in a host
that supplies its own page shell. Verifies the wrapper is gone and that the
title, font import, script and map data survived.

```sh
node tools/build-artifact.js [outfile]   # default: build/ship-it.html
```

## `package.js` — itch.io zip

```sh
node tools/package.js [outfile]   # default: build/ship-it-itch.zip
```

Zips the standalone document as `index.html` (plus a one-line README) for
upload as an itch.io HTML project. Refuses to run if fonts are still fetched
from the network. Uses the system `zip` when present and falls back to a
small built-in writer otherwise.

## `make-icons.js` — app icons

```sh
NODE_PATH=/opt/node22/lib/node_modules node tools/make-icons.js
```

Draws the app icon (the LDS-4417 toggle) as HTML, screenshots it with the
same Chromium the playtests use, and writes the PNGs into
`ship_it_rpg.html` as data URIs between the `icons:start` / `icons:end`
markers: a 180×180 `apple-touch-icon` (iOS ignores SVG here), a 32×32 tab
icon, and a manifest carrying 192, 512 and a smaller 512 `maskable` for
Android's circle crop. Idempotent — run it again after changing the art.

The art is deliberately flat. A full-canvas gradient made the same icons
319 KB instead of 45 KB, and this file has to carry every byte it ships.
