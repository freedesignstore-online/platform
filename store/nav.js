// Injects a mobile hamburger toggle into the shared header. Kept as one shared
// file so every page's nav behaves identically. CSS (.nav-toggle / .fds-nav.open)
// lives in tw.css and only takes effect at <=640px.
(function () {
  function initHeader(header) {
    var nav = header.querySelector(".fds-nav, .fds-nav-dark");
    if (!nav || header.querySelector(".nav-toggle")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nav-toggle";
    btn.setAttribute("aria-label", "Toggle navigation");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML =
      '<span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span>';
    btn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      btn.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
    // Close after tapping a link.
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        nav.classList.remove("open");
        btn.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
      }
    });
    header.insertBefore(btn, nav);
  }
  function init() {
    document.querySelectorAll(".fds-header, .fds-header-dark").forEach(initHeader);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
