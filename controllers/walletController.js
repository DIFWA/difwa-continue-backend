import * as walletService from "../services/walletService.js";
import { verifyRazorpaySignature } from "../services/razorpayService.js";

export const getBalance = async (req, res) => {
    try {
        // userId should be extracted from auth middleware (req.user.id)
        const userId = req.user.id;
        const userType = req.user.role === "retailer" ? "user" : "appUser";

        // This assumes req.user already has balance or we fetch it
        res.status(200).json({
            success: true,
            balance: req.user.walletBalance
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getTransactionHistory = async (req, res) => {
    try {
        const history = await walletService.getHistory(req.user.id);
        res.status(200).json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


// Top up is usually handled via Razorpay success callback
export const topUpSuccess = async (req, res) => {
    try {
        const { amount, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

        // Verify Signature
        const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

        if (!isValid) {
            return res.status(400).json({ success: false, message: "Invalid payment signature" });
        }

        const result = await walletService.adjustBalance(
            req.user.id,
            "appUser",
            amount,
            "Credit",
            "Wallet Top-up",
            "Razorpay",
            razorpayOrderId
        );
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
