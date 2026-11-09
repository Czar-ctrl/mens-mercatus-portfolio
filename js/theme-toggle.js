/**
 * Mens Mercatus — light / dark theme toggle (sun / moon).
 * Persists: localStorage["mm-color-mode"] = "light" | "dark" (default dark).
 * Applies html.mm-light and syncs with ambient BG picker (light-3d / Glass).
 * Injects a button into .nav-actions (creates the slot if missing).
 */
(function () {
  "use strict";
  var MODE_KEY = "mm-color-mode";
  var AMBIENT_KEY = "mm-ambient-variant";
  var AMBIENT_BACKUP = "mm-ambient-before-light";
  var LIGHT_VARIANT = "light-3d";
  var syncing = false;

  function readMode() {
    try {
      var m = localStorage.getItem(MODE_KEY);
      if (m === "light" || m === "dark") return m;
    } catch (e) {}
    return "dark";
  }

  function writeMode(m) {
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch (e) {}
  }

  function applyDom(light) {
    document.documentElement.classList.toggle("mm-light", light);
    if (document.body) {
      document.body.classList.toggle("mm-ambient-light-3d", light);
    }
    document.documentElement.classList.toggle("mm-theme-light-3d", light);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", light ? "#f4f1ea" : "#0a0a0a");
    document.querySelectorAll(".mm-theme-toggle").forEach(function (btn) {
      btn.setAttribute("aria-pressed", light ? "true" : "false");
      btn.setAttribute("aria-label", light ? "Switch to dark mode" : "Switch to light mode");
      btn.title = light ? "Dark mode" : "Light mode";
      btn.classList.toggle("is-light", light);
    });
  }

  function backupAmbientIfNeeded() {
    try {
      var cur = localStorage.getItem(AMBIENT_KEY);
      if (cur && cur !== LIGHT_VARIANT) {
        localStorage.setItem(AMBIENT_BACKUP, cur);
      }
    } catch (e) {}
  }

  function restoreAmbient() {
    try {
      var prev = localStorage.getItem(AMBIENT_BACKUP);
      if (prev && prev !== LIGHT_VARIANT) return prev;
    } catch (e) {}
    return "web";
  }

  function syncAmbient(light) {
    if (syncing) return;
    syncing = true;
    try {
      if (light) {
        backupAmbientIfNeeded();
        try {
          localStorage.setItem(AMBIENT_KEY, LIGHT_VARIANT);
        } catch (e) {}
        if (window.MMAmbient && typeof window.MMAmbient.setVariant === "function") {
          if (window.MMAmbient.getVariant() !== LIGHT_VARIANT) {
            window.MMAmbient.setVariant(LIGHT_VARIANT);
          }
        }
      } else {
        var back = restoreAmbient();
        try {
          localStorage.setItem(AMBIENT_KEY, back);
        } catch (e) {}
        if (window.MMAmbient && typeof window.MMAmbient.setVariant === "function") {
          if (window.MMAmbient.getVariant() === LIGHT_VARIANT) {
            window.MMAmbient.setVariant(back);
          }
        }
      }
    } finally {
      syncing = false;
    }
  }

  function setMode(mode, opts) {
    opts = opts || {};
    var light = mode === "light";
    writeMode(light ? "light" : "dark");
    applyDom(light);
    if (!opts.skipAmbient) syncAmbient(light);
    try {
      window.dispatchEvent(
        new CustomEvent("mm-color-mode", { detail: { mode: light ? "light" : "dark" } })
      );
    } catch (e) {}
  }

  function toggle() {
    setMode(readMode() === "light" ? "dark" : "light");
  }

  function sunMoonSvg(which) {
    if (which === "sun") {
      return (
        '<svg class="mm-theme-ico mm-theme-ico--sun" viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/>' +
        '<path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8l1.8-1.8M18 6l1.8-1.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' +
        "</svg>"
      );
    }
    return (
      '<svg class="mm-theme-ico mm-theme-ico--moon" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M20 13.5A8.5 8.5 0 1 1 10.5 4 7 7 0 0 0 20 13.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>' +
      "</svg>"
    );
  }

  function ensureButton() {
    if (document.querySelector(".mm-theme-toggle")) return;
    var actions = document.querySelector(".nav-actions");
    if (!actions) {
      var inner = document.querySelector(".site-nav .nav-inner");
      var links = document.querySelector(".site-nav .nav-links");
      if (!inner) return;
      actions = document.createElement("div");
      actions.className = "nav-actions";
      if (links && links.parentNode === inner) {
        links.insertAdjacentElement("afterend", actions);
      } else {
        inner.appendChild(actions);
      }
    }
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mm-theme-toggle nav-icon-btn";
    btn.setAttribute("data-mm-theme-toggle", "");
    btn.innerHTML =
      '<span class="mm-theme-swap" aria-hidden="true">' +
      sunMoonSvg("sun") +
      sunMoonSvg("moon") +
      "</span>" +
      '<span class="sr-only">Toggle light and dark mode</span>';
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      toggle();
    });
    // Prefer first in actions (visible), before palette / sidebar
    actions.insertBefore(btn, actions.firstChild);
  }

  function onAmbientChange(e) {
    if (syncing) return;
    var v = (e && e.detail && e.detail.variant) || null;
    if (!v && window.MMAmbient && typeof window.MMAmbient.getVariant === "function") {
      v = window.MMAmbient.getVariant();
    }
    if (!v) return;
    if (v === LIGHT_VARIANT) {
      if (readMode() !== "light") setMode("light", { skipAmbient: true });
      else applyDom(true);
    } else if (readMode() === "light") {
      setMode("dark", { skipAmbient: true });
    }
  }

  function boot() {
    ensureButton();
    applyDom(readMode() === "light");
    // Late ambient sync once MMAmbient may exist
    setTimeout(function () {
      if (readMode() === "light") syncAmbient(true);
    }, 0);
    window.addEventListener("mm-ambient-change", onAmbientChange);
  }

  // Expose for ambient / debug
  window.MMTheme = {
    getMode: readMode,
    setMode: function (m) {
      setMode(m === "light" ? "light" : "dark");
    },
    toggle: toggle
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
