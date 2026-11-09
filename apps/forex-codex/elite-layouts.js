/* ==========================================================================
   MENS MERCATUS LAB — 30 ELITE IMPERIAL LAYOUT SWITCHER ENGINE
   ========================================================================== */

(function () {
  const ELITE_LAYOUTS = [
    // 1. Imperial & Sovereign Desks
    { id: "monaco-sovereign", name: "Monaco Sovereign", cat: "Imperial", colors: ["#070b14", "#d4af37", "#38bdf8"], desc: "Midnight blue, champagne gold borders, frosted crystal cards." },
    { id: "mayfair-family-office", name: "Mayfair Family Office", cat: "Imperial", colors: ["#08140e", "#ca8a04", "#10b981"], desc: "British racing green, polished brass accents, rich vellum finish." },
    { id: "zurich-vault-terminal", name: "Zurich Vault Terminal", cat: "Imperial", colors: ["#121316", "#e2e8f0", "#3b82f6"], desc: "Swiss precision titanium grey, matte platinum edges, high density." },
    { id: "dubai-skydeck-apex", name: "Dubai Skydeck Apex", cat: "Imperial", colors: ["#0a0604", "#f59e0b", "#fbbf24"], desc: "Desert sunset amber, obsidian glass, 24k gold particle glow." },
    { id: "singapore-marina-nexus", name: "Singapore Marina Nexus", cat: "Imperial", colors: ["#021217", "#06b6d4", "#10b981"], desc: "Lagoon slate, holographic cyan tickers, emerald nightglow." },
    { id: "luxembourg-private-reserve", name: "Luxembourg Private Reserve", cat: "Imperial", colors: ["#0b0714", "#a855f7", "#c084fc"], desc: "Royal amethyst purple, brushed silver borders, velvet shadows." },

    // 2. Haute Couture & Elite Designer Ateliers
    { id: "milan-runway-atelier", name: "Milan Runway Atelier", cat: "Haute Couture", colors: ["#050505", "#ffffff", "#e5e5e5"], desc: "Stark editorial monochrome, ultra-crisp serif accents, razor lines." },
    { id: "paris-haute-couture", name: "Paris Haute Couture", cat: "Haute Couture", colors: ["#faf8f5", "#b45309", "#4338ca"], desc: "Parisian ivory, rose-gold filigree, soft gaussian glass blur." },
    { id: "tokyo-avant-garde", name: "Tokyo Avant-Garde", cat: "Haute Couture", colors: ["#0a0012", "#ec4899", "#06b6d4"], desc: "Cyber-punk neon magenta, deep carbon fiber mesh, high contrast." },
    { id: "kyoto-zen-minimalist", name: "Kyoto Zen Minimalist", cat: "Haute Couture", colors: ["#f5f4ef", "#44403c", "#059669"], desc: "Warm washi paper, sumi ink charcoal, balanced negative space." },
    { id: "scandinavian-fjord-nordic", name: "Scandinavian Fjord", cat: "Haute Couture", colors: ["#f0f4f8", "#0284c7", "#0ea5e9"], desc: "Ice-blue minimalism, bleached birchwood undertones, hyper-legible." },
    { id: "antwerp-diamond-cut", name: "Antwerp Diamond Cut", cat: "Haute Couture", colors: ["#07090e", "#38bdf8", "#818cf8"], desc: "Prismatic diamond refractions, geometric facet borders, crystal clear." },

    // 3. High-Frequency & Godmode Quant Citadel
    { id: "citadel-dark-matrix", name: "Citadel Dark Matrix", cat: "Quant Citadel", colors: ["#020804", "#22c55e", "#16a34a"], desc: "Terminal obsidian, phosphorescent radar green, millisecond ticks." },
    { id: "renaissance-alpha-core", name: "Renaissance Alpha Core", cat: "Quant Citadel", colors: ["#051015", "#0284c7", "#f59e0b"], desc: "Deep petroleum teal, bronze telemetry badges, math sparklines." },
    { id: "two-sig-hologram", name: "Two Sigma Hologram", cat: "Quant Citadel", colors: ["#050614", "#6366f1", "#818cf8"], desc: "Deep space indigo, holographic ultraviolet grid, floating glass." },
    { id: "jump-speed-optical", name: "Jump Speed Optical", cat: "Quant Citadel", colors: ["#0a0304", "#e11d48", "#fb7185"], desc: "Ultra-fast dark mode, laser crimson signals, micro-gauges." },
    { id: "manhattan-black-tower", name: "Manhattan Black Tower", cat: "Quant Citadel", colors: ["#000000", "#2563eb", "#3b82f6"], desc: "Pitch-black OLED, stark cobalt accents, institutional Wall Street HUD." },
    { id: "geneva-macro-horology", name: "Geneva Macro Horology", cat: "Quant Citadel", colors: ["#0a0d13", "#eab308", "#93c5fd"], desc: "Patek-inspired perpetual calendar aesthetics, celestial gold gauges." },

    // 4. AGI & Frontier Research Laboratories
    { id: "deepmind-gemini-omni", name: "DeepMind Gemini Omni", cat: "AGI Labs", colors: ["#060913", "#3b82f6", "#8b5cf6"], desc: "Iridescent pearl gradient, clean titanium cards, multimodal docks." },
    { id: "anthropic-claude-neural", name: "Anthropic Claude Neural", cat: "AGI Labs", colors: ["#14110f", "#d97706", "#f59e0b"], desc: "Warm terracotta, humanist typography, deep parchment focus." },
    { id: "openai-stargate-supercluster", name: "OpenAI Stargate", cat: "AGI Labs", colors: ["#040814", "#10a37f", "#06b6d4"], desc: "Cosmic nebula violet, glowing mint emerald synapse nodes." },
    { id: "cern-quantum-collider", name: "CERN Quantum Collider", cat: "AGI Labs", colors: ["#020617", "#38bdf8", "#818cf8"], desc: "Sub-atomic particle blue, glowing vacuum chambers, vector overlays." },
    { id: "mit-media-lab-kinetic", name: "MIT Media Lab Kinetic", cat: "AGI Labs", colors: ["#0a0a0a", "#facc15", "#f43f5e"], desc: "Dynamic interactive grid, generative typography, fluid motion tiles." },
    { id: "bell-labs-analog-revival", name: "Bell Labs Analog", cat: "AGI Labs", colors: ["#12100d", "#f59e0b", "#ea580c"], desc: "Vacuum-tube amber warmth, brushed aluminum, analog VU meters." },

    // 5. Imperial Aerospace & Autonomous Command
    { id: "lockheed-skunkworks-stealth", name: "Lockheed Skunkworks", cat: "Aerospace", colors: ["#040507", "#94a3b8", "#38bdf8"], desc: "Radar-absorbent carbon black, stealth angles, FLIR monochrome." },
    { id: "spacex-starship-glass", name: "SpaceX Starship Glass", cat: "Aerospace", colors: ["#030712", "#0284c7", "#38bdf8"], desc: "Aerospace glass cockpit, orbital trajectory arcs, launch telemetry." },
    { id: "palantir-foundry-recon", name: "Palantir Foundry Recon", cat: "Aerospace", colors: ["#050b11", "#14b8a6", "#06b6d4"], desc: "Tactical dark slate, target-acquisition reticles, ontology tree." },
    { id: "norad-bunker-command", name: "NORAD Bunker Command", cat: "Aerospace", colors: ["#0a0700", "#eab308", "#ef4444"], desc: "Hardened bunker amber CRT, DEFCON status bar, trajectory charts." },
    { id: "rolls-royce-aerospace", name: "Rolls-Royce Aerospace", cat: "Aerospace", colors: ["#060a17", "#1d4ed8", "#cbd5e1"], desc: "Bespoke royal blue, turbine chrome gauges, precision engineering." },
    { id: "valhalla-godmode-sovereign", name: "Valhalla Godmode Sovereign", cat: "Aerospace", colors: ["#05020a", "#d946ef", "#eab308"], desc: "Divine prism magenta, imperial crown gold, absolute sovereignty." }
  ];

  const STORAGE_KEY = "mens_mercatus_elite_layout";

  function applyLayout(id) {
    const layout = ELITE_LAYOUTS.find((l) => l.id === id) || ELITE_LAYOUTS[0];
    document.documentElement.setAttribute("data-elite-layout", layout.id);
    localStorage.setItem(STORAGE_KEY, layout.id);

    // Update active state in modal if open
    document.querySelectorAll(".elite-card").forEach((card) => {
      card.classList.toggle("current", card.dataset.layoutId === layout.id);
    });

    // Update button label
    const btn = document.getElementById("elite-picker-label");
    if (btn) btn.textContent = layout.name;

    // Dispatch event for other modules
    window.dispatchEvent(new CustomEvent("elite-layout-changed", { detail: layout }));
  }

  function renderModal() {
    if (document.getElementById("elite-layout-modal")) return;

    const modal = document.createElement("div");
    modal.id = "elite-layout-modal";
    modal.className = "elite-layout-modal";
    modal.innerHTML = `
      <div class="elite-layout-dialog">
        <div class="elite-layout-header">
          <h3><span>👑</span> 30 Elite Imperial & Haute Couture Layouts</h3>
          <button type="button" class="elite-layout-close" id="elite-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="elite-layout-categories" id="elite-layout-cats">
          <button type="button" class="elite-cat-pill active" data-cat="all">All (30)</button>
          <button type="button" class="elite-cat-pill" data-cat="Imperial">Imperial Desks (6)</button>
          <button type="button" class="elite-cat-pill" data-cat="Haute Couture">Haute Couture (6)</button>
          <button type="button" class="elite-cat-pill" data-cat="Quant Citadel">Quant Citadel (6)</button>
          <button type="button" class="elite-cat-pill" data-cat="AGI Labs">AGI Labs (6)</button>
          <button type="button" class="elite-cat-pill" data-cat="Aerospace">Aerospace Command (6)</button>
        </div>
        <div class="elite-layout-grid" id="elite-layout-grid"></div>
      </div>
    `;

    document.body.appendChild(modal);

    const grid = modal.querySelector("#elite-layout-grid");
    const currentId = localStorage.getItem(STORAGE_KEY) || "monaco-sovereign";

    function populateGrid(filterCat = "all") {
      grid.innerHTML = "";
      const filtered = filterCat === "all" ? ELITE_LAYOUTS : ELITE_LAYOUTS.filter((l) => l.cat === filterCat);

      filtered.forEach((item) => {
        const card = document.createElement("div");
        card.className = `elite-card ${item.id === currentId ? "current" : ""}`;
        card.dataset.layoutId = item.id;
        card.innerHTML = `
          <div class="elite-card-swatches">
            ${item.colors.map((c) => `<div class="elite-swatch" style="background:${c}"></div>`).join("")}
          </div>
          <div class="elite-card-cat">${item.cat}</div>
          <div class="elite-card-title">${item.name}</div>
          <div class="elite-card-desc">${item.desc}</div>
        `;
        card.addEventListener("click", () => {
          applyLayout(item.id);
          modal.classList.remove("active");
        });
        grid.appendChild(card);
      });
    }

    populateGrid();

    // Category filter click
    modal.querySelectorAll(".elite-cat-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        modal.querySelectorAll(".elite-cat-pill").forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        populateGrid(pill.dataset.cat);
      });
    });

    // Close handlers
    modal.querySelector("#elite-modal-close").addEventListener("click", () => {
      modal.classList.remove("active");
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("active");
    });
  }

  function injectPickerButton() {
    if (document.getElementById("elite-layout-picker-btn")) return;

    const currentId = localStorage.getItem(STORAGE_KEY) || "monaco-sovereign";
    const currentLayout = ELITE_LAYOUTS.find((l) => l.id === currentId) || ELITE_LAYOUTS[0];

    const btn = document.createElement("button");
    btn.id = "elite-layout-picker-btn";
    btn.className = "elite-layout-picker-btn";
    btn.type = "button";
    btn.title = "Switch between 30 Elite Imperial & Haute Couture Layouts";
    btn.innerHTML = `
      <span>🏛️</span>
      <span id="elite-picker-label">${currentLayout.name}</span>
      <span style="opacity:0.6;font-size:10px;">▼</span>
    `;

    btn.addEventListener("click", () => {
      renderModal();
      document.getElementById("elite-layout-modal")?.classList.add("active");
    });

    document.body.appendChild(btn);
  }

  // Initialize on DOM Ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      const saved = localStorage.getItem(STORAGE_KEY) || "monaco-sovereign";
      applyLayout(saved);
      injectPickerButton();
    });
  } else {
    const saved = localStorage.getItem(STORAGE_KEY) || "monaco-sovereign";
    applyLayout(saved);
    injectPickerButton();
  }

  // Export API
  window.MensMercatusEliteLayouts = {
    layouts: ELITE_LAYOUTS,
    apply: applyLayout,
    openModal: () => {
      renderModal();
      document.getElementById("elite-layout-modal")?.classList.add("active");
    },
  };
})();
