import Payout from "../models/Payout.js";
import User from "../models/User.js"; // Assuming Retailer is a type of User or related
import AppUser from "../models/AppUser.js";

export const requestPayout = async (req, res) => {
    try {
        const { amount, bankDetails } = req.body;
        const retailerId = req.user.id;

        const payout = new Payout({
            retailer: retailerId,
            amount,
            bankDetails,
            status: 'Pending'
        });

        await payout.save();
        res.status(201).json({ message: "Payout requested successfully", payout });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getPayoutHistory = async (req, res) => {
    try {
        const payouts = await Payout.find({ retailer: req.user.id }).sort({ createdAt: -1 });
        res.json(payouts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const approvePayout = async (req, res) => {
    try {
        const { payoutId } = req.params;
        const { transactionId } = req.body;

        const payout = await Payout.findById(payoutId);
        if (!payout) return res.status(404).json({ message: "Payout not found" });

        payout.status = 'Approved';
        payout.transactionId = transactionId;
        payout.processedAt = Date.now();

        await payout.save();
        res.json({ message: "Payout approved", payout });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
export const getAllPayouts = async (req, res) => {
    try {
        const payouts = await Payout.find().populate('retailer', 'name email businessDetails').sort({ createdAt: -1 });
        res.json(payouts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
