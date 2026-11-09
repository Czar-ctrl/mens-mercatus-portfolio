#!/usr/bin/env python3
"""Apply GODMODE chrome (2026-10-05) to Mens Mercatus shell pages. Idempotent.

- <html class="gm">, godmode.css last in <head>, godmode.js before </body>
- One header brand: 16px wheat mark + "Mens Mercatus" (+ quiet context); no logo stack
- Standard primary nav (Home/Work · Hub · Apps · Blueprint · Vault · Contact) + burger
- .txt/.md doc links -> godmode reader pages; discover-orb <br> -> space
- Writes the reader pages (cartel prompt, docs, README, vault CV note)
"""
import os, re, html as H

ROOT = '/workspace/mensmercatus-portfolio'
V = '20261005h'

# page -> (root prefix, toolId for Assist, brand context, exact nav key, section nav key)
PAGES = {
    'index.html':                      ('',      'home',    '',            'home',    'home'),
    'hub.html':                        ('',      'hub',     'Hub',         'hub',     'hub'),
    'contact.html':                    ('',      'support', 'Contact',     'contact', 'contact'),
    'vault/index.html':                ('../',   'vault',   'Vault',       'vault',   'vault'),
    'apps/index.html':                 ('../',   'apps',    'Apps',        'apps',    'apps'),
    'blueprint/index.html':               ('../',   'diagrams','Blueprint',      'cartel',  'cartel'),
    'apps/jobnet/index.html':          ('../../','jobnet',  'JobNet',      None,      'apps'),
    'apps/forex-codex/index.html':     ('../../','forex',   'Forex Mercatus Codex', None,      'apps'),
    'apps/drop-net/index.html':        ('../../','composer','Drop Net',    None,      'apps'),
    'apps/event-net/index.html':       ('../../','event',   'Event Net',   None,      'apps'),
    'apps/mercatus-assist/index.html': ('../../','assist',  'Assist',      None,      'apps'),
}
# Standalone pages without a site nav: thin strip injected by godmode.js
STANDALONE = {
    'apps/net-workspace/index.html':   ('../../', 'net-workspace'),
    'apps/fmc-screenshots/index.html': ('../../', 'forex'),
}

DOC_LINKS = [
    ('blueprint/robot/MERCATUS_CARTEL_SYSTEM_PROMPT.txt', 'blueprint/robot/MERCATUS_CARTEL_SYSTEM_PROMPT.html'),
    ('blueprint/docs/event-mode-compliance.txt', 'blueprint/docs/event-mode-compliance.html'),
    ('blueprint/docs/ai-in-every-tool-plan.txt', 'blueprint/docs/ai-in-every-tool-plan.html'),
    ('blueprint/diagrams/README.txt', 'blueprint/diagrams/README.html'),
    ('blueprint/README.txt', 'blueprint/README.html'),
    ('vault/cv-placeholder.txt', 'vault/cv-placeholder.html'),
]

def brand(R, ctx):
    c = f' <span class="gm-ctx">· {H.escape(ctx)}</span>' if ctx else ''
    return (f'<div class="nav-brands">\n      <a class="nav-brand" href="{R}index.html" aria-label="Mens Mercatus home">\n'
            f'        <img class="gm-mark" src="{R}assets/marks/mark-wheat-16.svg" width="16" height="16" alt="">\n'
            f'        <span class="word">Mens Mercatus{c}</span>\n      </a>\n    </div>\n    ')

def navlinks(R, exact, section):
    items = [('home', 'index.html#work' if exact == 'home' else 'index.html', 'Work' if exact == 'home' else 'Home'),
             ('hub', 'hub.html', 'Hub'), ('apps', 'apps/index.html', 'Apps'), ('cartel', 'blueprint/index.html', 'Blueprint'),
             ('vault', 'vault/index.html', 'Vault'), ('contact', 'contact.html', 'Contact')]
    out = []
    for key, href, label in items:
        attrs = f' data-nav="{key}"'
        if key == exact and key != 'home':
            attrs += ' aria-current="page"'
        elif key == section and key != 'home':
            attrs += ' class="is-active"'
        out.append(f'      <a href="{R}{href}"{attrs}>{label}</a>')
    return '<nav class="nav-links" id="primary-nav" aria-label="Primary">\n' + '\n'.join(out) + '\n    </nav>'

BURGER = ('<button class="nav-burger" type="button" data-nav-toggle aria-expanded="false" aria-controls="primary-nav" aria-label="Open menu">\n'
          '      <span></span>\n    </button>\n    ')

def common(s, R, tool, lite=False, strip=False):
    # html class
    m = re.search(r'<html([^>]*)>', s)
    attrs = m.group(1)
    cls = 'gm-lite' if lite else 'gm'
    if re.search(r'class="[^"]*\b' + cls + r'\b', attrs) is None:
        if 'class="' in attrs:
            attrs2 = re.sub(r'class="([^"]*)"', lambda mm: f'class="{mm.group(1)} {cls}"', attrs, count=1)
        else:
            attrs2 = attrs + f' class="{cls}"'
        s = s.replace(m.group(0), f'<html{attrs2}>', 1)
    # css
    if 'css/godmode.css' not in s:
        s = s.replace('</head>', f'<link rel="stylesheet" href="{R}css/godmode.css?v={V}">\n</head>', 1)
    # js
    if 'js/godmode.js' not in s:
        extra = ' data-gm="lite"' if lite else ''
        extra += ' data-gm-strip' if strip else ''
        tag = f'<script src="{R}js/godmode.js?v={V}"{extra} data-gm-tool="{tool}" defer></script>\n'
        idx = s.rfind('</body>')
        s = s[:idx] + tag + s[idx:]
    s = re.sub(r'<meta name="theme-color" content="#(?:171717|030303)">', '<meta name="theme-color" content="#0a0a0a">', s)
    return s

def links(s, R, page_dir):
    for old, new in DOC_LINKS:
        rel_old = os.path.relpath(os.path.join(ROOT, old), os.path.join(ROOT, page_dir)).replace(os.sep, '/')
        rel_new = os.path.relpath(os.path.join(ROOT, new), os.path.join(ROOT, page_dir)).replace(os.sep, '/')
        # forms used in markup: R-prefixed absolute-ish (../blueprint/...), and dir-relative (docs/..., README.txt)
        for o, n in {(R + old, R + new), (rel_old, rel_new)}:
            s = s.replace(f'href="{o}"', f'href="{n}"')
    s = s.replace('<span>Markdown</span>', '<span>Reader</span>').replace('<span>Plan · MD</span>', '<span>Plan · reader</span>')
    s = re.sub(r'(<span class="discover-orb">[^<]*)<br>', r'\1 ', s)
    return s

def apply_page(rel, R, tool, ctx, exact, section):
    p = os.path.join(ROOT, rel); s0 = s = open(p, encoding='utf-8').read()
    s = common(s, R, tool)
    s = re.sub(r'<div class="nav-brands">.*?</div>\s*(?=<button class="nav-burger"|<nav class="nav-links")', brand(R, ctx), s, count=1, flags=re.S)
    s = re.sub(r'<nav class="nav-links"[^>]*>.*?</nav>', navlinks(R, exact, section), s, count=1, flags=re.S)
    if 'data-nav-toggle' not in s:
        s = s.replace('<nav class="nav-links"', BURGER + '<nav class="nav-links"', 1)
    s = links(s, R, os.path.dirname(rel))
    if s != s0:
        open(p, 'w', encoding='utf-8').write(s); print('updated', rel)

READERS = [
    # path, src (relative to page), title, sub, crumbs [(label, href-from-root)], kind, tool
    ('blueprint/robot/MERCATUS_CARTEL_SYSTEM_PROMPT.html', 'MERCATUS_CARTEL_SYSTEM_PROMPT.txt',
     'Mercatus Blueprint Robot — system prompt',
     'The policy every Assist surface runs on: voice, Event / Jobs canon, close-friends consent, NLTA goods vs passenger, POPIA, and hard limits. Red / black / white, warm and concise, South Africa–aware.',
     [('Blueprint', 'blueprint/index.html'), ('Robot', None)], 'System prompt · .txt', 'prompt'),
    ('blueprint/docs/event-mode-compliance.html', 'event-mode-compliance.txt',
     'Event mode — compliance notes',
     'NMW floor and rate lock, POPIA redaction, NLTA goods vs passenger, close-friends consent and the Event gate summary. Illustrative portfolio guidance — not legal advice.',
     [('Blueprint', 'blueprint/index.html'), ('Docs', None)], 'Compliance · Markdown', 'event'),
    ('blueprint/docs/ai-in-every-tool-plan.html', 'ai-in-every-tool-plan.txt',
     'AI in every tool',
     'How Assist plugs into each surface: one quiet ghost control per tool, toolId + intent + small context, inline results, and tools that still work when Assist fails.',
     [('Blueprint', 'blueprint/index.html'), ('Docs', None)], 'Plan · Markdown', 'diagrams'),
    ('blueprint/README.html', 'README.txt',
     'Mercatus Blueprint — portfolio pack',
     'Product overview from the source pack: what the system does, which AI was added, the Kubernetes target, offline capability and the compliance snapshot.',
     [('Blueprint', 'blueprint/index.html'), ('README', None)], 'README · Markdown', 'support'),
    ('blueprint/diagrams/README.html', 'README.txt',
     'Schematics',
     'Seven red / black / white diagrams, each as SVG and PNG. Open the gallery to view them full size.',
     [('Blueprint', 'blueprint/index.html'), ('Diagrams', None)], 'Index · Markdown', 'diagrams'),
    ('vault/cv-placeholder.html', 'cv-placeholder.txt',
     'CV / résumé',
     'The full CV PDF is not published yet. Portfolio PDFs and architecture briefs are in the Vault meanwhile.',
     [('Vault', 'vault/index.html'), ('CV', None)], 'Placeholder · Markdown', 'vault'),
]

READER_TMPL = '''<!DOCTYPE html>
<html lang="en" class="gm">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="{desc}">
<meta name="theme-color" content="#0a0a0a">
<link rel="icon" href="{R}assets/marks/mark-wheat-16-on-black.svg" type="image/svg+xml">
<title>{title_plain} · Mens Mercatus</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{R}css/tokens.css?v={V}">
<link rel="stylesheet" href="{R}css/base.css?v={V}">
<link rel="stylesheet" href="{R}css/nav.css?v={V}">
<link rel="stylesheet" href="{R}css/godmode.css?v={V}">
</head>
<body data-page="{section}">
<a class="sr-only" href="#doc">Skip to document</a>
<header class="site-nav" role="banner">
  <div class="nav-inner">
    {brand}{burger}{nav}
  </div>
</header>
<main class="gm-doc-page">
  <header class="gm-doc-head">
    <ol class="gm-crumbs" aria-label="Breadcrumb">{crumbs}</ol>
    <h1>{title}</h1>
    <p class="gm-doc-sub">{sub}</p>
    <div class="gm-doc-meta">
      <span class="gm-pill gm-pill--red">{kind}</span>
      <span class="gm-pill" data-gm-doc-count>Reading…</span>
      <a class="gm-doc-btn" href="{src}">Raw file</a>
      <button class="gm-doc-btn" type="button" data-gm-copy>Copy text</button>
    </div>
  </header>
  <div class="gm-doc-layout">
    <nav class="gm-toc" aria-label="Sections" data-gm-toc-host></nav>
    <article class="gm-article" id="doc" data-gm-doc="{src}"{fmt}>
      <noscript><p class="gm-doc-status">JavaScript is off — <a href="{src}">read the raw file</a>.</p></noscript>
    </article>
  </div>
</main>
<footer class="site-footer">
  <div class="container footer-inner">
    <span>© 2026 Mens Mercatus Inc</span>
    <span><a href="{R}blueprint/index.html">Blueprint</a> · <a href="{R}vault/index.html">Vault</a> · <a href="{R}contact.html">Contact</a></span>
  </div>
</footer>
<script src="{R}js/nav.js" defer></script>
<script src="{R}js/godmode.js?v={V}" data-gm-tool="{tool}" defer></script>
</body>
</html>
'''

def write_readers():
    for path, src, title, sub, crumbs, kind, tool in READERS:
        depth = path.count('/')
        R = '../' * depth
        section = 'vault' if path.startswith('vault/') else 'cartel'
        cr = f'<li><a href="{R}index.html">Mens Mercatus</a></li>'
        for label, href in crumbs:
            cr += f'<li><a href="{R}{href}">{H.escape(label)}</a></li>' if href else f'<li aria-current="page">{H.escape(label)}</li>'
        out = READER_TMPL.format(R=R, V=V, desc=H.escape(sub, quote=True), title_plain=H.escape(title), title=H.escape(title),
                                 sub=H.escape(sub), kind=H.escape(kind), src=src, fmt=('' if tool == 'prompt' else ' data-gm-format="md"'), tool=tool, section=section, crumbs=cr,
                                 brand=brand(R, 'Blueprint' if section == 'cartel' else 'Vault'), burger=BURGER,
                                 nav=navlinks(R, None, section))
        p = os.path.join(ROOT, path)
        old = open(p, encoding='utf-8').read() if os.path.exists(p) else None
        if old != out:
            open(p, 'w', encoding='utf-8').write(out); print('reader', path)

def standalone():
    for rel, (R, tool) in STANDALONE.items():
        p = os.path.join(ROOT, rel); s0 = s = open(p, encoding='utf-8').read()
        s = common(s, R, tool, strip=True)
        # these pages have their own inline styles; pull in tokens-free godmode + fonts stay system
        if s != s0:
            open(p, 'w', encoding='utf-8').write(s); print('updated', rel)

if __name__ == '__main__':
    for rel, cfg in PAGES.items():
        apply_page(rel, *cfg)
    standalone()
    write_readers()
