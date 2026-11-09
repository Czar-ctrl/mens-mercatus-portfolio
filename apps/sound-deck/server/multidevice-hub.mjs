#!/usr/bin/env node
/**
 * SoundX multi-device hub — static HTTP + WebSocket on one port (default 8791).
 * Roles: host (Mac SoundX), controller (phone MPC pads), mic (phone voice).
 * STT: tries whisper.cpp / ffmpeg+ollama if present; else DEMO echo path.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.SOUNDX_HUB_PORT || 8791);
const HOST = process.env.SOUNDX_HUB_HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function lanIPv4() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === 'IPv4' && !n.internal) return n.address;
    }
  }
  return '127.0.0.1';
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent((urlPath || '/').split('?')[0]);
  const cleaned = decoded.replace(/\0/g, '').replace(/^\/+/, '');
  const full = path.normalize(path.join(root, cleaned));
  if (!full.startsWith(root)) return null;
  return full;
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
}

function resolveStatic(urlPath) {
  // Prefer controller / mic / deck roots
  if (urlPath === '/' || urlPath === '') {
    return path.join(ROOT, 'index.html');
  }
  if (urlPath.startsWith('/controller')) {
    const sub = urlPath.slice('/controller'.length) || '/';
    const p = safeJoin(path.join(ROOT, 'controller'), sub === '/' ? '/index.html' : sub);
    if (p && fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    if (sub === '/' || sub === '') return path.join(ROOT, 'controller', 'index.html');
  }
  if (urlPath.startsWith('/mic')) {
    const sub = urlPath.slice('/mic'.length) || '/';
    const p = safeJoin(path.join(ROOT, 'mic'), sub === '/' ? '/index.html' : sub);
    if (p && fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    if (sub === '/' || sub === '') return path.join(ROOT, 'mic', 'index.html');
  }
  // SoundX deck assets
  const deck = safeJoin(ROOT, urlPath);
  if (deck && fs.existsSync(deck) && fs.statSync(deck).isDirectory()) {
    const idx = path.join(deck, 'index.html');
    if (fs.existsSync(idx)) return idx;
  }
  if (deck && fs.existsSync(deck) && fs.statSync(deck).isFile()) return deck;
  return null;
}

/** ---- peer registry ---- */
const peers = new Map(); // ws -> { role, name, id }

function peerSnapshot() {
  const list = [];
  for (const [, meta] of peers) list.push({ id: meta.id, role: meta.role, name: meta.name });
  return list;
}

function broadcast(obj, except = null) {
  const raw = JSON.stringify(obj);
  for (const [ws] of peers) {
    if (ws !== except && ws.readyState === 1) ws.send(raw);
  }
}

function sendToRole(role, obj) {
  const raw = JSON.stringify(obj);
  for (const [ws, meta] of peers) {
    if (meta.role === role && ws.readyState === 1) ws.send(raw);
  }
}

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

/** ---- STT stub ---- */
async function runSTT(audioBuf, mime = 'audio/webm') {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soundx-stt-'));
  const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : 'webm';
  const inPath = path.join(tmpDir, `chunk.${ext}`);
  const wavPath = path.join(tmpDir, 'chunk.wav');
  fs.writeFileSync(inPath, audioBuf);

  const whisperBin =
    process.env.WHISPER_BIN ||
    ['whisper-cli', 'whisper', 'whisper.cpp', '/opt/homebrew/bin/whisper-cli']
      .map((c) => {
        try {
          if (c.includes('/')) return fs.existsSync(c) ? c : null;
          // which
          return null;
        } catch {
          return null;
        }
      })
      .find(Boolean);

  // Try ffmpeg → wav then whisper if available
  const hasFfmpeg = (() => {
    try {
      spawn('ffmpeg', ['-version'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();

  function which(cmd) {
    return new Promise((resolve) => {
      const p = spawn('which', [cmd]);
      let out = '';
      p.stdout.on('data', (d) => { out += d; });
      p.on('close', (code) => resolve(code === 0 ? out.trim() : ''));
      p.on('error', () => resolve(''));
    });
  }

  const ffmpeg = await which('ffmpeg');
  const whisper = (await which('whisper-cli')) || (await which('whisper')) || whisperBin;

  if (ffmpeg && whisper) {
    await new Promise((resolve, reject) => {
      const p = spawn(ffmpeg, ['-y', '-i', inPath, '-ar', '16000', '-ac', '1', wavPath], { stdio: 'ignore' });
      p.on('close', (c) => (c === 0 ? resolve() : reject(new Error('ffmpeg'))));
      p.on('error', reject);
    }).catch(() => null);

    if (fs.existsSync(wavPath)) {
      const text = await new Promise((resolve) => {
        const p = spawn(whisper, [wavPath], { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        p.stdout.on('data', (d) => { out += d; });
        p.on('close', () => resolve(out.trim()));
        p.on('error', () => resolve(''));
        setTimeout(() => { try { p.kill(); } catch {} resolve(out.trim()); }, 25000);
      });
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      if (text) return { text, demo: false, engine: 'whisper' };
    }
  }

  // Ollama: no native audio STT in typical models — DEMO path
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  const kb = (audioBuf.length / 1024).toFixed(1);
  return {
    text: `[DEMO] Audio received (${kb} KB). Install whisper.cpp (whisper-cli) for live STT, or use phone Web Speech → text over WS.`,
    demo: true,
    engine: 'demo',
  };
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/info' || url.pathname === '/info') {
    const ip = lanIPv4();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({
      ok: true,
      port: PORT,
      lanIp: ip,
      hostUrl: `http://${ip}:${PORT}/`,
      controllerUrl: `http://${ip}:${PORT}/controller/`,
      micUrl: `http://${ip}:${PORT}/mic/`,
      wsUrl: `ws://${ip}:${PORT}/ws`,
      peers: peerSnapshot(),
      hostname: os.hostname(),
    }));
    return;
  }

  if (url.pathname === '/api/stt' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const buf = Buffer.concat(chunks);
      const mime = req.headers['content-type'] || 'audio/webm';
      try {
        const result = await runSTT(buf, mime);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ text: '', demo: true, error: String(err.message || err) }));
      }
    });
    return;
  }

  const file = resolveStatic(url.pathname);
  if (file) {
    sendFile(res, file);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found — try /controller/ or /mic/ or /');
});

const wss = new WebSocketServer({ server, path: '/ws' });
let nextId = 1;

wss.on('connection', (ws, req) => {
  const id = `p${nextId++}`;
  peers.set(ws, { id, role: 'unknown', name: id });
  send(ws, {
    type: 'welcome',
    id,
    info: {
      lanIp: lanIPv4(),
      port: PORT,
      controllerPath: '/controller/',
      micPath: '/mic/',
    },
    peers: peerSnapshot(),
  });

  ws.on('message', async (data, isBinary) => {
    let msg;
    try {
      if (isBinary) {
        // raw audio blob from mic — treat as mic_chunk binary
        const meta = peers.get(ws);
        if (!meta._audioChunks) meta._audioChunks = [];
        meta._audioChunks.push(Buffer.from(data));
        return;
      }
      msg = JSON.parse(String(data));
    } catch {
      return;
    }

    const meta = peers.get(ws);
    if (!meta) return;

    if (msg.type === 'hello') {
      meta.role = msg.role || 'unknown';
      meta.name = msg.name || meta.role;
      broadcast({ type: 'peers', peers: peerSnapshot() });
      send(ws, { type: 'hello_ack', id: meta.id, role: meta.role, peers: peerSnapshot() });
      return;
    }

    // Forward pad / note / pattern / transport to host
    if (['pad', 'note', 'pattern', 'transport', 'scene', 'velocity'].includes(msg.type)) {
      sendToRole('host', { ...msg, from: meta.id, role: meta.role });
      // also echo to other controllers for UI sync
      broadcast({ ...msg, from: meta.id }, ws);
      return;
    }

    // Mic: text from phone Web Speech (preferred live path)
    if (msg.type === 'stt_text') {
      const payload = {
        type: 'stt_result',
        text: String(msg.text || '').trim(),
        demo: !!msg.demo,
        engine: msg.engine || 'phone-webspeech',
        from: meta.id,
      };
      sendToRole('host', payload);
      broadcast(payload, ws);
      return;
    }

    // Mic: end of recording — run STT on buffered chunks or base64 body
    if (msg.type === 'mic_end') {
      let buf = Buffer.alloc(0);
      if (msg.data) {
        buf = Buffer.from(msg.data, 'base64');
      } else if (meta._audioChunks?.length) {
        buf = Buffer.concat(meta._audioChunks);
        meta._audioChunks = [];
      }
      if (!buf.length) {
        send(ws, { type: 'stt_result', text: '', demo: true, error: 'empty audio' });
        return;
      }
      send(ws, { type: 'stt_status', status: 'processing', bytes: buf.length });
      const result = await runSTT(buf, msg.mime || 'audio/webm');
      const payload = { type: 'stt_result', ...result, from: meta.id };
      sendToRole('host', payload);
      send(ws, payload);
      broadcast(payload, ws);
      return;
    }

    if (msg.type === 'mic_chunk' && msg.data) {
      if (!meta._audioChunks) meta._audioChunks = [];
      meta._audioChunks.push(Buffer.from(msg.data, 'base64'));
      return;
    }

    if (msg.type === 'ping') {
      send(ws, { type: 'pong', t: Date.now() });
      return;
    }

    // Host → broadcast UI / TTS hints
    if (msg.type === 'host_say' || msg.type === 'host_status') {
      broadcast({ ...msg, from: meta.id }, ws);
      return;
    }
  });

  ws.on('close', () => {
    peers.delete(ws);
    broadcast({ type: 'peers', peers: peerSnapshot() });
  });
});

server.listen(PORT, HOST, () => {
  const ip = lanIPv4();
  console.log(`[SoundX hub] http://${ip}:${PORT}/`);
  console.log(`[SoundX hub] controller  http://${ip}:${PORT}/controller/`);
  console.log(`[SoundX hub] mic         http://${ip}:${PORT}/mic/`);
  console.log(`[SoundX hub] ws          ws://${ip}:${PORT}/ws`);
  console.log(`[SoundX hub] serving     ${ROOT}`);
});
