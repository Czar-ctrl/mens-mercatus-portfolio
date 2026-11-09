/**
 * Homepage desk: jump list (/ or ⌘K button) and weekday equity session hours.
 * Session open/closed uses the browser clock in each city's timezone.
 * It is not an exchange feed. Quotes on the page are a static snapshot.
 */
(function () {
  "use strict";

  var ITEMS = [
    { label: "Work", group: "Pages", href: "index.html#work" },
    { label: "Blueprint", group: "Pages", href: "blueprint/index.html" },
    { label: "Apps", group: "Pages", href: "apps/index.html" },
    { label: "Vault", group: "Pages", href: "vault/index.html" },
    { label: "Contact", group: "Pages", href: "contact.html" },
    { label: "SoundX", group: "Systems", href: "apps/soundx-ai/" },
    { label: "JobNet", group: "Systems", href: "apps/jobnet/" },
    { label: "Blueprint", group: "Systems", href: "blueprint/" },
    { label: "Forex", group: "Systems", href: "/apps/forex-codex/" }
  ];

  var root = document.getElementById("mm-palette");
  var input = document.getElementById("mm-palette-q");
  var list = document.getElementById("mm-palette-list");
  var opener = document.querySelector("[data-mm-palette-open]");
  var active = 0;
  var visible = ITEMS.slice();
  var lastFocus = null;

  function filtered(q) {
    var needle = (q || "").trim().toLowerCase();
    if (!needle) return ITEMS.slice();
    return ITEMS.filter(function (item) {
      return (item.label + " " + item.group).toLowerCase().indexOf(needle) !== -1;
    });
  }

  function render() {
    if (!list) return;
    visible = filtered(input ? input.value : "");
    if (active >= visible.length) active = 0;
    list.innerHTML = "";
    if (!visible.length) {
      var empty = document.createElement("li");
      empty.className = "mm-palette-empty";
      empty.textContent = "No match.";
      list.appendChild(empty);
      return;
    }
    visible.forEach(function (item, i) {
      var li = document.createElement("li");
      li.setAttribute("role", "presentation");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("role", "option");
      btn.id = "mm-palette-opt-" + i;
      btn.setAttribute("aria-selected", i === active ? "true" : "false");
      var name = document.createElement("span");
      name.textContent = item.label;
      var group = document.createElement("small");
      group.textContent = item.group;
      btn.appendChild(name);
      btn.appendChild(group);
      btn.addEventListener("click", function () {
        go(item.href);
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
    if (input && visible.length) {
      input.setAttribute("aria-activedescendant", "mm-palette-opt-" + active);
    }
  }

  function go(href) {
    closePalette();
    window.location.href = href;
  }

  function openPalette() {
    if (!root || !root.hidden) return;
    lastFocus = document.activeElement;
    root.hidden = false;
    if (opener) opener.setAttribute("aria-expanded", "true");
    if (input) {
      input.value = "";
      active = 0;
      render();
      input.focus();
    }
  }

  function closePalette() {
    if (!root || root.hidden) return;
    root.hidden = true;
    if (opener) opener.setAttribute("aria-expanded", "false");
    if (input) input.removeAttribute("aria-activedescendant");
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  function move(delta) {
    if (!visible.length) return;
    active = (active + delta + visible.length) % visible.length;
    render();
    var selected = list && list.querySelector('[aria-selected="true"]');
    if (selected && selected.scrollIntoView) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }

  function typingTarget(el) {
    if (!el) return false;
    var tag = (el.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
  }

  if (opener) {
    opener.setAttribute("aria-expanded", "false");
    opener.addEventListener("click", function () {
      if (root && root.hidden) openPalette();
      else closePalette();
    });
  }

  if (root) {
    root.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.closest && t.closest("[data-mm-palette-close]")) closePalette();
    });
  }

  if (input) {
    input.addEventListener("input", function () {
      active = 0;
      render();
    });
  }

  document.addEventListener("keydown", function (e) {
    var open = root && !root.hidden;
    if (e.key === "Escape" && open) {
      e.preventDefault();
      closePalette();
      return;
    }
    if (open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      move(e.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (open && e.key === "Enter") {
      if (visible[active]) {
        e.preventDefault();
        go(visible[active].href);
      }
      return;
    }
    if (!open && e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !typingTarget(e.target)) {
      e.preventDefault();
      openPalette();
    }
  });

  function minutes(hhmm) {
    var bits = String(hhmm).split(":");
    return parseInt(bits[0], 10) * 60 + parseInt(bits[1], 10);
  }

  function paintSessions() {
    var nodes = document.querySelectorAll("[data-mm-sessions] .mm-session");
    var now = new Date();
    nodes.forEach(function (node) {
      var tz = node.getAttribute("data-tz");
      var openM = minutes(node.getAttribute("data-open"));
      var closeM = minutes(node.getAttribute("data-close"));
      var parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }).formatToParts(now);
      var map = {};
      parts.forEach(function (part) { map[part.type] = part.value; });
      var weekend = map.weekday === "Sat" || map.weekday === "Sun";
      var nowM = parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10);
      var isOpen = !weekend && nowM >= openM && nowM < closeM;
      node.classList.toggle("is-open", isOpen);
      node.classList.toggle("is-closed", !isOpen);
      var state = node.querySelector(".mm-session-state");
      if (state) {
        state.textContent = map.hour + ":" + map.minute + " · " + (isOpen ? "Open" : "Closed");
      }
    });
  }

  paintSessions();
  setInterval(paintSessions, 30000);
})();
