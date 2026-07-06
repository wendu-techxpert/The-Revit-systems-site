/* ============================================
   ROLE-ACCESS.JS
   Single source of truth for what each role
   can see and do in the admin dashboard.
   Load before app.js and actions.js.
   ============================================ */

const RoleAccess = {
  // ── Sidebar nav items visible per role ───────────────────────────────────
  // data-section values from index.html nav items
  navItems: {
    admin: [
      "dashboard",
      "write",
      "posts",
      "media",
      "analytics",
      "comments",
      "users",
      "categories",
    ],
    editor: [
      "dashboard",
      "write",
      "posts",
      "media",
      "analytics",
      "comments",
      "categories",
    ],
    author: ["dashboard", "write", "posts"],
  },

  // ── Dashboard cards visible per role ─────────────────────────────────────
  dashboardCards: {
    admin: [
      "published-card",
      "drafts-card",
      "scheduled-card",
      "analytics-preview-card",
      "top-posts-preview",
    ],
    editor: [
      "published-card",
      "drafts-card",
      "scheduled-card",
      "analytics-preview-card",
      "top-posts-preview",
    ],
    author: ["published-card", "drafts-card", "scheduled-card"],
    // Authors see their own post counts only, no analytics chart, no top posts
  },

  // ── Sections every role can always reach, regardless of navItems ─────────
  // These are personal-account pages, not restricted content — they were
  // never meant to be gated by the sidebar's canAccess check. Without this,
  // clicking "Profile" (in the user dropdown, not the sidebar) incorrectly
  // triggered "You don't have permission to access that section" for
  // every role, because "profile" was never in any navItems list above.
  universalSections: ["profile", "settings"],

  // ── Whether a role can access a section at all ───────────────────────────
  canAccess: (role, section) => {
    if (RoleAccess.universalSections.includes(section)) return true;
    const allowed = RoleAccess.navItems[role] || [];
    return allowed.includes(section);
  },

  // ── Whether a role can edit a specific post ──────────────────────────────
  canEditPost: (role, post, currentUserId) => {
    if (role === "admin" || role === "editor") return true;
    return post.author_id === currentUserId; // author can only edit their own
  },

  // ── Whether a role can delete a specific post ────────────────────────────
  canDeletePost: (role, post, currentUserId) => {
    if (role === "admin") return true;
    return post.author_id === currentUserId; // editor cannot delete, only admin and own-author
  },

  // ── Whether a role can publish a post ────────────────────────────────────
  canPublishPost: (role, post, currentUserId) => {
    if (role === "admin" || role === "editor") return true;
    return post.author_id === currentUserId;
  },

  // ── Apply sidebar visibility based on role ───────────────────────────────
  applySidebarVisibility: (role) => {
    const allowed = RoleAccess.navItems[role] || [];
    document.querySelectorAll(".nav-item[data-section]").forEach((item) => {
      const section = item.dataset.section;
      if (allowed.includes(section)) {
        item.style.display = "";
      } else {
        item.style.display = "none";
      }
    });
  },

  // ── Apply dashboard card visibility based on role ─────────────────────────
  applyDashboardVisibility: (role) => {
    const visibleCards = RoleAccess.dashboardCards[role] || [];

    // Analytics preview card
    const analyticsCard = document.getElementById("analytics-preview-card");
    if (analyticsCard) {
      analyticsCard.style.display = visibleCards.includes(
        "analytics-preview-card"
      )
        ? ""
        : "none";
    }

    // Top posts preview
    const topPostsCard = document.getElementById("top-posts-preview");
    if (topPostsCard) {
      topPostsCard.style.display = visibleCards.includes("top-posts-preview")
        ? ""
        : "none";
    }

    // For authors, update the stat card labels to say "My Posts" instead of site-wide
    if (role === "author") {
      const publishedLabel = document.querySelector(
        "#published-card .stat-info p"
      );
      const draftsLabel = document.querySelector("#drafts-card .stat-info p");
      const scheduledLabel = document.querySelector(
        "#scheduled-card .stat-info p"
      );
      const totalCard = document.querySelector(".stat-card.total");

      if (publishedLabel) publishedLabel.textContent = "My Published Posts";
      if (draftsLabel) draftsLabel.textContent = "My Draft Posts";
      if (scheduledLabel) scheduledLabel.textContent = "My Scheduled Posts";
      if (totalCard) totalCard.style.display = "none"; // total is site-wide, not useful for author
    }
  },
};
