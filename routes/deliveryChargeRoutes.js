import express from "express";
import { protect, adminOnly, retailerOnly } from "../middleware/authMiddleware.js";
import protectAppUser from "../middleware/appAuthMiddleware.js";
import {
    getDeliveryChargeSettings,
    updateDeliveryChargeSettings,
    calculateDeliveryFee,
    getDeliveryIncomeReport,
    toggleRetailerDeliveryPermission,
    updateRetailerSlabOptions,
    getRetailerDeliveryCharges,
    updateRetailerDeliveryCharges,
    getRetailerDeliveryIncome
} from "../controllers/deliveryChargeController.js";

const router = express.Router();

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get("/settings", protect, adminOnly, getDeliveryChargeSettings);
router.put("/settings", protect, adminOnly, updateDeliveryChargeSettings);
router.get("/income", protect, adminOnly, getDeliveryIncomeReport);
router.patch("/retailer-permission/:retailerId", protect, adminOnly, toggleRetailerDeliveryPermission);
router.put("/retailer-slab-options", protect, adminOnly, updateRetailerSlabOptions);

// ── Retailer routes ───────────────────────────────────────────────────────────
router.get("/retailer-charges", protect, retailerOnly, getRetailerDeliveryCharges);
router.put("/retailer-charges", protect, retailerOnly, updateRetailerDeliveryCharges);
router.get("/retailer-income", protect, retailerOnly, getRetailerDeliveryIncome);

// ── App (customer) route ──────────────────────────────────────────────────────
router.post("/calculate", protectAppUser, calculateDeliveryFee);

export default router;
