import { Request, Response } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sanitize } from "@/utils/sanitize.js";
import { createSession } from "@/models/sessionModel.js";
import {
  createUser,
  findUserByEmail,
  findUserById,
  updateLastLogin,
  updateUserStatus,
  updateUserData,
} from "@/models/userModel.js";
import {
  deleteResetTokensForUser,
  createResetToken,
  findResetTokenByUserId,
} from "@/models/passwordResetTokenModel.js";
import { recordLogin } from "@/models/loginHistoryModel.js";
import { sendEmail } from "@/utils/sendEmail.js";
import { notifyActiveAdmins } from "@/services/notificationService.js";
import { passwordResetEmailHtml } from "@/utils/emailTemplates.js";
import { FRONTEND_URL } from "@/utils/env.js";
import { USER_STATUSES, isUserStatus } from "@/utils/constants.js";
import { pool } from "@/config/db.js";

// CHANGED, file-wide:
// - password_reset_tokens queries moved into passwordResetTokenModel.ts
//   (this file previously ran 4 separate raw queries against that table
//   directly — a whole feature's SQL with no model, and a Law of Demeter
//   violation).
// - admin-notification fan-out (register, updateCurrentUser) now goes
//   through notificationService.notifyActiveAdmins instead of each
//   function running its own inline `pool.query("... role = 'admin' ...")`.
// - the password-reset email's HTML now lives in utils/emailTemplates.ts.
// - FRONTEND_URL fallback now comes from utils/env.ts, so it's the same
//   value everywhere instead of drifting per-file (this file previously
//   fell back to "http://localhost:5500", postController.ts fell back to
//   the production URL, for the same env var).
// - resetPassword's transaction still does a raw multi-table transaction
//   (password_hash update + session revocation + token delete) — that's
//   legitimately transactional business logic, not just a lookup, so it's
//   left as a direct pool.connect()/BEGIN/COMMIT here rather than forced
//   into three separate model calls that couldn't share one transaction.

// ============================================
// 1. REGISTER NEW USER
// ============================================
export const register = async (req: Request, res: Response) => {
  const { first_name, last_name, email, password } = req.body;

  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const cleanFirstName = sanitize(first_name);
  const cleanLastName = sanitize(last_name);
  const cleanEmail = sanitize(email).trim().toLowerCase();

  try {
    const existingUser = await findUserByEmail(cleanEmail);
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await createUser(
      cleanFirstName,
      cleanLastName,
      cleanEmail,
      hashedPassword,
      "user",
      "pending"
    );

    // Notify all active admins that a new user is pending approval.
    // Fire-and-forget — never delay the registration response.
    notifyActiveAdmins({
      message: `New user ${cleanFirstName} ${cleanLastName} (${cleanEmail}) is pending approval.`,
    });

    res
      .status(201)
      .json({ id: user.id, email: user.email, status: user.status });
  } catch (error) {
    console.error("register error:", error);
    res
      .status(503)
      .json({ message: "Service temporarily unavailable. Please try again." });
  }
};

// ============================================
// 2. LOGIN USER
// ============================================
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ message: "Invalid input format" });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const user = await findUserByEmail(cleanEmail);

    if (!user) {
      await recordLogin(null, req, false);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      await recordLogin(user.id, req, false);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.status === "pending") {
      return res.status(403).json({ message: "Account pending approval" });
    }

    if (user.status === "suspended") {
      return res.status(403).json({ message: "Account suspended" });
    }

    await recordLogin(user.id, req, true);
    await updateLastLogin(user.id);

    const tokenId = crypto.randomUUID();
    const rawRefreshToken = crypto.randomBytes(64).toString("hex");
    const refreshTokenHash = await bcrypt.hash(rawRefreshToken, 10);

    await createSession({
      userId: user.id,
      tokenId,
      refreshTokenHash,
      userAgent: req.headers["user-agent"] || "",
      ipAddress: req.ip || "",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const accessToken = jwt.sign(
      {
        id: user.id,
        role: user.role,
        sid: tokenId,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "15m" }
    );

    res.cookie("refreshToken", `${tokenId}.${rawRefreshToken}`, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/auth/refresh",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ accessToken });
  } catch (error) {
    console.error("login error:", error);
    return res
      .status(503)
      .json({ message: "Service temporarily unavailable. Please try again." });
  }
};

// ============================================
// 3. REQUEST PASSWORD RESET (Forgot Password)
// ============================================
export const requestPasswordReset = async (req: Request, res: Response) => {
  const { email } = req.body;

  // Always return the same message to prevent user enumeration
  const genericResponse = {
    message:
      "If an account with that email exists, a reset link has been sent. Check your spam folder if it doesn't appear in your inbox.",
  };

  if (!email || typeof email !== "string") {
    return res.json(genericResponse);
  }

  try {
    const user = await findUserByEmail(email.toLowerCase().trim());

    if (!user) {
      return res.json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await deleteResetTokensForUser(user.id);
    await createResetToken(user.id, tokenHash, expiresAt);

    // token and id go in the query string so reset-password.html can read them
    const resetLink = `${FRONTEND_URL}/pages/reset-password.html?token=${rawToken}&id=${user.id}`;

    await sendEmail({
      email: user.email,
      subject: "Password Reset Request — Revit Systems",
      message: passwordResetEmailHtml(resetLink),
    });

    res.json(genericResponse);
  } catch (error) {
    console.error("requestPasswordReset error:", error);
    // Still return the generic message — don't leak whether the email exists
    res.json(genericResponse);
  }
};

// ============================================
// 4. RESET PASSWORD (Finalize)
// ============================================
export const resetPassword = async (req: Request, res: Response) => {
  const { userId, token, newPassword } = req.body;

  if (!userId || !token || !newPassword) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res
      .status(400)
      .json({ message: "Password must be at least 8 characters" });
  }

  let tokenRecord;
  try {
    tokenRecord = await findResetTokenByUserId(userId);

    if (!tokenRecord) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset link." });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      await deleteResetTokensForUser(userId);
      return res.status(400).json({ message: "Reset link has expired." });
    }
  } catch (error) {
    console.error("resetPassword lookup error:", error);
    return res
      .status(503)
      .json({ message: "Service temporarily unavailable. Please try again." });
  }

  const incomingHash = crypto.createHash("sha256").update(token).digest("hex");
  if (incomingHash !== tokenRecord.token_hash) {
    return res.status(400).json({ message: "Invalid reset token." });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // This step is a genuine multi-table transaction (password update +
  // session revocation + token cleanup must succeed or fail together), so
  // it stays as a direct pool.connect()/BEGIN/COMMIT rather than being
  // split across three model calls that couldn't share the transaction.
  let client;
  try {
    client = await pool.connect();
  } catch (error) {
    console.error("resetPassword connect error:", error);
    return res
      .status(503)
      .json({ message: "Service temporarily unavailable. Please try again." });
  }

  try {
    await client.query("BEGIN");

    await client.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [hashedPassword, userId]
    );

    await client.query(
      "UPDATE sessions SET is_revoked = true, updated_at = NOW() WHERE user_id = $1",
      [userId]
    );

    await client.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [
      userId,
    ]);

    await client.query("COMMIT");

    res.json({ message: "Password updated successfully! You can now log in." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Reset Password Error:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

// ============================================
// 5. UPDATE USER STATUS (Admin Only)
// ============================================
export const changeUserStatus = async (req: Request, res: Response) => {
  const { userId, status } = req.body;

  if (!isUserStatus(status)) {
    return res.status(400).json({
      message: `Invalid status type. Must be one of: ${USER_STATUSES.join(", ")}`,
    });
  }

  try {
    const updatedUser = await updateUserStatus(userId, status);

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: `User status updated to ${status} successfully.`,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// 6. GET CURRENT USER  (self profile — "who am I")
// ============================================
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const user = await findUserById(req.user!.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("getCurrentUser error:", error);
    res
      .status(503)
      .json({ message: "Service temporarily unavailable. Please try again." });
  }
};

// ============================================
// 7. UPDATE CURRENT USER  (self profile — every logged-in role)
//
// This was previously entirely fake on the frontend — the profile form
// only updated in-memory AppState and always showed "success", nothing
// was ever persisted or sent to the server. This is the real endpoint.
//
// Email is intentionally NOT editable here, consistent with the admin
// edit-user modal elsewhere in the app ("Email changes must go through
// a reset flow") — changing your own login email with no verification
// step would be an account-takeover risk, so only first/last name are
// updatable through this route.
// ============================================
export const updateCurrentUser = async (req: Request, res: Response) => {
  const { firstName, lastName } = req.body;

  if (
    (firstName === undefined || firstName === null) &&
    (lastName === undefined || lastName === null)
  ) {
    return res.status(400).json({ message: "Nothing to update" });
  }

  const updates: { firstName?: string; lastName?: string } = {};

  if (typeof firstName === "string") {
    const clean = sanitize(firstName).trim();
    if (clean.length === 0) {
      return res.status(400).json({ message: "First name cannot be empty" });
    }
    updates.firstName = clean;
  }

  if (typeof lastName === "string") {
    const clean = sanitize(lastName).trim();
    if (clean.length === 0) {
      return res.status(400).json({ message: "Last name cannot be empty" });
    }
    updates.lastName = clean;
  }

  try {
    const updated = await updateUserData(req.user!.id, updates);

    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    // Fire-and-forget — every role (admin, editor, author) triggers this,
    // so admins always know when any account's info changes.
    notifyActiveAdmins({
      message: `${updated.first_name} ${updated.last_name} updated their profile information.`,
      excludeUserId: updated.id,
    });

    res.json(updated);
  } catch (error) {
    console.error("updateCurrentUser error:", error);
    res
      .status(503)
      .json({ message: "Service temporarily unavailable. Please try again." });
  }
};
