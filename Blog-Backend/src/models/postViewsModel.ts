import { pool } from "@/config/db.js";
import {
  PostView,
  RecordPostViewInput,
  PostViewSummary,
  ReferrerStat,
} from "@/types/analytics.types.js";

/**
 * Insert or update a single post view "session".
 *
 * Why upsert instead of a plain insert:
 * blog-post.js fires TWO beacons per real visit — one immediately on
 * page load (sessionDuration: 0, so a quick bounce still counts) and a
 * second one when the tab is hidden/closed carrying the real elapsed
 * seconds. A plain INSERT recorded both as separate rows, so every
 * genuine visit was double-counted in any COUNT(*) — which is exactly
 * why the numbers looked duplicated/inflated.
 *
 * The fix: the frontend now generates one viewId per session and sends
 * it with both beacons. We upsert on that id — the first beacon inserts
 * the row, the second beacon just updates session_duration on the same
 * row instead of creating a new one. posts.view_count and
 * referrer_stats are only touched on the genuine first insert (detected
 * via `xmax = 0`), never on the duration-update beacon, so nothing gets
 * counted twice.
 */
export const recordPostView = async (
  input: RecordPostViewInput
): Promise<PostView> => {
  const result = await pool.query(
    `INSERT INTO post_views
       (id, post_id, visitor_id, ip_address, user_agent, referrer, device_type, session_duration)
     VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE
       SET session_duration = GREATEST(
             COALESCE(post_views.session_duration, 0),
             COALESCE(EXCLUDED.session_duration, 0)
           )
     RETURNING *, (xmax = 0) AS inserted`,
    [
      input.viewId ?? null,
      input.postId,
      input.visitorId ?? null,
      input.ipAddress ?? null,
      input.userAgent ?? null,
      input.referrer ?? null,
      input.deviceType ?? null,
      input.sessionDuration ?? null,
    ]
  );

  const row = result.rows[0];
  const wasInserted = row.inserted === true;
  delete row.inserted;

  // Only count this as a "real" view once — on the row's first insert.
  // The second beacon (duration update) must never bump the count again.
  if (wasInserted) {
    // Has this visitor ever read THIS post before (any row other than the
    // one we just wrote)? If not, this is a brand new unique reader —
    // increment unique_view_count alongside the total. Anonymous visitors
    // (no visitorId, e.g. tracking blocked) never count toward uniqueness
    // since there's nothing to de-duplicate against.
    let isNewUniqueVisitor = false;
    if (input.visitorId) {
      const priorCheck = await pool.query(
        `SELECT EXISTS (
           SELECT 1 FROM post_views
           WHERE post_id = $1 AND visitor_id = $2 AND id <> $3
         ) AS has_prior_view`,
        [input.postId, input.visitorId, row.id]
      );
      isNewUniqueVisitor = !priorCheck.rows[0].has_prior_view;
    }

    await pool.query(
      `UPDATE posts
       SET view_count = view_count + 1,
           unique_view_count = unique_view_count + $2
       WHERE id = $1`,
      [input.postId, isNewUniqueVisitor ? 1 : 0]
    );

    if (input.referrer) {
      await upsertReferrerStat(input.postId, input.referrer);
    }
  }

  return row;
};

/**
 * Retrieve paginated raw view events for a specific post (admin analytics).
 */
export const getPostViewsByPostId = async (
  postId: string,
  limit: number,
  offset: number
): Promise<PostView[]> => {
  const result = await pool.query(
    `SELECT * FROM post_views
     WHERE post_id = $1
     ORDER BY viewed_at DESC
     LIMIT $2 OFFSET $3`,
    [postId, limit, offset]
  );
  return result.rows;
};

/**
 * Return an aggregated device-type breakdown for a post, plus total
 * and unique visitor counts.
 */
export const getPostViewSummary = async (
  postId: string
): Promise<PostViewSummary> => {
  const result = await pool.query(
    `SELECT
       COUNT(*) AS total_views,
       COUNT(DISTINCT visitor_id) FILTER (WHERE visitor_id IS NOT NULL) AS unique_views,
       COUNT(*) FILTER (WHERE device_type = 'desktop') AS desktop,
       COUNT(*) FILTER (WHERE device_type = 'mobile')  AS mobile,
       COUNT(*) FILTER (WHERE device_type = 'tablet')  AS tablet,
       COUNT(*) FILTER (WHERE device_type IS NULL)      AS unknown
     FROM post_views
     WHERE post_id = $1`,
    [postId]
  );
  return result.rows[0];
};

/**
 * Retrieve referrer stats for a specific post ordered by visit count descending.
 */
export const getReferrerStatsByPostId = async (
  postId: string
): Promise<ReferrerStat[]> => {
  const result = await pool.query(
    `SELECT * FROM referrer_stats
     WHERE post_id = $1
     ORDER BY visit_count DESC, recorded_date DESC`,
    [postId]
  );
  return result.rows;
};

/**
 * Upsert a referrer stat row for today.
 * If a row already exists for (post_id, referrer_url, recorded_date) it increments the count.
 * This is called internally by recordPostView — not exposed as a model export.
 */
const upsertReferrerStat = async (
  postId: string,
  referrerUrl: string
): Promise<void> => {
  // Derive a human-readable name from the referrer URL hostname
  let referrerName: string;
  try {
    referrerName = new URL(referrerUrl).hostname;
  } catch {
    referrerName = referrerUrl.slice(0, 100);
  }

  await pool.query(
    `INSERT INTO referrer_stats (post_id, referrer_name, referrer_url, visit_count, recorded_date)
     VALUES ($1, $2, $3, 1, CURRENT_DATE)
     ON CONFLICT (post_id, referrer_url, recorded_date)
     DO UPDATE SET visit_count = referrer_stats.visit_count + 1`,
    [postId, referrerName, referrerUrl]
  );
};
