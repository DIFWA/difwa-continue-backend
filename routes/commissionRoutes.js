import express from "express";
import {
    getCommissionSetting,
    updateCommissionSetting,
    getPublicCommissionRate
} from "../controllers/commissionController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Admin: view full commission details with history
router.get("/", protect, adminOnly, getCommissionSetting);

// Admin: update rate
router.put("/", protect, adminOnly, updateCommissionSetting);

// Retailer / public: get current rate only
router.get("/current", protect, getPublicCommissionRate);

export default router;
