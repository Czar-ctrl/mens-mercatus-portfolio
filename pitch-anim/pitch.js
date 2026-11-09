/* Mercatus Concierge — pitch reel controller */
(function () {
  var LOOP_MS = 14000;

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function prefersReduced() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function syncVideos(reel, play) {
    qsa("video", reel).forEach(function (v) {
      v.muted = true;
      v.playsInline = true;
      v.setAttribute("playsinline", "");
      v.setAttribute("muted", "");
      if (play) {
        var p = v.play();
        if (p && typeof p.catch === "function") p.catch(function () {});
      } else {
        v.pause();
      }
    });
  }

  function restartAnimations(reel) {
    var scene = qs(".pitch-scene", reel);
    if (!scene) return;
    var nodes = [scene].concat(qsa("[class^='pitch-']", scene));
    nodes.forEach(function (el) {
      el.style.animation = "none";
      // force reflow
      void el.offsetWidth;
      el.style.animation = "";
    });
  }

  function initReel(reel) {
    if (!reel || reel.dataset.pitchReady === "1") return;
    reel.dataset.pitchReady = "1";

    var reduced = prefersReduced();
    syncVideos(reel, !reduced);

    if (reduced) return;

    // Soft restart when tab becomes visible again so the loop stays in sync
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        syncVideos(reel, false);
        return;
      }
      if (prefersReduced()) {
        syncVideos(reel, false);
        return;
      }
      restartAnimations(reel);
      syncVideos(reel, true);
    });

    // Optional: align video unmute-state (always muted for autoplay)
    qsa("video", reel).forEach(function (v) {
      v.addEventListener("loadeddata", function () {
        if (!document.hidden && !prefersReduced()) {
          var p = v.play();
          if (p && typeof p.catch === "function") p.catch(function () {});
        }
      });
    });
  }

  function boot() {
    qsa("[data-pitch-reel], .pitch-reel").forEach(initReel);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Expose for preview page / debugging
  window.MercatusPitch = {
    loopMs: LOOP_MS,
    restart: function () {
      qsa("[data-pitch-reel], .pitch-reel").forEach(function (reel) {
        if (!prefersReduced()) {
          restartAnimations(reel);
          syncVideos(reel, true);
        }
      });
    }
  };
})();
