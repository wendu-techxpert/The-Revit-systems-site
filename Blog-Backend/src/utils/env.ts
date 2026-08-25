// authController.ts fell back to "http://localhost:5500" and
// postController.ts fell back to "https://www.revitsystems.org" for the
// SAME env var (FRONTEND_URL) when it was unset. That's two different
// silent behaviors for one missing config value depending on which file
// happened to need it. One fallback, defined once.
export const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://www.revitsystems.org";
