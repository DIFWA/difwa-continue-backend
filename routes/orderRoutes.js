import express from "express";
import protectAppUser from "../middleware/appAuthMiddleware.js";
import { placeOrder, getMyOrders, placeSpotOrder, getUserOrderHistory } from "../controllers/orderController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protectAppUser, placeOrder);
router.post("/spot-order", protectAppUser, placeSpotOrder);
router.get("/my", protectAppUser, getUserOrderHistory); // Unified history under /my
router.get("/history", protectAppUser, getUserOrderHistory); // Also accessible via /history

export default router;
