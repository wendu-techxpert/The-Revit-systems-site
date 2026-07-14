fetch("/component/header.html")
  .then((response) => response.text())
  .then((html) => {
    document.getElementById("header-container").innerHTML = html;
    // NOW the button exists
    const getStartedBtn = document.getElementById("getStartedBtn");

    getStartedBtn.addEventListener("click", () => {
      const phone = "2348061704042";
      const message = "Hello Revit Systems, I'm interested in your services";

      window.open(
        `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer"
      );
    });
    initializeMenu();

    // Initialize Get Started button if needed
    // if (typeof initializeGetStarted === "function") {
    //   initializeGetStarted();
    // }
  })
  .catch((error) => console.error("Header failed to load:", error));
