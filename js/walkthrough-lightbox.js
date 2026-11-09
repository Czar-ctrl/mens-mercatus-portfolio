(function () {
  var lb = document.querySelector("[data-mm-walkthrough-lb]");
  if (!lb) return;
  var video = lb.querySelector("video");
  var openers = document.querySelectorAll("[data-mm-walkthrough]");
  var closer = lb.querySelector("[data-mm-walkthrough-close]");

  function open() {
    lb.hidden = false;
    document.documentElement.classList.add("mm-walkthrough-open");
    if (video) {
      try { video.currentTime = 0; } catch (e) {}
      // muted autoplay OFF — user presses play via controls
      video.muted = false;
    }
    (closer || lb).focus?.();
  }
  function close() {
    lb.hidden = true;
    document.documentElement.classList.remove("mm-walkthrough-open");
    if (video) {
      try { video.pause(); } catch (e) {}
    }
  }

  openers.forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      open();
    });
  });
  closer && closer.addEventListener("click", close);
  lb.addEventListener("click", function (e) {
    if (e.target === lb) close();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !lb.hidden) close();
  });
})();
