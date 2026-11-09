# AI in every tool — Mercatus Blueprint / Messmakers (minimal)

**Principle:** AI is invisible infrastructure. Each tool gets one quiet assist affordance — never a second chat panel per tool, never decorative “AI badges.”

## Pattern (same for every tool)

| Layer | What it does |
|--------|----------------|
| **Context pack** | Tool name + current screen state + last user action + allowed actions (JSON, small). |
| **Assist call** | `POST /api/mercatus-cartel/assist` with `{ toolId, intent, context }` |
| **Result shape** | `{ suggestion?, draft?, warnings[], nextStep? }` — render as one line or one ghost button. |
| **Fallback** | If model fails, tool still works fully without AI. Offline: last cached Assist hints may show; no new model calls. |

## toolIds

`search` · `composer` · `netza` · `gigs` · `kyc` · `diagrams` · `settings` · `event` · `close-friends` · `support`

## Per-tool embeds (no UI clutter)

1. **Search / discover** — rank + one “why this” caption.
2. **Composer / post** — draft from outline; brand voice; no emoji spam.
3. **Wallet / Netza** — explain a line item in plain ZAR English; **never invent balances or payout amounts**.
4. **Gigs / escrow / Event** — checklist of missing fields and compliance gates before accept; risk flags inline.
5. **KYC / verify** — step coach (“next photo: SA ID front”); redact IDs; no chat bubble wall.
6. **Diagrams / schematics** — on open: one pop-up overview, then hover = one-sentence node explain.
7. **Settings** — “recommend privacy preset” → applies known toggles (close-friends GPS/ping default off), shows diff.
8. **Close friends** — explain consent / ping state only; never enable ping silently.
9. **Support** — FAQ first; escalate only if unresolved.

## Hard Assist limits

- No unlicensed **passenger** coaching (NLTA goods ≠ passenger).
- No payout amount invention or coaching.
- No SASSA credentials; SA ID redact.
- **No always-on ambient ranging** features — out of scope.

## UX rules

- One **Assist** ghost control per tool. Red only while streaming.
- Results **inline** or thin bottom strip — not modals for every answer.
- Loading = 2px red progress; empty = “Assist ready”; error = muted inline text.
- Never auto-play voice or confetti. Optional welcome pop-up once per session for the whole app.

## Backend sketch (portfolio target)

- Shared `MercatusCartelRobot` client (see `/robot`) for all tools.
- Tool policies: `maxTokens`, `allowedIntents[]`, `piiRedact: true`.
- Log: toolId, latency, success — no raw PII.

## Rollout order

1. Diagram overview pop-up + node explain  
2. Event gate checklist  
3. Composer assist  
4. Gig / escrow field checklist  
5. Wallet explain (no amount invention)  
6. Close-friends consent explain  
7. Remainder  

Reference: `robot/MERCATUS_CARTEL_SYSTEM_PROMPT.md` and `docs/diagrams/ai-assist-integration-pipeline.svg`.
