/* Device Lab — cold-call bezels (not Replit iOS/Android emulator streams) */
(function () {
  "use strict";
  const DEVICES = {
    iphone15: { label: "iPhone 15", w: 393, h: 852, r: 48, bar: true, home: true },
    pixel8: { label: "Pixel 8", w: 412, h: 915, r: 28, bar: true, home: false },
    ipadmini: { label: "iPad mini", w: 744, h: 1133, r: 18, bar: true, home: false }
  };
  const LS = "mc-device-lab";

  function load() {
    try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch (_) { return {}; }
  }
  function save(s) {
    localStorage.setItem(LS, JSON.stringify(s));
    window.MCDB?.setSync?.(LS, s);
  }

  const api = {
    DEVICES,
    state() {
      const s = load();
      return {
        device: s.device || "iphone15",
        rotate: !!s.rotate,
        scale: s.scale || 0.72,
        target: s.target || "portal"
      };
    },
    set(partial) {
      const s = { ...this.state(), ...partial };
      save(s);
      return s;
    },
    wrap(innerHtml, opts = {}) {
      const st = { ...this.state(), ...opts };
      const d = DEVICES[st.device] || DEVICES.iphone15;
      const landscape = st.rotate;
      const w = landscape ? d.h : d.w;
      const h = landscape ? d.w : d.h;
      const scale = st.scale;
      return `<div class="device-lab" data-device="${st.device}">
        <div class="device-lab-toolbar">
          ${Object.keys(DEVICES).map(k =>
            `<button type="button" class="mc-art-chip${k === st.device ? " is-active" : ""}" data-dev="${k}">${DEVICES[k].label}</button>`
          ).join("")}
          <button type="button" class="btn btn-ghost btn-sm" data-dev-rotate>Rotate</button>
          <label class="mini">Scale <input type="range" data-dev-scale min="40" max="100" value="${Math.round(scale * 100)}"></label>
        </div>
        <div class="device-lab-stage">
          <div class="device-bezel" style="width:${w}px;height:${h}px;border-radius:${d.r}px;transform:scale(${scale});transform-origin:top center">
            ${d.bar ? `<div class="device-status"><span>9:41</span><span>●●● 5G</span></div>` : ""}
            <div class="device-screen">${innerHtml}</div>
            ${d.home && !landscape ? `<div class="device-home"></div>` : ""}
          </div>
        </div>
      </div>`;
    },
    bind(root, onChange) {
      if (!root) return;
      root.querySelectorAll("[data-dev]").forEach(b => b.addEventListener("click", () => {
        this.set({ device: b.dataset.dev });
        onChange?.(this.state());
      }));
      root.querySelector("[data-dev-rotate]")?.addEventListener("click", () => {
        const st = this.state();
        this.set({ rotate: !st.rotate });
        onChange?.(this.state());
      });
      root.querySelector("[data-dev-scale]")?.addEventListener("input", e => {
        this.set({ scale: (+e.target.value) / 100 });
        onChange?.(this.state());
      });
    },
    mountInto(host, contentHtml, onChange) {
      if (!host) return;
      host.innerHTML = this.wrap(contentHtml);
      this.bind(host, () => {
        host.innerHTML = this.wrap(contentHtml);
        this.bind(host, onChange);
        onChange?.(this.state());
      });
    }
  };
  window.MCDevice = api;
})();
