import express from "express";
import protectAppUser from "../middleware/appAuthMiddleware.js";
import { placeOrder, getMyOrders, placeSpotOrder, getUserOrderHistory, getOrderTracking, getOrderById } from "../controllers/orderController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protectAppUser, placeOrder);
router.post("/spot-order", protectAppUser, placeSpotOrder);
router.get("/my", protectAppUser, getUserOrderHistory); // Unified history under /my
router.get("/history", protectAppUser, getUserOrderHistory); // Also accessible via /history
router.get("/track/:id", protectAppUser, getOrderTracking);
router.get("/:id", protectAppUser, getOrderById); // Missing route to fetch by Mongo ID or orderId

export default router;
