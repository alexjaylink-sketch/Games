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
for (const k of ['shipit_lodestar_v2'])
  cache[k] = (await Preferences.get({ key: k })).value;
window.__store = {
  get: k => cache[k] ?? null,
  set: (k, v) => { cache[k] = v; Preferences.set({ key: k, value: v }); }
};
```

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

1. **More content.** One floor and one ticket is the honest weak point. All five
   build tools now exist (the last two unlock off the design review and the
   Thing quest); a Floor 6 and a second ticket shape would roughly double it.
2. **Audio** — done, and it was the cheapest item on this list.
3. **Something that makes it feel like an app, not a page**: haptics on
   interruptions (`@capacitor/haptics`), a proper app icon and splash.

Ship to **itch.io and as an installable PWA first**. Both are free, neither has
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
