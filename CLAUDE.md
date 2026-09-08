# SHIP IT — working notes for whoever picks this up

A single-file HTML mobile RPG. A deadpan parody of tech-startup culture. You
are a new-hire software engineer on day one at LODESTAR Dynamics trying to
ship one settings toggle (LDS-4417) while everyone in the building has
thoughts about it. Read this before touching anything.

## The one rule

**`ship_it_rpg.html` is the whole game.** ~600 KB, one document, no build
step to play it, no network at runtime (fonts are embedded as base64).
Everything else in the repo is tooling. Do not split it into modules, do not
add a bundler, do not add dependencies. The store-readiness story (STORE.md)
depends on it staying self-contained.

Other files in this repo (`book-picker*.html`, `eleonores_*`, `frodo-*`,
`quest_of_*`, `shawn_*`) are unrelated older projects. Leave them alone.

## Before and after every change

```sh
# syntax check (node --check does not parse HTML; extract the script first)
node -e "const s=require('fs').readFileSync('ship_it_rpg.html','utf8');const m=s.match(/<script>([\s\S]*)<\/script>/);require('fs').writeFileSync('/tmp/game.js',m[1]);" && node --check /tmp/game.js

# the playtests (about 8 minutes for all six)
NODE_PATH=/opt/node22/lib/node_modules node tools/playtest.js            # all suites
NODE_PATH=/opt/node22/lib/node_modules node tools/playtest.js desk loop   # some suites
NODE_PATH=/opt/node22/lib/node_modules node tools/playtest.js desk --shots /tmp/shots   # with screenshots
```

Suites: `smoke` (intro, field, a fight, save), `chain` (desk/office must
alternate through the gates), `loop` (chapter-one ending → day two → day
three), `side` (five side quests), `desk` (all five build tools with in-page
bots, interruption coupling, tutorial card), `store` (no network, fonts,
icons, manifest, save codes, migration, settings), `mobile` (the platform:
no sideways scroll, thumb-sized controls, the portrait guard, autosave on
backgrounding, corrupt and unwritable saves), `ch2` (the sixth floor end to
end: the elevator, the nameplate, three sign-offs, the founder's door, the
fight and the slide). `desk` is slow on purpose.

`tools/sim.js` plays thousands of fights with the real enemy tables and skill
functions eval'd out of the source. Run it after any combat number changes.

A change that makes a suite red is not done. Do not loosen a check to make
it pass unless the game behavior deliberately changed; then say so in the
commit.

## Shipping a change

```sh
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -F msg.txt
NODE_PATH=/opt/node22/lib/node_modules node tools/build-artifact.js   # → build/ship-it.html (hosted copy)
node tools/package.js                                                 # → build/ship-it-itch.zip
git push -u origin claude/html-rpg-cloud-hosting-wze8lp
```

Then republish `build/ship-it.html` to the **existing** artifact:
`https://claude.ai/code/artifact/6443caa7-4ec6-4a49-8ef0-f2414929be84`
(pass that as `url`; publishing without it creates a duplicate; favicon 🚢).
If the publish is refused as "not built on the newer version", read the saved
copy it points at and diff it against your previous build — so far it has
always been our own previous publish inside the host wrapper, and a re-read
then a republish goes through.

Bump `const BUILD` on user-visible changes. Commit messages: what changed and
why, in plain sentences. No model names anywhere in the repo.

## How the code is laid out (search for the banner comments)

`STATE` → `MAP` → `CANVAS / RENDER` → `MOVEMENT` → `DERIVED STATS` →
`BATTLE` → `BUILD TOOLS` → `SAVE` → `SIDE QUESTS` → `INTERACTION` → `NPCS`
→ `ENDING` → `INPUT` → `BOOT`. Data tables sit near the top (`TILE`,
`FLOOR3`, `TICKETS`, `SKILLS`, `ITEMS`, `ENEMIES`, `INTERRUPTS`, `MEETINGS`,
`SIDEQUESTS`, `SIGNS`, `NPCS`, `TOOLS`).

### Modes
`mode` ∈ title / dialogue / choice / field / menu / shop / battle / desk.
`say()` and `choose()` return promises; NPC conversations use `hold()` to
keep mode = dialogue across chained lines. `S` is the save state (null on
the title). `D` is the live desk session, `B` the live battle. Guard with
`if(!S)`, `if(!D || D.over)`, `if(!B || B.over)` — those null derefs have
bitten before.

### Field
Tile map in `FLOOR3` (ASCII, every row the same width — a validator will
catch a stray space). `TILE` maps chars to `{solid, kind, enc}`. The renderer
is a two-pass floor plan: `drawFloor` (carpet / stone / doors, light pools,
wall shadows) then `drawTile` (autotiled thin walls, continuous desk runs,
furniture). `SIGNS` are floor labels; `objectiveTarget()` drives the pulsing
marker and the edge pill, `nextStep()` the HUD text. Random encounters only
on `o` tiles and only after `S.flags.satDown`.

### Two floors
`FLOORS` holds `f3` and `f6`; `S.floor` says which you are on and `curMap()`
resolves it. `buildMap()` rebuilds the grid on arrival. Every entry in `NPCS`
and `SIGNS` carries `f`, and `onFloor()` filters both the renderer and
`npcAt()`. Floor 6 gets a warmer carpet and closer lights in `drawFloor`, so
upstairs reads as a different building. `goFloor(key)` is the ride.

### Progression (chapter one)
`buildCap()` is 35 until code review (Priya), 70 until security review
(Marcus), 100 after; `capBlocker()` explains; design review (Kai) needs the
CTF; `readyToShip()` = all approvals and build 100 → VELOCITY → Brayden boss
→ `ending()`. The portal card lists the seven steps.

### Chapter two (the sixth floor)
`S.ch` is 1 or 2. Finishing chapter one sets `flags.finished`; resuming calls
`nextDay()`, which routes the first time into `startCh2()` instead of another
toggle day. Chapter two runs on `LDS-5001`, gated by `CH2GATES` at 25 / 50 /
75 (Legal → Comms → Finance) with `S.sign`, and `buildCap()`, `capBlocker()`,
`allApprovals()`, `nextStep()`, `objectiveTarget()` and `lockedRoom()` all
branch on `ch2()`. The founder's door at (27,19) on f6 is the VELOCITY
equivalent. `ch2Ending()` closes it, sets `flags.ch2done`, and hands back to
the toggle day-loop, so `nextDay()` resumes the LDS-4418 cycle afterwards.

The chapter turns on one flag: `flags.said_mara`, offered only if the player
read the war-room nameplate or finished the Thing quest. It changes the last
slide and nothing else. Leave it that way — it is the point.

Floor 6 swaps the tables: `encTable()`, `intTable()` and `mtgTable()` return
the `*6` variants during chapter two.

### Day two and after
`ending()` sets `flags.finished`; resuming (or "Come in tomorrow") calls
`nextDay()`: `S.day++`, `S.ticket++`, build 0, all approvals carried over,
every tool open. `TICKETS[]` holds per-day briefs, Brayden pitches and
endings; `ticket()` generates the add/remove cycle after the table runs out.
Desk pressure rises 7% per day.

### The desk
`startDesk()` (chooser when more than one tool is unlocked) → `deskUpdate`
each frame. Progress only comes from the tool via `workProgress(pct)`;
`workFlow()` builds the ×1.0–×3.0 multiplier. `SESSION_CHUNK = 35`.

Interruptions (`INTERRUPTS`, `MEETINGS`) are cards over the board. **Deal**
puts you away for `1.0 + 0.06·threat` seconds while the tool runs on
autopilot (`update(dt, auto=true)`); **Snooze** costs 3 caffeine and the
card returns in 8 s angrier and un-snoozable; **ignoring** costs Focus and
calls `tool.punish()`. Meetings do not pause: the tool runs at 0.7× behind a
translucent overlay; only the all-hands (`secs >= 14`) calls
`tool.meeting(true)`. Inputs are gated while away or in a meeting.

### Build tools (`WORK.*`, registry `TOOLS`)
Each tool implements `start / update(dt, auto) / input(k) / render / punish /
meeting(big) / peek / stop` plus `intro`, and `how`/`why` text for the
first-open tutorial card. Registry entries carry `unlock()` and `hint`.

| key | name | style | unlocks |
|---|---|---|---|
| stack | Merge Queue | falling blocks, 10×14 | day one |
| breaker | Bug Bash | block breaker | code review |
| snake | Dependency Chain | snake | security review |
| cross | Open Floor | lane crossing | design review |
| pipes | Pipeline | rotate the pipes vs a countdown | The Thing quest, or day two |

`peek()` exists for the test bots; keep it honest. Autopilot must be
disruptive but not a session-ender (Merge Queue drops at random columns at
0.3 s/row; the first version stacked in the middle and topped out every
meeting).

**Copyright stance:** mechanics are not protectable, names and skins are.
Original names, original piece set (nine shapes, tagged like commits),
original skins. Never use the trademarked names, the classic seven-piece
naming, or Pac-Man-shaped anything.

### Combat
Focus = HP, Caffeine = MP. `calcDmg(atk, def, mult) = max(1, round(atk·(1 +
rand·0.25)·mult − def·0.5))`, weakness ×1.6. `XPCURVE = [0,35,85,155,255,390]`.
Brayden should take 10–16 rounds at level 4–5 and a button-masher should
lose. The battle screen is styled as a video call (`.tile`, `#selfview`,
`#blog`).

### Lifecycle (phones are not browser tabs)
`watchOrientation()` pauses the game and shows `#rotate` when the viewport is
landscape **and** under 560px tall — a phone held sideways, never a laptop. The
global `sideways` flag stops `deskUpdate`, so the desk clock does not run while
the overlay is up.

`watchLifecycle()` autosaves on `visibilitychange → hidden`, on `pagehide` and
on `blur`, and re-boots the audio context when the app comes back (iOS suspends
it in the background and it never resumes on its own). `autosave(force)` is
throttled to 1.5 s unless forced, and is also called at checkpoints: the end of
a fight, each approval, and the end of a desk session. Nothing in the game asks
the player to save.

`watchErrors()` saves and toasts once on an uncaught error or rejection.

**These three are called at the bottom of the file, in `BOOT`.** They were once
inserted into `quitToTitle()` by an anchor that matched the wrong
`classList.add('titling')` — autosave then only worked after quitting, and
stacked a duplicate listener each time. If you move them, check which one you
matched.

### Saves
`SAVEKEY = 'shipit_lodestar_v2'`, `SAVE_VERSION = 2`. `hasSave()` parses before
it answers, and clears a save it cannot read, so a mangled write never leaves a
Resume button that fails forever. The `window.__store` seam needs `del` as well
as `get`/`set` in a native build (see STORE.md). `loadGame()` =
`migrate(Object.assign(newGame(), saved))`, so a new field with a default in
`newGame()` needs no migration; a renamed or reshaped field does (see
`migrate()`, which also reads the pre-rename `shipit_vanta_v1` key). Save
Code export/import is base64 JSON. Settings live in `S.opts` (sound,
extraTime, haptics).

## Writing rules (this is most of the product)

The game is simple; the wit is the reason to play. Every line is judged.

- **Deadpan.** State the absurd thing flatly. No exclamation points, no
  winking, no "lol". The joke is that nobody in the building finds it funny.
- **Self-deprecating of the industry, from inside it.** The player is an
  engineer; the writing knows the jargon and uses it correctly. Techy people
  should feel seen, not lectured. Never moralize. Cut any line that explains
  the joke or tells the reader what to think.
- **Specific beats generic.** "Eleven months in the backlog, estimated at two
  points" beats "a small ticket". Real artifacts: commit messages, runbooks
  taped under desks, FINAL_v7_final2 filenames, recurring meetings with no
  end date.
- **Over the top in content, restrained in delivery.** Rand Voss can claim he
  wakes up *correct*; the narration reports it like weather.
- **Short.** One idea per line. Dialogue lines are sentences, not paragraphs.
  If a joke needs a second sentence to land, it is two jokes or none.
- **Everyone is competent at something and trapped by the system.** Jordan,
  Brayden, Rand are targets; Priya, Mara, Marcus, Kai, Dee are people. Do
  not write anyone as simply stupid.
- **US spelling.** ("storeys" was read as a typo.)
- No real company or product names. LODESTAR replaced a name that collided
  with a real company; check new names.

Good: *"You ship it at 4:47pm on a Friday. Forty lines. Six days. Nine
meetings, of which two had agendas."*
Good: *"Priya approves it without reading it. She has read it. She read it in
the spring."*
Bad: *"Wow, corporate life sure is crazy, huh?"* (winks, generic, explains.)
Bad: *"Managers like Brayden are what's wrong with tech."* (moralizes.)

## Backlog, in the order it is worth doing

1. **Make the day loop vary.** After chapter two, every day is the same
   shape with different Brayden dialogue. One structural twist per day
   (a tool taken away, a gate that moves, a day with no interruptions at
   all) would add real replay without new maps. This is the cheapest
   remaining content per hour of work.
2. itch.io page copy and store screenshots. `STORE.md` has the plan.
   (`tools/package.js` makes the zip; `tools/make-icons.js` makes the icons.)
3. Encounter rate on the zigzag route feels slightly high; tune with the
   `chain` suite watching.
4. A LICENSE file — the owner's call, not ours.

Done, so do not redo: the visual pass (office, title, offer letter, battle,
desk, portal, dialogue, list screens all share one look), the app icons, the
lifecycle work, chapter two's spine (map, cast, gates, boss, ending), and all
four Floor 6 side quests. Mara's surname is Okafor, fixed in `ch2Ending()`.

### Measured length (v1.5.0)
Both chapters on the critical path run 40–45 minutes; with every side quest
and some exploring, 60–75. Derived from: a near-optimal bot builds a 35% desk
chunk in 18s (a human is 4–5× slower), Brayden is 22s of raw tapping and Rand
31s, and there are 9,463 words of player-facing text of which one playthrough
sees roughly half. Keep it in the 60–90 minute band; the wit is the product
and padding kills it.

## Things that went wrong before, so you do not repeat them

- Building before the concept was agreed. Ask, then build.
- Playwright `evaluate(() => endDesk('quit'))` returns a promise that waits
  on dialogue; wrap in braces `{ endDesk('quit'); }`.
- `String.replace` with `$$` in the replacement string produces `$`. Use a
  function replacement or split/join.
- `pgrep -f` matching its own command line; never put `pkill` and the
  relaunch in the same shell command.
- Test bots that top out: the stacker heuristic needs holes, bumpiness and
  max height, not just aggregate height.
- Artifact comment notifications never reach these sessions (the wake
  subscription is refused). Feedback comes in chat.
