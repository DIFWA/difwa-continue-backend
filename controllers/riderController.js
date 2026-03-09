import User from "../models/User.js";
import Order from "../models/Order.js";
import RiderModel from "../models/Rider.js";
import bcrypt from "bcryptjs";
import { emitOrderUpdate } from "../services/socketService.js";

export const getRiderOrders = async (req, res) => {
    try {
        const orders = await Order.find({ rider: req.user.id }).populate("user", "name phone");
        res.status(200).json({ success: true, data: orders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateDeliveryStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const order = await Order.findOneAndUpdate(
            { orderId, rider: req.user.id },
            { status, deliveredAt: status === "Delivered" ? new Date() : null },
            { new: true }
        );

        if (!order) return res.status(404).json({ success: false, message: "Order not found or not assigned to you" });

        // Emit real-time update to user
        emitOrderUpdate(orderId, status, { orderId, status });

        res.status(200).json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateRiderLocation = async (req, res) => {
    try {
        const { lat, lng } = req.body;
        const userId = req.user.id;

        await User.findByIdAndUpdate(userId, {
            "location.coordinates": [lng, lat],
            isOnline: true
        });

        // Broadcast to active orders
        const activeOrders = await Order.find({
            rider: userId,
            status: { $in: ["Accepted", "Out for Delivery"] }
        });

        activeOrders.forEach(order => {
            // Room is order_{orderId}
            emitOrderUpdate(`order_${order.orderId}`, "RIDER_LOCATION_UPDATE", {
                lat,
                lng,
                orderId: order.orderId
            });
        });

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const completeDelivery = async (req, res) => {
    try {
        const { orderId, itemWeights } = req.body; // itemWeights: [{ productId, weight }]
        const riderId = req.user.id;

        const order = await Order.findOne({ orderId, rider: riderId }).populate("items.product");
        if (!order) return res.status(404).json({ success: false, message: "Order not found or not assigned to you" });

        let totalRefund = 0;
        const updatedItems = order.items.map(item => {
            const weightInfo = itemWeights?.find(w => w.productId.toString() === item.product._id.toString());
            if (weightInfo && weightInfo.weight < item.quantity) {
                const diff = item.quantity - weightInfo.weight;
                const refundAmount = diff * item.price;
                totalRefund += refundAmount;
                item.deliveredWeight = weightInfo.weight;
            } else {
                item.deliveredWeight = item.quantity;
            }
            return item;
        });

        order.items = updatedItems;
        order.status = "Delivered";
        order.deliveredAt = new Date();
        order.paymentStatus = "Paid";
        await order.save();

        if (totalRefund > 0) {
            await walletService.adjustBalance(
                order.user,
                "appUser",
                totalRefund,
                "Credit",
                `Weight Variation Refund: Order #${orderId}`,
                "Refund",
                order._id
            );
        }

        // Update Rider status to Online
        await RiderModel.findOneAndUpdate({ user: riderId }, { status: "Online" });

        emitOrderUpdate(`order_${orderId}`, "DELIVERED", { orderId, refund: totalRefund });

        res.status(200).json({ success: true, message: "Order delivered successfully", refund: totalRefund });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- RETAILER SIDE MANAGEMENT ---

export const addRider = async (req, res) => {
    try {
        const { name, email, password, phone, vehicleType, plateNumber } = req.body;
        const retailerId = req.user.id;

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ success: false, message: "A user with this email already exists" });

        // Create User account
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({
            name,
            email,
            password: hashedPassword,
            phone,
            role: "rider",
            status: "approved"
        });
        await user.save();

        // Create Rider profile
        const RiderModel = (await import("../models/Rider.js")).default;
        const rider = new RiderModel({
            user: user._id,
            retailer: retailerId,
            vehicleDetails: { vehicleType, plateNumber },
            status: "Offline"
        });
        await rider.save();

        res.status(201).json({ success: true, message: "Rider added successfully", data: { id: rider._id, name: user.name } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getRetailerRiders = async (req, res) => {
    try {
        const RiderModel = (await import("../models/Rider.js")).default;
        const riders = await RiderModel.find({ retailer: req.user.id }).populate("user", "name email phone");
        res.status(200).json({ success: true, data: riders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateRiderStatusByRetailer = async (req, res) => {
    try {
        const { status } = req.body;
        const RiderModel = (await import("../models/Rider.js")).default;
        const rider = await RiderModel.findOneAndUpdate(
            { _id: req.params.id, retailer: req.user.id },
            { status },
            { new: true }
        );
        if (!rider) return res.status(404).json({ success: false, message: "Rider not found" });
        res.status(200).json({ success: true, data: rider });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const respondToOrderAssignment = async (req, res) => {
    try {
        const { orderId, response } = req.body; // response: "Accepted" or "Rejected"
        const riderId = req.user.id;

        const order = await Order.findOne({ orderId, rider: riderId });
        if (!order) return res.status(404).json({ success: false, message: "Order not found or not assigned to you" });

        if (response === "Accepted") {
            order.riderAssignmentStatus = "Accepted";
            order.status = "Accepted";
        } else if (response === "Rejected") {
            order.riderAssignmentStatus = "Rejected";
            order.rider = null; // Unassign rider
        } else {
            return res.status(400).json({ success: false, message: "Invalid response" });
        }

        await order.save();
        res.status(200).json({ success: true, message: `Order ${response.toLowerCase()} successfully`, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
