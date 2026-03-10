import express from "express";
import protectAppUser from "../middleware/appAuthMiddleware.js";
import { placeOrder, getMyOrders, placeSpotOrder } from "../controllers/orderController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, placeOrder);
router.post("/spot-order", protect, placeSpotOrder);
router.get("/my-orders", protect, getMyOrders);

export default router;
