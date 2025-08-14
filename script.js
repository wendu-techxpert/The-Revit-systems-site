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

// Function for the get a quote or explore service buttons
const slider = document.querySelector(".slider");
const btnServices = document.getElementById("btn-services");
const btnQuote = document.getElementById("btn-quote");

btnQuote.addEventListener("click", () => {
  slider.style.transform = "translateX(100%)";
  btnQuote.classList.add("active");
  btnQuote.classList.remove("inactive");
  btnServices.classList.remove("active");
  btnServices.classList.add("inactive");
});

btnServices.addEventListener("click", () => {
  slider.style.transform = "translateX(0%)";
  btnServices.classList.add("active");
  btnServices.classList.remove("inactive");
  btnQuote.classList.remove("active");
  btnQuote.classList.add("inactive");
});
