import express from "express";
import { getBalance, getTransactionHistory, topUpSuccess } from "../controllers/walletController.js";
import protectAppUser from "../middleware/appAuthMiddleware.js";

const router = express.Router();

router.get("/balance", protectAppUser, getBalance);
router.get("/history", protectAppUser, getTransactionHistory);
router.post("/topup-success", protectAppUser, topUpSuccess);

export default router;
