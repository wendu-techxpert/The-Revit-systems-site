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
