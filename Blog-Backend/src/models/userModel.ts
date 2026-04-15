import { pool } from "@/config/db.js";

/**
 * Find a user by email
 * Includes all columns needed for login gatekeeping and password resets
 */
export const findUserByEmail = async (email: string) => {
  const result = await pool.query(
    "SELECT id, first_name, last_name, email, password_hash, role, status FROM users WHERE email = $1",
    [email]
  );
  // Helpful for your Fedora dev terminal to see what's being returned
  console.log("User found:", result.rows[0]?.email || "None");
  return result.rows[0];
};

/**
 * Create a new user (used in Registration)
 */
export const createUser = async (
  first_name: string,
  last_name: string,
  email: string,
  password_hash: string,
  role: string = "user",
  status: string = "pending"
) => {
  const result = await pool.query(
    `INSERT INTO users (first_name, last_name, email, password_hash, role, status) 
     VALUES ($1, $2, $3, $4, $5, $6) 
     RETURNING id, email, first_name, last_name, status, role`,
    [first_name, last_name, email, password_hash, role, status]
  );

  return result.rows[0];
};

/**
 * Update the user's password (used in Reset Password)
 * This function should be called within the controller's transaction
 */
export const updateUserPassword = async (
  userId: string,
  hashedPassword: string
) => {
  const result = await pool.query(
    "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id",
    [hashedPassword, userId]
  );
  return result.rows[0];
};

/**
 * Update the last login timestamp (used in Login)
 */
export const updateLastLogin = async (userId: string) => {
  return await pool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [
    userId,
  ]);
};

/**
 * Admin function: Update user status (approve/suspend/activate)
 */
export const updateUserStatus = async (
  userId: string,
  status: "active" | "suspended" | "pending"
) => {
  const result = await pool.query(
    "UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status",
    [status, userId]
  );
  return result.rows[0];
};
