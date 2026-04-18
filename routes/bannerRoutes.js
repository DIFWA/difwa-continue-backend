import express from "express";
import { getAdminBanners, createBanner, updateBanner, deleteBanner, reorderBanners } from "../controllers/bannerController.js";
import { getAppBanners } from "../controllers/appBannerController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public App Endpoint
router.get("/app", getAppBanners);

// Admin Endpoints
router.get("/admin", protect, adminOnly, getAdminBanners);
router.post("/admin", protect, adminOnly, createBanner);
router.put("/admin/reorder", protect, adminOnly, reorderBanners);
router.put("/admin/:id", protect, adminOnly, updateBanner);
router.delete("/admin/:id", protect, adminOnly, deleteBanner);

export default router;
