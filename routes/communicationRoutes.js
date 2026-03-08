import express from "express";
import { sendBulkNotification, sendBulkEmail } from "../controllers/communicationController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/notify-all", protect, adminOnly, sendBulkNotification);
router.post("/email-all", protect, adminOnly, sendBulkEmail);

export default router;
