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
        // this post (refreshable, and correct if manually copied).
        const slugParam = post.slug
          ? `?slug=${encodeURIComponent(post.slug)}`
          : "";
        window.location.href = `builders-digest-post.html${slugParam}`;
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
});
