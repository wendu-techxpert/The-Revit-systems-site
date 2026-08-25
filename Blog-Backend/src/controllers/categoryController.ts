import { Request, Response } from "express";
import {
  getAllCategories,
  getCategoryById,
  getCategoryBySlug,
  getChildCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/models/categoryModel.js";
import {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/types/category.types.js";
import { isValidRouteParam } from "@/utils/validate.js";
import { sanitize } from "@/utils/sanitize.js";

// ============================================
// GET /categories
// Query param: ?topLevel=true  → only root categories
// ============================================
export const fetchAllCategories = async (req: Request, res: Response) => {
  const topLevelOnly = req.query.topLevel === "true";

  try {
    const categories = await getAllCategories(topLevelOnly);
    res.json(categories);
  } catch (error) {
    console.error("fetchAllCategories error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// GET /categories/:id
// ============================================
export const fetchCategoryById = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!isValidRouteParam(id)) {
    return res.status(400).json({ message: "Invalid category ID" });
  }

  try {
    const category = await getCategoryById(id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json(category);
  } catch (error) {
    console.error("fetchCategoryById error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// GET /categories/slug/:slug
// ============================================
export const fetchCategoryBySlug = async (req: Request, res: Response) => {
  const { slug } = req.params;

  if (!isValidRouteParam(slug)) {
    return res.status(400).json({ message: "Invalid slug" });
  }

  try {
    const category = await getCategoryBySlug(slug);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json(category);
  } catch (error) {
    console.error("fetchCategoryBySlug error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// GET /categories/:id/children
// ============================================
export const fetchChildCategories = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!isValidRouteParam(id)) {
    return res.status(400).json({ message: "Invalid category ID" });
  }

  try {
    const children = await getChildCategories(id);
    res.json(children);
  } catch (error) {
    console.error("fetchChildCategories error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// POST /categories  (admin only)
// ============================================
export const addCategory = async (req: Request, res: Response) => {
  const { name, slug, description, parentId } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ message: "Category name is required" });
  }

  // Build the input object explicitly — only include optional fields if they have a real value.
  // CHANGED: name/description are user-editable admin text — sanitized here
  // the same way authController.ts already sanitizes first/last name,
  // instead of being the one controller that skipped it.
  const input: CreateCategoryInput = { name: sanitize(name.trim()) };

  if (typeof slug === "string" && slug.trim().length > 0) {
    input.slug = slug.trim();
  }
  if (typeof description === "string" && description.trim().length > 0) {
    input.description = sanitize(description.trim());
  }
  if (typeof parentId === "string" && parentId.trim().length > 0) {
    input.parentId = parentId.trim();
  }

  try {
    const category = await createCategory(input);
    res.status(201).json(category);
  } catch (error: any) {
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ message: "Category name or slug already exists" });
    }
    console.error("addCategory error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// PATCH /categories/:id  (admin only)
// ============================================
export const editCategory = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!isValidRouteParam(id)) {
    return res.status(400).json({ message: "Invalid category ID" });
  }
  const updates: UpdateCategoryInput = req.body;

  if (typeof updates.name === "string") {
    updates.name = sanitize(updates.name);
  }
  if (typeof updates.description === "string") {
    updates.description = sanitize(updates.description);
  }

  // Prevent a category from being set as its own parent
  if (updates.parentId === id) {
    return res
      .status(400)
      .json({ message: "A category cannot be its own parent" });
  }

  try {
    const updated = await updateCategory(id, updates);

    if (!updated) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json(updated);
  } catch (error: any) {
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ message: "Category name or slug already exists" });
    }
    if (error.message === "No fields provided for update") {
      return res.status(400).json({ message: error.message });
    }
    console.error("editCategory error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// DELETE /categories/:id  (admin only)
// ============================================
export const removeCategory = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!isValidRouteParam(id)) {
    return res.status(400).json({ message: "Invalid category ID" });
  }

  try {
    const existing = await getCategoryById(id);

    if (!existing) {
      return res.status(404).json({ message: "Category not found" });
    }

    await deleteCategory(id);
    res.json({
      message: "Category deleted. Affected posts have been uncategorized.",
    });
  } catch (error) {
    console.error("removeCategory error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
