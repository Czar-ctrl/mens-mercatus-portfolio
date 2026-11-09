/**
 * Mens Mercatus — GODMODE chrome (2026-10-05).
 * Per blueprint/robot/MERCATUS_CARTEL_SYSTEM_PROMPT.txt: red / black / white,
 * tiny 16px wheat mark, one Assist ghost control per tool, no autoplay.
 *
 * <script src="/js/godmode.js" data-gm="full|lite" data-gm-tool="jobnet" data-gm-strip defer>
 *   data-gm        full (default) = site pages; lite = Sound Deck / Canvas (components only)
 *   data-gm-tool   toolId passed to Assist as ?from=  ("assist" or "off" = no ghost control)
 *   data-gm-strip  inject a thin header strip when the page has no .site-nav
 * Any element with [data-gm-assist] counts as the tool's Assist control; if one is
 * visible, no floating control is added. [data-gm-doc="file.txt|file.md"] renders a doc reader;
 * data-gm-format="md" parses a .txt twin as Markdown (host blocks *.md).
 * Never calls an API; tools keep working if this file fails to load.
 */
(function () {
  "use strict";
  var script = document.currentScript;
  var src = (script && script.src) || "";
  var BASE = src.replace(/js\/godmode\.js.*$/, "") || "/";
  var SITE = "/"; /* SoundX Studio: vendored copy — nav links go to the site root */
  var mode = (script && script.getAttribute("data-gm")) || "full";
  var tool = (script && script.getAttribute("data-gm-tool")) || (document.body && document.body.getAttribute("data-gm-tool")) || "";
  var html = document.documentElement;
  html.classList.add(mode === "lite" ? "gm-lite" : "gm");
  html.classList.remove("mm-loading");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function el(tag, attrs, inner) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (inner != null) n.innerHTML = inner;
    return n;
  }
  function visible(n) {
    if (!n) return false;
    var r = n.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(n).visibility !== "hidden";
  }

  /* ---- Header: settle a 16px wheat mark (fallback for pages not yet edited) ---- */
  function headerMark() {
    var img = document.querySelector(".site-nav .nav-brand img");
    if (img && /emblem-mens-mercatus/.test(img.getAttribute("src") || "")) {
      img.src = BASE + "assets/marks/mark-wheat-16.svg";
      img.width = 16; img.height = 16;
      img.classList.add("gm-mark");
    }
    document.querySelectorAll(".discover-orb br").forEach(function (br) {
      br.replaceWith(document.createTextNode(" "));
    });
    /* Mark the current page link in the primary nav */
    var here = location.pathname.replace(/index\.html$/, "");
    document.querySelectorAll(".site-nav .nav-links a").forEach(function (a) {
      try {
        var p = new URL(a.getAttribute("href"), location.href).pathname.replace(/index\.html$/, "");
        if (p === here && !a.hasAttribute("aria-current")) a.setAttribute("aria-current", "page");
      } catch (e) {}
    });
  }

  /* ---- Thin strip for standalone pages ---- */
  function strip() {
    if (!script || !script.hasAttribute("data-gm-strip")) return;
    if (document.querySelector(".site-nav, .gm-strip")) return;
    var bar = el("nav", { "class": "gm-strip", "aria-label": "Mens Mercatus" },
      '<a class="gm-strip-brand" href="' + SITE + 'index.html"><img class="gm-mark" src="' + BASE +
      'assets/marks/mark-wheat-16.svg" width="16" height="16" alt="">Mens Mercatus</a>' +
      '<span class="gm-strip-links"><a href="' + SITE + 'hub.html">Hub</a><a href="' + SITE +
      'apps/index.html">Apps</a><a href="' + SITE + 'blueprint/index.html">Blueprint</a></span>');
    document.body.insertBefore(bar, document.body.firstChild);
  }

  /* ---- One Assist ghost control per tool ---- */
  function assist() {
    if (tool === "assist" || tool === "off") return;
    var href = SITE + "apps/mercatus-assist/" + (tool ? "?from=" + encodeURIComponent(tool) : "");
    var existing = document.querySelectorAll("[data-gm-assist]");
    var fab = null;

    function sync() {
      var anyVisible = false;
      existing.forEach(function (n) { if (visible(n)) anyVisible = true; });
      if (anyVisible) { if (fab) fab.hidden = true; return; }
      if (!fab) {
        fab = el("a", { "class": "gm-assist", href: href, "aria-label": "Open Mercatus Assist" + (tool ? " for " + tool : "") }, "Assist");
        document.body.appendChild(fab);
      }
      fab.hidden = false;
      /* Lift above a floating demo walkthrough bar if they would overlap */
      var off = 0;
      var bar = document.querySelector(".mm-demo-bar--floating");
      if (bar && visible(bar)) {
        var r = bar.getBoundingClientRect();
        var fr = fab.getBoundingClientRect();
        if (r.right > fr.left - 8 && r.bottom > window.innerHeight - 90) off = Math.max(0, window.innerHeight - r.top + 8 - 16);
      }
      fab.style.setProperty("--gm-fab-offset", off + "px");
    }
    sync();
    window.addEventListener("resize", sync, { passive: true });
    var ticks = 0;
    var iv = setInterval(function () { sync(); if (++ticks > 12) clearInterval(iv); }, 500);
    if ("MutationObserver" in window) {
      var mo = new MutationObserver(function () { sync(); });
      mo.observe(document.body, { childList: true });
      setTimeout(function () { mo.disconnect(); }, 15000);
    }
  }

  /* ---- Doc reader (.txt system prompt with CAPS headings, or Markdown) ---- */
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "section"; }
  function inline(s) {
    var out = esc(s);
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    out = out.replace(/\[([^\]]+)\]\(((?:https?:\/\/|\.{0,2}\/|[a-z0-9_-]+[./])[^)\s]*)\)/gi, '<a href="$2">$1</a>');
    return out;
  }
  var ACRONYMS = /^(AI|NLTA|POPIA|NMW|SA|ID|KYC|ZAR|BCEA|SASSA|API|LLM|UI|UX|P2P|GPS|PDF|CV)$/;
  function sentence(t) {
    var i = 0;
    return t.split(/(\s+|[\/()—–-])/).map(function (w) {
      if (!/[A-Za-z]/.test(w)) return w;
      var core = w.replace(/[^A-Za-z0-9]/g, "");
      var out = ACRONYMS.test(core) ? w : w.toLowerCase();
      if (/^(EVENT|JOBS|NETZA)$/.test(core)) out = out.charAt(0).toUpperCase() + out.slice(1);
      if (i++ === 0 && !ACRONYMS.test(core)) out = out.charAt(0).toUpperCase() + out.slice(1);
      return out;
    }).join("");
  }
  function isCaps(line) {
    var t = line.trim();
    if (t.length < 3 || t.length > 64 || /[.:;,]$/.test(t)) return false;
    if (!/[A-Z]{2}/.test(t) || t !== t.toUpperCase()) return false;
    return /^[A-Z0-9 \-—–\/&()'’+]+$/.test(t);
  }
  function parse(txt, fmt) {
    var lines = txt.replace(/\r/g, "").split("\n");
    var out = [], para = [], list = null, inCode = false, code = [], table = null;
    var heads = [];
    function flushPara() {
      if (!para.length) return;
      var t = para.join(" ").trim();
      if (/^Next:/i.test(t)) out.push('<p class="gm-next">' + inline(t) + "</p>");
      else out.push("<p>" + inline(t) + "</p>");
      para = [];
    }
    function flushList() {
      if (!list) return;
      var stack = [], h = "";
      list.forEach(function (it) {
        while (stack.length && stack[stack.length - 1].lvl > it.lvl) { h += "</li></" + stack.pop().tag + ">"; }
        var top = stack[stack.length - 1];
        if (!top || top.lvl < it.lvl) { h += "<" + it.tag + ">"; stack.push({ lvl: it.lvl, tag: it.tag }); }
        else h += "</li>";
        h += "<li>" + inline(it.text);
      });
      while (stack.length) h += "</li></" + stack.pop().tag + ">";
      out.push(h); list = null;
    }
    function flushTable() {
      if (!table) return;
      var rows = table.filter(function (r) { return !/^\|?\s*:?-{2,}/.test(r.trim()); });
      var cells = function (r) { return r.trim().replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); }); };
      var h = '<div class="gm-table-wrap"><table><thead><tr>' + cells(rows[0]).map(function (c) { return "<th>" + inline(c) + "</th>"; }).join("") + "</tr></thead><tbody>";
      rows.slice(1).forEach(function (r) { h += "<tr>" + cells(r).map(function (c) { return "<td>" + inline(c) + "</td>"; }).join("") + "</tr>"; });
      out.push(h + "</tbody></table></div>"); table = null;
    }
    function flushAll() { flushPara(); flushList(); flushTable(); }
    function heading(level, text) {
      flushAll();
      text = text.replace(/\s*#+\s*$/, "").trim();
      if (level <= 2) {
        var id = slug(text), n = heads.length + 1;
        while (document.getElementById(id) || heads.some(function (x) { return x.id === id; })) id += "-x";
        heads.push({ id: id, text: text });
        out.push('<h2 id="' + id + '"><span class="n">' + (n < 10 ? "0" : "") + n + "</span>" + inline(text) + "</h2>");
      } else out.push("<h" + Math.min(level, 4) + ">" + inline(text) + "</h" + Math.min(level, 4) + ">");
    }
    var firstHashTitle = null;
    lines.forEach(function (line) {
      if (/^```/.test(line.trim())) {
        if (inCode) { out.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>"); code = []; inCode = false; }
        else { flushAll(); inCode = true; }
        return;
      }
      if (inCode) { code.push(line); return; }
      var m;
      if (!line.trim()) { flushPara(); flushList(); flushTable(); return; }
      if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
        if (m[1].length === 1 && firstHashTitle === null && !out.length) { firstHashTitle = m[2].trim(); return; }
        heading(m[1].length === 1 ? 2 : m[1].length, m[2]); return;
      }
      if (fmt === "txt" && isCaps(line)) { heading(2, sentence(line.trim())); return; }
      if (/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(line)) { flushAll(); out.push("<hr>"); return; }
      if (/^\s*\|.*\|\s*$/.test(line)) { flushPara(); flushList(); (table = table || []).push(line); return; }
      if ((m = line.match(/^(\s*)[-*•]\s+(.*)$/))) {
        flushPara(); flushTable();
        (list = list || []).push({ lvl: Math.floor(m[1].replace(/\t/g, "  ").length / 2), tag: "ul", text: m[2] }); return;
      }
      if ((m = line.match(/^(\s*)\d+[.)]\s+(.*)$/))) {
        flushPara(); flushTable();
        (list = list || []).push({ lvl: Math.floor(m[1].length / 2), tag: "ol", text: m[2] }); return;
      }
      if ((m = line.match(/^>\s?(.*)$/))) { flushAll(); out.push("<blockquote>" + inline(m[1]) + "</blockquote>"); return; }
      if (list && /^\s{2,}\S/.test(line)) { list[list.length - 1].text += " " + line.trim(); return; }
      flushList(); flushTable();
      para.push(line.trim());
    });
    if (inCode) out.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>");
    flushAll();
    /* Opening paragraph reads as a lede */
    if (out[0] && /^<p>/.test(out[0])) out[0] = out[0].replace(/^<p>/, '<p class="gm-lede">');
    return { html: out.join("\n"), heads: heads, title: firstHashTitle };
  }

  function buildToc(host, heads) {
    if (!host) return;
    if (heads.length < 2) { host.hidden = true; return; }
    var items = heads.map(function (h, i) {
      return '<li><a href="#' + h.id + '" data-gm-toc="' + h.id + '"><span class="n">' + (i < 9 ? "0" : "") + (i + 1) + "</span><span>" + inline(h.text) + "</span></a></li>";
    }).join("");
    host.innerHTML =
      '<details><summary>Sections · ' + heads.length + "</summary><ol>" + items + "</ol></details>" +
      '<div class="gm-toc-inner"><p class="gm-toc-label">On this page</p><ol>' + items + "</ol></div>";
    host.querySelectorAll("details a").forEach(function (a) {
      a.addEventListener("click", function () { var d = host.querySelector("details"); if (d) d.open = false; });
    });
    if (!("IntersectionObserver" in window)) return;
    var links = host.querySelectorAll(".gm-toc-inner a");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("data-gm-toc") === e.target.id); });
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    heads.forEach(function (h) { var t = document.getElementById(h.id); if (t) io.observe(t); });
  }

  function reader() {
    var art = document.querySelector("[data-gm-doc]");
    if (!art) return;
    var file = art.getAttribute("data-gm-doc");
    var fmt = art.getAttribute("data-gm-format") || (/\.txt$/i.test(file) ? "txt" : "md");
    var toc = document.querySelector("[data-gm-toc-host]");
    art.innerHTML = '<p class="gm-doc-status">Loading ' + esc(file.split("/").pop()) + "…</p>";
    fetch(file, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    }).then(function (txt) {
      var doc = parse(txt, fmt);
      art.innerHTML = doc.html;
      buildToc(toc, doc.heads);
      var count = document.querySelector("[data-gm-doc-count]");
      if (count) count.textContent = doc.heads.length + " sections · " + txt.split(/\s+/).filter(Boolean).length.toLocaleString("en-ZA") + " words";
      var copy = document.querySelector("[data-gm-copy]");
      if (copy) copy.addEventListener("click", function () {
        var done = function (ok) { copy.textContent = ok ? "Copied" : "Copy failed"; setTimeout(function () { copy.textContent = "Copy text"; }, 1600); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { done(true); }, function () { done(false); });
        else done(false);
      });
      if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
    }).catch(function (e) {
      art.innerHTML = '<p class="gm-doc-status">Could not load the document (' + esc(e.message) + '). <a href="' + esc(file) + '">Open the raw file</a>.</p>';
      if (toc) toc.hidden = true;
    });
  }

  function boot() {
    try { if (mode !== "lite") headerMark(); } catch (e) {}
    try { strip(); } catch (e) {}
    try { reader(); } catch (e) {}
    try { assist(); } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  window.MMGodmode = { base: BASE, parse: parse };
})();
