import express from "express";
import { createReview, getProductReviews } from "../controllers/reviewController.js";
import { protect } from "../middleware/authMiddleware.js";
import protectAppUser from "../middleware/appAuthMiddleware.js";

const router = express.Router();

router.post("/", protectAppUser, createReview);
router.get("/:productId", getProductReviews);

export default router;
