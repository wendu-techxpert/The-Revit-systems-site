// Get all hero CTA button groups
const heroGroups = document.querySelectorAll(".hero-cta-btn");

heroGroups.forEach((group) => {
  const btnServices = group.querySelector(".hero-btn1");
  const btnQuote = group.querySelector(".hero-btn2");
  const slider = group.querySelector(".slider");

  // Navigate to contact page when first button is clicked
  btnServices.addEventListener("click", () => {
    slider.style.transform = "translateX(0%)";
    setTimeout(() => {
      window.open("./pages/contact.html", "_self");
    }, 500);
  });

  // Navigate to services page when second button is clicked
  btnQuote.addEventListener("click", () => {
    slider.style.transform = "translateX(100%)";
    setTimeout(() => {
      window.open("./pages/services.html", "_self");
    }, 500);
  });
});

document.querySelector(".consult-btn").addEventListener("click", (e) => {
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
});

const scrollBlogRow = document.getElementById("scrollBlogRow");

// Helper: truncate summary to N words
const truncateText = (text, maxWords = 25) => {
  if (!text) return "";
  const words = text.trim().split(/\s+/);
  return words.length > maxWords
    ? words.slice(0, maxWords).join(" ") + "..."
    : text;
};

// Fetch limited posts (e.g., latest 6)
const loadRecentPosts = async (limit = 6, category = "All") => {
  try {
    const res = await axios.get(`${window.baseURL}/blog`, {
      params: { categories: category, limit, offset: 0 },
    });

    const posts = res.data;

    if (posts.length === 0) {
      scrollBlogRow.innerHTML = "<p>No posts available right now.</p>";
      return;
    }

    // Clear existing cards
    scrollBlogRow.innerHTML = "";

    // Create blog cards dynamically
    posts.forEach((post) => {
      const shortExcerpt = truncateText(post.excerpt, 25); // 👈 limit to 25 words

      const article = document.createElement("article");
      article.classList.add("blog-card");

      article.innerHTML = `
        <div class="image-frame">
          <img 
            src="${post.cover_image_url}" 
            alt="${post.title}" 
            loading="lazy" 
          />
        </div>
        <div class="card-content">
          <div class="tag">${post.categories}</div>
          <h2 class="card-heading">${post.title}</h2>
          <p class="summary">${shortExcerpt}</p>
          <a href="#" class="read-more">Read Blog</a>
        </div>
      `;

      article.onclick = () => {
        localStorage.setItem("selectedPost", JSON.stringify(post));
        // Carry the slug in the URL so the address bar is specific to
        // this post (refreshable, and correct if manually copied) —
        // same fix applied to blog.js's openPost().
        const slugParam = post.slug
          ? `?slug=${encodeURIComponent(post.slug)}`
          : "";
        window.location.href = `blog-post.html${slugParam}`;
      };

      scrollBlogRow.appendChild(article);
    });
  } catch (err) {
    console.error("Error loading recent posts:", err);
    scrollBlogRow.innerHTML = "<p>Failed to load posts.</p>";
  }
};

// Call it on load
loadRecentPosts();

const demoInput = document.getElementById("demoInput");
const demoBtn = document.getElementById("demoBtn");

// Replace with your WhatsApp business number (with country code, no "+" or spaces)
const whatsappNumber = "2348061704042"; // Example: Nigeria number

demoBtn.addEventListener("click", () => {
  const userMessage = demoInput.value.trim();

  if (!userMessage) {
    alert("Please describe what you want before requesting a demo.");
    return;
  }

  // Encode message safely for URL
  const encodedMessage = encodeURIComponent(
    `Hello Revit Systems 👋,\n\nI'd like to request a demo.\n\nHere's what I'm looking for:\n"${userMessage}"`
  );

  // WhatsApp API link (works on both mobile & desktop)
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

  // Redirect user to WhatsApp
  window.open(whatsappLink, "_blank");
});

const button = document.getElementById("subscribeBtn");

form.addEventListener("submit", () => {
  button.disabled = true;
  button.innerHTML = `
  <span class="spinner"></span>
  Subscribing...
`;

  setTimeout(() => {
    button.disabled = false;
    button.innerHTML = "Subscribe";
  }, 10000); // 10 seconds
});

const consultBtn = document.getElementById("consultBtn");

consultBtn.addEventListener("click", () => {
  consultBtn.disabled = true;
  consultBtn.innerHTML = `
  <span class="spinner"></span>
  Loading...
`;

  setTimeout(() => {
    consultBtn.disabled = false;
    consultBtn.innerHTML = "consult";
  }, 10000); // 10 seconds
});
