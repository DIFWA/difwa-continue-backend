import express from "express";
import protectAppUser from "../middleware/appAuthMiddleware.js";
import { subscribeToProduct, getMySubscriptions, updateSubscriptionStatus, updateVacation, triggerDailyOrders } from "../controllers/subscriptionController.js";

const router = express.Router();

router.use(protectAppUser);

router.post("/subscribe", subscribeToProduct);
router.get("/my", getMySubscriptions);
router.patch("/status", updateSubscriptionStatus);
router.post("/vacation", updateVacation);
router.post("/trigger", triggerDailyOrders);

export default router;
