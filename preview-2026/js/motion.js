/**
 * Parallax, magnetic hover, scroll reveals. Respects prefers-reduced-motion.
 */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* Scroll reveals */
  var reveals = document.querySelectorAll(".gz-reveal");
  if (reveals.length) {
    if (reduce || !("IntersectionObserver" in window)) {
      reveals.forEach(function (el) { el.classList.add("is-in"); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("is-in");
            io.unobserve(en.target);
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
      reveals.forEach(function (el) { io.observe(el); });
    }
  }

  if (reduce) return;

  /* Light parallax on marked layers */
  var layers = document.querySelectorAll("[data-parallax]");
  if (layers.length) {
    var ticking = false;
    function updateParallax() {
      var y = window.scrollY || 0;
      layers.forEach(function (el) {
        var speed = parseFloat(el.getAttribute("data-parallax") || "0.12");
        el.style.transform = "translate3d(0," + (y * speed * -0.35) + "px,0)";
      });
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateParallax);
      }
    }, { passive: true });
  }

  /* Magnetic buttons / cards */
  if (!fine) return;
  document.querySelectorAll("[data-magnetic]").forEach(function (el) {
    var strength = parseFloat(el.getAttribute("data-magnetic") || "0.28");
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      var dx = (e.clientX - (r.left + r.width / 2)) * strength;
      var dy = (e.clientY - (r.top + r.height / 2)) * strength;
      el.style.transform = "translate3d(" + dx + "px," + dy + "px,0)";
      el.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100) + "%");
      el.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100) + "%");
    });
    el.addEventListener("pointerleave", function () {
      el.style.transform = "";
    });
  });

  /* Card spotlight follow */
  document.querySelectorAll(".gz-card").forEach(function (el) {
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100) + "%");
      el.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100) + "%");
      if (fine) {
        var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        el.style.transform = "perspective(800px) rotateY(" + (dx * 6) + "deg) rotateX(" + (-dy * 6) + "deg) translateY(-2px)";
      }
    });
    el.addEventListener("pointerleave", function () {
      el.style.transform = "";
    });
  });
})();
