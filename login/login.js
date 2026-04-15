/* ============================================
   BLOG ADMIN DASHBOARD - COMPLETE JAVASCRIPT
   Backend handles pagination - Frontend displays only
   ============================================ */

// ============================================
// GLOBAL STATE & CONFIG
// ============================================
const AppState = {
  currentUser: {
    name: "Admin User",
    email: "admin@blog.com",
    role: "admin",
    avatar: null,
  },
  currentSection: "dashboard",
  posts: [],
  media: [],
  comments: [],
  users: [],
  categories: [],
  tags: [],
  analytics: {
    trafficData: [],
    deviceData: {},
    topPosts: [],
    referrers: [],
  },
  filters: {
    posts: "all",
    media: "all",
    comments: "pending",
    users: "all",
  },
  pagination: {
    posts: { page: 1, totalPages: 1, total: 0 },
    media: { page: 1, totalPages: 1, total: 0 },
    comments: { page: 1, totalPages: 1, total: 0 },
    users: { page: 1, totalPages: 1, total: 0 },
  },
  editor: null,
  charts: {},
  selectedMedia: null,
  editingPostId: null,
  scheduleDate: null,
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
const Utils = {
  formatDate: (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  },

  formatDateTime: (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  },

  formatNumber: (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  },

  slugify: (text) => {
    return text
      .toLowerCase()
      .replace(/[^\w ]+/g, "")
      .replace(/ +/g, "-");
  },

  generateId: () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  showLoader: () => {
    document.getElementById("loader").classList.remove("hidden");
  },

  hideLoader: () => {
    document.getElementById("loader").classList.add("hidden");
  },

  showToast: (message, type = "info") => {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const icons = {
      success: "check-circle",
      error: "exclamation-circle",
      warning: "exclamation-triangle",
      info: "info-circle",
      scheduled: "calendar-alt",
    };

    toast.innerHTML = `
      <i class="fas fa-${icons[type] || "info-circle"}"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 5000);
  },
};

// ============================================
// API SIMULATION (Replace with actual API calls)
// ============================================
const API = {
  // Posts API
  getPosts: async (filter = "all", page = 1, limit = 10) => {
    // Simulate API call - replace with actual fetch
    return new Promise((resolve) => {
      setTimeout(() => {
        let filtered = AppState.posts;
        if (filter !== "all") {
          filtered = AppState.posts.filter((p) => p.status === filter);
        }

        // Backend handles pagination, frontend just displays
        resolve({
          posts: filtered.slice((page - 1) * limit, page * limit),
          pagination: {
            page,
            totalPages: Math.ceil(filtered.length / limit),
            total: filtered.length,
          },
        });
      }, 300);
    });
  },

  createPost: async (postData) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newPost = {
          id: Utils.generateId(),
          ...postData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        AppState.posts.unshift(newPost);
        resolve(newPost);
      }, 500);
    });
  },

  updatePost: async (id, postData) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const index = AppState.posts.findIndex((p) => p.id === id);
        if (index !== -1) {
          AppState.posts[index] = {
            ...AppState.posts[index],
            ...postData,
            updatedAt: new Date().toISOString(),
          };
          resolve(AppState.posts[index]);
        }
      }, 500);
    });
  },

  deletePost: async (id) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        AppState.posts = AppState.posts.filter((p) => p.id !== id);
        resolve({ success: true });
      }, 500);
    });
  },

  // Media API
  getMedia: async (filter = "all", page = 1) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        let filtered = AppState.media;
        if (filter !== "all") {
          filtered = AppState.media.filter((m) => m.type === filter);
        }

        resolve({
          media: filtered,
          pagination: {
            page,
            totalPages: Math.ceil(filtered.length / 20),
            total: filtered.length,
          },
        });
      }, 300);
    });
  },

  uploadMedia: async (file) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newMedia = {
          id: Utils.generateId(),
          name: file.name,
          type: file.type.split("/")[0],
          size: Utils.formatFileSize(file.size),
          url: URL.createObjectURL(file),
          uploadedAt: new Date().toISOString(),
        };
        AppState.media.unshift(newMedia);
        resolve(newMedia);
      }, 1000);
    });
  },

  // Comments API
  getComments: async (filter = "pending", page = 1) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        let filtered = AppState.comments;
        if (filter !== "all") {
          filtered = AppState.comments.filter((c) => c.status === filter);
        }

        resolve({
          comments: filtered,
          pagination: {
            page,
            totalPages: Math.ceil(filtered.length / 10),
            total: filtered.length,
          },
        });
      }, 300);
    });
  },

  updateComment: async (id, status) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const index = AppState.comments.findIndex((c) => c.id === id);
        if (index !== -1) {
          AppState.comments[index].status = status;
          resolve(AppState.comments[index]);
        }
      }, 300);
    });
  },

  // Users API
  getUsers: async (filter = "all", page = 1) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        let filtered = AppState.users;
        if (filter !== "all") {
          filtered = AppState.users.filter(
            (u) => u.role === filter || u.status === filter
          );
        }

        resolve({
          users: filtered,
          pagination: {
            page,
            totalPages: Math.ceil(filtered.length / 10),
            total: filtered.length,
          },
        });
      }, 300);
    });
  },

  inviteUser: async (email, role, message) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newUser = {
          id: Utils.generateId(),
          email,
          role,
          status: "pending",
          invitedAt: new Date().toISOString(),
        };
        AppState.users.push(newUser);
        resolve(newUser);
      }, 500);
    });
  },

  // Categories & Tags API
  getCategories: async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(AppState.categories);
      }, 300);
    });
  },

  saveCategory: async (categoryData) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (categoryData.id) {
          const index = AppState.categories.findIndex(
            (c) => c.id === categoryData.id
          );
          AppState.categories[index] = {
            ...AppState.categories[index],
            ...categoryData,
          };
          resolve(AppState.categories[index]);
        } else {
          const newCategory = {
            id: Utils.generateId(),
            ...categoryData,
            count: 0,
          };
          AppState.categories.push(newCategory);
          resolve(newCategory);
        }
      }, 300);
    });
  },

  deleteCategory: async (id) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        AppState.categories = AppState.categories.filter((c) => c.id !== id);
        resolve({ success: true });
      }, 300);
    });
  },

  // Analytics API
  getAnalytics: async (period = 30) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          trafficData: generateTrafficData(period),
          deviceData: {
            labels: ["Desktop", "Mobile", "Tablet"],
            data: [55, 35, 10],
          },
          topPosts: AppState.posts.slice(0, 10).map((p, i) => ({
            ...p,
            rank: i + 1,
            uniqueViews: Math.floor(p.views * 0.7),
            avgTime: Math.floor(Math.random() * 300) + 60,
            bounceRate: Math.floor(Math.random() * 40) + 20,
          })),
          referrers: [
            { name: "Google", count: 15420, icon: "google" },
            { name: "Direct", count: 8930, icon: "link" },
            { name: "Twitter", count: 5420, icon: "twitter" },
            { name: "Facebook", count: 3890, icon: "facebook" },
            { name: "LinkedIn", count: 2150, icon: "linkedin" },
          ],
        });
      }, 500);
    });
  },
};

// ============================================
// MOCK DATA GENERATION
// ============================================
function generateMockData() {
  // Generate posts
  const categories = ["Technology", "Design", "Tutorial", "News", "Lifestyle"];
  const statuses = ["published", "draft", "scheduled"];

  for (let i = 1; i <= 25; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));

    AppState.posts.push({
      id: Utils.generateId(),
      title: `Blog Post ${i}: ${
        [
          "Getting Started",
          "Advanced Tips",
          "Best Practices",
          "Complete Guide",
          "Tutorial",
        ][Math.floor(Math.random() * 5)]
      } ${
        ["with React", "for Beginners", "in 2024", "Explained", "Deep Dive"][
          Math.floor(Math.random() * 5)
        ]
      }`,
      slug: `blog-post-${i}`,
      excerpt: `This is a brief excerpt for blog post ${i}. It provides a summary of what readers can expect.`,
      content: "<p>Full blog post content here...</p>",
      category: categories[Math.floor(Math.random() * categories.length)],
      tags: ["javascript", "webdev", "tutorial"],
      status: status,
      views: Math.floor(Math.random() * 10000),
      createdAt: date.toISOString(),
      updatedAt: date.toISOString(),
      scheduledAt:
        status === "scheduled"
          ? new Date(
              Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000
            ).toISOString()
          : null,
      featuredImage: null,
    });
  }

  // Generate media
  const mediaTypes = ["image", "video", "document"];
  for (let i = 1; i <= 20; i++) {
    const type = mediaTypes[Math.floor(Math.random() * mediaTypes.length)];
    AppState.media.push({
      id: Utils.generateId(),
      name: `media-file-${i}.${
        type === "image" ? "jpg" : type === "video" ? "mp4" : "pdf"
      }`,
      type: type,
      size: `${Math.floor(Math.random() * 10) + 1} MB`,
      url: `https://via.placeholder.com/150?text=Media+${i}`,
      uploadedAt: new Date(
        Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });
  }

  // Generate comments
  for (let i = 1; i <= 15; i++) {
    AppState.comments.push({
      id: Utils.generateId(),
      author: `User ${i}`,
      email: `user${i}@example.com`,
      text: `This is a sample comment ${i}. Great article! Thanks for sharing.`,
      postTitle: `Blog Post ${Math.floor(Math.random() * 25) + 1}`,
      status: Math.random() > 0.5 ? "pending" : "approved",
      createdAt: new Date(
        Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });
  }

  // Generate users
  const roles = ["admin", "editor", "author"];
  for (let i = 1; i <= 10; i++) {
    AppState.users.push({
      id: Utils.generateId(),
      name: `User ${i}`,
      email: `user${i}@blog.com`,
      role: roles[Math.floor(Math.random() * roles.length)],
      status: "active",
      posts: Math.floor(Math.random() * 20),
      joinedAt: new Date(
        Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000
      ).toISOString(),
      lastActive: new Date(
        Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });
  }

  // Generate categories
  categories.forEach((cat, index) => {
    AppState.categories.push({
      id: Utils.generateId(),
      name: cat,
      slug: Utils.slugify(cat),
      description: `All posts related to ${cat}`,
      count: Math.floor(Math.random() * 20),
      parent: null,
    });
  });

  // Generate tags
  const tagNames = [
    "javascript",
    "react",
    "css",
    "html",
    "nodejs",
    "python",
    "design",
    "ui",
    "ux",
    "webdev",
    "frontend",
    "backend",
    "database",
    "api",
    "tutorial",
  ];
  tagNames.forEach((tag) => {
    AppState.tags.push({
      id: Utils.generateId(),
      name: tag,
      count: Math.floor(Math.random() * 15),
    });
  });
}

function generateTrafficData(days) {
  const data = [];
  const labels = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    labels.push(
      date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    );
    data.push(Math.floor(Math.random() * 1000) + 500);
  }

  return { labels, data };
}

// ============================================
// UI RENDERERS
// ============================================
const Renderers = {
  // Dashboard Stats
  updateDashboardStats: () => {
    const published = AppState.posts.filter(
      (p) => p.status === "published"
    ).length;
    const drafts = AppState.posts.filter((p) => p.status === "draft").length;
    const scheduled = AppState.posts.filter(
      (p) => p.status === "scheduled"
    ).length;

    document.getElementById("published-count").textContent = published;
    document.getElementById("drafts-count").textContent = drafts;
    document.getElementById("scheduled-count").textContent = scheduled;
    document.getElementById("total-count").textContent = AppState.posts.length;
  },

  // Recent Posts Table
  renderRecentPosts: () => {
    const tbody = document.getElementById("recent-posts-table");
    const recent = AppState.posts.slice(0, 5);

    tbody.innerHTML = recent
      .map(
        (post) => `
      <tr>
        <td>${post.title}</td>
        <td>${post.category}</td>
        <td><span class="status-badge ${post.status}">${post.status}</span></td>
        <td>${Utils.formatDate(post.createdAt)}</td>
        <td>${Utils.formatNumber(post.views)}</td>
        <td>
          <div class="action-btns">
            <button class="action-btn edit" onclick="Actions.editPost('${
              post.id
            }')">
              <i class="fas fa-edit"></i>
            </button>
            <button class="action-btn delete" onclick="Actions.deletePost('${
              post.id
            }')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `
      )
      .join("");
  },

  // All Posts Table (Backend handles pagination)
  renderPostsTable: async () => {
    const tbody = document.getElementById("all-posts-table");
    Utils.showLoader();

    try {
      const response = await API.getPosts(
        AppState.filters.posts,
        AppState.pagination.posts.page
      );

      tbody.innerHTML = response.posts
        .map(
          (post) => `
        <tr>
          <td>${post.title}</td>
          <td>${post.category}</td>
          <td><span class="status-badge ${post.status}">${
            post.status
          }</span></td>
          <td>${
            post.status === "scheduled"
              ? Utils.formatDateTime(post.scheduledAt)
              : Utils.formatDate(post.createdAt)
          }</td>
          <td>${Utils.formatNumber(post.views)}</td>
          <td>
            <div class="action-btns">
              ${
                post.status === "draft"
                  ? `
                <button class="action-btn publish" onclick="Actions.publishPost('${post.id}')" title="Publish">
                  <i class="fas fa-check"></i>
                </button>
              `
                  : ""
              }
              ${
                post.status === "scheduled"
                  ? `
                <button class="action-btn schedule" onclick="Actions.editSchedule('${post.id}')" title="Edit Schedule">
                  <i class="fas fa-calendar"></i>
                </button>
              `
                  : ""
              }
              <button class="action-btn edit" onclick="Actions.editPost('${
                post.id
              }')" title="Edit">
                <i class="fas fa-edit"></i>
              </button>
              <button class="action-btn delete" onclick="Actions.deletePost('${
                post.id
              }')" title="Delete">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `
        )
        .join("");

      // Update pagination info from backend
      AppState.pagination.posts = response.pagination;

      // Render pagination controls (just page info since backend handles it)
      Renderers.renderPagination(
        "posts-pagination",
        response.pagination,
        (page) => {
          AppState.pagination.posts.page = page;
          Renderers.renderPostsTable();
        }
      );
    } catch (error) {
      Utils.showToast("Failed to load posts", "error");
    } finally {
      Utils.hideLoader();
    }
  },

  // Media Grid
  renderMediaGrid: async () => {
    const grid = document.getElementById("media-grid");
    const list = document.getElementById("media-list-body");
    Utils.showLoader();

    try {
      const response = await API.getMedia(AppState.filters.media);

      // Grid View
      grid.innerHTML = response.media
        .map(
          (item) => `
        <div class="media-item" data-id="${item.id}" onclick="Actions.selectMedia('${item.id}')">
          <img src="${item.url}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/150'">
          <div class="media-item-overlay">
            <div class="media-item-name">${item.name}</div>
          </div>
        </div>
      `
        )
        .join("");

      // List View
      list.innerHTML = response.media
        .map(
          (item) => `
        <tr>
          <td><img src="${
            item.url
          }" alt="" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;"></td>
          <td>${item.name}</td>
          <td>${item.type}</td>
          <td>${item.size}</td>
          <td>${Utils.formatDate(item.uploadedAt)}</td>
          <td>
            <div class="action-btns">
              <button class="action-btn edit" onclick="Actions.viewMedia('${
                item.id
              }')">
                <i class="fas fa-eye"></i>
              </button>
              <button class="action-btn delete" onclick="Actions.deleteMedia('${
                item.id
              }')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `
        )
        .join("");

      AppState.pagination.media = response.pagination;
    } catch (error) {
      Utils.showToast("Failed to load media", "error");
    } finally {
      Utils.hideLoader();
    }
  },

  // Comments List
  renderComments: async () => {
    const container = document.getElementById("comments-list");
    Utils.showLoader();

    try {
      const response = await API.getComments(AppState.filters.comments);

      container.innerHTML = response.comments
        .map(
          (comment) => `
        <div class="comment-item">
          <input type="checkbox" class="comment-checkbox" data-id="${
            comment.id
          }">
          <div class="comment-avatar">
            <i class="fas fa-user"></i>
          </div>
          <div class="comment-content">
            <div class="comment-header">
              <div>
                <span class="comment-author">${comment.author}</span>
                <span class="comment-meta">${
                  comment.email
                } • ${Utils.formatDateTime(comment.createdAt)}</span>
              </div>
              <span class="status-badge ${comment.status}">${
            comment.status
          }</span>
            </div>
            <div class="comment-text">${comment.text}</div>
            <div class="comment-post">on <strong>${
              comment.postTitle
            }</strong></div>
            <div class="comment-actions">
              ${
                comment.status !== "approved"
                  ? `
                <button class="approve-btn" onclick="Actions.approveComment('${comment.id}')">
                  <i class="fas fa-check"></i> Approve
                </button>
              `
                  : ""
              }
              <button class="reply-btn" onclick="Actions.replyComment('${
                comment.id
              }')">
                <i class="fas fa-reply"></i> Reply
              </button>
              <button class="spam-btn" onclick="Actions.markSpam('${
                comment.id
              }')">
                <i class="fas fa-ban"></i> Spam
              </button>
            </div>
          </div>
        </div>
      `
        )
        .join("");

      // Update pending count
      const pendingCount = AppState.comments.filter(
        (c) => c.status === "pending"
      ).length;
      document.getElementById("pending-count").textContent = pendingCount;
      document.getElementById("comments-badge").textContent = pendingCount;

      AppState.pagination.comments = response.pagination;
      Renderers.renderPagination(
        "comments-pagination",
        response.pagination,
        (page) => {
          AppState.pagination.comments.page = page;
          Renderers.renderComments();
        }
      );
    } catch (error) {
      Utils.showToast("Failed to load comments", "error");
    } finally {
      Utils.hideLoader();
    }
  },

  // Users Table
  renderUsers: async () => {
    const tbody = document.getElementById("users-table-body");
    Utils.showLoader();

    try {
      const response = await API.getUsers(AppState.filters.users);

      tbody.innerHTML = response.users
        .map(
          (user) => `
        <tr>
          <td><input type="checkbox" value="${user.id}"></td>
          <td>
            <div class="user-cell">
              <div class="user-cell-avatar">
                <i class="fas fa-user"></i>
              </div>
              <div class="user-cell-info">
                <span class="user-cell-name">${user.name}</span>
                <span class="user-cell-email">${user.email}</span>
              </div>
            </div>
          </td>
          <td><span class="role-badge ${user.role}">${user.role}</span></td>
          <td><span class="status-badge ${user.status}">${
            user.status
          }</span></td>
          <td>${user.posts}</td>
          <td>${Utils.formatDate(user.joinedAt)}</td>
          <td>${Utils.formatDate(user.lastActive)}</td>
          <td>
            <div class="action-btns">
              <button class="action-btn edit" onclick="Actions.editUser('${
                user.id
              }')">
                <i class="fas fa-edit"></i>
              </button>
              <button class="action-btn delete" onclick="Actions.deleteUser('${
                user.id
              }')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `
        )
        .join("");

      AppState.pagination.users = response.pagination;
      Renderers.renderPagination(
        "users-pagination",
        response.pagination,
        (page) => {
          AppState.pagination.users.page = page;
          Renderers.renderUsers();
        }
      );
    } catch (error) {
      Utils.showToast("Failed to load users", "error");
    } finally {
      Utils.hideLoader();
    }
  },

  // Categories List
  renderCategories: async () => {
    const container = document.getElementById("categories-list");

    try {
      const categories = await API.getCategories();

      container.innerHTML = categories
        .map(
          (cat) => `
        <div class="taxonomy-item">
          <div class="taxonomy-info">
            <span class="taxonomy-name">
              <i class="fas fa-folder"></i> ${cat.name}
            </span>
            <span class="taxonomy-count">${cat.count} posts</span>
          </div>
          <div class="taxonomy-actions">
            <button onclick="Actions.editCategory('${cat.id}')" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="Actions.deleteCategory('${cat.id}')" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `
        )
        .join("");
    } catch (error) {
      Utils.showToast("Failed to load categories", "error");
    }
  },

  // Tags Cloud
  renderTags: () => {
    const container = document.getElementById("tags-cloud");

    container.innerHTML = AppState.tags
      .map(
        (tag) => `
      <span class="tag-item">
        ${tag.name} (${tag.count})
        <button class="remove-tag" onclick="Actions.deleteTag('${tag.id}')" title="Remove tag">
          <i class="fas fa-times"></i>
        </button>
      </span>
    `
      )
      .join("");
  },

  // Analytics Charts
  renderAnalytics: async () => {
    Utils.showLoader();

    try {
      const period =
        document.getElementById("main-analytics-period")?.value || 30;
      const data = await API.getAnalytics(period);

      // Update stats
      const totalViews = data.trafficData.data.reduce((a, b) => a + b, 0);
      document.getElementById("analytics-total-views").textContent =
        Utils.formatNumber(totalViews);
      document.getElementById("analytics-unique-visitors").textContent =
        Utils.formatNumber(Math.floor(totalViews * 0.7));
      document.getElementById("analytics-avg-time").textContent = "3:45";
      document.getElementById("analytics-bounce-rate").textContent = "42%";

      // Traffic Chart
      const trafficCtx = document.getElementById("main-traffic-chart");
      if (trafficCtx) {
        if (AppState.charts.traffic) AppState.charts.traffic.destroy();

        AppState.charts.traffic = new Chart(trafficCtx, {
          type: "line",
          data: {
            labels: data.trafficData.labels,
            datasets: [
              {
                label: "Page Views",
                data: data.trafficData.data,
                borderColor: "#d17609",
                backgroundColor: "rgba(209, 118, 9, 0.1)",
                fill: true,
                tension: 0.4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
            },
            scales: {
              y: { beginAtZero: true },
            },
          },
        });
      }

      // Device Chart
      const deviceCtx = document.getElementById("device-chart");
      if (deviceCtx) {
        if (AppState.charts.device) AppState.charts.device.destroy();

        AppState.charts.device = new Chart(deviceCtx, {
          type: "doughnut",
          data: {
            labels: data.deviceData.labels,
            datasets: [
              {
                data: data.deviceData.data,
                backgroundColor: ["#d17609", "#2196f3", "#4caf50"],
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
          },
        });
      }

      // Top Posts Table
      const topPostsBody = document.getElementById("analytics-top-posts");
      if (topPostsBody) {
        topPostsBody.innerHTML = data.topPosts
          .map(
            (post, index) => `
          <tr>
            <td>#${index + 1}</td>
            <td>${post.title}</td>
            <td>${Utils.formatNumber(post.views)}</td>
            <td>${Utils.formatNumber(post.uniqueViews)}</td>
            <td>${Math.floor(post.avgTime / 60)}:${(post.avgTime % 60)
              .toString()
              .padStart(2, "0")}</td>
            <td>${post.bounceRate}%</td>
          </tr>
        `
          )
          .join("");
      }

      // Referrers
      const referrersContainer = document.getElementById("referrers-list");
      if (referrersContainer) {
        const maxCount = Math.max(...data.referrers.map((r) => r.count));
        referrersContainer.innerHTML = data.referrers
          .map(
            (ref) => `
          <div class="referrer-item">
            <div class="referrer-info">
              <div class="referrer-icon">
                <i class="fab fa-${ref.icon}"></i>
              </div>
              <span class="referrer-name">${ref.name}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div class="referrer-bar">
                <div class="referrer-bar-fill" style="width: ${
                  (ref.count / maxCount) * 100
                }%"></div>
              </div>
              <span class="referrer-count">${Utils.formatNumber(
                ref.count
              )}</span>
            </div>
          </div>
        `
          )
          .join("");
      }

      // Dashboard preview chart
      const previewCtx = document.getElementById("traffic-chart");
      if (previewCtx) {
        if (AppState.charts.preview) AppState.charts.preview.destroy();

        AppState.charts.preview = new Chart(previewCtx, {
          type: "line",
          data: {
            labels: data.trafficData.labels.slice(-7),
            datasets: [
              {
                label: "Views",
                data: data.trafficData.data.slice(-7),
                borderColor: "#d17609",
                backgroundColor: "rgba(209, 118, 9, 0.1)",
                fill: true,
                tension: 0.4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } },
          },
        });

        // Update summary
        const weekViews = data.trafficData.data
          .slice(-7)
          .reduce((a, b) => a + b, 0);
        document.getElementById("total-views").textContent =
          Utils.formatNumber(weekViews);
        document.getElementById("unique-visitors").textContent =
          Utils.formatNumber(Math.floor(weekViews * 0.7));
      }
    } catch (error) {
      Utils.showToast("Failed to load analytics", "error");
    } finally {
      Utils.hideLoader();
    }
  },

  // Top Posts Preview
  renderTopPosts: () => {
    const container = document.getElementById("top-posts-list");
    const sorted = [...AppState.posts]
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    container.innerHTML = sorted
      .map(
        (post, index) => `
      <div class="top-post-item">
        <div class="top-post-rank ${index < 3 ? "top-3" : ""}">${
          index + 1
        }</div>
        <div class="top-post-info">
          <div class="top-post-title">${post.title}</div>
          <div class="top-post-meta">${post.category} • ${Utils.formatDate(
          post.createdAt
        )}</div>
        </div>
        <div class="top-post-views">
          <div class="top-post-views-count">${Utils.formatNumber(
            post.views
          )}</div>
          <div class="top-post-views-label">views</div>
        </div>
      </div>
    `
      )
      .join("");
  },

  // Pagination Renderer (Displays backend pagination info only)
  renderPagination: (containerId, pagination, onPageChange) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Since backend handles pagination, we just show page info and simple controls
    // Actual page data comes from backend on each request
    container.innerHTML = `
      <button class="page-btn" onclick="window.changePage(${
        pagination.page - 1
      })" ${pagination.page === 1 ? "disabled" : ""}>
        <i class="fas fa-chevron-left"></i>
      </button>
      <span class="page-info">Page ${pagination.page} of ${
      pagination.totalPages
    }</span>
      <button class="page-btn" onclick="window.changePage(${
        pagination.page + 1
      })" ${pagination.page >= pagination.totalPages ? "disabled" : ""}>
        <i class="fas fa-chevron-right"></i>
      </button>
    `;

    // Store callback for pagination buttons
    window.currentPageCallback = onPageChange;
  },

  // Category Options for Select
  renderCategoryOptions: async () => {
    const selects = ["blog-category", "edit-category", "category-parent"];
    const categories = await API.getCategories();

    selects.forEach((selectId) => {
      const select = document.getElementById(selectId);
      if (!select) return;

      const currentValue = select.value;
      const placeholder =
        selectId === "category-parent"
          ? '<option value="">None (Top Level)</option>'
          : '<option value="">Select Category</option>';

      select.innerHTML =
        placeholder +
        categories
          .map(
            (cat) => `
        <option value="${cat.slug}">${cat.name}</option>
      `
          )
          .join("");

      if (currentValue) select.value = currentValue;
    });
  },

  // Notifications
  renderNotifications: () => {
    const list = document.getElementById("notification-list");
    const notifications = [
      {
        icon: "comment",
        text: 'New comment on "Getting Started with React"',
        time: "5 min ago",
        unread: true,
      },
      {
        icon: "user",
        text: "New user registration: john@example.com",
        time: "1 hour ago",
        unread: true,
      },
      {
        icon: "calendar",
        text: "Post scheduled for tomorrow",
        time: "2 hours ago",
        unread: true,
      },
      {
        icon: "exclamation",
        text: "System update completed",
        time: "1 day ago",
        unread: false,
      },
    ];

    list.innerHTML = notifications
      .map(
        (n) => `
      <div class="notification-item ${n.unread ? "unread" : ""}">
        <i class="fas fa-${n.icon}"></i>
        <div class="notification-content">
          <p>${n.text}</p>
          <span class="time">${n.time}</span>
        </div>
      </div>
    `
      )
      .join("");

    document.getElementById("notification-badge").textContent =
      notifications.filter((n) => n.unread).length;
  },
};

// ============================================
// ACTIONS
// ============================================
const Actions = {
  // Navigation
  showSection: (sectionName) => {
    // Hide all sections
    document
      .querySelectorAll(".section")
      .forEach((s) => s.classList.remove("active"));
    document
      .querySelectorAll(".nav-item")
      .forEach((n) => n.classList.remove("active"));

    // Show target section
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) targetSection.classList.add("active");

    // Update nav
    const navItem = document.querySelector(`[data-section="${sectionName}"]`);
    if (navItem) navItem.classList.add("active");

    AppState.currentSection = sectionName;

    // Close dropdowns
    document.getElementById("user-dropdown").classList.add("hidden");
    document.getElementById("notification-dropdown").classList.add("hidden");

    // Load section data
    Actions.loadSectionData(sectionName);
  },

  loadSectionData: (sectionName) => {
    switch (sectionName) {
      case "dashboard":
        Renderers.updateDashboardStats();
        Renderers.renderRecentPosts();
        Renderers.renderTopPosts();
        Renderers.renderAnalytics();
        break;
      case "posts":
        Renderers.renderPostsTable();
        break;
      case "media":
        Renderers.renderMediaGrid();
        break;
      case "analytics":
        Renderers.renderAnalytics();
        break;
      case "comments":
        Renderers.renderComments();
        break;
      case "users":
        Renderers.renderUsers();
        break;
      case "categories":
        Renderers.renderCategories();
        Renderers.renderTags();
        break;
      case "write":
        Renderers.renderCategoryOptions();
        break;
    }
  },

  // Post Actions
  saveDraft: async () => {
    const formData = Actions.getBlogFormData();
    if (!formData.title) {
      Utils.showToast("Please enter a title", "warning");
      return;
    }

    Utils.showLoader();
    try {
      await API.createPost({ ...formData, status: "draft" });
      Utils.showToast("Draft saved successfully", "success");
      Actions.resetBlogForm();
      Actions.showSection("posts");
    } catch (error) {
      Utils.showToast("Failed to save draft", "error");
    } finally {
      Utils.hideLoader();
    }
  },

  schedulePost: () => {
    const formData = Actions.getBlogFormData();
    if (!formData.title) {
      Utils.showToast("Please enter a title", "warning");
      return;
    }

    document.getElementById("schedule-preview-title").textContent =
      formData.title;
    document.getElementById("schedule-preview-category").textContent =
      formData.category || "Uncategorized";
    document.getElementById("schedule-post-modal").classList.remove("hidden");
  },

  confirmSchedule: async () => {
    const scheduleDate = document.getElementById("schedule-date").value;
    if (!scheduleDate) {
      Utils.showToast("Please select a date and time", "warning");
      return;
    }

    const formData = Actions.getBlogFormData();
    Utils.showLoader();

    try {
      await API.createPost({
        ...formData,
        status: "scheduled",
        scheduledAt: scheduleDate,
      });
      Utils.showToast("Post scheduled successfully", "scheduled");
      document.getElementById("schedule-post-modal").classList.add("hidden");
      Actions.resetBlogForm();
      Actions.showSection("posts");
    } catch (error) {
      Utils.showToast("Failed to schedule post", "error");
    } finally {
      Utils.hideLoader();
    }
  },

  publishPost: async (postId) => {
    if (postId) {
      // Publish existing draft
      Utils.showLoader();
      try {
        await API.updatePost(postId, { status: "published" });
        Utils.showToast("Post published successfully", "success");
        Renderers.renderPostsTable();
        Renderers.updateDashboardStats();
      } catch (error) {
        Utils.showToast("Failed to publish post", "error");
      } finally {
        Utils.hideLoader();
      }
    } else {
      // Publish new post
      const formData = Actions.getBlogFormData();
      if (!formData.title || !formData.content) {
        Utils.showToast("Please fill in all required fields", "warning");
        return;
      }

      Utils.showLoader();
      try {
        await API.createPost({ ...formData, status: "published" });
        Utils.showToast("Post published successfully", "success");
        Actions.resetBlogForm();
        Actions.showSection("posts");
      } catch (error) {
        Utils.showToast("Failed to publish post", "error");
      } finally {
        Utils.hideLoader();
      }
    }
  },

  editPost: (id) => {
    const post = AppState.posts.find((p) => p.id === id);
    if (!post) return;

    AppState.editingPostId = id;
    document.getElementById("edit-id").value = id;
    document.getElementById("edit-title").value = post.title;
    document.getElementById("edit-slug").value = post.slug;
    document.getElementById("edit-excerpt").value = post.excerpt;
    document.getElementById("edit-content").value = post.content;
    document.getElementById("edit-category").value = post.category;
    document.getElementById("edit-status-display").textContent = post.status;
    document.getElementById(
      "edit-status-display"
    ).className = `status-display ${post.status}`;

    Renderers.renderCategoryOptions();
    document.getElementById("edit-modal").classList.remove("hidden");
  },

  saveEdit: async (status) => {
    const id = document.getElementById("edit-id").value;
    const postData = {
      title: document.getElementById("edit-title").value,
      slug: document.getElementById("edit-slug").value,
      excerpt: document.getElementById("edit-excerpt").value,
      content: document.getElementById("edit-content").value,
      category: document.getElementById("edit-category").value,
      status: status,
    };

    Utils.showLoader();
    try {
      await API.updatePost(id, postData);
      Utils.showToast("Post updated successfully", "success");
      document.getElementById("edit-modal").classList.add("hidden");
      Renderers.renderPostsTable();
      Renderers.updateDashboardStats();
    } catch (error) {
      Utils.showToast("Failed to update post", "error");
    } finally {
      Utils.hideLoader();
    }
  },

  deletePost: (id) => {
    AppState.editingPostId = id;
    document.getElementById("delete-id").value = id;
    document.getElementById("delete-modal").classList.remove("hidden");
  },

  confirmDelete: async () => {
    const id = document.getElementById("delete-id").value;
    Utils.showLoader();

    try {
      await API.deletePost(id);
      Utils.showToast("Post deleted successfully", "success");
      document.getElementById("delete-modal").classList.add("hidden");
      Renderers.renderPostsTable();
      Renderers.updateDashboardStats();
    } catch (error) {
      Utils.showToast("Failed to delete post", "error");
    } finally {
      Utils.hideLoader();
    }
  },

  editSchedule: (id) => {
    const post = AppState.posts.find((p) => p.id === id);
    if (!post) return;

    document.getElementById("schedule-preview-title").textContent = post.title;
    document.getElementById("schedule-preview-category").textContent =
      post.category;
    document.getElementById("schedule-date").value = post.scheduledAt
      ? post.scheduledAt.slice(0, 16)
      : "";
    document.getElementById("schedule-post-modal").classList.remove("hidden");

    // Override confirm button to update instead of create
    document.getElementById("confirm-schedule-btn").onclick = async () => {
      const newDate = document.getElementById("schedule-date").value;
      if (!newDate) return;

      Utils.showLoader();
      try {
        await API.updatePost(id, { scheduledAt: newDate });
        Utils.showToast("Schedule updated successfully", "success");
        document.getElementById("schedule-post-modal").classList.add("hidden");
        Renderers.renderPostsTable();
      } catch (error) {
        Utils.showToast("Failed to update schedule", "error");
      } finally {
        Utils.hideLoader();
      }
    };
  },

  // Media Actions
  selectMedia: (id) => {
    AppState.selectedMedia = id;
    document.querySelectorAll(".media-item").forEach((item) => {
      item.classList.toggle("selected", item.dataset.id === id);
    });

    const selectBtn = document.getElementById("select-media-btn");
    if (selectBtn) selectBtn.disabled = false;
  },

  viewMedia: (id) => {
    const media = AppState.media.find((m) => m.id === id);
    if (media) {
      window.open(media.url, "_blank");
    }
  },

  deleteMedia: async (id) => {
    if (!confirm("Are you sure you want to delete this media?")) return;

    AppState.media = AppState.media.filter((m) => m.id !== id);
    Renderers.renderMediaGrid();
    Utils.showToast("Media deleted", "success");
  },

  openMediaLibrary: (purpose) => {
    Renderers.renderMediaGrid();
    document.getElementById("media-library-modal").classList.remove("hidden");
  },

  // Comment Actions
  approveComment: async (id) => {
    Utils.showLoader();
    try {
      await API.updateComment(id, "approved");
      Utils.showToast("Comment approved", "success");
      Renderers.renderComments();
    } catch (error) {
      Utils.showToast("Failed to approve comment", "error");
    } finally {
      Utils.hideLoader();
    }
  },

  replyComment: (id) => {
    const comment = AppState.comments.find((c) => c.id === id);
    const reply = prompt(`Reply to ${comment.author}:`);
    if (reply) {
      Utils.showToast("Reply posted", "success");
    }
  },

  markSpam: async (id) => {
    Utils.showLoader();
    try {
      await API.updateComment(id, "spam");
      Utils.showToast("Comment marked as spam", "warning");
      Renderers.renderComments();
    } catch (error) {
      Utils.showToast("Failed to mark as spam", "error");
    } finally {
      Utils.hideLoader();
    }
  },

  // User Actions
  inviteUser: async () => {
    const email = document.getElementById("invite-email").value;
    const role = document.getElementById("invite-role").value;
    const message = document.getElementById("invite-message").value;

    if (!email) {
      Utils.showToast("Please enter an email", "warning");
      return;
    }

    Utils.showLoader();
    try {
      await API.inviteUser(email, role, message);
      Utils.showToast("Invitation sent successfully", "success");
      document.getElementById("invite-user-modal").classList.add("hidden");
      document.getElementById("invite-form").reset();
      Renderers.renderUsers();
    } catch (error) {
      Utils.showToast("Failed to send invitation", "error");
    } finally {
      Utils.hideLoader();
    }
  },

  editUser: (id) => {
    Utils.showToast("User edit functionality coming soon", "info");
  },

  deleteUser: (id) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    AppState.users = AppState.users.filter((u) => u.id !== id);
    Renderers.renderUsers();
    Utils.showToast("User deleted", "success");
  },

  // Category Actions
  addCategory: () => {
    document.getElementById("category-modal-title").textContent =
      "Add Category";
    document.getElementById("category-form").reset();
    document.getElementById("edit-category-id").value = "";
    document.getElementById("delete-category-btn").classList.add("hidden");
    Renderers.renderCategoryOptions();
    document.getElementById("category-modal").classList.remove("hidden");
  },

  editCategory: (id) => {
    const cat = AppState.categories.find((c) => c.id === id);
    if (!cat) return;

    document.getElementById("category-modal-title").textContent =
      "Edit Category";
    document.getElementById("edit-category-id").value = cat.id;
    document.getElementById("category-name").value = cat.name;
    document.getElementById("category-slug").value = cat.slug;
    document.getElementById("category-description").value =
      cat.description || "";
    document.getElementById("category-parent").value = cat.parent || "";
    document.getElementById("delete-category-btn").classList.remove("hidden");
    Renderers.renderCategoryOptions();
    document.getElementById("category-modal").classList.remove("hidden");
  },

  saveCategory: async () => {
    const id = document.getElementById("edit-category-id").value;
    const categoryData = {
      id: id || null,
      name: document.getElementById("category-name").value,
      slug: document.getElementById("category-slug").value,
      description: document.getElementById("category-description").value,
      parent: document.getElementById("category-parent").value || null,
    };

    if (!categoryData.name) {
      Utils.showToast("Please enter a category name", "warning");
      return;
    }

    Utils.showLoader();
    try {
      await API.saveCategory(categoryData);
      Utils.showToast("Category saved successfully", "success");
      document.getElementById("category-modal").classList.add("hidden");
      Renderers.renderCategories();
      Renderers.renderCategoryOptions();
    } catch (error) {
      Utils.showToast("Failed to save category", "error");
    } finally {
      Utils.hideLoader();
    }
  },

  deleteCategory: async () => {
    const id = document.getElementById("edit-category-id").value;
    if (!confirm("Are you sure you want to delete this category?")) return;

    Utils.showLoader();
    try {
      await API.deleteCategory(id);
      Utils.showToast("Category deleted", "success");
      document.getElementById("category-modal").classList.add("hidden");
      Renderers.renderCategories();
    } catch (error) {
      Utils.showToast("Failed to delete category", "error");
    } finally {
      Utils.hideLoader();
    }
  },

  addTag: () => {
    const input = document.getElementById("new-tag-input");
    const name = input.value.trim();
    if (!name) return;

    AppState.tags.push({
      id: Utils.generateId(),
      name,
      count: 0,
    });

    input.value = "";
    Renderers.renderTags();
    Utils.showToast("Tag added", "success");
  },

  deleteTag: (id) => {
    AppState.tags = AppState.tags.filter((t) => t.id !== id);
    Renderers.renderTags();
    Utils.showToast("Tag removed", "success");
  },

  // Profile Actions
  saveProfile: async (e) => {
    e.preventDefault();
    const name = document.getElementById("profile-display-name").value;
    const email = document.getElementById("profile-email-edit").value;
    const bio = document.getElementById("profile-bio").value;

    AppState.currentUser.name = name;
    AppState.currentUser.email = email;

    document.getElementById("profile-name").textContent = name;
    document.getElementById("profile-email").textContent = email;
    document.getElementById("dropdown-user-name").textContent = name;
    document.getElementById("dropdown-user-email").textContent = email;

    Utils.showToast("Profile updated successfully", "success");
  },

  // Helper Methods
  getBlogFormData: () => {
    const content = AppState.editor ? AppState.editor.root.innerHTML : "";
    return {
      title: document.getElementById("blog-title").value,
      slug:
        document.getElementById("blog-slug").value ||
        Utils.slugify(document.getElementById("blog-title").value),
      excerpt: document.getElementById("blog-excerpt").value,
      content: content,
      category: document.getElementById("blog-category").value,
      tags: document
        .getElementById("blog-tags")
        .value.split(",")
        .map((t) => t.trim())
        .filter((t) => t),
      featuredImage:
        document.getElementById("image-preview").querySelector("img")?.src ||
        null,
    };
  },

  resetBlogForm: () => {
    document.getElementById("blog-form").reset();
    if (AppState.editor) AppState.editor.setContents([]);
    document.getElementById("image-preview").innerHTML = `
      <i class="fas fa-cloud-upload-alt"></i>
      <p>Click to upload image</p>
    `;
  },

  logoutUser: () => {
    if (confirm("Are you sure you want to logout?")) {
      Utils.showToast("Logged out successfully", "success");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1000);
    }
  },
};

// ============================================
// EVENT LISTENERS
// ============================================
function initializeEventListeners() {
  // Navigation
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      Actions.showSection(section);
    });
  });

  // Filter Tabs - Posts
  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("[data-filter]")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      AppState.filters.posts = btn.dataset.filter;
      AppState.pagination.posts.page = 1;
      Renderers.renderPostsTable();
    });
  });

  // Filter Tabs - Media
  document.querySelectorAll("[data-media-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("[data-media-filter]")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      AppState.filters.media = btn.dataset.mediaFilter;
      Renderers.renderMediaGrid();
    });
  });

  // Filter Tabs - Comments
  document.querySelectorAll("[data-comment-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("[data-comment-filter]")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      AppState.filters.comments = btn.dataset.commentFilter;
      Renderers.renderComments();
    });
  });

  // Filter Tabs - Users
  document.querySelectorAll("[data-user-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("[data-user-filter]")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      AppState.filters.users = btn.dataset.userFilter;
      Renderers.renderUsers();
    });
  });

  // Media View Toggle
  document.querySelectorAll(".media-view-toggle .view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      document
        .querySelectorAll(".media-view-toggle .view-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      document
        .getElementById("media-grid")
        .classList.toggle("hidden", view !== "grid");
      document
        .getElementById("media-list")
        .classList.toggle("hidden", view !== "list");
    });
  });

  // Modal Close Buttons
  document.querySelectorAll(".close-btn, [data-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modalId = btn.dataset.modal;
      if (modalId) {
        document.getElementById(modalId).classList.add("hidden");
      }
    });
  });

  // Modal Overlay Click
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", () => {
      overlay.closest(".modal").classList.add("hidden");
    });
  });

  // User Dropdown
  document.getElementById("user-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("user-dropdown").classList.toggle("hidden");
    document.getElementById("notification-dropdown").classList.add("hidden");
  });

  // Notification Dropdown
  document.getElementById("notification-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("notification-dropdown").classList.toggle("hidden");
    document.getElementById("user-dropdown").classList.add("hidden");
  });

  // Close dropdowns on outside click
  document.addEventListener("click", () => {
    document.getElementById("user-dropdown").classList.add("hidden");
    document.getElementById("notification-dropdown").classList.add("hidden");
  });

  // Blog Form Submit
  document.getElementById("blog-form").addEventListener("submit", (e) => {
    e.preventDefault();
    Actions.publishPost();
  });

  // Auto-generate slug from title
  document.getElementById("blog-title").addEventListener("blur", () => {
    const slugInput = document.getElementById("blog-slug");
    if (!slugInput.value) {
      slugInput.value = Utils.slugify(
        document.getElementById("blog-title").value
      );
    }
  });

  // Save Draft Button
  document
    .getElementById("save-draft-btn")
    .addEventListener("click", Actions.saveDraft);

  // Schedule Button
  document
    .getElementById("schedule-btn")
    .addEventListener("click", Actions.schedulePost);

  // Confirm Schedule
  document
    .getElementById("confirm-schedule-btn")
    .addEventListener("click", Actions.confirmSchedule);

  // Edit Modal Buttons
  document
    .getElementById("edit-draft-btn")
    .addEventListener("click", () => Actions.saveEdit("draft"));
  document
    .getElementById("edit-publish-btn")
    .addEventListener("click", () => Actions.saveEdit("published"));

  // Delete Confirmation
  document
    .getElementById("confirm-delete-btn")
    .addEventListener("click", Actions.confirmDelete);

  // Media Upload
  document.getElementById("blog-image").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById(
          "image-preview"
        ).innerHTML = `<img src="${e.target.result}" alt="Preview">`;
      };
      reader.readAsDataURL(file);
    }
  });

  // Upload Media Button
  document.getElementById("upload-media-btn").addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*,.pdf,.doc,.docx";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        Utils.showLoader();
        try {
          await API.uploadMedia(file);
          Utils.showToast("Media uploaded successfully", "success");
          Renderers.renderMediaGrid();
        } catch (error) {
          Utils.showToast("Failed to upload media", "error");
        } finally {
          Utils.hideLoader();
        }
      }
    };
    input.click();
  });

  // Invite User
  document.getElementById("invite-user-btn").addEventListener("click", () => {
    document.getElementById("invite-user-modal").classList.remove("hidden");
  });

  document
    .getElementById("send-invite-btn")
    .addEventListener("click", Actions.inviteUser);

  // Category Management
  document
    .getElementById("add-category-btn")
    .addEventListener("click", Actions.addCategory);
  document
    .getElementById("save-category-btn")
    .addEventListener("click", Actions.saveCategory);
  document
    .getElementById("delete-category-btn")
    .addEventListener("click", Actions.deleteCategory);

  // Tag Management
  document.getElementById("add-tag-btn").addEventListener("click", () => {
    document.getElementById("new-tag-input").focus();
  });

  document
    .getElementById("quick-add-tag")
    .addEventListener("click", Actions.addTag);
  document.getElementById("new-tag-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") Actions.addTag();
  });

  // Profile Form
  document
    .getElementById("profile-form")
    .addEventListener("submit", Actions.saveProfile);

  // Analytics Period Selectors
  document
    .getElementById("analytics-period")
    ?.addEventListener("change", Renderers.renderAnalytics);
  document
    .getElementById("main-analytics-period")
    ?.addEventListener("change", Renderers.renderAnalytics);

  // Search Debounced
  const debouncedSearch = Utils.debounce((type, value) => {
    switch (type) {
      case "media":
        // Trigger media search
        break;
      case "comments":
        // Trigger comments search
        break;
      case "users":
        // Trigger users search
        break;
    }
  }, 300);

  document.getElementById("media-search")?.addEventListener("input", (e) => {
    debouncedSearch("media", e.target.value);
  });

  // Chart Insert
  document.getElementById("insert-chart-btn")?.addEventListener("click", () => {
    document.getElementById("chart-modal").classList.remove("hidden");
  });

  // Chart Type Selection
  document.querySelectorAll(".chart-type-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".chart-type-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // Insert Chart Confirm
  document
    .getElementById("insert-chart-confirm")
    ?.addEventListener("click", () => {
      const type = document.querySelector(".chart-type-btn.active").dataset
        .chartType;
      const title = document.getElementById("chart-title").value;

      // Insert placeholder for chart in editor
      if (AppState.editor) {
        AppState.editor.insertEmbed(
          AppState.editor.getLength(),
          "image",
          `https://quickchart.io/chart?c={type:'${type}',data:{labels:['A','B','C'],datasets:[{label:'${title}',data:[10,20,30]}]}}`
        );
      }

      document.getElementById("chart-modal").classList.add("hidden");
      Utils.showToast("Chart inserted", "success");
    });

  // Media Library Selection
  document.getElementById("select-media-btn")?.addEventListener("click", () => {
    if (AppState.selectedMedia) {
      const media = AppState.media.find((m) => m.id === AppState.selectedMedia);
      if (media) {
        document.getElementById(
          "image-preview"
        ).innerHTML = `<img src="${media.url}" alt="Selected">`;
      }
      document.getElementById("media-library-modal").classList.add("hidden");
    }
  });

  // Bulk Actions
  document
    .getElementById("apply-bulk-action")
    ?.addEventListener("click", () => {
      const action = document.getElementById("bulk-action-select").value;
      if (!action) return;

      const checked = document.querySelectorAll(".comment-checkbox:checked");
      if (checked.length === 0) {
        Utils.showToast("Please select comments first", "warning");
        return;
      }

      Utils.showToast(
        `${action} applied to ${checked.length} comments`,
        "success"
      );
    });

  // Window click handlers for pagination
  window.changePage = (page) => {
    if (window.currentPageCallback && page > 0) {
      window.currentPageCallback(page);
    }
  };
}

// ============================================
// INITIALIZATION
// ============================================
function initializeEditor() {
  if (document.getElementById("editor")) {
    AppState.editor = new Quill("#editor", {
      theme: "snow",
      modules: {
        toolbar: "#editor-toolbar",
      },
      placeholder: "Write your blog content here...",
    });
  }
}

function initializeDateDisplay() {
  const dateDisplay = document.getElementById("current-date");
  if (dateDisplay) {
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    dateDisplay.textContent = new Date().toLocaleDateString("en-US", options);
  }
}

function init() {
  generateMockData();
  initializeEditor();
  initializeEventListeners();
  initializeDateDisplay();
  Renderers.renderNotifications();
  Renderers.updateDashboardStats();
  Renderers.renderRecentPosts();
  Renderers.renderTopPosts();
  Renderers.renderAnalytics();
  Renderers.renderCategoryOptions();

  // Initial section load
  Actions.showSection("dashboard");

  console.log("Blog Admin Dashboard initialized");
}

// Start the app when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
