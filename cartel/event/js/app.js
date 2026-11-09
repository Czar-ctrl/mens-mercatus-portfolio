/* Mercatus Cartel Event — UI-only interactivity. localStorage fake state. NOT a backend. */
(function () {
  const KEY = "mc-event-mock-v1";

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
    catch { return {}; }
  }
  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  function get(path, fallback) {
    const s = load();
    return path.split(".").reduce((a, k) => (a && a[k] !== undefined ? a[k] : undefined), s) ?? fallback;
  }
  function set(path, value) {
    const s = load();
    const parts = path.split(".");
    let cur = s;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = cur[parts[i]] || {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    save(s);
    return s;
  }

  window.MC = { load, save, get, set };

  // Toggles
  document.querySelectorAll("[data-toggle]").forEach((el) => {
    const key = el.getAttribute("data-toggle");
    const on = !!get(key, el.classList.contains("on"));
    el.classList.toggle("on", on);
    el.setAttribute("aria-checked", on ? "true" : "false");
    el.addEventListener("click", () => {
      const next = !el.classList.contains("on");
      el.classList.toggle("on", next);
      el.setAttribute("aria-checked", next ? "true" : "false");
      set(key, next);
    });
  });

  // Checkboxes that gate a primary button
  document.querySelectorAll("[data-gate-form]").forEach((form) => {
    const btn = form.querySelector("[data-gate-submit]");
    const boxes = form.querySelectorAll('input[type="checkbox"][data-required]');
    const sync = () => {
      const ok = [...boxes].every((b) => b.checked);
      if (btn) btn.disabled = !ok;
    };
    boxes.forEach((b) => b.addEventListener("change", sync));
    sync();
  });

  // Fake Assist strip
  document.querySelectorAll("[data-assist]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-assist");
      const strip = document.querySelector(`[data-assist-strip="${id}"]`);
      btn.classList.add("active");
      if (strip) {
        strip.classList.add("show");
        strip.innerHTML = `<span class="label">Assist</span>${btn.getAttribute("data-assist-text") || "Ready — review the gates above, then continue."}`;
      }
      setTimeout(() => btn.classList.remove("active"), 600);
    });
  });

  // Tabs
  document.querySelectorAll("[data-tabs]").forEach((root) => {
    const tabs = root.querySelectorAll(".tab");
    const panels = root.querySelectorAll("[data-panel]");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const name = tab.getAttribute("data-tab");
        tabs.forEach((t) => t.classList.toggle("on", t === tab));
        panels.forEach((p) => p.classList.toggle("hidden", p.getAttribute("data-panel") !== name));
      });
    });
  });

  // Photo slot fake fill
  document.querySelectorAll("[data-photo]").forEach((slot) => {
    const key = slot.getAttribute("data-photo");
    if (get(key, false)) slot.classList.add("filled"), (slot.textContent = "Photo captured");
    slot.addEventListener("click", () => {
      slot.classList.add("filled");
      slot.textContent = "Photo captured";
      set(key, true);
    });
  });

  // Status chips from state
  document.querySelectorAll("[data-state-text]").forEach((el) => {
    const key = el.getAttribute("data-state-text");
    const v = get(key, el.textContent);
    if (v) el.textContent = v;
  });
})();
