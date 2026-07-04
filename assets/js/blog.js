/* =============================================
     BLOG PAGE LOGIC
     API: GET /posts?status=published&limit=9&offset=0
     Response shape: { posts: [...], limit, offset, hasMore }
     Post fields: id, title, slug, content, excerpt,
                  featured_image, category, created_at
     ============================================= */

const loader = document.getElementById("loader");
const postsContainer = document.getElementById("postsContainer");
const featuredSlot = document.getElementById("featuredPostSlot");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const searchInput = document.getElementById("blogSearchInput");
const searchBtn = document.getElementById("blogSearchBtn");
const searchLabel = document.getElementById("searchResultsLabel");
const gridLabel = document.getElementById("gridLabel");
const filterBtns = document.querySelectorAll(".blog-filter-btn");

const LIMIT = 9; // 3 cols × 3 rows

// State
let currentCategory = "All";
let currentSearch = "";
let offset = 0;
let hasMore = false;
// Full list of all posts fetched so far (for client-side search/filter)
let allFetchedPosts = [];

const showLoader = () => loader.classList.add("show-face");
const hideLoader = () => loader.classList.remove("show-face");

/* ---- Normalise a raw API post so the rest of the UI can use
         consistent field names regardless of backend naming ---- */
const normalise = (p) => ({
  ...p,
  // The API returns featured_image; map it to cover_image_url so the
  // existing render helpers work without any other changes.
  cover_image_url: p.featured_image || p.cover_image_url || "",
  // category comes back as a string from the LEFT JOIN in postModel.ts
  category: p.category || "",
});

/* ---- Author initials helper ---- */
const initials = (name = "R") =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const imgFallback =
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&q=80";

/* ---- Render the featured hero card (first post) ---- */
const renderFeatured = (post) => {
  if (!post) {
    featuredSlot.innerHTML = "";
    return;
  }
  const img = post.cover_image_url || imgFallback;
  const cat = post.category || "Featured";
  const safe = JSON.stringify(post).replace(/"/g, "&quot;");
  featuredSlot.innerHTML = `
      <div class="blog-featured-card" onclick="openPost(${safe})">
        <img
          class="blog-featured-img"
          src="${img}"
          alt="${post.title}"
          onerror="this.src='${imgFallback}'"
        />
        <div class="blog-featured-body">
          <span class="blog-featured-tag">
            <i class="fas fa-bookmark"></i> ${cat}
          </span>
          <h2 class="blog-featured-title">${post.title}</h2>
          <p class="blog-featured-excerpt">${post.excerpt || ""}</p>
          <div class="blog-featured-meta">
            <div class="blog-featured-author">
              <div class="blog-featured-author-dot">${initials(
                "Revit Info"
              )}</div>
              Revit Info
            </div>
          </div>
          <span class="blog-featured-read">
            Read article <i class="fas fa-arrow-right"></i>
          </span>
        </div>
      </div>`;
};

/* ---- Render a single grid card ---- */
const renderCard = (post) => {
  const div = document.createElement("div");
  div.className = "rv-post-card";
  div.onclick = () => openPost(post);
  const img = post.cover_image_url || imgFallback;
  div.innerHTML = `
      <div class="rv-post-card-img-wrap">
        <img
          src="${img}"
          alt="${post.title}"
          onerror="this.src='${imgFallback}'"
          loading="lazy"
        />
        <span class="rv-post-card-tag">${post.category || "Article"}</span>
      </div>
      <div class="rv-post-card-body">
        <h3 class="rv-post-card-title">${post.title}</h3>
        <p class="rv-post-card-excerpt">${post.excerpt || ""}</p>
        <div class="rv-post-card-footer">
          <div class="rv-post-card-author">
            <div class="rv-post-author-dot">${initials("Revit Info")}</div>
            Revit Info
          </div>
          <div class="rv-post-card-arrow">
            <i class="fas fa-arrow-right"></i>
          </div>
        </div>
      </div>`;
  return div;
};

/* ---- Navigate to blog-post.html ---- */
const openPost = (post) => {
  localStorage.setItem("selectedPost", JSON.stringify(post));
  localStorage.setItem("allPosts", JSON.stringify(allFetchedPosts));
  // Carry the slug in the URL itself (not just localStorage) so the
  // address bar is always specific to this post — refreshing works,
  // and if someone copies straight from the address bar instead of
  // the "Copy link" button, it still lands on the right article.
  const slugParam = post.slug ? `?slug=${encodeURIComponent(post.slug)}` : "";
  window.location.href = `blog-post.html${slugParam}`;
};

/* ---- Client-side search across cached posts ---- */
const searchPosts = (query) => {
  const q = query.trim().toLowerCase();
  if (!q) return allFetchedPosts;
  return allFetchedPosts.filter(
    (p) =>
      (p.title || "").toLowerCase().includes(q) ||
      (p.excerpt || "").toLowerCase().includes(q) ||
      (p.content || "").toLowerCase().includes(q) ||
      (p.category || "").toLowerCase().includes(q)
  );
};

/* ---- Paint the UI from the current cache ---- */
const renderFromCache = () => {
  let results = searchPosts(currentSearch);

  // Category filter is applied client-side when we have all data loaded;
  // when not searching the server already filtered by category.
  if (currentSearch && currentCategory !== "All") {
    results = results.filter(
      (p) => (p.category || "").toLowerCase() === currentCategory.toLowerCase()
    );
  }

  postsContainer.innerHTML = "";
  featuredSlot.innerHTML = "";

  if (results.length === 0) {
    loadMoreBtn.parentElement.style.display = "none";
    postsContainer.innerHTML = `
        <div class="blog-empty-state">
          <i class="fas fa-search"></i>
          <h3>No articles found</h3>
          <p>Try a different search term or browse another category.</p>
        </div>`;
    gridLabel.textContent = "0 results";
    searchLabel.innerHTML = currentSearch
      ? `No results for <strong>"${currentSearch}"</strong>`
      : "";
    searchLabel.classList.toggle("visible", !!currentSearch);
    return;
  }

  // First post → featured hero; the rest → grid
  renderFeatured(results[0]);
  results.slice(1).forEach((p) => postsContainer.appendChild(renderCard(p)));

  // Update labels
  if (currentSearch) {
    searchLabel.innerHTML = `<strong>${results.length}</strong> result${
      results.length !== 1 ? "s" : ""
    } for <strong>"${currentSearch}"</strong>`;
    searchLabel.classList.add("visible");
    gridLabel.textContent = "Search results";
    // Hide load-more when searching (all data already in memory)
    loadMoreBtn.parentElement.style.display = "none";
  } else {
    searchLabel.classList.remove("visible");
    gridLabel.textContent =
      currentCategory === "All" ? "Latest articles" : currentCategory;
    // Show load-more only when there are more server pages
    loadMoreBtn.parentElement.style.display = hasMore ? "flex" : "none";
  }
};

/* ---- Fetch a page of posts from the backend ---- */
const fetchPosts = async (append = false) => {
  if (!append) showLoader();

  try {
    // Build query params natively
    const params = new URLSearchParams({
      status: "published",
      limit: LIMIT,
      offset: offset,
    });

    // The backend postRoutes accepts a `categories` query param for filtering
    if (currentCategory !== "All") {
      params.append("categories", currentCategory);
    }

    // fetch requires the protocol (http://) and manual query string concatenation
    const res = await fetch(`${window.baseURL}/posts?${params.toString()}`);

    // fetch does not throw automatically on HTTP error statuses
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    // API returns { posts, limit, offset, hasMore }
    const data = await res.json();

    const posts = (data.posts || []).map(normalise);
    hasMore = data.hasMore === true;

    if (!append) {
      allFetchedPosts = posts;
      postsContainer.innerHTML = "";
      featuredSlot.innerHTML = "";
    } else {
      // Merge, avoid duplicates by id
      const seen = new Set(allFetchedPosts.map((p) => p.id));
      const fresh = posts.filter((p) => !seen.has(p.id));
      allFetchedPosts = [...allFetchedPosts, ...fresh];
    }

    renderFromCache();
  } catch (err) {
    console.error("Failed to load posts:", err);
    postsContainer.innerHTML = `
        <div class="blog-empty-state">
          <i class="fas fa-wifi"></i>
          <h3>Couldn't load articles</h3>
          <p>Check your connection and try again.</p>
        </div>`;
    featuredSlot.innerHTML = "";
    loadMoreBtn.parentElement.style.display = "none";
  } finally {
    hideLoader();
  }
};

/* ---- Search: debounced input + button ---- */
let searchTimer = null;

const handleSearch = () => {
  currentSearch = searchInput.value.trim();
  // Always search the already-fetched cache first; only re-fetch if empty
  if (allFetchedPosts.length > 0) {
    renderFromCache();
  } else {
    offset = 0;
    fetchPosts();
  }
};

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(handleSearch, 320);
});
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    clearTimeout(searchTimer);
    handleSearch();
  }
});
searchBtn.addEventListener("click", () => {
  clearTimeout(searchTimer);
  handleSearch();
});

/* ---- Category filter — re-fetches from server ---- */
filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.category === currentCategory) return; // no-op
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentCategory = btn.dataset.category;
    currentSearch = "";
    searchInput.value = "";
    offset = 0;
    hasMore = false;
    allFetchedPosts = [];
    fetchPosts();
  });
});

/* ---- Load more — fetches the next page and appends ---- */
loadMoreBtn.addEventListener("click", async () => {
  if (!hasMore) return;
  loadMoreBtn.classList.add("loading");
  loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  offset += LIMIT;
  await fetchPosts(true);
  loadMoreBtn.classList.remove("loading");
  loadMoreBtn.innerHTML =
    '<i class="fas fa-arrow-down"></i> Load more articles';
});

/* ---- Boot ---- */
fetchPosts();
