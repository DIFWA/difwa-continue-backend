import express from "express";
import { createReview, getProductReviews, submitOrderReviews } from "../controllers/reviewController.js";
import { protect } from "../middleware/authMiddleware.js";
import protectAppUser from "../middleware/appAuthMiddleware.js";

const router = express.Router();

router.post("/", protectAppUser, createReview);
router.post("/submit-order", protectAppUser, submitOrderReviews);
router.get("/:productId", getProductReviews);

export default router;
