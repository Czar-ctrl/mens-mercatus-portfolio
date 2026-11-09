/**
 * Boot — modules are IIFEs loaded in order via script tags.
 * Active nav highlight from data-page attribute.
 */
(function () {
  const page = document.body.getAttribute("data-page");
  if (!page) return;
  document.querySelectorAll(".nav-links a[data-nav]").forEach((a) => {
    if (a.getAttribute("data-nav") === page) a.classList.add("is-active");
  });
})();
