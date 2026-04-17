import express from "express";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import protectAppUser from "../middleware/appAuthMiddleware.js";
import {
    getDeliveryChargeSettings,
    updateDeliveryChargeSettings,
    calculateDeliveryFee,
    getDeliveryIncomeReport
} from "../controllers/deliveryChargeController.js";

const router = express.Router();

// ── Admin routes ─────────────────────────────────────────────────────────────
// GET  /api/delivery-charge/settings        → View current slabs
// PUT  /api/delivery-charge/settings        → Update slabs
// GET  /api/delivery-charge/income          → Delivery + commission income report
router.get("/settings", protect, adminOnly, getDeliveryChargeSettings);
router.put("/settings", protect, adminOnly, updateDeliveryChargeSettings);
router.get("/income", protect, adminOnly, getDeliveryIncomeReport);

// ── App (customer) route ──────────────────────────────────────────────────────
// POST /api/delivery-charge/calculate       → Calculate fee before placing order
router.post("/calculate", protectAppUser, calculateDeliveryFee);

export default router;
