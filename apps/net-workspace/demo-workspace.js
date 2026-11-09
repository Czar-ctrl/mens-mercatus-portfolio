/**
 * NET Gemini workspace — guided tour + static sample request/response panel (DEMO).
 * Shapes mirror apps/mercatus-assist/backend/Program.cs. No network calls are made;
 * reply text is illustrative. The model name is the value the live /health reported
 * on 5 Oct 2026 and may change.
 */
(function () {
  "use strict";
  var K = window.MMDemoKit;
  var SYS = "<Blueprint Robot system prompt — loaded server-side at boot>";
  var MODEL = "gemini-3.8-flash";

  var SAMPLES = {
    chat: {
      req: { method: "POST Blueprint API · chat",
        body: { message: "When does the rate get locked?", history: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hi — ask me about Event gates, rate lock, KYC or payout." }] } },
      upstream: { "POST {Llm:BaseUrl}chat/completions": { model: MODEL, temperature: 0.5,
        messages: [{ role: "system", content: SYS }, { role: "user", content: "Hi" }, { role: "assistant", content: "Hi — ask me about Event gates, rate lock, KYC or payout." }, { role: "user", content: "When does the rate get locked?" }] } },
      ok: { status: 200, body: { role: "assistant", content: "(illustrative) Before the worker accepts the shift. The locked rate must sit at or above the NMW floor shown on the Event screen — I won't suggest a payout figure." } },
      busy: { status: 502, body: { error: "upstream", status: 503, message: "Upstream LLM temporarily unavailable (Gemini/provider 503) after retries — high demand. Retry in a moment.", attempts: 4, detail: "(truncated provider body, ≤400 chars)" } }
    },
    assist: {
      req: { method: "POST Blueprint API · assist",
        body: { toolId: "jobs.events", intent: "explain", context: { screen: "rate-lock" }, message: "What does the 4-hour rule mean?" } },
      upstream: { "POST {Llm:BaseUrl}chat/completions": { model: MODEL, temperature: 0.4,
        messages: [{ role: "system", content: SYS }, { role: "user", content: "toolId: jobs.events\nintent: explain\ncontext: {\"screen\":\"rate-lock\"}\nmessage: What does the 4-hour rule mean?" }] } },
      ok: { status: 200, body: { suggestion: "(illustrative) Where employment applies and a worker is sent home early after call-in, pay covers at least four hours at the locked rate, subject to BCEA / sectoral rules.", draft: null, warnings: [], nextStep: null, raw: null } },
      busy: { status: 502, body: { suggestion: null, draft: null, warnings: ["Upstream LLM temporarily unavailable (503) after retries — high demand. Tools still work offline."], nextStep: "Retry later or continue without Assist.", raw: "(truncated provider body) | attempts=4" } }
    },
    health: {
      req: { method: "GET Blueprint API · /health", body: null },
      upstream: null,
      ok: { status: 200, body: { name: "Mercatus Blueprint Robot", status: "ok", version: "1.0.0.0", environment: "Production", llmConfigured: true, llmModel: MODEL, utc: "2026-10-05T17:19:33Z", endpoints: ["/health", "Blueprint assist route", "Blueprint chat route"] } },
      busy: { status: "—", body: { note: "If /health fails or times out, Assist mounts DEMO keyword coaching instead of LIVE chat." } }
    }
  };

  var walk;
  function j(o) { return JSON.stringify(o, null, 2); }
  function showPanel(id) {
    document.querySelectorAll(".tour-panel[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== id; });
    var sample = document.getElementById("nw-sample");
    if (sample) sample.hidden = id !== "call";
  }
  function runSample() {
    var ep = document.getElementById("nw-endpoint").value;
    var sc = document.getElementById("nw-scenario").value;
    var S = SAMPLES[ep];
    var req = S.req.method + (S.req.body ? "\nContent-Type: application/json\n\n" + j(S.req.body) : "");
    if (S.upstream) req += "\n\n# robot → LLM (server-side, key from env)\n" + j(S.upstream);
    var r = S[sc] || S.ok;
    document.getElementById("nw-req").textContent = req;
    document.getElementById("nw-res").textContent = "HTTP " + r.status + "\n\n" + j(r.body);
    document.getElementById("nw-sample-note").textContent = sc === "busy"
      ? "DEMO sample · the robot already retried up to 4× with backoff before returning this; the Assist client shows a friendly busy message."
      : "DEMO sample · shapes match the robot source; reply text is illustrative. For a real reply, use Assist.";
    if (walk) walk.done("call");
  }
  function init() {
    if (!K) return;
    K.mountStatus(document.getElementById("nw-status"), { mode: "demo", label: "DEMO · static explainer", title: "No live API calls from this page" });
    walk = K.mountWalkthrough(document.getElementById("nw-walk"), {
      id: "net-workspace",
      title: "NET workspace · guided tour",
      intro: "Four stops: architecture → Gemini call shape → Assist bridge → deploy note. Tap Start.",
      steps: [
        { id: "arch", label: "Architecture", hint: "Static site + .NET robot on the VPS; three endpoints." },
        { id: "call", label: "Gemini call shape", hint: "Pick an endpoint + scenario and press Show sample to see request/response JSON." },
        { id: "bridge", label: "Assist bridge", hint: "How HTTPS Assist reaches the robot, and when it falls back to DEMO." },
        { id: "deploy", label: "Deploy note", hint: "Where each piece runs and how rollback works." }
      ],
      onStep: function (s) {
        showPanel(s.id);
        if (s.id !== "call") walk.done(s.id);
        else runSample();
      },
      completeText: "Tour complete. See it running: open Mercatus Assist and ask about rate lock."
    });
    document.getElementById("nw-run").addEventListener("click", runSample);
    document.getElementById("nw-endpoint").addEventListener("change", runSample);
    document.getElementById("nw-scenario").addEventListener("change", runSample);
    showPanel("arch");
    // Pre-fill so the panel is never empty when opened.
    var ep = SAMPLES.chat;
    document.getElementById("nw-req").textContent = ep.req.method + "\n\n" + j(ep.req.body);
    document.getElementById("nw-res").textContent = "Press Show sample.";
  }
  window.NetWorkspaceDemo = { SAMPLES: SAMPLES };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
