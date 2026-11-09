#!/usr/bin/env node
/**
 * Tiny ClickUp CORS proxy for local Concierge desks.
 * Reads CLICKUP_API_TOKEN (+ optional CLICKUP_TEAM_ID) from env / .env.local.
 * Never expose this port publicly without auth — token is injected server-side.
 *
 *   node proxy-server.js
 *   # → http://127.0.0.1:8788
 */
"use strict";

var http = require("http");
var https = require("https");
var fs = require("fs");
var path = require("path");
var url = require("url");

var PORT = Number(process.env.CLICKUP_PROXY_PORT || 8788);
var HOST = process.env.CLICKUP_PROXY_HOST || "127.0.0.1";
var UPSTREAM = "api.clickup.com";

var ALLOWED = [
  "http://127.0.0.1:8777",
  "http://localhost:8777",
  "http://127.0.0.1:8766",
  "http://localhost:8766",
  "https://mensmercatus.online",
  "https://www.mensmercatus.online"
];

function loadEnvLocal() {
  var candidates = [
    path.join(__dirname, "..", ".env.local"),
    path.join(__dirname, ".env.local"),
    path.join(process.cwd(), ".env.local")
  ];
  candidates.forEach(function (p) {
    try {
      if (!fs.existsSync(p)) return;
      fs.readFileSync(p, "utf8").split(/\r?\n/).forEach(function (line) {
        var m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!m) return;
        var k = m[1];
        var v = m[2].replace(/^["']|["']$/g, "");
        if (!process.env[k]) process.env[k] = v;
      });
      console.log("[clickup-proxy] loaded", p);
    } catch (_) { /* ignore */ }
  });
}

loadEnvLocal();

var TOKEN = process.env.CLICKUP_API_TOKEN || "";
var TEAM_ID = process.env.CLICKUP_TEAM_ID || "";

function cors(req, res) {
  var origin = req.headers.origin || "";
  if (ALLOWED.indexOf(origin) >= 0) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function sendJson(res, code, obj) {
  var body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function proxy(req, res, apiPath) {
  if (!TOKEN) {
    sendJson(res, 503, {
      err: "CLICKUP_API_TOKEN not set",
      hint: "export CLICKUP_API_TOKEN=pk_… or put it in .env.local"
    });
    return;
  }

  var opts = {
    hostname: UPSTREAM,
    port: 443,
    path: apiPath,
    method: req.method,
    headers: {
      Authorization: TOKEN,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Mercatus-Concierge-ClickUp-Proxy/1.0"
    }
  };

  var chunks = [];
  req.on("data", function (c) { chunks.push(c); });
  req.on("end", function () {
    var body = Buffer.concat(chunks);
    if (body.length) opts.headers["Content-Length"] = body.length;

    var up = https.request(opts, function (upRes) {
      var buf = [];
      upRes.on("data", function (c) { buf.push(c); });
      upRes.on("end", function () {
        var out = Buffer.concat(buf);
        cors(req, res);
        res.writeHead(upRes.statusCode || 502, {
          "Content-Type": upRes.headers["content-type"] || "application/json"
        });
        res.end(out);
      });
    });
    up.on("error", function (err) {
      cors(req, res);
      sendJson(res, 502, { err: "upstream", message: String(err.message || err) });
    });
    if (body.length) up.write(body);
    up.end();
  });
}

var server = http.createServer(function (req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  var parsed = url.parse(req.url, true);
  var p = parsed.pathname || "/";

  if (p === "/health" || p === "/") {
    sendJson(res, 200, {
      ok: true,
      service: "mercatus-clickup-proxy",
      tokenConfigured: !!TOKEN,
      teamId: TEAM_ID || null,
      upstream: "https://api.clickup.com/api/v2/"
    });
    return;
  }

  if (p.indexOf("/api/v2/") === 0) {
    proxy(req, res, p + (parsed.search || ""));
    return;
  }

  sendJson(res, 404, {
    err: "not_found",
    hint: "Use /health or /api/v2/... (ClickUp REST paths)"
  });
});

server.listen(PORT, HOST, function () {
  console.log("[clickup-proxy] http://" + HOST + ":" + PORT);
  console.log("[clickup-proxy] token:", TOKEN ? "configured" : "MISSING — set CLICKUP_API_TOKEN");
  console.log("[clickup-proxy] team_id:", TEAM_ID || "(optional)");
  console.log("[clickup-proxy] production stub target: https://api.mensmercatus.online/clickup/");
});
