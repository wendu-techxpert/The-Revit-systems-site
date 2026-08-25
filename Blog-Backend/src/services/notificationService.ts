import { findUserIdsByRoles } from "@/models/userModel.js";
import { createNotification } from "@/models/notificationModel.js";

/**
 * This file previously only had notifyActiveAdmins, while
 * commentController.ts (notifyRoles/notifyUser) and postController.ts
 * (notifyByRole/notifyUser) each hand-rolled their own near-identical
 * copies of the same "look up active users by role, then fan out a
 * notification to each of them" logic, including their own raw SQL.
 *
 * Everything notification-related now goes through this one module:
 *   - it's the only place that knows how to fan out a notification
 *   - it's the only place that talks to userModel for role lookups
 *   - a notification failure here NEVER throws — callers fire-and-forget
 *     these and must not have their own response depend on success
 */

export async function notifyRoles(params: {
  roles: string[];
  type: string;
  message: string;
  link?: string;
  excludeUserId?: string;
}): Promise<void> {
  const { roles, type, message, link, excludeUserId } = params;

  try {
    const userIds = await findUserIdsByRoles(roles, excludeUserId);

    await Promise.all(
      userIds.map((userId) =>
        createNotification({
          userId,
          type,
          message,
          ...(link ? { link } : {}),
        })
      )
    );
  } catch (err) {
    console.error("[notifyRoles] Failed:", err);
  }
}

export async function notifyUser(params: {
  userId: string;
  type: string;
  message: string;
  link?: string;
}): Promise<void> {
  const { userId, type, message, link } = params;

  try {
    await createNotification({
      userId,
      type,
      message,
      ...(link ? { link } : {}),
    });
  } catch (err) {
    console.error("[notifyUser] Failed:", err);
  }
}

/**
 * Thin convenience wrapper kept for call sites that only ever notify
 * admins (register, updateCurrentUser). Delegates to notifyRoles so
 * there's still only one fan-out implementation underneath.
 */
export async function notifyActiveAdmins(params: {
  message: string;
  excludeUserId?: string;
}): Promise<void> {
  return notifyRoles({
    roles: ["admin"],
    type: "user",
    message: params.message,
    ...(params.excludeUserId ? { excludeUserId: params.excludeUserId } : {}),
  });
}
