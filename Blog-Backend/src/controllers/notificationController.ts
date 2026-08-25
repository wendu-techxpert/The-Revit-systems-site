import { Request, Response } from "express";
import {
  getNotificationsByUserId,
  getUnreadNotificationCount,
  createNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotificationsForUser,
} from "@/models/notificationModel.js";
import { CreateNotificationInput } from "@/types/notification.types.js";
import { parsePagination, hasMorePage } from "@/utils/pagination.js";
import { isValidRouteParam } from "@/utils/validate.js";
import { pickDefined } from "@/utils/pickDefined.js";

// ============================================
// GET /notifications
// ============================================
export const fetchMyNotifications = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { limit, offset } = parsePagination(req);

  try {
    const notifications = await getNotificationsByUserId(userId, limit, offset);
    res.json({
      notifications,
      limit,
      offset,
      hasMore: hasMorePage(notifications.length, limit),
    });
  } catch (error) {
    console.error("fetchMyNotifications error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// GET /notifications/unread-count
// ============================================
export const fetchUnreadCount = async (req: Request, res: Response) => {
  const userId = req.user!.id;

  try {
    const count = await getUnreadNotificationCount(userId);
    res.json({ unreadCount: count });
  } catch (error) {
    console.error("fetchUnreadCount error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// POST /notifications  (admin only)
// ============================================
export const sendNotification = async (req: Request, res: Response) => {
  const { userId, type, message, link } = req.body;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ message: "userId is required" });
  }

  if (!type || typeof type !== "string") {
    return res.status(400).json({ message: "type is required" });
  }

  if (!message || typeof message !== "string") {
    return res.status(400).json({ message: "message is required" });
  }

  const input: CreateNotificationInput = {
    userId,
    type,
    message,
    ...pickDefined({ link }),
  };

  try {
    const notification = await createNotification(input);
    res.status(201).json(notification);
  } catch (error) {
    console.error("sendNotification error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// PATCH /notifications/:id/read
// ============================================
export const markOneAsRead = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  if (!isValidRouteParam(id)) {
    return res.status(400).json({ message: "Invalid notification ID" });
  }

  try {
    const updated = await markNotificationAsRead(id, userId);

    if (!updated) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("markOneAsRead error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// PATCH /notifications/read-all
// ============================================
export const markAllAsRead = async (req: Request, res: Response) => {
  const userId = req.user!.id;

  try {
    await markAllNotificationsAsRead(userId);
    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("markAllAsRead error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// DELETE /notifications/:id
// ============================================
export const removeNotification = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  if (!isValidRouteParam(id)) {
    return res.status(400).json({ message: "Invalid notification ID" });
  }

  try {
    await deleteNotification(id, userId);
    res.json({ message: "Notification deleted" });
  } catch (error) {
    console.error("removeNotification error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ============================================
// DELETE /notifications
// ============================================
export const removeAllNotifications = async (req: Request, res: Response) => {
  const userId = req.user!.id;

  try {
    await deleteAllNotificationsForUser(userId);
    res.json({ message: "All notifications cleared" });
  } catch (error) {
    console.error("removeAllNotifications error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
