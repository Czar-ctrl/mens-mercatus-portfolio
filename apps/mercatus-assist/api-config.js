/**
 * Mercatus Blueprint Robot — API base (portfolio Assist).
 * Same-origin PHP proxy to VPS robot (primary). See frontend/api-config.js.
 * Direct HTTPS also live at https://api.mensmercatus.online — keep proxy primary.
 */
(function (global) {
  global.MERCATUS_CARTEL_API = "/api/cartel/index.php?path=";
  global.MERCATUS_CARTEL_API_DISCONNECTED = false;
})(typeof window !== "undefined" ? window : globalThis);
