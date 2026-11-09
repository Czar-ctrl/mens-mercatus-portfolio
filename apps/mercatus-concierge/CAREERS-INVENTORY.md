# Mercatus Careers (“Carrier”) — Inventory

**Date:** 2026-10-07 SAST · **Source:** `workshop/sites/careers/` (`app.js`, `atmosphere.js`, `index.html`)  
**Compare:** portfolio `apps/jobnet/` (lean shell: Feed/Boards/Intel/Tracker; `js/app.js` not present yet) · `Job-Net-INVENTORY.md` (native WKWebView → `127.0.0.1:8766/#/architect`)  
**Gaps on this box:** `./styles.css` and `../shared/elite-layouts.{css,js}` referenced but missing · `127.0.0.1:8766` unreachable from box

---

## Full inventory

### Routes / tabs (hash)
Default `#/architect`. Tab bar: Architect HQ · Creative Suite · Feed · Search · Boards · Radar · Intel · Lab · Tracker · Profile.  
Also routed (no tab): `#/job?id=` · `#/browse?u=` (iframe via `/view?url=` or localhost).

### Boards list (from `SOURCES` in app.js — **19 keys**; UI copy says “18”)
| Group | Named boards |
|-------|----------------|
| **SA (10)** | BeBee, Pnet, CareerJunction, Careers24, JobVine, JobMail, BestJobs, BizCommunity, Gumtree SA, JobisJob SA |
| **Global (5)** | Indeed, LinkedIn Jobs, Glassdoor, Google Jobs, Jora |
| **AI (4)** | Braintrust, Snaphunt, Cutshort, Veritone Hire |

**Note:** Audit backend `job_sources.py` registries **18** scrape keys (no BeBee; `veritone_hire`). BeBee is UI/Radar + static platform stats, not in that Python registry. Footer names 14 of the UI set (drops BestJobs, BizCommunity, JobisJob, Google Jobs, Veritone).

### Features
- **Listings:** Feed (`/api/feed`) with q / remote / region / source; auto_query from profile; fit badges; ZA / live / offer pills; Architect dual-stream (local+hybrid vs remote world).
- **Search:** Catalog boards + `/api/jobs` + skill-graph (`/api/ai/skill-graph`).
- **Sweep:** Boards tab → `POST /api/jobs/sweep-all` (per-source cards, jump to Feed/Radar).
- **Job desk:** Fit, brief, **Fill & attach packet**, interview sim, outreach draft→Outbox, offer oracle, portfolio forge, career path; interview-memory distill; salary intel link; ideas overlay.
- **Apply policy:** Local packet only — “you submit on the employer site” (no auto-apply).
- **Tracker:** `localStorage` `mercatus.careers.tracker.v1` — stages saved→applied→interview→offer→closed; JSON export.
- **Intel:** Glassdoor salary (`/api/jobs/salary`) + ZAR×rate; BeBee stats; 18-board coverage map; Braintrust eval blurb; Google for Jobs schema notes.
- **Radar:** BeBee-branded company investigate list from feed; evidence case → tracker.
- **Lab:** Engines from `/api/careers/lab` (Ollama-first; optional hosted “Grok” checkbox). Catalog engines (backend): embed_rank, fit, skill_graph, interview, career_path, parliament, twin, opponent, route, research.
- **Profile:** CRUD `/api/profile`, CV upload/sync, drafts/outbox list.
- **Architect HQ:** Dual feed + client-side ATS dossier generator (templated talking points).
- **Creative Suite:** iframe `/preview/extrafazant-studio/`.
- **ATS angle:** Company ATS catalog in Search; Greenhouse-style boards mentioned in lab backend; dossier UI is local text, not a live ATS submit.

### UI patterns
Canvas **atmosphere** (orb field + cursor orb, reduced-motion aware) · tab ink slider · theme toggle (`mercatus.theme`) · preset pills (Architect local/remote, 18-board sweep, Dual-Stream HQ) · post/board/radar/lab cards with IntersectionObserver reveal · View Transitions (non-blocking) · toasts · source filter chips · split job desk.

### Data / API
- **UI serve:** Careers port **8766** (`MERCATUS_CAREERS_PORT`); Job-Net.app loads `#/architect` there.
- **API base in app.js:** hard-coded `http://127.0.0.1:8765` (lab `serve_ui.py`).
- **Endpoints used:** `/api/feed`, `/api/catalog`, `/api/jobs`, `/api/jobs/sweep-all`, `/api/jobs/salary`, `/api/jobs/related`, `/api/jobs/lookup`, `/api/job-ideas`, `/api/ai/{fit,brief,interview,outreach,offer-oracle,portfolio-forge,career-path,skill-graph,interview-memory}`, `/api/apply/packet`, `/api/careers/lab`, `/api/profile`, `/api/profile/upload`, `/api/profile/sync`, `/api/drafts`, `/view?url=`.
- **Declared unused:** `DESIGN_API = "/api/design"`.
- **Proxy ports:** browse default `8768`; Creative Suite preview path on lab host.

---

## Worth pulling (lean JobNet — LinkedIn/Glassdoor + SA core)

1. **Feed + source chips** — already matches portfolio tabs; keep LinkedIn, Glassdoor, + SA core (Pnet, Careers24; optionally CareerJunction / JobMail).
2. **Job desk draft stack** — fit · brief · packet · outreach (draft-only) · interview.
3. **Tracker** (localStorage stages + export).
4. **Boards sweep UI** — but only for the shortlist, not all 19.
5. **Intel salary** (Glassdoor path) — drop BeBee/Braintrust/Google Jobs encyclopedias.
6. **Profile → auto_query** for feed.
7. **Atmosphere / tab-ink / preset pills** — visual DNA already half-ported in `jobnet-app.css`.

---

## Worth embedding

**Concierge (cold-call / Launch Path / Meeting Desk)**  
- Architect dual-stream + preset pills as a **“Launch Path” demo strip** (local vs remote roles).  
- Job desk packet + tracker as **Meeting Desk** proof (“draft before you apply”).  
- Atmosphere + tab ink as shared Concierge chrome language.  
- Skip Creative Suite iframe and Lab parliament on the sales page.

**Portfolio (`apps/jobnet` / homepage)**  
- Show Feed / Boards / Intel / Tracker (shell already).  
- Port lean `app.js` from careers with board whitelist.  
- Homepage card: “Draft-only careers desk · LinkedIn + Glassdoor + SA”.

---

## Worth enhancing

- **Fewer boards in UI** — align SOURCES, footer, and “18” marketing; whitelist LI/GD + SA.
- **Draft-only apply** — rename “Fill & attach” → “Build apply packet”; never imply agent-submit.
- **Clearer Intel** — salary + board coverage for kept boards only; kill static BeBee/Braintrust panels.
- **Performance** — atmosphere DPR cap already 2; pause canvas when tab hidden; avoid dual `/api/feed` on Architect until visible.
- **Relative API base** — stop hard-coding `8765` for portfolio deploy.
- **Ship missing CSS** or point careers at portfolio `jobnet-app.css` tokens.

---

## Skip / drop (kitchen-sink vs lean mandate)

Creative Suite iframe · full Lab (parliament/twin/opponent/route) · BeBee Radar · Google Jobs / Braintrust / Snaphunt / Cutshort / Veritone · BestJobs / BizCommunity / JobisJob / Gumtree (unless SA “core” expands) · offer oracle / portfolio forge / career-path on every job · ATS dossier theater · in-app browse proxy · Sweep-all-19 · Architect as default public route (keep Feed first for JobNet).

