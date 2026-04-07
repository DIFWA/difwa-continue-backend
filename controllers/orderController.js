import mongoose from "mongoose";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import AppUser from "../models/AppUser.js";
import Subscription from "../models/Subscription.js";
import * as walletService from "../services/walletService.js";
import { emitOrderUpdate } from "../services/socketService.js";
import { createNotification, notifyAdmins } from "../services/notificationService.js";
import { getCurrentCommissionRate } from "./commissionController.js";

// Helper: Sleep function for delays if needed
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Main Order Placement Logic
 * Handles: Cart Checkout AND Direct Body Items (Flutter App)
 */
export const placeOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = req.userId;
        let { deliveryAddress, paymentMethod, orderType, items: bodyItems, deliverySlot } = req.body;

        // 1. Fetch Items (Source: req.body.items OR Cart DB)
        let cartItems = [];
        let identifiedRetailer = null;

        if (bodyItems && bodyItems.length > 0) {
            // Option A: Use items directly from Request Body
            for (const item of bodyItems) {
                const product = await Product.findById(item.product).session(session);
                if (!product) throw new Error(`Product not found: ${item.product}`);
                
                cartItems.push({
                    product: product,
                    quantity: item.quantity,
                    retailer: product.retailer 
                });
                
                if (!identifiedRetailer) identifiedRetailer = product.retailer;
            }
        } else {
            // Option B: Fallback to existing Cart Model
            const cart = await Cart.findOne({ user: userId }).populate("items.product").session(session);
            if (!cart || cart.items.length === 0) {
                throw new Error("Cart is empty");
            }
            cartItems = cart.items;
            identifiedRetailer = cart.retailer;
        }

        // 1.1 Address handling
        if (!deliveryAddress || Object.keys(deliveryAddress).length === 0) {
            const user = await AppUser.findById(userId).session(session);
            const defaultAddress = user?.addresses?.find(a => a.isDefault);
            if (defaultAddress) {
                deliveryAddress = {
                    address: defaultAddress.fullAddress,
                    city: defaultAddress.city,
                    state: defaultAddress.state,
                    pincode: defaultAddress.pincode
                };
            }
        }

        // 2. Validate Stock and Calculate Total
        let totalAmount = 0;
        const orderItems = [];

        for (const item of cartItems) {
            const product = item.product;
            const quantity = item.quantity;

            if (product.stock < quantity) {
                throw new Error(`Not enough stock for ${product.name}. Available: ${product.stock}kg`);
            }

            const itemRetailer = product.retailer || identifiedRetailer;
            if (!identifiedRetailer) identifiedRetailer = itemRetailer;

            const currentPrice = product.price;
            totalAmount += currentPrice * quantity;

            orderItems.push({
                product: product._id,
                retailer: itemRetailer,
                quantity: quantity,
                price: currentPrice,
                status: "Pending"
            });
        }

        if (!identifiedRetailer) {
            throw new Error("Retailer not identified for items.");
        }

        // 3. Wallet Balance Check & Deduction
        if (paymentMethod === "Wallet") {
            const user = await AppUser.findById(userId).session(session);
            if (!user || (user.walletBalance || 0) < totalAmount) {
                throw new Error(`Insufficient wallet balance. Total: ₹${totalAmount}, Current: ₹${user?.walletBalance || 0}`);
            }

            await walletService.adjustBalance(userId, "appUser", totalAmount, "Debit", "Order Payment", "Order", null, session);
        }

        // 4. Commission logic
        const commissionRate = await getCurrentCommissionRate();
        const commissionAmount = parseFloat(((totalAmount * commissionRate) / 100).toFixed(2));

        // 5. Create Order
        const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const orderResults = await Order.create([{
            orderId,
            user: userId,
            items: orderItems,
            totalAmount,
            deliveryAddress,
            paymentMethod,
            deliverySlot: deliverySlot || null,
            paymentStatus: paymentMethod === "Wallet" ? "Paid" : "Pending",
            orderType: orderType || "One-time",
            commissionRate,
            commissionAmount,
            statusHistory: [{ status: "Pending", changedBy: userId, role: 'user', timestamp: new Date() }]
        }], { session });

        const createdOrder = orderResults[0];

        // 6. Update Stock
        for (const item of cartItems) {
            await Product.findByIdAndUpdate(
                item.product._id,
                { $inc: { stock: -item.quantity } },
                { session }
            );
        }

        // 7. Clear Cart if it was used
        if (!bodyItems || bodyItems.length === 0) {
            await Cart.findOneAndDelete({ user: userId }, { session });
        }

        await session.commitTransaction();

        // 8. Background Sockets & Notifications
        await emitOrderUpdate(createdOrder.orderId, "Pending", createdOrder, identifiedRetailer, userId);
        createNotification(identifiedRetailer.toString(), {
            title: "New Order Received! 💧",
            message: `You have a new order (#${createdOrder._id.toString().slice(-6)}) for ₹${totalAmount}.`,
            type: "Order",
            referenceId: createdOrder._id.toString()
        });

        // ─── ADMIN GLOBAL NOTIFICATION ──────────────────
        notifyAdmins({
            title: "Global Order Alert 🛒",
            message: `Order #${createdOrder._id.toString().slice(-6)} placed for ₹${totalAmount}.`,
            type: "Order",
            referenceId: createdOrder._id.toString()
        });

        res.status(201).json({
            success: true,
            message: "Order placed successfully",
            order: createdOrder
        });

    } catch (error) {
        if (session && session.inTransaction()) {
            await session.abortTransaction();
        }
        res.status(500).json({ success: false, message: error.message });
    } finally {
        if (session) session.endSession();
    }
};

export const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.userId })
            .populate("items.product")
            .populate("items.retailer", "businessDetails")
            .populate("rider", "name phone")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            orders
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getUserOrderHistory = async (req, res) => {
    try {
        const userId = req.userId;
        const orders = await Order.find({ user: userId })
            .populate("items.product")
            .populate("items.retailer", "businessDetails")
            .populate("rider", "name phone")
            .sort({ createdAt: -1 });

        const subscriptions = await Subscription.find({ user: userId })
            .populate("product")
            .populate("retailer", "businessDetails")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: {
                orders: orders,
                activePlans: subscriptions
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getOrderTracking = async (req, res) => {
    try {
        const orderId = req.params.id;
        let query = { orderId: orderId };
        
        if (mongoose.Types.ObjectId.isValid(orderId)) {
            query = { $or: [{ _id: orderId }, { orderId: orderId }] };
        }

        const order = await Order.findOne(query)
            .populate("items.product")
            .populate("items.retailer", "businessDetails")
            .populate("rider", "name phone")
            .populate("subscriptionId");

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        res.status(200).json({
            success: true,
            order
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const placeSpotOrder = async (req, res) => {
    return placeOrder(req, res);
};

export const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const order = await Order.findOne({ orderId });
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        
        order.status = status;
        order.statusHistory.push({ status, changedBy: req.userId, role: 'system', timestamp: new Date() });
        await order.save();
        
        res.status(200).json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Bulk process multiple orders for a retailer.
 * Body: { orderIds: ["id1","id2"], status: "Accepted" }
 */
// Alias: getOrderById is the same as getOrderTracking
export const getOrderById = getOrderTracking;

export const handleBulkOrders = async (req, res) => {
    try {
        const retailerId = req.user?.id || req.user?._id || req.userId;
        let { orderIds, status = "Accepted" } = req.body || {};

        // If no specific IDs provided, find all "Pending" or "Accepted" orders for this retailer
        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            const OrderModel = (await import("../models/Order.js")).default;
            const pendingOrders = await OrderModel.find({ 
                "items.retailer": retailerId, 
                status: { $in: ["Pending", "Accepted", "PENDING", "ACCEPTED"] } 
            }).select("_id");
            orderIds = pendingOrders.map(o => o._id);
        }

        if (!orderIds || orderIds.length === 0) {
            return res.status(200).json({ success: true, message: "No pending or accepted orders to process", processed: 0 });
        }

        if (!status) {
            return res.status(400).json({ success: false, message: "status is required" });
        }

        const validStatuses = ["Accepted", "Processing", "Preparing", "Shipped", "Out for Delivery", "Delivered", "Completed", "Cancelled"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
        }

        // ─── Find Best Rider (Lightest Load) ───
        let bestRiderId = null;
        if (status === "Accepted") {
            const RiderModel = (await import("../models/Rider.js")).default;
            const onlineRiders = await RiderModel.find({ 
                retailer: retailerId, 
                status: { $ne: "Offline" } 
            });

            if (onlineRiders.length > 0) {
                // Count current active orders for each online rider
                const riderWorkloads = await Promise.all(onlineRiders.map(async (r) => {
                    const count = await Order.countDocuments({ 
                        rider: r.user, 
                        status: { $in: ["Accepted", "Rider Accepted", "Processing", "Preparing", "Shipped", "Out for Delivery"] } 
                    });
                    return { riderId: r.user, count };
                }));

                // Sort by count and pick the lowest
                riderWorkloads.sort((a, b) => a.count - b.count);
                bestRiderId = riderWorkloads[0].riderId;
            }
        }

        const results = [];
        const errors = [];

        for (const orderId of orderIds) {
            try {
                let query = { orderId };
                if (mongoose.Types.ObjectId.isValid(orderId)) {
                    query = { $or: [{ _id: orderId }, { orderId }] };
                }

                const order = await Order.findOne(query);
                if (!order) {
                    errors.push({ orderId, message: "Order not found" });
                    continue;
                }

                // Auto-Assignment if rider found
                if (status === "Accepted" && bestRiderId) {
                    order.status = "Rider Assigned";
                    order.rider = bestRiderId;
                    order.statusHistory.push({
                        status: "Rider Assigned",
                        changedBy: retailerId,
                        role: "retailer",
                        timestamp: new Date()
                    });
                } else {
                    order.status = status;
                }

                order.statusHistory = order.statusHistory || [];
                order.statusHistory.push({
                    status: order.status,
                    changedBy: retailerId,
                    role: "retailer",
                    timestamp: new Date()
                });
                await order.save();

                // ─── CUSTOMER NOTIFICATION ──────────────────
                createNotification(order.user?.toString(), {
                    title: `Order Update! ${order.status === 'Delivered' ? '🎉' : '🚚'}`,
                    message: `Your order #${order.orderId.slice(-6).toUpperCase()} is now '${order.status}'.`,
                    type: "Order",
                    referenceId: order._id.toString(),
                    onModel: "AppUser"
                });

                // ─── RETAILER NOTIFICATION ──────────────────
                createNotification(retailerId.toString(), {
                    title: `Status Updated ✅`,
                    message: `Order #${order.orderId.slice(-6).toUpperCase()} set to '${order.status}'.`,
                    type: "Order",
                    referenceId: order._id.toString(),
                    onModel: "User"
                });

                // Get rider name if assigned
                let riderDataToEmit = null;
                if (order.rider) {
                    const User = (await import("../models/User.js")).default;
                    const riderUser = await User.findById(order.rider).select("name");
                    riderDataToEmit = {
                        id: order.rider,
                        name: riderUser?.name || "Rider"
                    };
                }

                // Emit real-time update
                emitOrderUpdate(order.orderId, order.status, {
                    orderId: order.orderId,
                    status: order.status,
                    statusHistory: order.statusHistory,
                    rider: riderDataToEmit,
                    riderName: riderDataToEmit?.name
                }, retailerId, order.user?.toString());

                results.push({ orderId: order.orderId, status: order.status });
            } catch (err) {
                errors.push({ orderId, message: err.message });
            }
        }

        res.status(200).json({
            success: true,
            message: `Bulk processed ${results.length} order(s).`,
            processed: results.length,
            updated: results,
            failed: errors
        });

    } catch (error) {
        console.error("handleBulkOrders error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};
