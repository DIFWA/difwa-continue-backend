import express from "express";
import { getBalance, getTransactionHistory, topUpSuccess } from "../controllers/walletController.js";
// import { protect } from "../middleware/authMiddleware.js"; // Assuming protection middleware exists

const router = express.Router();

router.get("/balance", getBalance);
router.get("/history", getTransactionHistory);
router.post("/topup-success", topUpSuccess);

export default router;
