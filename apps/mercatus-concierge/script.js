/* Mercatus Concierge — Journey shell
   Gateway into standalone Concierge app/ + status chips + progress rail.
   Status: same-origin data/status.json (and live fetch when CORS allows).
   Never fake green. */
(function () {
  var ASSIST_URL = "app/";

  /* —— Assist expand / overlay (preserved) —— */
  var collapsed = document.getElementById("assist-collapsed");
  var panel = document.getElementById("assist-panel");
  var form = document.getElementById("assist-form");
  var input = document.getElementById("assist-input");
  var collapseBtn = document.getElementById("assist-collapse");
  var overlay = document.getElementById("assist-overlay");
  var overlayClose = document.getElementById("overlay-close");
  var overlayLaunch = document.getElementById("overlay-launch");
  var overlayGo = document.getElementById("overlay-go");
  var assistTalk = document.getElementById("assist-talk");

  function expand() {
    if (!collapsed || !panel) return;
    collapsed.hidden = true;
    panel.hidden = false;
    if (input) input.focus();
  }

  function collapse() {
    if (!collapsed || !panel) return;
    panel.hidden = true;
    collapsed.hidden = false;
  }

  function openOverlay(query) {
    if (!overlay) {
      window.location.href = ASSIST_URL;
      return;
    }
    overlay.hidden = false;
    requestAnimationFrame(function () {
      overlay.classList.add("open");
    });
    var url = ASSIST_URL;
    if (query && String(query).trim()) {
      url += (ASSIST_URL.indexOf("?") >= 0 ? "&" : "?") + "q=" + encodeURIComponent(String(query).trim());
    }
    if (overlayLaunch) overlayLaunch.href = url;
    if (overlayGo) overlayGo.href = url;
  }

  function closeOverlay() {
    if (!overlay) return;
    overlay.classList.remove("open");
    setTimeout(function () {
      overlay.hidden = true;
    }, 280);
  }

  function goAssist(query) {
    var url = ASSIST_URL;
    if (query && String(query).trim()) {
      url += (ASSIST_URL.indexOf("?") >= 0 ? "&" : "?") + "q=" + encodeURIComponent(String(query).trim());
    }
    window.location.href = url;
  }

  if (collapsed) {
    collapsed.addEventListener("click", expand);
    collapsed.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        expand();
      }
    });
  }
  if (assistTalk) assistTalk.addEventListener("click", expand);
  if (collapseBtn) collapseBtn.addEventListener("click", collapse);

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      openOverlay(input ? input.value : "");
    });
  }

  var openFull = document.getElementById("assist-open-full");
  if (openFull) {
    openFull.addEventListener("click", function (e) {
      e.preventDefault();
      openOverlay("");
    });
  }

  if (overlayClose) overlayClose.addEventListener("click", closeOverlay);
  if (overlayLaunch) {
    overlayLaunch.addEventListener("click", function (e) {
      e.preventDefault();
      goAssist(input && input.value);
    });
  }
  if (overlayGo) {
    overlayGo.addEventListener("click", function (e) {
      e.preventDefault();
      goAssist(input && input.value);
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay && overlay.classList.contains("open")) {
      closeOverlay();
    }
  });

  /* —— Status chips —— */
  function setChip(el, state, label) {
    if (!el) return;
    el.classList.remove(
      "status-chip--up",
      "status-chip--down",
      "status-chip--demo",
      "status-chip--local",
      "status-chip--checking",
      "status-chip--unknown"
    );
    el.classList.add("status-chip--" + state);
    var lab = el.querySelector(".chip-label");
    if (lab) lab.textContent = label;
  }

  function applyStatus(data) {
    var probes = (data && data.probes) || {};
    var map = [
      ["assist", probes.assist],
      ["think", probes.think],
      ["blueprints", probes.blueprints]
    ];
    map.forEach(function (pair) {
      var key = pair[0];
      var p = pair[1];
      var el = document.querySelector('.status-chip[data-status="' + key + '"]');
      if (!el || el.getAttribute("data-kind") !== "probe") return;
      if (!p) {
        setChip(el, "unknown", "Open live");
        return;
      }
      if (p.up) {
        setChip(el, "up", p.detail ? "Up · " + p.detail : "Up");
      } else {
        setChip(el, "down", "Down");
      }
    });

    var drop = (data && data.dropnet) || {};
    var counts = drop.counts;
    var careersChip = document.querySelector('.status-chip[data-status="careers"]');
    var careersStat = document.getElementById("careers-stat");
    if (counts && typeof counts.total === "number") {
      if (careersChip) {
        setChip(
          careersChip,
          "demo",
          counts.total + " leads · " + (counts.top_matches || 0) + " top"
        );
      }
      if (careersStat) {
        careersStat.hidden = false;
        var boards = (drop.boards || []).join(" + ") || "boards";
        var when = drop.generated_at ? " · digest " + drop.generated_at : "";
        careersStat.textContent =
          "Latest digest: " +
          counts.total +
          " roles (" +
          (counts.top_matches || 0) +
          " top matches, " +
          (counts.also_worth_a_look || 0) +
          " also worth a look) · " +
          boards +
          when;
      }
    } else if (careersChip) {
      setChip(careersChip, "demo", "Open live");
    }

    /* static kinds already set in HTML */
    document.querySelectorAll('.status-chip[data-kind="local"]').forEach(function (el) {
      setChip(el, "local", "Local");
    });
    document.querySelectorAll('.status-chip[data-kind="demo"]').forEach(function (el) {
      if (el.getAttribute("data-status") === "careers" && counts) return;
      var cur = el.querySelector(".chip-label");
      var text = cur ? cur.textContent : "Demo";
      if (text === "Checking…" || text === "Digest…") text = el.getAttribute("data-status") === "close" ? "Leave-behind" : "Demo";
      setChip(el, "demo", text);
    });
  }

  function loadStatus() {
    document.querySelectorAll('.status-chip[data-kind="probe"]').forEach(function (el) {
      setChip(el, "checking", "Checking…");
    });

    /* Prefer same-origin cache (works on :8777); then try live health if CORS allows */
    fetch("data/status.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("status cache missing");
        return r.json();
      })
      .then(function (data) {
        applyStatus(data);
        tryLiveEnrich(data);
      })
      .catch(function () {
        applyStatus({ probes: {}, dropnet: {} });
        tryLiveEnrich({ probes: {}, dropnet: {} });
        /* still try dropnet snapshot alone */
        fetch("data/dropnet-latest.json", { cache: "no-store" })
          .then(function (r) {
            return r.ok ? r.json() : null;
          })
          .then(function (drop) {
            if (drop) applyStatus({ probes: {}, dropnet: drop });
          })
          .catch(function () {});
      });
  }

  function tryLiveEnrich(base) {
    /* Only from origins allowed by API CORS (e.g. mensmercatus.online). Failures stay silent. */
    var probes = Object.assign({}, base.probes || {});
    var jobs = [];

    jobs.push(
      fetch("https://api.mensmercatus.online/health", { mode: "cors", cache: "no-store" })
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (j) {
          if (!j) return;
          probes.blueprints = {
            label: "Mens Mercatus Blueprint robot",
            up: j.status === "ok",
            detail: [j.environment, j.llmModel].filter(Boolean).join(" · ")
          };
          probes.assist = {
            label: "Mercatus Assist",
            up: j.status === "ok",
            detail: "via Blueprints robot"
          };
        })
        .catch(function () {})
    );

    jobs.push(
      fetch("https://api.mensmercatus.online/think/api/health", { mode: "cors", cache: "no-store" })
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (j) {
          if (!j) return;
          probes.think = {
            label: "THINK proxy",
            up: !!j.ok,
            detail: (j.models && j.models.chat) || null
          };
        })
        .catch(function () {})
    );

    Promise.all(jobs).then(function () {
      applyStatus({
        probes: probes,
        dropnet: base.dropnet || {}
      });
    });
  }

  loadStatus();

  /* —— Journey progress rail —— */
  var chapters = Array.prototype.slice.call(document.querySelectorAll(".journey-chapter[id]"));
  var railLinks = Array.prototype.slice.call(document.querySelectorAll(".journey-rail a"));

  function syncRail() {
    if (!chapters.length) return;
    var mid = window.scrollY + window.innerHeight * 0.35;
    var active = chapters[0];
    for (var i = 0; i < chapters.length; i++) {
      if (chapters[i].offsetTop <= mid) active = chapters[i];
    }
    var id = active && active.id;
    railLinks.forEach(function (a) {
      a.classList.toggle("is-active", a.getAttribute("data-step") === id);
    });
  }

  syncRail();
  window.addEventListener("scroll", syncRail, { passive: true });
  window.addEventListener("resize", syncRail, { passive: true });

  /* —— One-shot: scrolling into section 02 (#assist) opens Concierge app —— */
  var assistChapter = document.getElementById("assist");
  var openedConcierge = false;
  function openConciergeApp() {
    if (openedConcierge) return;
    openedConcierge = true;
    try { sessionStorage.setItem("mercatus-concierge-opened", "1"); } catch (e) {}
    window.location.href = "app/";
  }
  try {
    if (sessionStorage.getItem("mercatus-concierge-opened") === "1") {
      openedConcierge = true;
    }
  } catch (e) {}
  if (assistChapter && "IntersectionObserver" in window && !openedConcierge) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
            io.disconnect();
            openConciergeApp();
          }
        });
      },
      { threshold: [0.35] }
    );
    io.observe(assistChapter);
  }
})();
