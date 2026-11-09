# Mercatus Cartel — portfolio pack

Static, high-end Event mode mockups and architecture docs for **Messmakers / Mens Mercatus Inc / Netza**.  
Open the UI from `event-mode/web/index.html` (any browser / static host). No Event backend to run.

**Visual system:** red / black / white · 16px wheat mark on every mockup page and PDF · no personal names or faces.


---

## What the system does

Mercatus Cartel is the product shell for a South African social + gigs + wallet surface:

- **Jobs hub (five pillars):** delivery / gig matching · anonymous queue-standing errands · **Event mode** (festival staffing) · basket kits · homestay  
- **Event mode (this pack’s focus):** signup gate (18+, health declaration, criminal-check refs) · rate lock at/above gazetted NMW (R30.23/ordinary hour from 1 Mar 2026; 4-hour minimum pay rule where employment applies) · check-in/out with geo/time windows and supervisor checkout · skills-certification ladder (not punishment) · vehicle checklists · no-show policy · dispute + evidence pack · payout release to Netza/ledger after supervisor checkout with no open dispute  
- **Close friends:** consented P2P payment GPS (minimized) · live location ping only if per-friend allow is on (default off), showing time + price context  
- **Wallet:** Netza (ZAR tips, escrow releases, credits) — separate from any Netzar legal track  
- **Compliance gates (product rules reflected in mockups):** NMW floor · POPIA SA ID redaction · no SASSA credential handling · goods delivery vs NLTA-gated passenger e-hailing  

Sister brand label: **Mens Mercatus Inc**.

---

## Which AI was added

**Mercatus Cartel Robot** — in-product assistant with two surfaces:

1. **Assist** — one quiet ghost control per tool (`POST /api/mercatus-cartel/assist` with `{ toolId, intent, context }`)  
2. **Chat shell** — optional panel for diagram / “what next” questions (`POST /api/mercatus-cartel/chat`)

Prompt copies live under `robot/MERCATUS_CARTEL_SYSTEM_PROMPT.md` (and `.txt` / backend twin). Plan: `docs/ai-in-every-tool-plan.md`.

### How AI is wired to each tool

| Tool surface | toolId (intent examples) | What Assist does |
|---|---|---|
| Search / discover | `search` | Rank + one “why this” caption |
| Composer / post | `composer` | Draft in brand voice |
| Wallet / Netza | `wallet.netza` | Explain a line item in ZAR English — never invent balances |
| Gigs / escrow | `jobs.gigs` | Missing-field checklist + risk flags |
| Event mode | `jobs.events` | Coach signup, rate lock, checklist, no-show paths — never invent floor rates or payout amounts |
| Close friends | `friends.ping` / `friends.pay` | Consent/purpose coaching; never reveal location without auth; never invent coords |
| KYC / verify | `kyc` | Step coach (e.g. SA ID front) |
| Diagrams | `diagrams` | Session welcome + one-sentence node explain |
| Settings | `settings` | Privacy preset + diff |
| Support | `support` | FAQ first |

**Hard Assist refusals (prompt + product rule):** no coaching unlicensed passenger e-hailing; no recommending specific payout amounts; no inventing balances/KYC; no returning full SA ID numbers; no SASSA credential handling; tools must work if Assist fails.

Reference robot implementation (optional to run): `robot/backend` + `robot/frontend`. Event mockups are **static** and show Assist as inline UI only.

---

## Kubernetes deployment architecture (target)

Portfolio target topology (see `docs/diagrams/kubernetes-topology.svg`):

- **Ingress** (TLS) → **API gateway**  
- **Deployments:** `web` (Flutter/static clients + CDN) · `api` (ASP.NET Core Jobs/Event/Wallet) · `assist` (Mercatus Cartel Robot) · `workers` (escrow timeouts, ladder recalc)  
- **Data:** PostgreSQL (primary + replica) · Redis (idempotency, rate limits, presence) · object storage (photo proof / checklists, encrypted at rest)  
- **Secrets:** sealed secrets / external secrets operator — never in images  
- **Autoscaling:** HPA on API and Assist; PDB on Postgres  

This pack ships **diagrams + static UI**, not cluster manifests.

---

## Backup & disaster recovery

| Layer | RPO / RTO (targets) | Method |
|---|---|---|
| PostgreSQL | RPO ≤ 5 min · RTO ≤ 1 h | Continuous WAL archiving + daily snapshots; restore drill quarterly |
| Object storage | RPO ≤ 15 min | Cross-region versioned buckets; immutable retention on dispute evidence |
| Redis | Ephemeral OK | Rebuild from source of truth; idempotency keys re-issued |
| Secrets | — | Dual-region KMS; break-glass runbook |
| Assist prompts / policies | Git | Tagged releases; rollback by image digest |

**DR posture:** multi-AZ primary region; warm standby read replica; documented failover ownership; escrow **Held** funds never auto-released during failover without supervisor/policy check.

---

## Offline capability

| Mode | What works | How |
|---|---|---|
| **View mockups** | All static Event pages | Local HTML/CSS/JS — fully offline |
| **Field worker (product target)** | Draft checklists, queue clock events, cache last Assist answers for open shifts | On-device encrypted queue; sync on reconnect; conflict policy = server escrow state wins for money |
| **Assist offline** | Cached explanations for known toolIds only | No new model calls; banner: “Assist cached / offline” |
| **Does not work offline** | Live payout release, live close-friend ping, new escrow fund, KYC vendor calls | Require connectivity + server authority |

Design rule: **money and identity never settle client-side.** Offline can stage evidence; release stays server-side after supervisor checkout and no open dispute.

---

## Pack layout

```
mercatus-cartel/
  assets/                 wheat 16px marks
  event-mode/web/         static Event mockups (open index.html)
  docs/diagrams/          architecture schematics (svg + png)
  docs/pdfs/              balance sheet · balance book · ops logbook
  docs/ai-in-every-tool-plan.md
  robot/                  Assist prompt + optional ASP.NET robot
  background/             cursor-reactive background
  README.md               this file
```

### Static Event pages

`event-mode/web/index.html` · signup-gate · rate-lock · check-in-out · points-ladder · vehicle-checklist · no-show · dispute · payout · close-friends · settings · diagrams

### Schematics

`docs/diagrams/overall-system-architecture` · `ai-assist-integration-pipeline` · `kubernetes-topology` · `event-mode-data-flow` · `close-friends-gps-ping-flow` · `compliance-gates` · `five-jobs-pillars` (each `.svg` + `.png`)

### PDFs

`docs/pdfs/mens-mercatus-balance-sheet-example.pdf`  
`docs/pdfs/mens-mercatus-balance-book-example.pdf`  
`docs/pdfs/mens-mercatus-logbook-example.pdf`

---

## Compliance snapshot (demo copy)

- NMW floor **R30.23**/ordinary hour; employment path applies **4-hour** daily minimum pay rule  
- POPIA: redact SA IDs server-side; location sharing needs purpose-tagged consent; close-friend ping default **deny**  
- Transport: goods delivery ≠ passenger e-hailing (NLTA licence gate)  
- Assist never replaces judgment on money or identity  

Illustrative figures only — not legal advice; SA counsel for production.
