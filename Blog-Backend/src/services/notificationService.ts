import { pool } from "@/config/db.js";
import { createNotification } from "@/models/notificationModel.js";

/**
 * notifyActiveAdmins
 *
 * Sends a notification to every currently active admin.
 * Best-effort: failures are logged, never thrown — callers must not
 * depend on this succeeding or await it for correctness (see any
 * caller's contract, invariant "notification failure never affects
 * the caller's own response").
 *
 * @param excludeUserId - optional admin id to skip (e.g. don't notify
 *   an admin about their own action)
 */
export async function notifyActiveAdmins(params: {
  message: string;
  excludeUserId?: string;
}): Promise<void> {
  const { message, excludeUserId } = params;
  try {
    const admins = excludeUserId
      ? await pool.query(
          `SELECT id FROM users WHERE role = 'admin' AND status = 'active' AND id != $1`,
          [excludeUserId]
        )
      : await pool.query(
          `SELECT id FROM users WHERE role = 'admin' AND status = 'active'`
        );

    await Promise.all(
      admins.rows.map((a: { id: string }) =>
        createNotification({ userId: a.id, type: "user", message })
      )
    );
  } catch (err) {
    console.error("[notifyActiveAdmins] failed:", err);
  }
}
