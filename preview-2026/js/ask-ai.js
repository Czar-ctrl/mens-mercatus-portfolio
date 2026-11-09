/**
 * Ask Katlego's AI — homepage chat widget → THINK proxy.
 * POST https://api.mensmercatus.online/think/api/chat
 * Honest copy: Gemini model via THINK, not AGI.
 */
(function () {
  var API = "https://api.mensmercatus.online/think/api/chat";
  var SYSTEM =
    "You are the portfolio assistant for Katlego Mokoto (Mens Mercatus). " +
    "Speak as a concise, professional guide to his work. He builds agentic workflows and full-stack .NET/C# systems with human approval gates. " +
    "Flagship systems: JobNet (draft-only career pipeline), Mercatus Assist / THINK (Gemini multimodal), Forex Mercatus Codex (paper research desk), SoundX (browser DAW). " +
    "Location: South Africa (Johannesburg / Pretoria / Cape Town / Durban or remote). " +
    "Never claim AGI or that you are Katlego himself. Never invent employers, salaries, or unpublished clients. " +
    "Keep answers under 120 words unless asked for detail. Prefer concrete systems and links on mensmercatus.online.";

  var root = document.getElementById("gz-ask");
  if (!root) return;

  var toggle = root.querySelector("[data-ask-toggle]");
  var closeBtn = root.querySelector("[data-ask-close]");
  var form = root.querySelector("[data-ask-form]");
  var input = root.querySelector("[data-ask-input]");
  var log = root.querySelector("[data-ask-log]");
  var status = root.querySelector("[data-ask-status]");
  var chips = root.querySelectorAll("[data-ask-chip]");
  var history = [];
  var busy = false;

  function setStatus(text, ok) {
    if (!status) return;
    status.textContent = text;
    status.dataset.state = ok ? "ok" : "warn";
  }

  function addMsg(role, text, cls) {
    var div = document.createElement("div");
    div.className = "gz-ask-msg " + (cls || role);
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  function open() {
    root.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    if (input) setTimeout(function () { input.focus(); }, 50);
  }
  function close() {
    root.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  }

  if (toggle) toggle.addEventListener("click", function () {
    if (root.classList.contains("is-open")) close(); else open();
  });
  if (closeBtn) closeBtn.addEventListener("click", close);

  chips.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var q = btn.getAttribute("data-ask-chip") || btn.textContent;
      open();
      send(q);
    });
  });

  async function send(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    busy = true;
    addMsg("user", text);
    if (input) input.value = "";
    setStatus("Thinking…", true);
    var thinking = addMsg("bot", "…", "bot");

    try {
      var res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: history.slice(-8),
          systemInstruction: SYSTEM
        })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.ok) {
        var err = (data && (data.message || data.error)) || ("HTTP " + res.status);
        thinking.className = "gz-ask-msg err";
        thinking.textContent = "Couldn’t reach THINK right now (" + err + "). Try again, or open /think/ on the live site.";
        setStatus("Offline / error", false);
      } else {
        var reply = (data.text || "").trim() || "(empty reply)";
        thinking.textContent = reply;
        history.push({ role: "user", content: text });
        history.push({ role: "model", content: reply });
        setStatus((data.model || "Gemini") + " · THINK", true);
      }
    } catch (e) {
      thinking.className = "gz-ask-msg err";
      thinking.textContent = "Network error talking to api.mensmercatus.online. Check your connection and try again.";
      setStatus("Network error", false);
    }
    busy = false;
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      send(input && input.value);
    });
  }

  /* Health ping once */
  fetch("https://api.mensmercatus.online/think/api/health", { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d && d.ok) setStatus(((d.models && d.models.chat) || "Gemini") + " · ready", true);
      else setStatus("THINK degraded", false);
    })
    .catch(function () { setStatus("THINK unreachable", false); });
})();
