import Payout from "../models/Payout.js";
import User from "../models/User.js"; 
import AppUser from "../models/AppUser.js";
import Order from "../models/Order.js"; // Added for balance calculation
import { notifyAdmins, createNotification } from "../services/notificationService.js";
import { emitPayoutUpdate } from "../services/socketService.js";

export const requestPayout = async (req, res) => {
    try {
        const { amount, bankName, accountNumber, ifsc, bankDetails: nestedDetails } = req.body;
        const retailerId = req.user.id;

        // 1. Calculate Available Balance (Logic from getRetailerRevenueStats)
        const baseQuery = { 
            "items.retailer": retailerId,
            status: { $in: ["Delivered", "Completed"] } 
        };
        const lifetimeOrders = await Order.find(baseQuery);
        
        let gross = 0;
        let commission = 0;
        lifetimeOrders.forEach(order => {
            let orderGross = 0;
            order.items.forEach(item => {
                if (item.retailer && item.retailer.toString() === retailerId.toString()) {
                    orderGross += item.price * item.quantity;
                }
            });
            if (orderGross > 0) {
                const rate = order.commissionRate || 0;
                commission += parseFloat(((orderGross * rate) / 100).toFixed(2));
                gross += orderGross;
            }
        });
        const lifetimeNet = gross - commission;

        // Fetch all payout requests (Pending, Approved, Paid) to calculate remaining balance
        const allPayouts = await Payout.find({ retailer: retailerId, status: { $in: ['Pending', 'Approved', 'Paid'] } });
        const totalRequested = allPayouts.reduce((sum, p) => sum + p.amount, 0);

        const availableBalance = lifetimeNet - totalRequested;

        if (amount > availableBalance) {
            return res.status(400).json({
                success: false,
                message: "Insufficient available balance for payout."
            });
        }

        // 2. Map Bank Details (Supporting both flat and nested structure)
        const finalBankDetails = nestedDetails || {
            bankName,
            accountNumber,
            ifscCode: ifsc,
            accountHolderName: req.user.fullName || req.user.name
        };

        const payout = new Payout({
            retailer: retailerId,
            amount,
            bankDetails: finalBankDetails,
            status: 'Pending'
        });

        await payout.save();

        // 3. Notify Admins
        const retailer = await User.findById(retailerId).select("fullName businessDetails");
        const shopName = retailer?.businessDetails?.businessName || retailer?.fullName || "A retailer";

        notifyAdmins({
            title: "💰 New Payout Request",
            message: `${shopName} has requested a payout of ₹${amount.toLocaleString()}.`,
            type: "Payout",
            referenceId: payout._id.toString()
        });

        emitPayoutUpdate(payout._id.toString(), 'Pending', payout, retailerId);

        res.status(200).json({ success: true, message: "Payout requested successfully" });
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
        const { search = "", page = 1, limit = 10, date = "" } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Build date range filter if date provided (e.g. "2026-04-14")
        let dateQuery = {};
        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            dateQuery = { createdAt: { $gte: start, $lte: end } };
        }

        let payouts = [];
        let total = 0;

        if (search) {
            // For search, fetch all + filter manually (to allow population-based search)
            const allPayouts = await Payout.find({ ...dateQuery })
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
            total = await Payout.countDocuments({ ...dateQuery });
            payouts = await Payout.find({ ...dateQuery })
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
