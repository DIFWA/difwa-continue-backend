import express from "express";
import { createReview, getProductReviews } from "../controllers/reviewController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createReview);
router.get("/:productId", getProductReviews);

export default router;
