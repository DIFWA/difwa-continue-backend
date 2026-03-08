import express from "express";
import protectAppUser from "../middleware/appAuthMiddleware.js";
import { subscribeToProduct, getMySubscriptions, updateSubscriptionStatus } from "../controllers/subscriptionController.js";

const router = express.Router();

router.use(protectAppUser);

router.post("/subscribe", subscribeToProduct);
router.get("/my", getMySubscriptions);
router.patch("/status", updateSubscriptionStatus);

export default router;
