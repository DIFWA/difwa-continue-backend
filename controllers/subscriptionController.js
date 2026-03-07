import SubscriptionPlan from "../models/SubscriptionPlan.js";

// Get all subscription plans
export const getSubscriptionPlans = async (req, res) => {
    try {
        const plans = await SubscriptionPlan.find().sort({ price: 1 });
        res.status(200).json({ success: true, data: plans });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Create a new subscription plan
export const createSubscriptionPlan = async (req, res) => {
    try {
        const plan = await SubscriptionPlan.create(req.body);
        res.status(201).json({ success: true, data: plan });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update an existing subscription plan
export const updateSubscriptionPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const plan = await SubscriptionPlan.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
        if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
        res.status(200).json({ success: true, data: plan });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete a subscription plan
export const deleteSubscriptionPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const plan = await SubscriptionPlan.findByIdAndDelete(id);
        if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
        res.status(200).json({ success: true, message: "Plan deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get public subscription plans (Active only)
export const getPublicSubscriptionPlans = async (req, res) => {
    try {
        const plans = await SubscriptionPlan.find({ status: "Active" }).sort({ price: 1 });
        res.status(200).json({ success: true, data: plans });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
