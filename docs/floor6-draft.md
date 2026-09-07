# Floor 6 — chapter two, written draft

Status: writing only. Nothing here is wired in. The map, NPC entries, flags,
enemies and a playtest suite still need building; see CLAUDE.md for the
shape those take. Everything below is written to the voice rules in
CLAUDE.md and is meant to be cut, not padded.

## Premise

Chapter one ends with the toggle shipped and Brayden presenting it as an
AI-powered personalization surface. Chapter two opens six weeks later. The
surface has been noticed. Not by users. By the sixth floor.

You are summoned upstairs. Floor 6 is Leadership, Legal, Comms, and the
Lighthouse war room. Nobody on Floor 6 writes code. Everyone on Floor 6 has
a document. Your ticket is **LDS-5001: Lighthouse launch readiness**, which
is not a feature. It is a checklist with nine owners, and you are the only
one of the nine who can be found.

The engine of the chapter: to ship, you need four sign-offs (Legal, Comms,
Finance, and the Founder), and each sign-off wants the toggle to be a
slightly different thing. The build tools are the same five; the
interruptions are worse; the meetings have catering.

The through-line is Mara. She built the bottom of Lighthouse in 2019. Her
name is not on it. The sixth floor is about to announce it. The player can
get her name back on it, or not, and the ending changes by one line.

## The floor

Same tile alphabet. New kinds worth adding: `r` reception desk, `n` nap pod
(solid, glass, a green/red light), `a` art (solid; a large canvas that
reads "VELOCITY" in a different font every time you look at it), `f`
fridge (interactable, see side quest 3), `x` executive desk (solid, wider,
nothing on it). Signs: RECEPTION, LIGHTHOUSE, LEGAL, COMMS, FINANCE, THE
FOUNDER, QUIET ROOM, BOARD ROOM.

Suggested layout, in prose so the map can be drawn to fit the renderer:

- Elevators open onto **Reception**: a curved desk, two chairs nobody sits
  in, a wall of framed press. A plant that is real, which is the tell that
  you are upstairs.
- West: **Legal** (glass-walled, a long table, one whiteboard with a single
  word on it, erased) and **Finance** (a row of monitors showing the same
  dashboard).
- East: **Comms** (couches, a ring light, a phone booth that is always
  occupied) and the **Quiet Room** (nap pods; this is where the encounters
  are, because nobody expects them there).
- North, behind a door that only opens with all four sign-offs: **The
  Founder**'s office. Beyond it, the **Board Room**, where the chapter ends.
- Center: the **Lighthouse war room**. A glass box. Inside, a wall of
  sticky notes, a Gantt chart printed on plotter paper, and a desk with a
  nameplate that says LIGHTHOUSE — TECH LEAD and nothing else. That desk is
  **your desk** for this chapter. It was Mara's. The nameplate was never
  changed because nobody knew whose it was.

Your desk being the war room desk is the joke and the plot: you sit where
the person who built it sat, in the room where people who did not build it
plan to announce it.

## The ticket

**LDS-5001 — Lighthouse launch readiness.** Brief, from Brayden, at 6:02am:

> "big news. leadership loved the surface. they want it to *be* lighthouse
> for the launch. i know. i KNOW. come up to 6 when you're in. bring the
> toggle 🙏"

Portal steps:

1. Build to 25% — at the war room desk
2. Legal sign-off — Priyanka Rao
3. Build to 50%
4. Comms sign-off — Teddy Vance
5. Build to 75%
6. Finance sign-off — Ines Ferreira
7. Build to 100%
8. Founder sign-off — Rand Voss
9. Board Room

`buildCap()` for chapter two: 25 / 50 / 75 / 100 gated on legal, comms,
finance. The founder gate opens the north door.

## The people

### Priyanka Rao — General Counsel (Legal)

Precise, tired, on your side in a way that never helps. Talks in numbered
clauses. Her concern is the word "settings" (callback to day two) and the
word "AI" (callback to day four).

First visit (build < 25):
- "You are the toggle person. Sit. No, do not sit. This will be short."
- "I have three questions and the answers are no, no, and we will see."
- "Come back when it does something. I cannot review a promise."

Sign-off visit (build ≥ 25):
- "Item one. The surface must not be described as AI unless it is AI."
- "Is it AI?"
- (choice) "Yes." / "No." / "It has a sparkle."
- If "Yes": "Then I need the model card, the training data provenance, and
  a named human who will go to prison." / "…I will put you down as 'no'."
- If "No": "Good. Item two."
- If sparkle: "I have seen the sparkle. Item two."
- "Item two. The word 'settings' implies the user can change something. Can
  they?"
- (choice) "Yes, that's the toggle." / "Technically."
- Either: "Then we call it a 'preference'. Preferences are not promises.
  Item three."
- "Item three is that I have a call. Approved. Do not quote me. Nothing I
  say is quotable. I have that in writing, from me."

After sign-off (repeat visit):
- "It is a preference now. I feel nothing about this, which is how I know
  it is correct."

### Teddy Vance — VP Communications (Comms)

Warm, fast, has never finished a sentence that did not contain the word
"story." Wears a headset that is not connected to anything. Wants a launch
narrative, and the toggle is not one.

First visit:
- "Hey! Hey. You're the story. Sorry — you're the engineer. Same thing up
  here."
- "Okay so what I need from you is a *moment*. The toggle is not a moment.
  The toggle is a Tuesday."
- "Come back when I can feel it."

Sign-off visit (build ≥ 50):
- "Talk to me. What does the user feel when they flip it?"
- (choice) "Relief." / "Nothing. It's a setting." / "They feel seen."
- "Relief": "Relief is a *story*. 'Relief, delivered.' Keep going."
- "Nothing": "…That is honest, and honest is a story, and I hate that it
  is. 'The setting that asks nothing of you.' Keep going."
- "Seen": "Yes. YES. Say less. Actually say more, I'm writing."
- "Now: Lighthouse. Can I say the toggle *is* Lighthouse?"
- (choice) "No." / "You're going to anyway."
- "No": "I am, though. I'm going to say 'powered by'. 'Powered by' is
  legally nothing. Priyanka signed off on 'powered by' in 2021 and has
  regretted it every quarter since."
- "Anyway": "See, you get it. Approved. I'm putting you in the deck. Not
  your name — your *energy*."

After sign-off:
- "The narrative is locked. Don't change anything. If you change anything,
  change it quietly, and tell me first, so I can be surprised on stage."

### Ines Ferreira — VP Finance

The only person on the floor who reads the numbers, which makes her the
most dangerous. Speaks in questions that already have answers. Not a
villain. She would like the company to exist next year.

First visit:
- "Lighthouse has cost forty-one million dollars and shipped a toggle."
- "That is not a complaint. It is the best ratio we have."
- "Come back when it's half done. I do not fund promises. I fund the second
  half of things."

Sign-off visit (build ≥ 75):
- "How many engineers does the toggle need to keep working?"
- (choice) "Zero." / "One, occasionally." / "It's forty lines."
- "Zero": "Correct answer. Wrong, but correct."
- "One": "Then it is a team of one and a team is a line item. Say zero next
  time. Say it to me now."
- "Forty lines": "I do not know what a line costs. Nobody has ever been
  able to tell me. I have stopped asking, and that is how I know I have
  been here too long."
- "Second question. If Lighthouse is announced with your toggle inside it,
  and Lighthouse is cancelled in the spring — which it will be — does the
  toggle keep working?"
- (choice) "Yes. It doesn't depend on Lighthouse." / "I'd have to check."
- "Yes": "Good. Then it is the only part of Lighthouse that survives, and
  the only part that was never in the budget. Approved."
- "Check": "Check. Then come back and say yes. Approved, conditionally.
  Everything I approve is conditional. The condition is that I was right."

After sign-off:
- "The toggle is on the balance sheet now. Under 'other'. That is the
  highest honor Finance has."

### Rand Voss — Founder

The letter, in person. He does not talk to you so much as narrate near you.
He is in the middle of a sentence when you arrive and still in it when you
leave. He never learns your name; he calls you "the toggle," approvingly.

He is the boss fight of the chapter — a *verbal* one, same engine as
Brayden but longer, with two phases. Phase one he monologues (attacks are
paragraphs). Phase two, at half conviction, he "gets curious," which is
worse: he asks you questions, and the wrong answers heal him.

First visit (door locked until all three sign-offs):
- The door is glass. He is visible, standing, speaking to someone who is
  not there. A sign on the door: "IN FLOW. DO NOT KNOCK. KNOCKING IS A
  DECISION."

Founder sign-off (all three sign-offs, build 100):
- "The toggle. Come in. Do not sit; sitting is a posture of the past."
- "I read the deck. I did not read it. I *received* it. Teddy says you are
  the story. Ines says you are the only thing that works. Priyanka says
  nothing, which is her highest praise."
- "I want you to understand what you have built. You think it is a
  preference. It is a *lighthouse*. A light that does not move, so that
  everyone else can."
- "I built the first one. 2019. Two of us, one winter." (He believes this.
  The player has heard Mara say the same sentence about herself.)
- "Now. Let's align."
- Boss: **Rand Voss — Founder's Alignment**. Title bar: "1:1 (no agenda) —
  THE FOUNDER". Intro: "Rand shares his screen. It is a photograph of a
  lighthouse. He has not noticed."

Boss moves (phase one):
- "Rand explains that autonomy is solved. The explanation takes six years."
- "Rand tells you he sleeps four hours and wakes up correct. You feel
  tired on his behalf."
- "Rand quotes the Doctrine. The Doctrine quotes Rand."
- "Rand says 'not inevitable — me.' The room gets warmer."

Phase two (at 50%, "Rand gets curious"):
- "Rand asks what you would do with a billion dollars." Choices: "Ship the
  toggle" (damage) / "Fix Lighthouse" (he heals: 'Nothing is broken') /
  "Buy a window for your room" (big damage; he is silent for a full turn).
- "Rand asks who built Lighthouse." Choices: "You did" (heals him) / "Mara
  did" (damage, and sets `flags.said_mara`) / "The bottom of it was Mara.
  The name was you." (critical; sets the flag; he says: "…Yes. That is a
  more accurate history. Write it down. Not in the deck.")

Win: "Rand approves. He does not say approved. He says 'obviously,' which on
this floor is a signature."

### Dee, upstairs

Dee (onboarding buddy from Floor 3) has been promoted to "Chief of Staff
(interim)" and has a desk at Reception. She is the chapter's map and heart.

- "They moved me up here to be near the decisions. I have not seen one. I
  have seen forty decks."
- "Legal is west, Comms is east, Finance is the one with the dashboards.
  Rand's door is north, and it does not open for people. It opens for
  sign-offs."
- "The war room is yours. Don't move anything on the wall. Nobody knows
  what the sticky notes mean and everyone is afraid of the one that is
  blank."
- "Your desk up here has a nameplate. Don't read it yet." (If the player
  has read it: "You read it. Okay. Then you know what this floor is.")

### Marcus, on rotation

Security gets a desk on 6 for the launch. He is here for one quest (side
quest 2) and one line:
- "I'm up here because someone put the launch password on a sticky note in
  a glass room. I am the sticky note now."

### Mara, absent

She does not appear on Floor 6. She has been laid off between chapters
("a sharpening of focus"). Her presence is: the nameplate, a runbook under
the war room desk (pages 41–80 of the one from Floor 3), and a single
email, unread, on the war room monitor, dated the day she left:

> subject: (no subject)
> "It works. It always worked. The top is the part that keeps breaking.
> Don't let them rename the bottom. — M"

That email is the emotional load-bearing wall. It should be one screen, no
choice, and the player should be able to walk away from it.

## Side quests

### 1. The Blank Sticky Note (giver: Dee)
The war room wall has one blank sticky note. Everyone is afraid of it.
Steps: ask three people what it means (Teddy: "It's the *vision*." Ines:
"It's the budget." Priyanka: "It's mine. I put it there. It means nothing.
Watch what happens."). Resolution: you can take it down (Priyanka: "Nobody
noticed. Nobody will. That was the experiment.") or leave it. Reward:
credits, and the note in your bag as an item that does nothing.

### 2. The Password on the Wall (giver: Marcus)
The launch password is on a sticky note in the glass war room. Marcus wants
it gone but cannot touch it (chain of custody). Steps: find the note (it is
the one that says VELOCITY2024!, in Teddy's handwriting), take it to Teddy
(he will not remember writing it, and asks you to write a new one), refuse
or comply. Comply: Marcus sighs and approves, "That's a rotation. It counts
as a rotation." Refuse: you carry it to Marcus and he shreds it in front of
you, which is the closest he comes to joy. Reward: the "Chain of Custody"
gear (DEF up).

### 3. The Fridge (giver: the fridge)
The Floor 6 fridge has one item in it with a name on it: RAND. It is a
sandwich. It has been there since the letter was written. Steps: ask Dee
(she will not discuss the sandwich), ask Ines ("It is on the books. As an
asset."), throw it out or leave it. Throw it out: nothing happens, which is
the point; a day later there is a new sandwich. Reward: a Perk credit and a
line in the ending.

### 4. The Nameplate (no giver; triggered by reading the desk)
Reading the war room nameplate starts it. Steps: find the runbook pages
under the desk; find Mara's email; then, in the Founder fight, answer "Mara
did" or the critical version. Completion sets `flags.said_mara`. This is
the only side quest that touches the ending.

## Encounters on 6

Quiet Room only, so the floor feels safe until it isn't. New enemies, same
engine:

- **Reply-All Storm (Executive)** — same as downstairs but everyone has an
  assistant who also replies.
- **The Offsite** — "The Offsite proposes trust falls. There is no one to
  fall on." Attacks lower DEF.
- **Slide 14** — a single slide that has been in every deck for three
  years. High HP, low attack. Weak to Scope Cut.
- **Someone's Mentor** — "Someone's Mentor asks what you *really* want.
  You want to leave the Quiet Room."
- **Q3** — the quarter itself. Boss-adjacent, only after Finance sign-off.
  "Q3 ends in nine days. Q3 has always ended in nine days."

## The war room desk

Same `startDesk()`; the header reads LDS-5001. `MEETINGS` gets three new
entries with catering: "Launch Readiness Sync (catered)", "Narrative
Alignment (Teddy, 45 min, 12 slides, 1 idea)", and "Founder Fireside (no
fire, no side)". `INTERRUPTS` gets: **Teddy** ("quick one — can the toggle
be a *button*? not functionally. emotionally."), **Priyanka** ("Do not
reply to Teddy."), **Ines** ("Is the toggle in the forecast? It is now.
Confirm."), and **Reception** ("Your 2pm is here. You do not have a 2pm.
They are here.").

Pipeline gets one wrinkle on 6: the sink is labeled LIGHTHOUSE and the
source is labeled MARA (2019). Nobody comments on it.

## The ending of chapter two

Board Room. The launch. Teddy on stage. The slide says LIGHTHOUSE — POWERED
BY LODESTAR INTELLIGENCE, and under it, in smaller type, "a preference."

Beats, narration, one line each:

- "Teddy says 'moment' eleven times. It is, to be fair, a moment."
- "The demo is your toggle. Teddy flips it. Nothing happens, because
  nothing is supposed to happen, and the room applauds the nothing."
- "Rand speaks for nineteen minutes about weather."
- "Ines watches the stock. It goes up half a percent. She writes the number
  down and underlines it, which is the only time you will see her feel."
- "Priyanka is not in the room. She is in the hallway, on a call, saying
  'no' in a way that sounds like 'we'll see.'"

Then the credit slide. If `flags.said_mara`:

- "The last slide is credits. It is the one slide Teddy did not write. It
  says: Lighthouse — foundation: M. Okafor, 2019."
- "Nobody in the room knows who that is. One person, in the hallway, on a
  call, stops talking for a second."

If not:

- "The last slide is credits. It says: Lighthouse — a LODESTAR original."
- "It is not wrong. That is what makes it the kind of true this floor
  prefers."

Then, either way:

- "You go back downstairs. Your desk on 3 is still there. Someone has left
  a sandwich on it, with your name on it, spelled almost right."
- "END OF CHAPTER TWO."

## What still needs deciding (owner's call)

- Mara's surname. `Okafor` is a placeholder; pick one and check it is not
  a real person at a real company doing this.
- Whether Floor 6 is reached from the elevator on 3 (recommended: the
  elevator becomes interactable after chapter one, with a badge check that
  fails once for a laugh) or as a hard cut at the start of day two.
- Whether the day-two ticket loop continues after chapter two (it should;
  swap in LDS-5002 "Remove Lighthouse" and let `ticket()` cycle).
