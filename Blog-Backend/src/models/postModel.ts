import { pool } from "@/config/db.js";

// ================================
// Handles creation of blog posts
// ================================

export const createPost = async ({
  authorId,
  categoryId,
  title,
  slug,
  content,
  excerpt,
  featuredImage,
  status = "draft",
  scheduledDate,
}: {
  authorId: string;
  categoryId: string | null;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  featuredImage?: string;
  status?: "draft" | "published" | "scheduled";
  scheduledDate?: Date;
}) => {
  const result = await pool.query(
    `
    INSERT INTO posts (
      author_id,
      category_id,
      title,
      slug,
      content,
      excerpt,
      featured_image,
      status,
      scheduled_date
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *
    `,
    [
      authorId,
      categoryId,
      title,
      slug,
      content,
      excerpt || null,
      featuredImage || null,
      status,
      scheduledDate || null,
    ]
  );

  return result.rows[0];
};

// =============================================
// Handles getting of blog posts with pagination
// =============================================

export const getPosts = async (
  status: string | null,
  limit: number,
  offset: number
) => {
  // When status is null we return all posts regardless of status
  const result =
    status === null
      ? await pool.query(
          `
          SELECT
            posts.id,
            posts.title,
            posts.slug,
            posts.content,
            posts.excerpt,
            posts.featured_image,
            posts.author_id,
            posts.created_at,
            posts.updated_at,
            posts.published_at,
            posts.status,
            posts.scheduled_date,
            posts.view_count,
            posts.unique_view_count,
            categories.id   AS category_id,
            categories.name AS category
          FROM posts
          LEFT JOIN categories ON posts.category_id = categories.id
          ORDER BY posts.created_at DESC
          LIMIT $1 OFFSET $2
          `,
          [limit, offset]
        )
      : await pool.query(
          `
          SELECT
            posts.id,
            posts.title,
            posts.slug,
            posts.content,
            posts.excerpt,
            posts.featured_image,
            posts.author_id,
            posts.created_at,
            posts.updated_at,
            posts.published_at,
            posts.status,
            posts.scheduled_date,
            posts.view_count,
            posts.unique_view_count,
            categories.id   AS category_id,
            categories.name AS category
          FROM posts
          LEFT JOIN categories ON posts.category_id = categories.id
          WHERE posts.status = $1
          ORDER BY posts.created_at DESC
          LIMIT $2 OFFSET $3
          `,
          [status, limit, offset]
        );

  return result.rows;
};

// =============================================
// Handles getting of blog posts stats
// =============================================

export const getPostStats = async () => {
  const result = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'published') AS published,
      COUNT(*) FILTER (WHERE status = 'draft')     AS draft,
      COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled
    FROM posts;
  `);

  return result.rows[0];
};

// =============================================
// Handles getting of blog posts via ID
// =============================================

export const getPostById = async (id: string) => {
  const result = await pool.query(
    `
    SELECT
      posts.*,
      categories.name AS category_name
    FROM posts
    LEFT JOIN categories ON posts.category_id = categories.id
    WHERE posts.id = $1
    `,
    [id]
  );

  return result.rows[0];
};

// =============================================
// Handles updating of schedules of Blog posts via ID
// =============================================

export const schedulePost = async (id: string, scheduledDate: Date) => {
  const result = await pool.query(
    `
    UPDATE posts
    SET
      status = 'scheduled',
      scheduled_date = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [id, scheduledDate]
  );

  return result.rows[0];
};

// =============================================
// Handles updating of blog posts via ID
// =============================================

export const updatePost = async (
  id: string,
  updates: {
    categoryId?: string | null;
    title?: string;
    slug?: string;
    content?: string;
    excerpt?: string;
    featuredImage?: string;
    status?: string;
  }
) => {
  const fields: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  if (updates.categoryId !== undefined) {
    fields.push(`category_id = $${index++}`);
    values.push(updates.categoryId);
  }

  if (updates.title !== undefined) {
    fields.push(`title = $${index++}`);
    values.push(updates.title);
  }

  if (updates.slug !== undefined) {
    fields.push(`slug = $${index++}`);
    values.push(updates.slug);
  }

  if (updates.content !== undefined) {
    fields.push(`content = $${index++}`);
    values.push(updates.content);
  }

  if (updates.excerpt !== undefined) {
    fields.push(`excerpt = $${index++}`);
    values.push(updates.excerpt);
  }

  if (updates.featuredImage !== undefined) {
    fields.push(`featured_image = $${index++}`);
    values.push(updates.featuredImage);
  }

  if (updates.status !== undefined) {
    fields.push(`status = $${index++}`);
    values.push(updates.status);
    // stamp published_at when publishing via edit
    if (updates.status === "published") {
      fields.push(`published_at = CURRENT_TIMESTAMP`);
    }
    // clear published_at when moving back to draft or scheduled
    if (updates.status === "draft" || updates.status === "scheduled") {
      fields.push(`published_at = NULL`);
    }
  }

  if (fields.length === 0) {
    throw new Error("No fields provided for update");
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);

  const query = `
    UPDATE posts
    SET ${fields.join(", ")}
    WHERE id = $${index}
    RETURNING *
  `;

  values.push(id);

  const result = await pool.query(query, values);
  return result.rows[0];
};

// =============================================
// Handles publishing of blog posts via ID
// =============================================

export const publishPost = async (id: string) => {
  const result = await pool.query(
    `
    UPDATE posts
    SET
      status = 'published',
      published_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return result.rows[0];
};

// =============================================
// Handles deletion of blog posts via ID
// =============================================

export const deletePost = async (id: string) => {
  await pool.query(`DELETE FROM posts WHERE id = $1`, [id]);
};

// =============================================
// Publishes all scheduled posts whose
// scheduled_date is in the past or now.
// Called by the scheduler every minute.
// Returns the rows that were updated so the
// scheduler can log them by ID and title.
// =============================================

export const publishDueScheduledPosts = async (): Promise<
  { id: string; title: string }[]
> => {
  const result = await pool.query(
    `UPDATE posts
     SET
       status       = 'published',
       published_at = NOW(),
       updated_at   = NOW()
     WHERE
       status         = 'scheduled'
       AND scheduled_date <= NOW()
     RETURNING id, title`
  );

  return result.rows;
};

// =============================================
// Get a single published post by its slug
// Used by the OG meta tag endpoint so crawlers
// get correct og:title/og:image/og:description
// =============================================
export const getPostBySlug = async (slug: string) => {
  const result = await pool.query(
    `SELECT
       posts.*,
       categories.name AS category_name
     FROM posts
     LEFT JOIN categories ON posts.category_id = categories.id
     WHERE posts.slug = $1
       AND posts.status = 'published'`,
    [slug]
  );
  return result.rows[0];
};
