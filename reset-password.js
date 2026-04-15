const form = document.getElementById("reset-password-form");
const messageBox = document.getElementById("message");
const submitBtn = document.getElementById("submit-btn");
const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const strengthBar = document.getElementById("strength-bar");
const strengthBarFill = document.getElementById("strength-bar-fill");
const strengthText = document.getElementById("strength-text");

// 1. EXTRACT DATA FROM URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token");
const userId = urlParams.get("id");

// Basic check: If token or ID is missing, block the form
if (!token || !userId) {
  showStatus(
    "Invalid or missing reset link. Please request a new one.",
    "error"
  );
  form.style.display = "none";
  document.getElementById("instruction").style.display = "none";
}

// Password strength checker
newPasswordInput.addEventListener("input", function () {
  const password = this.value;

  if (password.length > 0) {
    strengthBar.classList.add("show");
    strengthText.classList.add("show");

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;

    strengthBarFill.className = "password-strength-bar";

    if (strength <= 1) {
      strengthBarFill.classList.add("weak");
      strengthText.textContent = "Weak password";
      strengthText.style.color = "var(--error)";
    } else if (strength === 2 || strength === 3) {
      strengthBarFill.classList.add("medium");
      strengthText.textContent = "Medium strength";
      strengthText.style.color = "var(--warning)";
    } else {
      strengthBarFill.classList.add("strong");
      strengthText.textContent = "Strong password";
      strengthText.style.color = "var(--success)";
    }
  } else {
    strengthBar.classList.remove("show");
    strengthText.classList.remove("show");
  }
});

// Real-time validation
confirmPasswordInput.addEventListener("input", function () {
  if (this.value && this.value !== newPasswordInput.value) {
    this.classList.add("invalid");
    this.classList.remove("valid");
  } else if (this.value && this.value === newPasswordInput.value) {
    this.classList.remove("invalid");
    this.classList.add("valid");
  } else {
    this.classList.remove("invalid", "valid");
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  // Validation
  if (newPassword !== confirmPassword) {
    confirmPasswordInput.classList.add("invalid");
    return showStatus("Passwords do not match!", "error");
  }

  if (newPassword.length < 8) {
    return showStatus("Password must be at least 8 characters long.", "error");
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span>Updating...';

  try {
    // 2. FETCH CALL TO BACKEND
    const response = await fetch("http://localhost:5000/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, token, newPassword }),
    });

    const data = await response.json();

    if (response.ok) {
      showStatus(
        "Password updated successfully! Redirecting to login...",
        "success"
      );
      form.style.display = "none";
      document.querySelector(".back-link").style.display = "none";
      setTimeout(() => {
        window.location.href = "/login/login.html";
      }, 3000);
    } else {
      showStatus(data.message || "Failed to reset password.", "error");
      submitBtn.disabled = false;
      submitBtn.innerText = "Update Password";
    }
  } catch (error) {
    showStatus("Connection error. Is the server running?", "error");
    submitBtn.disabled = false;
    submitBtn.innerText = "Update Password";
  }
});

function showStatus(text, type) {
  messageBox.innerText = text;
  messageBox.className = type;
  // Scroll to message if needed
  messageBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Toggle password visibility using event delegation
document.querySelectorAll(".toggle-password").forEach((button) => {
  button.addEventListener("click", function (e) {
    e.preventDefault(); // Prevent any default button behavior
    const targetId = this.getAttribute("data-target");
    const input = document.getElementById(targetId);

    if (input.type === "password") {
      input.type = "text";
      this.textContent = "HIDE";
    } else {
      input.type = "password";
      this.textContent = "SHOW";
    }

    // Return focus to input so user can continue typing
    input.focus();
  });
});
