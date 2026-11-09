/**
 * Mercatus Blueprint Robot — portfolio DEMO UI only.
 * No fetch/XHR to :5080 or /api/mercatus-cartel/*. Live robot stays under
 * /workspace/mercatus-cartel/robot/ and is not wired to this front end.
 */
(function (global) {
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
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
    card.appendChild(el("p", null, "Demo mode — Blueprint policy coaching you can try now. Full live chat when Assist is hosted on a VPS."));
    card.appendChild(el("p", null, "What it will not do: invent balances or skip KYC."));
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
    header.appendChild(el("span", "mm-robot__title", opts.title || "Mercatus Assist"));
    const msgs = el("div", "mm-robot__messages");
    const form = el("form", "mm-robot__form");
    const input = el("input", "mm-robot__input");
    input.type = "text";
    input.placeholder = opts.placeholder || "Ask about Event, payout, KYC…";
    input.autocomplete = "off";
    const send = el("button", "mm-robot__send", "Send");
    send.type = "submit";
    form.appendChild(input);
    form.appendChild(send);
    root.append(header, msgs, form);

    function add(role, text) {
      msgs.appendChild(
        el("div", `mm-robot__msg mm-robot__msg--${role === "user" ? "user" : "bot"}`, text)
      );
      msgs.scrollTop = msgs.scrollHeight;
    }

    add(
      "bot",
      opts.greeting ||
        "DEMO · Mercatus Assist ready. Keyword Blueprint coaching — demo mode by design. Full chat when Assist is hosted on VPS."
    );

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const message = input.value.trim();
      if (!message) return;
      input.value = "";
      add("user", message);
      send.disabled = true;
      const demo = global.MercatusAssistDemo;
      const reply =
        demo && typeof demo.demoReply === "function"
          ? demo.demoReply(message)
          : "DEMO · Assist coaching unavailable in this shell.";
      add("bot", reply);
      send.disabled = false;
      input.focus();
    });
  }

  /** Per-tool assist: DEMO only — never hits network */
  async function assist(toolId, intent, context, message) {
    const demo = global.MercatusAssistDemo;
    const text =
      demo && typeof demo.demoReply === "function"
        ? demo.demoReply(message || intent || toolId)
        : "DEMO · demo coaching unavailable";
    return {
      suggestion: text,
      draft: null,
      warnings: ["DEMO mode — full chat when Assist is hosted on VPS."],
      nextStep: null,
    };
  }

  global.MercatusCartelRobot = { mountWelcome, mountRobot, assist };
})(window);
