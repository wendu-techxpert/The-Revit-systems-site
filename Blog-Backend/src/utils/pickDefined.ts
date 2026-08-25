/**
 * Replaces the repeated "build input incrementally to satisfy
 * exactOptionalPropertyTypes" pattern seen in commentController.ts,
 * notificationController.ts, and postViewsController.ts, e.g.:
 *
 *   const input: X = { postId };
 *   if (typeof visitorId === "string" && visitorId.trim().length > 0) {
 *     input.visitorId = visitorId.trim();
 *   }
 *   ...
 *
 * Usage:
 *   const input: CreateGuestCommentInput = {
 *     postId,
 *     visitorName: visitorName.trim(),
 *     commentText: commentText.trim(),
 *     ...pickDefined({ visitorEmail, parentId }),
 *   };
 *
 * Only includes string fields that are non-empty after trimming, which
 * matches the validation semantics every call site was hand-rolling.
 * Non-string values are passed through as-is (trimmed check is skipped).
 */
export function pickDefined<T extends Record<string, unknown>>(
  fields: T
): Partial<T> {
  const result: Partial<T> = {};

  for (const key of Object.keys(fields) as (keyof T)[]) {
    const value = fields[key];

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        result[key] = trimmed as T[typeof key];
      }
      continue;
    }

    if (value !== undefined && value !== null) {
      result[key] = value as T[typeof key];
    }
  }

  return result;
}
