/**
 * Mens Mercatus — shared demo kit (no network, no dependencies).
 *
 *   MMDemoKit.mountWalkthrough(root, { id, title, steps:[{id,label,hint}], onStep, floating })
 *     → { el, go(i), done(stepId), isDone(stepId), reset(), progress() }
 *   MMDemoKit.mountStatus(el, { mode, label, title })   → { set(mode, label, title) }
 *     modes: demo | live | paper | draft | checking | offline
 *   MMDemoKit.persistDone(id, stepId) / markDone(...)  → localStorage "mm-demo-kit:{id}"
 *   MMDemoKit.mountEmpty(el, { title, body })           → shows a dashed empty-state block
 *   MMDemoKit.copyText(text)                            → Promise<boolean>
 *
 * Honest by design: the kit only tracks local walkthrough progress; it never
 * calls an API, never claims LIVE on its own — callers pass the mode.
 */
(function (global) {
  "use strict";
  var PREFIX = "mm-demo-kit:";

  function $(root) {
    if (!root) return null;
    return typeof root === "string" ? document.querySelector(root) : root;
  }
  function readDone(id) {
    try {
      var raw = global.localStorage.getItem(PREFIX + id);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function writeDone(id, arr) {
    try { global.localStorage.setItem(PREFIX + id, JSON.stringify(arr)); } catch (e) {}
  }
  function persistDone(id, stepId) {
    if (!id || !stepId) return readDone(id);
    var arr = readDone(id);
    if (arr.indexOf(stepId) === -1) { arr.push(stepId); writeDone(id, arr); }
    return arr;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var STATUS_TEXT = {
    demo: "DEMO", live: "LIVE", paper: "Paper only", draft: "Draft only",
    checking: "Checking…", offline: "Offline"
  };
  function mountStatus(el, opts) {
    el = $(el);
    if (!el) return { set: function () {} };
    el.classList.add("mm-demo-status");
    el.setAttribute("role", "status");
    function set(mode, label, title) {
      mode = mode || "demo";
      el.setAttribute("data-mode", mode);
      el.textContent = label || STATUS_TEXT[mode] || mode;
      if (title) el.title = title;
    }
    opts = opts || {};
    set(opts.mode, opts.label, opts.title);
    return { set: set, el: el };
  }

  function mountEmpty(el, opts) {
    el = $(el);
    if (!el) return null;
    opts = opts || {};
    el.classList.add("mm-demo-empty");
    el.hidden = false;
    el.innerHTML = "<strong>" + esc(opts.title || "Nothing here yet") + "</strong>" +
      (opts.body ? "<span>" + esc(opts.body) + "</span>" : "");
    return el;
  }

  function mountWalkthrough(root, opts) {
    root = $(root);
    opts = opts || {};
    var steps = (opts.steps || []).filter(Boolean);
    if (!root || !steps.length) return null;
    var id = opts.id || "default";
    var done = readDone(id).filter(function (s) { return steps.some(function (x) { return x.id === s; }); });
    var active = -1;
    var lastDone = -1;

    var bar = document.createElement("section");
    bar.className = "mm-demo-bar" + (opts.floating ? " mm-demo-bar--floating" : "");
    bar.setAttribute("aria-label", (opts.title || "Walkthrough") + " — guided demo");
    bar.innerHTML =
      '<div class="mm-demo-bar__head">' +
        '<p class="mm-demo-bar__title">' + esc(opts.title || "Walkthrough") + "</p>" +
        '<span class="mm-demo-bar__count" data-k="count"></span>' +
        '<div class="mm-demo-bar__progress" aria-hidden="true"><i data-k="fill"></i></div>' +
        '<button type="button" class="mm-demo-chip mm-demo-chip--ghost" data-k="toggle" aria-expanded="true">Hide</button>' +
      "</div>" +
      '<ol class="mm-demo-bar__steps" data-k="steps"></ol>' +
      '<p class="mm-demo-bar__hint" data-k="hint" aria-live="polite"></p>' +
      '<div class="mm-demo-bar__actions">' +
        '<button type="button" class="mm-demo-chip mm-demo-chip--solid" data-k="next">Start</button>' +
        '<button type="button" class="mm-demo-chip mm-demo-chip--ghost" data-k="reset">Reset</button>' +
      "</div>";

    var q = function (k) { return bar.querySelector('[data-k="' + k + '"]'); };
    var stepsEl = q("steps"), hintEl = q("hint"), nextBtn = q("next"), countEl = q("count"), fillEl = q("fill");

    steps.forEach(function (s, i) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mm-demo-chip";
      b.textContent = (i + 1) + " · " + s.label;
      b.dataset.step = s.id;
      b.addEventListener("click", function () { go(i); });
      li.appendChild(b);
      stepsEl.appendChild(li);
    });

    function isDone(stepId) { return done.indexOf(stepId) !== -1; }
    function paint() {
      var chips = stepsEl.querySelectorAll(".mm-demo-chip");
      chips.forEach(function (c, i) {
        c.classList.toggle("is-active", i === active);
        c.classList.toggle("is-done", isDone(steps[i].id));
        if (i === active) c.setAttribute("aria-current", "step"); else c.removeAttribute("aria-current");
      });
      var n = done.length, total = steps.length;
      countEl.textContent = n + "/" + total;
      fillEl.style.width = Math.round((n / total) * 100) + "%";
      var complete = n >= total;
      bar.classList.toggle("is-complete", complete);
      if (complete && active === -1) {
        hintEl.innerHTML = "<strong>Demo path complete.</strong> " + esc(opts.completeText || "Replay any step, or Reset to start over.");
      } else if (active >= 0) {
        hintEl.innerHTML = "<strong>" + esc(steps[active].label) + ".</strong> " + esc(steps[active].hint || "");
      } else if (lastDone >= 0 && firstUndone() >= 0) {
        hintEl.innerHTML = "<strong>✓ " + esc(steps[lastDone].label) + " done.</strong> Next up: " + esc(steps[firstUndone()].label) + ".";
      } else {
        hintEl.textContent = opts.intro || "Tap Start for a guided run through the core demo loop.";
      }
      var nextIdx = firstUndone();
      if (active === -1) nextBtn.textContent = complete ? "Replay" : (n ? "Next: " + steps[nextIdx].label : "Start");
      else nextBtn.textContent = (active >= total - 1) ? (complete ? "Finish" : "Next undone") : "Next";
      nextBtn.disabled = false;
    }
    function firstUndone() {
      for (var i = 0; i < steps.length; i++) if (!isDone(steps[i].id)) return i;
      return -1;
    }
    function go(i) {
      if (i < 0 || i >= steps.length) return;
      active = i;
      paint();
      if (typeof opts.onStep === "function") {
        try { opts.onStep(steps[i], i, api); } catch (e) { if (global.console) console.warn("[MMDemoKit] onStep", e); }
      }
    }
    function markDone(stepId) {
      if (!stepId || isDone(stepId)) { paint(); return; }
      if (!steps.some(function (s) { return s.id === stepId; })) return;
      done = persistDone(id, stepId).filter(function (s) { return steps.some(function (x) { return x.id === s; }); });
      var idx = steps.findIndex(function (s) { return s.id === stepId; });
      lastDone = idx;
      if (idx === active) active = -1;
      paint();
      if (typeof opts.onDone === "function") { try { opts.onDone(stepId, api); } catch (e) {} }
      if (done.length >= steps.length && typeof opts.onComplete === "function") {
        try { opts.onComplete(api); } catch (e) {}
      }
    }
    function reset() {
      done = []; writeDone(id, []); active = -1; lastDone = -1; paint();
    }
    nextBtn.addEventListener("click", function () {
      if (active === -1) { var f = firstUndone(); go(f === -1 ? 0 : f); return; }
      if (active < steps.length - 1) { go(active + 1); return; }
      var u = firstUndone();
      if (u === -1) { active = -1; paint(); } else go(u);
    });
    q("reset").addEventListener("click", reset);
    var toggle = q("toggle");
    toggle.addEventListener("click", function () {
      var c = !bar.classList.contains("is-collapsed");
      bar.classList.toggle("is-collapsed", c);
      toggle.textContent = c ? "Show" : "Hide";
      toggle.setAttribute("aria-expanded", c ? "false" : "true");
    });
    if (opts.startCollapsed) toggle.click();

    if (opts.insert === "prepend") root.insertBefore(bar, root.firstChild);
    else if (opts.insert === "before") root.parentNode.insertBefore(bar, root);
    else root.appendChild(bar);

    var api = {
      el: bar, go: go, done: markDone, markDone: markDone, isDone: isDone, reset: reset,
      progress: function () { return { done: done.slice(), total: steps.length }; }
    };
    paint();
    return api;
  }

  function copyText(text) {
    text = String(text || "");
    if (global.navigator && navigator.clipboard && global.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
    }
    return Promise.resolve(fallback());
    function fallback() {
      try {
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        var ok = document.execCommand("copy"); ta.remove(); return !!ok;
      } catch (e) { return false; }
    }
  }

  global.MMDemoKit = {
    mountWalkthrough: mountWalkthrough,
    mountStatus: mountStatus,
    mountEmpty: mountEmpty,
    persistDone: persistDone,
    markDone: persistDone,
    readDone: readDone,
    copyText: copyText,
    version: "2026-10-05"
  };
})(typeof window !== "undefined" ? window : globalThis);
