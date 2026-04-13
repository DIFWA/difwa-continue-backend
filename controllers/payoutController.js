import Payout from "../models/Payout.js";
import User from "../models/User.js"; // Assuming Retailer is a type of User or related
import AppUser from "../models/AppUser.js";
import { notifyAdmins, createNotification } from "../services/notificationService.js";
import { emitPayoutUpdate } from "../services/socketService.js";

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

        // ─── NOTIFY ADMINS ──────────────────────────────
        const retailer = await User.findById(retailerId).select("fullName businessDetails");
        const shopName = retailer?.businessDetails?.businessName || retailer?.fullName || "A retailer";

        notifyAdmins({
            title: "💰 New Payout Request",
            message: `${shopName} has requested a payout of ₹${amount.toLocaleString()}.`,
            type: "Payout",
            referenceId: payout._id.toString()
        });

        emitPayoutUpdate(payout._id.toString(), 'Pending', payout, retailerId);

        res.status(201).json({ success: true, message: "Payout requested successfully", data: payout });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getPayoutHistory = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const total = await Payout.countDocuments({ retailer: req.user.id });
        const payouts = await Payout.find({ retailer: req.user.id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.json({ 
            success: true, 
            data: payouts,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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

        // ─── NOTIFY RETAILER ─────────────────────────────
        createNotification(payout.retailer.toString(), {
            title: "✅ Payout Approved!",
            message: `Your payout request for ₹${payout.amount.toLocaleString()} has been processed. Transaction ID: ${transactionId}`,
            type: "Payout",
            referenceId: payout._id.toString(),
            onModel: "User"
        });

        emitPayoutUpdate(payout._id.toString(), 'Approved', payout, payout.retailer.toString());

        res.json({ success: true, message: "Payout approved", data: payout });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
export const getAllPayouts = async (req, res) => {
    try {
        const { search = "", page = 1, limit = 10 } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        let payouts = [];
        let total = 0;

        if (search) {
            // Find by transaction ID or shop name
            // For search, we fetch and then filter/paginate manually because of population match
            const allPayouts = await Payout.find({})
                .populate({
                    path: 'retailer',
                    select: 'name email businessDetails'
                })
                .sort({ createdAt: -1 });

            const filteredPayouts = allPayouts.filter(p => {
                const matchesTxn = p.transactionId?.toLowerCase().includes(search.toLowerCase());
                const matchesShop = p.retailer?.businessDetails?.businessName?.toLowerCase().includes(search.toLowerCase());
                const matchesName = p.retailer?.name?.toLowerCase().includes(search.toLowerCase());
                return matchesTxn || matchesShop || matchesName;
            });

            total = filteredPayouts.length;
            payouts = filteredPayouts.slice(skip, skip + limitNum);
        } else {
            total = await Payout.countDocuments({});
            payouts = await Payout.find({})
                .populate('retailer', 'name email businessDetails')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum);
        }

        const statsRes = await Payout.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amount" },
                    pending: {
                        $sum: { $cond: [{ $eq: ["$status", "Pending"] }, "$amount", 0] }
                    },
                    approved: {
                        $sum: { $cond: [{ $eq: ["$status", "Approved"] }, "$amount", 0] }
                    }
                }
            }
        ]);

        const stats = statsRes[0] || { total: 0, pending: 0, approved: 0 };

        res.json({ 
            success: true, 
            data: payouts,
            pagination: {
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum)
            },
            stats
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
