/**
 * Mercatus Cartel Robot — minimal front-end client
 * API_BASE = your ASP.NET host, e.g. http://localhost:5080
 */
(function (global) {
  const API_BASE = global.MERCATUS_CARTEL_API || "http://localhost:5080";

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /**
   * Optional first-open gate. Pass { skipWelcome: true } to mount immediately
   * (portfolio Assist page). Event / raw shell can keep the welcome overlay.
   * After first dismiss, sessionStorage mm_welcome_seen skips on later opens.
   */
  function mountWelcome(onDone, opts) {
    opts = opts || {};
    if (opts.skipWelcome || sessionStorage.getItem("mm_welcome_seen")) {
      return onDone();
    }
    const overlay = el("div", "mm-welcome");
    const card = el("div", "mm-welcome__card");
    const brand = el("div", "mm-welcome__brand");
    brand.appendChild(el("span", "mm-robot__mark"));
    brand.appendChild(document.createTextNode("Mercatus Cartel"));
    card.appendChild(brand);
    card.appendChild(el("h2", null, "Before you explore"));
    card.appendChild(el("p", null, "What AI can do here: clarify diagrams, draft copy, and coach each tool with one quiet Assist line."));
    card.appendChild(el("p", null, "What it should do: help judgment — never invent balances or skip KYC."));
    card.appendChild(el("p", null, "What it will do next: after you dismiss this, explore the schematics; Assist stays available per tool."));
    const btn = el("button", null, "Continue");
    btn.onclick = () => {
      sessionStorage.setItem("mm_welcome_seen", "1");
      overlay.remove();
      onDone();
    };
    card.appendChild(btn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  function mountRobot(root, opts) {
    opts = opts || {};
    root.classList.add("mm-robot");
    root.innerHTML = "";
    const header = el("div", "mm-robot__header");
    header.appendChild(el("span", "mm-robot__mark", null));
    const title = el("span", "mm-robot__title", opts.title || "Mercatus Cartel Robot");
    header.appendChild(title);
    const msgs = el("div", "mm-robot__messages");
    const form = el("form", "mm-robot__form");
    const input = el("input", "mm-robot__input");
    input.type = "text";
    input.placeholder = opts.placeholder || "Ask Mercatus Cartel…";
    input.autocomplete = "off";
    const send = el("button", "mm-robot__send", "Send");
    send.type = "submit";
    form.appendChild(input);
    form.appendChild(send);
    root.append(header, msgs, form);

    const history = [];

    function add(role, text) {
      msgs.appendChild(el("div", `mm-robot__msg mm-robot__msg--${role === "user" ? "user" : "bot"}`, text));
      msgs.scrollTop = msgs.scrollHeight;
    }

    add(
      "bot",
      opts.greeting ||
        "Mercatus Cartel online. Ask about a tool, a diagram node, or what to do next."
    );

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const message = input.value.trim();
      if (!message) return;
      input.value = "";
      add("user", message);
      history.push({ role: "user", content: message });
      send.disabled = true;
      try {
        const res = await fetch(`${API_BASE}/api/mercatus-cartel/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, history }),
        });
        let data = {};
        try { data = await res.json(); } catch { /* non-JSON */ }
        if (!res.ok) {
          let msg =
            data.message ||
            data.error ||
            (res.status === 503
              ? "Robot offline (503). Retry later — Assist falls back to DEMO coaching when health fails."
              : `Assist error HTTP ${res.status}. Tools still work offline.`);
          if (res.status === 502 || (data.error === "upstream" && /503|UNAVAILABLE|high demand/i.test(JSON.stringify(data)))) {
            msg =
              "LIVE path reached the VPS, but the upstream LLM is temporarily unavailable (high demand). Retry in a moment — Event tools still work offline.";
          }
          add("bot", msg);
        } else {
          const reply = data.content || data.suggestion || "Assist unavailable.";
          add("bot", reply);
          history.push({ role: "assistant", content: reply });
        }
      } catch {
        add(
          "bot",
          "Cannot reach Assist API (" +
            API_BASE +
            "). Check the host is up, HTTPS/CORS, or use DEMO mode. The rest of the app still works."
        );
      } finally {
        send.disabled = false;
        input.focus();
      }
    });
  }

  /** Per-tool assist: returns suggestion string */
  async function assist(toolId, intent, context, message) {
    try {
      const res = await fetch(`${API_BASE}/api/mercatus-cartel/assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId, intent, context, message }),
      });
      let data = {};
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) {
        return {
          suggestion: null,
          draft: null,
          warnings: [
            (data.warnings && data.warnings[0]) ||
              data.message ||
              `Assist HTTP ${res.status} — tool still works offline.`,
          ],
          nextStep: data.nextStep || null,
          raw: data.raw || null,
        };
      }
      return data;
    } catch (e) {
      return {
        suggestion: null,
        draft: null,
        warnings: [
          "Cannot reach Assist API at " +
            API_BASE +
            ". Tool still works offline.",
        ],
        nextStep: null,
        raw: String(e && e.message ? e.message : e),
      };
    }
  }

  global.MercatusCartelRobot = { mountWelcome, mountRobot, assist };
})(window);
