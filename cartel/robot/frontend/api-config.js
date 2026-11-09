/**
 * Mercatus Cartel Robot — API base URL (single constant).
 *
 * Same-origin DreamHost PHP proxy → VPS nginx → ASP.NET on 127.0.0.1:5080.
 * Browser stays on HTTPS mensmercatus.online; PHP curls HTTP to the VPS.
 *
 * fetch(`${API_BASE}/api/mercatus-cartel/chat`) becomes
 * /api/cartel/index.php?path=/api/mercatus-cartel/chat
 *
 * Direct HTTPS API (live): https://api.mensmercatus.online
 * Direct VPS HTTP (dev): http://208.113.214.2
 * Primary for portfolio Assist remains the same-origin PHP proxy below.
 */
(function (global) {
  var API_BASE = "/api/cartel/index.php?path=";
  // OPTIONAL direct: var API_BASE = "https://api.mensmercatus.online";
  // OPTIONAL direct: var API_BASE = "http://208.113.214.2";
  global.MERCATUS_CARTEL_API = API_BASE;
  global.MERCATUS_CARTEL_API_DISCONNECTED = false;
})(typeof window !== "undefined" ? window : globalThis);
