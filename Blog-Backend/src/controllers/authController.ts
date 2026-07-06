import { Request, Response } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "@/config/db.js";
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
import { recordLogin } from "@/models/loginHistoryModel.js";
import { sendEmail } from "@/utils/sendEmail.js";
import { createNotification } from "@/models/notificationModel.js";

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
    (async () => {
      try {
        const admins = await pool.query(
          `SELECT id FROM users WHERE role = 'admin' AND status = 'active'`
        );
        await Promise.all(
          admins.rows.map((a) =>
            createNotification({
              userId: a.id,
              type: "user",
              message: `New user ${cleanFirstName} ${cleanLastName} (${cleanEmail}) is pending approval.`,
            })
          )
        );
      } catch (err) {
        console.error("[register] Failed to create admin notifications:", err);
      }
    })();

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

    await pool.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [
      user.id,
    ]);
    await pool.query(
      "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
      [user.id, tokenHash, expiresAt]
    );

    // Use FRONTEND_URL env var so the link works in production.
    // Falls back to localhost for local dev if the var is not set.
    const frontendBase = process.env.FRONTEND_URL || "http://localhost:5500";

    // token and id go in the query string so reset-password.html can read them
    const resetLink = `${frontendBase}/pages/reset-password.html?token=${rawToken}&id=${user.id}`;

    await sendEmail({
      email: user.email,
      subject: "Password Reset Request — Revit Systems",
      message: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #eee;border-radius:8px;">
          <h2 style="color:#d17609;">Password Reset</h2>
          <p>You requested a password reset for your Revit Systems account.</p>
          <p>Click the button below to set a new password. This link is valid for <strong>1 hour</strong>.</p>
          <p style="margin:32px 0;">
            <a href="${resetLink}"
               style="background:#d17609;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">
              Reset Password
            </a>
          </p>
          <p style="font-size:0.85rem;color:#666;">
            If you did not request this, you can safely ignore this email.<br/>
            The link will expire in 1 hour.
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
          <p style="font-size:0.75rem;color:#aaa;">Revit Systems · revitsystems@gmail.com</p>
        </div>
      `,
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
    const tokenResult = await pool.query(
      "SELECT * FROM password_reset_tokens WHERE user_id = $1",
      [userId]
    );
    tokenRecord = tokenResult.rows[0];

    if (!tokenRecord) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset link." });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      await pool.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [
        userId,
      ]);
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

  const validStatuses = ["active", "suspended", "pending"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid status type" });
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
const notifyAdminsOfProfileChange = async (
  userId: string,
  fullName: string
): Promise<void> => {
  try {
    const admins = await pool.query(
      `SELECT id FROM users WHERE role = 'admin' AND status = 'active' AND id != $1`,
      [userId]
    );
    await Promise.all(
      admins.rows.map((a) =>
        createNotification({
          userId: a.id,
          type: "user",
          message: `${fullName} updated their profile information.`,
        })
      )
    );
  } catch (err) {
    console.error("[updateCurrentUser] Failed to notify admins:", err);
  }
};

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
    notifyAdminsOfProfileChange(
      updated.id,
      `${updated.first_name} ${updated.last_name}`
    );

    res.json(updated);
  } catch (error) {
    console.error("updateCurrentUser error:", error);
    res
      .status(503)
      .json({ message: "Service temporarily unavailable. Please try again." });
  }
};
