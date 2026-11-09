#!/usr/bin/env python3
"""Single source of truth for app cards on index.html, apps/index.html and hub.html.
Re-run after editing CARDS: python3 scripts/build_app_cards.py"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent

# Distinctive animated SVG icons, INLINE glowing yellow left of h3 title (~40px desktop / ~32px mobile via CSS).
# CSS classes on <svg>: mm-ico-pulse | mm-ico-spin | mm-ico-wave | mm-ico-blink — glow + motion; muted under prefers-reduced-motion.
ICONS = {
    "soundx": '''<svg class="mm-card-ico mm-ico-wave" viewBox="0 0 48 48" aria-hidden="true"><rect x="4" y="18" width="5" height="12" rx="1.5" class="mm-ico-bar b1"/><rect x="12" y="12" width="5" height="24" rx="1.5" class="mm-ico-bar b2"/><rect x="20" y="8" width="5" height="32" rx="1.5" class="mm-ico-bar b3"/><rect x="28" y="14" width="5" height="20" rx="1.5" class="mm-ico-bar b4"/><rect x="36" y="10" width="5" height="28" rx="1.5" class="mm-ico-bar b5"/></svg>''',
    "jobnet": '''<svg class="mm-card-ico mm-ico-pulse" viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="10" width="32" height="28" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 20h12M14 26h8M14 32h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle class="mm-ico-dot" cx="34" cy="26" r="3"/></svg>''',
    "cartel": '''<svg class="mm-card-ico mm-ico-spin" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="24" r="5" class="mm-ico-core"/><path d="M24 6v4M24 38v4M6 24h4M38 24h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>''',
    "forex": '''<svg class="mm-card-ico mm-ico-wave" viewBox="0 0 48 48" aria-hidden="true"><path class="mm-ico-chart" d="M6 34 L14 26 L20 30 L28 16 L36 22 L42 12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle class="mm-ico-dot" cx="42" cy="12" r="2.5"/></svg>''',
    "assist": '''<svg class="mm-card-ico mm-ico-blink" viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="12" width="28" height="22" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle class="mm-ico-eye" cx="19" cy="23" r="3"/><circle class="mm-ico-eye" cx="29" cy="23" r="3"/><path d="M18 36h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>''',
    "canvas": '''<svg class="mm-card-ico mm-ico-pulse" viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="8" width="32" height="32" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 30l8-10 6 7 4-5 6 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle class="mm-ico-dot" cx="16" cy="16" r="2.5"/></svg>''',
    "eventnet": '''<svg class="mm-card-ico mm-ico-pulse" viewBox="0 0 48 48" aria-hidden="true"><path d="M10 16h28v22H10z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16V12a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" fill="none" stroke="currentColor" stroke-width="2"/><circle class="mm-ico-dot" cx="24" cy="27" r="4"/></svg>''',
    "dropnet": '''<svg class="mm-card-ico mm-ico-blink" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 8c0 0-12 14-12 22a12 12 0 0 0 24 0c0-8-12-22-12-22z" fill="none" stroke="currentColor" stroke-width="2"/><circle class="mm-ico-dot" cx="24" cy="28" r="3"/></svg>''',
    "netws": '''<svg class="mm-card-ico mm-ico-spin" viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="10" width="36" height="26" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 18h10M12 24h16M12 30h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle class="mm-ico-core" cx="34" cy="28" r="4"/></svg>''',
    "cartelev": '''<svg class="mm-card-ico mm-ico-pulse" viewBox="0 0 48 48" aria-hidden="true"><path d="M8 18h32v18H8z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 18V14h20v4M18 26h12M18 32h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle class="mm-ico-dot" cx="36" cy="14" r="3"/></svg>''',
    "fxshots": '''<svg class="mm-card-ico mm-ico-wave" viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="10" width="32" height="28" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path class="mm-ico-chart" d="M12 30l6-8 5 4 7-10 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>''',
    "think": '''<svg class="mm-card-ico mm-ico-blink" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" stroke-width="2"/><path d="M18 22h12M18 28h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle class="mm-ico-core" cx="24" cy="16" r="2.5"/><path d="M24 30v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>''',
    "makeda": '''<svg class="mm-card-ico mm-ico-pulse" viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="10" width="32" height="28" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 28l6-8 5 6 4-4 7 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle class="mm-ico-dot" cx="34" cy="16" r="2.5"/></svg>''',
    "vault": '''<svg class="mm-card-ico mm-ico-blink" viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="14" width="28" height="24" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="26" r="6" fill="none" stroke="currentColor" stroke-width="2"/><circle class="mm-ico-core" cx="24" cy="26" r="2"/><path d="M24 14V10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>''',
}

# (href, variant, orb, tag, title, promise, cta, new_tab, icon_key)
FLAGSHIP = [
    ("apps/soundx-ai/", "featured", "Browser<br>demo", "Mercatus SoundX", "SoundX AI",
     "AI drum station &amp; studio: 20 on-device AI tools, plugin rack, Afro sample packs and 22 themes. Runs in the browser — no sign-in, no upload.", "Open SoundX AI", True, "soundx"),
    ("apps/jobnet/", "mid", "Draft<br>only", "JobNet", "JobNet",
     "Read-only live shortlist from the noon run + guided tour. Draft-only — never auto-applies or sends mail.", "Open JobNet", True, "jobnet"),
    ("blueprint/", "mid", "Pack<br>ready", "Blueprint", "Mercatus Blueprint",
     "Event mode — twelve static screens, schematics, compliance gates.", "Open Blueprint", True, "cartel"),
    ("apps/forex-codex/", "wide", "Paper<br>desk", "Forex", "Forex Mercatus Codex",
     "Live paper desk with a guided tour — Chart · Multi · Flow · Bot. Session-scoped paper bot; not a brokerage.", "Open Forex", True, "forex"),
]
MORE = [
    ("/think/", "half", "Live<br>AI", "THINK", "THINK – Hybrid Social & AI",
     "Gemini multimodal workspace — Pulse, Chat, Live Voice, Net Sites, Net Code, Netzar Protocol, Net Learn. API key stays on the VPS.", "Open THINK", True, "think"),
    ("apps/mercatus-assist/", "half", "Live<br>+ DEMO", "Mercatus Assist", "Mercatus Assist",
     "Ask the Blueprint Robot — Gemini via /api/cartel/ when healthy, labelled DEMO coaching when not. Guided tour chips.", "Open Mercatus Assist", False, "assist"),
    ("apps/mercatus-canvas/", "half", "Browser<br>demo", "Creative atelier", "Mercatus Canvas",
     "Make and export an artboard in four guided steps. Local only; AGI engines are DEMO-grade UI.", "Open Mercatus Canvas", False, "canvas"),
    ("apps/makedas-canvas/", "mid", "Builder<br>shell", "Makeda's Canvas", "Makeda's Canvas",
     "Lovable-inspired AI builder shell — design picks, Plan/Build, studio, paint, Ops Launch, role kits. Mercatus Canvas stays source of truth.", "Open Makeda's Canvas", False, "makeda"),
    ("blueprint/event/", "half", "Static<br>screens", "Blueprint Event", "Blueprint Event screens",
     "Signup gate · rate lock · check-in/out · payout · disputes — static mockups.", "Open Blueprint Event screens", False, "cartelev"),
    ("apps/fmc-screenshots/", "half", "Gallery", "Forex", "Forex Mercatus Codex screenshots",
     "Paper-desk screenshots. The live paper desk is at /apps/forex-codex/.", "Open Forex Mercatus Codex screenshots", False, "fxshots"),
    ("vault/", "half", "Docs", "Vault", "Vault",
     "Architecture briefs, portfolio PDFs, JobNet demo video and CV.", "Open Vault", False, "vault"),
]


def card(c, prefix):
    href, variant, orb, tag, title, promise, cta, new_tab, icon_key = c
    tgt = ' target="_blank" rel="noopener"' if new_tab else ""
    icon = ICONS.get(icon_key, "")
    nl = chr(10)
    # Featured / hub Sound Dex: wave shape ON TOP, title, Drop Net secondary label, then companion Drop Net card
    if icon_key == "soundx" and title == "SoundX AI":
        drop_href = f"{prefix}apps/drop-net/"
        hero_lines = [
            f'      <a class="discover-card discover-card--{variant} discover-card--sounddex" href="{prefix}{href}"{tgt} role="listitem" data-mm-icon="{icon_key}">',
            f'        <span class="discover-orb">{orb}</span>',
            f'        <div class="discover-body discover-body--sounddex">
          <img class="discover-thumb" src="media/soundx-ai.webp" alt="SoundX AI studio screenshot" width="1200" height="750" loading="lazy" decoding="async">',
            f'          <div class="mm-card-icon mm-card-icon--hero" aria-hidden="true">{icon}</div>',
            f'          <div class="tag">{tag}</div>',
            f'          <h3>{title}</h3>',
            f'          <p class="mm-sounddex-drop"><span class="mm-sounddex-drop-label">Drop Net</span> · vacancy draft companion under Sound Dex</p>',
            f'          <p>{promise}</p>',
            f'        </div>',
            f'        <span class="discover-reveal"><span>{cta}</span><span>→</span></span>',
            f'      </a>',
        ]
        drop_lines = [
            f'      <a class="discover-card discover-card--half discover-card--sounddex-drop" href="{drop_href}" role="listitem" data-mm-icon="dropnet">',
            f'        <span class="discover-orb">Draft<br>demo</span>',
            f'        <div class="discover-body">',
            f'          <div class="tag">Drop Net</div>',
            f'          <h3><span class="mm-card-icon" aria-hidden="true">{ICONS["dropnet"]}</span>Drop Net / AI Hawk</h3>',
            f'          <p>Paste a vacancy, get a draft cover note + CV synopsis. Draft only — under SoundX AI.</p>',
            f'        </div>',
            f'        <span class="discover-reveal"><span>Open Drop Net</span><span>→</span></span>',
            f'      </a>',
        ]
        return nl.join(hero_lines) + nl + nl.join(drop_lines) + nl
    use_href = href if href.startswith("/") or href.startswith("http") else f"{prefix}{href}"
    lines = [
        f'      <a class="discover-card discover-card--{variant}" href="{use_href}"{tgt} role="listitem" data-mm-icon="{icon_key}">',
        f'        <span class="discover-orb">{orb}</span>',
        f'        <div class="discover-body">',
        f'          <div class="tag">{tag}</div>',
        f'          <h3><span class="mm-card-icon" aria-hidden="true">{icon}</span>{title}</h3>',
        f'          <p>{promise}</p>',
        f'        </div>',
        f'        <span class="discover-reveal"><span>{cta}</span><span>→</span></span>',
        f'      </a>',
    ]
    return nl.join(lines) + nl



def grid(cards, prefix):
    return '<div class="discover-grid" role="list">\n' + "".join(card(c, prefix) for c in cards) + "    </div>"


def replace_grids(path, prefix, sets):
    s = path.read_text()
    pos = 0
    for cards in sets:
        i = s.index('<div class="discover-grid" role="list">', pos)
        j = s.index("\n    </div>", s.index("</a>", i))
        end = j + len("\n    </div>")
        new = grid(cards, prefix)
        s = s[:i] + new + s[end:]
        pos = i + len(new)
    path.write_text(s)


if __name__ == "__main__":
    replace_grids(ROOT / "index.html", "", [FLAGSHIP, MORE])
    replace_grids(ROOT / "apps" / "index.html", "../", [FLAGSHIP, MORE])
    hub = ROOT / "hub.html"
    if '<div class="discover-grid" role="list">' in hub.read_text():
        hub_cards = [(c[0], "half") + c[2:] for c in FLAGSHIP + MORE]
        replace_grids(hub, "", [hub_cards])
    print("cards rebuilt with icons")
