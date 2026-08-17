import {
  register,
  login,
  requestPasswordReset,
  resetPassword,
  changeUserStatus,
  getCurrentUser,
  updateCurrentUser,
} from "@/controllers/authController.js";
import { pool } from "@/config/db.js";
import { sendEmail } from "@/utils/sendEmail.js";
import { recordLogin } from "@/models/loginHistoryModel.js";
import { createSession } from "@/models/sessionModel.js";
import {
  createUser,
  findUserByEmail,
  findUserById,
  updateLastLogin,
  updateUserStatus,
  updateUserData,
} from "@/models/userModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

jest.mock("@/config/db.js", () => ({ pool: { query: jest.fn(), connect: jest.fn() } }));
jest.mock("@/utils/sendEmail.js");
jest.mock("@/models/loginHistoryModel.js");
jest.mock("@/models/sessionModel.js");
jest.mock("@/models/userModel.js");
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  return res;
}

function mockClient() {
  return { query: jest.fn().mockResolvedValue({}), release: jest.fn() };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = "test-secret";
});

/* ================================================================
 * CONTRACT: register(first_name, last_name, email, password)
 *
 * Preconditions:
 *   P1: first_name, last_name, email, password are all present
 *   P2: password is hashable by bcrypt (a string)
 *
 * Postconditions (P1,P2 hold, email not taken):
 *   Q1: user row created with role "user", status "pending"
 *   Q2: stored password is a bcrypt hash, never the raw password
 *   Q3: response is 201 with { id, email, status }
 *
 * Postconditions (email already taken):
 *   Q4: no user row created, response is 400 "User already exists"
 *
 * Invariants:
 *   I1: raw password is never logged, returned, or stored
 * ================================================================ */
describe("register", () => {
  const body = {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ADA@Example.com ",
    password: "supersecret",
  };

  test("P1: missing a required field -> 400, no DB access", async () => {
    const req: any = { body: { ...body, first_name: "" } };
    const res = mockRes();
    await register(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(findUserByEmail).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });

  test("Q1-Q3: valid input creates pending user with hashed password, returns 201", async () => {
    (findUserByEmail as jest.Mock).mockResolvedValueOnce(null);
    (bcrypt.hash as jest.Mock).mockResolvedValueOnce("hashed-pw");
    (createUser as jest.Mock).mockResolvedValueOnce({
      id: "u1",
      email: "ada@example.com",
      status: "pending",
    });
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // admin notify lookup

    const req: any = { body };
    const res = mockRes();
    await register(req, res);

    expect(createUser).toHaveBeenCalledWith(
      "Ada",
      "Lovelace",
      "ada@example.com",
      "hashed-pw",
      "user",
      "pending"
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      id: "u1",
      email: "ada@example.com",
      status: "pending",
    });
  });

  test("I1: raw password never appears in the createUser call", async () => {
    (findUserByEmail as jest.Mock).mockResolvedValueOnce(null);
    (bcrypt.hash as jest.Mock).mockResolvedValueOnce("hashed-pw");
    (createUser as jest.Mock).mockResolvedValueOnce({
      id: "u1",
      email: "ada@example.com",
      status: "pending",
    });
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const req: any = { body };
    const res = mockRes();
    await register(req, res);

    const args = (createUser as jest.Mock).mock.calls[0];
    expect(args).not.toContain(body.password);
  });

  test("Q4: existing email -> 400, no user created", async () => {
    (findUserByEmail as jest.Mock).mockResolvedValueOnce({ id: "existing" });
    const req: any = { body };
    const res = mockRes();
    await register(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(createUser).not.toHaveBeenCalled();
  });
});

/* ================================================================
 * CONTRACT: login(email, password)
 *
 * Preconditions:
 *   P1: email and password are both strings
 *
 * Postconditions (correct email + correct password + active account):
 *   Q1: a session is created AND a matching JWT access token is
 *       returned together — never one without the other
 *   Q2: response includes accessToken; refreshToken cookie is set
 *       httpOnly, secure, path "/auth/refresh"
 *   Q3: recordLogin(userId, req, true) and updateLastLogin(userId) are called
 *
 * Postconditions (wrong email OR wrong password):
 *   Q4: response is 401 "Invalid credentials" in BOTH cases — identical
 *       message, so a caller cannot distinguish "no such email" from
 *       "wrong password" (enumeration protection)
 *   Q5: recordLogin is called with success=false
 *
 * Postconditions (correct credentials, but pending/suspended account):
 *   Q6: response is 403 with the specific status reason; NO session
 *       or token is created
 *
 * Invariants:
 *   I1: a failed login attempt is always recorded (recordLogin called)
 *       exactly once, success or failure
 *   I2: no JWT is ever issued for a pending or suspended account
 * ================================================================ */
describe("login", () => {
  const body = { email: "ada@example.com", password: "correct-pw" };

  test("P1: non-string email/password -> 400, no lookup", async () => {
    const req: any = { body: { email: 123, password: "x" } };
    const res = mockRes();
    await login(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  test("Q4/Q5: unknown email -> 401 'Invalid credentials', recordLogin(null, req, false)", async () => {
    (findUserByEmail as jest.Mock).mockResolvedValueOnce(undefined);
    const req: any = { body, headers: {}, ip: "1.2.3.4" };
    const res = mockRes();
    await login(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid credentials" })
    );
    expect(recordLogin).toHaveBeenCalledWith(null, req, false);
  });

  test("Q4/Q5: wrong password -> SAME 401 message as unknown email, recordLogin(user.id, req, false)", async () => {
    (findUserByEmail as jest.Mock).mockResolvedValueOnce({
      id: "u1",
      password_hash: "stored-hash",
      role: "author",
      status: "active",
    });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
    const req: any = { body, headers: {}, ip: "1.2.3.4" };
    const res = mockRes();
    await login(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid credentials" })
    );
    expect(recordLogin).toHaveBeenCalledWith("u1", req, false);
  });

  test("Q6/I2: correct credentials but pending account -> 403, no session, no token", async () => {
    (findUserByEmail as jest.Mock).mockResolvedValueOnce({
      id: "u1",
      password_hash: "stored-hash",
      role: "author",
      status: "pending",
    });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
    const req: any = { body, headers: {}, ip: "1.2.3.4" };
    const res = mockRes();
    await login(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(createSession).not.toHaveBeenCalled();
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  test("Q6/I2: correct credentials but suspended account -> 403, no session, no token", async () => {
    (findUserByEmail as jest.Mock).mockResolvedValueOnce({
      id: "u1",
      password_hash: "stored-hash",
      role: "author",
      status: "suspended",
    });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
    const req: any = { body, headers: {}, ip: "1.2.3.4" };
    const res = mockRes();
    await login(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(createSession).not.toHaveBeenCalled();
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  test("Q1-Q3: valid active-user login -> session + JWT issued together, cookie set, response has accessToken", async () => {
    (findUserByEmail as jest.Mock).mockResolvedValueOnce({
      id: "u1",
      password_hash: "stored-hash",
      role: "author",
      status: "active",
    });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
    (bcrypt.hash as jest.Mock).mockResolvedValueOnce("refresh-hash");
    (jwt.sign as jest.Mock).mockReturnValueOnce("signed-jwt");

    const req: any = { body, headers: { "user-agent": "jest" }, ip: "1.2.3.4" };
    const res = mockRes();
    await login(req, res);

    expect(recordLogin).toHaveBeenCalledWith("u1", req, true);
    expect(updateLastLogin).toHaveBeenCalledWith("u1");
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", refreshTokenHash: "refresh-hash" })
    );
    // Q1: session AND token both exist together — proven by both calls happening
    expect(jwt.sign).toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith(
      "refreshToken",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        path: "/auth/refresh",
      })
    );
    expect(res.json).toHaveBeenCalledWith({ accessToken: "signed-jwt" });
  });
});

/* ================================================================
 * CONTRACT: requestPasswordReset(email)
 *
 * Preconditions: none that reject with an error — this endpoint is
 *   deliberately tolerant of bad/missing input (see invariant I1).
 *
 * Postconditions (email belongs to a real user):
 *   Q1: any prior reset token for that user is deleted, a new one
 *       inserted with a 1-hour expiry
 *   Q2: an email is sent to that user containing a reset link
 *   Q3: response is the generic message
 *
 * Invariants:
 *   I1: response is IDENTICAL generic text regardless of whether the
 *       email exists, is malformed, or an internal error occurred —
 *       this endpoint must never reveal whether an email is registered
 *   I2: no email is ever sent for an email that has no matching user
 * ================================================================ */
describe("requestPasswordReset", () => {
  const GENERIC = expect.objectContaining({
    message: expect.stringMatching(/if an account with that email exists/i),
  });

  test("I1/I2: unknown email -> generic response, no email sent", async () => {
    (findUserByEmail as jest.Mock).mockResolvedValueOnce(undefined);
    const req: any = { body: { email: "nobody@example.com" } };
    const res = mockRes();
    await requestPasswordReset(req, res);
    expect(res.json).toHaveBeenCalledWith(GENERIC);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("I1: missing/malformed email -> SAME generic response, no DB access", async () => {
    const req: any = { body: {} };
    const res = mockRes();
    await requestPasswordReset(req, res);
    expect(res.json).toHaveBeenCalledWith(GENERIC);
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  test("Q1-Q3: known email -> old token deleted, new token inserted, email sent, generic response", async () => {
    (findUserByEmail as jest.Mock).mockResolvedValueOnce({
      id: "u1",
      email: "ada@example.com",
    });
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({}) // DELETE old token
      .mockResolvedValueOnce({}); // INSERT new token

    const req: any = { body: { email: "ada@example.com" } };
    const res = mockRes();
    await requestPasswordReset(req, res);

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/DELETE FROM password_reset_tokens/i),
      ["u1"]
    );
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/INSERT INTO password_reset_tokens/i),
      expect.arrayContaining(["u1"])
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ada@example.com" })
    );
    expect(res.json).toHaveBeenCalledWith(GENERIC);
  });

  test("I1: internal error mid-flow -> STILL generic response, not an error status", async () => {
    (findUserByEmail as jest.Mock).mockResolvedValueOnce({
      id: "u1",
      email: "ada@example.com",
    });
    (pool.query as jest.Mock).mockRejectedValueOnce(new Error("db down"));

    const req: any = { body: { email: "ada@example.com" } };
    const res = mockRes();
    await requestPasswordReset(req, res);

    expect(res.status).not.toHaveBeenCalled(); // never escalated to an error code
    expect(res.json).toHaveBeenCalledWith(GENERIC);
  });
});

/* ================================================================
 * CONTRACT: resetPassword(userId, token, newPassword)
 * (see resetPassword.contract.test.ts for the full worked-out version
 * — summarized here for completeness of this file)
 *
 * Preconditions:
 *   P1: userId, token, newPassword all present
 *   P2: newPassword length >= 8
 *   P3: a non-expired token row exists for userId
 *   P4: sha256(token) matches the stored hash
 *
 * Postconditions (all hold):
 *   Q1: users.password_hash updated
 *   Q2: all sessions for userId revoked
 *   Q3: token row deleted
 *   Q4: all three happen atomically (transaction) — see full file
 * ================================================================ */
describe("resetPassword", () => {
  test("P1: missing token -> 400, no DB access", async () => {
    const req: any = { body: { userId: "u1", newPassword: "longenough1" } };
    const res = mockRes();
    await resetPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("P2: password too short -> 400, no DB access", async () => {
    const req: any = { body: { userId: "u1", token: "t", newPassword: "short" } };
    const res = mockRes();
    await resetPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  // Full P3/P4/Q1-Q4 coverage lives in resetPassword.contract.test.ts —
  // not duplicated here to respect DRY between test files.
});

/* ================================================================
 * CONTRACT: changeUserStatus(userId, status)  — admin only (enforced
 *   by roleMiddleware upstream, NOT inside this function — see note
 *   in review: this is an implicit precondition worth documenting)
 *
 * Preconditions:
 *   P1: status is one of "active" | "suspended" | "pending"
 *
 * Postconditions (P1 holds, user exists):
 *   Q1: user's status is updated in the DB
 *   Q2: response 200 with updated user + confirmation message
 *
 * Postconditions (P1 holds, user does not exist):
 *   Q3: response 404, no partial state change
 * ================================================================ */
describe("changeUserStatus", () => {
  test("P1: invalid status value -> 400, no DB write", async () => {
    const req: any = { body: { userId: "u1", status: "banned" } };
    const res = mockRes();
    await changeUserStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(updateUserStatus).not.toHaveBeenCalled();
  });

  test("Q1/Q2: valid status + existing user -> updates and returns 200", async () => {
    (updateUserStatus as jest.Mock).mockResolvedValueOnce({
      id: "u1",
      status: "suspended",
    });
    const req: any = { body: { userId: "u1", status: "suspended" } };
    const res = mockRes();
    await changeUserStatus(req, res);
    expect(updateUserStatus).toHaveBeenCalledWith("u1", "suspended");
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ user: { id: "u1", status: "suspended" } })
    );
  });

  test("Q3: valid status but unknown user -> 404", async () => {
    (updateUserStatus as jest.Mock).mockResolvedValueOnce(undefined);
    const req: any = { body: { userId: "ghost", status: "active" } };
    const res = mockRes();
    await changeUserStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

/* ================================================================
 * CONTRACT: getCurrentUser(req.user.id)
 *
 * Preconditions:
 *   P1: req.user.id refers to a user that (still) exists
 *       (implicit — enforced by authMiddleware running first, which
 *       is itself an external contract this function relies on)
 *
 * Postconditions:
 *   Q1: user exists -> 200 with full user object
 *   Q2: user no longer exists -> 404 (edge case: deleted after token issued)
 * ================================================================ */
describe("getCurrentUser", () => {
  test("Q1: known user -> 200 with user data", async () => {
    (findUserById as jest.Mock).mockResolvedValueOnce({ id: "u1", email: "a@b.com" });
    const req: any = { user: { id: "u1", role: "author", sid: "s1" } };
    const res = mockRes();
    await getCurrentUser(req, res);
    expect(res.json).toHaveBeenCalledWith({ id: "u1", email: "a@b.com" });
  });

  test("Q2: user deleted after token was issued -> 404, not a crash", async () => {
    (findUserById as jest.Mock).mockResolvedValueOnce(undefined);
    const req: any = { user: { id: "ghost", role: "author", sid: "s1" } };
    const res = mockRes();
    await getCurrentUser(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

/* ================================================================
 * CONTRACT: updateCurrentUser(firstName?, lastName?)
 *
 * Preconditions:
 *   P1: at least one of firstName/lastName is provided
 *   P2: any provided field, once trimmed, is non-empty
 *
 * Postconditions (P1,P2 hold, user exists):
 *   Q1: only the provided fields are updated (partial update)
 *   Q2: response 200 with updated user
 *   Q3: active admins are notified (fire-and-forget)
 *
 * Invariants:
 *   I1: email is NEVER updatable through this endpoint, even if sent
 *       in the request body — by contract, not by validation, since
 *       the code simply never reads req.body.email
 *   I2: an admin-notification failure never changes this function's
 *       response to the caller (same pattern as register's I2)
 * ================================================================ */
describe("updateCurrentUser", () => {
  test("P1: neither firstName nor lastName provided -> 400, no update attempted", async () => {
    const req: any = { body: {}, user: { id: "u1", role: "author", sid: "s1" } };
    const res = mockRes();
    await updateCurrentUser(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(updateUserData).not.toHaveBeenCalled();
  });

  test("P2: firstName is only whitespace -> 400, no update attempted", async () => {
    const req: any = {
      body: { firstName: "   " },
      user: { id: "u1", role: "author", sid: "s1" },
    };
    const res = mockRes();
    await updateCurrentUser(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(updateUserData).not.toHaveBeenCalled();
  });

  test("Q1: only lastName provided -> only lastName is included in the update call", async () => {
    (updateUserData as jest.Mock).mockResolvedValueOnce({
      id: "u1",
      first_name: "Ada",
      last_name: "NewName",
    });
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // admin notify lookup
    const req: any = {
      body: { lastName: "NewName" },
      user: { id: "u1", role: "author", sid: "s1" },
    };
    const res = mockRes();
    await updateCurrentUser(req, res);
    expect(updateUserData).toHaveBeenCalledWith("u1", { lastName: "NewName" });
  });

  test("I1: email in the request body is ignored — never reaches updateUserData", async () => {
    (updateUserData as jest.Mock).mockResolvedValueOnce({
      id: "u1",
      first_name: "Ada",
      last_name: "Lovelace",
    });
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    const req: any = {
      body: { firstName: "Ada", email: "attacker@evil.com" },
      user: { id: "u1", role: "author", sid: "s1" },
    };
    const res = mockRes();
    await updateCurrentUser(req, res);
    const updateArg = (updateUserData as jest.Mock).mock.calls[0][1];
    expect(updateArg).not.toHaveProperty("email");
  });

  test("I2: admin-notification failure does not change the success response", async () => {
    (updateUserData as jest.Mock).mockResolvedValueOnce({
      id: "u1",
      first_name: "Ada",
      last_name: "Lovelace",
    });
    (pool.query as jest.Mock).mockRejectedValueOnce(new Error("notify lookup failed"));
    const req: any = {
      body: { firstName: "Ada" },
      user: { id: "u1", role: "author", sid: "s1" },
    };
    const res = mockRes();
    await updateCurrentUser(req, res);
    expect(res.status).not.toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u1" })
    );
  });
});
