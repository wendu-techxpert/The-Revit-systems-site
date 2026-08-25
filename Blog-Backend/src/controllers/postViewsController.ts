import { Request, Response } from "express";
import {
  recordPostView,
  getPostViewsByPostId,
  getPostViewSummary,
  getReferrerStatsByPostId,
} from "@/models/postViewsModel.js";
import { DeviceType, RecordPostViewInput } from "@/types/analytics.types.js";
import { parsePagination, hasMorePage } from "@/utils/pagination.js";
import { isValidRouteParam } from "@/utils/validate.js";
import { pickDefined } from "@/utils/pickDefined.js";

const VALID_DEVICE_TYPES: DeviceType[] = ["desktop", "mobile", "tablet"];

const resolveDeviceType = (raw: unknown): DeviceType | undefined => {
  if (
    typeof raw === "string" &&
    VALID_DEVICE_TYPES.includes(raw as DeviceType)
  ) {
    return raw as DeviceType;
  }
  return undefined;
};

// ============================================
// POST /posts/:postId/views  (public)
// ============================================
export const trackPostView = async (req: Request, res: Response) => {
  const { postId } = req.params;

  if (!isValidRouteParam(postId)) {
    return res.status(400).json({ message: "Invalid post ID" });
  }

  const { visitorId, deviceType, sessionDuration, viewId } = req.body;

  const input: RecordPostViewInput = {
    postId,
    ...pickDefined({ viewId, visitorId }),
  };

  if (typeof req.ip === "string") {
    input.ipAddress = req.ip;
  }

  if (typeof req.headers["user-agent"] === "string") {
    input.userAgent = req.headers["user-agent"];
  }

  if (typeof req.headers.referer === "string") {
    input.referrer = req.headers.referer;
  }

  const resolvedDevice = resolveDeviceType(deviceType);
  if (resolvedDevice !== undefined) {
    input.deviceType = resolvedDevice;
  }

  if (typeof sessionDuration === "number") {
    input.sessionDuration = sessionDuration;
  }

  try {
    await recordPostView(input);
    res.status(201).json({ message: "View recorded" });
  } catch (error) {
    console.error("trackPostView error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// GET /posts/:postId/views  (admin)
// ============================================
export const fetchPostViews = async (req: Request, res: Response) => {
  const { postId } = req.params;

  if (!isValidRouteParam(postId)) {
    return res.status(400).json({ message: "Invalid post ID" });
  }

  const { limit, offset } = parsePagination(req, 50);

  try {
    const views = await getPostViewsByPostId(postId, limit, offset);
    res.json({ views, limit, offset, hasMore: hasMorePage(views.length, limit) });
  } catch (error) {
    console.error("fetchPostViews error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// GET /posts/:postId/views/summary  (admin)
// ============================================
export const fetchPostViewSummary = async (req: Request, res: Response) => {
  const { postId } = req.params;

  if (!isValidRouteParam(postId)) {
    return res.status(400).json({ message: "Invalid post ID" });
  }

  try {
    const summary = await getPostViewSummary(postId);
    res.json(summary);
  } catch (error) {
    console.error("fetchPostViewSummary error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// GET /posts/:postId/referrers  (admin)
// ============================================
export const fetchReferrerStats = async (req: Request, res: Response) => {
  const { postId } = req.params;

  if (!isValidRouteParam(postId)) {
    return res.status(400).json({ message: "Invalid post ID" });
  }

  try {
    const stats = await getReferrerStatsByPostId(postId);
    res.json(stats);
  } catch (error) {
    console.error("fetchReferrerStats error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
