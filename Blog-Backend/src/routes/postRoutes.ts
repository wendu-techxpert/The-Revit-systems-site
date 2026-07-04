// Updated postRoutes.ts - COMPLETE FILE

import { Router } from "express";
import {
  createNewPost,
  fetchPosts,
  fetchPostStats,
  updateExistingPost,
  publishExistingPost,
  removePost,
  scheduleExistingPost,
  createScheduledPost,
  getPostOGMeta,
  fetchPostBySlug,
} from "@/controllers/postController.js";

import { authenticate } from "@/middleware/authMiddleware.js";

const router = Router();

// Open Graph meta route — public, no auth required.
// Used by social media crawlers (WhatsApp, Twitter, LinkedIn) to read
// og:title, og:description and og:image for a specific post.
// Must be registered BEFORE /:id routes to avoid slug being parsed as an id.
router.get("/og/:slug", getPostOGMeta);

// Fetch a single published post by slug — public, no auth required.
// Used by blog-post.js as a fallback when a visitor opens a shared
// link with no matching post already cached in localStorage.
// Must also be registered BEFORE /:id routes.
router.get("/slug/:slug", fetchPostBySlug);

// Get posts by status (published, draft, scheduled)
// Query params: status, limit, offset
router.get("/", fetchPosts);

// Get stats
router.get("/stats", authenticate, fetchPostStats);

// Create post (draft by default, or pass status: 'scheduled')
router.post("/", authenticate, createNewPost);

// Create scheduled post directly
router.post("/schedule", authenticate, createScheduledPost);

// Edit post
router.put("/:id", authenticate, updateExistingPost);

// Schedule existing post
router.patch("/:id/schedule", authenticate, scheduleExistingPost);

// Publish post (works for draft or scheduled)
router.patch("/:id/publish", authenticate, publishExistingPost);

// Delete post
router.delete("/:id", authenticate, removePost);

export default router;
