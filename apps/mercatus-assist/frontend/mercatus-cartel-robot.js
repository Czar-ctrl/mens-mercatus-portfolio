/**
 * Mercatus Blueprint Robot — front-end client (hardened retries for Gemini 503)
 * API_BASE = same-origin PHP proxy or https://api.mensmercatus.online
 */
(function (global) {
  const API_BASE = global.MERCATUS_CARTEL_API || "http://localhost:5080";

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function isRetryable(status, data) {
    if (status === 429 || status === 502 || status === 503 || status === 504) return true;
    try {
      var blob = JSON.stringify(data || {});
      return /503|UNAVAILABLE|high demand|Resource exhausted|rate.?limit/i.test(blob);
    } catch (e) {
      return false;
    }
  }

  /**
   * POST JSON with exponential backoff on Gemini/upstream 503/429.
   * Attempts: 1 immediate + up to 3 retries (≈0.7s, 1.4s, 2.8s).
   */
  async function postJson(url, body, opts) {
    opts = opts || {};
    var maxAttempts = opts.maxAttempts || 4;
    var onRetry = opts.onRetry || function () {};
    var last = { ok: false, status: 0, data: {}, error: null };
    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        var res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        var data = {};
        try { data = await res.json(); } catch (e) { data = {}; }
        last = { ok: res.ok, status: res.status, data: data, error: null, attempts: attempt };
        if (res.ok) return last;
        if (!isRetryable(res.status, data) || attempt === maxAttempts) return last;
        onRetry(attempt, res.status, data);
        await sleep(Math.round(700 * Math.pow(2, attempt - 1) + Math.random() * 200));
      } catch (e) {
        last = { ok: false, status: 0, data: {}, error: e, attempts: attempt };
        if (attempt === maxAttempts) return last;
        onRetry(attempt, 0, { error: String(e && e.message ? e.message : e) });
        await sleep(Math.round(700 * Math.pow(2, attempt - 1)));
      }
    }
    return last;
  }

  function mountWelcome(onDone, opts) {
    opts = opts || {};
    if (opts.skipWelcome || sessionStorage.getItem("mm_welcome_seen")) {
      return onDone();
    }
    const overlay = el("div", "mm-welcome");
    const card = el("div", "mm-welcome__card");
    const brand = el("div", "mm-welcome__brand");
    brand.appendChild(el("span", "mm-robot__mark"));
    brand.appendChild(document.createTextNode("Mercatus Blueprint"));
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
    const title = el("span", "mm-robot__title", opts.title || "Mercatus Blueprint Robot");
    header.appendChild(title);
    const msgs = el("div", "mm-robot__messages");
    const form = el("form", "mm-robot__form");
    const input = el("input", "mm-robot__input");
    input.type = "text";
    input.placeholder = opts.placeholder || "Ask Mercatus Blueprint…";
    input.autocomplete = "off";
    const send = el("button", "mm-robot__send", "Send");
    send.type = "submit";
    form.appendChild(input);
    form.appendChild(send);
    root.append(header, msgs, form);

    const history = [];

    /** When LIVE fails, also show the canned DEMO coaching (clearly labelled) so chat never dead-ends. */
    function demoFallback(message) {
      var D = global.MercatusAssistDemo;
      if (!D || typeof D.demoReply !== "function") return;
      add("bot", "DEMO fallback (not the live model) · " + D.demoReply(message).replace(/^DEMO\s*·\s*/, ""));
    }

    function add(role, text) {
      msgs.appendChild(el("div", `mm-robot__msg mm-robot__msg--${role === "user" ? "user" : "bot"}`, text));
      msgs.scrollTop = msgs.scrollHeight;
    }

    add(
      "bot",
      opts.greeting ||
        "Mercatus Blueprint online. Ask about a tool, a diagram node, or what to do next."
    );

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const message = input.value.trim();
      if (!message) return;
      input.value = "";
      add("user", message);
      history.push({ role: "user", content: message });
      var retrieved = global.PortfolioRetrieve && global.PortfolioRetrieve.retrieve(message);
      var outbound = message;
      if (retrieved && retrieved.hits && retrieved.hits.length) {
        var cite = retrieved.hits
          .map(function (hit) {
            return hit.id + " (" + hit.score.toFixed(2) + ")";
          })
          .join(", ");
        add("bot", "Retrieved " + cite);
        outbound = global.PortfolioRetrieve.prompt(message);
      }
      send.disabled = true;
      var waitEl = el("div", "mm-robot__msg mm-robot__msg--bot mm-robot__msg--wait", "LIVE · thinking…");
      waitEl.setAttribute("aria-live", "polite");
      msgs.appendChild(waitEl);
      msgs.scrollTop = msgs.scrollHeight;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        waitEl.remove();
        add("bot", "You appear to be offline. Reconnect and try again — Event tools still work offline.");
        demoFallback(message);
        send.disabled = false;
        return;
      }
      try {
        var result = await postJson(
          `${API_BASE}/api/mercatus-cartel/chat`,
          { message: outbound, history },
          {
            onRetry: function (attempt) {
              waitEl.textContent =
                "LIVE · upstream busy (Gemini high demand) — retry " +
                attempt +
                "/3… Event tools still work offline.";
              msgs.scrollTop = msgs.scrollHeight;
            },
          }
        );
        if (waitEl) waitEl.remove();
        if (!result.ok) {
          var data = result.data || {};
          var msg =
            data.message ||
            data.error ||
            (result.status === 503
              ? "Robot offline (503). Retry later — Assist falls back to DEMO coaching when health fails."
              : result.status
                ? "Assist error HTTP " + result.status + ". Tools still work offline."
                : "Cannot reach Assist API. Check the host is up, HTTPS/CORS, or use DEMO mode.");
          if (
            result.status === 502 ||
            (data.error === "upstream" &&
              /503|UNAVAILABLE|high demand/i.test(JSON.stringify(data)))
          ) {
            msg =
              "LIVE path reached the VPS, but the upstream LLM stayed unavailable after retries (high demand). Try again in a moment — Event tools still work offline.";
          }
          if (result.attempts && result.attempts > 1) {
            msg += " (tried " + result.attempts + "×)";
          }
          add("bot", msg);
          demoFallback(message);
        } else {
          var reply =
            (result.data && (result.data.content || result.data.suggestion)) ||
            "Assist unavailable.";
          var modelUsed = result.data && result.data.model;
          if (modelUsed) {
            add("bot", reply + "\n\n— answered by " + modelUsed);
          } else {
            add("bot", reply);
          }
          history.push({ role: "assistant", content: reply });
        }
      } catch (err) {
        if (waitEl) waitEl.remove();
        add(
          "bot",
          "Cannot reach Assist API (" +
            API_BASE +
            "). Check the host is up, HTTPS/CORS, or use DEMO mode. The rest of the app still works."
        );
        demoFallback(message);
      } finally {
        send.disabled = false;
        input.focus();
      }
    });
  }

  async function assist(toolId, intent, context, message) {
    try {
      var result = await postJson(`${API_BASE}/api/mercatus-cartel/assist`, {
        toolId: toolId,
        intent: intent,
        context: context,
        message: message,
      });
      var data = result.data || {};
      if (!result.ok) {
        return {
          suggestion: null,
          draft: null,
          warnings: [
            (data.warnings && data.warnings[0]) ||
              data.message ||
              "Assist HTTP " + result.status + " — tool still works offline.",
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

  global.MercatusCartelRobot = { mountWelcome, mountRobot, assist, postJson };
})(window);
