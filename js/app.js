/* ============================================================
   HelpHive — app.js
   ============================================================
   PURPOSE: This file runs on EVERY page. It handles the things
   that are the same everywhere: dark mode, the mobile menu,
   the navbar avatar dropdown, and scroll-triggered animations.

   BEGINNER TIP:
   Load order on every page is: app.js -> posts.js -> ui.js -> auth.js
   But because we wrap our code in "DOMContentLoaded" below,
   none of it actually RUNS until the whole page has finished
   loading — so it doesn't matter that posts.js/auth.js are
   defined later in the file list. By the time DOMContentLoaded
   fires, every script has already finished running top-to-bottom
   and every function in every file already exists.
   ============================================================ */

/* ── 1. THEME (DARK / LIGHT MODE) ──────────────────────────────
   We do this OUTSIDE of DOMContentLoaded and run it immediately,
   at the very top of the file. Why? Because we want the correct
   theme applied to the page INSTANTLY, before the user sees a
   flash of the wrong color scheme.
────────────────────────────────────────────────────────────── */
(function applyStoredTheme() {
  const savedTheme = localStorage.getItem("hh-theme");
  if (savedTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  }
  // If nothing is saved, the HTML's default data-theme="light" stays.
})();


/* ── 2. EVERYTHING ELSE WAITS FOR THE PAGE TO BE READY ────────── */
document.addEventListener("DOMContentLoaded", () => {

  /* ── THEME TOGGLE BUTTON ───────────────────────────────────
     Every page has a button with id="themeToggle" and an
     inner <span id="themeIcon"> showing 🌙 or ☀️.
  ──────────────────────────────────────────────────────────── */
  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");

  function updateThemeIcon() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (themeIcon) themeIcon.textContent = isDark ? "☀️" : "🌙";
  }
  updateThemeIcon(); // Set the correct icon as soon as the page loads

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      if (isDark) {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("hh-theme", "light");
      } else {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("hh-theme", "dark");
      }
      updateThemeIcon();
    });
  }


  /* ── MOBILE HAMBURGER MENU ─────────────────────────────────
     Clicking the hamburger toggles the mobile menu open/closed.
     The "open" class on the hamburger triggers the X animation
     (see animations.css section 12).
  ──────────────────────────────────────────────────────────── */
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  const mobileMenu = document.getElementById("mobileMenu");

  if (hamburgerBtn && mobileMenu) {
    hamburgerBtn.addEventListener("click", () => {
      hamburgerBtn.classList.toggle("open");
      mobileMenu.classList.toggle("hidden");
    });

    // Close the mobile menu automatically if the user taps a link in it
    mobileMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        hamburgerBtn.classList.remove("open");
        mobileMenu.classList.add("hidden");
      });
    });
  }


  /* ── AVATAR DROPDOWN MENU ──────────────────────────────────
     Clicking the round avatar button opens the dropdown
     (Profile / Saved Posts / Sign out). Clicking anywhere
     ELSE on the page closes it again.
  ──────────────────────────────────────────────────────────── */
  const avatarBtn = document.getElementById("avatarBtn");
  const userDropdown = document.getElementById("userDropdown");

  if (avatarBtn && userDropdown) {
    avatarBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // Don't let this click also trigger the "close" listener below
      userDropdown.classList.toggle("hidden");
    });

    // Clicking anywhere outside the dropdown closes it
    document.addEventListener("click", (e) => {
      if (!userDropdown.classList.contains("hidden") && !userDropdown.contains(e.target)) {
        userDropdown.classList.add("hidden");
      }
    });
  }


  /* ── NAVBAR SHADOW ON SCROLL ───────────────────────────────
     Adds a deeper shadow to the navbar once the page is
     scrolled down a little, so it feels "lifted" above content.
  ──────────────────────────────────────────────────────────── */
  const navbar = document.querySelector(".navbar");
  if (navbar) {
    window.addEventListener("scroll", () => {
      navbar.classList.toggle("navbar--scrolled", window.scrollY > 12);
    });
  }


  /* ── SCROLL REVEAL ANIMATION ───────────────────────────────
     Any element with class="reveal" starts invisible (see
     animations.css). We use an IntersectionObserver to watch
     for when these elements scroll into view, then add the
     "reveal--visible" class which triggers the fade-in.

     BEGINNER TIP: IntersectionObserver is much more efficient
     than checking scroll position manually on every scroll event.
  ──────────────────────────────────────────────────────────── */
  const revealElements = document.querySelectorAll(".reveal");
  if (revealElements.length > 0 && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal--visible");
            observer.unobserve(entry.target); // Only need to animate once
          }
        });
      },
      { threshold: 0.15 }
    );
    revealElements.forEach((el) => observer.observe(el));
  } else {
    // Fallback for very old browsers: just show everything immediately
    revealElements.forEach((el) => el.classList.add("reveal--visible"));
  }


  /* ── BUTTON RIPPLE EFFECT ──────────────────────────────────
     Defined in ui.js — we just turn it on here.
  ──────────────────────────────────────────────────────────── */
  if (window.HH_UI && typeof HH_UI.initRippleEffect === "function") {
    HH_UI.initRippleEffect();
  }

});
