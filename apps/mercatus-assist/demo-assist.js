/**
 * Mercatus Assist — DEMO coaching + live bootstrap for the portfolio.
 * Prefer live same-origin /api/cartel/ when VPS health is ok; otherwise DEMO.
 * Honest canned coaching only (keyword / intent match). Never invents balances,
 * rates, KYC outcomes, or claims to be a live LLM. Label every reply DEMO.
 * Includes guided DEMO tour chips (still DEMO labelled).
 */
(function (global) {
  const DEMO_REPLIES = [
    {
      id: "wont-do",
      test: /won'?t|refuse|limit|cannot|can'?t|never do|hard limit|jailbreak|bypass/i,
      text:
        "DEMO · What Assist will not do: invent balances or payout amounts; skip KYC / POPIA; paste a full SA ID; coach unlicensed passenger e-hailing (NLTA); enable close-friends ping silently; replace your judgment on money or identity. Tools must still work if Assist fails.",
    },
    {
      id: "kyc-popia",
      test: /kyc|popia|sa\s*id|identity|verify|redact|sassa|criminal.?check|privacy/i,
      text:
        "DEMO · KYC / POPIA: coach the next verify step (e.g. SA ID front photo) — never paste a full SA ID back or ask for SASSA credentials. Criminal-check items are reference IDs for operators, not raw certificate dumps in chat. Next: keep PII minimised and purpose-limited.",
    },
    {
      id: "signup",
      test: /signup|sign.?up|gate|18\+|roster|health\s*decl/i,
      text:
        "DEMO · Event signup gates: 18+, health declaration, criminal-check reference IDs before roster accept. Assist explains missing fields — it does not waive gates. Next: Blueprint Event → Signup gate.",
    },
    {
      id: "rate-lock",
      test: /rate|nmw|minimum\s*wage|lock|4.?hour|bcea/i,
      text:
        "DEMO · Rate lock: honour the gazetted NMW floor shown on the Event screen (illustrative R30.23 / ordinary hour in the pack). Lock before accept. Where employment applies, honour the 4-hour rule subject to BCEA / sectoral rules. Assist never invents a payout figure — only explain the locked amount already on screen. Next: Blueprint Event → Rate lock.",
    },
    {
      id: "checkin",
      test: /check-?in|check-?out|checkout|geo|supervisor|window/i,
      text:
        "DEMO · Check-in/out uses geo/time windows; supervisor checkout is required before payout release. Offline can stage evidence; money never settles client-side.",
    },
    {
      id: "payout",
      test: /dispute|no-?show|payout|netza|wallet|balance|escrow|release/i,
      text:
        "DEMO · Payout: Netza release only after supervisor checkout with no open dispute. No-show path is grace → auto-cancel → penalty flag → escrow refund — separate from the skills ladder. Assist never invents balances or recommends specific payout amounts.",
    },
    {
      id: "friends",
      test: /friend|ping|gps|location|consent/i,
      text:
        "DEMO · Close-friends ping is per-friend allow/deny, default OFF, mutual allow required. Location is POPIA personal information — minimise retention. Assist explains consent; it never enables ping silently.",
    },
    {
      id: "nlta",
      test: /passenger|e-?hail|nlta|uber|taxi|goods/i,
      text:
        "DEMO · Goods ≠ passenger. Assist refuses to coach unlicensed passenger e-hailing (NLTA). Vehicle checklist in this pack is goods-oriented unless the operator clearly holds the right authority — and Assist still does not give legal advice.",
    },
    {
      id: "diagrams",
      test: /diagram|architect|schematic|k8s|kubernetes|pipeline|topology|node/i,
      text:
        "DEMO · Schematics live under blueprint/diagrams/ (overall, AI Assist pipeline, K8s topology, event flow, GPS ping, compliance, five jobs). On focus, Assist should give one-sentence node explain — this page is the Assist scaffold, not a live cluster.",
    },
    {
      id: "ladder",
      test: /ladder|badge|skill|certif|points/i,
      text:
        "DEMO · Skills ladder is recognition / certification badges only — not punishment. Disputes and no-shows use separate flags; they do not subtract ladder points. Next: Blueprint Event → Points ladder.",
    },
    {
      id: "vehicle",
      test: /vehicle|checklist|goods\s*run|van|bakkie/i,
      text:
        "DEMO · Vehicle checklist is goods-oriented (tyres, lights, load secure). It is not a passenger e-hail pack. Next: Blueprint Event → Vehicle checklist.",
    },
    {
      id: "backend",
      test: /dotnet|api|5080|backend|run|llm|api.?key|live\s*path/i,
      text:
        "DEMO · When health is ok, Assist boots LIVE via same-origin /api/cartel/ → DreamHost VPS :5080. This canned reply only shows in DEMO fallback (robot down or boot failed). Keyword coaching never invents balances or KYC outcomes.",
    },
    {
      id: "jobnet",
      test: /jobnet|drop\s*net|hawk|career/i,
      text:
        "DEMO · JobNet is a sister Mens Mercatus surface (career pipeline / Drop Net) — not this Assist robot. Assist here coaches Blueprint Event / Netza / POPIA only. Open Apps → Drop Net / JobNet for that brief.",
    },
    {
      id: "brand",
      test: /brand|colour|color|red|gold|greysound|logo|mark/i,
      text:
        "DEMO · Brand: red / black / white across Mens Mercatus and Blueprint (accent #c8102e). Spacing and hierarchy over decoration — no oversized logos; the wheat mark stays ~16px in the header.",
    },
    {
      id: "tour",
      test: /tour|walkthrough|guided|demo\s*tour|start\s*demo/i,
      text:
        "DEMO · Guided tour: use the DEMO tour bar (Start / Next) or chips labelled Tour. Path = signup → rate lock → KYC → check-in → payout → hard limits. Every step stays canned DEMO coaching.",
    },
  ];

  const STARTERS = [
    "▶ Start DEMO tour",
    "Event signup gates",
    "Rate lock / NMW",
    "KYC / POPIA",
    "Check-in / checkout",
    "Payout / Netza",
    "What Assist won't do",
    "Diagrams",
    "Close-friends ping",
    "NLTA goods vs passenger",
  ];

  /** Ordered guided DEMO walkthrough (still DEMO labelled). */
  const TOUR_STEPS = [
    {
      chip: "1 · Signup gates",
      prompt: "Event signup gates",
      tip: "DEMO tour 1/6 · Gates before roster",
    },
    {
      chip: "2 · Rate lock",
      prompt: "Rate lock / NMW",
      tip: "DEMO tour 2/6 · NMW floor + lock",
    },
    {
      chip: "3 · KYC / POPIA",
      prompt: "KYC / POPIA",
      tip: "DEMO tour 3/6 · Minimise PII",
    },
    {
      chip: "4 · Check-in",
      prompt: "Check-in / checkout",
      tip: "DEMO tour 4/6 · Geo windows + supervisor",
    },
    {
      chip: "5 · Payout",
      prompt: "Payout / Netza",
      tip: "DEMO tour 5/6 · Release rules (no invented balances)",
    },
    {
      chip: "6 · Hard limits",
      prompt: "What Assist won't do",
      tip: "DEMO tour 6/6 · Refusals",
    },
  ];

  function demoReply(message) {
    const m = String(message || "");
    const retrieved = global.PortfolioRetrieve && global.PortfolioRetrieve.retrieve(m);
    if (retrieved && retrieved.hits && retrieved.hits.length && retrieved.hits[0].score >= 0.12) {
      const names = retrieved.hits.map((hit) => hit.id).join(", ");
      return "DEMO · Retrieved " + names + ". " + retrieved.hits[0].text;
    }
    for (const row of DEMO_REPLIES) {
      if (row.test.test(m)) return row.text;
    }
    return "DEMO · Mercatus Assist demo mode (keyword coaching — not a live LLM). Covers Event signup, rate lock, KYC/POPIA, payout/Netza, diagrams, close-friends, NLTA goods vs passenger, and hard limits. Ask one of those or tap ▶ Start DEMO tour.";
  }

  function setPill(mode, detail) {
    const pill = document.getElementById("assist-live-pill");
    if (!pill) return;
    pill.classList.remove("is-demo", "is-live", "is-mixed");
    pill.setAttribute("data-mode", mode);
    if (mode === "live") {
      pill.textContent = detail || "LIVE · Gemini via /api/cartel/";
      pill.classList.add("is-live");
      pill.title = "Live chat: same-origin /api/cartel/ → VPS .NET robot → Gemini. Retries on 503.";
    } else if (mode === "mixed") {
      pill.textContent = detail || "API up · chat DEMO (no LLM key)";
      pill.classList.add("is-mixed");
      pill.title = "Robot health is ok but llmConfigured is false — keyword DEMO coaching only.";
    } else {
      pill.textContent = detail || "DEMO mode · keyword coaching";
      pill.classList.add("is-demo");
      pill.title = "Robot unreachable — canned DEMO replies only. Tools still work.";
    }
  }

  function submitPrompt(form, input, label) {
    input.value = label;
    input.focus();
    form.requestSubmit();
  }

  function mountTourBar(root, form, input) {
    let step = -1;
    const bar = document.createElement("div");
    bar.className = "mm-assist-tour";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "DEMO guided tour");
    bar.innerHTML =
      '<div class="mm-assist-tour__head">' +
      '<span class="mm-assist-tour__badge">DEMO tour</span>' +
      '<span class="mm-assist-tour__status" data-tour-status>Walkthrough · Event → payout → limits</span>' +
      "</div>" +
      '<div class="mm-assist-tour__steps" data-tour-steps></div>' +
      '<div class="mm-assist-tour__actions">' +
      '<button type="button" class="mm-assist-tour__btn" data-tour-start>Start</button>' +
      '<button type="button" class="mm-assist-tour__btn" data-tour-next disabled>Next</button>' +
      '<button type="button" class="mm-assist-tour__btn ghost" data-tour-reset>Reset</button>' +
      "</div>";

    const stepsEl = bar.querySelector("[data-tour-steps]");
    const statusEl = bar.querySelector("[data-tour-status]");
    const startBtn = bar.querySelector("[data-tour-start]");
    const nextBtn = bar.querySelector("[data-tour-next]");
    const resetBtn = bar.querySelector("[data-tour-reset]");

    TOUR_STEPS.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mm-assist-tour__step";
      b.textContent = s.chip;
      b.dataset.tourIndex = String(i);
      b.addEventListener("click", () => go(i));
      stepsEl.appendChild(b);
    });

    function paint() {
      stepsEl.querySelectorAll(".mm-assist-tour__step").forEach((el, i) => {
        el.classList.toggle("is-active", i === step);
        el.classList.toggle("is-done", i < step);
      });
      nextBtn.disabled = step < 0 || step >= TOUR_STEPS.length - 1;
      startBtn.textContent = step < 0 ? "Start" : "Replay step";
      if (step < 0) {
        statusEl.textContent = "Walkthrough · Event → payout → limits (DEMO)";
      } else {
        statusEl.textContent = TOUR_STEPS[step].tip;
      }
    }

    function go(i) {
      if (i < 0 || i >= TOUR_STEPS.length) return;
      step = i;
      paint();
      submitPrompt(form, input, TOUR_STEPS[i].prompt);
    }

    startBtn.addEventListener("click", () => {
      if (step < 0) go(0);
      else go(step);
    });
    nextBtn.addEventListener("click", () => {
      if (step < TOUR_STEPS.length - 1) go(step + 1);
    });
    resetBtn.addEventListener("click", () => {
      step = -1;
      paint();
    });

    paint();
    root.insertBefore(bar, form);
    return { go, reset: () => { step = -1; paint(); } };
  }

  /** Wrap MercatusCartelRobot.mountRobot with DEMO tour / chips / banner (no live API). */
  function enhanceWithDemo() {
    const R = global.MercatusCartelRobot;
    if (!R || R.__demoEnhanced) return;
    const origMount = R.mountRobot.bind(R);
    R.mountRobot = function (root, opts) {
      opts = opts || {};
      origMount(root, {
        title: opts.title || "Mercatus Assist",
        placeholder: opts.placeholder || "Ask about Event, payout, KYC…",
        greeting:
          opts.greeting ||
          "DEMO · Mercatus Assist ready (keyword coaching — robot not reachable right now). Tap ▶ Start DEMO tour, or chips for signup, rate lock, KYC, payout, and hard limits. LIVE Gemini resumes when /api/cartel/ health is ok.",
      });
      const form = root.querySelector(".mm-robot__form");
      const input = root.querySelector(".mm-robot__input");
      const msgs = root.querySelector(".mm-robot__messages");
      if (!form || !input || !msgs) return;

      const banner = document.createElement("div");
      banner.className = "mm-assist-demo-banner";
      banner.innerHTML =
        "<strong>DEMO</strong> · Keyword coaching only (robot unreachable). Guided tour chips stay DEMO-labelled. Live Gemini chat resumes when <span class=\"mono\">/api/cartel/</span> health is ok.";
      root.insertBefore(banner, msgs);

      const chips = document.createElement("div");
      chips.className = "mm-assist-chips";
      chips.setAttribute("aria-label", "Suggested DEMO prompts");
      STARTERS.forEach((label) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "mm-assist-chip";
        if (/tour/i.test(label)) b.classList.add("is-tour");
        b.textContent = label;
        b.addEventListener("click", () => {
          if (/start\s*demo\s*tour/i.test(label) && root._assistTour) {
            root._assistTour.go(0);
            return;
          }
          submitPrompt(form, input, label.replace(/^▶\s*/, ""));
        });
        chips.appendChild(b);
      });
      root.insertBefore(chips, form);

      root._assistTour = mountTourBar(root, form, input);

      setPill("demo", "DEMO mode");
    };
    R.__demoEnhanced = true;
    R.demoReply = demoReply;
  }

  /** Live UI chrome (chips/tour) on top of frontend/mercatus-cartel-robot.js */
  function enhanceWithLive(health) {
    const R = global.MercatusCartelRobot;
    if (!R || R.__liveEnhanced) return;
    const origMount = R.mountRobot.bind(R);
    const model = (health && health.llmModel) || "LLM";
    R.mountRobot = function (root, opts) {
      opts = opts || {};
      origMount(root, {
        title: opts.title || "Mercatus Assist",
        placeholder: opts.placeholder || "Ask about Event, payout, KYC…",
        greeting:
          opts.greeting ||
          "LIVE · Connected via /api/cartel/ → VPS → Gemini. Ask about Event, rate lock, KYC/POPIA, payout/Netza, or hard limits. Transient 503s auto-retry. Assist never invents balances.",
      });
      const form = root.querySelector(".mm-robot__form");
      const input = root.querySelector(".mm-robot__input");
      const msgs = root.querySelector(".mm-robot__messages");
      if (!form || !input || !msgs) return;

      const banner = document.createElement("div");
      banner.className = "mm-assist-demo-banner";
      banner.innerHTML =
        "<strong>LIVE</strong> · Chat hits the .NET robot on the DreamHost VPS through <span class=\"mono\">/api/cartel/</span>. Guided chips still work — replies come from the model, not DEMO keywords.";
      root.insertBefore(banner, msgs);

      const chips = document.createElement("div");
      chips.className = "mm-assist-chips";
      chips.setAttribute("aria-label", "Suggested prompts");
      STARTERS.forEach((label) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "mm-assist-chip";
        if (/tour/i.test(label)) b.classList.add("is-tour");
        b.textContent = label.replace("DEMO tour", "tour");
        b.addEventListener("click", () => {
          if (/start\s*(demo\s*)?tour/i.test(label) && root._assistTour) {
            root._assistTour.go(0);
            return;
          }
          submitPrompt(form, input, label.replace(/^▶\s*/, "").replace(/^Start\s+DEMO\s+tour$/i, "Start tour"));
        });
        chips.appendChild(b);
      });
      root.insertBefore(chips, form);

      root._assistTour = mountTourBar(root, form, input);

      const llmOk = !!(health && health.llmConfigured);
      if (llmOk) setPill("live", "LIVE · " + model + " · /api/cartel/");
      else setPill("mixed", "API up · DEMO chat (no LLM key)");

      // Soft-update page chrome if present
      const bannerSpan = document.querySelector(".cartel-banner span:not(#assist-live-pill)");
      if (bannerSpan && bannerSpan.querySelector(".cartel-accent")) {
        bannerSpan.innerHTML =
          'Mercatus Assist · Blueprint Robot · <strong class="cartel-accent">LIVE</strong> · /api/cartel/ → Gemini (503 retries on)';
      }
    };
    R.__liveEnhanced = true;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("Failed to load " + src)); };
      document.head.appendChild(s);
    });
  }

  /**
   * Probe same-origin proxy health, then mount live or DEMO.
   * opts.rootId default "robot"; opts.base optional script base path.
   */
  async function bootAssist(opts) {
    opts = opts || {};
    const root = document.getElementById(opts.rootId || "robot");
    if (!root) return { mode: "error", reason: "no_root" };
    let health = null;
    let live = false;
    try {
      const res = await fetch("/api/cartel/index.php?path=/health", { cache: "no-store" });
      health = await res.json();
      live = res.ok && health && health.status === "ok";
    } catch (e) {
      live = false;
    }
    try {
      if (live) {
        if (!global.MERCATUS_CARTEL_API) {
          await loadScript(opts.apiConfig || "frontend/api-config.js");
        }
        await loadScript(opts.liveRobot || "frontend/mercatus-cartel-robot.js?v=20261009ml");
        enhanceWithLive(health);
        MercatusCartelRobot.mountRobot(root);
        return { mode: "live", health: health };
      }
    } catch (e) {
      live = false;
    }
    await loadScript(opts.demoRobot || "mercatus-cartel-robot-demo.js");
    enhanceWithDemo();
    MercatusCartelRobot.mountRobot(root);
    setPill("demo", "DEMO · keyword coaching");
    var accent = document.querySelector(".cartel-banner .cartel-accent");
    if (accent) accent.textContent = "DEMO";
    return { mode: "demo", health: health };
  }

  global.MercatusAssistDemo = {
    enhanceWithDemo,
    enhanceWithLive,
    bootAssist,
    demoReply,
    STARTERS,
    TOUR_STEPS,
    setPill,
  };
})(window);
