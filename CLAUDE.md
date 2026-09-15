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

Suites: `smoke` (intro, field, a conversation, save), `chain` (desk/office must
alternate through the gates), `loop` (chapter-one ending → day two → day
three), `side` (five side quests), `desk` (all five build tools with in-page
bots, interruption coupling, tutorial card), `store` (no network, fonts,
icons, manifest, save codes, migration, settings), `mobile` (the platform:
no sideways scroll, thumb-sized controls, the portrait guard, autosave on
backgrounding, corrupt and unwritable saves), `ch2` (the sixth floor end to
end: the elevator, the nameplate, three sign-offs, the founder's door, the
fight and the slide), `journey` (a new save to the end of chapter two through
the real gates, doors and fights — the only suite that takes no structural
shortcut, and the one that proves the game is finishable). `desk` and
`journey` are slow on purpose.

`journey` is the suite to trust when you change progression. Every other suite
jumps ahead with `d.set()`, so a dead-end can hide behind the jump — that is
how the Priya→Jordan prerequisite went unnoticed until it was written.

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
CTF (Brooke); `readyToShip()` = all approvals and build 100 → VELOCITY →
Brayden boss → `ending()`. The portal card lists the seven steps.

Two gates have a person in front of the person: **Priya will not review until
Jordan is off her calendar** (`flags.priya_task` → `flags.jordan_done`), and
**Kai will not sign off until the CTF is done** (`flags.ctf_done`, from
Brooke). `nextStep()` and `objectiveTarget()` both re-point at Jordan while
that detour is open, because the arrow saying "Priya" while Priya is saying
"go and find Jordan" is the kind of thing that reads as a bug.

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

`DAYMODS` bends each post-chapter-two day in exactly one direction, on a
five-day rotation keyed off `S.day`: an offsite where nothing interrupts you,
launch week at double the ping rate, a day with Merge Queue taken away, a day
that starts a third built by someone you never meet, and a day you start short
on Focus. `dayMod()` returns the day's entry (null during chapters one and
two); `unlockedTools()`, the spawn cadence in `deskUpdate` and `nextDay()` all
read it, and `endingAgain()` gives it the last word. Adding a sixth day is a
table entry plus, at most, one hook.

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

### Why anyone taps Deal (read this before retuning the desk)
The first playtester asked what the incentive was, and the honest answer was
that there wasn't one: `handleCard()` used to set `d.flow = 1`, so dealing with
somebody wiped your multiplier while ignoring them kept it. The incentive was
not weak, it was **inverted**.

The rule now is that **Deal costs board quality and pays speed** — different
currencies, so the trade stays a decision instead of collapsing into "always
tap it":

| choice | costs | pays |
|---|---|---|
| Deal | ~2 s away, autopilot wrecks your board | `workFlow(0.14 + 0.014·thr)` |
| Snooze | 3 caffeine, it comes back angrier | you pick the moment |
| Ignore | Focus, `tool.punish()`, every third one books a meeting | you never take your hands off |

Each is correct somewhere: Deal on a clean board, Snooze mid-placement, Ignore
when you are out of caffeine and cannot afford to look away. **Do not give Deal
a board-clearing reward** — that was considered and rejected, because it makes
Deal strictly correct and kills the decision.

Ignoring deliberately does **not** cost flow; keeping the multiplier is what
makes it tempting in the moment. `cross.punish()` and `pipes.punish()` used to
zero the flow and no longer do.

**The cashout.** Hitting `FLOW_MAX` sets `d.cash`, and `deskUpdate` spends it
one frame later (never re-enter a tool mid-lock) by calling `tool.reward(2)` and
dropping flow to ×2.0, so the cycle can run two or three times a session. Every
tool implements `reward(n)`: Merge Queue drops its bottom rows **including the
locked `L` meeting rows**, which is the only thing in the game that undoes a
meeting. Bug Bash clears the nearest bug rows and unshrinks the paddle, the
chain loses walls, the floor loses people, Pipeline gets clock and true joints.

**`helps:1` cards.** A few people who interrupt you are actually helping — Priya
has read your branch, Dee brought coffee, Mara knows the slide number. Dealing
with one calls `reward(1)` outright and the away overlay prints its `won` line.
Keep them rare (about one card in seven). Common enough to sort for and the
player learns to ignore everyone else, which is exactly the hole we climbed out
of.

**The first two sittings are gentler**, because the first playtester found day
one unlearnable. `S.sessions` counts finished desk sessions (quits included).
`firstPing()` sets the opening quiet stretch — 26–32 s on session 0, 12–16 s on
session 1, 5–8 s after — and `pingEase()` stretches the recurring cadence by
×1.9 then ×1.35 then ×1. Merge Queue multiplies its fall interval by 1.5 then
1.2 on the same counter. `migrate()` seeds `sessions` at 3 for a save from
before the counter existed, so a returning player is not put back in training.
The `desk` suite asserts the ramp is monotonic in both directions.

**Rotation is on two buttons.** A rotates, and so does the d-pad's up arrow —
which is the one a left thumb can reach without letting go of left/right, so
`setPad(a, b, up)` takes a third label and swaps ▲ for ↻ while Merge Queue is
open. Leaving the desk puts the arrow back. Do not remove the glyph: the
playtester read "you need to be able to rotate the pieces" off a screen where
rotation worked fine on a button they were not looking at.

### Standing replaced levels
Social is the office-side progression. `SOCIALTIERS` names five bands from
Unknown to Load-Bearing; `socialTier()` reads the current one and `checkTier()`
toasts on the way up, which is the only level-up left. `S.tier` remembers where
you were so it fires once.

Your **title** reads off Performance instead (`band()` against `BANDAT`),
because promotion tracks output. The portal's Abilities screen became
**Standing**, listing the tiers and where you are in them.

The two combat item stats became two desk stats, since the desk is where the
game now lives: `type:'desk'` items carry `stam` (how long a day you can take,
via `stamina()`), and `type:'cover'` items carry `cover`, which is subtracted
from the Focus an ignored ping costs. Noise-cancelling headphones now do
literally what they claim to.

### The two ratings (`S.social`, `S.perf`)
Both 0-100, both start at 50, both shown as meters in the walking HUD and again
in the desk head (the desk hides the walking one). Every change goes through
`rate(kind)` reading the `RATES` table, so nothing moves without a chip floating
off the meter saying which choice moved it and why.

| choice | social | perf |
|---|---|---|
| deal with a card | +2 | −1 |
| a `helps:1` card | +3 | 0 |
| snooze | −1 | 0 |
| ignore | −3 | +2 |
| Heads Down | −4 | +3 |
| sit through a meeting | +3 | −2 |
| join one late | −2 | 0 |
| hit the session goal | 0 | +4 |
| come up short | 0 | −3 |
| burn out | −2 | −5 |
| finish a side quest | +8 | 0 |
| read the room in a scene | +6 | 0 |
| misread it | −2 | 0 |
| get stopped in the hallway | +1 | −1 |

The premise: every hour heads-down is an hour you were not reachable. Heads Down
is the purest form of it and is priced hardest — it was the move with no cost at
all before this, which is why it was suspected of being strictly best.

**Nothing a rating does can strand you.** They bend boss stats (`scaleBoss()`
off the pristine `BASEBOSS` copy, so it never compounds across days), shop
prices (`shopScale()`, shown with a ▴/▾ on the tag), XP (`xpScale()`), whether
`helps` cards appear at all, and the review lines in `ending()`. They never
touch `buildCap()`, `capBlocker()`, `readyToShip()`, `nextStep()` or any gate.
`journey` runs the **entire playthrough at 0/0** for exactly this reason: if it
finishes, no rating can close a gate. Do not "improve" this by having low
performance shrink the build cap — that was proposed and rejected, because it
soft-locks the run.

**A difficulty scale must never inflate boss HP.** The first version of
`bossScale()` multiplied hp, atk and def together by 1.16 at low performance,
and `journey` at perf 0 then hit the round cap on Brayden and could not finish
the chapter — a rating that soft-locked the run through combat rather than
through a gate. It now returns separate `{hp, atk, def}` factors and leaves hp
alone going up: a low rating makes the room hit harder, never last longer. Run
`tools/sim.js` after touching any of it.

The card carries its own price before you press it: the Deal and Snooze buttons
print their deltas, and a `.cost` row underneath prints what doing nothing
costs. `tag()` renders a `RATES` entry, so the table is the single source of
truth for both the effect and the label.

### Session goals — the tools are finite now
The playtester said the Merge Queue felt endless, and it was: its only objective
was an abstract percentage that lived outside the minigame. A merge queue has a
length, so now it has one — **24 commits, merge 5 rows before they run out**.
`spawn()` ends the session when the queue is dry (`'short'`) and `lock()` ends
it the moment the fifth row merges (`'done'`).

Hitting the goal tops `d.progress` up to `d.target` in `endDesk`, so the
percentage is the *result* of the objective rather than a second competing one.
Falling short keeps whatever you built and costs performance.

Every tool implements `goal()` returning `{have, need, unit, left, leftUnit}`,
which `renderDeskHud` draws in `#goalbar` above the build bar. Only Merge Queue
has a hard budget; the other four are already bounded by their own fail states
(leaks, being caught, walls), so they state a target without a countdown.

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

### The call — conversations, where combat used to be
There is no combat. It was removed wholesale: the battle loop, `ENEMIES`,
`SKILLS`, `XPCURVE`, levels, story points, attack and defense, and `tools/sim.js`
which existed only to balance fights. What is left in its place is one idea:

> **Everybody here wants something that is not the thing they said.**

`scene(id)` runs a `SCENES` entry on the old video-call screen (`#scene`,
`#grid`, `#blog`, `#smenu` — the frame was too good to throw away, and a meeting
*is* a call). Each round shows a line and two to four replies. A reply flagged
`good` is the one that meets what the person actually wants. `pass` is how many
good reads the scene needs; hitting it returns `'win'`, missing it `'lose'`, and
a reply marked `leaves` returns `'left'`.

**There is no losing.** A misread is a worse outcome and a better joke, never a
wall — every call site treats `'lose'` as progress. `'win'` pays `rate('read')`
(+6 social), `'lose'` pays `rate('misread')` (−2).

**The tell is why you explore.** A scene names a `tell` — a flag you set
somewhere else in the building. Holding it prints `tellLine` at the top of the
transcript and marks the good reply with its `hint`. That is the whole reason to
walk around: you are collecting what people actually want.

`moment({who, lines, rate})` is the small version — no choices, used for the
hallway. `beat()` prints lines and waits for one tap; `replies()` renders the
options into `#smenu`.

The two set pieces are scenes like any other: Brayden wants to have had the idea,
Rand wants somebody to say "weather" back to him. Rand's third round offers the
Mara line only when `flags.said_mara` is set, which is still the flag the whole
chapter turns on.

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

1. itch.io page copy and store screenshots. `STORE.md` has the plan.
   (`tools/package.js` makes the zip; `tools/make-icons.js` makes the icons.)
2. Encounter rate on the zigzag route feels slightly high; tune with the
   `chain` suite watching. Wait for playtest feel before touching it.
   Ask the playtester whether the new day-one desk ramp (v1.7.0) is now too
   slow before touching the numbers again — it moved a long way in one step.
   Same for the v1.8.0 desk economy: watch somebody play it before deciding
   whether Heads Down still needs re-costing (buying silence now also buys no
   flow, so it may have self-corrected).
3. A LICENSE file — the owner's call, not ours.
4. A third chapter, if the game ever needs to be longer. Do not start it
   before watching somebody finish chapter two.
5. More `tell` flags. Every scene supports one and only four are wired
   (`saw_gantt`, `saw_bucket`, `saw_runbook`, `read_doc`, `said_mara`). Each one
   you add is another reason to walk into a room you did not have to.

Done, so do not redo: the two ratings and their meters, the finite merge queue,
the visual pass (office, title, offer letter, battle,
desk, portal, dialogue, list screens all share one look), the app icons, the
lifecycle work, chapter two's spine (map, cast, gates, boss, ending), all four
Floor 6 side quests, and the per-day variation in the loop. Mara's surname is
Okafor, fixed in `ch2Ending()`.

### Measured length (v1.5.0)
Both chapters on the critical path run 40–45 minutes; with every side quest
and some exploring, 60–75. Derived from: a near-optimal bot builds a 35% desk
chunk in 18s (a human is 4–5× slower), Brayden is 22s of raw tapping and Rand
31s, and there are 9,463 words of player-facing text of which one playthrough
sees roughly half. Keep it in the 60–90 minute band; the wit is the product
and padding kills it.

## Playtest save codes

`docs/playtest-codes.md` holds verified Save Codes for the start of each
chapter, the founder's door, and the day loop, so a tester does not have to
replay twenty minutes to reach the part being tested. Regenerate them with
`node tools/save-codes.js` after any change to the save shape.

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
- Referring to a Node-side variable inside `page.evaluate(() => ...)`. It runs
  in the browser and the variable is not there; pass it as the second argument.
  This has cost time three times now.
- Suites that inject state to skip ahead cannot find a progression dead-end.
  That is what `journey` is for; run it after any change to a gate.
- A check that reads `D.g` after a play loop can find `D` null, because the
  session may have ended on its own — and it ends far more often now that a tool
  can complete its goal. Assert against a tool's internals right after it opens,
  then `D.g.start()` to reset the board, rather than after the bot has played.
- The `desk` suite runs one long session across all five tools, so a check that
  leaves state behind breaks the *next* tool, not itself. A block that queues
  cards, escalates, or fills `D.later` belongs in a session of its own at the
  end of the suite. An Open Floor run that happens to score a fourth crossing
  reaches build 100 with every approval set, which is `readyToShip()`, and the
  Pipeline block after it then opens onto a game in a different state.
- Artifact comment notifications never reach these sessions (the wake
  subscription is refused). Feedback comes in chat.
- Replacing a block of the file by line range deletes whatever else happens to
  live in that range. Removing the combat tables by lines 1086–1267 took `ITEMS`
  with them, because the asserts only checked the two endpoints. Assert on what
  is *inside* a range too, or match on text instead of numbers.
- When you delete a section, list every symbol it defined and grep each one for
  surviving callers. `clockStr`, `hueOf` and `burnout` all lived inside the
  battle block and are all still wanted; three of them were only found by
  booting the game.
