# new-app

Scaffold for a new game/app. `index.html` is a blank canvas starter — open it
in a browser to confirm it loads, then build the actual game on top of it.

Rename this folder to something specific once you know what the app is
(e.g. `mv new-app my-game-name`).

## Workflow: developing from your tablet, syncing at home

1. **On the road (tablet):** open this repo in Claude Code on the web
   (claude.ai/code) or the Cowork app. Ask Claude to keep working on
   `new-app/` (or whatever you've renamed it to). Each session commits and
   pushes its work to this branch — `claude/cloud-dev-sync-setup-ud50ah` —
   directly on GitHub, so nothing lives only on the tablet.
2. **Checking progress:** view the file live on GitHub, or open the pushed
   HTML via GitHub Pages / raw URL / your browser's "open file" if you clone
   locally.
3. **Back home:** pull the branch down to your regular machine:
   ```
   git fetch origin claude/cloud-dev-sync-setup-ud50ah
   git checkout claude/cloud-dev-sync-setup-ud50ah
   git pull
   ```
   or merge it into `main` once you're happy with it.

No build step or dependencies are needed — every game in this repo (and this
scaffold) is a single self-contained HTML file, so "sync" is just git push
from the cloud session and git pull when you're back.
