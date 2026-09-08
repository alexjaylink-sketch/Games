# Shipping SHIP IT to the app stores

The game is one self-contained HTML file. Store distribution wraps that file in
a native shell — it is not a port and not a rewrite.

## Already done in the codebase

- **No network at runtime.** The three IBM Plex families are embedded as base64
  woff2 (`tools/embed-fonts.js`). Nothing is fetched, so the game renders
  correctly offline and doesn't look like a webview pointed at someone else's
  server — a pattern reviewers push back on.
- **Durable saves.** Versioned (`SAVE_VERSION`), with a migration function, and
  a **Save Code** the player can copy and paste to recover or move devices.
  This matters: web storage inside a mobile webview can be evicted by the OS.
- **A seam for native storage.** Set `window.__store = { get(k), set(k,v) }`
  before the game script runs and saves go to device storage instead of
  `localStorage`. See "Native saves" below.
- **Audio**, synthesised — no assets to ship or licence.
- **Accessibility.** Desk mode is the only timed content; Settings → Extra time
  gives 80% longer to react.
- **Portrait, fullscreen, installable** via the inline web app manifest.
- **A build number** on the title screen, so bug reports name a version.

## Native saves

The game reads and writes through a `Store` shim. In a Capacitor build, install
`@capacitor/preferences` and expose a synchronous cache before the game loads:

```js
import { Preferences } from '@capacitor/preferences';
const cache = {};
for (const k of ['shipit_lodestar_v2', 'shipit_vanta_v1'])
  cache[k] = (await Preferences.get({ key: k })).value;
window.__store = {
  get: k => cache[k] ?? null,
  set: (k, v) => { cache[k] = v; Preferences.set({ key: k, value: v }); },
  del: k => { delete cache[k]; Preferences.remove({ key: k }); }
};
```

`del` is not optional in a native build. The game clears a save it cannot parse
so the player is never stranded on a Resume button that fails forever; without
`del` that clear silently misses the native store.

Without this the game still works — it just uses `localStorage`, which iOS may
clear under storage pressure.

## Wrapping it

```sh
npm init -y && npm i @capacitor/core @capacitor/cli
npx cap init "SHIP IT" com.yourname.shipit --web-dir=build
node tools/build-artifact.js build/index.html   # or copy ship_it_rpg.html
npx cap add ios && npx cap add android
npx cap sync
```

Set `orientation` to portrait in the native configs. iOS builds need a Mac with
Xcode, or a CI service (Codemagic, EAS Build).

## What still needs doing — none of it is code

| | |
|---|---|
| **Apple Developer Program** | $99/year. Required to submit at all. |
| **Google Play Console** | $25 one-time. New *personal* accounts must run a closed test with **12 testers for 14 days** before production release — start this early, it's the long pole. |
| **Privacy policy URL** | Mandatory on both stores even though this game collects nothing. A single page stating that is enough. Both stores also want a data-safety / privacy-label form filled in — everything is "no data collected". |
| **Icons** | The manifest ships a placeholder SVG. Stores want real raster sets (iOS 1024×1024 plus the generated set, Android adaptive icons). |
| **Screenshots** | Per device class, from the real build. `node tools/playtest.js --shots out/` gets you clean captures to start from. |
| **Age rating** | Fill in the questionnaire. The script has no profanity; themes are mild workplace satire. |

## The real submission risk

**Apple guideline 4.2, "Minimum Functionality."** Apple rejects wrapped web
apps that feel thin. A ~25-minute game is on the line. What moves it the right
way, in order of value:

1. **More content.** One floor is the honest weak point. All five build tools
   exist, and after the chapter-one ending the game rolls into a day-two loop
   (a new ticket about the same toggle each day, reviews carried over, every
   tool open) so the desk stays playable. A Floor 6 with new people would be
   the next real expansion.
2. **Audio** — done, and it was the cheapest item on this list.
3. **Something that makes it feel like an app, not a page**: haptics on
   interruptions (`@capacitor/haptics`), a proper app icon and splash.

Ship to **itch.io and as an installable PWA first** (`node tools/package.js` makes the itch zip). Both are free, neither has
a review queue, and you find out whether people finish it before paying $99 a
year to find out.

## Legal

- The company is **LODESTAR Dynamics** and the founder **Rand Voss** — both
  invented. The earlier name collided with a real, well-known company selling
  into the exact market this game satirises. Keep the founder a composite; the
  moment he becomes identifiably one real person, this stops being satire of an
  archetype.
- There is no `LICENSE` file, which means all rights reserved by default.
  Decide that deliberately before publishing the source.


---

# Submission paperwork

Everything here is answerable from the code, not from a guess. Re-check it if
the game ever gains a network call, an ad, or an account.

## Privacy — the short version is "none"

The game collects nothing, sends nothing, and has no server. There is no
analytics, no crash reporting, no ads, no in-app purchase, no login, no
third-party SDK, and no tracking of any kind. The `store` playtest suite
asserts zero network requests at runtime, so this stays true by test rather
than by memory.

- **Apple privacy label:** *Data Not Collected.*
- **Google Play Data safety:** no data collected, no data shared; saves stay on
  the device; the player can delete them by clearing app storage.
- **Privacy policy:** both stores still want a URL. One honest paragraph is
  enough: the app stores a single save file on your device, collects no
  personal data, and transmits nothing.

## Age rating

Verified against the script, not assumed:

| Question | Answer |
|---|---|
| Profanity | None. A scan of the shipped text finds no swearing. |
| Violence | None. Conflict is meetings. |
| Sexual content, nudity | None. |
| Gambling, simulated gambling | None. |
| Alcohol, tobacco, drugs | None. Caffeine is a game resource. |
| Horror, fear | None. |
| User-generated content, chat | None. |
| Unrestricted web access | None. There is no network. |

Expected: **Apple 4+**, **Google Play Everyone**, **PEGI 3**, **ESRB Everyone**.
The satire is workplace comedy and reads well above a child's interest level,
but nothing in it raises the rating.

## The review risk that actually matters

Apple guideline **4.2 (minimum functionality)** is what rejects wrapped web
content, and the defence is that this is a real game rather than a site in a
shell:

- it runs fully offline, with fonts and icons bundled in the binary;
- it has its own home-screen icon and launch behavior, not a browser chrome;
- it is a complete game with progression, saves and an ending;
- it never points at a remote URL, so guideline **4.7** does not apply either.

Keep it that way. The moment the shipped build loads anything over the network,
both of those arguments weaken.

## Store listing checklist

- [x] App icon — `tools/make-icons.js` writes 180 / 192 / 512 / maskable PNGs
      into the document. A native build needs the same art at the platform
      sizes; render it from the same tool rather than redrawing it.
- [x] Portrait lock — declared in the manifest and enforced in the game, which
      pauses and asks for portrait on a phone held sideways.
- [x] Version string — `const BUILD`, shown on the title screen.
- [ ] Screenshots — 6.7" and 5.5" for Apple, phone and 7"/10" tablet for Google.
      The office, a desk session mid-interruption, a video-call fight, and the
      offer letter are the four that sell it.
- [ ] Short description, long description, keywords.
- [ ] Support URL and marketing URL.
- [ ] Privacy policy URL (see above).
- [ ] Apple: age rating questionnaire, export-compliance answer (no encryption
      beyond standard HTTPS — and this build makes no requests at all).

## Honest gaps

- **No native shell exists yet.** The Capacitor wrapping in the section above is
  written but has not been built or run on a device; the numbers and behavior in
  this repo are verified in Chromium at phone viewports, not on hardware.
- **Not tested on a real iPhone or Android handset.** Safari and real touch
  input can differ from headless Chromium.
- **Two floors, two chapters, plus the repeating day loop.** Longer than it was,
  still short for a paid release. The four Floor 6 side quests in
  `docs/floor6-draft.md` are written but not built.
