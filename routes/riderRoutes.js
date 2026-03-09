import express from "express";
import {
    getRiderOrders,
    updateDeliveryStatus,
    updateRiderLocation,
    addRider,
    getRetailerRiders,
    updateRiderStatusByRetailer,
    respondToOrderAssignment,
    completeDelivery
} from "../controllers/riderController.js";
import { getOptimizedRouteForRider } from "../controllers/logisticsController.js";
import { protect, riderOnly, retailerOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Rider Side
router.get("/orders", protect, riderOnly, getRiderOrders);
router.patch("/status", protect, riderOnly, updateDeliveryStatus);
router.patch("/order-response", protect, riderOnly, respondToOrderAssignment);
router.patch("/location", protect, riderOnly, updateRiderLocation);
router.patch("/complete", protect, riderOnly, completeDelivery);
router.get("/optimized-route", protect, riderOnly, getOptimizedRouteForRider);

// Retailer Side
router.post("/add", protect, retailerOnly, addRider);
router.get("/retailer", protect, retailerOnly, getRetailerRiders);
router.patch("/retailer/:id/status", protect, retailerOnly, updateRiderStatusByRetailer);

export default router;
