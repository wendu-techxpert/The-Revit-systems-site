// Single source of truth for enum-like values that were previously
// hardcoded as separate array literals in authController.ts,
// userController.ts, and commentController.ts. Keeping one copy means
// a new status/role only has to be added in one place, and it can't
// silently drift out of sync with the DB check constraints.

export const USER_STATUSES = ["active", "suspended", "pending"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_ROLES = ["admin", "editor", "author"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const COMMENT_STATUSES = ["approved", "pending", "rejected"] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];

export const isUserStatus = (value: unknown): value is UserStatus =>
  typeof value === "string" && (USER_STATUSES as readonly string[]).includes(value);

export const isUserRole = (value: unknown): value is UserRole =>
  typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);

export const isCommentStatus = (value: unknown): value is CommentStatus =>
  typeof value === "string" && (COMMENT_STATUSES as readonly string[]).includes(value);
