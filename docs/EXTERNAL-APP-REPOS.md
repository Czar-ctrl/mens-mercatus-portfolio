# External app sources (not fully in this repo)

This portfolio records the following as **symlinks**. Clone or submodule them
separately; `git clone` of this repo alone will not fetch their file contents.

| Path in portfolio | Points at (box) | Live URL |
|---|---|---|
| `apps/sound-deck` | `/workspace/mens-mercatus-sound-deck` | `/apps/sound-deck/` |
| `apps/mercatus-canvas` | `/workspace/mens-mercatus-creative-suite/mercatus-canvas` | `/apps/mercatus-canvas/` |
| `apps/mercatus-assist/frontend` | `/workspace/mercatus-cartel/robot/frontend` | Assist UI CSS/JS |
| `apps/mercatus-assist/backend` | `/workspace/mercatus-cartel/robot/backend` | (dev) |
| `apps/mercatus-assist/background` | `/workspace/mercatus-cartel/background` | Assist bg |
| `blueprint/robot/frontend` | same cartel frontend | |
| `blueprint/robot/backend` | same cartel backend | |

Sound Deck also has its own `.htaccess` on DreamHost allowing `microphone=(self)`
under `/apps/sound-deck/` only; account-home `.htaccess` still blocks mic elsewhere.
