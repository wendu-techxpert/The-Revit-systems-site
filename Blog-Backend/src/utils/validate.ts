/**
 * Replaces the `if (!id || Array.isArray(id)) return res.status(400)...`
 * guard that was copy-pasted at the top of nearly every controller
 * function that reads a route param. Express route params are always
 * `string | string[] | undefined` (string[] only if the same param name
 * repeats in the path), so this narrows that down to a clean string.
 */
export const isValidRouteParam = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
