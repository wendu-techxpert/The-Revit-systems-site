import { pool } from "@/config/db.js";

/**
 * NEW FILE — every password_reset_tokens query previously lived inline
 * inside authController.ts (requestPasswordReset and resetPassword ran
 * four separate raw `pool.query` calls against this table between them).
 * There was no model for an entire feature area. Moving it here fixes
 * the Law of Demeter violation and means the token lifecycle (create,
 * look up, delete, expire) has one home instead of being scattered
 * across controller functions.
 */

export interface PasswordResetTokenRow {
  user_id: string;
  token_hash: string;
  expires_at: Date;
}

export const deleteResetTokensForUser = async (userId: string): Promise<void> => {
  await pool.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [
    userId,
  ]);
};

export const createResetToken = async (
  userId: string,
  tokenHash: string,
  expiresAt: Date
): Promise<void> => {
  await pool.query(
    "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, tokenHash, expiresAt]
  );
};

export const findResetTokenByUserId = async (
  userId: string
): Promise<PasswordResetTokenRow | undefined> => {
  const result = await pool.query(
    "SELECT * FROM password_reset_tokens WHERE user_id = $1",
    [userId]
  );
  return result.rows[0];
};
