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
        const { search = "" } = req.query;
        let query = {};

        if (search) {
            query = {
                $or: [
                    { transactionId: { $regex: search, $options: 'i' } },
                    { "retailer.businessDetails.businessName": { $regex: search, $options: 'i' } }
                ]
            };
        }

        // Note: MongoDB doesn't allow searching populated fields directly in find()
        // So we'll have to use an aggregation or find and then filter, 
        // but for simplicity here we'll search by transactionId and 
        // filter the populated results if searching by shop name.
        
        let payouts = await Payout.find(search ? { transactionId: { $regex: search, $options: 'i' } } : {})
            .populate('retailer', 'name email businessDetails')
            .sort({ createdAt: -1 });

        if (search) {
            // Further filter by shop name if no results found by transaction ID
            const filteredByShop = await Payout.find({})
                .populate({
                    path: 'retailer',
                    match: { "businessDetails.businessName": { $regex: search, $options: 'i' } },
                    select: 'name email businessDetails'
                })
                .sort({ createdAt: -1 });
            
            // Filter out items where retailer didn't match the search
            const shopResults = filteredByShop.filter(p => p.retailer !== null);
            
            // Merge and deduplicate
            const txnIds = new Set(payouts.map(p => p._id.toString()));
            shopResults.forEach(p => {
                if (!txnIds.has(p._id.toString())) {
                    payouts.push(p);
                }
            });
            
            // Re-sort by createdAt desc
            payouts.sort((a, b) => b.createdAt - a.createdAt);
        }

        res.json(payouts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
