import { Request, Response } from "express";
import { PaginationRequest } from "@/types/pagination.types.js";
import {
  createPost,
  getPosts,
  getPostStats,
  getPostById,
  getPostBySlug,
  updatePost,
  publishPost,
  deletePost,
  schedulePost,
} from "@/models/postModel.js";
import { notifyRoles, notifyUser } from "@/services/notificationService.js";
import { parsePagination, hasMorePage } from "@/utils/pagination.js";
import { isValidRouteParam } from "@/utils/validate.js";

// CHANGED: notifyByRole/notifyUser used to be defined here as a
// near-duplicate of commentController.ts's notifyRoles/notifyUser, each
// with its own inline `pool.query` against the users table. Both files
// now share the single implementation in notificationService.ts.
//
// CHANGED: the Open Graph / social-crawler meta-tag logic (getPostOGMeta,
// CRAWLER_UA_REGEX, escapeHtml, the inline HTML template) used to live in
// this file too, even though it has nothing to do with post CRUD — a
// crawler-detection tweak had no business reason to touch the same file
// as publishExistingPost. It now lives in ogMetaController.ts.

// =============================================
// Create a new post (draft, published, or scheduled)
// =============================================
export const createNewPost = async (req: Request, res: Response) => {
  const {
    categoryId,
    title,
    slug,
    content,
    excerpt,
    featuredImage,
    status,
    scheduledDate,
  }: {
    categoryId: string;
    title: string;
    slug: string;
    content: string;
    excerpt?: string;
    featuredImage?: string;
    status?: "draft" | "published" | "scheduled";
    scheduledDate?: string;
  } = req.body;

  if (!title || !slug || !content) {
    return res.status(400).json({
      message: "Title, slug, and content are required",
    });
  }

  let scheduleTime: Date | undefined;
  if (status === "scheduled" || scheduledDate) {
    if (!scheduledDate) {
      return res.status(400).json({
        message: "scheduledDate is required for scheduled posts",
      });
    }
    scheduleTime = new Date(scheduledDate);
    if (isNaN(scheduleTime.getTime()) || scheduleTime <= new Date()) {
      return res.status(400).json({
        message: "Scheduled date must be a valid future date",
      });
    }
  }

  try {
    const post = await createPost({
      authorId: req.user!.id,
      // categoryId is optional — a post can exist without a category
      categoryId: categoryId || null,
      title,
      slug,
      content,
      excerpt: excerpt || "",
      featuredImage: featuredImage || "",
      status: (status || "draft") as "draft" | "published" | "scheduled",
      ...(scheduleTime && { scheduledDate: scheduleTime }),
    });

    res.status(201).json(post);
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Slug already exists" });
    }
    console.error("createNewPost error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================
// Fetch posts — supports status filter and pagination
// =============================================
export const fetchPosts = async (req: PaginationRequest, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req, 10);

    // When the frontend sends "all" (or omits status entirely) we pass null
    // to getPosts so it runs without a WHERE status clause and returns everything.
    // Any other value — "published", "draft", "scheduled" — is passed through
    // directly as the status filter.
    const rawStatus = req.query.status;
    const status = !rawStatus || rawStatus === "all" ? null : String(rawStatus);

    const posts = await getPosts(status, limit, offset);

    res.json({ posts, limit, offset, hasMore: hasMorePage(posts.length, limit) });
  } catch (err) {
    console.error("fetchPosts error:", err);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
};

// =============================================
// Fetch aggregate post counts by status
// =============================================
export const fetchPostStats = async (req: Request, res: Response) => {
  try {
    const stats = await getPostStats();
    res.json(stats);
  } catch (err) {
    console.error("fetchPostStats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};

// =============================================
// Update an existing post's content fields
// =============================================
export const updateExistingPost = async (req: Request, res: Response) => {
  const { categoryId, title, slug, content, excerpt, featuredImage, status } =
    req.body;
  const id = req.params.id;

  if (!isValidRouteParam(id)) {
    return res.status(400).json({ message: "Invalid post ID" });
  }

  let post;
  try {
    post = await getPostById(id);
  } catch (error) {
    console.error("updateExistingPost lookup error:", error);
    return res
      .status(503)
      .json({ message: "Service temporarily unavailable. Please try again." });
  }

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  // Admins can edit any post; authors can only edit their own
  if (req.user!.role !== "admin" && post.author_id !== req.user!.id) {
    return res.status(403).json({ message: "Not allowed" });
  }

  const updates: {
    categoryId?: string | null;
    title?: string;
    slug?: string;
    content?: string;
    excerpt?: string;
    featuredImage?: string;
    status?: string;
  } = {};

  if (categoryId !== undefined) updates.categoryId = categoryId;
  if (title !== undefined) updates.title = title;
  if (slug !== undefined) updates.slug = slug;
  if (content !== undefined) updates.content = content;
  if (excerpt !== undefined) updates.excerpt = excerpt;
  if (featuredImage !== undefined) updates.featuredImage = featuredImage;
  if (status !== undefined) updates.status = status;

  try {
    const updated = await updatePost(id, updates);
    res.json(updated);
  } catch (error: any) {
    if (error.message === "No fields provided for update") {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === "23505") {
      return res.status(409).json({ message: "Slug already exists" });
    }
    console.error("updateExistingPost error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================
// Publish a draft or scheduled post
// =============================================
export const publishExistingPost = async (req: Request, res: Response) => {
  const id = req.params.id;

  if (!isValidRouteParam(id)) {
    return res.status(400).json({ message: "Invalid post ID" });
  }

  let post;
  try {
    post = await getPostById(id);
  } catch (error) {
    console.error("publishExistingPost lookup error:", error);
    return res
      .status(503)
      .json({ message: "Service temporarily unavailable. Please try again." });
  }

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  if (post.status === "published") {
    return res.status(400).json({ message: "Already published" });
  }

  try {
    const updated = await publishPost(id);

    // Notify the post author if someone else published their post
    // (they published it themselves → no need to notify them)
    if (post.author_id && post.author_id !== req.user!.id) {
      notifyUser({
        userId: post.author_id,
        type: "post",
        message: `Your post "${post.title}" has been published.`,
      });
    }

    // Notify editors that a new post is live (so they can review content)
    notifyRoles({
      roles: ["editor"],
      type: "post",
      message: `Post "${post.title}" has been published.`,
      excludeUserId: req.user!.id, // don't notify the editor who published it
    });

    res.json(updated);
  } catch (err) {
    console.error("publishExistingPost error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================
// Delete a post — author and admins only
// =============================================
export const removePost = async (req: Request, res: Response) => {
  const id = req.params.id;

  if (!isValidRouteParam(id)) {
    return res.status(400).json({ message: "Invalid post ID" });
  }

  let post;
  try {
    post = await getPostById(id);
  } catch (error) {
    console.error("removePost lookup error:", error);
    return res
      .status(503)
      .json({ message: "Service temporarily unavailable. Please try again." });
  }

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  // Admins can delete any post; authors can only delete their own
  if (req.user!.role !== "admin" && post.author_id !== req.user!.id) {
    return res.status(403).json({ message: "Not allowed" });
  }

  try {
    await deletePost(id);

    // If an admin deleted someone else's post, notify the author
    if (post.author_id && post.author_id !== req.user!.id) {
      notifyUser({
        userId: post.author_id,
        type: "post",
        message: `Your post "${post.title}" has been deleted by an admin.`,
      });
    }

    // Always notify admins when any post is deleted (audit trail)
    notifyRoles({
      roles: ["admin"],
      type: "post",
      message: `Post "${post.title}" was deleted by ${req.user!.id}.`,
      excludeUserId: req.user!.id, // don't notify the admin who deleted it
    });

    res.json({ message: "Post deleted" });
  } catch (err) {
    console.error("removePost error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================
// Schedule an existing draft post
// =============================================
export const scheduleExistingPost = async (req: Request, res: Response) => {
  const id = req.params.id;
  const { scheduledDate } = req.body;

  if (!isValidRouteParam(id)) {
    return res.status(400).json({ message: "Invalid post ID" });
  }

  if (!scheduledDate) {
    return res.status(400).json({ message: "scheduledDate is required" });
  }

  const scheduleTime = new Date(scheduledDate);
  if (isNaN(scheduleTime.getTime()) || scheduleTime <= new Date()) {
    return res.status(400).json({
      message: "Scheduled date must be a valid future date",
    });
  }

  let post;
  try {
    post = await getPostById(id);
  } catch (error) {
    console.error("scheduleExistingPost lookup error:", error);
    return res
      .status(503)
      .json({ message: "Service temporarily unavailable. Please try again." });
  }

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  if (req.user!.role !== "admin" && post.author_id !== req.user!.id) {
    return res.status(403).json({ message: "Not allowed" });
  }

  if (post.status === "published") {
    return res.status(400).json({
      message: "Cannot schedule already published posts",
    });
  }

  try {
    const updated = await schedulePost(id, scheduleTime);
    res.json(updated);
  } catch (err) {
    console.error("scheduleExistingPost error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================
// Create a scheduled post directly
// Kept for backwards compatibility with postRoutes.ts POST /posts/schedule
// createNewPost with status:"scheduled" is the preferred path going forward
// =============================================
export const createScheduledPost = async (req: Request, res: Response) => {
  const {
    categoryId,
    title,
    slug,
    content,
    excerpt,
    featuredImage,
    scheduledDate,
  } = req.body;

  if (!title || !slug || !content || !scheduledDate) {
    return res.status(400).json({
      message: "Title, slug, content, and scheduledDate are required",
    });
  }

  const scheduleTime = new Date(scheduledDate);
  if (isNaN(scheduleTime.getTime()) || scheduleTime <= new Date()) {
    return res.status(400).json({
      message: "Scheduled date must be a valid future date",
    });
  }

  try {
    const post = await createPost({
      authorId: req.user!.id,
      categoryId: categoryId || null,
      title,
      slug,
      content,
      excerpt,
      featuredImage,
      status: "scheduled",
      scheduledDate: scheduleTime,
    });

    res.status(201).json(post);
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Slug already exists" });
    }
    console.error("createScheduledPost error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =============================================
// GET /posts/slug/:slug
// Public endpoint — no auth required.
// Returns the raw post JSON for a given slug.
//
// Why this exists:
// getPostOGMeta (now in ogMetaController.ts) serves crawlers a static
// HTML shell, then redirects real users to builders-digest-post.html?slug=xxx.
// But blog-post.js only ever reads localStorage.selectedPost — it never
// fetches by slug. So anyone opening a shared link fresh (no prior
// localStorage, different device, incognito, etc.) landed on "Article
// not found" even though the post exists. This endpoint lets
// blog-post.js fall back to fetching the post directly when
// localStorage is empty or doesn't match the slug in the URL.
// =============================================
export const fetchPostBySlug = async (req: Request, res: Response) => {
  const { slug } = req.params;

  if (!isValidRouteParam(slug)) {
    return res.status(400).json({ message: "Invalid slug" });
  }

  try {
    const post = await getPostBySlug(slug);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.json(post);
  } catch (error) {
    console.error("fetchPostBySlug error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
