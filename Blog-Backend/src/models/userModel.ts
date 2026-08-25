import { pool } from "@/config/db.js";

export const findUserByEmail = async (email: string) => {
  const result = await pool.query(
    "SELECT id, first_name, last_name, email, password_hash, role, status FROM users WHERE email = $1",
    [email]
  );
  return result.rows[0];
};

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

export const updateLastLogin = async (userId: string) => {
  return await pool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [
    userId,
  ]);
};

// ── Admin Extensions Moved From Controller ───────────────────

export const findManyUsers = async (filters: {
  limit: number;
  offset: number;
  status?: string;
  role?: string;
}) => {
  const { limit, offset, status, role } = filters;
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (status) {
    conditions.push(`status = $${idx++}`);
    values.push(status);
  }
  if (role) {
    conditions.push(`role = $${idx++}`);
    values.push(role);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  values.push(limit, offset);
  const limitIdx = idx++;
  const offsetIdx = idx;

  const result = await pool.query(
    `SELECT id, first_name, last_name, email, role, status, created_at, last_login
     FROM users
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values
  );

  return result.rows;
};

export const findUserById = async (id: string) => {
  const result = await pool.query(
    `SELECT id, first_name, last_name, email, role, status, created_at, last_login
     FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0];
};

/**
 * NEW — narrow lookup used by authMiddleware.ts and refreshController.ts.
 * Both previously ran their own inline `SELECT status FROM users` /
 * `SELECT role, status FROM users` against pool directly, duplicating
 * knowledge of the users table schema outside the model layer (a Law of
 * Demeter violation — middleware should ask the model for what it needs,
 * not query the table itself). refreshController needs role too, so this
 * returns both; callers that only need status just ignore role.
 */
export const findUserStatusAndRole = async (
  id: string
): Promise<{ role: string; status: string } | undefined> => {
  const result = await pool.query(
    "SELECT role, status FROM users WHERE id = $1",
    [id]
  );
  return result.rows[0];
};

/**
 * NEW — replaces the raw `SELECT id FROM users WHERE role IN (...)`
 * queries that were previously duplicated in commentController.ts
 * (notifyRoles), postController.ts (notifyByRole), and scheduler.ts.
 * Centralizing this in the model also means `status = 'active'` and the
 * exclude-self filter only need to be correct in one place.
 */
export const findUserIdsByRoles = async (
  roles: string[],
  excludeUserId?: string
): Promise<string[]> => {
  const placeholders = roles.map((_, i) => `$${i + 1}`).join(", ");
  const result = await pool.query(
    `SELECT id FROM users WHERE role IN (${placeholders}) AND status = 'active'`,
    roles
  );
  const rows: { id: string }[] = result.rows;
  return excludeUserId
    ? rows.filter((u) => u.id !== excludeUserId).map((u) => u.id)
    : rows.map((u) => u.id);
};

export const updateUserStatus = async (userId: string, status: string) => {
  const result = await pool.query(
    `UPDATE users
     SET status = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, first_name, last_name, email, role, status, created_at, last_login`,
    [status, userId]
  );
  return result.rows[0];
};

export const updateUserData = async (
  id: string,
  updates: {
    firstName?: string;
    lastName?: string;
    role?: string;
    status?: string;
  }
) => {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (updates.firstName !== undefined) {
    fields.push(`first_name = $${idx++}`);
    values.push(updates.firstName.trim());
  }
  if (updates.lastName !== undefined) {
    fields.push(`last_name = $${idx++}`);
    values.push(updates.lastName.trim());
  }
  if (updates.role !== undefined) {
    fields.push(`role = $${idx++}`);
    values.push(updates.role);
  }
  if (updates.status !== undefined) {
    fields.push(`status = $${idx++}`);
    values.push(updates.status);
  }

  if (fields.length === 0) return null;

  values.push(id);

  const result = await pool.query(
    `UPDATE users
     SET ${fields.join(", ")}
     WHERE id = $${idx}
     RETURNING id, first_name, last_name, email, role, status, created_at, last_login`,
    values
  );

  return result.rows[0];
};

export const deleteUserById = async (id: string) => {
  const result = await pool.query(
    "DELETE FROM users WHERE id = $1 RETURNING id",
    [id]
  );
  return result.rowCount ? result.rowCount > 0 : false;
};
