/**
 * Right HUD sidebar — open/close + Escape + overlay.
 */
(function () {
  const sidebar = document.getElementById("vault-sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  const openers = document.querySelectorAll("[data-sidebar-open]");
  const closer = document.querySelectorAll("[data-sidebar-close]");
  if (!sidebar || !overlay) return;

  function setOpen(open) {
    sidebar.classList.toggle("is-open", open);
    overlay.classList.toggle("is-open", open);
    sidebar.setAttribute("aria-hidden", open ? "false" : "true");
    overlay.setAttribute("aria-hidden", open ? "false" : "true");
    openers.forEach((b) => b.setAttribute("aria-expanded", open ? "true" : "false"));
    document.body.style.overflow = open ? "hidden" : "";
    if (open) {
      const focusable = sidebar.querySelector("button, a");
      if (focusable) focusable.focus();
    }
  }

  openers.forEach((b) => b.addEventListener("click", () => setOpen(true)));
  closer.forEach((b) => b.addEventListener("click", () => setOpen(false)));
  overlay.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar.classList.contains("is-open")) setOpen(false);
  });
})();
