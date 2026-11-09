# Mercatus Concierge — Automation video render notes

## Output
- **File:** `/workspace/mercatus-concierge-site/pitch-video/mercatus-concierge-automation.mp4`
- **Duration:** ~98.98 s (AAC narration + H.264 1280×720)
- **Brand:** Blueprint cream / charcoal / red (`#F5F0E8` / `#121010` / `#C8102E`)

## Script source (no new pitch invented)
- Narration is the **Full continuous narration** in `pitch-video/automation/SCRIPT.md`.
- That text is taken verbatim from the user’s cold-call playbook:
  - `docs/Mercatus-Concierge-Cold-Call-Pitch-Playbook.md` **§2 Demo walk** CALLER lines
  - **§3** 90-second pitch
  - Tagline: “Your digital footprint. One concierge.”
- Captions on the video use only desk names and the live URL already in that pitch:
  Talk with Assist, Ops Launch, Role Kits, Client Portal, Launch Path, Deploy Path, Meeting Desk, Workspace, and `mensmercatus.online/apps/makedas-canvas`.
- **No new pitch angle or marketing copy was invented.**

## Visuals
- **Primary:** Ken Burns / soft vignette / light pulse on the ace portrait  
  `mensmercatus-portfolio/assets/marks/ace-portrait-face.png`  
  (copied to `pitch-video/automation/portrait.png`).
- **Optional B-roll:** brief cuts to cream atelier shots under  
  `pitch-video/automation/shots/` (`01-hero`, `02-ops-or-kits`, `03-portal-or-paths`, `04-meeting-workspace`).
- The short 8s reel `mercatus-concierge-pitch.mp4` was **not** used or remixed.

## Audio
- TTS via `edge-tts` voice **en-US-GuyNeural** (rate −5%), from `narration.txt` extracted from SCRIPT.md continuous narration.
- Muxed as AAC in the final MP4.

## Site embed
- `index.html` hero + portfolio `<video>` `src` slots point at  
  `pitch-video/mercatus-concierge-automation.mp4` (replacing the prior 8s reel path).
- Easy Apply / Careers DropNet untouched.
