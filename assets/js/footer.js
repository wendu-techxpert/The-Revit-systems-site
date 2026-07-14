fetch("/component/footer.html")
  .then((response) => response.text())
  .then((html) => {
    document.getElementById("footer").innerHTML = html;
  })
  .catch((error) => console.error("Footer failed to load:", error));
