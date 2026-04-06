import express from "express";
import { getMyNotifications, markAsRead, deleteNotification } from "../controllers/appNotificationController.js";
import protectAppUser from "../middleware/appAuthMiddleware.js";

const router = express.Router();

router.get("/", protectAppUser, getMyNotifications);
router.put("/:id/read", protectAppUser, markAsRead);
router.delete("/:id", protectAppUser, deleteNotification);

export default router;
