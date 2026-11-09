# Mercatus Careers (Carrier LLC) — Integration Report

**Date:** 2026-10-07 SAST · **Tree:** `/workspace/mensmercatus-portfolio/` · **Canonical app:** `apps/mercatus-careers/`

---

## Integrated

- **Parent shell:** `apps/mercatus-careers/` — branded **Mercatus Careers · Mercatus Carrier LLC**
  - Tabs: Feed · Boards · **Drop** · **Bulk** · Intel · Tracker · Profile (+ job desk via `#/job?id=`)
  - Blueprint dark chrome, Inter/Space Mono (via portfolio CSS), `#c8102e` accents, tab-ink + light atmosphere wash
- **JobNet** feed/boards/intel/tracker/profile/job-desk logic ported into Careers `js/app.js`
- **DropNet** draft UX mounted as **Drop** tab (templates inlined from `apps/drop-net/demo-drop.js`; `demo-drop.js` kept on disk for reference)
- **Aliases / redirects (canonical Careers URL):**
  - `apps/jobnet/` → `../mercatus-careers/#/feed` (hash preserved when present)
  - `apps/drop-net/` → `../mercatus-careers/#/drop`
- **Hub / Apps / Home cards:** primary **Mercatus Careers (Carrier)** → `apps/mercatus-careers/`; Drop card → `#/drop`
- **Staging mirror:** critical paths copied to `/workspace/staging-mensmercatus/apps/mercatus-careers/` (+ jobnet/drop-net redirects, hub/index/apps index)

---

## Enhanced

- Shared status strip: JobNet API health + Assist health (`llmConfigured` / model)
- Job desk → **Build Drop packet** prefill into Drop tab (`sessionStorage`)
- Tracker / profile / listings keys migrated to `mm.careers.*` with one-time read of legacy `mm.jobnet.*`
- Assist LIVE on Fit / Brief / Packet / Outreach / Interview (+ compact Ask Assist chat); offline template fallback + toast
- DEMO vs LIVE labelling on status pills and bulk cards
- Bulk Apply desk: queues DRAFT packets only (UI + file inbox)
- Clear draft-only footers / banners (no auto-apply marketing)

---

## Removed / not pulled

- BeBee removed from primary board chips (no Radar)
- Did **not** pull: Creative Suite iframe, Lab parliament/twin, Sweep-all-19, Event Net, Net Workspace, Google Jobs / Braintrust / etc.
- Event Net / Net Workspace left untouched under their existing homes
- `jobnet-shell.js` — not present (nothing to delete); no new dead refs added
- Duplicate “auto-apply” product implication avoided; copy stays human-gated submit

---

## AI hook status — **PASS**

| Check | Result |
|-------|--------|
| `GET /health` | `llmConfigured: true`, model `gemini-2.5-flash` |
| `POST /api/mercatus-cartel/assist` `toolId: careers` | **OK** — smoke suggestion returned |
| `POST /api/mercatus-cartel/chat` `toolId: careers` | **OK** |
| Bulk tailor (16 roles) | **16/16 assist** · 0 offline · 0 errors |

### Smoke evidence (Assist)

- **Model:** `gemini-2.5-flash`
- **Suggestion (excerpt):** "This role is a strong fit for your expertise in Python, TypeScript, and .NET, especially with your background in distributed systems. Your skills in LLMs, RAG, and agent development are particularly relevant for Kriterion's advanced projects."

### Smoke evidence (Chat)

- **Model:** `gemini-2.5-flash`
- **Content (excerpt):** "Highlight practical projects that solve real-world problems, especially those with a local South African context, to showcase your applied AI skills effectively."

Job desk tools call the same Assist endpoint with `toolId: "careers"` and fall back to local generators on failure.

---

## Bulk Apply — draft queue built (LIVE submit **blocked**)

| Field | Value |
|-------|--------|
| Status | **Draft queue built** — no live LinkedIn/Glassdoor/ATS submits, no Gmail sends |
| Posts targeted | **16** (all from current shortlist; boards: ['linkedin']) |
| Assist-tailored | **16** |
| Offline fallback | **0** |
| Live submits executed | **0** |
| Inbox paths | `/workspace/jobnet/tailor-inbox/` · `apps/mercatus-careers/bulk-apply/` (`manifest.json` + per-role JSON) |
| Careers Bulk UI | Auto-imports `./bulk-apply/manifest.json` when browser queue empty; can also re-queue via Assist |

### Roles queued (all need approval before any LIVE apply/send)

- **Intermediate Software Engineer** @ Kriterion · linkedin · signal high · mode assist · model gemini-2.5-flash · `https://za.linkedin.com/jobs/view/4474039491`
- **AI Engineer (Intermediate) — listed as Ai Developer** @ Liquid Thought · linkedin · signal high · mode assist · model gemini-2.5-flash · `https://za.linkedin.com/jobs/view/4474618632`
- **Lead / Senior AI Engineer** @ Nutun · linkedin · signal high · mode assist · model gemini-2.5-flash · `https://za.linkedin.com/jobs/view/4474036608`
- **Senior AI Engineer (OZ) — contract** @ DVT · linkedin · signal high · mode assist · model gemini-2.5-flash · `https://za.linkedin.com/jobs/view/4475584836`
- **Senior Full Stack Developer** @ Smollan Technologies · linkedin · signal high · mode assist · model gemini-2.5-flash · `https://za.linkedin.com/jobs/view/4474037954`
- **Lead AI Engineer & Senior AI Engineer** @ Communicate Recruitment · linkedin · signal high · mode assist · model gemini-2.5-flash · `https://za.linkedin.com/jobs/view/4473640591`
- **Senior .NET Developer** @ Games Global · linkedin · signal medium · mode assist · model gemini-2.5-flash · `https://za.linkedin.com/jobs/view/4473656687`
- **Senior ML Engineer — contract** @ Mindworx Consulting and Academy · linkedin · signal medium · mode assist · model gemini-2.5-flash · `https://za.linkedin.com/jobs/view/4474686426`
- **Lead Engineer, AI Platform** @ Jobgether (partner listing) · linkedin · signal medium · mode assist · model gemini-2.5-flash · `https://za.linkedin.com/jobs/view/4474691226`
- **AI Analyst** @ Parvana · linkedin · signal medium · mode assist · model gemini-2.5-flash-lite · `https://za.linkedin.com/jobs/view/4473661037`
- **Full-Stack Developer (Senior)** @ Parvana · linkedin · signal medium · mode assist · model gemini-2.5-flash-lite · `https://za.linkedin.com/jobs/view/4473666018`
- **Lead Software Engineer** @ Humankind Group · linkedin · signal medium · mode assist · model gemini-2.5-flash-lite · `https://za.linkedin.com/jobs/view/4476147900`
- **AI Implementation Engineer (Claude Cowork)** @ HIREXE · linkedin · signal medium · mode assist · model gemini-2.5-flash-lite · `https://za.linkedin.com/jobs/view/4475562744`
- **Solutions Architect** @ The Shoprite Group of Companies · linkedin · signal medium · mode assist · model gemini-2.5-flash-lite · `https://za.linkedin.com/jobs/view/4474044276`
- **Senior .NET Software Engineer** @ Entelect · linkedin · signal low · mode assist · model gemini-2.5-flash-lite · `https://za.linkedin.com/jobs/view/4460447887`
- **Full-Stack Python Developer** @ Prime South Africa · linkedin · signal low · mode assist · model gemini-2.5-flash · `https://za.linkedin.com/jobs/view/4476141726`

### Needs explicit user approval before LIVE

- Clicking Apply on LinkedIn / Glassdoor / Pnet / Careers24 / any ATS
- Sending outreach email via Gmail
- Any automated POST to an employer application endpoint

**Policy:** Careers Bulk desk and tailor inbox only produce draft packets. Opening a posting link is read-only; Apply / Send remain human actions after approval.

---

## Open items

1. **Voice pickup (unfinished):** user started to say **"and start…"** on the call but did not finish — leave as open pickup for next turn.
2. Glassdoor shortlist empty this run (API noted Cloudflare 403) — SA chips (Pnet/Careers24) remain filter-only until scrape includes them.
3. Bulk UI queue is browser `localStorage` (`mm.careers.bulk.v1`); file inbox is the batch artifact from this integration run — optional next step: one-click “Import manifest” into the Bulk tab.
4. Homepage/hub still mention scheduled JobNet Grok Bot routines in places — accurate, but could be renamed to Careers wording in a later pass.
5. Live employer Apply / Gmail Send: **not started**; waiting on explicit approval per role (see Bulk section).

---

## How to open locally

```bash
cd /workspace/mensmercatus-portfolio && python3 -m http.server 8769
# then http://127.0.0.1:8769/apps/mercatus-careers/
```

---

## Success checklist

- [x] Careers shell loads with JobNet desks + Drop desk + Bulk
- [x] AI Assist E2E pass (assist + chat + 16 bulk drafts)
- [x] Report written
- [x] Hub / apps index discoverable Careers card
- [x] Draft-only forever for this run (0 live submits)
