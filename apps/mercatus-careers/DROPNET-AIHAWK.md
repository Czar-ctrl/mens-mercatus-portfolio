# DropNet · AI Hawk · Mens Mercatus Blueprint

Operational daily job-lead desk inside **Mens Mercatus Blueprint**.

## Open the UI

- Blueprints Drop tab: `https://mensmercatus.online/apps/mercatus-careers/#/drop`
- Alias redirect: `/apps/drop-net/` → Blueprints `#/drop`
- Local host: `/workspace/mensmercatus-portfolio/apps/mercatus-careers/`

## What the Drop tab shows

- Header: **DropNet · AI Hawk** operational desk
- **Apply mode** control (segmented): **Manual** | **Automatic** | **Bulk** — near header / status strip
- Status strip: last scrape time, lead count, daily digest draft target (`katlego.mokoto.km@gmail.com`), active mode
- Leads from `./dropnet/latest.json` — sorted by fit %, grouped **Top matches** / **Also worth a look**
- Per lead: title, company, location, fit %, why line, **Open**, **Apply** (deep link), **Draft packet**, optional **Queue apply**
- Vacancy → cover/CV draft (template + Assist `toolId: careers`)

## Apply modes (user-selectable · localStorage)

Persisted key: `mm.careers.dropnet.applyMode.v1`

```json
{
  "mode": "manual",
  "threshold": 80,
  "bulk": { "days": [1, 2, 3, 4, 5], "time": "08:17" },
  "autoConfirm": false
}
```

Defaults: **Manual**, threshold **80**, Bulk weekdays Mon–Fri at **08:17** Africa/Johannesburg, `autoConfirm: false`.

| Mode | Behavior |
|------|----------|
| **Manual** (DEFAULT) | Current draft-only desk. Present leads; user applies themselves. Digests stay draft-first email. **Never** auto-applies or queues. |
| **Automatic** | When a lead’s `fit_score` ≥ threshold, queue an auto-apply action without asking per job. First enable gated by checkbox: *“I understand Automatic will apply without asking each time.”* Warning banner in UI. Still write apply results to the log / queue. |
| **Bulk** | User sets weekday(s) + time (SAST) for scrape + automatic applications. Scheduler UI: day checkboxes + time + threshold. On Bulk run: scrape LI+GD → rank → auto-apply queue for leads above threshold → log results. |

### What Automatic / Bulk actually do vs stub

Blueprints is a **static** browser app — it cannot drive LinkedIn Easy Apply itself.

- **Does:** Persist mode/schedule; queue intended applies to browser storage (`mm.careers.dropnet.applyQueue.v1`); show **queued for apply agent** status; export `apply-queue.json`; mirror log entries client-side; document disk paths below for the Lab/browser apply agent / parent routine.
- **Does not:** Live-submit Easy Apply from the Careers page; auto-send Gmail; modify Easy Apply upload folders.
- Live submit requires the **Lab/browser apply agent** when available. Parent creates/updates a routine from the Bulk schedule (do **not** call UpdateRoutine from executors).

### Queue + log paths

| Path | Role |
|------|------|
| `/workspace/jobnet/dropnet/apply-queue.json` | Intended applies for the apply agent |
| `apps/mercatus-careers/dropnet/apply-log.json` | Apply attempt / queue log (Blueprints) |
| staging mirror `dropnet/apply-log.json` | Keep in sync |
| Browser export | Download `apply-queue.json` from Drop tab (Bulk panel) |

## Digest JSON

| Path | Role |
|------|------|
| `apps/mercatus-careers/dropnet/latest.json` | Served with Blueprints; Drop UI loads this |
| staging mirror `apps/mercatus-careers/dropnet/latest.json` | Keep in sync when Blueprints changes |
| `/workspace/jobnet/dropnet/latest.json` | Pipeline copy |
| `/workspace/jobnet/dropnet/config.json` | Interests, boards, notify, schedule, apply modes |

Schema: `dropnet-aihawk-digest/v1` — roles include `fit_score`, `why` / `match_reason`, `apply_url`.

## Schedule (parent sets cron / UpdateRoutine)

| Routine | When (Africa/Johannesburg) | Cron hint |
|---------|----------------------------|-----------|
| Daily digest | Weekday morning ~**08:17** | `17 8 * * 1-5` |
| Weekly summary | Sunday morning ~**08:17** | `17 8 * * 0` |
| Bulk apply (when mode=Bulk) | User-configured days + time in Drop UI | From UI cron hint |

**Quiet hours:** no evening / overnight daily emails. Morning-only for digests.

Prompt files (parent UpdateRoutine — executors do not):

- `/workspace/jobnet/routines/dropnet-aihawk-daily.prompt.txt`
- `/workspace/jobnet/routines/dropnet-aihawk-weekly-summary.prompt.txt`
- `/workspace/jobnet/routines/dropnet-bulk-apply.prompt.txt` — scheduled Bulk scrape + queue/apply above threshold

## Email

- Brand: **DropNet · AI Hawk · Mens Mercatus Blueprint**
- From: `mensmercatus@gmail.com` (MCP `user-Gmail--mensmercatus`)
- To: `katlego.mokoto.km@gmail.com`
- Subject: `DropNet · AI Hawk · daily leads · <YYYY-MM-DD SAST>`
- Delivery: **create_draft** only (never auto-send unless standing said skip)
- Sample: `/workspace/jobnet/dropnet/SAMPLE-DIGEST-EMAIL.md`
- Manual mode digests stay draft-first. Automatic/Bulk do **not** change email policy (still draft-first).

## Pipeline reuse

Uses JobNet LI+GD scrape (same scope as noon). After scrapes, run `jobnet_post_scrape.sh` if present.

**Do not touch:** LinkedIn Easy Apply upload folders, Concierge site, ClickUp work, 90s video render, auto-send Gmail.
