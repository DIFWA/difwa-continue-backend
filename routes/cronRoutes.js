import express from "express";
import { runDailySubscriptionCron } from "../controllers/cronController.js";

const router = express.Router();

router.get("/generate-subscription-orders", runDailySubscriptionCron);

export default router;