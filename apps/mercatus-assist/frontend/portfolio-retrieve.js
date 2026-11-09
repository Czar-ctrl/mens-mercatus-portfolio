/**
 * Local retrieval over the four case studies.
 * Token cosine against short passages. The reply names the passage it used.
 */
(function (global) {
  var PASSAGES = [
    {
      id: "JobNet",
      text: "JobNet scrapes public listings, ranks them with a hashed sentence embedding against this portfolio, drops duplicate companies, and sends a letter only when the posting prints an employer address.",
    },
    {
      id: "Mercatus Assist",
      text: "Mercatus Assist is an ASP.NET Core 8 service. It calls Gemini from the server, retries on 429 and 5xx, and keeps the API key off the browser. Answers about the portfolio name the retrieved case study.",
    },
    {
      id: "THINK",
      text: "THINK is a React 19 and TypeScript workspace with a server-side proxy and a live-voice WebSocket relay.",
    },
    {
      id: "Forex Mercatus Codex",
      text: "Forex Mercatus Codex is a Python research desk with charts and a paper-only session. It does not place trades and it does not predict price.",
    },
    {
      id: "SoundX",
      text: "SoundX is a browser studio. Web Audio stays on the machine. Onset detection reads the local buffer and proposes a tempo. The person applies the change.",
    },
  ];

  function tokens(text) {
    return String(text || "")
      .toLowerCase()
      .match(/[a-z0-9+#.]{2,}/g) || [];
  }

  function vec(text) {
    var counts = {};
    tokens(text).forEach(function (token) {
      counts[token] = (counts[token] || 0) + 1;
    });
    return counts;
  }

  function cosine(left, right) {
    var dot = 0;
    var leftNorm = 0;
    var rightNorm = 0;
    Object.keys(left).forEach(function (key) {
      leftNorm += left[key] * left[key];
      if (right[key]) dot += left[key] * right[key];
    });
    Object.keys(right).forEach(function (key) {
      rightNorm += right[key] * right[key];
    });
    if (!leftNorm || !rightNorm) return 0;
    return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
  }

  var stored = PASSAGES.map(function (passage) {
    return { passage: passage, vector: vec(passage.text) };
  });

  function retrieve(query) {
    var queryVec = vec(query);
    var hits = stored
      .map(function (row) {
        return { id: row.passage.id, text: row.passage.text, score: cosine(queryVec, row.vector) };
      })
      .filter(function (hit) {
        return hit.score >= 0.08;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .slice(0, 3);
    return { hits: hits };
  }

  function prompt(query) {
    var found = retrieve(query);
    if (!found.hits.length) return query;
    var block = found.hits
      .map(function (hit) {
        return "Passage " + hit.id + ": " + hit.text;
      })
      .join("\n");
    return (
      "Answer from these portfolio passages and name the passage you used. Do not invent a degree, a metric, or a job offer.\n" +
      block +
      "\n\nQuestion: " +
      query
    );
  }

  global.PortfolioRetrieve = { retrieve: retrieve, prompt: prompt, passages: PASSAGES };
})(typeof window !== "undefined" ? window : globalThis);
