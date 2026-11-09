/**
 * Mobile nav collapse toggle.
 */
(function () {
  const nav = document.querySelector(".site-nav");
  const btn = document.querySelector("[data-nav-toggle]");
  if (!nav || !btn) return;

  btn.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  nav.querySelectorAll(".nav-links a").forEach((a) => {
    a.addEventListener("click", () => {
      nav.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    });
  });
})();
