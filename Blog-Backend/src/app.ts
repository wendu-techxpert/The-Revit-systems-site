import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";

// ── Existing routes (unchanged) ───────────────────────────────
import postRoutes from "@/routes/postRoutes.js";
import authRoutes from "@/routes/authRoutes.js";
import refreshRoutes from "@/routes/refreshRoutes.js";

// ── New routes ────────────────────────────────────────────────
import categoryRoutes from "@/routes/categoryRoutes.js";
import { postCommentRouter, commentRouter } from "@/routes/commentRoutes.js";
import postAnalyticsRoutes from "@/routes/postAnalyticsRoutes.js";
import notificationRoutes from "@/routes/notificationRoutes.js";
import userRoutes from "@/routes/userRoutes.js";

// ── New: needed for the /auth/me endpoint ──────────────────────
import { authenticate } from "@/middleware/authMiddleware.js";
import {
  getCurrentUser,
  updateCurrentUser,
} from "@/controllers/authController.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(helmet());

app.use(
  cors({
    origin: [
      "https://www.revitsystems.org",
      "http://localhost:5500",
      "http://127.0.0.1:5500",
    ],
    credentials: true,
  })
);

app.use(cookieParser());

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests. Take a breather!",
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    status: 429,
    message: "Too many attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.static(path.join(__dirname, "../../")));

app.set("trust proxy", 1);

app.get("/health", (req, res) => {
  try {
    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.log("Health check failed:", err);
    res.status(503).json({ status: "error" });
  }
});

// ── Auth (existing) ───────────────────────────────────────────
app.use("/auth/refresh", refreshRoutes);

app.get("/auth/me", authenticate, getCurrentUser);
app.patch("/auth/me", authenticate, updateCurrentUser);

app.use("/auth", authLimiter, authRoutes);

// ── Global rate limiter (existing) ───────────────────────────
app.use(globalLimiter);

// ── Posts (existing) ─────────────────────────────────────────
app.use("/posts", postRoutes);

// ── Post-scoped sub-resources (new) ──────────────────────────
app.use("/posts/:postId/comments", postCommentRouter);
app.use("/posts/:postId", postAnalyticsRoutes);

// ── Standalone resource routes (new) ─────────────────────────
app.use("/categories", categoryRoutes);
app.use("/comments", commentRouter); // Admin moderation + replies
app.use("/notifications", notificationRoutes);

// ── User management (New) ───────────────────────────────
app.use("/users", userRoutes); // <-- Pass the imported router here

export default app;
