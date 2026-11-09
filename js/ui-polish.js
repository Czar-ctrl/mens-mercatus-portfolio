/**
 * Loading skeleton dismiss, button ripples, Ace flip whoosh + mute.
 */
(function () {
  "use strict";

  /* —— Skeleton —— */
  function dismissSkeleton() {
    document.documentElement.classList.remove("mm-loading");
    var sk = document.getElementById("mm-skel");
    if (!sk) return;
    window.setTimeout(function () {
      if (sk && sk.parentNode) sk.parentNode.removeChild(sk);
    }, 400);
  }

  function waitForHeroAssets() {
    var imgs = document.querySelectorAll(".mm-ace-face img");
    var pending = 0;
    function doneOne() {
      pending -= 1;
      if (pending <= 0) dismissSkeleton();
    }
    imgs.forEach(function (img) {
      if (img.complete && img.naturalWidth) return;
      pending += 1;
      img.addEventListener("load", doneOne, { once: true });
      img.addEventListener("error", doneOne, { once: true });
    });
    if (pending === 0) {
      // still give first paint a beat
      if (document.readyState === "complete") dismissSkeleton();
      else window.addEventListener("load", dismissSkeleton, { once: true });
    }
    // hard fallback
    window.setTimeout(dismissSkeleton, 2500);
  }

  /* —— Ripple —— */
  function addRipple(e) {
    var btn = e.currentTarget;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var rect = btn.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height);
    var ripple = document.createElement("span");
    ripple.className = "mm-ripple";
    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = e.clientX - rect.left - size / 2 + "px";
    ripple.style.top = e.clientY - rect.top - size / 2 + "px";
    btn.appendChild(ripple);
    ripple.addEventListener("animationend", function () {
      ripple.remove();
    });
  }

  function wireButtons() {
    document.querySelectorAll(".btn").forEach(function (btn) {
      btn.addEventListener("click", addRipple);
    });
  }

  /* —— Ace SFX —— */
  var MUTE_KEY = "mm-ace-sfx-mute";
  var audio = null;
  var muted = false;
  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
  } catch (e) {}

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio("assets/audio/ace-flip-whoosh.wav");
    audio.preload = "auto";
    audio.volume = 0.28;
    return audio;
  }

  function playFlip() {
    if (muted) return;
    try {
      var a = ensureAudio();
      a.currentTime = 0;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  function wireAce() {
    var card = document.querySelector(".mm-ace-card");
    if (!card) return;
    var flipped = false;
    card.addEventListener("pointerenter", function () {
      if (!flipped) {
        flipped = true;
        playFlip();
      }
    });
    card.addEventListener("pointerleave", function () {
      if (flipped) {
        flipped = false;
        playFlip();
      }
    });
    card.addEventListener("focus", function () {
      playFlip();
    });

    var controls = document.querySelector(".mm-ace-controls");
    if (!controls) return;
    var muteBtn = document.createElement("button");
    muteBtn.type = "button";
    muteBtn.className = "mm-ace-mute";
    muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    muteBtn.textContent = muted ? "Sound off" : "Sound on";
    muteBtn.addEventListener("click", function () {
      muted = !muted;
      try {
        localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      } catch (e) {}
      muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
      muteBtn.textContent = muted ? "Sound off" : "Sound on";
    });
    controls.appendChild(muteBtn);
  }

  function init() {
    waitForHeroAssets();
    wireButtons();
    wireAce();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
