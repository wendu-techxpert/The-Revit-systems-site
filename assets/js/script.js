(function () {
  const menuToggleBtn = document.getElementById("menuToggleBtn");
  const menuOverlay = document.getElementById("menuOverlay");
  const navMenu = document.getElementById("navMenu");
  const menuCloseBtn = document.getElementById("menuCloseBtn");
  const firstNavLink = navMenu.querySelector(".menu-nav a");

  function openMenu() {
    navMenu.classList.add("is-visible");
    menuOverlay.classList.add("is-visible");
    setTimeout(() => firstNavLink && firstNavLink.focus(), 200);
  }
  function closeMenu() {
    navMenu.classList.remove("is-visible");
    menuOverlay.classList.remove("is-visible");
    menuToggleBtn.setAttribute("aria-expanded", "false");
    menuToggleBtn.focus();
  }

  menuToggleBtn.addEventListener("click", () => {
    const expanded = menuToggleBtn.getAttribute("aria-expanded") === "true";
    expanded ? closeMenu() : openMenu();
  });

  menuOverlay.addEventListener("click", closeMenu);
  menuCloseBtn.addEventListener("click", closeMenu);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navMenu.classList.contains("is-visible")) {
      closeMenu();
    }
  });

  navMenu
    .querySelectorAll(".menu-nav a")
    .forEach((link) => link.addEventListener("click", closeMenu));
})();

// Add randomness so each circle moves differently
document.querySelectorAll(".abt-circle").forEach((circle) => {
  circle.style.animationDuration = 15 + Math.random() * 15 + "s";
  circle.style.animationDelay = Math.random() * 10 + "s";
});

const theFooterPageNote = document.querySelectorAll(".rv-tagline");

theFooterPageNote.forEach((element) => {
  element.innerText =
    "Empowering Africa’s businesses, redefining the global stage.";
});

const newsForm = document.querySelector(".rv-news-form");
const emailInput = document.getElementById("user-email");
const feedback = document.getElementById("newsletterFeedback");

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const form = document.getElementById("newsForm");

const btn = document.getElementById("getStartedBtn");

btn.addEventListener("click", () => {
  btn.disabled = true;
  btn.innerHTML = `
  <span class="spinner"></span>
  Loading...
`;

  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = "Get Started";
  }, 10000); // 10 seconds
});

//===================================================
//======== consultation button ======================
//===================================================
document.querySelector("#consultBtn").addEventListener("click", (e) => {
  consultBtn.disabled = true;
  consultBtn.innerHTML = `
  <span class="spinner"></span>
  Loading...
`;

  e.preventDefault();

  const email = "revitsystems@gmail.com";
  const subject = "Consultation Request";
  const body = "Hello Revit Systems,\n\nI would like to book a consultation.";

  const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
  const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  try {
    window.location.href = mailtoLink;

    // As a fallback, after a short delay, open Gmail in a new tab
    setTimeout(() => {
      window.open(gmailLink, "_blank");
    }, 1000);
  } catch (err) {
    // If mailto fails outright, go straight to Gmail
    window.open(gmailLink, "_blank");
  }

  setTimeout(() => {
    consultBtn.disabled = false;
    consultBtn.innerHTML = "consult";
  }, 10000); // 10 seconds
});
