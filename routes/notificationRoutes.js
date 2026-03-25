import express from "express";
import { getNotifications, markAsRead, markAllAsRead } from "../controllers/notificationController.js";
import { sendPushNotificationToAll, sendPushNotification } from "../services/notificationService.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getNotifications);
router.patch("/read/:id", protect, markAsRead);
router.patch("/read-all", protect, markAllAsRead);

// Send push notification to all users (admin only)
router.post("/push-all", async (req, res) => {
    const { title, body } = req.body;
    if (!title || !body) return res.status(400).json({ message: "title and body required" });
    await sendPushNotificationToAll(title, body);
    res.status(200).json({ message: "Notification sent to all users" });
});

// Send push notification to one user
router.post("/push-one", async (req, res) => {
    const { fcmToken, title, body } = req.body;
    if (!fcmToken || !title || !body) return res.status(400).json({ message: "fcmToken, title and body required" });
    await sendPushNotification(fcmToken, title, body);
    res.status(200).json({ message: "Notification sent" });
});

export default router;
