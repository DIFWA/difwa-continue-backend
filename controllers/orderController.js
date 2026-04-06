import mongoose from "mongoose";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import AppUser from "../models/AppUser.js";
import Subscription from "../models/Subscription.js";
import Rider from "../models/Rider.js";
import * as walletService from "../services/walletService.js";
import { emitOrderUpdate } from "../services/socketService.js";
import { createNotification } from "../services/notificationService.js";
import { getCurrentCommissionRate } from "./commissionController.js";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- CORE BULK PROCESSING (AUTO-PROCESS) ---
export const handleBulkOrders = async (req, res) => {
    try {
        const retailerId = req.user._id;

        // Find orders for THIS retailer only that need processing
        const ordersToProcess = await Order.find({
            "items.retailer": retailerId,
            status: "Pending", // Only start from Pending to show the full sequence
            $or: [{ rider: null }, { rider: { $exists: false } }]
        }).sort({ createdAt: -1 }).limit(5); // Process small batches for better feedback

        if (ordersToProcess.length === 0) return res.status(200).json({ success: true, processed: 0 });

        const availableRiders = await Rider.find({ retailer: retailerId, status: "Available" }).populate('user', 'name');
        if (availableRiders.length === 0) return res.status(400).json({ success: false, message: "No available riders" });

        // RETURN IMMEDIATELY so the frontend doesn't hang, but start the gradual process in the background
        res.status(200).json({ 
            success: true, 
            message: `🤖 Bot started processing ${ordersToProcess.length} orders gradually.`,
            processed: ordersToProcess.length 
        });

        // Run the background sequence
        for (const order of ordersToProcess) {
            const randomIndex = Math.floor(Math.random() * availableRiders.length);
            const rider = availableRiders[randomIndex];
            const riderName = rider.user?.name || "Delivery Partner";
            const riderUserId = rider.user?._id || rider.user || rider._id;
            const userId = order.user?._id || order.user;

            try {
                // --- STEP 1: ACCEPTED ---
                order.status = "Accepted";
                order.statusHistory = order.statusHistory || [];
                order.statusHistory.push({ status: "Accepted", changedBy: retailerId, role: 'system', timestamp: new Date() });
                await order.save();
                
                emitOrderUpdate(order.orderId, "Accepted", { 
                    orderId: order.orderId, 
                    status: "Accepted", 
                    statusHistory: order.statusHistory 
                }, retailerId, userId);

                await sleep(3000); // 3 Second Gap

                // --- STEP 2: PROCESSING ---
                order.status = "Processing";
                order.statusHistory.push({ status: "Processing", changedBy: retailerId, role: 'system', timestamp: new Date() });
                await order.save();

                emitOrderUpdate(order.orderId, "Processing", { 
                    orderId: order.orderId, 
                    status: "Processing", 
                    statusHistory: order.statusHistory 
                }, retailerId, userId);

                await sleep(3000); // 3 Second Gap

                // --- STEP 3: RIDER ASSIGNED ---
                order.rider = riderUserId;
                order.riderAssignmentStatus = "Pending";
                order.status = "Rider Assigned";
                order.statusHistory.push({ status: "Rider Assigned", changedBy: retailerId, role: 'system', timestamp: new Date() });
                await order.save();

                emitOrderUpdate(order.orderId, "Rider Assigned", { 
                    orderId: order.orderId, 
                    status: "Rider Assigned", 
                    riderName,
                    statusHistory: order.statusHistory 
                }, retailerId, userId);

                console.log(`✅ Gradual auto-process complete for Order: ${order.orderId}`);
            } catch (err) {
                console.error(`❌ Gradual process failed for order ${order.orderId}:`, err);
            }
        }
    } catch (error) {
        console.error("Global bulk process error:", error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

// --- APP USER ACTIONS ---

export const placeOrder = async (req, res) => {
    try {
        const { items, totalAmount, deliveryAddress, paymentMethod } = req.body;
        const orderId = `ORD-${Date.now()}`;
        const commissionRate = await getCurrentCommissionRate();
        const commissionAmount = parseFloat(((totalAmount * commissionRate) / 100).toFixed(2));
        const order = await Order.create({
            orderId, user: req.user._id, items, totalAmount, deliveryAddress, paymentMethod,
            commissionRate, commissionAmount,
            statusHistory: [{ status: "Pending", changedBy: req.user._id, role: 'user', timestamp: new Date() }]
        });
        await Cart.deleteOne({ user: req.user._id });
        res.status(201).json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const placeSpotOrder = async (req, res) => {
    try {
        res.status(201).json({ success: true, message: "Spot order feature active" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getUserOrderHistory = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id })
            .populate("items.product", "name image price")
            .populate("rider", "name")
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: orders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getOrderTracking = async (req, res) => {
    try {
        const id = req.params.id || req.params.orderId;
        
        // Find by MongoDB _id if valid, otherwise fallback to custom orderId
        let query = { orderId: id };
        if (mongoose.Types.ObjectId.isValid(id)) {
            query = { $or: [{ _id: id }, { orderId: id }] };
        }

        const order = await Order.findOne(query)
            .populate("items.product", "name image price")
            .populate("rider", "name phone status");
        
        if (!order) return res.status(404).json({ success: false, message: "Not found" });
        res.status(200).json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getMyOrders = getUserOrderHistory;
export const getOrderById = getOrderTracking;
export const createOrder = placeOrder;
export const getUserOrders = getUserOrderHistory;

export const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const order = await Order.findOne({ orderId });
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        order.status = status;
        order.statusHistory.push({ status, changedBy: req.user._id, role: 'system', timestamp: new Date() });
        await order.save();
        res.status(200).json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
