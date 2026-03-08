import Subscription from "../models/Subscription.js";
import Product from "../models/Product.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import { createSubscription as createSubService } from "../services/subscriptionService.js";

export const subscribeToProduct = async (req, res) => {
    try {
        const userId = req.userId;
        const { productId, frequency, customDays, quantity, startDate, endDate } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        const subscription = await createSubService(userId, {
            product: productId,
            frequency,
            customDays,
            quantity,
            startDate,
            endDate
        });

        res.status(201).json({
            success: true,
            message: "Subscribed successfully",
            subscription
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getMySubscriptions = async (req, res) => {
    try {
        const subscriptions = await Subscription.find({ user: req.userId })
            .populate("product")
            .populate("retailer", "businessDetails.storeDisplayName");

        res.status(200).json({
            success: true,
            subscriptions
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateSubscriptionStatus = async (req, res) => {
    try {
        const { subscriptionId, status } = req.body;
        const subscription = await Subscription.findOneAndUpdate(
            { _id: subscriptionId, user: req.userId },
            { status },
            { new: true }
        );

        if (!subscription) {
            return res.status(404).json({ success: false, message: "Subscription not found" });
        }

        res.status(200).json({
            success: true,
            message: `Subscription ${status} successfully`,
            subscription
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getSubscriptionPlans = async (req, res) => {
    try {
        const plans = await SubscriptionPlan.find();
        res.status(200).json({ success: true, data: plans });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getPublicSubscriptionPlans = async (req, res) => {
    try {
        const plans = await SubscriptionPlan.find({ status: "Active" });
        res.status(200).json({ success: true, data: plans });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createSubscriptionPlan = async (req, res) => {
    try {
        const plan = await SubscriptionPlan.create(req.body);
        res.status(201).json({ success: true, data: plan });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateSubscriptionPlan = async (req, res) => {
    try {
        const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
        res.status(200).json({ success: true, data: plan });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteSubscriptionPlan = async (req, res) => {
    try {
        const plan = await SubscriptionPlan.findByIdAndDelete(req.params.id);
        if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
        res.status(200).json({ success: true, message: "Plan deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
