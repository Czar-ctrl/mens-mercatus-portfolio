/* SoundX Studio storage namespace — keeps this standalone app's saved state apart from
 * the original SoundX deck (same origin). Every localStorage / sessionStorage key used on
 * Studio pages is transparently prefixed with "soundx-studio:". */
(function () {
  var P = 'soundx-studio:';
  window.SOUNDX_STUDIO = { ns: P, app: 'Mens Mercatus SoundX Studio', stamp: 'sxs20261020b' };
  try {
    var S = Storage.prototype, g = S.getItem, s = S.setItem, r = S.removeItem, k = S.key, c = S.clear;
    function pk(key) { key = String(key); return key.indexOf(P) === 0 ? key : P + key; }
    S.getItem = function (key) { return g.call(this, pk(key)); };
    S.setItem = function (key, v) { return s.call(this, pk(key), v); };
    S.removeItem = function (key) { return r.call(this, pk(key)); };
    S.clear = function () { var out = []; for (var i = 0; i < this.length; i++) { var x = k.call(this, i); if (x && x.indexOf(P) === 0) out.push(x); } for (var j = 0; j < out.length; j++) r.call(this, out[j]); };
  } catch (e) { console.warn('[soundx-studio] storage namespace', e); }
})();
