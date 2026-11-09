#!/usr/bin/env python3
"""Assemble static HTML pages with shared nav/sidebar chrome."""
from pathlib import Path

ROOT = Path("/workspace/mensmercatus-portfolio")

FONTS = """<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">"""

def css_js(prefix: str) -> str:
    return f"""{FONTS}
<link rel="stylesheet" href="{prefix}css/tokens.css">
<link rel="stylesheet" href="{prefix}css/base.css">
<link rel="stylesheet" href="{prefix}css/glow-bg.css">
<link rel="stylesheet" href="{prefix}css/cursor.css">
<link rel="stylesheet" href="{prefix}css/nav.css">
<link rel="stylesheet" href="{prefix}css/sidebar.css">
<link rel="stylesheet" href="{prefix}css/cartel.css">
<link rel="stylesheet" href="{prefix}css/pages.css">"""

def scripts(prefix: str) -> str:
    return f"""<script src="{prefix}js/cursor.js" defer></script>
<script src="{prefix}js/glow.js" defer></script>
<script src="{prefix}js/nav.js" defer></script>
<script src="{prefix}js/sidebar.js" defer></script>
<script src="{prefix}js/main.js" defer></script>"""

def nav(prefix: str, active: str, cartel_theme: bool = False) -> str:
    # active: work|cartel|apps|vault|contact|home
    return f"""<header class="site-nav" role="banner">
  <div class="nav-inner">
    <div class="nav-brands">
      <a class="nav-brand" href="{prefix}index.html" aria-label="Mens Mercatus home">
        <img src="{prefix}assets/marks/emblem-mens-mercatus-inc.svg" width="28" height="28" alt="">
        <span class="word">Mens Mercatus</span>
      </a>
      <span class="nav-divider" aria-hidden="true"></span>
      <a class="nav-brand" href="{prefix}blueprint/index.html" aria-label="Mercatus Blueprint">
        <img class="wheat" src="{prefix}assets/marks/mark-wheat-16-white.svg" width="18" height="18" alt="">
        <span class="word">Blueprint <span>Event</span></span>
      </a>
    </div>
    <button class="nav-burger" type="button" data-nav-toggle aria-expanded="false" aria-controls="primary-nav" aria-label="Open menu">
      <span></span>
    </button>
    <nav class="nav-links" id="primary-nav" aria-label="Primary">
      <a href="{prefix}index.html#work" data-nav="work">Work</a>
      <a href="{prefix}blueprint/index.html" data-nav="cartel">Blueprint</a>
      <a href="{prefix}apps/index.html" data-nav="apps">Apps</a>
      <a href="{prefix}vault/index.html" data-nav="vault">Vault</a>
      <a href="{prefix}contact.html" data-nav="contact">Contact</a>
    </nav>
    <div class="nav-actions">
      <button class="nav-icon-btn" type="button" data-sidebar-open aria-expanded="false" aria-controls="vault-sidebar" aria-label="Open vault sidebar">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      </button>
    </div>
  </div>
</header>"""

SIDEBAR_ICONS = {
  "arch": '<svg class="stroke-anim" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  "pipe": '<svg class="stroke-anim" viewBox="0 0 24 24"><path d="M4 12h4l2-6 4 12 2-6h4"/></svg>',
  "k8s": '<svg class="spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
  "flow": '<svg class="stroke-anim" viewBox="0 0 24 24"><path d="M5 6h6v4H5zM13 14h6v4h-6z"/><path d="M11 8h4v6"/></svg>',
  "gps": '<svg class="stroke-anim" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2a10 10 0 0 1 0 20 10 10 0 0 1 0-20"/><path d="M2 12h4M18 12h4"/></svg>',
  "gate": '<svg class="stroke-anim" viewBox="0 0 24 24"><path d="M12 3 4 7v5c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V7l-8-4z"/></svg>',
  "jobs": '<svg class="stroke-anim" viewBox="0 0 24 24"><path d="M4 10h16v9H4z"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  "gallery": '<svg class="spin" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="m21 16-5-5-4 4-2-2-5 5"/></svg>',
  "doc": '<svg class="stroke-anim" viewBox="0 0 24 24"><path d="M7 3h8l5 5v13H7z"/><path d="M15 3v5h5M9 13h6M9 17h6"/></svg>',
  "cv": '<svg class="stroke-anim" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
  "pdf": '<svg class="stroke-anim" viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg>',
}

DIAGRAMS = [
  ("overall-system-architecture", "Architecture", "Overall system", "arch"),
  ("ai-assist-integration-pipeline", "AI Assist", "Integration pipeline", "pipe"),
  ("kubernetes-topology", "Kubernetes", "Topology", "k8s"),
  ("event-mode-data-flow", "Event mode", "Data flow", "flow"),
  ("close-friends-gps-ping-flow", "Close friends", "GPS + ping", "gps"),
  ("compliance-gates", "Compliance", "Gates", "gate"),
  ("five-jobs-pillars", "Five Jobs", "Pillars", "jobs"),
]

def sidebar(prefix: str) -> str:
    links = []
    for slug, title, sub, ico in DIAGRAMS:
        links.append(f"""    <a class="hud-link" href="{prefix}blueprint/diagrams/{slug}.svg" target="_blank" rel="noopener">
      <span class="ico">{SIDEBAR_ICONS[ico]}</span>
      <span class="txt"><strong>{title}</strong><span>{sub} · SVG</span></span>
    </a>""")
    schematics = "\n".join(links)
    return f"""<div class="sidebar-overlay" id="sidebar-overlay" data-sidebar-close aria-hidden="true"></div>
<aside class="sidebar" id="vault-sidebar" aria-hidden="true" aria-label="Vault sidebar" role="dialog">
  <div class="sidebar-head">
    <div>
      <div class="hud-label">HUD · Vault</div>
      <h2>Schematics &amp; docs</h2>
    </div>
    <button class="sidebar-close" type="button" data-sidebar-close aria-label="Close sidebar">✕</button>
  </div>
  <div class="sidebar-body">
    <div class="hud-group">
      <div class="hud-group-label">Seven schematics</div>
{schematics}
    </div>
    <div class="hud-group">
      <div class="hud-group-label">Galleries &amp; packs</div>
      <a class="hud-link" href="{prefix}blueprint/event/diagrams.html">
        <span class="ico">{SIDEBAR_ICONS['gallery']}</span>
        <span class="txt"><strong>Diagrams gallery</strong><span>Event pack viewer</span></span>
      </a>
      <a class="hud-link" href="{prefix}blueprint/README.md">
        <span class="ico">{SIDEBAR_ICONS['doc']}</span>
        <span class="txt"><strong>Blueprint README</strong><span>Product pack overview</span></span>
      </a>
      <a class="hud-link" href="{prefix}blueprint/docs/event-mode-compliance.md">
        <span class="ico">{SIDEBAR_ICONS['gate']}</span>
        <span class="txt"><strong>Event compliance</strong><span>Markdown</span></span>
      </a>
      <a class="hud-link" href="{prefix}blueprint/docs/ai-in-every-tool-plan.md">
        <span class="ico">{SIDEBAR_ICONS['pipe']}</span>
        <span class="txt"><strong>AI in every tool</strong><span>Plan · MD</span></span>
      </a>
    </div>
    <div class="hud-group">
      <div class="hud-group-label">CV · Resume · Portfolio PDFs</div>
      <a class="hud-link" href="{prefix}vault/cv-placeholder.md">
        <span class="ico">{SIDEBAR_ICONS['cv']}</span>
        <span class="txt"><strong>CV placeholder</strong><span>Drop BLUEPRINT.pdf here</span></span>
      </a>
      <a class="hud-link" href="{prefix}vault/net-portfolio.pdf" target="_blank" rel="noopener">
        <span class="ico">{SIDEBAR_ICONS['pdf']}</span>
        <span class="txt"><strong>Net portfolio</strong><span>PDF</span></span>
      </a>
      <a class="hud-link" href="{prefix}vault/net-portfolio-v2.pdf" target="_blank" rel="noopener">
        <span class="ico">{SIDEBAR_ICONS['pdf']}</span>
        <span class="txt"><strong>Net portfolio v2</strong><span>PDF</span></span>
      </a>
      <a class="hud-link" href="{prefix}vault/index.html">
        <span class="ico">{SIDEBAR_ICONS['doc']}</span>
        <span class="txt"><strong>Vault hub</strong><span>All docs</span></span>
      </a>
    </div>
  </div>
  <div class="sidebar-foot">Mens Mercatus · local vault</div>
</aside>"""

def shell(title: str, prefix: str, active: str, body: str, cartel: bool = False, extra_head: str = "") -> str:
    theme = ' class="is-cartel-theme"' if cartel else ""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Mens Mercatus — systems architecture portfolio by Katlego Mokoto.">
<meta name="theme-color" content="#030303">
<title>{title}</title>
{css_js(prefix)}
{extra_head}
</head>
<body{theme} data-page="{active}">
<div class="glow-bg" aria-hidden="true"></div>
{nav(prefix, active, cartel)}
{sidebar(prefix)}
<div class="page">
{body}
<footer class="site-footer">
  <div class="container footer-inner">
    <span>© 2026 Mens Mercatus Inc · Katlego Mokoto</span>
    <span><a href="{prefix}contact.html">Contact</a> · <a href="{prefix}blueprint/index.html">Blueprint</a> · <a href="{prefix}vault/index.html">Vault</a></span>
  </div>
</footer>
</div>
{scripts(prefix)}
</body>
</html>
"""

# ——— Pages ———

index_body = """
<section class="hero">
  <div class="container">
    <div class="hero-badge"><span class="dot" aria-hidden="true"></span> SA · Lead System Architect</div>
    <h1>Katlego Mokoto</h1>
    <p class="role">Systems architect / <em>Mens Mercatus</em> — products, platforms, and compliance-aware tooling.</p>
    <div class="btn-row">
      <a class="btn btn-primary" href="#work">Explore works</a>
      <a class="btn btn-ghost" href="blueprint/index.html">Open Blueprint</a>
      <a class="btn btn-ghost" href="contact.html">Initiate contact</a>
    </div>
  </div>
</section>

<section class="section" id="work">
  <div class="container">
    <div class="section-head">
      <p class="section-kicker">Selected works</p>
      <h2 class="section-title">Apps &amp; product surfaces</h2>
      <p class="section-lead">Lightweight placeholders for in-flight builds, plus the Mercatus Blueprint Event static pack.</p>
    </div>
    <div class="card-grid">
      <a class="card" href="apps/soundx-ai/index.html">
        <div class="tag">Sound Dex</div>
        <h3>SoundX AI</h3>
        <p>Browser DAW · CoProducer + stem split.</p>
        <span class="app-status live">Live</span>
      </a>
      <a class="card" href="apps/mercatus-canvas/index.html">
        <div class="tag">Creative</div>
        <h3>Mercatus Canvas</h3>
        <p>Mercatus Canvas — Showcase Atelier (Extrafazant.nl heritage), Doop Design Canvas, FrameSketch Video Lab.</p>
        <div class="card-meta">LIVE · APPS/MERCATUS-CANVAS · :3456 · LOCAL</div>
      </a>
      <a class="card" href="apps/event-net/index.html">
        <div class="tag">.NET · Event</div>
        <h3>.NET Event scaffold</h3>
        <p>Event-mode screens and compliance gates. Points at Blueprint event pages for now.</p>
        <div class="card-meta">FOLDER INTEGRATION PENDING</div>
      </a>
      <a class="card" href="apps/forex-codex/index.html">
        <div class="tag">Forex</div>
        <h3>Forex Mercatus Codex</h3>
        <p>Trading reference / codex surface. Content folder incoming.</p>
        <div class="card-meta">PLACEHOLDER</div>
      </a>
      <a class="card" href="apps/drop-net/index.html">
        <div class="tag">AI Hawk</div>
        <h3>Mercatus Drop Net</h3>
        <p>Job vacancy scraper, auto-fill bulk apply, scheduled 3&nbsp;AM runs.</p>
        <div class="card-meta">PLACEHOLDER</div>
      </a>
      <a class="card" href="blueprint/event/index.html">
        <div class="tag">Blueprint</div>
        <h3>Mercatus Blueprint Event</h3>
        <p>Static multi-page Event mode mockups — signup, rate lock, payout, close friends.</p>
        <div class="card-meta">COMPLETE PACK</div>
      </a>
    </div>
  </div>
</section>

<section class="section" id="cartel-teaser">
  <div class="container">
    <div class="section-head">
      <p class="section-kicker">Mercatus Blueprint</p>
      <h2 class="section-title">Red / black / white product pack</h2>
      <p class="section-lead">Event mode mockups, seven architecture schematics, SAMPLE financial PDFs, and the Blueprint Robot system prompt.</p>
    </div>
    <div class="btn-row">
      <a class="btn btn-ghost" href="blueprint/index.html">Enter Blueprint hub</a>
      <a class="btn btn-ghost" href="blueprint/event/index.html">Event screens</a>
      <a class="btn btn-ghost" href="blueprint/event/diagrams.html">Schematics gallery</a>
    </div>
  </div>
</section>
"""

contact_body = """
<section class="section">
  <div class="container">
    <div class="section-head">
      <p class="section-kicker">Contact</p>
      <h2 class="section-title">Initiate contact</h2>
      <p class="section-lead">Reach Katlego Mokoto — Lead System Architect, Mens Mercatus.</p>
    </div>
    <div class="contact-grid">
      <div class="contact-item">
        <div class="lbl">Email · Gmail</div>
        <a href="mailto:katlego.mokoto.km@gmail.com">katlego.mokoto.km@gmail.com</a>
      </div>
      <div class="contact-item">
        <div class="lbl">Email · iCloud</div>
        <a href="mailto:katlego.mokoto@icloud.com">katlego.mokoto@icloud.com</a>
      </div>
      <div class="contact-item">
        <div class="lbl">Phone · ZA</div>
        <a href="tel:+27658424274">065 842 4274</a>
      </div>
      <div class="contact-item">
        <div class="lbl">Domain</div>
        <span class="val">mensmercatus.online</span>
      </div>
    </div>
  </div>
</section>
"""

cartel_body = """
<section class="section cartel-page">
  <div class="container">
    <div class="cartel-banner">
      <img src="../assets/marks/mark-wheat-16-white.svg" width="18" height="18" alt="">
      <span>Mercatus Blueprint · no personal names on pack assets · red chrome only in this section</span>
    </div>
    <div class="section-head">
      <p class="section-kicker">Blueprint hub</p>
      <h2 class="section-title">Event · schematics · docs</h2>
      <p class="section-lead">Static portfolio pack for Messmakers / Mens Mercatus Inc / Netza. Open screens via file:// or any static host.</p>
    </div>
    <div class="card-grid">
      <a class="card" href="event/index.html">
        <div class="tag">Event UI</div>
        <h3>Event mode screens</h3>
        <p>Signup gate, rate lock, check-in, points, vehicle, no-show, dispute, payout, close friends, settings.</p>
        <div class="card-meta">STATIC MOCKUPS</div>
      </a>
      <a class="card" href="event/diagrams.html">
        <div class="tag">Diagrams</div>
        <h3>Seven schematics</h3>
        <p>Architecture, AI Assist, K8s, event flow, GPS ping, compliance, five jobs pillars.</p>
        <div class="card-meta">SVG + PNG</div>
      </a>
      <a class="card" href="../vault/index.html#cartel-pdfs">
        <div class="tag">PDFs</div>
        <h3>SAMPLE books</h3>
        <p>Balance sheet / book / logbook examples.</p>
        <div class="card-meta">ILLUSTRATIVE</div>
      </a>
      <a class="card" href="robot/MERCATUS_CARTEL_SYSTEM_PROMPT.md">
        <div class="tag">Robot</div>
        <h3>System prompt</h3>
        <p>Mercatus Blueprint Robot Assist / chat policy copy.</p>
        <div class="card-meta">MD · TXT</div>
      </a>
      <a class="card" href="docs/event-mode-compliance.md">
        <div class="tag">Compliance</div>
        <h3>Event mode compliance</h3>
        <p>NMW · POPIA · NLTA · consent gates documented for the mockups.</p>
      </a>
      <a class="card" href="docs/ai-in-every-tool-plan.md">
        <div class="tag">AI plan</div>
        <h3>AI in every tool</h3>
        <p>How Assist wires to each surface — refusals included.</p>
      </a>
      <a class="card" href="README.md">
        <div class="tag">README</div>
        <h3>Blueprint pack README</h3>
        <p>Full product overview from the source pack.</p>
      </a>
    </div>

    <div class="section-head" style="margin-top:3rem">
      <p class="section-kicker">Gallery</p>
      <h2 class="section-title">Schematics preview</h2>
    </div>
    <div class="diagram-grid">
      <a class="diagram-tile" href="diagrams/overall-system-architecture.svg" target="_blank" rel="noopener">
        <img src="diagrams/overall-system-architecture.png" alt="Overall system architecture" loading="lazy" width="640" height="400">
        <div class="cap"><strong>Overall system architecture</strong><span>Messmakers · Event · Jobs · Netza</span></div>
      </a>
      <a class="diagram-tile" href="diagrams/ai-assist-integration-pipeline.svg" target="_blank" rel="noopener">
        <img src="diagrams/ai-assist-integration-pipeline.png" alt="AI Assist pipeline" loading="lazy" width="640" height="400">
        <div class="cap"><strong>AI Assist pipeline</strong><span>toolId · context · inline result</span></div>
      </a>
      <a class="diagram-tile" href="diagrams/kubernetes-topology.svg" target="_blank" rel="noopener">
        <img src="diagrams/kubernetes-topology.png" alt="Kubernetes topology" loading="lazy" width="640" height="400">
        <div class="cap"><strong>Kubernetes topology</strong><span>Namespaces · services · ingress</span></div>
      </a>
      <a class="diagram-tile" href="diagrams/event-mode-data-flow.svg" target="_blank" rel="noopener">
        <img src="diagrams/event-mode-data-flow.png" alt="Event mode data flow" loading="lazy" width="640" height="400">
        <div class="cap"><strong>Event mode data flow</strong><span>Signup → payout</span></div>
      </a>
      <a class="diagram-tile" href="diagrams/close-friends-gps-ping-flow.svg" target="_blank" rel="noopener">
        <img src="diagrams/close-friends-gps-ping-flow.png" alt="Close friends GPS" loading="lazy" width="640" height="400">
        <div class="cap"><strong>Close friends GPS + ping</strong><span>Consented P2P</span></div>
      </a>
      <a class="diagram-tile" href="diagrams/compliance-gates.svg" target="_blank" rel="noopener">
        <img src="diagrams/compliance-gates.png" alt="Compliance gates" loading="lazy" width="640" height="400">
        <div class="cap"><strong>Compliance gates</strong><span>NMW · POPIA · NLTA</span></div>
      </a>
      <a class="diagram-tile" href="diagrams/five-jobs-pillars.svg" target="_blank" rel="noopener">
        <img src="diagrams/five-jobs-pillars.png" alt="Five jobs pillars" loading="lazy" width="640" height="400">
        <div class="cap"><strong>Five Jobs pillars</strong><span>Discover · Escrow · Verify · Settle · Assist</span></div>
      </a>
    </div>
  </div>
</section>
"""

apps_body = """
<section class="section">
  <div class="container">
    <div class="section-head">
      <p class="section-kicker">Apps</p>
      <h2 class="section-title">Product hubs</h2>
      <p class="section-lead">Placeholders ready for folder drops. Event scaffold currently links into the Blueprint static pack.</p>
    </div>
    <div class="card-grid">
      <a class="card" href="soundx-ai/index.html">
        <div class="tag">Sound Dex</div>
        <h3>SoundX AI</h3>
        <p>Browser DAW · Browser DAW · AI Producer, stems, beats, mic/vocals, VST rack, FL packs.</p>
        <span class="app-status live">AI Producer · full MVP panels</span>
      </a>
      <a class="card" href="mercatus-canvas/index.html">
        <div class="tag">Creative</div>
        <h3>Mercatus Canvas</h3>
        <p>Showcase Atelier · Doop · FrameSketch · bridge→Hub :8088 · DEMO-grade AGI · local only.</p>
        <span class="app-status live">Live · port 3456</span>
      </a>
      <a class="card" href="event-net/index.html">
        <div class="tag">.NET</div>
        <h3>.NET Event scaffold</h3>
        <p>Points to Blueprint event pages. Full .NET folder integration pending.</p>
        <span class="app-status live">Linked → Blueprint Event</span>
      </a>
      <a class="card" href="forex-codex/index.html">
        <div class="tag">Codex</div>
        <h3>Forex Mercatus Codex</h3>
        <p>Trading reference surface.</p>
        <span class="app-status incoming">Folder incoming</span>
      </a>
      <a class="card" href="drop-net/index.html">
        <div class="tag">Drop Net</div>
        <h3>Mercatus Drop Net / AI Hawk</h3>
        <p>Vacancy scraper · auto-fill bulk apply · scheduled 03:00.</p>
        <span class="app-status incoming">Placeholder</span>
      </a>
    </div>
  </div>
</section>
"""

def app_placeholder(title, tag, blurb, status_html, extra=""):
    return f"""
<section class="section">
  <div class="container">
    <div class="section-head">
      <p class="section-kicker">{tag}</p>
      <h2 class="section-title">{title}</h2>
      <p class="section-lead">{blurb}</p>
    </div>
    {status_html}
    {extra}
    <p style="margin-top:1.5rem"><a class="btn btn-ghost" href="../index.html">← Apps hub</a></p>
  </div>
</section>
"""

event_net_body = app_placeholder(
  ".NET Event scaffold",
  ".NET · Event",
  "Scaffold destination for the Event .NET integration. Until the app folder lands, use the Blueprint static Event screens.",
  '<span class="app-status live">Points to Blueprint Event</span>',
  """<div class="placeholder-note"><strong>Integration pending.</strong> Open the static pack:
  <a href="../../blueprint/event/index.html">blueprint/event/index.html</a></div>
  <div class="btn-row" style="margin-top:1.25rem">
    <a class="btn btn-primary" href="../../blueprint/event/index.html">Open Event hub</a>
    <a class="btn btn-ghost" href="../../blueprint/index.html">Blueprint hub</a>
  </div>"""
)

forex_body = app_placeholder(
  "Forex Mercatus Codex",
  "Forex",
  "Placeholder page. Drop the Codex content folder here when ready.",
  '<span class="app-status incoming">Folder incoming</span>',
  '<div class="placeholder-note"><strong>Expected path:</strong> <span class="mono">apps/forex-codex/</span> — replace this page with the real hub.</div>'
)

drop_body = app_placeholder(
  "Mercatus Drop Net / AI Hawk",
  "AI Hawk",
  "Job vacancy scraper, auto-fill bulk apply, scheduled runs at 03:00 local.",
  '<span class="app-status incoming">Placeholder</span>',
  '<div class="placeholder-note"><strong>Planned capabilities:</strong> scrape vacancies · bulk autofill apply · cron at 3&nbsp;AM. Folder integration pending.</div>'
)

vault_body = """
<section class="section">
  <div class="container">
    <div class="section-head">
      <p class="section-kicker">Vault</p>
      <h2 class="section-title">Docs · CV · portfolio PDFs</h2>
      <p class="section-lead">Personal portfolio PDFs live here. Blueprint SAMPLE financial docs stay under blueprint/pdfs (no personal branding added).</p>
    </div>

    <h3 style="font-size:1rem;margin:0 0 0.75rem">Portfolio · CV</h3>
    <ul class="doc-list">
      <li><a href="cv-placeholder.md"><span>CV placeholder — drop KATLEGO_MOKOTO_BLUEPRINT.pdf into vault/</span><span class="ext">MD</span></a></li>
      <li><a href="net-portfolio.pdf" target="_blank" rel="noopener"><span>Net portfolio</span><span class="ext">PDF</span></a></li>
      <li><a href="net-portfolio-v2.pdf" target="_blank" rel="noopener"><span>Net portfolio v2</span><span class="ext">PDF</span></a></li>
    </ul>

    <h3 id="cartel-pdfs" style="font-size:1rem;margin:2rem 0 0.75rem">Blueprint SAMPLE PDFs</h3>
    <ul class="doc-list">
      <li><a href="../blueprint/pdfs/mens-mercatus-balance-sheet-example.pdf" target="_blank" rel="noopener"><span>Balance sheet example</span><span class="ext">PDF</span></a></li>
      <li><a href="../blueprint/pdfs/mens-mercatus-balance-book-example.pdf" target="_blank" rel="noopener"><span>Balance book example</span><span class="ext">PDF</span></a></li>
      <li><a href="../blueprint/pdfs/mens-mercatus-logbook-example.pdf" target="_blank" rel="noopener"><span>Logbook example</span><span class="ext">PDF</span></a></li>
    </ul>

    <h3 style="font-size:1rem;margin:2rem 0 0.75rem">Markdown docs</h3>
    <ul class="doc-list">
      <li><a href="../blueprint/docs/event-mode-compliance.md"><span>Event mode compliance</span><span class="ext">MD</span></a></li>
      <li><a href="../blueprint/docs/ai-in-every-tool-plan.md"><span>AI in every tool plan</span><span class="ext">MD</span></a></li>
      <li><a href="../blueprint/README.md"><span>Blueprint README</span><span class="ext">MD</span></a></li>
      <li><a href="../blueprint/robot/MERCATUS_CARTEL_SYSTEM_PROMPT.md"><span>Blueprint Robot system prompt</span><span class="ext">MD</span></a></li>
      <li><a href="../blueprint/diagrams/README.md"><span>Diagrams README</span><span class="ext">MD</span></a></li>
    </ul>
  </div>
</section>
"""

pages = [
  (ROOT / "index.html", "Mens Mercatus · Katlego Mokoto", "", "home", index_body, False),
  (ROOT / "contact.html", "Contact · Mens Mercatus", "", "contact", contact_body, False),
  (ROOT / "cartel" / "index.html", "Mercatus Blueprint · Hub", "../", "cartel", cartel_body, True),
  (ROOT / "apps" / "index.html", "Apps · Mens Mercatus", "../", "apps", apps_body, False),
  (ROOT / "apps" / "event-net" / "index.html", ".NET Event · Mens Mercatus", "../../", "apps", event_net_body, False),
  (ROOT / "apps" / "forex-codex" / "index.html", "Forex Mercatus Codex · Mens Mercatus", "../../", "apps", forex_body, False),
  (ROOT / "apps" / "drop-net" / "index.html", "Drop Net · Mens Mercatus", "../../", "apps", drop_body, False),
  (ROOT / "vault" / "index.html", "Vault · Mens Mercatus", "../", "vault", vault_body, False),
]

for path, title, prefix, active, body, cartel in pages:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(shell(title, prefix, active, body, cartel), encoding="utf-8")
    print("wrote", path.relative_to(ROOT))

print("done", len(pages), "pages")
