// Mobile hamburger for the shared header. One file so every page behaves the
// same. Follows the standard menu pattern: toggle button, and it closes on a
// second tap, on tapping outside, on tapping a link, on Escape, and when the
// viewport grows back to desktop. CSS (.nav-toggle / .fds-nav.open) is in tw.css
// and only applies at <=640px.
(function () {
  function initHeader(header) {
    var nav = header.querySelector(".fds-nav, .fds-nav-dark");
    if (!nav || header.querySelector(".nav-toggle")) return;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nav-toggle";
    btn.setAttribute("aria-label", "Menu");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML =
      '<span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span>';

    function setOpen(open) {
      nav.classList.toggle("open", open);
      btn.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
    }
    function isOpen() {
      return nav.classList.contains("open");
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation(); // don't let the document handler see this as an outside click
      setOpen(!isOpen());
    });

    // Tapping a nav link closes the menu.
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });

    // Tapping anywhere outside the header closes it.
    document.addEventListener("click", function (e) {
      if (isOpen() && !header.contains(e.target)) setOpen(false);
    });

    // Escape closes it and returns focus to the button.
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) {
        setOpen(false);
        btn.focus();
      }
    });

    // Growing back to desktop clears any open state.
    window.addEventListener("resize", function () {
      if (isOpen() && window.innerWidth > 640) setOpen(false);
    });

    header.insertBefore(btn, nav);
  }

  function init() {
    document.querySelectorAll(".fds-header, .fds-header-dark").forEach(initHeader);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
