/* ============================================================
   HelpHive — ui.js
   ============================================================
   PURPOSE: Small, reusable UI helper functions used by the
   other JS files (posts.js, auth.js).

   BEGINNER TIP:
   This file does NOT run anything by itself on page load.
   It just DEFINES functions like showToast() and timeAgo()
   so that other files can call them whenever they need to.

   Because this is loaded as a normal <script> (not a module),
   every function below becomes available globally — any other
   JS file on the page can call HH_UI.showToast(...) etc.
   We group everything under one "HH_UI" object so we don't
   accidentally clash with variable names in other files.
   ============================================================ */

const HH_UI = {

  /* ── TOAST NOTIFICATIONS ───────────────────────────────────
     Shows a small pop-up message at the bottom-right of the
     screen (see .toast-container in components.css).
     type can be: "success", "error", or "info"
  ──────────────────────────────────────────────────────────── */
  showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return; // Safety check — page might not have one

    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    // Remove the toast automatically after a few seconds.
    // We first add "toast--leaving" so the slide-out animation
    // plays (see @keyframes toastSlideOut in animations.css),
    // THEN remove the element once that animation finishes.
    setTimeout(() => {
      toast.classList.add("toast--leaving");
      toast.addEventListener("animationend", () => toast.remove());
    }, 3000);
  },

  /* ── MODALS ─────────────────────────────────────────────────
     Opens or closes a modal by its element id.
     "hidden" class is what reset.css uses to hide elements.
  ──────────────────────────────────────────────────────────── */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove("hidden");
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add("hidden");
  },

  /* ── ANIMATED NUMBER COUNT-UP ──────────────────────────────
     Makes a number count up from 0 (or any start value) to its
     real value. Used for hero stats, profile stats, etc.
     duration is in milliseconds.
  ──────────────────────────────────────────────────────────── */
  animateNumber(el, from, to, duration = 900) {
    if (!el) return;
    const startTime = performance.now();

    function frame(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      // Ease-out curve so it starts fast and settles gently
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (to - from) * eased);
      el.textContent = HH_UI.formatNumber(current);

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = HH_UI.formatNumber(to);
      }
    }
    requestAnimationFrame(frame);
  },

  /* Formats large numbers with commas: 12400 -> "12,400" */
  formatNumber(num) {
    return num.toLocaleString("en-US");
  },

  /* ── "TIME AGO" FORMATTER ──────────────────────────────────
     Turns an ISO timestamp like "2026-06-24T09:15:00Z" into
     a friendly string like "2 hours ago" or "3 days ago".
  ──────────────────────────────────────────────────────────── */
  timeAgo(isoTimestamp) {
    const then = new Date(isoTimestamp).getTime();
    const now = Date.now();
    const seconds = Math.floor((now - then) / 1000);

    if (seconds < 60) return "just now";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;

    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  },

  /* ── SAFE TEXT INSERTION ───────────────────────────────────
     Whenever we insert text that a USER typed (a comment, a
     post title, a bio) into the page using innerHTML, we must
     "escape" it first. Otherwise someone could type HTML/script
     tags into a text box and break the page (or worse).
     This function turns dangerous characters into safe text.
  ──────────────────────────────────────────────────────────── */
  escapeHTML(str) {
    if (str === null || str === undefined) return "";
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  },

  /* ── SIMPLE MARKDOWN-ISH RENDERER ──────────────────────────
     Our create-post editor toolbar adds **bold**, *italic*,
     [text](url) links, and `code`. This turns that plain text
     into safe HTML so post bodies actually look formatted.
     IMPORTANT: we escape first, THEN add formatting tags —
     this keeps it safe from injected HTML.
  ──────────────────────────────────────────────────────────── */
  renderFormattedText(rawText) {
    let safe = HH_UI.escapeHTML(rawText);

    // Paragraphs: blank lines become paragraph breaks
    const paragraphs = safe.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

    return paragraphs
      .map((p) => {
        let html = p
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.+?)\*/g, "<em>$1</em>")
          .replace(/`(.+?)`/g, "<code>$1</code>")
          .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
          .replace(/\n/g, "<br>");
        return `<p>${html}</p>`;
      })
      .join("");
  },

  /* ── BUTTON RIPPLE EFFECT ───────────────────────────────────
     Creates the little expanding circle effect when a .btn is
     clicked (see @keyframes rippleExpand in animations.css).
     We attach ONE listener to the whole page instead of one
     per button — this is called "event delegation" and is
     much more efficient.
  ──────────────────────────────────────────────────────────── */
  initRippleEffect() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn");
      if (!btn) return;

      const ripple = document.createElement("span");
      const rect = btn.getBoundingClientRect();
      // Make the ripple big enough to always cover the button
      const size = Math.max(rect.width, rect.height) * 1.5;

      ripple.className = "ripple";
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;

      btn.appendChild(ripple);
      // Clean up the ripple element once its animation finishes
      ripple.addEventListener("animationend", () => ripple.remove());
    });
  },
};
