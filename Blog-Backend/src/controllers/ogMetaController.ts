import { Request, Response } from "express";
import { getPostBySlug } from "@/models/postModel.js";
import { FRONTEND_URL } from "@/utils/env.js";

// ============================================
// GET /posts/og/:slug
// Public endpoint — no auth required.
// Returns a minimal HTML page with correct Open Graph meta tags
// for the given post slug, then immediately JS-redirects to the
// real blog post page.
//
// Why this exists:
// WhatsApp, Twitter, LinkedIn etc. send a "crawler" bot to read the
// page when someone shares a link. That bot does NOT execute JavaScript,
// so builders-digest-post.html (which renders everything via JS from
// localStorage) looks completely blank to it. It falls back to grabbing
// whatever image it finds on the page — which ends up being the Revit
// Systems logo. Every shared link looks identical regardless of which
// post it is.
//
// This route gives crawlers a static HTML page with the correct og:title,
// og:description, og:image and og:url for the specific post, while real
// users are immediately redirected to the actual blog post page.
//
// CHANGED: this used to live inside postController.ts, mixed in with
// unrelated post CRUD. Crawler-detection / meta-tag rendering is a
// completely separate concern from "create/update/delete a post" — it
// changes for different reasons (a new social platform's UA string, an
// og:image fallback tweak) than post CRUD does, so it now has its own
// file (orthogonality).
// ============================================

const CRAWLER_UA_REGEX =
  /bot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|slackbot|telegrambot|discordbot|pinterest|embedly|quora link preview|showyoubot|outbrain|w3c_validator/i;

const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const getPostOGMeta = async (req: Request, res: Response) => {
  const { slug } = req.params;

  if (!slug || Array.isArray(slug)) {
    return res.status(400).send("Invalid slug");
  }

  let post;
  try {
    post = await getPostBySlug(slug);
  } catch (err) {
    console.error("getPostOGMeta error:", err);
    return res.status(500).send("Server error");
  }

  if (!post) {
    return res.status(404).send("Post not found");
  }

  const postUrl = `${FRONTEND_URL}/pages/builders-digest-post.html?slug=${encodeURIComponent(
    post.slug
  )}`;

  // Real users: send them straight there. No HTML parsing, no CSP,
  // no meta-refresh dependency — this can never "hang."
  const userAgent = req.headers["user-agent"] || "";
  if (!CRAWLER_UA_REGEX.test(userAgent)) {
    return res.redirect(302, postUrl);
  }

  // From here on we're only ever talking to a crawler — it will read
  // the tags and never execute the redirect, so this branch no longer
  // needs to guarantee a working client-side redirect at all.
  const description = escapeHtml(
    (post.excerpt || "").replace(/<[^>]+>/g, "").slice(0, 200)
  );
  const image = escapeHtml(
    post.featured_image || `${FRONTEND_URL}/assets/images/revit-og-default.png`
  );
  const title = escapeHtml(`${post.title} — Revit Systems`);
  const safePostUrl = escapeHtml(postUrl);

  res.setHeader("Content-Type", "text/html");
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Revit Systems" />
  <meta property="og:url" content="${safePostUrl}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
</head>
<body>
  <p>${title}</p>
</body>
</html>`);
};
