import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  findSessionByTokenId,
  revokeSessionByTokenId,
} from "@/models/sessionModel.js";
import { findUserStatusAndRole } from "@/models/userModel.js";

export const refresh = async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: "No refresh token" });
  }

  const parts = refreshToken.split(".");
  if (parts.length !== 2) {
    return res.status(401).json({ message: "Malformed token" });
  }

  const [tokenId, rawToken] = parts;

  try {
    const session = await findSessionByTokenId(tokenId);

    if (!session || session.is_revoked) {
      return res.status(401).json({ message: "Invalid session" });
    }

    if (new Date(session.expires_at) < new Date()) {
      await revokeSessionByTokenId(tokenId);
      return res.status(401).json({ message: "Session expired" });
    }

    const isValid = await bcrypt.compare(rawToken, session.refresh_token_hash);

    if (!isValid) {
      await revokeSessionByTokenId(tokenId);
      return res.status(401).json({ message: "Invalid session" });
    }

    // Always fetch live role + status so changes take effect within 15 minutes.
    // CHANGED: previously ran `pool.query("SELECT role, status FROM users ...")`
    // directly — the same shape of query authMiddleware.ts had its own copy
    // of. Both now share one model function.
    const user = await findUserStatusAndRole(session.user_id);

    if (!user) {
      await revokeSessionByTokenId(tokenId);
      return res.status(401).json({ message: "User no longer exists" });
    }

    if (user.status === "suspended") {
      await revokeSessionByTokenId(tokenId);
      return res.status(403).json({ message: "Account suspended" });
    }

    if (user.status === "pending") {
      await revokeSessionByTokenId(tokenId);
      return res.status(403).json({ message: "Account pending approval" });
    }

    // No rotation — reuse the existing session.
    // The cookie stays the same; we just issue a fresh 15-minute access token.
    const newAccessToken = jwt.sign(
      {
        id: session.user_id,
        role: user.role,
        sid: tokenId,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "15m" }
    );

    return res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error("refresh error:", error);
    return res
      .status(503)
      .json({ message: "Service temporarily unavailable. Please try again." });
  }
};
