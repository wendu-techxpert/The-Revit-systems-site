import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { findSessionByTokenId } from "@/models/sessionModel.js";
import { findUserStatusAndRole } from "@/models/userModel.js";

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  // Step 1: verify the JWT itself. Failures here (bad signature, malformed,
  // or genuinely expired) are real auth failures — 401 is correct.
  let decoded: { id: string; role: string; sid: string };
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
      role: string;
      sid: string;
    };
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  // Step 2: look up the session / user status in the DB. Failures here are
  // infrastructure problems (e.g. a dropped connection to Supabase), not
  // proof the token is bad — they must NOT be reported as 401, or the
  // frontend will treat a transient DB hiccup as "log this user out".
  try {
    // Verify the session exists and has not been revoked.
    // This is what makes logout actually work — a revoked session
    // blocks the request even if the JWT itself is still within its 15m window.
    const session = await findSessionByTokenId(decoded.sid);

    if (!session || session.is_revoked) {
      return res.status(401).json({ message: "Session invalidated" });
    }

    // Re-check the user's current status on every request.
    // Without this, a suspended user whose session was not explicitly
    // revoked can keep making authenticated requests until their JWT expires.
    // changeUserStatus in authController.ts updates the users table but does
    // not call revokeAllSessions, so this check is the only safety net.
    //
    // CHANGED: previously ran `pool.query("SELECT status FROM users ...")`
    // directly, duplicating table/column knowledge that refreshController.ts
    // also had its own copy of. Now both go through the same model function.
    const user = await findUserStatusAndRole(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }

    if (user.status === "suspended") {
      return res.status(403).json({ message: "Account suspended" });
    }

    if (user.status === "pending") {
      return res.status(403).json({ message: "Account pending approval" });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error("authenticate DB error:", error);
    return res
      .status(503)
      .json({ message: "Service temporarily unavailable. Please try again." });
  }
};
