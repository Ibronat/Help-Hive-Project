/* ============================================================
   HelpHive — auth.js
   ============================================================
   PURPOSE: A SIMULATED login system. There is no real server —
   instead we store accounts and the current session in the
   browser's localStorage. This is perfect for learning how
   auth UI logic works, but it is NOT secure and would never
   be used like this in a real production site (passwords
   should never be stored in plain text on a real server!).

   BEGINNER TIP:
   localStorage.setItem("key", "value") saves a string.
   localStorage.getItem("key") reads it back.
   We use JSON.stringify() / JSON.parse() to save and read
   whole objects (not just plain strings).
   ============================================================ */

const HH_AUTH = {

  // The localStorage "keys" (think of them as folder names in a filing cabinet)
  ACCOUNTS_KEY: "hh_accounts",   // every account ever signed up, in this browser
  SESSION_KEY: "hh_session",     // who is currently logged in (or nothing)

  /* ── READ HELPERS ───────────────────────────────────────── */
  getAccounts() {
    const raw = localStorage.getItem(this.ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  saveAccounts(accounts) {
    localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(accounts));
  },

  getCurrentUser() {
    const raw = localStorage.getItem(this.SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  isLoggedIn() {
    return this.getCurrentUser() !== null;
  },

  /* ── SIGNUP ─────────────────────────────────────────────────
     Creates a new account, logs them in immediately, and
     returns { success: true } or { success: false, message }.
  ──────────────────────────────────────────────────────────── */
  signup({ firstName, lastName, username, email, password, isExpert, expertField }) {
    const accounts = this.getAccounts();

    const emailTaken = accounts.some((a) => a.email.toLowerCase() === email.toLowerCase());
    if (emailTaken) {
      return { success: false, message: "An account with this email already exists." };
    }

    const newAccount = {
      firstName,
      lastName,
      username,
      email,
      password, // NOTE: plain text only because this is a frontend-only demo!
      isExpert: !!isExpert,
      expertField: expertField || "",
      avatarLetter: firstName.charAt(0).toUpperCase(),
      joinDate: new Date().toISOString(),
    };

    accounts.push(newAccount);
    this.saveAccounts(accounts);

    // Log the new user in right away
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(newAccount));
    return { success: true };
  },

  /* ── LOGIN ──────────────────────────────────────────────────
     Checks the email/password against accounts saved in this
     browser. Returns { success: true } or { success: false, message }.
  ──────────────────────────────────────────────────────────── */
  login(email, password) {
    const accounts = this.getAccounts();
    const match = accounts.find(
      (a) => a.email.toLowerCase() === email.toLowerCase() && a.password === password
    );

    if (!match) {
      return { success: false, message: "Invalid email or password." };
    }

    localStorage.setItem(this.SESSION_KEY, JSON.stringify(match));
    return { success: true };
  },

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
  },
};


/* ── EVERYTHING BELOW RUNS ONCE THE PAGE IS READY ─────────────── */
document.addEventListener("DOMContentLoaded", () => {

  /* ── 1. UPDATE NAVBAR BASED ON LOGIN STATE ─────────────────
     Every page's navbar has TWO versions of the right side:
     #navAuthButtons (Sign in / Join free) — shown when logged OUT
     #navUserMenu (avatar + dropdown)      — shown when logged IN
  ──────────────────────────────────────────────────────────── */
  function refreshNavbar() {
    const authButtons = document.getElementById("navAuthButtons");
    const userMenu = document.getElementById("navUserMenu");
    const avatarLetter = document.getElementById("avatarLetter");
    const user = HH_AUTH.getCurrentUser();

    if (user) {
      if (authButtons) authButtons.classList.add("hidden");
      if (userMenu) userMenu.classList.remove("hidden");
      if (avatarLetter) avatarLetter.textContent = user.avatarLetter || user.firstName.charAt(0).toUpperCase();
    } else {
      if (authButtons) authButtons.classList.remove("hidden");
      if (userMenu) userMenu.classList.add("hidden");
    }
  }
  refreshNavbar();

  /* ── 2. LOGOUT BUTTON ───────────────────────────────────────
     Found inside the avatar dropdown on every logged-in page.
  ──────────────────────────────────────────────────────────── */
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      HH_AUTH.logout();
      if (window.HH_UI) HH_UI.showToast("You've been signed out.", "info");
      setTimeout(() => { window.location.href = "index.html"; }, 600);
    });
  }

  /* ── 3. PROTECTED PAGES ─────────────────────────────────────
     create-post.html requires being logged in. If the page
     contains the post editor and nobody is logged in, redirect
     to login.html. This is a simple, frontend-only way to
     "protect" a page — a real app would also check on the server.
  ──────────────────────────────────────────────────────────── */
  const postEditor = document.getElementById("postEditor");
  if (postEditor && !HH_AUTH.isLoggedIn()) {
    window.location.href = "login.html";
    return; // Stop running the rest of this page's auth code
  }


  /* ══════════════════════════════════════════════════════════
     4. LOGIN PAGE LOGIC (only runs if #loginForm exists)
  ══════════════════════════════════════════════════════════ */
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    const passwordToggle = document.getElementById("loginPasswordToggle");
    const submitBtn = document.getElementById("loginSubmit");
    const errorBox = document.getElementById("loginError");
    const errorMsg = document.getElementById("loginErrorMsg");
    const emailError = document.getElementById("loginEmailError");

    // Show/hide password text
    if (passwordToggle) {
      passwordToggle.addEventListener("click", () => {
        const showing = passwordInput.type === "text";
        passwordInput.type = showing ? "password" : "text";
        passwordToggle.textContent = showing ? "👁️" : "🙈";
      });
    }

    function showLoginError(message) {
      errorMsg.textContent = message;
      errorBox.classList.remove("hidden");
    }

    submitBtn.addEventListener("click", () => {
      errorBox.classList.add("hidden");
      emailError.classList.add("hidden");

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      // Basic validation — beginner-friendly, not a full email regex library
      if (!email.includes("@")) {
        emailError.textContent = "Please enter a valid email address.";
        emailError.classList.remove("hidden");
        return;
      }
      if (password.length === 0) {
        showLoginError("Please enter your password.");
        return;
      }

      const result = HH_AUTH.login(email, password);
      if (result.success) {
        HH_UI.showToast("Welcome back!", "success");
        setTimeout(() => { window.location.href = "index.html"; }, 500);
      } else {
        showLoginError(result.message);
      }
    });

    // Pressing Enter in either field submits the form
    [emailInput, passwordInput].forEach((input) => {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submitBtn.click();
      });
    });

    // Social buttons are not real OAuth — this is a demo, so we explain that
    ["googleLogin", "githubLogin"].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener("click", () => {
          HH_UI.showToast("Social login isn't connected in this demo.", "info");
        });
      }
    });
  }


  /* ══════════════════════════════════════════════════════════
     5. SIGNUP PAGE LOGIC (only runs if #signupForm exists)
  ══════════════════════════════════════════════════════════ */
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    const typeMemberBtn = document.getElementById("typeMember");
    const typeExpertBtn = document.getElementById("typeExpert");
    const expertFieldGroup = document.getElementById("expertFieldGroup");
    let accountType = "member"; // tracks which toggle is selected

    // ── Account type toggle (Member vs Expert) ──
    function setAccountType(type) {
      accountType = type;
      typeMemberBtn.classList.toggle("account-type-btn--active", type === "member");
      typeExpertBtn.classList.toggle("account-type-btn--active", type === "expert");
      expertFieldGroup.classList.toggle("hidden", type !== "expert");
    }
    typeMemberBtn.addEventListener("click", () => setAccountType("member"));
    typeExpertBtn.addEventListener("click", () => setAccountType("expert"));

    // ── Password show/hide ──
    const passwordInput = document.getElementById("signupPassword");
    const passwordToggle = document.getElementById("signupPasswordToggle");
    passwordToggle.addEventListener("click", () => {
      const showing = passwordInput.type === "text";
      passwordInput.type = showing ? "password" : "text";
      passwordToggle.textContent = showing ? "👁️" : "🙈";
    });

    // ── Password strength meter ──
    // A simple scoring system: length + variety of character types.
    // This is plenty for teaching the CONCEPT — real apps often use
    // a library, but the logic underneath is similar to this.
    const strengthFill = document.getElementById("passwordStrengthFill");
    const strengthLabel = document.getElementById("passwordStrengthLabel");

    function checkPasswordStrength(password) {
      let score = 0;
      if (password.length >= 8) score++;
      if (password.length >= 12) score++;
      if (/[A-Z]/.test(password)) score++;
      if (/[0-9]/.test(password)) score++;
      if (/[^A-Za-z0-9]/.test(password)) score++;

      const levels = [
        { width: "0%", label: "", color: "transparent" },
        { width: "20%", label: "Very weak", color: "var(--color-danger)" },
        { width: "40%", label: "Weak", color: "var(--color-danger)" },
        { width: "60%", label: "Okay", color: "var(--color-warning)" },
        { width: "80%", label: "Good", color: "var(--color-success)" },
        { width: "100%", label: "Strong", color: "var(--color-success)" },
      ];
      const level = levels[Math.min(score, levels.length - 1)];
      strengthFill.style.width = level.width;
      strengthFill.style.background = level.color;
      strengthLabel.textContent = level.label;
      return score;
    }

    passwordInput.addEventListener("input", () => {
      checkPasswordStrength(passwordInput.value);
    });

    // ── Submit ──
    const submitBtn = document.getElementById("signupSubmit");
    const errorBox = document.getElementById("signupError");
    const errorMsg = document.getElementById("signupErrorMsg");
    const usernameError = document.getElementById("signupUsernameError");
    const emailError = document.getElementById("signupEmailError");
    const passwordError = document.getElementById("signupPasswordError");

    function hideAllErrors() {
      [errorBox, usernameError, emailError, passwordError].forEach((el) => el.classList.add("hidden"));
    }

    submitBtn.addEventListener("click", () => {
      hideAllErrors();

      const firstName = document.getElementById("signupFirstName").value.trim();
      const lastName = document.getElementById("signupLastName").value.trim();
      const username = document.getElementById("signupUsername").value.trim();
      const email = document.getElementById("signupEmail").value.trim();
      const password = passwordInput.value;
      const expertField = document.getElementById("signupExpertField").value.trim();
      const agreeTerms = document.getElementById("agreeTerms").checked;

      // Validation, one field at a time, with specific messages
      if (!firstName || !lastName) {
        errorMsg.textContent = "Please fill in your first and last name.";
        errorBox.classList.remove("hidden");
        return;
      }
      if (username.length < 3) {
        usernameError.textContent = "Username must be at least 3 characters.";
        usernameError.classList.remove("hidden");
        return;
      }
      if (!email.includes("@")) {
        emailError.textContent = "Please enter a valid email address.";
        emailError.classList.remove("hidden");
        return;
      }
      if (password.length < 8) {
        passwordError.textContent = "Password must be at least 8 characters.";
        passwordError.classList.remove("hidden");
        return;
      }
      if (accountType === "expert" && expertField.length === 0) {
        errorMsg.textContent = "Please tell us your field of expertise.";
        errorBox.classList.remove("hidden");
        return;
      }
      if (!agreeTerms) {
        errorMsg.textContent = "Please agree to the Terms of Service to continue.";
        errorBox.classList.remove("hidden");
        return;
      }

      const result = HH_AUTH.signup({
        firstName,
        lastName,
        username,
        email,
        password,
        isExpert: accountType === "expert",
        expertField,
      });

      if (result.success) {
        HH_UI.showToast("Welcome to HelpHive! 🎉", "success");
        setTimeout(() => { window.location.href = "index.html"; }, 500);
      } else {
        errorMsg.textContent = result.message;
        errorBox.classList.remove("hidden");
      }
    });

    ["googleSignup", "githubSignup"].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener("click", () => {
          HH_UI.showToast("Social signup isn't connected in this demo.", "info");
        });
      }
    });
  }

});
