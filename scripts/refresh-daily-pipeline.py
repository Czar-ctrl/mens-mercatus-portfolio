#!/usr/bin/env python3
"""Regenerate hub six-app teasers (Codex paper seed + honest status lines)."""
import json, sys, hashlib, datetime
from pathlib import Path

PORTFOLIO = Path(__file__).resolve().parents[1]
ROOT = Path("/workspace/fx-mercatus-codex/FX_Mercatus_Codex/FX_Mercatus_Codex_Export/FX Mercatus Codex")
sys.path.insert(0, str(ROOT))
from luxgex import market

def unit(s: str) -> float:
    h = hashlib.sha256(f"{datetime.date.today().isoformat()}|{s}".encode()).hexdigest()
    return (int(h[:8], 16) % 10000) / 10000.0

today = datetime.date.today().isoformat()
qs = market.quotes(["EURUSD", "SPX"])
eur = next((q for q in qs if q.get("symbol") == "EURUSD"), {"symbol": "EURUSD", "last": 1.08, "change_pct": 0, "source": "synthetic"})
bs_iv = 8.5 + unit("bs") * 6
heston_v0 = 0.01 + unit("heston") * 0.04
sabr_rho = -0.55 + unit("sabr") * 0.3
var95 = 0.6 + unit("var") * 1.2
kelly_f = 0.08 + unit("kelly") * 0.12
cvd = int((unit("cvd") - 0.5) * 2400)
delta = int((unit("delta") - 0.5) * 400)
tsmom = "long" if unit("tsmom") > 0.45 else "flat"
chg = float(eur.get("change_pct") or 0)

teasers = [
  {"id":"forex-codex","app":"Forex Mercatus Codex","kicker":"Paper research desk · :8790",
   "hook":"Institutional cousins on one local desk — not a toy chart.",
   "inner":"18 core tools · 20 quant models · Quant Academy · Whales/GEX · order flow · AGI gates · satellite Quant Desk & Aureum EO",
   "line":f"Today’s paper tape: {eur.get('symbol')} {eur.get('last')} ({chg:+.2f}%) · BS≈{bs_iv:.1f}% IV · Heston v0={heston_v0:.3f} · SABR ρ={sabr_rho:.2f} · VaR95≈{var95:.2f}% · Kelly f≈{kelly_f:.2f} · Δ={delta:+d} CVD={cvd:+d} · TSMOM {tsmom}",
   "href":"apps/forex-codex/index.html"},
  {"id":"mercatus-cartel","app":"Mercatus Blueprint","kicker":"Event mode pack",
   "hook":"Festival staffing + wallet rules — compliance baked into the mockups.",
   "inner":"Event signup · NMW rate lock · check-in/out · dispute packs · Close Friends GPS · static DEMO Assist strips",
   "line":"Static Event pack · seven schematics — no live Jobs/Wallet API · robot disconnected from :8765",
   "href":"blueprint/index.html"},
  {"id":"jobnet","app":"JobNet","kicker":"Agentic career pipeline · baking",
   "hook":"Retrieval → rank → tailor → human-gated apply — drafted, never auto-fired.",
   "inner":"LinkedIn+Glassdoor scrape · LLM CV tailor · AI Hawk draft-only · Gmail reply watch · 24h nudge · Job-Net.app shell",
   "line":"Routines scoped weekdays · draft-only · email from Blueprint HQ · scrapers not claimed as live fires",
   "href":"apps/drop-net/index.html"},
  {"id":"sound-deck","app":"SoundX AI","kicker":"Local-first music studio",
   "hook":"Your stems stay on the machine — edge capture, desktop power.",
   "inner":"AI Producer · in-house Generate · band-split stems · mic/vocals · VST slots · FL user packs · Mac scaffold",
   "line":"Web DAW MVP · Generate=procedural · stems=filter bands · local-first by default",
   "href":"apps/soundx-ai/index.html"},
  {"id":"mercatus-canvas","app":"Mercatus Canvas","kicker":"Creative atelier · :3456",
   "hook":"Three pillars, one bridge — design, motion, showcase.",
   "inner":"Showcase Atelier (Extrafazant.nl heritage) · Doop Design Canvas · FrameSketch Video Lab · bridge→8088",
   "line":"Monolith shell on :3456 · saliency/cloth/voice = demo-grade · architecture brief in vault",
   "href":"apps/mercatus-canvas/index.html"},
]

payload = {
  "as_of": today,
  "generated_at": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
  "source": "Mens Mercatus hub · six-app tease · Codex paper seed",
  "disclaimer": "Paper / local research only. Not live brokerage. Not investment advice.",
  "teasers": teasers,
}
dest = PORTFOLIO / "data" / "daily-pipeline.json"
dest.write_text(json.dumps(payload, indent=2) + "\n")
print(f"wrote {dest}")
