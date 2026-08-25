import { Request, Response } from "express";
import {
  getApprovedCommentsByPostId,
  getCommentReplies,
  getAllCommentsForAdmin,
  getCommentById,
  createStaffComment,
  createGuestComment,
  updateCommentStatus,
  markCommentAsReplied,
  deleteComment,
} from "@/models/commentModel.js";
import { getPostAuthorAndTitle } from "@/models/postModel.js";
import {
  CreateStaffCommentInput,
  CreateGuestCommentInput,
} from "@/types/comment.types.js";
import { notifyRoles, notifyUser } from "@/services/notificationService.js";
import { parsePagination, hasMorePage } from "@/utils/pagination.js";
import { isValidRouteParam } from "@/utils/validate.js";
import { pickDefined } from "@/utils/pickDefined.js";
import { COMMENT_STATUSES, isCommentStatus } from "@/utils/constants.js";
import { sanitize } from "@/utils/sanitize.js";

// CHANGED: notifyRoles/notifyUser were previously defined right here as
// near-duplicates of postController.ts's notifyByRole/notifyUser, each
// with its own inline `pool.query` against the users table. Both files
// now share the single implementation in notificationService.ts, which
// itself delegates the users lookup to userModel.findUserIdsByRoles.

// ============================================
// GET /posts/:postId/comments
// ============================================
export const fetchApprovedComments = async (req: Request, res: Response) => {
  const { postId } = req.params;
  const { limit, offset } = parsePagination(req);

  if (!isValidRouteParam(postId)) {
    return res.status(400).json({ message: "Invalid post ID" });
  }

  try {
    const comments = await getApprovedCommentsByPostId(postId, limit, offset);
    res.json({ comments, limit, offset, hasMore: hasMorePage(comments.length, limit) });
  } catch (error) {
    console.error("fetchApprovedComments error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// GET /comments/:id/replies
// ============================================
export const fetchCommentReplies = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!isValidRouteParam(id)) {
    return res.status(400).json({ message: "Invalid comment ID" });
  }

  try {
    const replies = await getCommentReplies(id);
    res.json(replies);
  } catch (error) {
    console.error("fetchCommentReplies error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// GET /comments  (admin moderation list)
// ============================================
export const fetchAllCommentsForAdmin = async (req: Request, res: Response) => {
  const { limit, offset } = parsePagination(req);
  const status = req.query.status as string | undefined;

  if (status && !isCommentStatus(status)) {
    return res.status(400).json({ message: "Invalid status filter" });
  }

  try {
    const comments = await getAllCommentsForAdmin(limit, offset, status);
    res.json({ comments, limit, offset, hasMore: hasMorePage(comments.length, limit) });
  } catch (error) {
    console.error("fetchAllCommentsForAdmin error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// POST /posts/:postId/comments  (staff)
// ============================================
export const postStaffComment = async (req: Request, res: Response) => {
  const { postId } = req.params;
  const { commentText, parentId } = req.body;

  if (!isValidRouteParam(postId)) {
    return res.status(400).json({ message: "Invalid post ID" });
  }

  if (
    !commentText ||
    typeof commentText !== "string" ||
    commentText.trim().length === 0
  ) {
    return res.status(400).json({ message: "commentText is required" });
  }

  // CHANGED: comment text was previously trimmed but never sanitized,
  // unlike authController.ts's register/updateCurrentUser, even though
  // comment text is user-supplied text that ends up rendered elsewhere.
  const input: CreateStaffCommentInput = {
    postId,
    commentText: sanitize(commentText.trim()),
    ...pickDefined({ parentId }),
  };

  try {
    const comment = await createStaffComment(input, req.user!.id);
    res.status(201).json(comment);
  } catch (error) {
    console.error("postStaffComment error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// POST /posts/:postId/comments/guest  (public)
// ============================================
export const postGuestComment = async (req: Request, res: Response) => {
  const { postId } = req.params;
  const { visitorName, visitorEmail, commentText, parentId } = req.body;

  if (!isValidRouteParam(postId)) {
    return res.status(400).json({ message: "Invalid post ID" });
  }

  if (
    !visitorName ||
    typeof visitorName !== "string" ||
    visitorName.trim().length === 0
  ) {
    return res.status(400).json({ message: "visitorName is required" });
  }

  if (
    !commentText ||
    typeof commentText !== "string" ||
    commentText.trim().length === 0
  ) {
    return res.status(400).json({ message: "commentText is required" });
  }

  // CHANGED: same sanitize gap as postStaffComment above — guest input in
  // particular should never reach the DB/frontend unsanitized.
  const input: CreateGuestCommentInput = {
    postId,
    visitorName: sanitize(visitorName.trim()),
    commentText: sanitize(commentText.trim()),
    ...pickDefined({ visitorEmail, parentId }),
  };

  try {
    const comment = await createGuestComment(input);

    // Notify admins + editors: new comment needs moderation.
    // Authors are NOT notified — moderation is not their responsibility.
    // They get notified separately when a comment is approved (see moderateComment).
    notifyRoles({
      roles: ["admin", "editor"],
      type: "comment",
      message: `New comment from ${input.visitorName} is pending review.`,
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error("postGuestComment error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// PATCH /comments/:id/status  (admin only)
// ============================================
export const moderateComment = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!isValidRouteParam(id)) {
    return res.status(400).json({ message: "Invalid comment ID" });
  }

  if (!isCommentStatus(status)) {
    return res.status(400).json({
      message: `Invalid status. Must be one of: ${COMMENT_STATUSES.join(", ")}`,
    });
  }

  try {
    const updated = await updateCommentStatus(id, status);

    if (!updated) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // When a comment is approved, notify the post author so they know
    // someone engaged with their content.
    // CHANGED: previously ran `pool.query("SELECT author_id, title FROM posts...")`
    // directly here — now goes through postModel, same as postController.ts.
    if (status === "approved" && updated.post_id) {
      try {
        const post = await getPostAuthorAndTitle(updated.post_id);
        if (post?.author_id) {
          notifyUser({
            userId: post.author_id,
            type: "comment",
            message: `A comment on your post "${post.title}" has been approved and is now live.`,
          });
        }
      } catch (err) {
        console.error("[moderateComment] Failed to notify author:", err);
      }
    }

    res.json(updated);
  } catch (error) {
    console.error("moderateComment error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// POST /comments/:id/reply  (staff)
// ============================================
export const replyToComment = async (req: Request, res: Response) => {
  const { id: parentId } = req.params;
  const { commentText } = req.body;

  if (!isValidRouteParam(parentId)) {
    return res.status(400).json({ message: "Invalid comment ID" });
  }

  if (
    !commentText ||
    typeof commentText !== "string" ||
    commentText.trim().length === 0
  ) {
    return res.status(400).json({ message: "commentText is required" });
  }

  try {
    const parentComment = await getCommentById(parentId);

    if (!parentComment) {
      return res.status(404).json({ message: "Parent comment not found" });
    }

    const reply = await createStaffComment(
      {
        postId: parentComment.post_id,
        commentText: commentText.trim(),
        parentId,
      },
      req.user!.id
    );

    await markCommentAsReplied(parentId, req.user!.id);

    res.status(201).json(reply);
  } catch (error) {
    console.error("replyToComment error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// DELETE /comments/:id  (admin only)
// ============================================
export const removeComment = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!isValidRouteParam(id)) {
    return res.status(400).json({ message: "Invalid comment ID" });
  }

  try {
    const existing = await getCommentById(id);

    if (!existing) {
      return res.status(404).json({ message: "Comment not found" });
    }

    await deleteComment(id);
    res.json({ message: "Comment deleted" });
  } catch (error) {
    console.error("removeComment error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
