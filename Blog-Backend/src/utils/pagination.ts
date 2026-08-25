import { Request } from "express";

export interface ParsedPagination {
  limit: number;
  offset: number;
}

/**
 * Parses ?limit=&offset= from a request, applying the same default
 * (limit 20, offset 0) that was previously copy-pasted into every
 * list endpoint (categoryController, commentController,
 * notificationController, postViewsController, userController...).
 *
 * postController.fetchPosts is the one outlier that defaults limit to
 * 10 instead of 20 — pass a defaultLimit override for cases like that
 * rather than re-deriving the whole block.
 */
export const parsePagination = (
  req: Request,
  defaultLimit = 20
): ParsedPagination => {
  const limit = Number(req.query.limit) || defaultLimit;
  const offset = Number(req.query.offset) || 0;
  return { limit, offset };
};

/**
 * The "did we get a full page back" heuristic used everywhere to decide
 * hasMore, without doing a separate COUNT(*) query.
 */
export const hasMorePage = (rowCount: number, limit: number): boolean =>
  rowCount === limit;
