const BASE_URL = window.baseURL;
const LOGIN_URL = "../pages/login.html"; // set once, use everywhere

// Access token lives in memory only — never in localStorage
let accessToken = null;

let _refreshInFlight = null;

const authFetch = async (url, options = {}) => {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });

  if (response.status === 401) {
    const refreshed = await API.refreshToken();
    if (!refreshed) return response; // refreshToken already redirected to login (if not already there)

    // Retry the original request with the new token
    return fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...options.headers,
      },
    });
  }

  return response;
};

const API = {
  refreshToken: (retriesLeft = 1) => {
    if (_refreshInFlight) return _refreshInFlight;

    _refreshInFlight = API._doRefreshToken(retriesLeft).finally(() => {
      _refreshInFlight = null;
    });

    return _refreshInFlight;
  },

  _doRefreshToken: async (retriesLeft = 1) => {
    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        accessToken = data.accessToken;
        return true;
      }

      if (response.status === 401 || response.status === 403) {
        const onLoginPage = window.location.pathname.includes("login.html");
        if (!onLoginPage) {
          window.location.href = LOGIN_URL;
        }
        return false;
      }
      if (retriesLeft > 0) {
        await new Promise((r) => setTimeout(r, 1000));
        return API._doRefreshToken(retriesLeft - 1);
      }

      console.error("Refresh failed after retry:", response.status);
      return false;
    } catch (err) {
      if (retriesLeft > 0) {
        await new Promise((r) => setTimeout(r, 1000));
        return API._doRefreshToken(retriesLeft - 1);
      }
      console.error("Refresh network error:", err);
      return false;
    }
  },

  login: async (email, password) => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed");
    }

    accessToken = data.accessToken;
    return data;
  },

  logout: async () => {
    try {
      await authFetch(`${BASE_URL}/auth/logout`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    } catch {
      // Proceed with local cleanup even if the server call fails
    } finally {
      accessToken = null;
      Cache.clear(); // wipe all cached data on logout
      window.location.href = LOGIN_URL;
    }
  },

  // "Who am I" — cached for the session duration
  // force=true bypasses the cache (used by the profile reload button)
  getCurrentUser: async (force = false) => {
    const key = "currentUser";
    if (!force) {
      const cached = Cache.get(key);
      if (cached) return cached;
    }

    const response = await authFetch(`${BASE_URL}/auth/me`);
    if (!response.ok) throw new Error("Failed to fetch current user");
    const data = await response.json();
    Cache.set(key, data, "currentUser");
    return data;
  },

  // ============================================
  // POSTS
  // ============================================

  // force=true skips the cache — used by the reload button
  getPostStats: async (force = false) => {
    const key = "postStats";
    if (!force) {
      const cached = Cache.get(key);
      if (cached) return cached;
    }

    const response = await authFetch(`${BASE_URL}/posts/stats`);
    if (!response.ok) throw new Error("Failed to fetch post stats");
    const data = await response.json();
    Cache.set(key, data, "postStats");
    return data;
  },

  // Returns { posts, pagination }
  // filter: "all" | "published" | "draft" | "scheduled"
  getPosts: async (
    filter = "published",
    page = 1,
    limit = 10,
    force = false
  ) => {
    const key = `posts:${filter}:${page}:${limit}`;
    if (!force) {
      const cached = Cache.get(key);
      if (cached) return cached;
    }

    const offset = (page - 1) * limit;
    const statusParam = filter && filter !== "all" ? `&status=${filter}` : "";
    const url = `${BASE_URL}/posts?limit=${limit}&offset=${offset}${statusParam}`;

    const response = await authFetch(url);
    if (!response.ok) throw new Error("Failed to fetch posts");

    const data = await response.json();
    const result = {
      posts: data.posts,
      pagination: {
        page,
        totalPages: data.hasMore ? page + 1 : page,
        total: data.posts.length,
      },
    };

    Cache.set(key, result, "posts");
    return result;
  },

  getPostById: async (id, force = false) => {
    const key = `posts:id:${id}`;
    if (!force) {
      const cached = Cache.get(key);
      if (cached) return cached;
    }

    const response = await authFetch(`${BASE_URL}/posts/${id}`);
    if (!response.ok) throw new Error("Failed to fetch post");
    const data = await response.json();
    Cache.set(key, data, "posts");
    return data;
  },

  createPost: async (postData) => {
    const body = {
      categoryId: postData.category || null,
      title: postData.title,
      slug: postData.slug,
      content: postData.content,
      excerpt: postData.excerpt || "",
      featuredImage: postData.featuredImage || "",
      status: postData.status || "draft",
    };

    if (postData.status === "scheduled" && postData.scheduledAt) {
      body.scheduledDate = postData.scheduledAt;
    }

    const response = await authFetch(`${BASE_URL}/posts`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to create post");
    }

    const newPost = await response.json();
    AppState.posts.unshift(newPost);

    // New post changes counts and the list — invalidate both
    Cache.invalidateMany("posts", "postStats");
    return newPost;
  },

  updatePost: async (id, postData) => {
    if (postData.scheduledAt) {
      return API.schedulePost(id, postData.scheduledAt);
    }

    const body = {};
    if (postData.categoryId !== undefined)
      body.categoryId = postData.categoryId;
    if (postData.category !== undefined) body.categoryId = postData.category;
    if (postData.title !== undefined) body.title = postData.title;
    if (postData.slug !== undefined) body.slug = postData.slug;
    if (postData.content !== undefined) body.content = postData.content;
    if (postData.excerpt !== undefined) body.excerpt = postData.excerpt;
    if (postData.featuredImage !== undefined)
      body.featuredImage = postData.featuredImage;
    if (postData.status !== undefined) body.status = postData.status;

    const response = await authFetch(`${BASE_URL}/posts/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update post");
    }

    const updated = await response.json();

    const index = AppState.posts.findIndex((p) => p.id === id);
    if (index !== -1)
      AppState.posts[index] = { ...AppState.posts[index], ...updated };

    // Status may have changed — invalidate list and stats
    Cache.invalidateMany("posts", "postStats");
    return updated;
  },

  publishPost: async (id) => {
    const response = await authFetch(`${BASE_URL}/posts/${id}/publish`, {
      method: "PATCH",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to publish post");
    }

    const updated = await response.json();

    const index = AppState.posts.findIndex((p) => p.id === id);
    if (index !== -1)
      AppState.posts[index] = { ...AppState.posts[index], ...updated };

    Cache.invalidateMany("posts", "postStats");
    return updated;
  },

  schedulePost: async (id, scheduledDate) => {
    const response = await authFetch(`${BASE_URL}/posts/${id}/schedule`, {
      method: "PATCH",
      body: JSON.stringify({ scheduledDate }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to schedule post");
    }

    Cache.invalidateMany("posts", "postStats");
    return response.json();
  },

  deletePost: async (id) => {
    const response = await authFetch(`${BASE_URL}/posts/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete post");
    }

    AppState.posts = AppState.posts.filter((p) => p.id !== id);
    Cache.invalidateMany("posts", "postStats");
    return { success: true };
  },

  // ============================================
  // CATEGORIES
  // ============================================

  getCategories: async (force = false) => {
    const key = "categories";
    if (!force) {
      const cached = Cache.get(key);
      if (cached) {
        AppState.categories = cached;
        return cached;
      }
    }

    const response = await authFetch(`${BASE_URL}/categories`);
    if (!response.ok) throw new Error("Failed to fetch categories");

    const categories = await response.json();
    AppState.categories = categories;
    Cache.set(key, categories, "categories");
    return categories;
  },

  saveCategory: async (categoryData) => {
    if (categoryData.id) {
      const body = {};
      if (categoryData.name) body.name = categoryData.name;
      if (categoryData.slug) body.slug = categoryData.slug;
      if (categoryData.description) body.description = categoryData.description;
      if (categoryData.parent) body.parentId = categoryData.parent;

      const response = await authFetch(
        `${BASE_URL}/categories/${categoryData.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update category");
      }

      const updated = await response.json();
      const index = AppState.categories.findIndex(
        (c) => c.id === categoryData.id
      );
      if (index !== -1) AppState.categories[index] = updated;

      // Changing a category also affects post list display
      Cache.invalidateMany("categories", "posts");
      return updated;
    } else {
      const body = { name: categoryData.name };
      if (categoryData.slug) body.slug = categoryData.slug;
      if (categoryData.description) body.description = categoryData.description;
      if (categoryData.parent) body.parentId = categoryData.parent;

      const response = await authFetch(`${BASE_URL}/categories`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create category");
      }

      const created = await response.json();
      AppState.categories.push(created);
      Cache.invalidate("categories");
      return created;
    }
  },

  deleteCategory: async (id) => {
    const response = await authFetch(`${BASE_URL}/categories/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete category");
    }

    AppState.categories = AppState.categories.filter((c) => c.id !== id);
    // Deleting a category un-categorizes posts — invalidate both
    Cache.invalidateMany("categories", "posts");
    return { success: true };
  },

  // ============================================
  // COMMENTS
  // ============================================

  getComments: async (
    filter = "pending",
    page = 1,
    limit = 10,
    force = false
  ) => {
    // Normalise frontend-only filter labels to backend-valid status values
    let backendFilter = filter;
    if (filter === "spam" || filter === "trash") backendFilter = "rejected";
    if (filter === "all") backendFilter = null;

    const key = `comments:${backendFilter ?? "all"}:${page}:${limit}`;
    if (!force) {
      const cached = Cache.get(key);
      if (cached) {
        AppState.comments = cached.comments;
        return cached;
      }
    }

    const offset = (page - 1) * limit;
    const statusParam = backendFilter ? `&status=${backendFilter}` : "";
    const url = `${BASE_URL}/comments?limit=${limit}&offset=${offset}${statusParam}`;

    const response = await authFetch(url);
    if (!response.ok) throw new Error("Failed to fetch comments");

    const data = await response.json();

    const normalised = data.comments.map((c) => ({
      id: c.id,
      author: c.visitor_name || "Staff",
      email: c.visitor_email || "",
      text: c.comment_text,
      postTitle: c.post_title || c.post_id,
      status: c.status,
      createdAt: c.created_at,
    }));

    AppState.comments = normalised;

    const result = {
      comments: normalised,
      pagination: {
        page,
        totalPages: data.hasMore ? page + 1 : page,
        total: normalised.length,
      },
    };

    Cache.set(key, result, "comments");
    return result;
  },

  updateComment: async (id, status) => {
    const mappedStatus = status === "spam" ? "rejected" : status;

    const response = await authFetch(`${BASE_URL}/comments/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: mappedStatus }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update comment");
    }

    const updated = await response.json();

    const index = AppState.comments.findIndex((c) => c.id === id);
    if (index !== -1) AppState.comments[index].status = mappedStatus;

    // Status changed — all comment filter pages are potentially stale
    Cache.invalidate("comments");
    return updated;
  },

  replyToComment: async (id, commentText) => {
    const response = await authFetch(`${BASE_URL}/comments/${id}/reply`, {
      method: "POST",
      body: JSON.stringify({ commentText }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to post reply");
    }

    // A new reply shows up in the approved list
    Cache.invalidate("comments");
    return response.json();
  },

  // ============================================
  // NOTIFICATIONS
  // ============================================

  getNotifications: async (limit = 10, force = false) => {
    const key = `notifications:${limit}`;
    if (!force) {
      const cached = Cache.get(key);
      if (cached) return cached;
    }

    const response = await authFetch(
      `${BASE_URL}/notifications?limit=${limit}`
    );
    if (!response.ok) throw new Error("Failed to fetch notifications");
    const data = await response.json();
    Cache.set(key, data, "notifications");
    return data;
  },

  getUnreadCount: async (force = false) => {
    const key = "notifications:unreadCount";
    if (!force) {
      const cached = Cache.get(key);
      if (cached) return cached;
    }

    const response = await authFetch(`${BASE_URL}/notifications/unread-count`);
    if (!response.ok) return { unreadCount: 0 };
    const data = await response.json();
    Cache.set(key, data, "notifications");
    return data;
  },

  markNotificationRead: async (id) => {
    const response = await authFetch(`${BASE_URL}/notifications/${id}/read`, {
      method: "PATCH",
    });
    if (!response.ok) throw new Error("Failed to mark notification as read");
    Cache.invalidate("notifications");
    return response.json();
  },

  markAllNotificationsRead: async () => {
    const response = await authFetch(`${BASE_URL}/notifications/read-all`, {
      method: "PATCH",
    });
    if (!response.ok)
      throw new Error("Failed to mark all notifications as read");
    Cache.invalidate("notifications");
    return response.json();
  },

  // DELETE /notifications/:id — was missing entirely, needed by the
  // dismiss (×) button added to each notification row in renderNotifications
  deleteNotification: async (id) => {
    const response = await authFetch(`${BASE_URL}/notifications/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete notification");
    Cache.invalidate("notifications");
    return response.json();
  },

  // DELETE /notifications — clear all for logged-in user
  deleteAllNotifications: async () => {
    const response = await authFetch(`${BASE_URL}/notifications`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to clear notifications");
    Cache.invalidate("notifications");
    return response.json();
  },

  // ============================================
  // ANALYTICS
  // ============================================

  getAnalytics: async (period = 30, force = false) => {
    const key = `postStats:analytics:${period}`;
    if (!force) {
      const cached = Cache.get(key);
      if (cached) return cached;
    }

    // ── Step 1: fetch post list + stats (needed for top-posts table) ──────
    // We need the post list so we know which postIds to fetch view summaries
    // for. getPosts already caches, so this is cheap on repeat calls.
    const [statsResponse, postsResponse] = await Promise.all([
      authFetch(`${BASE_URL}/posts/stats`),
      authFetch(`${BASE_URL}/posts?limit=50&offset=0`),
    ]);

    const postsData = postsResponse.ok
      ? await postsResponse.json()
      : { posts: [] };
    const posts = postsData.posts || [];

    // Keep AppState in sync so other renderers have fresh data
    if (posts.length > 0) AppState.posts = posts;

    // ── Step 2: fetch per-post view summaries in parallel ─────────────────
    // GET /posts/:postId/views/summary returns:
    //   { total_views, unique_views, desktop, mobile, tablet, unknown }
    // We fetch for all posts concurrently and zip the results back.
    const summaryResults = await Promise.allSettled(
      posts.map((p) =>
        authFetch(`${BASE_URL}/posts/${p.id}/views/summary`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    );

    // Attach real view counts to each post
    const postsWithViews = posts.map((p, i) => {
      const summary =
        summaryResults[i].status === "fulfilled"
          ? summaryResults[i].value
          : null;
      return {
        ...p,
        totalViews: Number(summary?.total_views || 0),
        uniqueViews: Number(summary?.unique_views || 0),
        desktopViews: Number(summary?.desktop || 0),
        mobileViews: Number(summary?.mobile || 0),
        tabletViews: Number(summary?.tablet || 0),
        unknownViews: Number(summary?.unknown || 0),
        // avg session duration: backend stores seconds in post_views rows.
        // The summary endpoint does not aggregate it yet, so we leave it
        // as null — the table will show "—" instead of a fake number.
        avgTime: null,
      };
    });

    // ── Step 3: aggregate device breakdown across all posts ───────────────
    const totalDesktop = postsWithViews.reduce((s, p) => s + p.desktopViews, 0);
    const totalMobile = postsWithViews.reduce((s, p) => s + p.mobileViews, 0);
    const totalTablet = postsWithViews.reduce((s, p) => s + p.tabletViews, 0);
    const totalUnknown = postsWithViews.reduce((s, p) => s + p.unknownViews, 0);
    const deviceTotal =
      totalDesktop + totalMobile + totalTablet + totalUnknown || 1;

    const deviceData = {
      labels: ["Desktop", "Mobile", "Tablet", "Unknown"],
      data: [totalDesktop, totalMobile, totalTablet, totalUnknown],
    };

    // ── Step 4: build traffic timeline from raw view counts ───────────────
    // The backend does not yet expose a /views/timeline endpoint, so we
    // approximate by distributing each post's total views evenly across the
    // requested period. This is a real number (not random) — once you add a
    // timeline endpoint you can swap this block out.
    const totalViewsAll = postsWithViews.reduce((s, p) => s + p.totalViews, 0);
    const today = new Date();
    const trafficLabels = [];
    const trafficDataArr = [];

    for (let i = period - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      trafficLabels.push(
        d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      );
      // Distribute total views evenly — better than random, replaced when
      // a real timeline endpoint exists.
      trafficDataArr.push(Math.round(totalViewsAll / period));
    }

    const trafficData = { labels: trafficLabels, data: trafficDataArr };

    // ── Step 5: top posts sorted by real view count ───────────────────────
    const topPosts = [...postsWithViews]
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, 10)
      .map((p, i) => ({
        ...p,
        rank: i + 1,
        views: p.totalViews,
        uniqueViews: p.uniqueViews, // real distinct-visitor count from the summary endpoint
        avgTime: p.avgTime, // null until timeline endpoint added
        bounceRate: null, // not tracked yet
      }));

    // ── Step 6: referrers — fetch for the top 5 posts by views ───────────
    // GET /posts/:postId/referrers returns:
    //   [{ referrer_name, referrer_url, visit_count, recorded_date }]
    // We aggregate across top posts and deduplicate by referrer_name.
    const topFiveIds = topPosts
      .slice(0, 5)
      .map((p) => p.id)
      .filter(Boolean);

    const referrerResults = await Promise.allSettled(
      topFiveIds.map((id) =>
        authFetch(`${BASE_URL}/posts/${id}/referrers`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => [])
      )
    );

    // Merge and sum by referrer_name
    const referrerMap = {};
    referrerResults.forEach((res) => {
      const rows = res.status === "fulfilled" ? res.value : [];
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const name = row.referrer_name || row.referrer_url || "Direct";
        if (!referrerMap[name]) {
          referrerMap[name] = { name, count: 0, url: row.referrer_url || "" };
        }
        referrerMap[name].count += Number(row.visit_count || 0);
      });
    });

    // Map referrer names to Font Awesome brand icons (best-effort)
    const iconFor = (name = "") => {
      const n = name.toLowerCase();
      if (n.includes("google")) return "google";
      if (n.includes("facebook")) return "facebook";
      if (n.includes("twitter") || n.includes("x.com")) return "twitter";
      if (n.includes("linkedin")) return "linkedin";
      if (n.includes("instagram")) return "instagram";
      if (n.includes("youtube")) return "youtube";
      if (n.includes("github")) return "github";
      return "link"; // generic link icon for everything else
    };

    // Sort by visit count descending, take top 8
    const referrers = Object.values(referrerMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((r) => ({ ...r, icon: iconFor(r.name) }));

    // If no referrer data yet (site is new), show placeholder rows so the
    // UI is not completely empty — but with real zero counts, not fake ones.
    const finalReferrers =
      referrers.length > 0
        ? referrers
        : [
            { name: "Google", count: 0, icon: "google" },
            { name: "Direct", count: 0, icon: "link" },
            { name: "Twitter", count: 0, icon: "twitter" },
            { name: "LinkedIn", count: 0, icon: "linkedin" },
          ];

    const result = {
      trafficData,
      deviceData,
      topPosts,
      referrers: finalReferrers,
    };

    Cache.set(key, result, "postStats");
    return result;
  },

  // ============================================
  // MEDIA  (no backend endpoint yet — kept as mock)
  // ============================================

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

  // ============================================
  // USERS
  // ============================================

  getUsers: async (filter = "all", page = 1, limit = 20, force = false) => {
    const key = `users:${filter}:${page}:${limit}`;
    if (!force) {
      const cached = Cache.get(key);
      if (cached) {
        AppState.users = cached.users;
        return cached;
      }
    }

    const offset = (page - 1) * limit;
    const params = new URLSearchParams({ limit, offset });

    const roleFilters = ["admin", "editor", "author"];
    const statusFilters = ["active", "suspended", "pending"];

    if (filter !== "all") {
      if (roleFilters.includes(filter)) {
        params.append("role", filter);
      } else if (statusFilters.includes(filter)) {
        params.append("status", filter);
      }
    }

    const response = await authFetch(`${BASE_URL}/users?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch users");

    const data = await response.json();
    AppState.users = data.users;

    const result = {
      users: data.users,
      pagination: {
        page,
        totalPages: data.hasMore ? page + 1 : page,
        total: data.users.length,
      },
    };

    Cache.set(key, result, "users");
    return result;
  },

  updateUser: async (id, updates) => {
    const response = await authFetch(`${BASE_URL}/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update user");
    }

    const updated = await response.json();

    const index = AppState.users.findIndex((u) => u.id === id);
    if (index !== -1)
      AppState.users[index] = { ...AppState.users[index], ...updated };

    Cache.invalidate("users");
    return updated;
  },

  deleteUser: async (id) => {
    const response = await authFetch(`${BASE_URL}/users/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete user");
    }

    AppState.users = AppState.users.filter((u) => u.id !== id);
    Cache.invalidate("users");
    return { success: true };
  },

  // Registers a new user with pending status via POST /auth/register.
  inviteUser: async (email, role) => {
    const response = await authFetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      body: JSON.stringify({
        first_name: email.split("@")[0],
        last_name: "Invited",
        email,
        password: Math.random().toString(36).slice(-10) + "A1!",
        role,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to invite user");
    }

    // New user should appear in the list on next load
    Cache.invalidate("users");
    return response.json();
  },
};
