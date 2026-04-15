import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet"; // Install this: npm install helmet
import rateLimit from "express-rate-limit"; // Install this: npm install express-rate-limit
import postRoutes from "@/routes/postRoutes.js";
import authRoutes from "@/routes/authRoutes.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Basic Security Headers (Prevents XSS, Click jacking, etc.)
app.use(helmet());

// 2. CORS and Body Parsing
app.use(cors());
app.use(express.json({ limit: "10kb" })); // Protection against Large Payload attacks
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests. Take a breather!",
});
app.use(globalLimiter);

// 2. Strict protection for Login/Register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Exactly what you asked for: 10 attempts per 15 mins
  message: {
    status: 429,
    message: "Too many attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use(express.static(path.join(__dirname, "../../")));

// Apply the strict limiter ONLY to auth routes
app.use("/auth", authLimiter, authRoutes);
app.use("/posts", postRoutes);

export default app;
