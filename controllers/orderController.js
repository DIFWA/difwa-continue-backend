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

export const placeOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = req.userId;
        let { deliveryAddress, paymentMethod, orderType, items: bodyItems } = req.body;

        // 1. Fetch Items (Target Source: req.body.items OR Cart DB)
        let cartItems = [];
        let identifiedRetailer = null;

        if (bodyItems && bodyItems.length > 0) {
            // Option A: Use items directly from the Request Body (Flutter Dev style)
            for (const item of bodyItems) {
                const product = await Product.findById(item.product).session(session);
                if (!product) throw new Error(`Product not found: ${item.product}`);

                cartItems.push({
                    product: product,
                    quantity: item.quantity,
                    retailer: product.retailer // Security: always use retailer from DB product
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

            // Deduct from wallet WITHIN the session
            await walletService.adjustBalance(userId, "appUser", totalAmount, "Debit", "Order Payment", "Order", null, session);
        }

        // 4. Commission logic
        const commissionRate = await getCurrentCommissionRate();
        const commissionAmount = parseFloat(((totalAmount * commissionRate) / 100).toFixed(2));

        // 5. Generate Order ID & Create Order
        const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const order = await Order.create([{
            orderId,
            user: userId,
            items: orderItems,
            totalAmount,
            deliveryAddress,
            paymentMethod,
            paymentStatus: paymentMethod === "Wallet" ? "Paid" : "Pending",
            orderType: orderType || "One-time",
            commissionRate,
            commissionAmount
        }], { session });

        const createdOrder = order[0];

        // 6. Update Stock
        for (const item of cartItems) {
            const updatedProduct = await Product.findByIdAndUpdate(
                item.product._id,
                { $inc: { stock: -item.quantity } },
                { new: true, session }
            );

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

        // 7. Clear Cart if it was used
        if (!bodyItems || bodyItems.length === 0) {
            await Cart.findOneAndDelete({ user: userId }, { session });
        }

        // COMMIT TRANSACTION
        await session.commitTransaction();

        // 8. Background Tasks (Sockets & Notifications)
        await emitOrderUpdate(createdOrder.orderId, "Pending", createdOrder, identifiedRetailer, userId);
        createNotification(identifiedRetailer.toString(), {
            title: "New Order Received! 🦐",
            message: `You have a new order (#${createdOrder._id.toString().slice(-6)}) for ₹${totalAmount}.`,
            type: "Order",
            referenceId: createdOrder._id.toString()
        });

        res.status(201).json({
            success: true,
            message: "Order placed successfully",
            order: createdOrder
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        res.status(500).json({ success: false, message: error.message });
    } finally {
        session.endSession();
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
