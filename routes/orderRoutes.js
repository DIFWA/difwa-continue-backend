import express from "express";
import protectAppUser from "../middleware/appAuthMiddleware.js";
import { placeOrder, getMyOrders } from "../controllers/orderController.js";

const router = express.Router();

router.use(protectAppUser);

router.post("/", placeOrder);
router.get("/my", getMyOrders);

export default router;
